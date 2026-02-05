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
        maxContextChars: 2000,
    });
    const [settingsMessage, setSettingsMessage] = useState<string | null>(null);

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
                    <div className="text-xs text-gray-500 space-y-1">
                        <p>Top K를 높이면 더 많은 문서를 참고하고, 임계값을 높이면 정확도가 상승합니다.</p>
                        <p>컨텍스트 길이가 길어질수록 답변 근거가 늘어나지만 비용도 증가합니다.</p>
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
