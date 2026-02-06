import { useEffect, useRef, useState } from 'react';
import type { AxiosError } from 'axios';
import { useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { documentApi } from '@/api/document.api';
import { ragApi } from '@/api/rag.api';
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  File,
  FileText,
  Loader2,
  Search,
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
  if (!isValidWorkspaceId) {
    return <div className="p-8 text-gray-300">유효하지 않은 워크스페이스입니다.</div>;
  }

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
    enabled: !!workspaceId && !!selectedDocumentId && isPreviewOpen,
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
      alert('문서 업로드가 시작되었습니다.');
    },
    onError: (error) => {
      console.error('Upload failed:', error);
      alert('문서 업로드에 실패했습니다.');
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      uploadMutation.mutate(file);
      e.target.value = '';
    }
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

  if (isLoading) return <div className="p-8 text-gray-300">로딩 중...</div>;

  const presetButtonClass = (preset: RagPreset) =>
    `px-3 py-1.5 rounded-full border text-xs font-medium transition-colors ${
      selectedPreset === preset
        ? 'border-[var(--primary)] text-purple-200 bg-[var(--primary)]/10'
        : 'border-white/10 text-gray-300 hover:bg-white/10 hover:text-white'
    }`;

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">RAG 문서 (지식 베이스)</h1>
          <p className="text-sm text-gray-400">LLM이 답변 생성 시 참조할 문서를 업로드하고 관리하세요.</p>
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
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadMutation.isPending}
            className="flex items-center gap-2 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white px-5 py-2.5 rounded-lg shadow-[0_0_15px_rgba(168,85,247,0.30)] transition-all transform hover:-translate-y-0.5 font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {uploadMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Upload size={18} />}
            {uploadMutation.isPending ? '업로드 중...' : '문서 업로드'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 glass-card rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <SlidersHorizontal size={18} className="text-[var(--primary)]" /> RAG 설정
              </h2>
              <p className="text-xs text-gray-400 mt-1">검색 정확도와 컨텍스트 길이를 조정할 수 있습니다.</p>
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
              <span className="text-xs font-medium text-gray-300">Top K</span>
              <input
                type="number"
                min={1}
                max={50}
                value={settingsForm.topK}
                onChange={(e) => setForm({ topK: Number(e.target.value) })}
                className="w-full bg-[#151725] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-[var(--ring)] focus:border-transparent outline-none transition-all"
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-medium text-gray-300">유사도 임계값</span>
              <input
                type="number"
                min={0}
                max={1}
                step={0.05}
                value={settingsForm.similarityThreshold}
                onChange={(e) => setForm({ similarityThreshold: Number(e.target.value) })}
                className="w-full bg-[#151725] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-[var(--ring)] focus:border-transparent outline-none transition-all"
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-medium text-gray-300">컨텍스트 청크 수</span>
              <input
                type="number"
                min={1}
                max={20}
                value={settingsForm.maxChunks}
                onChange={(e) => setForm({ maxChunks: Number(e.target.value) })}
                className="w-full bg-[#151725] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-[var(--ring)] focus:border-transparent outline-none transition-all"
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-medium text-gray-300">최대 컨텍스트 문자</span>
              <input
                type="number"
                min={500}
                max={8000}
                step={100}
                value={settingsForm.maxContextChars}
                onChange={(e) => setForm({ maxContextChars: Number(e.target.value) })}
                className="w-full bg-[#151725] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-[var(--ring)] focus:border-transparent outline-none transition-all"
              />
            </label>
          </div>

          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowAdvancedSettings((prev) => !prev)}
              className="text-xs font-medium text-white/90 hover:text-purple-200"
            >
              {showAdvancedSettings ? '고급 설정 숨기기' : '고급 설정 보기'}
            </button>
            <div className="text-xs text-gray-500">전문가용: 하이브리드/리랭크/청킹</div>
          </div>

          {showAdvancedSettings && (
            <div className="space-y-4 rounded-xl border border-white/10 bg-black/20 p-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={settingsForm.hybridEnabled}
                    onChange={(e) => setForm({ hybridEnabled: e.target.checked })}
                    className="accent-[var(--primary)]"
                  />
                  <span className="text-gray-200">하이브리드 검색 사용</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={settingsForm.rerankEnabled}
                    onChange={(e) => setForm({ rerankEnabled: e.target.checked })}
                    className="accent-[var(--primary)]"
                  />
                  <span className="text-gray-200">리랭크 사용</span>
                </label>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <label className="space-y-1">
                  <span className="text-xs font-medium text-gray-300">리랭크 Top N</span>
                  <input
                    type="number"
                    min={1}
                    max={30}
                    value={settingsForm.rerankTopN}
                    disabled={!settingsForm.rerankEnabled}
                    onChange={(e) => setForm({ rerankTopN: Number(e.target.value) })}
                    className="w-full bg-[#151725] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-[var(--ring)] focus:border-transparent outline-none transition-all disabled:opacity-40"
                  />
                </label>
                <div className="text-xs text-gray-500 flex items-center">
                  리랭크는 정확도를 높이지만 비용/지연이 늘 수 있습니다.
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <label className="space-y-1">
                  <span className="text-xs font-medium text-gray-300">청크 크기(토큰)</span>
                  <input
                    type="number"
                    min={100}
                    max={2000}
                    step={50}
                    value={settingsForm.chunkSize}
                    onChange={(e) => setForm({ chunkSize: Number(e.target.value) })}
                    className="w-full bg-[#151725] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-[var(--ring)] focus:border-transparent outline-none transition-all"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-xs font-medium text-gray-300">오버랩(토큰)</span>
                  <input
                    type="number"
                    min={0}
                    max={500}
                    step={10}
                    value={settingsForm.chunkOverlapTokens}
                    onChange={(e) => setForm({ chunkOverlapTokens: Number(e.target.value) })}
                    className="w-full bg-[#151725] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-[var(--ring)] focus:border-transparent outline-none transition-all"
                  />
                </label>
              </div>

              <div className="text-xs text-gray-500">
                청킹 설정(청크 크기/오버랩)은 <span className="font-medium text-gray-300">새로 업로드/재인게스트</span>되는 문서부터 적용됩니다.
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

          <div className="bg-[#151725]/50 rounded-xl p-4 border border-white/10">
            <p className="text-[11px] text-gray-400 leading-relaxed">
              <strong className="text-gray-200">설정이 의미하는 것</strong>
            </p>
            <div className="mt-2 text-[11px] text-gray-400 leading-relaxed space-y-2">
              <p>
                <span className="font-medium text-gray-200">Top K</span>: 검색 후보로 가져올 청크 개수입니다. 높일수록 더 많은 후보를 찾지만 노이즈와
                검색 시간이 늘 수 있습니다. <span className="text-gray-500">(추천 시작값: 5)</span>
              </p>
              <p>
                <span className="font-medium text-gray-200">유사도 임계값</span>: 벡터 검색에서 이 값보다 덜 비슷한 청크는 제외합니다. 높이면 더
                엄격해지지만 <span className="font-medium text-gray-200">결과가 비는 경우</span>가 늘어납니다.{' '}
                <span className="text-gray-500">(추천 시작값: 0.0~0.2)</span>
              </p>
              <p className="opacity-80">
                팁: 결과가 비면 먼저 <span className="font-medium text-gray-200">유사도 임계값</span>을 0.0으로 낮춰보세요.
              </p>
            </div>
          </div>

          {settingsMessage && (
            <div className="text-xs text-purple-200 bg-[var(--primary)]/10 border border-[var(--primary)]/20 rounded-lg px-3 py-2">
              {settingsMessage}
            </div>
          )}
        </div>

        <div className="lg:col-span-5 glass-card rounded-2xl p-6 flex flex-col">
          <div className="mb-2">
            <h2 className="text-lg font-semibold text-white">RAG 미리 검색</h2>
            <p className="text-xs text-gray-400 mt-1">질문을 넣고 어떤 청크가 찾아지는지 확인하세요.</p>
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
              className="flex-1 bg-[#151725] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-[var(--ring)] focus:border-transparent outline-none transition-all placeholder:text-gray-500"
            />
            <button
              type="button"
              onClick={() => searchMutation.mutate()}
              disabled={searchMutation.isPending || !previewQuery.trim()}
              className="bg-gray-600 hover:bg-gray-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {searchMutation.isPending ? '검색 중...' : '검색'}
            </button>
          </div>

          {previewError && <p className="text-xs text-red-400 mb-2">{previewError}</p>}

          <div className="flex-1 min-h-[320px]">
            {searchMutation.isPending ? (
              <div className="h-full border-2 border-dashed border-white/10 rounded-xl flex flex-col items-center justify-center p-8 text-center bg-black/20">
                <Loader2 className="animate-spin text-gray-400 mb-3" />
                <p className="text-sm text-gray-300">검색 중...</p>
              </div>
            ) : previewResults.length > 0 ? (
              <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
                {previewResults.map((chunk, index) => (
                  <div
                    key={`${chunk.documentId ?? 'doc'}-${index}`}
                    className="p-4 rounded-xl border border-white/10 bg-black/20"
                  >
                    <div className="text-xs text-gray-400 mb-2">
                      {chunk.documentName || `문서 ${chunk.documentId ?? '-'}`} · score {chunk.score?.toFixed(3) ?? '-'}
                    </div>
                    <p className="text-sm text-gray-200 whitespace-pre-wrap leading-relaxed">{chunk.content}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-full border-2 border-dashed border-white/10 rounded-xl flex flex-col items-center justify-center p-8 text-center bg-black/20">
                <Search className="text-gray-600 mb-3" size={44} />
                <p className="text-sm text-gray-400">검색 결과가 아직 없습니다.</p>
                <p className="text-xs text-gray-600 mt-1">좌측 설정을 조정하거나 문서를 추가하세요.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="relative w-full glass-card rounded-xl border border-white/10">
        <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
          <Search size={18} />
        </span>
        <input
          type="text"
          placeholder="파일명으로 검색..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-transparent border-none rounded-xl py-3 pl-10 pr-4 text-sm text-white placeholder:text-gray-500 focus:ring-0"
        />
      </div>

      <div className="glass-card rounded-2xl overflow-hidden border border-white/10">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-[#151725] border-b border-white/10">
              <th className="px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider w-1/2">파일명</th>
              <th className="px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">상태</th>
              <th className="px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">업로드 일시</th>
              <th className="px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider text-right">관리</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {filteredDocs.length > 0 ? (
              filteredDocs.map((doc) => (
                <tr key={doc.id} className="group hover:bg-white/5 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-9 w-9 bg-blue-900/30 rounded-lg flex items-center justify-center text-blue-300 border border-blue-500/20">
                        <FileText size={18} className="opacity-90" />
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedDocumentId(doc.id);
                          setIsPreviewOpen(true);
                        }}
                        className="ml-4 text-sm font-medium text-white hover:text-purple-200 text-left truncate"
                      >
                        {doc.fileName}
                      </button>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge status={doc.status} />
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-400 font-light">{new Date(doc.createdAt).toLocaleString()}</td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2 text-gray-400">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedDocumentId(doc.id);
                          setIsPreviewOpen(true);
                        }}
                        className="hover:text-purple-200 p-2 rounded-lg hover:bg-white/5 transition-colors"
                        title="상세 보기"
                      >
                        <Eye size={18} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(doc.id)}
                        className="hover:text-red-400 p-2 rounded-lg hover:bg-white/5 transition-colors"
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
                <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                  <div className="flex flex-col items-center justify-center">
                    <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center mb-3 border border-white/10">
                      <File size={24} className="text-gray-500" />
                    </div>
                    <p className="text-sm font-medium text-white">등록된 문서가 없습니다.</p>
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
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsPreviewOpen(false)} />
          <div className="relative w-full max-w-3xl mx-4 glass-card rounded-2xl border border-white/10 text-white max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-white/10 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-white">문서 상세 보기</h3>
                <p className="text-xs text-gray-400 mt-1">추출된 내용과 청크 예시를 확인합니다.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsPreviewOpen(false)}
                className="px-3 py-1.5 text-sm font-medium text-gray-200 bg-white/5 rounded-lg hover:bg-white/10 border border-white/10"
              >
                닫기
              </button>
            </div>
            <div className="p-6 space-y-6">
              {isPreviewLoading && <p className="text-sm text-gray-400">미리보기를 불러오는 중...</p>}
              {isPreviewError && <p className="text-sm text-red-400">{resolvePreviewError(previewLoadError)}</p>}
              {!isPreviewLoading && !isPreviewError && documentPreview && (
                <>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="p-4 rounded-xl bg-black/20 border border-white/10">
                      <p className="text-xs text-gray-500">파일명</p>
                      <p className="text-white font-medium mt-1">{documentPreview.document.fileName}</p>
                    </div>
                    <div className="p-4 rounded-xl bg-black/20 border border-white/10">
                      <p className="text-xs text-gray-500">상태</p>
                      <p className="text-white mt-1">{documentPreview.document.status}</p>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-semibold text-white mb-2">추출된 내용 미리보기</h4>
                    <pre className="whitespace-pre-wrap text-xs text-gray-200 bg-black/30 border border-white/10 rounded-xl p-4 max-h-64 overflow-y-auto">
                      {documentPreview.extractedPreview || '추출된 텍스트가 없습니다.'}
                    </pre>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-semibold text-white">청크 예시</h4>
                      <span className="text-xs text-gray-400">총 {documentPreview.totalChunks}개</span>
                    </div>
                    <div className="space-y-3">
                      {documentPreview.chunkSamples.length ? (
                        documentPreview.chunkSamples.map((chunk, index) => (
                          <div key={`${chunk.chunkIndex ?? index}`} className="p-4 rounded-xl border border-white/10 bg-black/20">
                            <div className="text-xs text-gray-400 mb-2">
                              청크 {chunk.chunkIndex ?? index + 1}/{chunk.chunkTotal ?? documentPreview.totalChunks}
                            </div>
                            <p className="text-sm text-gray-200 whitespace-pre-wrap leading-relaxed">{chunk.content}</p>
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
  const base = 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border';

  if (status === 'UPLOADED') {
    return (
      <span className={`${base} bg-blue-500/10 text-blue-300 border-blue-500/20`}>
        <CheckCircle2 size={12} />
        업로드 완료
      </span>
    );
  }
  if (status === 'PARSING' || status === 'CHUNKING' || status === 'EMBEDDING' || status === 'INDEXING') {
    return (
      <span className={`${base} bg-amber-500/10 text-amber-300 border-amber-500/20`}>
        <Loader2 size={12} className="animate-spin" />
        처리 중
      </span>
    );
  }
  if (status === 'DONE' || status === 'ACTIVE') {
    return (
      <span className={`${base} bg-green-500/10 text-green-300 border-green-500/20`}>
        <CheckCircle2 size={12} />
        완료
      </span>
    );
  }
  if (status === 'FAILED') {
    return (
      <span className={`${base} bg-red-500/10 text-red-300 border-red-500/20`}>
        <AlertCircle size={12} />
        실패
      </span>
    );
  }
  if (status === 'DELETING') {
    return (
      <span className={`${base} bg-gray-500/10 text-gray-200 border-gray-500/20`}>
        <Loader2 size={12} className="animate-spin" />
        삭제 중
      </span>
    );
  }
  if (status === 'DELETED') {
    return <span className={`${base} bg-gray-500/10 text-gray-300 border-gray-500/20`}>삭제됨</span>;
  }
  return <span className={`${base} bg-gray-500/10 text-gray-200 border-gray-500/20`}>{status}</span>;
}

