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

function statusPill(status: RequestLogStatus) {
  const base =
    'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium border';
  switch (status) {
    case 'SUCCESS':
      return `${base} bg-emerald-50 text-emerald-800 border-emerald-200`;
    case 'FAIL':
      return `${base} bg-rose-50 text-rose-800 border-rose-200`;
    case 'BLOCKED':
      return `${base} bg-amber-50 text-amber-900 border-amber-200`;
    case 'IN_PROGRESS':
    default:
      return `${base} bg-gray-50 text-gray-700 border-gray-200`;
  }
}

export function WorkspaceLogDetailPage() {
  const { orgId, workspaceId: workspaceIdParam, traceId } = useParams<{
    orgId: string;
    workspaceId: string;
    traceId: string;
  }>();

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

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <Link
              to={`${basePath}/logs`}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
            >
              <ArrowLeft size={16} />
              목록
            </Link>
            {log ? <span className={statusPill(log.status)}>{log.status}</span> : null}
          </div>
          <h1 className="text-xl font-semibold text-gray-900">Trace Detail</h1>
          <div className="text-sm text-gray-600 font-mono break-all">{traceId}</div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigator.clipboard.writeText(traceId!)}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
          >
            <Copy size={16} />
            복사
          </button>
          <button
            type="button"
            onClick={() => refetch()}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
          >
            <RefreshCw size={16} />
            새로고침
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <div className="h-28 rounded-xl bg-gray-100 animate-pulse" />
          <div className="h-28 rounded-xl bg-gray-100 animate-pulse" />
        </div>
      ) : isError || !log ? (
        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
          <div className="text-sm font-medium text-gray-900">로그를 불러오지 못했습니다.</div>
          <div className="text-sm text-gray-500 mt-1">잠시 후 다시 시도해주세요.</div>
          <button
            type="button"
            onClick={() => refetch()}
            className="mt-4 inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
          >
            <RefreshCw size={16} />
            재시도
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
              <div className="text-xs text-gray-500">HTTP / Latency</div>
              <div className="mt-2 text-sm text-gray-900">
                HTTP <span className="font-medium">{log.httpStatus ?? '-'}</span>
              </div>
              <div className="text-sm text-gray-900">
                latency <span className="font-medium">{log.latencyMs ?? '-'}</span>ms
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
              <div className="text-xs text-gray-500">Provider / Model</div>
              <div className="mt-2 text-sm text-gray-900">
                {log.provider || '-'}
                {log.isFailover ? (
                  <span className="ml-2 text-[11px] px-2 py-0.5 rounded-full border bg-amber-50 border-amber-200 text-amber-900">
                    failover
                  </span>
                ) : null}
              </div>
              <div className="text-sm text-gray-900 break-all">
                <span className="text-gray-500">used</span> {log.usedModel || '-'}
              </div>
              <div className="text-sm text-gray-900 break-all">
                <span className="text-gray-500">requested</span> {log.requestedModel || '-'}
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
              <div className="text-xs text-gray-500">Tokens</div>
              <div className="mt-2 text-sm text-gray-900">
                total <span className="font-medium">{log.totalTokens ?? '-'}</span>
              </div>
              <div className="text-sm text-gray-900">
                in/out{' '}
                <span className="font-medium">
                  {log.inputTokens ?? '-'} / {log.outputTokens ?? '-'}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm md:col-span-2">
              <div className="text-xs text-gray-500">Request</div>
              <div className="mt-2 text-sm text-gray-900">
                promptKey <span className="font-medium">{log.promptKey || '-'}</span>
              </div>
              <div className="text-sm text-gray-900">
                createdAt <span className="font-medium">{formatFullDateTime(log.createdAt)}</span>
              </div>
              <div className="text-sm text-gray-900">
                finishedAt{' '}
                <span className="font-medium">
                  {log.finishedAt ? formatFullDateTime(log.finishedAt) : '-'}
                </span>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
              <div className="text-xs text-gray-500">RAG</div>
              <div className="mt-2 text-sm text-gray-900">
                enabled{' '}
                <span className="font-medium">{log.ragEnabled ? 'true' : 'false'}</span>
              </div>
              <div className="text-sm text-gray-900">
                ragLatency <span className="font-medium">{log.ragLatencyMs ?? '-'}</span>ms
              </div>
              <div className="text-sm text-gray-900">
                ragChunks <span className="font-medium">{log.ragChunksCount ?? '-'}</span>
              </div>
            </div>
          </div>

          {log.status === 'FAIL' || log.errorCode || log.errorMessage || log.failReason ? (
            <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
              <div className="text-xs text-gray-500">Error</div>
              <div className="mt-2 text-sm text-gray-900">
                errorCode <span className="font-medium">{log.errorCode || '-'}</span>
              </div>
              <div className="text-sm text-gray-900 break-words">
                errorMessage <span className="font-medium">{log.errorMessage || '-'}</span>
              </div>
              <div className="text-sm text-gray-900">
                failReason <span className="font-medium">{log.failReason || '-'}</span>
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

