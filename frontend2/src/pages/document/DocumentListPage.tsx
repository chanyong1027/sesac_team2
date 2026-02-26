import { useEffect, useRef, useState } from 'react';
import type { AxiosError } from 'axios';
import { useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { documentApi } from '@/api/document.api';
import { ragApi } from '@/api/rag.api';
import {
  AlertCircle,
  Brain,
  CheckCircle2,
  Database,
  Eye,
  File,
  FileText,
  Loader2,
  Search,
  Scissors,
  SlidersHorizontal,
  Trash2,
  Upload,
} from 'lucide-react';
import type {
  ChunkDetailResponse,
  DocumentPreviewResponse,
  RagDocumentStatus,
  WorkspaceRagSettingsUpdateRequest,
} from '@/types/api.types';

type RagPreset = 'balanced' | 'recall' | 'accuracy' | 'cost';

export function DocumentListPage() {
  const { workspaceId: workspaceIdParam } = useParams<{ workspaceId: string }>();
  const workspaceId = Number(workspaceIdParam);
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDocumentId, setSelectedDocumentId] = useState<number | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const [previewQuery, setPreviewQuery] = useState('');
  const [previewResults, setPreviewResults] = useState<ChunkDetailResponse[]>([]);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

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
  const [selectedPreset, setSelectedPreset] = useState<RagPreset | null>(null);

  const isValidWorkspaceId = Number.isInteger(workspaceId) && workspaceId > 0;

  const { data: documents, isLoading } = useQuery({
    queryKey: ['documents', workspaceId],
    queryFn: async () => {
      const response = await documentApi.getDocuments(workspaceId);
      return response.data;
    },
    enabled: isValidWorkspaceId,
  });

  const { data: ragSettings, isLoading: isSettingsLoading } = useQuery({
    queryKey: ['ragSettings', workspaceId],
    queryFn: async () => {
      const response = await ragApi.getSettings(workspaceId);
      return response.data;
    },
    enabled: isValidWorkspaceId,
  });

  useEffect(() => {
    if (!ragSettings) return;
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

  const {
    data: documentPreview,
    isLoading: isPreviewLoading,
    isError: isPreviewError,
    error: previewLoadError,
  } = useQuery<DocumentPreviewResponse | null>({
    queryKey: ['documentPreview', workspaceId, selectedDocumentId],
    queryFn: async () => {
      if (!selectedDocumentId) return null;
      const response = await documentApi.getDocumentPreview(workspaceId, selectedDocumentId, {
        sampleCount: 3,
        previewChars: 1200,
      });
      return response.data;
    },
    enabled: isValidWorkspaceId && !!selectedDocumentId && isPreviewOpen,
    retry: false,
  });

  useEffect(() => {
    if (!isPreviewOpen) {
      setSelectedDocumentId(null);
    }
  }, [isPreviewOpen]);

  const resolvePreviewError = (error: unknown) => {
    if (!error) return null;
    const axiosError = error as AxiosError<{ message?: string }>;
    const message = axiosError.response?.data?.message;
    return message || '미리보기를 불러오지 못했습니다.';
  };

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      await documentApi.uploadDocument(workspaceId, file);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents', workspaceId] });
      setIsUploadOpen(false);
      setUploadFile(null);
      setUploadError(null);
      alert('문서 업로드가 시작되었습니다.');
    },
    onError: (error) => {
      console.error('Upload failed:', error);
      setUploadError('문서 업로드에 실패했습니다.');
    },
  });

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
    },
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
      if (!trimmed) throw new Error('query required');
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

  const MAX_UPLOAD_MB = 50;

  const validateAndSetUploadFile = (file: File) => {
    const maxBytes = MAX_UPLOAD_MB * 1024 * 1024;
    if (file.size > maxBytes) {
      setUploadError(`파일이 너무 큽니다. 최대 ${MAX_UPLOAD_MB}MB까지 업로드할 수 있습니다.`);
      setUploadFile(null);
      return;
    }
    setUploadError(null);
    setUploadFile(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      validateAndSetUploadFile(e.target.files[0]);
      e.target.value = '';
    }
  };

  const handleStartUpload = () => {
    if (!uploadFile || uploadMutation.isPending) return;
    uploadMutation.mutate(uploadFile);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    validateAndSetUploadFile(file);
  };

  const handleDelete = (docId: number) => {
    if (confirm('정말로 이 문서를 삭제하시겠습니까? 검색 인덱스에서도 제거됩니다.')) {
      deleteMutation.mutate(docId);
    }
  };

  const setForm = (patch: Partial<WorkspaceRagSettingsUpdateRequest>) => {
    setSettingsForm((prev) => ({ ...prev, ...patch }));
    setSettingsMessage(null);
    setSelectedPreset(null);
  };

  const applyPreset = (preset: RagPreset) => {
    if (preset === 'balanced') {
      setSettingsForm((prev) => ({
        ...prev,
        topK: 5,
        similarityThreshold: 0.0,
        maxChunks: 5,
        maxContextChars: 4000,
        hybridEnabled: true,
        rerankEnabled: false,
        rerankTopN: 10,
      }));
      setSelectedPreset(preset);
      setSettingsMessage('프리셋(균형)이 적용되었습니다. 저장을 눌러 반영하세요.');
      return;
    }
    if (preset === 'recall') {
      setSettingsForm((prev) => ({
        ...prev,
        topK: 10,
        similarityThreshold: 0.0,
        maxChunks: 7,
        maxContextChars: 6000,
        hybridEnabled: true,
        rerankEnabled: false,
        rerankTopN: 10,
      }));
      setSelectedPreset(preset);
      setSettingsMessage('프리셋(리콜 우선)이 적용되었습니다. 저장을 눌러 반영하세요.');
      return;
    }
    if (preset === 'accuracy') {
      setSettingsForm((prev) => ({
        ...prev,
        topK: 10,
        similarityThreshold: 0.0,
        maxChunks: 4,
        maxContextChars: 4000,
        hybridEnabled: true,
        rerankEnabled: true,
        rerankTopN: 20,
      }));
      setSelectedPreset(preset);
      setSettingsMessage('프리셋(정확도 우선)이 적용되었습니다. 저장을 눌러 반영하세요.');
      return;
    }

    setSettingsForm((prev) => ({
      ...prev,
      topK: 3,
      similarityThreshold: 0.2,
      maxChunks: 2,
      maxContextChars: 2000,
      hybridEnabled: false,
      rerankEnabled: false,
      rerankTopN: 10,
    }));
    setSelectedPreset(preset);
    setSettingsMessage('프리셋(비용 절약)이 적용되었습니다. 저장을 눌러 반영하세요.');
  };

  const filteredDocs =
    documents?.filter((doc) => doc.fileName.toLowerCase().includes(searchQuery.toLowerCase())) || [];

  if (!isValidWorkspaceId) {
    return <div className="p-8 text-[var(--text-secondary)]">유효하지 않은 워크스페이스입니다.</div>;
  }

  if (isLoading) return <div className="p-8 text-[var(--text-secondary)]">로딩 중...</div>;

  const presetButtonClass = (preset: RagPreset) =>
    `px-3 py-1.5 rounded-full border text-xs font-medium transition-colors ${
      selectedPreset === preset
        ? 'border-[var(--primary)] text-[var(--primary)] bg-[var(--primary)]/10'
        : 'border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]'
    }`;

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)] mb-1">RAG 문서 (지식 베이스)</h1>
          <p className="text-sm text-[var(--text-secondary)]">LLM이 답변 생성 시 참조할 문서를 업로드하고 관리하세요.</p>
        </div>
        <div>
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            onChange={handleFileChange}
            accept=".pdf,.txt,.docx,.md"
          />
          <button
            type="button"
            onClick={() => {
              setIsUploadOpen(true);
              setUploadError(null);
              setIsDragOver(false);
            }}
            className="flex items-center gap-2 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white px-5 py-2.5 rounded-lg shadow-[0_0_15px_rgba(168,85,247,0.30)] transition-all transform hover:-translate-y-0.5 font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Upload size={18} />
            문서 업로드
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 glass-card rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-[var(--foreground)] flex items-center gap-2">
                <SlidersHorizontal size={18} className="text-[var(--primary)]" /> RAG 설정
              </h2>
              <p className="text-xs text-[var(--text-secondary)] mt-1">검색 정확도와 컨텍스트 길이를 조정할 수 있습니다.</p>
            </div>
            <button
              type="button"
              onClick={() => updateSettingsMutation.mutate()}
              disabled={updateSettingsMutation.isPending || isSettingsLoading}
              className="bg-[var(--primary)] text-white text-xs px-3 py-1.5 rounded-md hover:bg-[var(--primary-hover)] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {updateSettingsMutation.isPending ? '저장 중...' : '저장'}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <label className="space-y-1.5">
              <span className="text-xs font-medium text-[var(--text-secondary)]">Top K</span>
              <input
                type="number"
                min={1}
                max={50}
                value={settingsForm.topK}
                onChange={(e) => setForm({ topK: Number(e.target.value) })}
                className="w-full bg-[var(--card)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--foreground)] focus:ring-2 focus:ring-[var(--ring)] focus:border-transparent outline-none transition-all"
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-medium text-[var(--text-secondary)]">유사도 임계값</span>
              <input
                type="number"
                min={0}
                max={1}
                step={0.05}
                value={settingsForm.similarityThreshold}
                onChange={(e) => setForm({ similarityThreshold: Number(e.target.value) })}
                className="w-full bg-[var(--card)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--foreground)] focus:ring-2 focus:ring-[var(--ring)] focus:border-transparent outline-none transition-all"
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-medium text-[var(--text-secondary)]">컨텍스트 청크 수</span>
              <input
                type="number"
                min={1}
                max={20}
                value={settingsForm.maxChunks}
                onChange={(e) => setForm({ maxChunks: Number(e.target.value) })}
                className="w-full bg-[var(--card)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--foreground)] focus:ring-2 focus:ring-[var(--ring)] focus:border-transparent outline-none transition-all"
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-medium text-[var(--text-secondary)]">최대 컨텍스트 문자</span>
              <input
                type="number"
                min={500}
                max={8000}
                step={100}
                value={settingsForm.maxContextChars}
                onChange={(e) => setForm({ maxContextChars: Number(e.target.value) })}
                className="w-full bg-[var(--card)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--foreground)] focus:ring-2 focus:ring-[var(--ring)] focus:border-transparent outline-none transition-all"
              />
            </label>
          </div>

          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowAdvancedSettings((prev) => !prev)}
              className="text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--foreground)]"
            >
              {showAdvancedSettings ? '고급 설정 숨기기' : '고급 설정 보기'}
            </button>
            <div className="text-xs text-[var(--text-secondary)]">전문가용: 하이브리드/리랭크/청킹</div>
          </div>

          {showAdvancedSettings && (
            <div className="space-y-4 rounded-xl border border-[var(--border)] bg-[var(--muted)] p-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={settingsForm.hybridEnabled}
                    onChange={(e) => setForm({ hybridEnabled: e.target.checked })}
                    className="accent-[var(--primary)]"
                  />
                  <span className="text-[var(--foreground)]">하이브리드 검색 사용</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={settingsForm.rerankEnabled}
                    onChange={(e) => setForm({ rerankEnabled: e.target.checked })}
                    className="accent-[var(--primary)]"
                  />
                  <span className="text-[var(--foreground)]">리랭크 사용</span>
                </label>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <label className="space-y-1">
                  <span className="text-xs font-medium text-[var(--text-secondary)]">리랭크 Top N</span>
                  <input
                    type="number"
                    min={1}
                    max={30}
                    value={settingsForm.rerankTopN}
                    disabled={!settingsForm.rerankEnabled}
                    onChange={(e) => setForm({ rerankTopN: Number(e.target.value) })}
                    className="w-full bg-[var(--card)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--foreground)] focus:ring-2 focus:ring-[var(--ring)] focus:border-transparent outline-none transition-all disabled:opacity-40"
                  />
                </label>
                <div className="text-xs text-[var(--text-secondary)] flex items-center">
                  리랭크는 정확도를 높이지만 비용/지연이 늘 수 있습니다.
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <label className="space-y-1">
                  <span className="text-xs font-medium text-[var(--text-secondary)]">청크 크기(토큰)</span>
                  <input
                    type="number"
                    min={100}
                    max={2000}
                    step={50}
                    value={settingsForm.chunkSize}
                    onChange={(e) => setForm({ chunkSize: Number(e.target.value) })}
                    className="w-full bg-[var(--card)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--foreground)] focus:ring-2 focus:ring-[var(--ring)] focus:border-transparent outline-none transition-all"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-xs font-medium text-[var(--text-secondary)]">오버랩(토큰)</span>
                  <input
                    type="number"
                    min={0}
                    max={500}
                    step={10}
                    value={settingsForm.chunkOverlapTokens}
                    onChange={(e) => setForm({ chunkOverlapTokens: Number(e.target.value) })}
                    className="w-full bg-[var(--card)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--foreground)] focus:ring-2 focus:ring-[var(--ring)] focus:border-transparent outline-none transition-all"
                  />
                </label>
              </div>

              <div className="text-xs text-[var(--text-secondary)]">
                청킹 설정(청크 크기/오버랩)은 <span className="font-medium text-[var(--foreground)]">새로 업로드/재인게스트</span>되는 문서부터 적용됩니다.
                이미 업로드된 문서에는 적용되지 않으니 변경 후 문서를 재업로드하세요.
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2 pt-1">
            <button type="button" onClick={() => applyPreset('balanced')} className={presetButtonClass('balanced')}>
              프리셋: 균형
            </button>
            <button type="button" onClick={() => applyPreset('recall')} className={presetButtonClass('recall')}>
              프리셋: 리콜 우선
            </button>
            <button type="button" onClick={() => applyPreset('accuracy')} className={presetButtonClass('accuracy')}>
              프리셋: 정확도 우선
            </button>
            <button type="button" onClick={() => applyPreset('cost')} className={presetButtonClass('cost')}>
              프리셋: 비용 절약
            </button>
          </div>

          <div className="bg-[var(--muted)] rounded-xl p-4 border border-[var(--border)]">
            <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
              <strong className="text-[var(--foreground)]">설정이 의미하는 것</strong>
            </p>
            <div className="mt-2 text-[11px] text-[var(--text-secondary)] leading-relaxed space-y-2">
              <p>
                <span className="font-medium text-[var(--foreground)]">Top K</span>: 검색 후보로 가져올 청크 개수입니다. 높일수록 더 많은 후보를 찾지만 노이즈와
                검색 시간이 늘 수 있습니다. <span className="text-[var(--text-secondary)]">(추천 시작값: 5)</span>
              </p>
              <p>
                <span className="font-medium text-[var(--foreground)]">유사도 임계값</span>: 벡터 검색에서 이 값보다 덜 비슷한 청크는 제외합니다. 높이면 더
                엄격해지지만 <span className="font-medium text-[var(--foreground)]">결과가 비는 경우</span>가 늘어납니다.{' '}
                <span className="text-[var(--text-secondary)]">(추천 시작값: 0.0~0.2)</span>
              </p>
              <p className="opacity-80">
                팁: 결과가 비면 먼저 <span className="font-medium text-[var(--foreground)]">유사도 임계값</span>을 0.0으로 낮춰보세요.
              </p>
            </div>
          </div>

          {settingsMessage && (
            <div className="text-xs text-[var(--primary)] bg-[var(--primary)]/10 border border-[var(--primary)]/20 rounded-lg px-3 py-2">
              {settingsMessage}
            </div>
          )}
        </div>

        <div className="lg:col-span-5 glass-card rounded-2xl p-6 flex flex-col">
          <div className="mb-2">
            <h2 className="text-lg font-semibold text-[var(--foreground)]">RAG 미리 검색</h2>
            <p className="text-xs text-[var(--text-secondary)] mt-1">질문을 넣고 어떤 청크가 찾아지는지 확인하세요.</p>
          </div>

          <div className="flex gap-2 mb-4">
            <input
              type="text"
              value={previewQuery}
              onChange={(e) => {
                setPreviewQuery(e.target.value);
                setPreviewError(null);
              }}
              placeholder="질문을 입력하세요..."
              className="flex-1 bg-[var(--card)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--foreground)] focus:ring-2 focus:ring-[var(--ring)] focus:border-transparent outline-none transition-all placeholder:text-[var(--text-secondary)]"
            />
            <button
              type="button"
              onClick={() => searchMutation.mutate()}
              disabled={searchMutation.isPending || !previewQuery.trim()}
              className="bg-[var(--foreground)] hover:opacity-90 text-[var(--background)] px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {searchMutation.isPending ? '검색 중...' : '검색'}
            </button>
          </div>

          {previewError && <p className="text-xs text-red-400 mb-2">{previewError}</p>}

          <div className="flex-1 min-h-[320px]">
            {searchMutation.isPending ? (
              <div className="h-full border-2 border-dashed border-[var(--border)] rounded-xl flex flex-col items-center justify-center p-8 text-center bg-[var(--muted)]">
                <Loader2 className="animate-spin text-[var(--text-secondary)] mb-3" />
                <p className="text-sm text-[var(--text-secondary)]">검색 중...</p>
              </div>
            ) : previewResults.length > 0 ? (
              <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
                {previewResults.map((chunk, index) => (
                  <div
                    key={`${chunk.documentId ?? 'doc'}-${index}`}
                    className="p-4 rounded-xl border border-[var(--border)] bg-[var(--muted)]"
                  >
                    <div className="text-xs text-[var(--text-secondary)] mb-2">
                      {chunk.documentName || `문서 ${chunk.documentId ?? '-'}`} · score {chunk.score?.toFixed(3) ?? '-'}
                    </div>
                    <p className="text-sm text-[var(--foreground)] whitespace-pre-wrap leading-relaxed">{chunk.content}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-full border-2 border-dashed border-[var(--border)] rounded-xl flex flex-col items-center justify-center p-8 text-center bg-[var(--muted)]">
                <Search className="text-[var(--text-tertiary)] mb-3" size={44} />
                <p className="text-sm text-[var(--text-secondary)]">검색 결과가 아직 없습니다.</p>
                <p className="text-xs text-[var(--text-secondary)] mt-1">좌측 설정을 조정하거나 문서를 추가하세요.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="relative w-full glass-card rounded-xl border border-[var(--border)]">
        <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-[var(--text-secondary)]">
          <Search size={18} />
        </span>
        <input
          type="text"
          placeholder="파일명으로 검색..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-transparent border-none rounded-xl py-3 pl-10 pr-4 text-sm text-[var(--foreground)] placeholder:text-[var(--text-secondary)] focus:ring-0"
        />
      </div>

      <div className="glass-card rounded-2xl overflow-hidden border border-[var(--border)]">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-[var(--muted)] border-b border-[var(--border)]">
              <th className="px-6 py-4 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider w-1/2">파일명</th>
              <th className="px-6 py-4 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">상태</th>
              <th className="px-6 py-4 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">업로드 일시</th>
              <th className="px-6 py-4 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider text-right">관리</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {filteredDocs.length > 0 ? (
              filteredDocs.map((doc) => (
                <tr key={doc.id} className="group hover:bg-[var(--muted)] transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-9 w-9 bg-blue-500/10 rounded-lg flex items-center justify-center text-blue-700 dark:text-blue-300 border border-blue-500/20">
                        <FileText size={18} className="opacity-90" />
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedDocumentId(doc.id);
                          setIsPreviewOpen(true);
                        }}
                        className="ml-4 text-sm font-medium text-[var(--foreground)] hover:text-[var(--primary)] text-left truncate"
                      >
                        {doc.fileName}
                      </button>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge status={doc.status} />
                  </td>
                  <td className="px-6 py-4 text-sm text-[var(--text-secondary)] font-light">{new Date(doc.createdAt).toLocaleString()}</td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2 text-[var(--text-secondary)]">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedDocumentId(doc.id);
                          setIsPreviewOpen(true);
                        }}
                        className="hover:text-[var(--primary)] p-2 rounded-lg hover:bg-[var(--muted)] transition-colors"
                        title="상세 보기"
                      >
                        <Eye size={18} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(doc.id)}
                        className="hover:text-red-400 p-2 rounded-lg hover:bg-[var(--muted)] transition-colors"
                        title="문서 삭제"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="px-6 py-12 text-center text-[var(--text-secondary)]">
                  <div className="flex flex-col items-center justify-center">
                    <div className="w-12 h-12 bg-[var(--muted)] rounded-full flex items-center justify-center mb-3 border border-[var(--border)]">
                      <File size={24} className="text-[var(--text-secondary)]" />
                    </div>
                    <p className="text-sm font-medium text-[var(--foreground)]">등록된 문서가 없습니다.</p>
                    <p className="text-xs text-[var(--text-secondary)] mt-1">새 문서를 업로드하여 지식 베이스를 구축하세요.</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {isPreviewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsPreviewOpen(false)} />
          <div className="relative w-full max-w-3xl mx-4 glass-card rounded-2xl border border-[var(--border)] text-[var(--foreground)] max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-[var(--border)] flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-[var(--foreground)]">문서 상세 보기</h3>
                <p className="text-xs text-[var(--text-secondary)] mt-1">추출된 내용과 청크 예시를 확인합니다.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsPreviewOpen(false)}
                className="px-3 py-1.5 text-sm font-medium text-[var(--foreground)] bg-[var(--muted)] rounded-lg hover:bg-[var(--accent)] border border-[var(--border)]"
              >
                닫기
              </button>
            </div>
            <div className="p-6 space-y-6">
              {isPreviewLoading && <p className="text-sm text-[var(--text-secondary)]">미리보기를 불러오는 중...</p>}
              {isPreviewError && <p className="text-sm text-red-400">{resolvePreviewError(previewLoadError)}</p>}
              {!isPreviewLoading && !isPreviewError && documentPreview && (
                <>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="p-4 rounded-xl bg-[var(--muted)] border border-[var(--border)]">
                      <p className="text-xs text-[var(--text-secondary)]">파일명</p>
                      <p className="text-[var(--foreground)] font-medium mt-1">{documentPreview.document.fileName}</p>
                    </div>
                    <div className="p-4 rounded-xl bg-[var(--muted)] border border-[var(--border)]">
                      <p className="text-xs text-[var(--text-secondary)]">상태</p>
                      <p className="text-[var(--foreground)] mt-1">{documentPreview.document.status}</p>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-semibold text-[var(--foreground)] mb-2">추출된 내용 미리보기</h4>
                    <pre className="whitespace-pre-wrap text-xs text-[var(--foreground)] bg-[var(--muted)] border border-[var(--border)] rounded-xl p-4 max-h-64 overflow-y-auto">
                      {documentPreview.extractedPreview || '추출된 텍스트가 없습니다.'}
                    </pre>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-semibold text-[var(--foreground)]">청크 예시</h4>
                      <span className="text-xs text-[var(--text-secondary)]">총 {documentPreview.totalChunks}개</span>
                    </div>
                    <div className="space-y-3">
                      {documentPreview.chunkSamples.length ? (
                        documentPreview.chunkSamples.map((chunk, index) => (
                          <div key={`${chunk.chunkIndex ?? index}`} className="p-4 rounded-xl border border-[var(--border)] bg-[var(--muted)]">
                            <div className="text-xs text-[var(--text-secondary)] mb-2">
                              청크 {chunk.chunkIndex ?? index + 1}/{chunk.chunkTotal ?? documentPreview.totalChunks}
                            </div>
                            <p className="text-sm text-[var(--foreground)] whitespace-pre-wrap leading-relaxed">{chunk.content}</p>
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-[var(--text-secondary)]">청크 예시가 없습니다.</p>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {isUploadOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => {
              if (uploadMutation.isPending) return;
              setIsUploadOpen(false);
              setUploadError(null);
              setIsDragOver(false);
            }}
          />
          <div className="relative w-full max-w-2xl mx-4 glass-card rounded-2xl shadow-2xl border border-[var(--border)] overflow-hidden">
            <div className="flex items-center justify-between px-8 py-6 border-b border-[var(--border)] bg-[var(--muted)]/40">
              <div>
                <h2 className="text-xl font-bold text-[var(--foreground)] flex items-center gap-2">
                  <Upload className="text-[var(--primary)]" size={20} />
                  문서 업로드 파이프라인
                </h2>
                <p className="text-sm text-[var(--text-secondary)] mt-1">No-Code RAG ETL 처리를 위한 파일을 업로드하세요.</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (uploadMutation.isPending) return;
                  setIsUploadOpen(false);
                  setUploadError(null);
                  setIsDragOver(false);
                }}
                className="text-[var(--text-secondary)] hover:text-[var(--foreground)] transition-colors"
                aria-label="close upload modal"
                title="닫기"
              >
                <span className="text-xl leading-none">×</span>
              </button>
            </div>

            <div className="p-8">
              <div
                className={[
                  'w-full h-56 border-2 border-dashed rounded-xl flex flex-col items-center justify-center cursor-pointer transition-all group relative overflow-hidden',
                  isDragOver ? 'border-[var(--primary)] bg-[var(--primary)]/10' : 'border-[var(--primary)]/50 bg-[var(--primary)]/5 hover:bg-[var(--primary)]/10',
                ].join(' ')}
                onClick={() => fileInputRef.current?.click()}
                onDragEnter={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsDragOver(true);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsDragOver(true);
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsDragOver(false);
                }}
                onDrop={handleDrop}
                role="button"
                tabIndex={0}
              >
                <div className="absolute inset-0 bg-gradient-to-tr from-[var(--primary)]/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="relative z-10 flex flex-col items-center text-center p-6">
                  <div className="w-16 h-16 bg-[var(--muted)] rounded-full shadow-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300 border border-[var(--border)]">
                    <FileText className="text-[var(--primary)]" size={30} />
                  </div>
                  <h3 className="text-lg font-semibold text-[var(--foreground)] mb-1">
                    파일을 드래그하거나{' '}
                    <span className="text-[var(--primary)] underline decoration-[var(--primary)] decoration-2 underline-offset-2">
                      클릭하여 선택
                    </span>
                  </h3>
                    <p className="text-sm text-[var(--text-secondary)] max-w-xs">
                    PDF, DOCX, TXT, MD 파일을 지원합니다. (최대 {MAX_UPLOAD_MB}MB)
                  </p>
                  {uploadFile && (
                    <div className="mt-4 flex items-center gap-3 px-4 py-2 rounded-xl bg-[var(--muted)] border border-[var(--border)]">
                      <div className="w-9 h-9 rounded-lg bg-[var(--card)] border border-[var(--border)] flex items-center justify-center text-[var(--primary)]">
                        <FileText size={18} />
                      </div>
                      <div className="text-left min-w-0">
                        <div className="text-sm font-medium text-[var(--foreground)] truncate">{uploadFile.name}</div>
                        <div className="text-xs text-[var(--text-secondary)]">
                          {(uploadFile.size / (1024 * 1024)).toFixed(1)} MB
                        </div>
                      </div>
                      <button
                        type="button"
                        className="ml-auto text-xs text-[var(--text-secondary)] hover:text-[var(--foreground)] px-2 py-1 rounded-lg hover:bg-[var(--muted)] border border-transparent hover:border-[var(--border)] transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          setUploadFile(null);
                          setUploadError(null);
                        }}
                      >
                        제거
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {uploadError && (
                <div className="mt-4 text-sm text-red-700 dark:text-red-300 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
                  {uploadError}
                </div>
              )}

              <div className="mt-10">
                <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-4 px-2">
                  <span>Pipeline Stages</span>
                  <span className="text-[var(--primary)]">{uploadMutation.isPending ? 'UPLOADING...' : 'READY TO START'}</span>
                </div>

                <div className="flex items-start justify-between gap-3 w-full px-2">
                  <PipelineStep
                    active
                    label="Tika 추출"
                    icon={<FileText size={18} />}
                    muted={false}
                  />
                  <PipelineConnector active={uploadMutation.isPending} />
                  <PipelineStep
                    active={false}
                    label="토큰 청킹"
                    icon={<Scissors size={18} />}
                    muted
                  />
                  <PipelineConnector active={false} />
                  <PipelineStep
                    active={false}
                    label="임베딩 변환"
                    icon={<Brain size={18} />}
                    muted
                  />
                  <PipelineConnector active={false} />
                  <PipelineStep
                    active={false}
                    label="PgVector 저장"
                    icon={<Database size={18} />}
                    muted
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 px-8 py-5 border-t border-[var(--border)] bg-[var(--muted)]/50">
              <button
                type="button"
                onClick={() => {
                  if (uploadMutation.isPending) return;
                  setIsUploadOpen(false);
                  setUploadError(null);
                  setIsDragOver(false);
                }}
                className="px-5 py-2.5 rounded-lg text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--muted)] transition-colors border border-transparent hover:border-[var(--border)] disabled:opacity-50"
                disabled={uploadMutation.isPending}
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleStartUpload}
                disabled={!uploadFile || uploadMutation.isPending}
                className="px-5 py-2.5 rounded-lg text-sm font-medium bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white shadow-lg shadow-[color:rgba(168,85,247,0.30)] hover:shadow-[color:rgba(168,85,247,0.45)] transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {uploadMutation.isPending ? (
                  <>
                    <Loader2 size={16} className="animate-spin" /> 업로드 중...
                  </>
                ) : (
                  <>
                    처리 시작 <span className="text-base leading-none">→</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: RagDocumentStatus }) {
  const base = 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border';

  if (status === 'UPLOADED') {
    return (
      <span className={`${base} bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/25`}>
        <CheckCircle2 size={12} />
        업로드 완료
      </span>
    );
  }
  if (status === 'PARSING' || status === 'CHUNKING' || status === 'EMBEDDING' || status === 'INDEXING') {
    return (
      <span className={`${base} bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/25`}>
        <Loader2 size={12} className="animate-spin" />
        처리 중
      </span>
    );
  }
  if (status === 'DONE' || status === 'ACTIVE') {
    return (
      <span className={`${base} bg-green-500/10 text-green-700 dark:text-green-300 border-green-500/25`}>
        <CheckCircle2 size={12} />
        완료
      </span>
    );
  }
  if (status === 'FAILED') {
    return (
      <span className={`${base} bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/25`}>
        <AlertCircle size={12} />
        실패
      </span>
    );
  }
  if (status === 'DELETING') {
    return (
      <span className={`${base} bg-gray-500/10 text-[var(--text-secondary)] border-gray-500/25`}>
        <Loader2 size={12} className="animate-spin" />
        삭제 중
      </span>
    );
  }
  if (status === 'DELETED') {
    return <span className={`${base} bg-gray-500/10 text-[var(--text-secondary)] border-gray-500/25`}>삭제됨</span>;
  }
  return <span className={`${base} bg-gray-500/10 text-[var(--text-secondary)] border-gray-500/25`}>{status}</span>;
}

function PipelineConnector({ active }: { active: boolean }) {
  return (
    <div
      className={[
        'flex-1 h-[2px] mt-5 rounded-full',
        active ? 'bg-[var(--primary)]' : 'bg-[var(--border)]',
      ].join(' ')}
    />
  );
}

function PipelineStep({
  active,
  muted,
  icon,
  label,
}: {
  active: boolean;
  muted: boolean;
  icon: React.ReactNode;
  label: string;
}) {
  const ring = active ? 'border-[var(--primary)] text-[var(--primary)] shadow-[0_0_14px_rgba(168,85,247,0.25)]' : 'border-[var(--border)] text-[var(--text-secondary)]';
  const opacity = muted ? 'opacity-60' : 'opacity-100';
  return (
    <div className={`flex flex-col items-center relative z-10 ${opacity} min-w-[72px]`}>
      <div className={`w-10 h-10 rounded-full bg-[var(--muted)] border-2 flex items-center justify-center ${ring}`}>
        {icon}
      </div>
      <span className={`mt-2 text-xs font-medium ${active ? 'text-[var(--foreground)]' : 'text-[var(--text-secondary)]'}`}>{label}</span>
    </div>
  );
}
