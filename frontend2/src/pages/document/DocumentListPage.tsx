import { useEffect, useRef, useState } from 'react';
import type { AxiosError } from 'axios';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { documentApi } from '@/api/document.api';
import { ragApi } from '@/api/rag.api';
import {
    Search,
    Upload,
    FileText,
    Trash2,
    Eye,
    SlidersHorizontal,
    CheckCircle2,
    Loader2,
    AlertCircle,
    File
} from 'lucide-react';
import type {
    ChunkDetailResponse,
    DocumentPreviewResponse,
    RagDocumentStatus,
    WorkspaceRagSettingsUpdateRequest
} from '@/types/api.types';

export function DocumentListPage() {
    const { workspaceId: workspaceIdParam } = useParams<{ workspaceId: string }>();
    const workspaceId = Number(workspaceIdParam);
    const [searchQuery, setSearchQuery] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);
    const queryClient = useQueryClient();
    const [selectedDocumentId, setSelectedDocumentId] = useState<number | null>(null);
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const [previewQuery, setPreviewQuery] = useState('');
    const [previewResults, setPreviewResults] = useState<ChunkDetailResponse[]>([]);
    const [previewError, setPreviewError] = useState<string | null>(null);
    const [settingsForm, setSettingsForm] = useState<WorkspaceRagSettingsUpdateRequest>({
        topK: 5,
        similarityThreshold: 0,
        maxChunks: 5,
        maxContextChars: 4000,
        hybridEnabled: true,
        rerankEnabled: false,
        rerankTopN: 10,
        chunkSize: 500,
        chunkOverlapTokens: 50,
    });
    const [settingsMessage, setSettingsMessage] = useState<string | null>(null);
    const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);

    // 문서 목록 조회
    const { data: documents, isLoading } = useQuery({
        queryKey: ['documents', workspaceId],
        queryFn: async () => {
            const response = await documentApi.getDocuments(workspaceId);
            return response.data;
        },
        enabled: !!workspaceId,
    });

    const { data: ragSettings, isLoading: isSettingsLoading } = useQuery({
        queryKey: ['ragSettings', workspaceId],
        queryFn: async () => {
            const response = await ragApi.getSettings(workspaceId);
            return response.data;
        },
        enabled: !!workspaceId,
    });

    useEffect(() => {
        if (!ragSettings) {
            return;
        }
        setSettingsForm({
            topK: ragSettings.topK,
            similarityThreshold: ragSettings.similarityThreshold,
            maxChunks: ragSettings.maxChunks,
            maxContextChars: ragSettings.maxContextChars,
            hybridEnabled: ragSettings.hybridEnabled,
            rerankEnabled: ragSettings.rerankEnabled,
            rerankTopN: ragSettings.rerankTopN,
            chunkSize: ragSettings.chunkSize,
            chunkOverlapTokens: ragSettings.chunkOverlapTokens,
        });
    }, [ragSettings]);

    const { data: documentPreview, isLoading: isPreviewLoading, isError: isPreviewError, error: previewLoadError } = useQuery<DocumentPreviewResponse | null>({
        queryKey: ['documentPreview', workspaceId, selectedDocumentId],
        queryFn: async () => {
            if (!selectedDocumentId) return null;
            const response = await documentApi.getDocumentPreview(workspaceId, selectedDocumentId, {
                sampleCount: 3,
                previewChars: 1200,
            });
            return response.data;
        },
        enabled: !!workspaceId && !!selectedDocumentId && isPreviewOpen,
        retry: false,
    });

    useEffect(() => {
        if (!isPreviewOpen) {
            setSelectedDocumentId(null);
        }
    }, [isPreviewOpen]);

    const resolvePreviewError = (error: unknown) => {
        if (!error) {
            return null;
        }
        const axiosError = error as AxiosError<{ message?: string }>;
        const message = axiosError.response?.data?.message;
        return message || '미리보기를 불러오지 못했습니다.';
    };

    // 문서 업로드
    const uploadMutation = useMutation({
        mutationFn: async (file: File) => {
            await documentApi.uploadDocument(workspaceId, file);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['documents', workspaceId] });
            alert('문서 업로드가 시작되었습니다.');
        },
        onError: (error) => {
            console.error('Upload failed:', error);
            alert('문서 업로드에 실패했습니다.');
        }
    });

    // 문서 삭제
    const deleteMutation = useMutation({
        mutationFn: async (docId: number) => {
            await documentApi.deleteDocument(workspaceId, docId);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['documents', workspaceId] });
        },
        onError: (error) => {
            console.error('Delete failed:', error);
            alert('문서 삭제에 실패했습니다.');
        }
    });

    const updateSettingsMutation = useMutation({
        mutationFn: async () => {
            const response = await ragApi.updateSettings(workspaceId, settingsForm);
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['ragSettings', workspaceId] });
            setSettingsMessage('설정이 저장되었습니다.');
        },
        onError: (error) => {
            console.error('Settings update failed:', error);
            setSettingsMessage('설정 저장에 실패했습니다.');
        },
    });

    const searchMutation = useMutation({
        mutationFn: async () => {
            const trimmed = previewQuery.trim();
            if (!trimmed) {
                throw new Error('query required');
            }
            const response = await ragApi.search(workspaceId, trimmed, {
                topK: settingsForm.topK,
                similarityThreshold: settingsForm.similarityThreshold,
            });
            return response.data;
        },
        onSuccess: (data) => {
            setPreviewResults(data.chunks || []);
            setPreviewError(null);
        },
        onError: (error) => {
            console.error('RAG search failed:', error);
            setPreviewResults([]);
            setPreviewError('검색에 실패했습니다.');
        },
    });

    // 파일 선택 핸들러
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const file = e.target.files[0];
            uploadMutation.mutate(file);
            // Input 초기화 (동일 파일 재선택 가능하게)
            e.target.value = '';
        }
    };

    // 삭제 핸들러
    const handleDelete = (docId: number) => {
        if (confirm('정말로 이 문서를 삭제하시겠습니까? 검색 인덱스에서도 제거됩니다.')) {
            deleteMutation.mutate(docId);
        }
    };

    const filteredDocs = documents?.filter(doc =>
        doc.fileName.toLowerCase().includes(searchQuery.toLowerCase())
    ) || [];

    if (isLoading) return <div className="p-8 text-gray-500">로딩 중...</div>;

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-semibold text-gray-900">RAG 문서 (지식 베이스)</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        LLM이 답변 생성 시 참조할 문서를 업로드하고 관리하세요.
                    </p>
                </div>
                <div className="flex gap-2">
                    <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        onChange={handleFileChange}
                        accept=".pdf,.txt,.docx,.md"
                    />
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploadMutation.isPending}
                        className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium text-sm shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {uploadMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                        {uploadMutation.isPending ? '업로드 중...' : '문서 업로드'}
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                                <SlidersHorizontal size={18} /> RAG 설정
                            </h2>
                            <p className="text-xs text-gray-500 mt-1">
                                검색 정확도와 컨텍스트 길이를 조정할 수 있습니다.
                            </p>
                        </div>
                        <button
                            onClick={() => updateSettingsMutation.mutate()}
                            disabled={updateSettingsMutation.isPending || isSettingsLoading}
                            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                        >
                            {updateSettingsMutation.isPending ? '저장 중...' : '저장'}
                        </button>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <label className="space-y-1">
                            <span className="text-gray-600">Top K</span>
                            <input
                                type="number"
                                min={1}
                                max={10}
                                value={settingsForm.topK}
                                onChange={(e) => {
                                    setSettingsForm({ ...settingsForm, topK: Number(e.target.value) });
                                    setSettingsMessage(null);
                                }}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                            />
                        </label>
                        <label className="space-y-1">
                            <span className="text-gray-600">유사도 임계값</span>
                            <input
                                type="number"
                                min={0}
                                max={1}
                                step={0.05}
                                value={settingsForm.similarityThreshold}
                                onChange={(e) => {
                                    setSettingsForm({ ...settingsForm, similarityThreshold: Number(e.target.value) });
                                    setSettingsMessage(null);
                                }}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                            />
                        </label>
                        <label className="space-y-1">
                            <span className="text-gray-600">컨텍스트 청크 수</span>
                            <input
                                type="number"
                                min={1}
                                max={10}
                                value={settingsForm.maxChunks}
                                onChange={(e) => {
                                    setSettingsForm({ ...settingsForm, maxChunks: Number(e.target.value) });
                                    setSettingsMessage(null);
                                }}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                            />
                        </label>
                        <label className="space-y-1">
                            <span className="text-gray-600">최대 컨텍스트 문자</span>
                            <input
                                type="number"
                                min={500}
                                max={8000}
                                step={100}
                                value={settingsForm.maxContextChars}
                                onChange={(e) => {
                                    setSettingsForm({ ...settingsForm, maxContextChars: Number(e.target.value) });
                                    setSettingsMessage(null);
                                }}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                            />
                        </label>
                    </div>

                    <div className="flex items-center justify-between pt-2">
                        <button
                            type="button"
                            onClick={() => setShowAdvancedSettings((prev) => !prev)}
                            className="text-xs font-medium text-gray-700 hover:underline"
                        >
                            {showAdvancedSettings ? '고급 설정 숨기기' : '고급 설정 보기'}
                        </button>
                        <div className="text-xs text-gray-500">
                            전문가용: 하이브리드/리랭크/청킹
                        </div>
                    </div>

                    {showAdvancedSettings && (
                        <div className="space-y-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <label className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        checked={settingsForm.hybridEnabled}
                                        onChange={(e) => {
                                            setSettingsForm({ ...settingsForm, hybridEnabled: e.target.checked });
                                            setSettingsMessage(null);
                                        }}
                                    />
                                    <span className="text-gray-700">하이브리드 검색 사용</span>
                                </label>
                                <label className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        checked={settingsForm.rerankEnabled}
                                        onChange={(e) => {
                                            setSettingsForm({ ...settingsForm, rerankEnabled: e.target.checked });
                                            setSettingsMessage(null);
                                        }}
                                    />
                                    <span className="text-gray-700">리랭크 사용</span>
                                </label>
                            </div>

                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <label className="space-y-1">
                                    <span className="text-gray-600">리랭크 Top N</span>
                                    <input
                                        type="number"
                                        min={1}
                                        max={30}
                                        value={settingsForm.rerankTopN}
                                        onChange={(e) => {
                                            setSettingsForm({ ...settingsForm, rerankTopN: Number(e.target.value) });
                                            setSettingsMessage(null);
                                        }}
                                        className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                                    />
                                </label>
                                <div className="text-xs text-gray-500 flex items-center">
                                    리랭크는 정확도를 높이지만 비용/지연이 늘 수 있습니다.
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <label className="space-y-1">
                                    <span className="text-gray-600">청크 크기(토큰)</span>
                                    <input
                                        type="number"
                                        min={100}
                                        max={2000}
                                        step={50}
                                        value={settingsForm.chunkSize}
                                        onChange={(e) => {
                                            setSettingsForm({ ...settingsForm, chunkSize: Number(e.target.value) });
                                            setSettingsMessage(null);
                                        }}
                                        className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                                    />
                                </label>
                                <label className="space-y-1">
                                    <span className="text-gray-600">오버랩(토큰)</span>
                                    <input
                                        type="number"
                                        min={0}
                                        max={500}
                                        step={10}
                                        value={settingsForm.chunkOverlapTokens}
                                        onChange={(e) => {
                                            setSettingsForm({ ...settingsForm, chunkOverlapTokens: Number(e.target.value) });
                                            setSettingsMessage(null);
                                        }}
                                        className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                                    />
                                </label>
                            </div>

                            <div className="text-xs text-gray-500">
                                청킹 설정(청크 크기/오버랩)은 <span className="font-medium text-gray-700">새로 업로드/재인게스트</span>되는 문서부터
                                적용됩니다. 이미 업로드된 문서에는 적용되지 않으니 변경 후 문서를 재업로드하세요.
                            </div>
                        </div>
                    )}

	                    <div className="flex flex-wrap gap-2 pt-1">
	                        <button
	                            type="button"
                            onClick={() => {
                                setSettingsForm({
                                    ...settingsForm,
                                    topK: 5,
                                    similarityThreshold: 0.0,
                                    maxChunks: 5,
                                    maxContextChars: 4000,
                                    hybridEnabled: true,
                                    rerankEnabled: false,
                                    rerankTopN: 10,
                                });
	                                setSettingsMessage('프리셋(균형)이 적용되었습니다. 저장을 눌러 반영하세요.');
	                            }}
	                            className="px-3 py-1.5 text-xs font-semibold text-gray-200 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 hover:text-white transition-colors"
	                        >
	                            프리셋: 균형
	                        </button>
	                        <button
	                            type="button"
                            onClick={() => {
                                setSettingsForm({
                                    ...settingsForm,
                                    topK: 10,
                                    similarityThreshold: 0.0,
                                    maxChunks: 7,
                                    maxContextChars: 6000,
                                    hybridEnabled: true,
                                    rerankEnabled: false,
                                    rerankTopN: 10,
                                });
	                                setSettingsMessage('프리셋(리콜 우선)이 적용되었습니다. 저장을 눌러 반영하세요.');
	                            }}
	                            className="px-3 py-1.5 text-xs font-semibold text-gray-200 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 hover:text-white transition-colors"
	                        >
	                            프리셋: 리콜 우선
	                        </button>
	                        <button
	                            type="button"
                            onClick={() => {
                                setSettingsForm({
                                    ...settingsForm,
                                    topK: 10,
                                    similarityThreshold: 0.0,
                                    maxChunks: 4,
                                    maxContextChars: 4000,
                                    hybridEnabled: true,
                                    rerankEnabled: true,
                                    rerankTopN: 20,
                                });
	                                setSettingsMessage('프리셋(정확도 우선)이 적용되었습니다. 저장을 눌러 반영하세요.');
	                            }}
	                            className="px-3 py-1.5 text-xs font-semibold text-gray-200 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 hover:text-white transition-colors"
	                        >
	                            프리셋: 정확도 우선
	                        </button>
	                        <button
	                            type="button"
                            onClick={() => {
                                setSettingsForm({
                                    ...settingsForm,
                                    topK: 3,
                                    similarityThreshold: 0.2,
                                    maxChunks: 2,
                                    maxContextChars: 2000,
                                    hybridEnabled: false,
                                    rerankEnabled: false,
                                    rerankTopN: 10,
                                });
	                                setSettingsMessage('프리셋(비용 절약)이 적용되었습니다. 저장을 눌러 반영하세요.');
	                            }}
	                            className="px-3 py-1.5 text-xs font-semibold text-gray-200 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 hover:text-white transition-colors"
	                        >
	                            프리셋: 비용 절약
	                        </button>
	                    </div>
                    <div className="text-xs text-gray-500 space-y-2">
                        <p className="text-gray-600 font-medium">설정이 의미하는 것</p>
                        <p>
                            <span className="font-medium text-gray-700">Top K</span>: 검색 후보로 가져올 청크 개수입니다. 높일수록 더 많은 후보를
                            찾지만, 노이즈가 늘 수 있고(미리 검색 결과가 많아짐) 검색 시간이 늘 수 있습니다.
                            <span className="ml-1 text-gray-500">(추천 시작값: 5)</span>
                        </p>
                        <p>
                            <span className="font-medium text-gray-700">유사도 임계값</span>: 벡터 검색에서 “이 값보다 덜 비슷한 청크”는
                            제외합니다. 높이면 더 엄격해져서 관련 없는 결과가 줄 수 있지만,{' '}
                            <span className="font-medium text-gray-700">검색 결과가 아예 비는 경우</span>가 크게 늘어납니다.
                            <span className="ml-1 text-gray-500">(추천 시작값: 0.0~0.2)</span>
                        </p>
                        <p>
                            <span className="font-medium text-gray-700">하이브리드 검색</span>: 벡터 검색 + 키워드 검색(오타/짧은 질의에 강함)을
                            함께 사용합니다. 약어(예: S3/VPN)나 오타가 많으면 켜는 것을 추천합니다.
                        </p>
                        <p>
                            <span className="font-medium text-gray-700">리랭크</span>: 검색 후보를 한 번 더 재정렬해서 “정답에 가까운 청크”를
                            위로 올립니다. 정확도를 높이지만 추가 비용/지연이 생길 수 있습니다.
                        </p>
                        <p>
                            <span className="font-medium text-gray-700">컨텍스트 청크 수</span>: 실제 답변 생성 시 LLM에게 전달할 참고 문서
                            청크 개수입니다. 높이면 근거가 늘지만, 프롬프트가 길어져 비용/지연이 증가하고 헷갈릴 수 있습니다.
                            <span className="ml-1 text-gray-500">(추천 시작값: 3~5)</span>
                        </p>
                        <p>
                            <span className="font-medium text-gray-700">최대 컨텍스트 문자</span>: 참고 문서 컨텍스트의 최대 길이(문자 수)입니다.
                            길수록 근거가 늘지만 비용이 증가합니다.
                            <span className="ml-1 text-gray-500">(추천 시작값: 4000)</span>
                        </p>
                        <p className="text-gray-500">
                            참고: 아래 “RAG 미리 검색”은 검색 결과(Top K/임계값)에 영향을 받고, 컨텍스트(청크 수/최대 문자)는 실제 답변 생성 단계에서
                            적용됩니다.
                        </p>
                        <p className="text-gray-500">
                            팁: 결과가 비면 먼저 <span className="font-medium text-gray-700">유사도 임계값</span>을 0.0으로 낮춰보세요.
                        </p>
                    </div>
                    {settingsMessage && (
                        <p className="text-xs text-indigo-600">{settingsMessage}</p>
                    )}
                </div>

                <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 space-y-4">
                    <div>
                        <h2 className="text-lg font-semibold text-gray-900">RAG 미리 검색</h2>
                        <p className="text-xs text-gray-500 mt-1">
                            질문을 넣고 어떤 청크가 찾아지는지 확인하세요.
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={previewQuery}
                            onChange={(e) => {
                                setPreviewQuery(e.target.value);
                                setPreviewError(null);
                            }}
                            placeholder="예: 환불 규정이 어떻게 되나요?"
                            className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm"
                        />
                        <button
                            onClick={() => searchMutation.mutate()}
                            disabled={searchMutation.isPending || !previewQuery.trim()}
                            className="px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 disabled:opacity-50"
                        >
                            {searchMutation.isPending ? '검색 중...' : '검색'}
                        </button>
                    </div>
                    {previewError && (
                        <p className="text-xs text-rose-600">{previewError}</p>
                    )}
                    <div className="space-y-3 max-h-56 overflow-y-auto">
                        {previewResults.length > 0 ? (
                            previewResults.map((chunk, index) => (
                                <div key={`${chunk.documentId}-${index}`} className="p-3 border border-gray-200 rounded-lg">
                                    <div className="text-xs text-gray-500 mb-1">
                                        {chunk.documentName || `문서 ${chunk.documentId ?? '-'}`} · score {chunk.score?.toFixed(3) ?? '-'}
                                    </div>
                                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{chunk.content}</p>
                                </div>
                            ))
                        ) : (
                            <p className="text-xs text-gray-400">검색 결과가 아직 없습니다.</p>
                        )}
                    </div>
                </div>
            </div>

            {/* Search Bar */}
            <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                    type="text"
                    placeholder="파일명 검색..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                />
            </div>

            {/* Document List */}
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-gray-50 border-b border-gray-200 text-xs uppercase tracking-wider text-gray-500 font-medium">
                            <th className="px-6 py-4">파일명</th>
                            <th className="px-6 py-4">상태</th>
                            <th className="px-6 py-4">업로드 일시</th>
                            <th className="px-6 py-4 text-right">관리</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {filteredDocs.length > 0 ? (
                            filteredDocs.map((doc) => (
                                <tr key={doc.id} className="group hover:bg-gray-50/50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                                                <FileText size={18} />
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setSelectedDocumentId(doc.id);
                                                    setIsPreviewOpen(true);
                                                }}
                                                className="text-sm font-medium text-gray-900 hover:text-indigo-600 text-left"
                                            >
                                                {doc.fileName}
                                            </button>
                                        </div>
                                    </td>
                                    {/* Size 컬럼 제거 (API 미지원) */}
                                    <td className="px-6 py-4">
                                        <StatusBadge status={doc.status} />
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-500">
                                        <div className="flex flex-col">
                                            <span>{new Date(doc.createdAt).toLocaleString()}</span>
                                            {/* UploadedBy 제거 (API 미지원) */}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <button
                                            onClick={() => {
                                                setSelectedDocumentId(doc.id);
                                                setIsPreviewOpen(true);
                                            }}
                                            className="text-gray-400 hover:text-indigo-600 p-2 rounded-lg hover:bg-indigo-50 transition-colors"
                                            title="상세 보기"
                                        >
                                            <Eye size={18} />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(doc.id)}
                                            className="text-gray-400 hover:text-red-600 p-2 rounded-lg hover:bg-red-50 transition-colors"
                                            title="문서 삭제"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                                    <div className="flex flex-col items-center justify-center">
                                        <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mb-3">
                                            <File size={24} className="text-gray-400" />
                                        </div>
                                        <p className="text-sm font-medium text-gray-900">등록된 문서가 없습니다.</p>
                                        <p className="text-xs text-gray-500 mt-1">새 문서를 업로드하여 지식 베이스를 구축하세요.</p>
                                    </div>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {isPreviewOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    <div
                        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                        onClick={() => setIsPreviewOpen(false)}
                    />
                    <div className="relative w-full max-w-3xl mx-4 bg-white rounded-xl shadow-xl border border-gray-100 text-gray-900 max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900">문서 상세 보기</h3>
                                <p className="text-xs text-gray-500 mt-1">추출된 내용과 청크 예시를 확인합니다.</p>
                            </div>
                            <button
                                onClick={() => setIsPreviewOpen(false)}
                                className="px-3 py-1.5 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200"
                            >
                                닫기
                            </button>
                        </div>
                        <div className="p-6 space-y-6">
                            {isPreviewLoading && (
                                <p className="text-sm text-gray-500">미리보기를 불러오는 중...</p>
                            )}
                            {isPreviewError && (
                                <p className="text-sm text-rose-600">
                                    {resolvePreviewError(previewLoadError)}
                                </p>
                            )}
                            {!isPreviewLoading && !isPreviewError && documentPreview && (
                                <>
                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                        <div>
                                            <p className="text-xs text-gray-400">파일명</p>
                                            <p className="text-gray-900 font-medium">{documentPreview.document.fileName}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-400">상태</p>
                                            <p className="text-gray-900">{documentPreview.document.status}</p>
                                        </div>
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-semibold text-gray-900 mb-2">추출된 내용 미리보기</h4>
                                        <pre className="whitespace-pre-wrap text-xs text-gray-700 bg-gray-50 border border-gray-200 rounded-lg p-4 max-h-64 overflow-y-auto">
                                            {documentPreview.extractedPreview || '추출된 텍스트가 없습니다.'}
                                        </pre>
                                    </div>
                                    <div>
                                        <div className="flex items-center justify-between mb-2">
                                            <h4 className="text-sm font-semibold text-gray-900">청크 예시</h4>
                                            <span className="text-xs text-gray-400">총 {documentPreview.totalChunks}개</span>
                                        </div>
                                        <div className="space-y-3">
                                            {documentPreview.chunkSamples.length ? (
                                                documentPreview.chunkSamples.map((chunk, index) => (
                                                    <div key={`${chunk.chunkIndex ?? index}`} className="p-3 border border-gray-200 rounded-lg">
                                                        <div className="text-xs text-gray-400 mb-1">
                                                            청크 {chunk.chunkIndex ?? index + 1}/{chunk.chunkTotal ?? documentPreview.totalChunks}
                                                        </div>
                                                        <p className="text-sm text-gray-700 whitespace-pre-wrap">{chunk.content}</p>
                                                    </div>
                                                ))
                                            ) : (
                                                <p className="text-xs text-gray-400">청크 예시가 없습니다.</p>
                                            )}
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function StatusBadge({ status }: { status: RagDocumentStatus }) {
    if (status === 'UPLOADED') {
        return (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">
                <CheckCircle2 size={12} />
                업로드 완료
            </span>
        );
    }
    if (status === 'PARSING' || status === 'CHUNKING' || status === 'EMBEDDING' || status === 'INDEXING') {
        return (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-100">
                <Loader2 size={12} className="animate-spin" />
                처리 중
            </span>
        );
    }
    if (status === 'DONE' || status === 'ACTIVE') {
        return (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-100">
                <CheckCircle2 size={12} />
                완료
            </span>
        );
    }
    if (status === 'FAILED') {
        return (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-50 text-red-700 border border-red-100">
                <AlertCircle size={12} />
                실패
            </span>
        );
    }
    if (status === 'DELETING') {
        return (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700 border border-gray-200">
                <Loader2 size={12} className="animate-spin" />
                삭제 중
            </span>
        );
    }
    if (status === 'DELETED') {
        return (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-500 border border-gray-200">
                삭제됨
            </span>
        );
    }
    return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200">
            {status}
        </span>
    );
}
