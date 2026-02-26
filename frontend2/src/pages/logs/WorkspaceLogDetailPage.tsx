import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {

  Copy,
  RefreshCw,
  ArrowLeft,
  Hash,
  MessageSquare,
  Zap,
  Clock,
  AlertTriangle
} from 'lucide-react';
import { logsApi } from '@/api/logs.api';
import type { RequestLogResponse, RequestLogStatus } from '@/types/api.types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function extractMessageContent(content: unknown): string | null {
  const direct = readString(content);
  if (direct) return direct;

  if (Array.isArray(content)) {
    const merged = content
      .map((part) => {
        if (typeof part === 'string') return part.trim();
        if (!isRecord(part)) return '';
        return readString(part.text) ?? '';
      })
      .filter((part) => part.length > 0)
      .join(' ')
      .trim();
    return merged.length > 0 ? merged : null;
  }

  if (isRecord(content)) {
    return readString(content.text);
  }

  return null;
}

function appendUnique(target: string[], value: string | null) {
  if (!value) return;
  if (!target.includes(value)) {
    target.push(value);
  }
}

function extractUserQuestions(requestPayload: string | null): string[] {
  if (!requestPayload) return [];

  const payload = requestPayload.trim();
  if (payload.length === 0) return [];

  const questions: string[] = [];
  let parsed: unknown = null;

  try {
    parsed = JSON.parse(payload);
  } catch {
    parsed = null;
  }

  if (isRecord(parsed)) {
    const messages = parsed.messages;
    if (Array.isArray(messages)) {
      for (const message of messages) {
        if (!isRecord(message)) continue;
        const role = readString(message.role)?.toLowerCase();
        if (role && role !== 'user') continue;
        appendUnique(questions, extractMessageContent(message.content));
      }
    }

    const directFields = ['userInput', 'userPrompt', 'prompt', 'question', 'query', 'input'] as const;
    for (const key of directFields) {
      appendUnique(questions, readString(parsed[key]));
    }

    const variables = parsed.variables;
    if (isRecord(variables)) {
      const variableFields = ['question', 'query', 'input', 'message', 'prompt', 'userInput', 'userQuery'] as const;
      for (const key of variableFields) {
        appendUnique(questions, readString(variables[key]));
      }
    }
  }

  if (questions.length === 0 && !payload.startsWith('{') && !payload.startsWith('[')) {
    appendUnique(questions, payload);
  }

  return questions.slice(0, 3);
}

function formatFullDateTime(iso: string) {
  const d = parseApiDate(iso);
  if (!d) return iso;
  return d.toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    weekday: 'short',
  });
}

function formatKstDateTimeOrFallback(iso: string | null | undefined, fallback = '-') {
  if (!iso) return fallback;
  const d = parseApiDate(iso);
  if (!d) return fallback;
  return d.toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    weekday: 'short',
  });
}

function parseKstLocalDateTime(value: string): Date | null {
  const match = value.match(
    /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?$/
  );
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  const fraction = match[7] ?? '';
  const millisecond = fraction.length > 0
    ? Number(fraction.padEnd(3, '0').slice(0, 3))
    : 0;

  if ([year, month, day, hour, minute, second, millisecond].some(Number.isNaN)) {
    return null;
  }

  // 서버가 타임존 없이 내려주는 LocalDateTime은 KST 시각으로 간주한다.
  // KST(+09:00) 기준 wall-clock을 절대 시각(UTC)으로 변환한다.
  return new Date(Date.UTC(year, month - 1, day, hour - 9, minute, second, millisecond));
}

function parseApiDate(iso: string | null | undefined): Date | null {
  if (!iso) return null;

  if (/(?:Z|[+-]\d{2}:\d{2})$/.test(iso)) {
    const zoned = new Date(iso);
    return Number.isNaN(zoned.getTime()) ? null : zoned;
  }

  const kstLocal = parseKstLocalDateTime(iso);
  if (kstLocal) {
    return kstLocal;
  }

  const fallback = new Date(iso);
  const d = fallback;
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function resolveResponsePayloadTimestamp(createdAt: string, finishedAt: string | null, latencyMs: number | null): string {
  const createdDate = parseApiDate(createdAt);
  const finishedDate = parseApiDate(finishedAt);

  if (!createdDate) {
    return finishedAt ?? createdAt;
  }

  const createdMs = createdDate.getTime();
  const derivedFromLatencyMs = typeof latencyMs === 'number' && latencyMs >= 0
    ? createdMs + latencyMs
    : null;

  if (!finishedDate) {
    if (derivedFromLatencyMs != null) {
      return new Date(derivedFromLatencyMs).toISOString();
    }
    return createdAt;
  }

  const finishedMs = finishedDate.getTime();
  const suspiciousSkewByOrder = finishedMs < createdMs;
  const suspiciousSkewByGap = derivedFromLatencyMs != null
    ? Math.abs(finishedMs - derivedFromLatencyMs) > 60 * 60 * 1000
    : false;

  if ((suspiciousSkewByOrder || suspiciousSkewByGap) && derivedFromLatencyMs != null) {
    return new Date(derivedFromLatencyMs).toISOString();
  }

  return finishedAt ?? createdAt;
}

function formatSeconds(ms: number): string {
  return `${(ms / 1000).toFixed(3).replace(/\.?0+$/, '')}s`;
}

function statusBadge(status: RequestLogStatus) {
  const base = 'inline-flex items-center rounded-full px-3 py-1 text-xs font-bold tracking-wide border';
  switch (status) {
    case 'SUCCESS':
      return `${base} bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/25 shadow-[0_0_12px_rgba(74,222,128,0.20)]`;
    case 'FAIL':
      return `${base} bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/25 shadow-[0_0_12px_rgba(244,63,94,0.20)]`;
    case 'BLOCKED':
      return `${base} bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/25 shadow-[0_0_12px_rgba(251,191,36,0.12)]`;
    case 'TIMEOUT':
      return `${base} bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-500/25 shadow-[0_0_12px_rgba(249,115,22,0.12)]`;
    case 'IN_PROGRESS':
    default:
      return `${base} bg-[var(--surface-subtle)] text-[var(--text-secondary)] border-[var(--border)]`;
  }
}

type ErrorPayloadSummary = {
  errorCode: string | null;
  message: string | null;
  failReason: string | null;
  httpStatus: number | null;
};

type FailureInsight = {
  errorCode: string | null;
  errorMessage: string | null;
  failReason: string | null;
  httpStatus: number | null;
  reasonDescription: string;
};

const FAIL_REASON_DESCRIPTION: Record<string, string> = {
  PROVIDER_BUDGET_EXCEEDED: 'Provider 예산 한도에 도달해 호출이 차단되었습니다.',
  REQUEST_DEADLINE_EXCEEDED: '요청 전체 제한 시간을 초과했습니다.',
  MODEL_404: '요청한 모델명이 Provider에 존재하지 않습니다.',
  RESOURCE_EXHAUSTED: '업스트림 쿼터/요청 제한으로 처리되지 않았습니다.',
  SOCKET_TIMEOUT: '업스트림 소켓 응답이 시간 제한을 초과했습니다.',
  DEADLINE_EXCEEDED: '업스트림 처리 시간이 제한을 초과했습니다.',
  UPSTREAM_UNAVAILABLE: '업스트림 서비스가 일시적으로 사용 불가 상태였습니다.',
  ALL_PROVIDERS_FAILED: '주/보조 경로 모두 실패해 요청을 완료하지 못했습니다.',
};

const ERROR_CODE_DESCRIPTION: Record<string, string> = {
  'GW-REQ-QUOTA_EXCEEDED': '요청 자체가 정책(예산/쿼터)에 의해 차단되었습니다.',
  'GW-REQ-INVALID_REQUEST': '요청 입력/리소스 상태가 유효하지 않습니다.',
  'GW-REQ-FORBIDDEN': '현재 API Key로 대상 워크스페이스 접근이 허용되지 않습니다.',
  'GW-UP-MODEL_NOT_FOUND': 'Provider에 등록되지 않은 모델 호출로 실패했습니다.',
  'GW-UP-TIMEOUT': '업스트림 타임아웃으로 실패했습니다.',
  'GW-UP-UNAVAILABLE': '업스트림 서비스 장애 또는 연결 실패로 실패했습니다.',
  'GW-UP-RATE_LIMIT': '업스트림 요청 제한에 걸렸습니다.',
};

function parseErrorPayload(responsePayload: string | null): ErrorPayloadSummary | null {
  if (!responsePayload) return null;
  const raw = responsePayload.trim();
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    if (!isRecord(parsed)) return null;
    return {
      errorCode: readString(parsed.errorCode) ?? readString(parsed.code),
      message: readString(parsed.message),
      failReason: readString(parsed.failReason),
      httpStatus: readNumber(parsed.httpStatus),
    };
  } catch {
    return null;
  }
}

function resolveReasonDescription(
  status: RequestLogStatus,
  errorCode: string | null,
  failReason: string | null
): string {
  if (failReason && FAIL_REASON_DESCRIPTION[failReason]) {
    return FAIL_REASON_DESCRIPTION[failReason];
  }
  if (errorCode && ERROR_CODE_DESCRIPTION[errorCode]) {
    return ERROR_CODE_DESCRIPTION[errorCode];
  }
  if (status === 'BLOCKED') return '정책 조건에 의해 요청이 차단되었습니다.';
  if (status === 'FAIL') return '요청 처리 중 오류가 발생했습니다.';
  if (status === 'TIMEOUT') return '시간 제한으로 요청이 종료되었습니다.';
  return '상세 원인을 확인할 수 없습니다.';
}

function buildFailureInsight(log: RequestLogResponse | undefined): FailureInsight | null {
  if (!log) return null;
  if (!['FAIL', 'BLOCKED', 'TIMEOUT'].includes(log.status)) return null;

  const payloadSummary = parseErrorPayload(log.responsePayload);
  const errorCode = log.errorCode ?? payloadSummary?.errorCode ?? null;
  const errorMessage = log.errorMessage ?? payloadSummary?.message ?? null;
  const failReason = log.failReason ?? payloadSummary?.failReason ?? null;
  const httpStatus = log.httpStatus ?? payloadSummary?.httpStatus ?? null;

  return {
    errorCode,
    errorMessage,
    failReason,
    httpStatus,
    reasonDescription: resolveReasonDescription(log.status, errorCode, failReason),
  };
}

export function WorkspaceLogDetailPage() {
  const { orgId, workspaceId: workspaceIdParam, traceId } = useParams<{
    orgId: string;
    workspaceId: string;
    traceId: string;
  }>();

  const [activeTab, setActiveTab] = useState<'details' | 'raw'>('details');

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
    return <div className="p-8 text-[var(--text-secondary)]">유효하지 않은 요청입니다.</div>;
  }

  const rawJson = log ? JSON.stringify(log, null, 2) : '';
  const extractedUserQuestions = extractUserQuestions(log?.requestPayload ?? null);
  const responsePayloadTimestamp = log
    ? resolveResponsePayloadTimestamp(log.createdAt, log.finishedAt, log.latencyMs)
    : null;
  const totalLatencyMs = Math.max(0, log?.latencyMs ?? 0);
  const ragLatencyMs = Math.max(0, log?.ragLatencyMs ?? 0);
  const llmLatencyMs = Math.max(0, totalLatencyMs - ragLatencyMs);
  const ragPercent = totalLatencyMs > 0 ? Math.round((ragLatencyMs / totalLatencyMs) * 100) : 0;
  const llmPercent = totalLatencyMs > 0 ? Math.round((llmLatencyMs / totalLatencyMs) * 100) : 0;
  const ragRatio = totalLatencyMs > 0 ? Math.max(0, Math.min(100, (ragLatencyMs / totalLatencyMs) * 100)) : 0;
  const donutGradient = totalLatencyMs <= 0
    ? 'conic-gradient(from -90deg, rgba(148,163,184,0.25) 0% 100%)'
    : log?.ragEnabled
      ? `conic-gradient(from -90deg, rgba(59,130,246,0.95) 0% ${ragRatio}%, rgba(168,85,247,0.95) ${ragRatio}% 100%)`
      : 'conic-gradient(from -90deg, rgba(168,85,247,0.95) 0% 100%)';
  const failureInsight = buildFailureInsight(log);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-20 text-[var(--foreground)]">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
          <Link to={`${basePath}/logs`} className="transition-colors hover:text-[var(--foreground)]">Logs</Link>
          <span>/</span>
          <span className="truncate text-[var(--foreground)]">{traceId}</span>
        </div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link
              to={`${basePath}/logs`}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface-subtle)] text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-elevated)] hover:text-[var(--foreground)]"
            >
              <ArrowLeft size={20} />
            </Link>
            <div>
              <h1 className="flex items-center gap-3 text-2xl font-bold text-[var(--foreground)]">
                Log Details
                {log && (
                  <>
                    {log.status === 'SUCCESS' && log.isFailover ? (
                      <span className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold tracking-wide border bg-amber-500/15 text-amber-300 border-amber-500/30 shadow-[0_0_12px_rgba(251,191,36,0.18)]">
                        <Zap size={11} />
                        FAILOVER
                      </span>
                    ) : (
                      <span className={statusBadge(log.status)}>{log.status}</span>
                    )}
                  </>
                )}
              </h1>
              <div className="mt-1 flex items-center gap-3 font-mono text-sm text-[var(--text-secondary)]">
                <Hash size={14} />
                {traceId}
                <button
                  onClick={() => navigator.clipboard.writeText(traceId!)}
                  className="text-[var(--text-secondary)] transition-colors hover:text-[var(--foreground)]"
                >
                  <Copy size={12} />
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex rounded-lg border border-[var(--border)] bg-[var(--surface-subtle)] p-1">
              <button
                onClick={() => setActiveTab('details')}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === 'details' ? 'bg-[var(--primary)]/20 text-[var(--primary)] shadow-sm' : 'text-[var(--text-secondary)] hover:text-[var(--foreground)]'}`}
              >
                Overview
              </button>
              <button
                onClick={() => setActiveTab('raw')}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === 'raw' ? 'bg-[var(--primary)]/20 text-[var(--primary)] shadow-sm' : 'text-[var(--text-secondary)] hover:text-[var(--foreground)]'}`}
              >
                Raw JSON
              </button>
            </div>
            <button
              onClick={() => refetch()}
              className="group flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface-subtle)] text-[var(--text-secondary)] transition-colors hover:border-[var(--primary)]/40 hover:text-[var(--primary)]"
            >
              <RefreshCw size={18} className="group-hover:rotate-180 transition-transform duration-500" />
            </button>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-3 gap-6 animate-pulse">
          <div className="h-40 rounded-2xl bg-[var(--surface-subtle)]" />
          <div className="h-40 rounded-2xl bg-[var(--surface-subtle)]" />
          <div className="h-40 rounded-2xl bg-[var(--surface-subtle)]" />
        </div>
      ) : isError || !log ? (
        <div className="glass-card rounded-xl border border-[var(--border)] p-8 text-center">
          <div className="mb-2 text-lg font-medium text-[var(--foreground)]">Failed to load log details</div>
          <button onClick={() => refetch()} className="text-[var(--primary)] hover:underline">Retry</button>
        </div>
      ) : activeTab === 'raw' ? (
        <div className="glass-card overflow-hidden rounded-xl border border-[var(--border)] p-0">
          <div className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--surface-subtle)] px-6 py-3">
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">Raw JSON Data</span>
            <button
              onClick={() => navigator.clipboard.writeText(rawJson)}
              className="inline-flex items-center gap-2 text-xs text-[var(--primary)] transition-colors hover:text-[var(--foreground)]"
            >
              <Copy size={14} /> Copy
            </button>
          </div>
          <pre className="max-h-[70vh] overflow-x-auto overflow-y-auto whitespace-pre bg-[color:rgba(15,23,42,0.04)] p-6 font-mono text-xs text-[var(--foreground)] custom-scrollbar dark:bg-black/30 dark:text-gray-300">
            {rawJson}
          </pre>
        </div>
      ) : (
        <div className="space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* 1. Model Info Card */}
            <div className="glass-card relative overflow-hidden rounded-xl border border-[var(--border)] p-5 group">
              <div className="flex items-center gap-2 mb-4 text-[var(--primary)] border-l-2 border-[var(--primary)] pl-2">
                <h3 className="text-xs font-bold uppercase tracking-wider">모델 정보</h3>
              </div>
              <div className="space-y-3 relative z-10">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-[var(--text-secondary)]">Provider</span>
                  <span className="font-medium text-[var(--foreground)]">{log.provider}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-[var(--text-secondary)]">요청 모델</span>
                  <span className="font-mono text-xs text-[var(--text-secondary)]">{log.requestedModel}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-[var(--text-secondary)]">사용 모델</span>
                  <span className={`rounded border px-2 py-0.5 text-xs font-mono font-medium ${log.isFailover ? 'border-[var(--primary)]/30 bg-[var(--primary)]/20 text-[var(--primary)]' : 'border-[var(--border)] bg-[var(--surface-subtle)] text-[var(--text-secondary)]'}`}>
                    {log.usedModel}
                  </span>
                </div>
                {log.isFailover && (
                  <div className="mt-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center gap-2 text-xs text-amber-500 font-medium">
                    <Zap size={12} fill="currentColor" />
                    Failover Active
                  </div>
                )}
              </div>
            </div>

            {/* 2. Token & Cost Card */}
            <div className="glass-card relative overflow-hidden rounded-xl border border-[var(--border)] p-5 group">
              <div className="mb-4 flex items-center gap-2 border-l-2 border-blue-500 pl-2 text-blue-700 dark:text-blue-300">
                <h3 className="text-xs font-bold uppercase tracking-wider">토큰 및 비용</h3>
              </div>
              <div className="space-y-3 relative z-10">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-[var(--text-secondary)]">입력 토큰</span>
                  <span className="font-mono text-[var(--foreground)]">{log.inputTokens?.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-[var(--text-secondary)]">출력 토큰</span>
                  <span className="font-mono text-[var(--foreground)]">{log.outputTokens?.toLocaleString()}</span>
                </div>
                <div className="my-2 h-px w-full bg-[var(--border)]" />
                <div className="flex justify-between items-center text-sm">
                  <span className="text-[var(--text-secondary)]">총 토큰</span>
                  <span className="font-mono font-bold text-[var(--foreground)]">{log.totalTokens?.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-[var(--text-secondary)]">비용</span>
                  <span className="font-mono font-bold text-emerald-700 dark:text-emerald-300">
                    {typeof log.cost === 'number' ? `$${log.cost.toFixed(5)}` : '-'}
                  </span>
                </div>
              </div>
            </div>

            {/* 3. RAG Configuration Card */}
            <div className="glass-card relative overflow-hidden rounded-xl border border-[var(--border)] p-5 group">
              <div className="mb-4 flex items-center gap-2 border-l-2 border-purple-500 pl-2 text-purple-700 dark:text-purple-300">
                <h3 className="text-xs font-bold uppercase tracking-wider">RAG 설정</h3>
              </div>
              <div className="space-y-3 relative z-10">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-[var(--text-secondary)]">Top K</span>
                  <span className="font-mono text-[var(--foreground)]">{log.ragTopK || '-'}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-[var(--text-secondary)]">유사도 임계값</span>
                  <span className="font-mono text-[var(--foreground)]">{log.ragSimilarityThreshold || '-'}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-[var(--text-secondary)]">검색 청크 수</span>
                  <span className="font-mono text-[var(--foreground)]">{log.ragChunksCount || 0}</span>
                </div>
              </div>
            </div>

            {/* 4. Request Info Card */}
            <div className="glass-card relative overflow-hidden rounded-xl border border-[var(--border)] p-5 group">
              <div className="mb-4 flex items-center gap-2 border-l-2 border-[var(--border)] pl-2 text-[var(--text-secondary)]">
                <h3 className="text-xs font-bold uppercase tracking-wider">요청 정보</h3>
              </div>
              <div className="space-y-3 relative z-10">
                <div className="space-y-1">
                  <span className="text-xs text-[var(--text-secondary)]">Trace ID</span>
                  <div className="flex items-start justify-between gap-2 rounded border border-[var(--border)] bg-[var(--surface-subtle)] p-1.5">
                    <code className="flex-1 break-all font-mono text-[10px] leading-tight text-blue-700 dark:text-blue-300">
                      {log.traceId}
                    </code>
                    <button onClick={() => navigator.clipboard.writeText(log.traceId!)} className="text-[var(--text-secondary)] hover:text-[var(--foreground)]">
                      <Copy size={10} />
                    </button>
                  </div>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-[var(--text-secondary)]">HTTP 상태</span>
                  <span className={`font-mono font-bold ${log.httpStatus === 200 ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-600 dark:text-rose-400'}`}>
                    {log.httpStatus}
                  </span>
                </div>
                <div className="flex justify-between items-center border-t border-[var(--border)] pt-1 text-sm">
                  <span className="text-[var(--text-secondary)]">요청 소스</span>
                  <span className="text-xs font-bold uppercase tracking-wider text-[var(--foreground)]">{log.requestSource}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-[var(--text-secondary)]">생성 시각</span>
                  <span className="font-mono text-[10px] text-[var(--text-secondary)]">{formatKstDateTimeOrFallback(log.createdAt)}</span>
                </div>
                <div className="space-y-1 border-t border-[var(--border)] pt-2">
                  <span className="text-xs text-[var(--text-secondary)]">요청 경로</span>
                  <div className="break-all font-mono text-xs leading-tight text-[var(--text-secondary)]">
                    {log.requestPath || '/v1/models/chat'}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {failureInsight && (
            <div className="glass-card p-5 rounded-xl border border-rose-500/30 bg-rose-500/[0.04]">
              <div className="mb-4 flex items-center gap-2 border-l-2 border-rose-400 pl-2 text-rose-700 dark:text-rose-300">
                <AlertTriangle size={14} />
                <h3 className="text-xs font-bold uppercase tracking-wider">실패/차단 원인 분석</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div className="space-y-2">
                  <div className="flex justify-between gap-3">
                    <span className="text-[var(--text-secondary)]">상태</span>
                    <span className="font-mono text-[var(--foreground)]">{log.status}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-[var(--text-secondary)]">HTTP 상태</span>
                    <span className="font-mono text-[var(--foreground)]">{failureInsight.httpStatus ?? '-'}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-[var(--text-secondary)]">Error Code</span>
                    <span className="text-xs font-mono text-rose-700 dark:text-rose-300">{failureInsight.errorCode ?? '-'}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-[var(--text-secondary)]">Fail Reason</span>
                    <span className="text-xs font-mono text-rose-700/90 dark:text-rose-200">{failureInsight.failReason ?? '-'}</span>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <div className="mb-1 text-xs text-[var(--text-secondary)]">실패/차단 메시지</div>
                    <p className="text-sm leading-relaxed text-rose-700 dark:text-rose-100">
                      {failureInsight.errorMessage ?? '메시지가 저장되지 않았습니다.'}
                    </p>
                  </div>
                  <div>
                    <div className="mb-1 text-xs text-[var(--text-secondary)]">해석</div>
                    <p className="text-sm leading-relaxed text-[var(--foreground)]">{failureInsight.reasonDescription}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Execution Timeline */}
          <div className="glass-card rounded-2xl border border-[var(--border)] p-6">
            <div className="mb-6 flex items-center gap-2 text-blue-700 dark:text-blue-300">
              <Clock size={16} />
              <h3 className="text-sm font-bold">실행 타임라인</h3>
            </div>

            <div className="relative pt-2 pb-6 px-2">
              <div className="mb-4 flex flex-wrap gap-2 text-[11px] text-[var(--text-secondary)]">
                <span className="inline-flex items-center gap-1.5 rounded border border-[var(--border)] bg-[var(--surface-subtle)] px-2 py-1">
                  <span className="h-2 w-2 rounded-full bg-slate-300/80" />
                  전체 요청
                </span>
                {log.ragEnabled && (
                  <span className="inline-flex items-center gap-1.5 rounded border border-blue-500/25 bg-blue-500/10 px-2 py-1 text-blue-700 dark:text-blue-300">
                    <span className="h-2 w-2 rounded-full bg-blue-400/90" />
                    RAG 검색
                  </span>
                )}
                <span className="inline-flex items-center gap-1.5 rounded border border-purple-500/25 bg-purple-500/10 px-2 py-1 text-purple-700 dark:text-purple-300">
                  <span className="h-2 w-2 rounded-full bg-purple-400/90" />
                  LLM 생성
                </span>
              </div>

              <div className="mx-auto max-w-[460px]">
                <div className="relative mx-auto h-44 w-44 rounded-full border border-[var(--border)] bg-[var(--surface-subtle)] p-[1px]">
                  <div
                    className="absolute inset-0 rounded-full"
                    style={{ background: donutGradient }}
                  />
                  <div className="absolute inset-[16px] flex flex-col items-center justify-center rounded-full border border-[var(--border)] bg-[var(--background-card)] text-center dark:bg-[#0b0d1d]/95">
                    <span className="text-[11px] text-[var(--text-secondary)]">총 지연</span>
                    <span className="font-mono text-2xl font-bold leading-none text-[var(--foreground)]">{totalLatencyMs}ms</span>
                    <span className="mt-1 font-mono text-[11px] text-[var(--text-secondary)]">{formatSeconds(totalLatencyMs)}</span>
                  </div>
                </div>

                <div className="mt-4 space-y-2">
                  <div className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--surface-subtle)] px-3 py-2">
                    <span className="inline-flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                      <span className="h-2 w-2 rounded-full bg-slate-300/80" />
                      전체 요청
                    </span>
                    <span className="text-xs font-mono text-[var(--foreground)]">{totalLatencyMs}ms</span>
                  </div>

                  {log.ragEnabled && (
                    <div className="flex items-center justify-between rounded-lg border border-blue-500/20 bg-blue-500/10 px-3 py-2">
                      <span className="inline-flex items-center gap-2 text-xs text-blue-700 dark:text-blue-200">
                        <span className="h-2 w-2 rounded-full bg-blue-400/90" />
                        RAG 검색
                      </span>
                      <span className="text-xs font-mono text-blue-700 dark:text-blue-200">{ragLatencyMs}ms · {ragPercent}%</span>
                    </div>
                  )}

                  <div className="flex items-center justify-between rounded-lg border border-purple-500/20 bg-purple-500/10 px-3 py-2">
                    <span className="inline-flex items-center gap-2 text-xs text-purple-700 dark:text-purple-200">
                      <span className="h-2 w-2 rounded-full bg-purple-400/90" />
                      LLM 생성
                    </span>
                    <span className="text-xs font-mono text-purple-700 dark:text-purple-200">{llmLatencyMs}ms · {llmPercent}%</span>
                  </div>
                </div>
              </div>

              <div className="mt-3 text-[11px] text-[var(--text-secondary)]">
                현재 표시: 전체 요청, RAG 검색, LLM 생성(추정). 네트워크/DB 세부 시간은 백엔드 계측 추가 시 제공 가능합니다.
              </div>
            </div>
          </div>

          <div className="space-y-6">
            {/* Request Payload */}
            <div className="glass-card overflow-hidden rounded-2xl border border-[var(--border)]">
              <div className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--surface-subtle)] px-6 py-4">
                <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300">
                  <MessageSquare size={16} />
                  <h3 className="text-sm font-bold">User Input</h3>
                </div>
                <span className="font-mono text-xs text-[var(--text-secondary)]">
                  {formatFullDateTime(log.createdAt)}
                </span>
              </div>
              {extractedUserQuestions.length > 0 && (
                <div className="border-b border-blue-500/20 bg-blue-500/5 px-6 py-4">
                  <div className="mb-2 text-xs text-[var(--text-secondary)]">사용자 질문</div>
                  <div className="space-y-2">
                    {extractedUserQuestions.map((question, idx) => (
                      <p key={`${idx}-${question}`} className="text-sm leading-relaxed text-[var(--foreground)]">
                        {extractedUserQuestions.length > 1 ? `${idx + 1}. ${question}` : question}
                      </p>
                    ))}
                  </div>
                </div>
              )}
              {extractedUserQuestions.length === 0 && (
                <div className="px-6 py-6 text-sm text-[var(--text-secondary)]">
                  표시할 사용자 질문이 없습니다. 필요하면 Raw JSON 탭에서 원본 payload를 확인하세요.
                </div>
              )}
            </div>

            {/* Response Payload */}
            <div className="glass-card overflow-hidden rounded-2xl border border-[var(--border)]">
              <div className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--surface-subtle)] px-6 py-4">
                <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
                  <MessageSquare size={16} />
                  <h3 className="text-sm font-bold">Response Payload</h3>
                </div>
                <span className="font-mono text-xs text-[var(--text-secondary)]">
                  {responsePayloadTimestamp ? formatFullDateTime(responsePayloadTimestamp) : '-'}
                </span>
              </div>
              <div className="p-0">
                <pre className="max-h-[300px] overflow-x-auto overflow-y-auto whitespace-pre-wrap bg-[color:rgba(15,23,42,0.04)] p-6 font-mono text-xs leading-relaxed text-[var(--foreground)] custom-scrollbar dark:bg-[#0d0d0d] dark:text-gray-300">
                  {log.responsePayload || <span className="italic text-[var(--text-secondary)]">No response payload available</span>}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
