import { useState, useMemo, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  RefreshCw,
  Search,
  Filter,
  Download,
  ArrowRight,
  Clock,
  Database,
  AlertTriangle,
  FileText,
  CheckCircle2,
  XCircle,
  Ban,
  Activity
} from 'lucide-react';
import { logsApi } from '@/api/logs.api';
import type { LogsListParams } from '@/api/logs.api';
import type { RequestLogStatus } from '@/types/api.types';

function formatTimeAgo(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  let interval = seconds / 31536000;
  if (interval > 1) return Math.floor(interval) + "y ago";
  interval = seconds / 2592000;
  if (interval > 1) return Math.floor(interval) + "mo ago";
  interval = seconds / 86400;
  if (interval > 1) return Math.floor(interval) + "d ago";
  interval = seconds / 3600;
  if (interval > 1) return Math.floor(interval) + "h ago";
  interval = seconds / 60;
  if (interval > 1) return Math.floor(interval) + "m ago";
  return Math.floor(seconds) + "s ago";
}

export function WorkspaceLogsPage() {
  const { orgId, workspaceId: workspaceIdParam } = useParams<{
    orgId: string;
    workspaceId: string;
  }>();
  const navigate = useNavigate();

  const workspaceId = Number(workspaceIdParam);
  const basePath = orgId
    ? `/orgs/${orgId}/workspaces/${workspaceId}`
    : `/workspaces/${workspaceId}`;

  const isActiveWorkspaceIds = Number.isInteger(workspaceId) && workspaceId > 0;

  // Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [status, setStatus] = useState<'ALL' | RequestLogStatus>('ALL');
  const [model, setModel] = useState<string>('ALL');
  const [provider, setProvider] = useState<string>('ALL');
  const [source, setSource] = useState<string>('ALL');
  const [ragEnabled, setRagEnabled] = useState<'ALL' | 'true' | 'false'>('ALL');
  const [isFailover, setIsFailover] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  useEffect(() => {
    setPage(1);
  }, [searchQuery, status, model, provider, source, ragEnabled, isFailover, workspaceId, pageSize]);

  // Debounced params for query
  const queryParams = useMemo(() => {
    const params: LogsListParams = {
      page: page - 1,
      size: pageSize,
    };

    // Simple heuristic for search query: if it looks like a trace ID (long), use traceId, else promptKey
    if (searchQuery.trim()) {
      if (searchQuery.length > 10) {
        params.traceId = searchQuery.trim();
      } else {
        params.promptKey = searchQuery.trim();
      }
    }

    if (status !== 'ALL') params.status = status;
    if (provider !== 'ALL') params.provider = provider;
    if (model !== 'ALL') params.usedModel = model;
    if (source !== 'ALL') params.requestSource = source;
    if (ragEnabled !== 'ALL') params.ragEnabled = ragEnabled === 'true';
    if (isFailover) params.failover = true;

    return params;
  }, [searchQuery, status, provider, model, source, ragEnabled, isFailover, page, pageSize]);

  const { data: list, isLoading, refetch } = useQuery({
    queryKey: ['workspace-logs', workspaceId, queryParams],
    queryFn: async () => logsApi.list(workspaceId, queryParams),
    enabled: isActiveWorkspaceIds,
  });

  const logs = list?.content ?? [];
  const totalElements = list?.totalElements ?? 0;
  const totalPages = list?.totalPages ?? 0;
  const startRow = totalElements === 0 ? 0 : (page - 1) * pageSize + 1;
  const endRow = totalElements === 0 ? 0 : Math.min(totalElements, page * pageSize);
  const canGoPrev = page > 1;
  const canGoNext = totalPages > 0 && page < totalPages;

  const handlePrev = () => {
    setPage((prev) => Math.max(1, prev - 1));
  };

  const handleNext = () => {
    if (!canGoNext) return;
    setPage((prev) => prev + 1);
  };

  const handleFirst = () => {
    setPage(1);
  };

  const handleLast = () => {
    if (totalPages > 0) {
      setPage(totalPages);
    }
  };

  // Helper Functions
  const getStatusColor = (status: RequestLogStatus) => {
    switch (status) {
      case 'SUCCESS': return 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20';
      case 'FAIL': return 'text-rose-400 bg-rose-400/10 border-rose-400/20';
      case 'TIMEOUT': return 'text-amber-400 bg-amber-400/10 border-amber-400/20';
      case 'BLOCKED': return 'text-gray-400 bg-gray-400/10 border-gray-400/20';
      default: return 'text-blue-400 bg-blue-400/10 border-blue-400/20';
    }
  };

  const getStatusIcon = (status: RequestLogStatus) => {
    switch (status) {
      case 'SUCCESS': return <CheckCircle2 size={12} />;
      case 'FAIL': return <XCircle size={12} />;
      case 'TIMEOUT': return <Clock size={12} />;
      case 'BLOCKED': return <Ban size={12} />;
      default: return <Activity size={12} />;
    }
  };

  const formatLatency = (ms: number | null) => {
    if (!ms) return '-';
    if (ms > 1000) return <span className={ms > 10000 ? 'text-rose-400 font-bold' : ''}>{(ms / 1000).toFixed(2)}s</span>;
    return `${ms}ms`;
  };

  const formatCost = (cost: number | undefined) => {
    if (cost === undefined) return '-';
    if (cost === 0) return '$0.000';
    return `$${cost.toFixed(4)}`;
  };

  const truncate = (str: string | null, length: number) => {
    if (!str) return '';
    return str.length > length ? str.substring(0, length) + '...' : str;
  };

  const getRequestPreview = (requestPayload: string | null) => {
    if (!requestPayload) return 'No prompt';
    try {
      const parsed = JSON.parse(requestPayload);
      if (parsed && typeof parsed === 'object' && 'messages' in parsed && Array.isArray(parsed.messages)) {
        const firstMessage = parsed.messages[0];
        if (firstMessage && typeof firstMessage === 'object' && 'content' in firstMessage) {
          const content = firstMessage.content;
          if (typeof content === 'string' && content.trim()) {
            return content;
          }
        }
      }
      return requestPayload;
    } catch {
      return requestPayload;
    }
  };

  const formatRequestSource = (requestSource: string | null | undefined) => {
    if (!requestSource) return '-';
    const normalized = requestSource.toUpperCase();
    if (normalized === 'HTTP' || normalized === 'GATEWAY') return 'GW';
    if (normalized === 'GRPC' || normalized === 'PLAYGROUND') return 'PG';
    return requestSource;
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Logs</h1>
          <p className="text-sm text-gray-400 mt-1">Trace and debug your LLM requests</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => refetch()}
            className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
            title="새로고침"
          >
            <RefreshCw size={18} />
          </button>
          <div className="h-6 w-px bg-white/10 hidden sm:block" />
          <button className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-300 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-all">
            <Download size={16} />
            Export CSV
          </button>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="space-y-4">
        {/* Main Search */}
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search size={16} className="text-gray-500" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-[#141522]/50 border border-white/10 rounded-xl text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-[var(--primary)] focus:border-[var(--primary)] transition-all"
            placeholder="Search by Trace ID, prompt key, or error code..."
          />
        </div>

        {/* Filter Bar */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs font-medium text-gray-400">
            <Filter size={12} />
            <span>FILTERS</span>
          </div>

          <div className="h-6 w-px bg-white/10 mx-1" />

          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as any)}
            className="bg-[#141522] text-gray-300 text-xs px-3 py-1.5 rounded-lg border border-white/10 focus:border-[var(--primary)] outline-none"
          >
            <option value="ALL">Status: All</option>
            <option value="SUCCESS">Success</option>
            <option value="FAIL">Failed</option>
            <option value="TIMEOUT">Timeout</option>
            <option value="BLOCKED">Blocked</option>
          </select>

          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="bg-[#141522] text-gray-300 text-xs px-3 py-1.5 rounded-lg border border-white/10 focus:border-[var(--primary)] outline-none"
          >
            <option value="ALL">Model: All Models</option>
            <option value="gpt-4o">gpt-4o</option>
            <option value="claude-3-5-sonnet">claude-3-5-sonnet</option>
            <option value="gemini-1.5-pro">gemini-1.5-pro</option>
          </select>

          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
            className="bg-[#141522] text-gray-300 text-xs px-3 py-1.5 rounded-lg border border-white/10 focus:border-[var(--primary)] outline-none"
          >
            <option value="ALL">Provider: All Providers</option>
            <option value="OpenAI">OpenAI</option>
            <option value="Anthropic">Anthropic</option>
            <option value="Google">Google</option>
          </select>

          <select
            value={source}
            onChange={(e) => setSource(e.target.value)}
            className="bg-[#141522] text-gray-300 text-xs px-3 py-1.5 rounded-lg border border-white/10 focus:border-[var(--primary)] outline-none"
          >
            <option value="ALL">Source: All Sources</option>
            <option value="GATEWAY">Gateway</option>
            <option value="PLAYGROUND">Playground</option>
          </select>

          <div className="h-6 w-px bg-white/10 mx-1" />

          <button
            onClick={() => setRagEnabled(prev => prev === 'true' ? 'ALL' : 'true')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${ragEnabled === 'true' ? 'bg-[var(--primary)]/20 border-[var(--primary)]/50 text-[var(--primary)]' : 'bg-transparent border-white/10 text-gray-400 hover:border-white/20'}`}
          >
            <Database size={12} />
            RAG
            {ragEnabled === 'true' && <span className="ml-1 flex h-1.5 w-1.5 rounded-full bg-[var(--primary)]" />}
          </button>

          <button
            onClick={() => setIsFailover(!isFailover)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${isFailover ? 'bg-amber-500/20 border-amber-500/50 text-amber-500' : 'bg-transparent border-white/10 text-gray-400 hover:border-white/20'}`}
          >
            <Activity size={12} />
            Failover
          </button>

          <div className="ml-auto">
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs font-medium text-gray-400 hover:text-white transition-colors">
              <Clock size={12} />
              Last 24h
            </button>
          </div>
        </div>
      </div>

      {/* Logs Table */}
      <div className="glass-card rounded-xl border border-white/10 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/5 bg-white/[0.02]">
                <th className="px-6 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider w-32">Status</th>
                <th className="px-6 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider w-40">Time</th>
                <th className="px-6 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Input Preview</th>
                <th className="px-6 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider w-32">Model</th>
                <th className="px-6 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider w-24 text-right">Latency</th>
                <th className="px-6 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider w-32 text-right">Tokens</th>
                <th className="px-6 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider w-24 text-right">Cost</th>
                <th className="px-6 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider w-20 text-center">Source</th>
                <th className="px-4 py-3 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-6 py-4"><div className="h-5 w-20 bg-white/10 rounded" /></td>
                    <td className="px-6 py-4"><div className="h-4 w-24 bg-white/5 rounded" /></td>
                    <td className="px-6 py-4"><div className="h-4 w-64 bg-white/5 rounded" /></td>
                    <td className="px-6 py-4"><div className="h-5 w-20 bg-white/5 rounded" /></td>
                    <td className="px-6 py-4"><div className="h-4 w-12 bg-white/5 rounded ml-auto" /></td>
                    <td className="px-6 py-4"><div className="h-4 w-16 bg-white/5 rounded ml-auto" /></td>
                    <td className="px-6 py-4"><div className="h-4 w-12 bg-white/5 rounded ml-auto" /></td>
                    <td className="px-6 py-4"><div className="h-5 w-10 bg-white/5 rounded mx-auto" /></td>
                    <td className="px-4 py-4"></td>
                  </tr>
                ))
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-gray-500 text-sm">
                    검색 결과가 없습니다.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr
                    key={log.requestId}
                    onClick={() => navigate(`${basePath}/logs/${log.traceId}`)}
                    className="group hover:bg-white/[0.02] transition-colors cursor-pointer"
                  >
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border ${getStatusColor(log.status)}`}>
                        {getStatusIcon(log.status)}
                        {log.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-gray-300">
                          {new Date(log.createdAt).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                        <span className="text-[10px] text-gray-500">
                          {formatTimeAgo(log.createdAt)}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 max-w-md">
                        <FileText size={14} className="text-gray-500 shrink-0" />
                        <span className="text-sm text-gray-300 truncate font-mono">
                          {truncate(getRequestPreview(log.requestPayload), 60)}
                        </span>
                      </div>
                      {log.errorMessage && (
                        <div className="mt-1 flex items-center gap-1.5 text-xs text-rose-400">
                          <AlertTriangle size={12} />
                          <span className="truncate max-w-xs">{log.errorMessage}</span>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2 py-1 rounded-md bg-white/5 text-xs text-gray-300 border border-white/10 font-mono">
                        {log.usedModel || '-'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="text-sm font-mono text-gray-300">
                        {formatLatency(log.latencyMs)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1 text-xs font-mono text-gray-400">
                        <span>{log.inputTokens || 0}</span>
                        <ArrowRight size={10} />
                        <span className="text-gray-300">{log.outputTokens || 0}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="text-sm font-mono text-gray-300">
                        {formatCost(log.cost)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span
                        className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold bg-white/10 text-gray-400 border border-white/5"
                        title={log.requestSource || '-'}
                      >
                        {formatRequestSource(log.requestSource)}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <span className="text-gray-500 group-hover:text-[var(--primary)] transition-colors inline-flex">
                        <ArrowRight size={16} />
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination (Simple) */}
        <div className="border-t border-white/5 px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="text-xs text-gray-500">
              {startRow}-{endRow} / {totalElements}
            </span>
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <label htmlFor="page-size">Rows</label>
              <select
                id="page-size"
                value={pageSize}
                onChange={(e) => {
                  const nextSize = Number(e.target.value);
                  setPageSize(nextSize);
                  setPage(1);
                }}
                className="bg-[#141522] text-gray-300 text-xs px-2 py-1 rounded-lg border border-white/10 focus:border-[var(--primary)] outline-none"
              >
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              disabled={!canGoPrev}
              onClick={handleFirst}
              className="px-2.5 py-1 rounded-lg border border-white/10 text-xs text-gray-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              First
            </button>
            <button
              disabled={!canGoPrev}
              onClick={handlePrev}
              className="px-3 py-1 rounded-lg border border-white/10 text-xs text-gray-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <span className="text-xs text-gray-500 min-w-16 text-center">
              {totalPages > 0 ? `${page}/${totalPages}` : '0/0'}
            </span>
            <button
              disabled={!canGoNext}
              onClick={handleNext}
              className="px-3 py-1 rounded-lg border border-white/10 text-xs text-gray-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
            <button
              disabled={!canGoNext}
              onClick={handleLast}
              className="px-2.5 py-1 rounded-lg border border-white/10 text-xs text-gray-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Last
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
