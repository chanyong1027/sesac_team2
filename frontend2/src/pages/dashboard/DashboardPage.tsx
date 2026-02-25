import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
    Activity,
    Coins,
    Clock,
    TrendingUp,
    TrendingDown,
    Zap,
    BarChart3,
    ChevronDown,
    Building2,
    Layers,
    FileText,
    Loader2,
    AlertCircle
} from 'lucide-react';
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
} from 'recharts';
import { statisticsApi } from '@/api/statistics.api';
import type { OverviewResponse, TimeseriesDataPoint, ModelUsage, PromptUsage } from '@/api/statistics.api';
import { workspaceApi } from '@/api/workspace.api';

type Period = 'daily' | 'weekly' | 'monthly';

export default function DashboardPage() {
    const { orgId } = useParams<{ orgId: string }>();
    const organizationId = Number(orgId);

    const [period, setPeriod] = useState<Period>('daily');
    const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<number | undefined>(undefined);
    const [isWorkspaceDropdownOpen, setIsWorkspaceDropdownOpen] = useState(false);

    // Fetch workspaces
    const { data: workspacesResponse } = useQuery({
        queryKey: ['workspaces'],
        queryFn: () => workspaceApi.getWorkspaces(),
    });

    // axios wraps in .data, and we filter by current org
    const allWorkspaces = workspacesResponse?.data || [];
    const workspaces = Array.isArray(allWorkspaces)
        ? allWorkspaces.filter((ws) => ws.organizationId === organizationId)
        : [];

    // Fetch Overview
    const { data: overviewData, isLoading: isOverviewLoading, error: overviewError } = useQuery({
        queryKey: ['stats-overview', organizationId, period, selectedWorkspaceId],
        queryFn: () => statisticsApi.getOverview(organizationId, {
            period,
            workspaceId: selectedWorkspaceId
        }),
        enabled: !!organizationId,
    });

    // Fetch Timeseries
    const { data: timeseriesData, isLoading: isTimeseriesLoading } = useQuery({
        queryKey: ['stats-timeseries', organizationId, period, selectedWorkspaceId],
        queryFn: () => statisticsApi.getTimeseries(organizationId, {
            period,
            workspaceId: selectedWorkspaceId
        }),
        enabled: !!organizationId,
    });

    // Fetch Model Usage
    const { data: modelData, isLoading: isModelLoading } = useQuery({
        queryKey: ['stats-model', organizationId, selectedWorkspaceId],
        queryFn: () => statisticsApi.getByModel(organizationId, {
            workspaceId: selectedWorkspaceId
        }),
        enabled: !!organizationId,
    });

    // Fetch Prompt Usage
    const { data: promptData, isLoading: isPromptLoading } = useQuery({
        queryKey: ['stats-prompt', organizationId, selectedWorkspaceId],
        queryFn: () => statisticsApi.getByPrompt(organizationId, {
            workspaceId: selectedWorkspaceId
        }),
        enabled: !!organizationId,
    });

    const overview: OverviewResponse | undefined = overviewData?.data;
    const timeseries: TimeseriesDataPoint[] = timeseriesData?.data?.data || [];
    const models: ModelUsage[] = modelData?.data?.models || [];
    const prompts: PromptUsage[] = promptData?.data?.prompts || [];

    const formatNumber = (num: number) => {
        if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
        if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
        return num.toString();
    };

    const formatCurrency = (num: number) => {
        if (num === 0) return '$0.00';
        const sign = num < 0 ? '-' : '';
        const abs = Math.abs(num);
        if (abs < 0.01) return sign + '$' + abs.toFixed(6);  // 작은 금액은 소수점 6자리
        if (abs < 1) return sign + '$' + abs.toFixed(4);     // $1 미만은 소수점 4자리
        return sign + '$' + abs.toFixed(2);                  // 그 외는 소수점 2자리
    };

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return `${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getDate().toString().padStart(2, '0')}`;
    };

    const isLoading = isOverviewLoading || isTimeseriesLoading || isModelLoading || isPromptLoading;

    if (overviewError) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-center glass-card rounded-2xl border border-[var(--border)] px-8 py-7">
                    <AlertCircle className="w-12 h-12 text-rose-300 mx-auto mb-4" />
                    <p className="text-gray-200 font-medium">통계 데이터를 불러오는데 실패했습니다.</p>
                    <p className="text-sm text-gray-400 mt-2">잠시 후 다시 시도해주세요.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-[var(--foreground)] tracking-tight">Dashboard</h1>
                    <p className="text-sm text-gray-400 mt-1">API 사용량 및 성능 현황을 한눈에 확인하세요</p>
                </div>

                {/* Filters */}
                <div className="flex items-center gap-3">
                    <div className="flex items-center bg-[var(--muted)] rounded-lg p-1 border border-[var(--border)]">
                        {/* Workspace Filter Dropdown (left slot, like "전체 조직") */}
                        <div className="relative">
                            <button
                                type="button"
                                onClick={() => setIsWorkspaceDropdownOpen((v) => !v)}
                                className="flex items-center gap-2 px-3 py-1.5 rounded text-xs font-medium text-[var(--foreground)] bg-[var(--accent)] hover:bg-[var(--muted)] transition-colors shadow-sm"
                                aria-haspopup="menu"
                                aria-expanded={isWorkspaceDropdownOpen}
                                title="워크스페이스 범위"
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
                                        aria-label="close workspace dropdown overlay"
                                    />
                                    <div className="absolute right-0 mt-2 w-64 bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-2xl z-20 overflow-hidden backdrop-blur-xl">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setSelectedWorkspaceId(undefined);
                                                setIsWorkspaceDropdownOpen(false);
                                            }}
                                            className={`w-full flex items-center gap-3 px-4 py-3 text-sm text-left transition-colors ${!selectedWorkspaceId
                                                ? 'bg-[var(--primary)]/10 text-[var(--foreground)]'
                                                : 'text-[var(--foreground)] hover:bg-[var(--muted)]'
                                                }`}
                                        >
                                            <Building2 size={16} className={!selectedWorkspaceId ? 'text-[var(--primary)]' : 'text-gray-400'} />
                                            <span className={!selectedWorkspaceId ? 'font-semibold' : ''}>전체 조직</span>
                                            <span className="ml-auto text-xs text-gray-500">모든 워크스페이스</span>
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
                                                    ? 'bg-[var(--primary)]/10 text-[var(--foreground)]'
                                                    : 'text-[var(--foreground)] hover:bg-[var(--muted)]'
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

                        {/* Period Filter */}
                        {(['daily', 'weekly', 'monthly'] as Period[]).map((p) => (
                            <button
                                key={p}
                                type="button"
                                onClick={() => setPeriod(p)}
                                className={`px-3 py-1.5 text-xs font-medium rounded transition-all ${period === p
                                    ? 'bg-[var(--accent)] text-[var(--foreground)] shadow-sm'
                                    : 'text-[var(--text-secondary)] hover:text-[var(--foreground)]'
                                    }`}
                            >
                                {p === 'daily' ? '일간' : p === 'weekly' ? '주간' : '월간'}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Loading Indicator */}
            {isLoading && (
                <div className="flex items-center justify-center py-4">
                    <Loader2 className="w-6 h-6 animate-spin text-[var(--primary)]" />
                    <span className="ml-2 text-gray-400">데이터를 불러오는 중...</span>
                </div>
            )}

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <KPICard
                    title="총 요청 수"
                    value={formatNumber(overview?.totalRequests || 0)}
                    change={overview?.requestsChange || 0}
                    icon={<Activity className="text-[var(--primary)]" size={18} />}
                    iconWrapClassName="bg-[var(--primary)]/10 border border-[var(--primary)]/20"
                    subtitle={`성공률 ${overview?.successRate.toFixed(1) || 0}%`}
                    isLoading={isOverviewLoading}
                />
                <KPICard
                    title="토큰 사용량"
                    value={formatNumber(overview?.totalTokens || 0)}
                    change={overview?.tokensChange || 0}
                    icon={<Zap className="text-yellow-300" size={18} />}
                    iconWrapClassName="bg-yellow-500/10 border border-yellow-500/20"
                    subtitle="입력 + 출력 합계"
                    isLoading={isOverviewLoading}
                />
                <KPICard
                    title="평균 응답 속도"
                    value={`${overview?.avgLatencyMs || 0}ms`}
                    change={overview?.latencyChange || 0}
                    icon={<Clock className="text-emerald-300" size={18} />}
                    iconWrapClassName="bg-emerald-500/10 border border-emerald-500/20"
                    subtitle={`P95: ${overview?.p95LatencyMs || 0}ms`}
                    invertChange
                    isLoading={isOverviewLoading}
                />
                <KPICard
                    title="예상 비용"
                    value={formatCurrency(overview?.totalCost || 0)}
                    change={overview?.costChange || 0}
                    icon={<Coins className="text-pink-300" size={18} />}
                    iconWrapClassName="bg-pink-500/10 border border-pink-500/20"
                    subtitle="USD 기준"
                    isLoading={isOverviewLoading}
                />
            </div>

            {/* Time Series Chart */}
            <div className="glass-card rounded-xl border border-[var(--border)] p-6">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h2 className="text-lg font-bold text-[var(--foreground)]">사용량 추이</h2>
                        <p className="text-xs text-gray-500 mt-1">일별 요청 수 및 토큰 사용량</p>
                    </div>
                    <div className="flex items-center gap-4 text-xs">
                        <span className="flex items-center gap-2 text-gray-400">
                            <span className="w-2.5 h-2.5 rounded-full bg-[var(--primary)] shadow-[0_0_8px_rgba(168,85,247,0.6)]" />
                            요청 수
                        </span>
                        <span className="flex items-center gap-2 text-gray-400">
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                            토큰 (K)
                        </span>
                    </div>
                </div>

                {/* Recharts Area Chart */}
                <div className="h-72">
                    {timeseries.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={100}>
                            <AreaChart data={timeseries.map(d => ({ ...d, date: formatDate(d.date) }))} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorRequests" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="rgb(168,85,247)" stopOpacity={0.22} />
                                        <stop offset="95%" stopColor="rgb(168,85,247)" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="colorTokens" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="rgb(16,185,129)" stopOpacity={0.18} />
                                        <stop offset="95%" stopColor="rgb(16,185,129)" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.07)" />
                                <XAxis
                                    dataKey="date"
                                    tick={{ fontSize: 12, fill: 'rgba(148,163,184,0.70)' }}
                                    axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
                                    tickLine={false}
                                />
                                <YAxis
                                    yAxisId="left"
                                    tick={{ fontSize: 12, fill: 'rgba(148,163,184,0.70)' }}
                                    axisLine={false}
                                    tickLine={false}
                                    tickFormatter={(value) => value >= 1000 ? `${(value / 1000).toFixed(0)}K` : value}
                                />
                                <YAxis
                                    yAxisId="right"
                                    orientation="right"
                                    tick={{ fontSize: 12, fill: 'rgba(148,163,184,0.70)' }}
                                    axisLine={false}
                                    tickLine={false}
                                    tickFormatter={(value) => `${(value / 1000).toFixed(0)}K`}
                                />
                                <Tooltip
                                    cursor={{ stroke: 'rgba(255,255,255,0.10)', strokeDasharray: '4 3' }}
                                    contentStyle={{
                                        backgroundColor: 'rgba(11,10,16,0.90)',
                                        border: '1px solid rgba(255,255,255,0.10)',
                                        borderRadius: '12px',
                                        boxShadow: '0 10px 30px rgba(0,0,0,0.35)'
                                    }}
                                    labelStyle={{ color: 'rgba(148,163,184,0.85)' }}
                                    formatter={(value, name) => {
                                        const numValue = value as number;
                                        if (name === 'requests') return [`${numValue.toLocaleString()} 요청`, '요청 수'];
                                        if (name === 'tokens') return [`${(numValue / 1000).toFixed(1)}K 토큰`, '토큰'];
                                        return [numValue, name];
                                    }}
                                />
                                <Area
                                    yAxisId="left"
                                    type="monotone"
                                    dataKey="requests"
                                    stroke="rgb(168,85,247)"
                                    strokeWidth={2}
                                    fillOpacity={1}
                                    fill="url(#colorRequests)"
                                    style={{ filter: 'drop-shadow(0 0 4px rgba(168,85,247,0.40))' }}
                                />
                                <Area
                                    yAxisId="right"
                                    type="monotone"
                                    dataKey="tokens"
                                    stroke="rgb(16,185,129)"
                                    strokeWidth={2}
                                    fillOpacity={1}
                                    fill="url(#colorTokens)"
                                    style={{ filter: 'drop-shadow(0 0 4px rgba(16,185,129,0.35))' }}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="flex items-center justify-center h-full text-gray-400">
                            <div className="text-center">
                                <BarChart3 className="w-12 h-12 mx-auto mb-2 opacity-50" />
                                <p>데이터가 없습니다</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Bottom Grid: Model Breakdown + Prompt Usage */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Model Breakdown */}
                <div className="glass-card rounded-xl border border-[var(--border)] p-6 h-full">
                    <div className="flex items-center gap-2 mb-6">
                        <BarChart3 size={18} className="text-gray-400" />
                        <h2 className="font-bold text-[var(--foreground)] text-base">모델별 사용량</h2>
                    </div>

                    {models.length > 0 ? (
                        <div className="space-y-6">
                            {models.map((model, i) => (
                                <div key={i} className="space-y-2">
                                    <div className="flex items-center justify-between text-sm">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-semibold text-[var(--foreground)]">{model.modelName}</span>
                                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--muted)] text-[var(--text-secondary)] border border-[var(--border)]">
                                                {model.provider}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-4 text-xs">
                                            <span className="text-gray-400">{formatNumber(model.requests)} req</span>
                                            <span className="text-gray-200 font-mono">{formatCurrency(model.cost)}</span>
                                        </div>
                                    </div>
                                    <div className="h-1.5 bg-[var(--muted)] rounded-full overflow-hidden border border-[var(--border)]">
                                        <div
                                            className="h-full bg-gradient-to-r from-[var(--primary)] to-purple-400 rounded-full transition-all shadow-[0_0_10px_rgba(168,85,247,0.4)]"
                                            style={{ width: `${model.percentage}%` }}
                                        />
                                    </div>
                                </div>
                            ))}
                            <div className="py-2 flex items-center justify-center text-gray-600 text-xs italic opacity-50">
                                No more data available
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center justify-center h-32 text-gray-400">
                            <p>사용 데이터가 없습니다</p>
                        </div>
                    )}
                </div>

                {/* Prompt Usage */}
                <div className="glass-card rounded-xl border border-[var(--border)] p-6 h-full flex flex-col">
                    <div className="flex items-center gap-2 mb-6">
                        <FileText size={18} className="text-gray-400" />
                        <h2 className="font-bold text-[var(--foreground)] text-base">프롬프트별 사용량</h2>
                    </div>

                    {prompts.length > 0 ? (
                        <div className="w-full">
                            <div className="grid grid-cols-12 gap-4 pb-3 border-b border-white/10 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                                <div className="col-span-5">프롬프트</div>
                                <div className="col-span-2 text-right">요청</div>
                                <div className="col-span-2 text-right">토큰</div>
                                <div className="col-span-3 text-right">비용</div>
                            </div>
                            <div className="space-y-1">
                                {prompts.map((prompt) => (
                                    <div
                                        key={prompt.promptId ?? prompt.promptKey}
                                        className="grid grid-cols-12 gap-4 py-3 px-2 -mx-2 rounded-lg hover:bg-[var(--muted)] transition-colors items-center group cursor-default"
                                    >
                                        <div className="col-span-5 flex items-center gap-2 overflow-hidden">
                                            <span className="text-xs text-gray-500 font-mono">ID:</span>
                                            <span className="text-xs text-[var(--text-secondary)] truncate group-hover:text-[var(--foreground)] transition-colors">
                                                {prompt.promptKey}
                                            </span>
                                        </div>
                                        <div className="col-span-2 text-right text-sm text-gray-300 font-mono">
                                            {formatNumber(prompt.requests)}
                                        </div>
                                        <div className="col-span-2 text-right text-sm text-gray-300 font-mono">
                                            {formatNumber(prompt.tokens)}
                                        </div>
                                        <div className="col-span-3 text-right text-sm text-[var(--foreground)] font-mono">
                                            {formatCurrency(prompt.cost)}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center justify-center h-32 text-gray-400">
                            <p>사용 데이터가 없습니다</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Footer Note */}
            <div className="mt-2 text-center pb-4 border-t border-[var(--border)] pt-6">
                <p className="text-[10px] text-gray-500">데이터는 실시간으로 업데이트됩니다</p>
            </div>
        </div>
    );
}

// KPI Card Component
function KPICard({
    title,
    value,
    change,
    icon,
    iconWrapClassName,
    subtitle,
    invertChange = false,
    isLoading = false
}: {
    title: string;
    value: string;
    change: number;
    icon: React.ReactNode;
    iconWrapClassName?: string;
    subtitle: string;
    invertChange?: boolean;
    isLoading?: boolean;
}) {
    const isPositive = invertChange ? change < 0 : change > 0;

    return (
        <div className="glass-card p-5 rounded-xl hover:border-[var(--border)] transition-all duration-300 relative overflow-hidden">
            <div className="flex items-start justify-between">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${iconWrapClassName ?? 'bg-[var(--muted)] border border-[var(--border)]'}`}>
                    {icon}
                </div>
                {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin text-gray-500" />
                ) : (
                    <div
                        className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded border ${isPositive
                            ? 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20'
                            : 'text-rose-300 bg-rose-500/10 border-rose-500/20'
                            }`}
                    >
                        {isPositive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                        {Math.abs(change).toFixed(1)}%
                    </div>
                )}
            </div>

            <div className="mt-4">
                {isLoading ? (
                    <div className="h-9 w-24 bg-[var(--muted)] rounded animate-pulse" />
                ) : (
                    <div className="text-3xl font-bold text-[var(--foreground)] mb-1 tracking-tight">{value}</div>
                )}
                <div className="flex flex-col">
                    <p className="text-xs text-gray-400 font-medium mb-0.5">{title}</p>
                    <p className="text-[10px] text-gray-600">{subtitle}</p>
                </div>
            </div>
        </div>
    );
}
