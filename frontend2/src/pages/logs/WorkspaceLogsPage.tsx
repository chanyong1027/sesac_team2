import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { RefreshCw, Search, Copy, ExternalLink } from 'lucide-react';
import { promptApi } from '@/api/prompt.api';
import { logsApi } from '@/api/logs.api';
import type { RequestLogResponse, RequestLogStatus } from '@/types/api.types';

const PAGE_SIZE = 20;

type LogStatusFilter = 'ALL' | 'SUCCESS' | 'FAILOVER' | 'FAIL' | 'BLOCKED';
type LogsListParams = NonNullable<Parameters<typeof logsApi.list>[1]>;

const STATUS_OPTIONS: Array<{ value: LogStatusFilter; label: string }> = [
  { value: 'ALL', label: 'all' },
  { value: 'SUCCESS', label: 'success' },
  { value: 'FAILOVER', label: 'failover' },
  { value: 'FAIL', label: 'fail' },
  { value: 'BLOCKED', label: 'blocked' },
];

function formatShortDateTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('ko-KR', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function statusBadge(status: RequestLogStatus) {
  const base =
    'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium border';
  switch (status) {
    case 'SUCCESS':
      return `${base} bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-400/35`;
    case 'FAIL':
      return `${base} bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-400/35`;
    case 'BLOCKED':
      return `${base} bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-400/35`;
    case 'IN_PROGRESS':
    default:
      return `${base} bg-[var(--surface-subtle)] text-[var(--text-secondary)] border-[var(--border)]`;
  }
}

function modelLabel(log: RequestLogResponse) {
  return log.usedModel || log.requestedModel || '-';
}

export function WorkspaceLogsPage() {
  const { orgId, workspaceId: workspaceIdParam } = useParams<{
    orgId: string;
    workspaceId: string;
  }>();
  const [searchParams] = useSearchParams();

  const workspaceId = Number(workspaceIdParam);
  const basePath = orgId
    ? `/orgs/${orgId}/workspaces/${workspaceId}`
    : `/workspaces/${workspaceId}`;

  const isValidWorkspaceId = Number.isInteger(workspaceId) && workspaceId > 0;

  const { data: prompts } = useQuery({
    queryKey: ['prompts', workspaceId],
    queryFn: async () => {
      const response = await promptApi.getPrompts(workspaceId);
      return response.data;
    },
    enabled: isValidWorkspaceId,
  });

  const defaultPromptKey = prompts?.[0]?.promptKey || '';

  const [promptKey, setPromptKey] = useState(searchParams.get('promptKey') || '');
  const [status, setStatus] = useState<LogStatusFilter>('ALL');
  const [ragEnabled, setRagEnabled] = useState<'ALL' | 'true' | 'false'>('ALL');
  const [provider, setProvider] = useState('');
  const [traceId, setTraceId] = useState('');
  const [page, setPage] = useState(0);

  // Prompt key: URL → state → defaultPromptKey 순서로 초기화
  useEffect(() => {
    if (!promptKey && defaultPromptKey) {
      setPromptKey(defaultPromptKey);
    }
  }, [defaultPromptKey, promptKey]);

  const resolvedParams = useMemo(() => {
    const params: LogsListParams = {
      page,
      size: PAGE_SIZE,
    };
    if (promptKey.trim()) params.promptKey = promptKey.trim();
    if (status === 'SUCCESS') {
      params.status = 'SUCCESS';
      params.failover = false;
    } else if (status === 'FAILOVER') {
      params.status = 'SUCCESS';
      params.failover = true;
    } else if (status !== 'ALL') {
      params.status = status;
    }
    if (ragEnabled !== 'ALL') params.ragEnabled = ragEnabled === 'true';
    if (provider.trim()) params.provider = provider.trim();
    if (traceId.trim()) params.traceId = traceId.trim();
    return params;
  }, [page, promptKey, status, ragEnabled, provider, traceId]);

  useEffect(() => {
    setPage(0);
  }, [promptKey, status, ragEnabled, provider, traceId]);

  const {
    data: list,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['workspace-logs', workspaceId, resolvedParams],
    queryFn: async () => logsApi.list(workspaceId, resolvedParams),
    enabled: isValidWorkspaceId,
    retry: false,
  });

  const logs = list?.content ?? [];
  const totalElements = list?.totalElements ?? 0;
  const totalPages = list?.totalPages ?? 0;
  const currentPage = list?.page ?? page;
  const pageSize = list?.size ?? PAGE_SIZE;
  const firstItemIndex = totalElements === 0 ? 0 : currentPage * pageSize + 1;
  const lastItemIndex = totalElements === 0 ? 0 : currentPage * pageSize + logs.length;

  useEffect(() => {
    if (!list) return;
    const maxPage = Math.max(list.totalPages - 1, 0);
    if (page > maxPage) {
      setPage(maxPage);
    }
  }, [list, page]);

  if (!isValidWorkspaceId) {
    return <div className="p-8 text-[var(--text-secondary)]">유효하지 않은 워크스페이스입니다.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--foreground)]">Logs</h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            최근 요청을 확인하고 trace 단위로 디버깅하세요.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => refetch()}
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--surface-subtle)]"
          >
            <RefreshCw size={16} />
            새로고침
          </button>
          <Link
            to={`${basePath}`}
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--surface-subtle)]"
          >
            <ExternalLink size={16} />
            대시보드
          </Link>
        </div>
      </div>

      <div className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] p-4 shadow-sm backdrop-blur-sm">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <div className="md:col-span-2">
            <label className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">
              promptKey (기본: 메인 프롬프트)
            </label>
            <input
              value={promptKey}
              onChange={(e) => setPromptKey(e.target.value)}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background-card)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
              placeholder="예) sesac-assistant"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as LogStatusFilter)}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background-card)] px-3 py-2 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">RAG</label>
            <select
              value={ragEnabled}
              onChange={(e) => setRagEnabled(e.target.value as 'ALL' | 'true' | 'false')}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background-card)] px-3 py-2 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
            >
              <option value="ALL">전체</option>
              <option value="true">RAG on</option>
              <option value="false">RAG off</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">provider</label>
            <input
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background-card)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
              placeholder="예) openai"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <div className="md:col-span-2">
            <label className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">traceId</label>
            <input
              value={traceId}
              onChange={(e) => setTraceId(e.target.value)}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background-card)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
              placeholder="부분 검색 가능"
            />
          </div>
          <div className="md:col-span-3 flex items-end">
            <div className="w-full flex items-center justify-between gap-2">
              <div className="text-xs text-[var(--text-secondary)]">
                팁: 대시보드 “최근 요청”에서 넘어오면 promptKey가 자동으로 채워집니다.
              </div>
              <div className="inline-flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                <Search size={14} />
                필터 변경 시 자동 갱신
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] shadow-sm backdrop-blur-sm">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
          <div className="text-sm font-medium text-[var(--foreground)]">최근 로그</div>
          <div className="text-xs text-[var(--text-secondary)]">
            {list ? `총 ${totalElements}개 중 ${firstItemIndex}-${lastItemIndex}개` : ''}
          </div>
        </div>

        {isLoading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 8 }).map((_, idx) => (
              <div key={idx} className="h-14 animate-pulse rounded-lg bg-[var(--surface-subtle)]" />
            ))}
          </div>
        ) : isError ? (
          <div className="p-6">
            <div className="text-sm font-medium text-[var(--foreground)]">로그를 불러오지 못했습니다.</div>
            <button
              type="button"
              onClick={() => refetch()}
              className="mt-3 inline-flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--surface-subtle)]"
            >
              <RefreshCw size={16} />
              재시도
            </button>
          </div>
        ) : logs.length === 0 ? (
          <div className="p-6 text-sm text-[var(--text-secondary)]">
            최근 요청이 없습니다. API 호출 후 확인하세요.
          </div>
        ) : (
          <>
            <ul className="divide-y divide-[var(--border)]">
              {logs.map((log) => (
                <li key={log.traceId} className="px-4 py-4 transition-colors hover:bg-[var(--surface-subtle)]">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={statusBadge(log.status)}>{log.status}</span>
                        {log.isFailover ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/35 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-300">
                            FAILOVER
                          </span>
                        ) : null}
                        <span className="text-xs text-[var(--text-secondary)]">
                          {formatShortDateTime(log.createdAt)}
                        </span>
                        <span className="text-xs text-[var(--text-secondary)]">
                          {log.provider || '-'} · {modelLabel(log)}
                        </span>
                        <span className="text-xs text-[var(--text-secondary)]">
                          HTTP {log.httpStatus ?? '-'}
                        </span>
                      </div>

                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--text-secondary)]">
                        <span className="font-mono truncate max-w-[420px]">{log.traceId}</span>
                        <button
                          type="button"
                          onClick={() => navigator.clipboard.writeText(log.traceId)}
                          className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] bg-[var(--surface-elevated)] px-2 py-1 text-[var(--foreground)] transition-colors hover:bg-[var(--surface-subtle)]"
                        >
                          <Copy size={14} />
                          복사
                        </button>
                        <span>latency {log.latencyMs ?? '-'}ms</span>
                        <span>tokens {log.totalTokens ?? '-'}</span>
                        <span className="inline-flex items-center gap-1">
                          <span
                            className={
                              log.ragEnabled
                                ? 'rounded-full border border-indigo-400/35 bg-indigo-500/10 px-2 py-0.5 text-[11px] font-medium text-indigo-700 dark:text-indigo-300'
                                : 'rounded-full border border-[var(--border)] bg-[var(--surface-subtle)] px-2 py-0.5 text-[11px] font-medium text-[var(--text-secondary)]'
                            }
                          >
                            RAG {log.ragEnabled ? 'on' : 'off'}
                          </span>
                          {log.ragEnabled ? (
                            <span className="text-xs text-[var(--text-secondary)]">
                              (chunks {log.ragChunksCount ?? '-'} · rag {log.ragLatencyMs ?? '-'}ms)
                            </span>
                          ) : null}
                        </span>
                        {log.isFailover && log.failReason ? (
                          <span className="inline-flex items-center gap-1 rounded-md border border-amber-400/30 bg-amber-500/10 px-2 py-0.5 font-mono text-[11px] text-amber-700 dark:text-amber-300">
                            failover {log.failReason}
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <div className="shrink-0">
                      <Link
                        to={`${basePath}/logs/${log.traceId}`}
                        className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--surface-subtle)]"
                      >
                        상세
                        <ExternalLink size={16} />
                      </Link>
                    </div>
                  </div>

                  {log.status === 'FAIL' || log.errorCode || log.errorMessage ? (
                    <div className="mt-3 rounded-lg border border-rose-400/35 bg-rose-500/10 px-3 py-2 text-xs text-rose-700 dark:text-rose-200">
                      <span className="font-medium">Error</span>
                      <span className="ml-2">
                        {log.errorCode || '-'} {log.errorMessage ? `· ${log.errorMessage}` : ''}
                        {log.failReason ? ` · failReason=${log.failReason}` : ''}
                      </span>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>

            <div className="flex flex-col gap-3 border-t border-[var(--border)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-xs text-[var(--text-secondary)]">
                {`총 ${totalElements}개 중 ${firstItemIndex}-${lastItemIndex}개`}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage(0)}
                  disabled={currentPage === 0}
                  className="inline-flex items-center rounded-md border border-[var(--border)] bg-[var(--surface-elevated)] px-2.5 py-1.5 text-xs font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--surface-subtle)] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  처음
                </button>
                <button
                  type="button"
                  onClick={() => setPage((prev) => Math.max(prev - 1, 0))}
                  disabled={currentPage === 0}
                  className="inline-flex items-center rounded-md border border-[var(--border)] bg-[var(--surface-elevated)] px-2.5 py-1.5 text-xs font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--surface-subtle)] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  이전
                </button>
                <span className="px-2 text-xs text-[var(--text-secondary)]">
                  {`${currentPage + 1} / ${Math.max(totalPages, 1)} 페이지`}
                </span>
                <button
                  type="button"
                  onClick={() => setPage((prev) => Math.min(prev + 1, Math.max(totalPages - 1, 0)))}
                  disabled={currentPage >= Math.max(totalPages - 1, 0)}
                  className="inline-flex items-center rounded-md border border-[var(--border)] bg-[var(--surface-elevated)] px-2.5 py-1.5 text-xs font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--surface-subtle)] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  다음
                </button>
                <button
                  type="button"
                  onClick={() => setPage(Math.max(totalPages - 1, 0))}
                  disabled={currentPage >= Math.max(totalPages - 1, 0)}
                  className="inline-flex items-center rounded-md border border-[var(--border)] bg-[var(--surface-elevated)] px-2.5 py-1.5 text-xs font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--surface-subtle)] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  마지막
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
