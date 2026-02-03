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
    Legend
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
        return '$' + num.toFixed(2);
    };

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return `${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getDate().toString().padStart(2, '0')}`;
    };

    const isLoading = isOverviewLoading || isTimeseriesLoading || isModelLoading || isPromptLoading;

    if (overviewError) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-center">
                    <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
                    <p className="text-gray-600">통계 데이터를 불러오는데 실패했습니다.</p>
                    <p className="text-sm text-gray-400 mt-2">잠시 후 다시 시도해주세요.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
                    <p className="text-sm text-gray-500 mt-1">API 사용량 및 성능 현황을 한눈에 확인하세요</p>
                </div>

                {/* Filters */}
                <div className="flex items-center gap-3">
                    {/* Workspace Filter Dropdown */}
                    <div className="relative">
                        <button
                            onClick={() => setIsWorkspaceDropdownOpen(!isWorkspaceDropdownOpen)}
                            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors shadow-sm"
                        >
                            {selectedWorkspaceId ? <Layers size={16} className="text-gray-500" /> : <Building2 size={16} className="text-gray-500" />}
                            <span>{selectedWorkspaceId ? workspaces.find(w => w.id === selectedWorkspaceId)?.displayName : '전체 조직'}</span>
                            <ChevronDown size={16} className={`text-gray-400 transition-transform ${isWorkspaceDropdownOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {isWorkspaceDropdownOpen && (
                            <>
                                <div
                                    className="fixed inset-0 z-10"
                                    onClick={() => setIsWorkspaceDropdownOpen(false)}
                                />
                                <div className="absolute right-0 mt-2 w-56 bg-white border border-gray-200 rounded-lg shadow-lg z-20 py-1">
                                    <button
                                        onClick={() => {
                                            setSelectedWorkspaceId(undefined);
                                            setIsWorkspaceDropdownOpen(false);
                                        }}
                                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left transition-colors ${!selectedWorkspaceId
                                            ? 'bg-indigo-50 text-indigo-700'
                                            : 'text-gray-700 hover:bg-gray-50'
                                            }`}
                                    >
                                        <Building2 size={16} className={!selectedWorkspaceId ? 'text-indigo-500' : 'text-gray-400'} />
                                        <span className={!selectedWorkspaceId ? 'font-medium' : ''}>전체 조직</span>
                                        <span className="ml-auto text-xs text-gray-400">모든 워크스페이스</span>
                                    </button>
                                    {workspaces.map((ws) => (
                                        <button
                                            key={ws.id}
                                            onClick={() => {
                                                setSelectedWorkspaceId(ws.id);
                                                setIsWorkspaceDropdownOpen(false);
                                            }}
                                            className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left transition-colors ${selectedWorkspaceId === ws.id
                                                ? 'bg-indigo-50 text-indigo-700'
                                                : 'text-gray-700 hover:bg-gray-50'
                                                }`}
                                        >
                                            <Layers size={16} className={selectedWorkspaceId === ws.id ? 'text-indigo-500' : 'text-gray-400'} />
                                            <span className={selectedWorkspaceId === ws.id ? 'font-medium' : ''}>{ws.displayName}</span>
                                        </button>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>

                    {/* Period Filter */}
                    <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg">
                        {(['daily', 'weekly', 'monthly'] as Period[]).map((p) => (
                            <button
                                key={p}
                                onClick={() => setPeriod(p)}
                                className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${period === p
                                    ? 'bg-white text-gray-900 shadow-sm'
                                    : 'text-gray-600 hover:text-gray-900'
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
                    <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
                    <span className="ml-2 text-gray-500">데이터를 불러오는 중...</span>
                </div>
            )}

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <KPICard
                    title="총 요청 수"
                    value={formatNumber(overview?.totalRequests || 0)}
                    change={overview?.requestsChange || 0}
                    icon={<Activity className="text-indigo-600" size={24} />}
                    subtitle={`성공률 ${overview?.successRate.toFixed(1) || 0}%`}
                    isLoading={isOverviewLoading}
                />
                <KPICard
                    title="토큰 사용량"
                    value={formatNumber(overview?.totalTokens || 0)}
                    change={overview?.tokensChange || 0}
                    icon={<Zap className="text-amber-500" size={24} />}
                    subtitle="입력 + 출력 합계"
                    isLoading={isOverviewLoading}
                />
                <KPICard
                    title="평균 응답 속도"
                    value={`${overview?.avgLatencyMs || 0}ms`}
                    change={overview?.latencyChange || 0}
                    icon={<Clock className="text-emerald-600" size={24} />}
                    subtitle={`P95: ${overview?.p95LatencyMs || 0}ms`}
                    invertChange
                    isLoading={isOverviewLoading}
                />
                <KPICard
                    title="예상 비용"
                    value={formatCurrency(overview?.totalCost || 0)}
                    change={overview?.costChange || 0}
                    icon={<Coins className="text-rose-500" size={24} />}
                    subtitle="USD 기준"
                    isLoading={isOverviewLoading}
                />
            </div>

            {/* Time Series Chart */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h2 className="text-lg font-semibold text-gray-900">사용량 추이</h2>
                        <p className="text-sm text-gray-500">일별 요청 수 및 토큰 사용량</p>
                    </div>
                    <div className="flex gap-4 text-sm">
                        <span className="flex items-center gap-2">
                            <span className="w-3 h-3 bg-indigo-500 rounded-full"></span>
                            요청 수
                        </span>
                        <span className="flex items-center gap-2">
                            <span className="w-3 h-3 bg-emerald-500 rounded-full"></span>
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
                                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="colorTokens" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                                <XAxis
                                    dataKey="date"
                                    tick={{ fontSize: 12, fill: '#9ca3af' }}
                                    axisLine={{ stroke: '#e5e7eb' }}
                                    tickLine={false}
                                />
                                <YAxis
                                    yAxisId="left"
                                    tick={{ fontSize: 12, fill: '#9ca3af' }}
                                    axisLine={false}
                                    tickLine={false}
                                    tickFormatter={(value) => value >= 1000 ? `${(value / 1000).toFixed(0)}K` : value}
                                />
                                <YAxis
                                    yAxisId="right"
                                    orientation="right"
                                    tick={{ fontSize: 12, fill: '#9ca3af' }}
                                    axisLine={false}
                                    tickLine={false}
                                    tickFormatter={(value) => `${(value / 1000).toFixed(0)}K`}
                                />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: 'white',
                                        border: '1px solid #e5e7eb',
                                        borderRadius: '8px',
                                        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                                    }}
                                    formatter={(value, name) => {
                                        const numValue = value as number;
                                        if (name === 'requests') return [`${numValue.toLocaleString()} 요청`, '요청 수'];
                                        if (name === 'tokens') return [`${(numValue / 1000).toFixed(1)}K 토큰`, '토큰'];
                                        return [numValue, name];
                                    }}
                                />
                                <Legend
                                    verticalAlign="top"
                                    height={36}
                                    formatter={(value) => value === 'requests' ? '요청 수' : '토큰 (K)'}
                                />
                                <Area
                                    yAxisId="left"
                                    type="monotone"
                                    dataKey="requests"
                                    stroke="#6366f1"
                                    strokeWidth={2}
                                    fillOpacity={1}
                                    fill="url(#colorRequests)"
                                />
                                <Area
                                    yAxisId="right"
                                    type="monotone"
                                    dataKey="tokens"
                                    stroke="#10b981"
                                    strokeWidth={2}
                                    fillOpacity={1}
                                    fill="url(#colorTokens)"
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
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                    <div className="flex items-center gap-2 mb-6">
                        <BarChart3 size={20} className="text-gray-600" />
                        <h2 className="text-lg font-semibold text-gray-900">모델별 사용량</h2>
                    </div>

                    {models.length > 0 ? (
                        <div className="space-y-4">
                            {models.map((model, i) => (
                                <div key={i} className="space-y-2">
                                    <div className="flex items-center justify-between text-sm">
                                        <div className="flex items-center gap-2">
                                            <span className="font-medium text-gray-900">{model.modelName}</span>
                                            <span className="text-xs text-gray-400 px-1.5 py-0.5 bg-gray-100 rounded">
                                                {model.provider}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-4 text-gray-500">
                                            <span>{formatNumber(model.requests)} req</span>
                                            <span>{formatCurrency(model.cost)}</span>
                                        </div>
                                    </div>
                                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all"
                                            style={{ width: `${model.percentage}%` }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="flex items-center justify-center h-32 text-gray-400">
                            <p>사용 데이터가 없습니다</p>
                        </div>
                    )}
                </div>

                {/* Prompt Usage */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                    <div className="flex items-center gap-2 mb-6">
                        <FileText size={20} className="text-gray-600" />
                        <h2 className="text-lg font-semibold text-gray-900">프롬프트별 사용량</h2>
                    </div>

                    {prompts.length > 0 ? (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-left text-gray-500 border-b border-gray-100">
                                        <th className="pb-3 font-medium">프롬프트</th>
                                        <th className="pb-3 font-medium text-right">요청</th>
                                        <th className="pb-3 font-medium text-right">토큰</th>
                                        <th className="pb-3 font-medium text-right">비용</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {prompts.map((prompt) => (
                                        <tr key={prompt.promptId} className="hover:bg-gray-50 transition-colors">
                                            <td className="py-3">
                                                <div>
                                                    <div className="font-medium text-gray-900">{prompt.promptKey}</div>
                                                    <div className="text-xs text-gray-400">ID: {prompt.promptId}</div>
                                                </div>
                                            </td>
                                            <td className="py-3 text-right text-gray-600">
                                                {formatNumber(prompt.requests)}
                                            </td>
                                            <td className="py-3 text-right text-gray-600">
                                                {formatNumber(prompt.tokens)}
                                            </td>
                                            <td className="py-3 text-right text-gray-600">
                                                {formatCurrency(prompt.cost)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="flex items-center justify-center h-32 text-gray-400">
                            <p>사용 데이터가 없습니다</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Footer Note */}
            <div className="text-center text-sm text-gray-400 py-4">
                데이터는 실시간으로 업데이트됩니다
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
    subtitle,
    invertChange = false,
    isLoading = false
}: {
    title: string;
    value: string;
    change: number;
    icon: React.ReactNode;
    subtitle: string;
    invertChange?: boolean;
    isLoading?: boolean;
}) {
    const isPositive = invertChange ? change < 0 : change > 0;

    return (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
                <div className="p-2 bg-gray-50 rounded-lg">
                    {icon}
                </div>
                {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin text-gray-300" />
                ) : (
                    <div className={`flex items-center gap-1 text-sm font-medium ${isPositive ? 'text-emerald-600' : 'text-rose-600'
                        }`}>
                        {isPositive ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                        {Math.abs(change).toFixed(1)}%
                    </div>
                )}
            </div>
            <div className="mt-4">
                {isLoading ? (
                    <div className="h-8 w-24 bg-gray-100 rounded animate-pulse" />
                ) : (
                    <div className="text-2xl font-bold text-gray-900">{value}</div>
                )}
                <div className="text-sm text-gray-500 mt-1">{title}</div>
                <div className="text-xs text-gray-400 mt-0.5">{subtitle}</div>
            </div>
        </div>
    );
}
