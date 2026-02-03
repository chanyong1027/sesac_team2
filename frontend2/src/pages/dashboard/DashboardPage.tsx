import { useState } from 'react';
import {
    Activity,
    Coins,
    Clock,
    TrendingUp,
    TrendingDown,
    Zap,
    Key,
    BarChart3,
    ChevronDown,
    Building2,
    Layers
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

// Mock Data
const mockWorkspaces = [
    { id: 0, name: '전체 조직', icon: Building2 },
    { id: 1, name: 'Production', icon: Layers },
    { id: 2, name: 'Development', icon: Layers },
    { id: 3, name: 'Staging', icon: Layers },
];

const mockOverviewData = {
    totalRequests: 12543,
    requestsChange: 15.2,
    successRate: 98.5,
    totalTokens: 1250000,
    tokensChange: 8.3,
    avgLatency: 456,
    latencyChange: -12.5,
    totalCost: 125.50,
    costChange: 5.8,
};

const mockTimeseriesData = [
    { date: '01/20', requests: 420, tokens: 42000, cost: 4.2 },
    { date: '01/21', requests: 380, tokens: 38000, cost: 3.8 },
    { date: '01/22', requests: 510, tokens: 51000, cost: 5.1 },
    { date: '01/23', requests: 470, tokens: 47000, cost: 4.7 },
    { date: '01/24', requests: 620, tokens: 62000, cost: 6.2 },
    { date: '01/25', requests: 580, tokens: 58000, cost: 5.8 },
    { date: '01/26', requests: 720, tokens: 72000, cost: 7.2 },
    { date: '01/27', requests: 690, tokens: 69000, cost: 6.9 },
    { date: '01/28', requests: 810, tokens: 81000, cost: 8.1 },
    { date: '01/29', requests: 750, tokens: 75000, cost: 7.5 },
    { date: '01/30', requests: 890, tokens: 89000, cost: 8.9 },
    { date: '01/31', requests: 920, tokens: 92000, cost: 9.2 },
    { date: '02/01', requests: 980, tokens: 98000, cost: 9.8 },
    { date: '02/02', requests: 1050, tokens: 105000, cost: 10.5 },
];

const mockModelData = [
    { name: 'GPT-4o', provider: 'OpenAI', requests: 5200, tokens: 520000, cost: 52.00, percentage: 41.5 },
    { name: 'Claude 3.5', provider: 'Anthropic', requests: 3800, tokens: 380000, cost: 38.00, percentage: 30.3 },
    { name: 'Gemini 2.5', provider: 'Google', requests: 2100, tokens: 210000, cost: 21.00, percentage: 16.7 },
    { name: 'GPT-4o-mini', provider: 'OpenAI', requests: 1443, tokens: 140000, cost: 14.50, percentage: 11.5 },
];

const mockApiKeyData = [
    { id: 1, name: 'Production Key', prefix: 'sk-prod-...', requests: 8500, tokens: 850000, cost: 85.00, lastUsed: '2분 전' },
    { id: 2, name: 'Development Key', prefix: 'sk-dev-...', requests: 3200, tokens: 320000, cost: 32.00, lastUsed: '15분 전' },
    { id: 3, name: 'Test Key', prefix: 'sk-test-...', requests: 843, tokens: 80000, cost: 8.50, lastUsed: '1시간 전' },
];

type Period = 'daily' | 'weekly' | 'monthly';

export default function DashboardPage() {
    const [period, setPeriod] = useState<Period>('daily');
    const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<number>(0);
    const [isWorkspaceDropdownOpen, setIsWorkspaceDropdownOpen] = useState(false);

    const selectedWorkspace = mockWorkspaces.find(ws => ws.id === selectedWorkspaceId) || mockWorkspaces[0];

    const formatNumber = (num: number) => {
        if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
        if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
        return num.toString();
    };

    const formatCurrency = (num: number) => {
        return '$' + num.toFixed(2);
    };

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
                            <selectedWorkspace.icon size={16} className="text-gray-500" />
                            <span>{selectedWorkspace.name}</span>
                            <ChevronDown size={16} className={`text-gray-400 transition-transform ${isWorkspaceDropdownOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {isWorkspaceDropdownOpen && (
                            <>
                                <div
                                    className="fixed inset-0 z-10"
                                    onClick={() => setIsWorkspaceDropdownOpen(false)}
                                />
                                <div className="absolute right-0 mt-2 w-56 bg-white border border-gray-200 rounded-lg shadow-lg z-20 py-1">
                                    {mockWorkspaces.map((ws) => (
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
                                            <ws.icon size={16} className={selectedWorkspaceId === ws.id ? 'text-indigo-500' : 'text-gray-400'} />
                                            <span className={selectedWorkspaceId === ws.id ? 'font-medium' : ''}>{ws.name}</span>
                                            {ws.id === 0 && (
                                                <span className="ml-auto text-xs text-gray-400">모든 워크스페이스</span>
                                            )}
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

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <KPICard
                    title="총 요청 수"
                    value={formatNumber(mockOverviewData.totalRequests)}
                    change={mockOverviewData.requestsChange}
                    icon={<Activity className="text-indigo-600" size={24} />}
                    subtitle={`성공률 ${mockOverviewData.successRate}%`}
                />
                <KPICard
                    title="토큰 사용량"
                    value={formatNumber(mockOverviewData.totalTokens)}
                    change={mockOverviewData.tokensChange}
                    icon={<Zap className="text-amber-500" size={24} />}
                    subtitle="입력 + 출력 합계"
                />
                <KPICard
                    title="평균 응답 속도"
                    value={`${mockOverviewData.avgLatency}ms`}
                    change={mockOverviewData.latencyChange}
                    icon={<Clock className="text-emerald-600" size={24} />}
                    subtitle="낮을수록 좋음"
                    invertChange
                />
                <KPICard
                    title="예상 비용"
                    value={formatCurrency(mockOverviewData.totalCost)}
                    change={mockOverviewData.costChange}
                    icon={<Coins className="text-rose-500" size={24} />}
                    subtitle="USD 기준"
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
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={mockTimeseriesData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
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
                </div>
            </div>

            {/* Bottom Grid: Model Breakdown + API Key Usage */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Model Breakdown */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                    <div className="flex items-center gap-2 mb-6">
                        <BarChart3 size={20} className="text-gray-600" />
                        <h2 className="text-lg font-semibold text-gray-900">모델별 사용량</h2>
                    </div>

                    <div className="space-y-4">
                        {mockModelData.map((model, i) => (
                            <div key={i} className="space-y-2">
                                <div className="flex items-center justify-between text-sm">
                                    <div className="flex items-center gap-2">
                                        <span className="font-medium text-gray-900">{model.name}</span>
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
                </div>

                {/* API Key Usage */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                    <div className="flex items-center gap-2 mb-6">
                        <Key size={20} className="text-gray-600" />
                        <h2 className="text-lg font-semibold text-gray-900">API Key별 사용량</h2>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-left text-gray-500 border-b border-gray-100">
                                    <th className="pb-3 font-medium">Key Name</th>
                                    <th className="pb-3 font-medium text-right">Requests</th>
                                    <th className="pb-3 font-medium text-right">Cost</th>
                                    <th className="pb-3 font-medium text-right">Last Used</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {mockApiKeyData.map((key) => (
                                    <tr key={key.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="py-3">
                                            <div>
                                                <div className="font-medium text-gray-900">{key.name}</div>
                                                <div className="text-xs text-gray-400 font-mono">{key.prefix}</div>
                                            </div>
                                        </td>
                                        <td className="py-3 text-right text-gray-600">
                                            {formatNumber(key.requests)}
                                        </td>
                                        <td className="py-3 text-right text-gray-600">
                                            {formatCurrency(key.cost)}
                                        </td>
                                        <td className="py-3 text-right text-gray-400">
                                            {key.lastUsed}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Footer Note */}
            <div className="text-center text-sm text-gray-400 py-4">
                데이터는 실시간으로 업데이트됩니다. 마지막 갱신: 방금 전
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
    invertChange = false
}: {
    title: string;
    value: string;
    change: number;
    icon: React.ReactNode;
    subtitle: string;
    invertChange?: boolean;
}) {
    const isPositive = invertChange ? change < 0 : change > 0;

    return (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
                <div className="p-2 bg-gray-50 rounded-lg">
                    {icon}
                </div>
                <div className={`flex items-center gap-1 text-sm font-medium ${isPositive ? 'text-emerald-600' : 'text-rose-600'
                    }`}>
                    {isPositive ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                    {Math.abs(change)}%
                </div>
            </div>
            <div className="mt-4">
                <div className="text-2xl font-bold text-gray-900">{value}</div>
                <div className="text-sm text-gray-500 mt-1">{title}</div>
                <div className="text-xs text-gray-400 mt-0.5">{subtitle}</div>
            </div>
        </div>
    );
}
