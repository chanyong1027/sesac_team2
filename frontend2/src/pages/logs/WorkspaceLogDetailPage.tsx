import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Copy, RefreshCw, ArrowLeft } from 'lucide-react';
import { logsApi } from '@/api/logs.api';
import type { RequestLogStatus } from '@/types/api.types';

function formatFullDateTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function statusBadge(status: RequestLogStatus) {
  const base = 'inline-flex items-center rounded-full px-3 py-1 text-xs font-bold tracking-wide border';
  switch (status) {
    case 'SUCCESS':
      return `${base} bg-emerald-500/10 text-emerald-300 border-emerald-500/20 shadow-[0_0_12px_rgba(74,222,128,0.25)]`;
    case 'FAIL':
      return `${base} bg-rose-500/10 text-rose-300 border-rose-500/20 shadow-[0_0_12px_rgba(244,63,94,0.20)]`;
    case 'BLOCKED':
      return `${base} bg-amber-500/10 text-amber-200 border-amber-500/20 shadow-[0_0_12px_rgba(251,191,36,0.12)]`;
    case 'IN_PROGRESS':
    default:
      return `${base} bg-white/5 text-gray-300 border-white/10`;
  }
}

function httpReasonPhrase(status: number) {
  if (status >= 200 && status < 300) return 'OK';
  if (status === 400) return 'BAD_REQUEST';
  if (status === 401) return 'UNAUTHORIZED';
  if (status === 403) return 'FORBIDDEN';
  if (status === 404) return 'NOT_FOUND';
  if (status === 408) return 'TIMEOUT';
  if (status === 429) return 'RATE_LIMIT';
  if (status >= 500 && status < 600) return 'SERVER_ERROR';
  return '';
}

export function WorkspaceLogDetailPage() {
  const { orgId, workspaceId: workspaceIdParam, traceId } = useParams<{
    orgId: string;
    workspaceId: string;
    traceId: string;
  }>();

  const [isRawExpanded, setIsRawExpanded] = useState(false);

  const workspaceId = Number(workspaceIdParam);
  const basePath = orgId
    ? `/orgs/${orgId}/workspaces/${workspaceId}`
    : `/workspaces/${workspaceId}`;

  const isValid =
    Number.isInteger(workspaceId) && workspaceId > 0 && !!traceId?.trim();

  const {
    data: log,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['workspace-log', workspaceId, traceId],
    queryFn: async () => logsApi.get(workspaceId, traceId!),
    enabled: isValid,
    retry: false,
  });

  if (!isValid) {
    return <div className="p-8 text-gray-500">유효하지 않은 요청입니다.</div>;
  }

  const rawJson = log ? JSON.stringify(log, null, 2) : '';
  const rawJsonMaxHeight = isRawExpanded ? 'max-h-[70vh]' : 'max-h-64';

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link
            to={`${basePath}/logs`}
            className="flex items-center justify-center w-9 h-9 rounded-lg bg-white/[0.03] border border-white/10 text-gray-300 hover:text-white hover:border-[var(--primary)]/40 hover:shadow-[0_0_10px_rgba(168,85,247,0.15)] transition-all"
            title="목록으로"
            aria-label="back to logs"
          >
            <ArrowLeft size={18} />
          </Link>
          {log ? <span className={statusBadge(log.status)}>{log.status}</span> : <span className={statusBadge('IN_PROGRESS')}>IN_PROGRESS</span>}
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigator.clipboard.writeText(traceId!)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/[0.03] border border-white/10 text-xs font-medium text-gray-300 hover:text-white hover:border-white/20 transition-colors"
          >
            <Copy size={16} />
            복사
          </button>
          <button
            type="button"
            onClick={() => refetch()}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/[0.03] border border-white/10 text-xs font-medium text-gray-300 hover:text-white hover:border-[var(--primary)]/40 hover:text-[var(--primary)] transition-all group"
          >
            <RefreshCw size={16} className="group-hover:rotate-180 transition-transform duration-500" />
            새로고침
          </button>
        </div>
      </div>

      <div className="space-y-1">
        <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-300 to-indigo-300">
          Trace Detail
        </h1>
        <p className="text-sm font-mono text-gray-500 tracking-wide break-all">{traceId}</p>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <div className="h-28 rounded-xl bg-white/5 animate-pulse" />
          <div className="h-28 rounded-xl bg-white/5 animate-pulse" />
        </div>
      ) : isError || !log ? (
        <div className="glass-card border border-white/10 rounded-xl p-6 shadow-sm">
          <div className="text-sm font-medium text-white">로그를 불러오지 못했습니다.</div>
          <div className="text-sm text-gray-400 mt-1">잠시 후 다시 시도해주세요.</div>
          <button
            type="button"
            onClick={() => refetch()}
            className="mt-4 inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border border-white/10 bg-white/[0.03] text-gray-200 hover:bg-white/5"
          >
            <RefreshCw size={16} />
            재시도
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="glass-card p-6 rounded-xl hover:border-[var(--primary)]/30 transition-all group relative overflow-hidden">
              <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
                <span className="material-symbols-outlined text-6xl text-[var(--primary)]">speed</span>
              </div>
              <div className="flex flex-col h-full justify-between relative z-10">
                <div className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-4">성능 (Performance)</div>
                <div className="space-y-4">
                  <div className="flex justify-between items-end pb-2 border-b border-white/10">
                    <span className="text-sm text-gray-400">응답 상태</span>
                    <span className="text-lg font-bold text-emerald-300 font-mono">
                      {log.httpStatus ? `${log.httpStatus} ${httpReasonPhrase(log.httpStatus)}`.trim() : '-'}
                    </span>
                  </div>
                  <div className="flex justify-between items-end">
                    <span className="text-sm text-gray-400">총 지연 시간</span>
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-bold text-white font-mono">
                        {log.latencyMs == null ? '-' : log.latencyMs.toLocaleString('ko-KR')}
                      </span>
                      <span className="text-xs text-gray-500 font-mono">ms</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="glass-card p-6 rounded-xl hover:border-[var(--primary)]/30 transition-all group relative overflow-hidden">
              <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
                <span className="material-symbols-outlined text-6xl text-blue-400">smart_toy</span>
              </div>
              <div className="flex flex-col h-full justify-between relative z-10">
                <div className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-4">모델 정보 (Model Info)</div>
                <div className="space-y-4">
                  <div className="flex justify-between items-end pb-2 border-b border-white/10">
                    <span className="text-sm text-gray-400">사용된 프로바이더</span>
                    <span className="text-lg font-bold text-white">{log.provider || '-'}</span>
                  </div>
                  <div className="flex justify-between items-end">
                    <span className="text-sm text-gray-400">모델명</span>
                    <span className="text-base font-bold text-purple-300 font-mono break-all">
                      {log.usedModel || log.requestedModel || '-'}
                    </span>
                  </div>
                  {log.isFailover ? (
                    <div className="pt-1">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full border bg-amber-500/10 border-amber-500/20 text-amber-200 text-[10px] font-bold">
                        failover
                      </span>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="glass-card p-6 rounded-xl hover:border-[var(--primary)]/30 transition-all group relative overflow-hidden">
              <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
                <span className="material-symbols-outlined text-6xl text-emerald-400">data_usage</span>
              </div>
              <div className="flex flex-col h-full justify-between relative z-10">
                <div className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-4">토큰 (Tokens)</div>
                <div className="space-y-4">
                  <div className="flex justify-between items-end pb-2 border-b border-white/10">
                    <span className="text-sm text-gray-400">총 토큰</span>
                    <span className="text-lg font-bold text-white font-mono">
                      {log.totalTokens == null ? '-' : log.totalTokens.toLocaleString('ko-KR')}
                    </span>
                  </div>
                  <div className="flex justify-between items-end">
                    <span className="text-sm text-gray-400">입력 / 출력</span>
                    <div className="flex items-center gap-1 font-mono">
                      <span className="text-base font-bold text-blue-300">
                        {log.inputTokens == null ? '-' : log.inputTokens.toLocaleString('ko-KR')}
                      </span>
                      <span className="text-gray-600">/</span>
                      <span className="text-base font-bold text-emerald-300">
                        {log.outputTokens == null ? '-' : log.outputTokens.toLocaleString('ko-KR')}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="glass-card p-6 rounded-xl border border-white/10 hover:border-white/20 transition-colors">
              <div className="flex items-center gap-2 mb-6">
                <span className="w-1 h-4 bg-[var(--primary)] rounded-full" />
                <h3 className="text-lg font-bold text-white">요청 정보</h3>
              </div>
              <div className="space-y-4">
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-gray-500 uppercase tracking-wide">프롬프트 키</span>
                  <div className="font-mono text-sm text-white bg-black/20 px-3 py-2 rounded border border-white/10">
                    {log.promptKey || '-'}
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-gray-500 uppercase tracking-wide">요청 시작 시간</span>
                    <div className="font-mono text-sm text-gray-300 border-b border-white/10 pb-1">
                      {formatFullDateTime(log.createdAt)}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-gray-500 uppercase tracking-wide">요청 종료 시간</span>
                    <div className="font-mono text-sm text-gray-300 border-b border-white/10 pb-1">
                      {log.finishedAt ? formatFullDateTime(log.finishedAt) : '-'}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="glass-card p-6 rounded-xl border border-white/10 hover:border-white/20 transition-colors">
              <div className="flex items-center gap-2 mb-6">
                <span className="w-1 h-4 bg-emerald-500 rounded-full" />
                <h3 className="text-lg font-bold text-white">RAG 정보</h3>
              </div>
              <div className="space-y-5">
                <div className="flex justify-between items-center py-2 border-b border-white/10">
                  <span className="text-sm text-gray-400">RAG 사용 여부</span>
                  <span className={`px-2 py-0.5 rounded text-xs font-bold border ${log.ragEnabled ? 'bg-purple-500/10 text-purple-200 border-purple-500/20' : 'bg-white/5 text-gray-400 border-white/10'}`}>
                    {log.ragEnabled ? '활성화' : '비활성화'}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-white/10">
                  <span className="text-sm text-gray-400">RAG 지연 시간</span>
                  <span className="font-mono text-sm text-white">
                    {log.ragLatencyMs == null ? '-' : `${log.ragLatencyMs}ms`}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-sm text-gray-400">검색된 청크 수</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-lg font-bold text-white">
                      {log.ragChunksCount == null ? '-' : log.ragChunksCount.toLocaleString('ko-KR')}
                    </span>
                    <span className="text-xs text-gray-500">chunks</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {log.status === 'FAIL' || log.errorCode || log.errorMessage || log.failReason ? (
            <div className="glass-card border border-rose-500/20 rounded-xl p-5 shadow-sm">
              <div className="text-xs text-gray-400 uppercase tracking-wider">Error</div>
              <div className="mt-3 text-sm text-gray-200">
                errorCode <span className="font-medium">{log.errorCode || '-'}</span>
              </div>
              <div className="text-sm text-gray-200 break-words mt-1">
                errorMessage <span className="font-medium">{log.errorMessage || '-'}</span>
              </div>
              <div className="text-sm text-gray-200 mt-1">
                failReason <span className="font-medium">{log.failReason || '-'}</span>
              </div>
            </div>
          ) : null}

          <div className="glass-card p-0 rounded-xl overflow-hidden border border-white/10">
            <div className="bg-white/[0.03] px-6 py-3 border-b border-white/10 flex justify-between items-center">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Raw JSON Data</span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setIsRawExpanded((v) => !v)}
                  className="text-xs text-[var(--primary)] hover:text-white transition-colors"
                  title="toggle raw json view"
                >
                  {isRawExpanded ? 'Collapse' : 'Expand View'}
                </button>
                <button
                  type="button"
                  onClick={() => navigator.clipboard.writeText(rawJson)}
                  className="text-xs text-[var(--primary)] hover:text-white transition-colors inline-flex items-center gap-2"
                  title="copy raw json"
                >
                  <Copy size={14} />
                  복사
                </button>
              </div>
            </div>
            <pre className={`p-6 bg-black/30 font-mono text-xs text-gray-300 overflow-x-auto whitespace-pre overflow-y-auto ${rawJsonMaxHeight}`}>
              {rawJson}
            </pre>
          </div>
        </>
      )}
    </div>
  );
}
