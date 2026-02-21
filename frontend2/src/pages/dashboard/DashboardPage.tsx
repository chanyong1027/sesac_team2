import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
    Activity,
    Coins,
    Clock,
    TrendingUp,
    ChevronDown,
    Building2,
    Layers,
    AlertCircle,
    AlertTriangle,
    Target
} from 'lucide-react';
import {
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    BarChart,
    Bar,
    PieChart,
    Pie,
    Cell,
    Line,
    ComposedChart
} from 'recharts';
import { statisticsApi } from '@/api/statistics.api';
import type {
    Period
} from '@/api/statistics.api';
import { workspaceApi } from '@/api/workspace.api';

type Tab = 'model' | 'prompt';
const DEFAULT_WORKSPACE_LIMIT_USD = 100; // TODO: replace with workspace/org budget setting API value

const toApiDateTime = (date: Date): string => date.toISOString().slice(0, 19);

const resolvePeriodRange = (period: Period): { from: string; to: string } => {
    const to = new Date();
    const from = new Date(to);

    switch (period) {
        case 'weekly':
            from.setUTCDate(from.getUTCDate() - 7);
            break;
        case 'monthly':
            from.setUTCDate(from.getUTCDate() - 30);
            break;
        case 'daily':
        default:
            from.setUTCDate(from.getUTCDate() - 1);
            break;
    }

    return {
        from: toApiDateTime(from),
        to: toApiDateTime(to),
    };
};

export default function DashboardPage() {
    const { orgId } = useParams<{ orgId: string }>();
    const organizationId = Number(orgId);

    const [period, setPeriod] = useState<Period>('daily');
    const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<number | undefined>(undefined);
    const [isWorkspaceDropdownOpen, setIsWorkspaceDropdownOpen] = useState(false);
    const [usageTab, setUsageTab] = useState<Tab>('model');
    const periodRange = useMemo(() => resolvePeriodRange(period), [period]);
    const rangeParams = useMemo(() => ({
        workspaceId: selectedWorkspaceId,
        from: periodRange.from,
        to: periodRange.to,
    }), [selectedWorkspaceId, periodRange.from, periodRange.to]);

    // Fetch workspaces
    const { data: workspacesResponse } = useQuery({
        queryKey: ['workspaces'],
        queryFn: () => workspaceApi.getWorkspaces(),
    });

    const allWorkspaces = workspacesResponse?.data || [];
    const workspaces = Array.isArray(allWorkspaces)
        ? allWorkspaces.filter((ws) => ws.organizationId === organizationId)
        : [];

    // 1. Overview
    const { data: overviewData, error: overviewError } = useQuery({
        queryKey: ['stats-overview', organizationId, period, selectedWorkspaceId, periodRange.from, periodRange.to],
        queryFn: () => statisticsApi.getOverview(organizationId, {
            period,
            ...rangeParams
        }),
        enabled: !!organizationId,
    });

    // 2. Timeseries (Request Volume)
    const { data: timeseriesData } = useQuery({
        queryKey: ['stats-timeseries', organizationId, period, selectedWorkspaceId, periodRange.from, periodRange.to],
        queryFn: () => statisticsApi.getTimeseries(organizationId, {
            period,
            ...rangeParams
        }),
        enabled: !!organizationId,
    });

    // 3. Model Usage
    const { data: modelData } = useQuery({
        queryKey: ['stats-model', organizationId, period, selectedWorkspaceId, periodRange.from, periodRange.to],
        queryFn: () => statisticsApi.getByModel(organizationId, rangeParams),
        enabled: !!organizationId,
    });

    // 4. Prompt Usage
    const { data: promptData } = useQuery({
        queryKey: ['stats-prompt', organizationId, period, selectedWorkspaceId, periodRange.from, periodRange.to],
        queryFn: () => statisticsApi.getByPrompt(organizationId, rangeParams),
        enabled: !!organizationId,
    });

    // 5. Error Distribution
    const { data: errorData } = useQuery({
        queryKey: ['stats-errors', organizationId, period, selectedWorkspaceId, periodRange.from, periodRange.to],
        queryFn: () => statisticsApi.getErrorDistribution(organizationId, rangeParams),
        enabled: !!organizationId,
    });

    // 6. RAG Quality
    const { data: ragData } = useQuery({
        queryKey: ['stats-rag', organizationId, period, selectedWorkspaceId, periodRange.from, periodRange.to],
        queryFn: () => statisticsApi.getRagQuality(organizationId, rangeParams),
        enabled: !!organizationId,
    });

    // 7. RAG Quality Timeseries
    const { data: ragTimeseriesData } = useQuery({
        queryKey: ['stats-rag-timeseries', organizationId, period, selectedWorkspaceId, periodRange.from, periodRange.to],
        queryFn: () => statisticsApi.getRagQualityTimeseries(organizationId, {
            period,
            ...rangeParams
        }),
        enabled: !!organizationId,
    });

    const overview = overviewData?.data;
    const timeseries = timeseriesData?.data?.data || [];
    const models = modelData?.data?.models || [];
    const prompts = promptData?.data?.prompts || [];
    const errors = errorData?.data || { items: [], totalErrors: 0 };
    const ragQuality = ragData?.data;
    const ragTimeseries = ragTimeseriesData?.data?.data || [];

    // Calculate Error Rate for Donut Chart
    const totalRequests = overview?.totalRequests || 0;
    const errorRate = totalRequests > 0 ? (errors.totalErrors / totalRequests) * 100 : 0;
    const errorChartData = errors.items.slice(0, 4).map(item => ({
        name: item.errorCode || item.failReason || 'Unknown',
        value: item.count,
        color: item.status === 'BLOCKED' ? '#F59E0B' : '#EF4444' // Amber for Blocked, Red for Fail
    }));

    const totalAvgLatencyMs = Number(overview?.avgLatencyMs ?? 0);
    const ragAvgLatencyMs = Number(ragQuality?.avgRagLatencyMs ?? NaN);
    const canShowLatencyBreakdown = Number.isFinite(totalAvgLatencyMs)
        && Number.isFinite(ragAvgLatencyMs)
        && totalAvgLatencyMs > 0
        && ragAvgLatencyMs >= 0;
    const ragPercent = canShowLatencyBreakdown
        ? Math.min(100, Math.max(0, (ragAvgLatencyMs / totalAvgLatencyMs) * 100))
        : 0;
    const llmPercent = canShowLatencyBreakdown ? Math.max(0, 100 - ragPercent) : 0;

    const totalCost = Number(overview?.totalCost ?? 0);
    const costLimit = DEFAULT_WORKSPACE_LIMIT_USD;
    const costProgressPercent = costLimit > 0
        ? Math.min(100, Math.max(0, (totalCost / costLimit) * 100))
        : 0;

    // Data for Usage Analysis Table
    const usageData = usageTab === 'model'
        ? models.map((m, i) => ({
            rank: i + 1,
            name: m.modelName,
            sub: m.provider,
            requests: m.requests,
            tokens: m.tokens,
            latencyMs: typeof m.avgLatencyMs === 'number' ? m.avgLatencyMs : null,
            cost: m.cost
        }))
        : prompts.map((p, i) => ({
            rank: i + 1,
            name: p.promptKey || p.key || p.name || 'Unknown Prompt',
            sub: p.promptVersion || p.version
                ? `Ver. ${p.promptVersion ?? p.version}`
                : (p.promptId ?? p.id) ? `ID: ${p.promptId ?? p.id}` : 'Raw',
            requests: p.requests,
            tokens: p.tokens,
            latencyMs: null,
            cost: p.cost
        }));

    const formatNumber = (num: number) => {
        if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
        if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
        return num.toString();
    };

    const formatCurrency = (num: number) => {
        if (num === 0) return '$0.00';
        const sign = num < 0 ? '-' : '';
        const abs = Math.abs(num);
        if (abs < 0.01) return sign + '$' + abs.toFixed(6);
        if (abs < 1) return sign + '$' + abs.toFixed(4);
        return sign + '$' + abs.toFixed(2);
    };

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return `${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getDate().toString().padStart(2, '0')}`;
    };

    if (overviewError) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-center glass-card rounded-2xl border border-white/10 px-8 py-7">
                    <AlertCircle className="w-12 h-12 text-rose-300 mx-auto mb-4" />
                    <p className="text-gray-200 font-medium">통계 데이터를 불러오는데 실패했습니다.</p>
                    <p className="text-sm text-gray-400 mt-2">잠시 후 다시 시도해주세요.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 pb-20">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white tracking-tight">Command Center</h1>
                    <p className="text-sm text-gray-400 mt-1">Real-time system overview and performance metrics</p>
                </div>

                {/* Filters */}
                <div className="flex items-center gap-3">
                    <div className="flex items-center bg-white/[0.03] rounded-lg p-1 border border-white/5">
                        <div className="relative">
                            <button
                                type="button"
                                onClick={() => setIsWorkspaceDropdownOpen((v) => !v)}
                                className="flex items-center gap-2 px-3 py-1.5 rounded text-xs font-medium text-white bg-white/10 hover:bg-white/15 transition-colors shadow-sm"
                            >
                                {selectedWorkspaceId ? (
                                    <Layers size={14} className="text-gray-300" />
                                ) : (
                                    <Building2 size={14} className="text-gray-300" />
                                )}
                                <span className="max-w-[140px] truncate">
                                    {selectedWorkspaceId
                                        ? (workspaces.find((w) => w.id === selectedWorkspaceId)?.displayName ?? `workspace#${selectedWorkspaceId}`)
                                        : '전체 조직'}
                                </span>
                                <ChevronDown
                                    size={14}
                                    className={`text-gray-400 transition-transform ${isWorkspaceDropdownOpen ? 'rotate-180' : ''}`}
                                />
                            </button>

                            {isWorkspaceDropdownOpen && (
                                <>
                                    <button
                                        type="button"
                                        className="fixed inset-0 z-10"
                                        onClick={() => setIsWorkspaceDropdownOpen(false)}
                                        aria-label="close workspace dropdown"
                                    />
                                    <div className="absolute right-0 mt-2 w-64 bg-[#141522]/95 border border-white/10 rounded-xl shadow-2xl z-20 overflow-hidden backdrop-blur-xl">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setSelectedWorkspaceId(undefined);
                                                setIsWorkspaceDropdownOpen(false);
                                            }}
                                            className={`w-full flex items-center gap-3 px-4 py-3 text-sm text-left transition-colors ${!selectedWorkspaceId
                                                ? 'bg-[var(--primary)]/10 text-white'
                                                : 'text-gray-200 hover:bg-white/5'
                                                }`}
                                        >
                                            <Building2 size={16} className={!selectedWorkspaceId ? 'text-[var(--primary)]' : 'text-gray-400'} />
                                            <span className={!selectedWorkspaceId ? 'font-semibold' : ''}>전체 조직</span>
                                        </button>
                                        {workspaces.map((ws) => (
                                            <button
                                                key={ws.id}
                                                type="button"
                                                onClick={() => {
                                                    setSelectedWorkspaceId(ws.id);
                                                    setIsWorkspaceDropdownOpen(false);
                                                }}
                                                className={`w-full flex items-center gap-3 px-4 py-3 text-sm text-left transition-colors ${selectedWorkspaceId === ws.id
                                                    ? 'bg-[var(--primary)]/10 text-white'
                                                    : 'text-gray-200 hover:bg-white/5'
                                                    }`}
                                            >
                                                <Layers size={16} className={selectedWorkspaceId === ws.id ? 'text-[var(--primary)]' : 'text-gray-400'} />
                                                <span className={selectedWorkspaceId === ws.id ? 'font-semibold' : ''}>{ws.displayName}</span>
                                            </button>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>

                        <div className="mx-1 h-6 w-px bg-white/10" />

                        {(['daily', 'weekly', 'monthly'] as Period[]).map((p) => (
                            <button
                                key={p}
                                type="button"
                                onClick={() => setPeriod(p)}
                                className={`px-3 py-1.5 text-xs font-medium rounded transition-all ${period === p
                                    ? 'bg-[var(--primary)] text-white shadow-sm'
                                    : 'text-gray-400 hover:text-white'
                                    }`}
                            >
                                {p === 'daily' ? '24h' : p === 'weekly' ? '7d' : '30d'}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Top KPI Cards (5 cols) */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                {/* 1. Total Requests */}
                <div className="glass-card p-5 rounded-2xl relative overflow-hidden group">
                    <div className="flex justify-between items-start mb-2">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Total Requests</span>
                        <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400">
                            <Activity size={14} />
                        </div>
                    </div>
                    <div className="flex items-baseline gap-2 mb-2">
                        <span className="text-2xl font-bold text-white tracking-tight">{formatNumber(overview?.totalRequests || 0)}</span>
                        {(overview?.requestsChange ?? 0) !== 0 && (
                            <span className={`text-[10px] font-bold ${(overview?.requestsChange ?? 0) > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {(overview?.requestsChange ?? 0) > 0 ? '↗' : '↘'} {Math.abs(overview?.requestsChange || 0).toFixed(1)}%
                            </span>
                        )}
                    </div>
                    <div className="h-8 -mx-1">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={timeseries.slice(-7)}>
                                <Bar dataKey="requests" fill="#3B82F6" opacity={0.5} radius={[2, 2, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* 2. Error Rate */}
                <div className="glass-card p-5 rounded-2xl relative overflow-hidden group">
                    <div className="flex justify-between items-start mb-2">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Error Rate</span>
                        <div className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400">
                            <AlertTriangle size={14} />
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <div>
                            <div className="text-2xl font-bold text-white tracking-tight mb-1">{errorRate.toFixed(1)}%</div>
                            <span className="text-[10px] text-gray-500">Breakdown</span>
                        </div>
                        <div className="w-12 h-12 relative">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={errorChartData}
                                        innerRadius={16}
                                        outerRadius={22}
                                        paddingAngle={2}
                                        dataKey="value"
                                        stroke="none"
                                    >
                                        {errorChartData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>

                {/* 3. Avg Latency */}
                <div className="glass-card p-5 rounded-2xl relative overflow-hidden group">
                    <div className="flex justify-between items-start mb-2">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Avg Latency</span>
                        <div className="p-1.5 rounded-lg bg-yellow-500/10 text-yellow-400">
                            <Clock size={14} />
                        </div>
                    </div>
                    <div className="text-2xl font-bold text-white tracking-tight mb-1">
                        {(overview?.avgLatencyMs || 0) > 1000
                            ? `${((overview?.avgLatencyMs || 0) / 1000).toFixed(1)}s`
                            : `${overview?.avgLatencyMs || 0}ms`}
                    </div>
                    <div className="text-[10px] text-gray-500 mb-3">
                        P95: {overview?.p95LatencyMs}ms · P99: {overview?.p99LatencyMs}ms
                    </div>
                    {canShowLatencyBreakdown && (
                        <>
                            <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden flex">
                                <div className="bg-blue-500 h-full" style={{ width: `${ragPercent}%` }} title="RAG Overhead" />
                                <div className="bg-[var(--primary)] h-full" style={{ width: `${llmPercent}%` }} title="LLM Generation" />
                            </div>
                            <div className="flex justify-between mt-1 text-[9px] text-gray-500 font-mono">
                                <span>RAG</span>
                                <span>LLM</span>
                            </div>
                        </>
                    )}
                </div>

                {/* 4. Total Cost */}
                <div className="glass-card p-5 rounded-2xl relative overflow-hidden group">
                    <div className="flex justify-between items-start mb-2">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Total Cost</span>
                        <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
                            <Coins size={14} />
                        </div>
                    </div>
                    <div className="flex items-baseline gap-2 mb-2">
                        <span className="text-2xl font-bold text-white tracking-tight">{formatCurrency(totalCost)}</span>
                        {(overview?.costChange ?? 0) !== 0 && (
                            <span className={`text-[10px] font-bold ${(overview?.costChange ?? 0) <= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {(overview?.costChange ?? 0) > 0 ? '↗' : '↘'} {Math.abs(overview?.costChange || 0).toFixed(1)}%
                            </span>
                        )}
                    </div>
                    <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden mt-3">
                        <div
                            className="bg-emerald-500 h-full rounded-full shadow-[0_0_10px_rgba(16,185,129,0.4)]"
                            style={{ width: `${costProgressPercent}%` }}
                        />
                    </div>
                    <div className="flex justify-between mt-1 text-[9px] text-gray-500 font-mono">
                        <span>{formatCurrency(totalCost)} spent</span>
                        <span>{formatCurrency(costLimit)} limit</span>
                    </div>
                </div>

                {/* 5. RAG Quality */}
                <div className="glass-card p-5 rounded-2xl relative overflow-hidden group">
                    <div className="flex justify-between items-start mb-2">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">RAG Quality</span>
                        <div className="p-1.5 rounded-lg bg-[var(--primary)]/10 text-[var(--primary)]">
                            <Target size={14} />
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div>
                            <div className="text-2xl font-bold text-white tracking-tight mb-1">
                                {(ragQuality?.hitRate ? ragQuality.hitRate * 100 : 0).toFixed(0)}%
                            </div>
                            <div className="text-[10px] text-gray-500">
                                Avg Score: {ragQuality?.avgSimilarityThreshold?.toFixed(2) ?? '0.00'}
                            </div>
                        </div>
                        <div className="w-14 h-14 relative ml-auto">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={[{ value: (ragQuality?.hitRate || 0) * 100 }, { value: 100 - ((ragQuality?.hitRate || 0) * 100) }]}
                                        cx="50%"
                                        cy="50%"
                                        startAngle={180}
                                        endAngle={0}
                                        innerRadius={16}
                                        outerRadius={24}
                                        dataKey="value"
                                        stroke="none"
                                    >
                                        <Cell fill="#a855f7" />
                                        <Cell fill="#333" />
                                    </Pie>
                                </PieChart>
                            </ResponsiveContainer>
                            {/* Half circle gauge effect */}
                            <div className="absolute inset-0 flex items-center justify-center pt-2">
                                <span className="text-[10px] font-bold text-[var(--primary)]">
                                    {(ragQuality?.hitRate ? ragQuality.hitRate * 100 : 0).toFixed(0)}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Usage Analysis Table */}
            <div className="glass-card rounded-xl border border-white/5 overflow-hidden">
                <div className="p-4 border-b border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <h2 className="text-base font-bold text-white flex items-center gap-2">
                        Usage Analysis
                    </h2>
                    <div className="flex p-0.5 bg-black/40 rounded-lg border border-white/5">
                        <button
                            onClick={() => setUsageTab('model')}
                            className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${usageTab === 'model' ? 'bg-white/10 text-white shadow-sm' : 'text-gray-400 hover:text-white'}`}
                        >
                            By Model
                        </button>
                        <button
                            onClick={() => setUsageTab('prompt')}
                            className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${usageTab === 'prompt' ? 'bg-white/10 text-white shadow-sm' : 'text-gray-400 hover:text-white'}`}
                        >
                            By Prompt
                        </button>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-white/[0.02] text-[10px] uppercase tracking-wider text-gray-500 font-bold border-b border-white/5">
                                <th className="px-6 py-3">Rank</th>
                                <th className="px-6 py-3">Name</th>
                                <th className="px-6 py-3 text-right">Requests</th>
                                <th className="px-6 py-3 text-right">Tokens</th>
                                <th className="px-6 py-3 text-right">Avg Latency</th>
                                <th className="px-6 py-3 text-right">Cost</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {usageData.length > 0 ? (
                                usageData.slice(0, 5).map((item) => (
                                    <tr key={item.rank} className="hover:bg-white/[0.02] transition-colors group">
                                        <td className="px-6 py-3 text-xs font-medium text-gray-500">#{item.rank}</td>
                                        <td className="px-6 py-3">
                                            <div className="flex flex-col">
                                                <span className="text-sm font-semibold text-blue-400 group-hover:text-blue-300 transition-colors cursor-pointer hover:underline">
                                                    {item.name}
                                                </span>
                                                <span className="text-[10px] text-gray-600 font-mono">{item.sub}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-3 text-right text-sm text-gray-300 font-mono">{formatNumber(item.requests)}</td>
                                        <td className="px-6 py-3 text-right text-sm text-gray-300 font-mono">{formatNumber(item.tokens)}</td>
                                        <td className="px-6 py-3 text-right text-sm text-gray-300 font-mono">
                                            {item.latencyMs != null && item.latencyMs > 0
                                                ? `${formatNumber(item.latencyMs)}ms`
                                                : '-'}
                                        </td>
                                        <td className="px-6 py-3 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <span className="text-sm font-bold text-white font-mono">{formatCurrency(item.cost)}</span>
                                                <div className="w-16 h-1 bg-gray-800 rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-emerald-500 rounded-full"
                                                        style={{ width: `${Math.min(100, item.cost * 10)}%` }}
                                                    />
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={6} className="px-6 py-8 text-center text-sm text-gray-500">
                                        데이터가 없습니다.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
                {usageData.length > 0 && (
                    <div className="p-3 border-t border-white/5 text-center">
                        <button className="text-xs text-gray-500 hover:text-white transition-colors font-medium">
                            View All {usageTab === 'model' ? 'Models' : 'Prompts'}
                        </button>
                    </div>
                )}
            </div>

            {/* Bottom Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Chart 1: Request Volume Trends */}
                <div className="glass-card p-6 rounded-2xl border border-white/5">
                    <div className="flex items-center gap-2 mb-6">
                        <TrendingUp size={16} className="text-gray-400" />
                        <h2 className="text-sm font-bold text-white">Request Volume Trends</h2>
                    </div>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={timeseries.map(d => ({ ...d, date: formatDate(d.date) }))} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorReqs" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.8} />
                                        <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                                <XAxis
                                    dataKey="date"
                                    tick={{ fontSize: 10, fill: '#6B7280' }}
                                    axisLine={false}
                                    tickLine={false}
                                    dy={10}
                                />
                                <YAxis
                                    tick={{ fontSize: 10, fill: '#6B7280' }}
                                    axisLine={false}
                                    tickLine={false}
                                />
                                <Tooltip
                                    cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                                    contentStyle={{ backgroundColor: '#111827', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                                    itemStyle={{ fontSize: '12px' }}
                                    labelStyle={{ color: '#9CA3AF', marginBottom: '5px' }}
                                />
                                <Bar dataKey="requests" fill="url(#colorReqs)" barSize={20} radius={[4, 4, 0, 0]} name="Requests" />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Chart 2: RAG Retrieval Quality */}
                <div className="glass-card p-6 rounded-2xl border border-white/5">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-2">
                            <Target size={16} className="text-[var(--primary)]" />
                            <h2 className="text-sm font-bold text-white">RAG Retrieval Quality</h2>
                        </div>
                        <div className="flex items-center gap-2 text-[10px]">
                            <span className="flex items-center gap-1 text-[var(--primary)]"><span className="w-2 h-2 rounded-full bg-[var(--primary)]"></span>Avg Score</span>
                            <span className="flex items-center gap-1 text-emerald-400"><span className="w-2 h-2 rounded-full bg-emerald-400"></span>Hit Rate</span>
                        </div>
                    </div>

                    <div className="h-64">
                        {ragTimeseries.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart data={ragTimeseries.map(d => ({ ...d, date: formatDate(d.date) }))} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                                    <XAxis
                                        dataKey="date"
                                        tick={{ fontSize: 10, fill: '#6B7280' }}
                                        axisLine={false}
                                        tickLine={false}
                                        dy={10}
                                    />
                                    <YAxis
                                        yAxisId="left"
                                        tick={{ fontSize: 10, fill: '#6B7280' }}
                                        axisLine={false}
                                        tickLine={false}
                                        domain={[0, 1]}
                                    />
                                    <YAxis
                                        yAxisId="right"
                                        orientation="right"
                                        tick={{ fontSize: 10, fill: '#6B7280' }}
                                        axisLine={false}
                                        tickLine={false}
                                        domain={[0, 1]}
                                    />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#111827', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                                        itemStyle={{ fontSize: '12px' }}
                                        labelStyle={{ color: '#9CA3AF', marginBottom: '5px' }}
                                    />
                                    <Area
                                        yAxisId="left"
                                        type="monotone"
                                        dataKey="avgSimilarityThreshold"
                                        stroke="#A855F7"
                                        fill="url(#colorScore)"
                                        strokeWidth={2}
                                        name="Avg Score"
                                    />
                                    <defs>
                                        <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#A855F7" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#A855F7" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <Line
                                        yAxisId="right"
                                        type="monotone"
                                        dataKey="hitRate"
                                        stroke="#34D399"
                                        strokeWidth={2}
                                        dot={false}
                                        name="Hit Rate"
                                        strokeDasharray="4 4"
                                    />
                                </ComposedChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex items-center justify-center text-sm text-gray-500">
                                RAG 시계열 데이터가 없습니다.
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Footer Note */}
            <div className="mt-2 text-center pb-4 border-t border-white/5 pt-6">
                <p className="text-[10px] text-gray-500">데이터는 실시간으로 업데이트됩니다. 모든 시간은 UTC 기준입니다.</p>
            </div>
        </div>
    );
}
