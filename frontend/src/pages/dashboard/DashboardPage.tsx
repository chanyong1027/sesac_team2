import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import {
  Activity,
  DollarSign,
  MessageSquare,
  TrendingUp,
  Calendar,
} from 'lucide-react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { apiClient, extractData } from '@/lib/api-client';
import type {
  DashboardOverview,
  CallsChartData,
  CostsChartData,
  HealthChartData,
} from '@/types';
import { formatCurrency, formatNumber, formatDateShort } from '@/lib/utils';

type TimeRange = '24h' | '7d' | '30d' | 'custom';

export default function DashboardPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const [timeRange, setTimeRange] = useState<TimeRange>('24h');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    if (timeRange !== 'custom') {
      params.set('interval', timeRange);
    }
    if (timeRange === 'custom') {
      if (from) params.set('from', from);
      if (to) params.set('to', to);
    }
    const value = params.toString();
    return value ? `?${value}` : '';
  }, [timeRange, from, to]);

  const { data: overview, isLoading: overviewLoading } = useQuery({
    queryKey: ['dashboard', 'overview', workspaceId],
    queryFn: async () => {
      const response = await apiClient.get<DashboardOverview>(
        `/workspaces/${workspaceId}/dashboard/overview`
      );
      return extractData(response);
    },
    enabled: !!workspaceId,
  });

  const { data: callsData, isLoading: callsLoading } = useQuery({
    queryKey: ['dashboard', 'calls', workspaceId, queryParams],
    queryFn: async () => {
      const response = await apiClient.get<CallsChartData[]>(
        `/workspaces/${workspaceId}/dashboard/calls${queryParams}`
      );
      return extractData(response);
    },
    enabled: !!workspaceId,
  });

  const { data: costsData, isLoading: costsLoading } = useQuery({
    queryKey: ['dashboard', 'costs', workspaceId, queryParams],
    queryFn: async () => {
      const response = await apiClient.get<CostsChartData[]>(
        `/workspaces/${workspaceId}/dashboard/costs${queryParams}`
      );
      return extractData(response);
    },
    enabled: !!workspaceId,
  });

  const { data: healthData, isLoading: healthLoading } = useQuery({
    queryKey: ['dashboard', 'health', workspaceId, queryParams],
    queryFn: async () => {
      const response = await apiClient.get<HealthChartData[]>(
        `/workspaces/${workspaceId}/dashboard/health${queryParams}`
      );
      return extractData(response);
    },
    enabled: !!workspaceId,
  });

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Monitor traffic, latency, and spend for this workspace."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <Select
              value={timeRange}
              onChange={(event) => setTimeRange(event.target.value as TimeRange)}
              className="w-32"
            >
              <option value="24h">Last 24h</option>
              <option value="7d">Last 7d</option>
              <option value="30d">Last 30d</option>
              <option value="custom">Custom</option>
            </Select>
            {timeRange === 'custom' && (
              <div className="flex items-center gap-2">
                <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
                <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
              </div>
            )}
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Calls</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {overviewLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className="text-2xl font-bold">{formatNumber(overview?.totalCalls || 0)}</div>
                <p className="text-xs text-muted-foreground">
                  {overview?.activePrompts || 0} active prompts
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Cost</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {overviewLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className="text-2xl font-bold">
                  {formatCurrency(overview?.totalCost || 0)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Avg {formatCurrency((overview?.totalCost || 0) / (overview?.totalCalls || 1))} per call
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Latency</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {overviewLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className="text-2xl font-bold">{Math.round(overview?.avgLatency || 0)}ms</div>
                <p className="text-xs text-muted-foreground">Response time</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {overviewLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className="text-2xl font-bold">
                  {((1 - (overview?.errorRate || 0)) * 100).toFixed(2)}%
                </div>
                <p className="text-xs text-muted-foreground">
                  {(overview?.errorRate || 0) * 100}% error rate
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>API Calls</CardTitle>
            <CardDescription>Request volume and error rate trend.</CardDescription>
          </CardHeader>
          <CardContent>
            {callsLoading ? (
              <Skeleton className="h-80 w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={callsData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="timestamp"
                    tickFormatter={(value) => formatDateShort(value)}
                    className="text-xs"
                  />
                  <YAxis className="text-xs" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--popover))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '6px',
                    }}
                  />
                  <Legend />
                  <Bar dataKey="calls" fill="hsl(var(--primary))" name="Calls" />
                  <Bar dataKey="errors" fill="hsl(var(--destructive))" name="Errors" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Cost Trend</CardTitle>
            <CardDescription>Spend per interval and total cost.</CardDescription>
          </CardHeader>
          <CardContent>
            {costsLoading ? (
              <Skeleton className="h-80 w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={costsData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="timestamp"
                    tickFormatter={(value) => formatDateShort(value)}
                    className="text-xs"
                  />
                  <YAxis className="text-xs" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--popover))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '6px',
                    }}
                    formatter={(value: number) => formatCurrency(value)}
                  />
                  <Area
                    type="monotone"
                    dataKey="cost"
                    stroke="hsl(var(--primary))"
                    fill="hsl(var(--primary))"
                    fillOpacity={0.3}
                    name="Cost"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Health Metrics</CardTitle>
            <CardDescription>Latency and success rate trends.</CardDescription>
          </CardHeader>
          <CardContent>
            {healthLoading ? (
              <Skeleton className="h-80 w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={healthData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="timestamp"
                    tickFormatter={(value) => formatDateShort(value)}
                    className="text-xs"
                  />
                  <YAxis yAxisId="left" className="text-xs" />
                  <YAxis yAxisId="right" orientation="right" className="text-xs" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--popover))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '6px',
                    }}
                  />
                  <Legend />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="successRate"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    name="Success Rate (%)"
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="avgLatency"
                    stroke="hsl(var(--destructive))"
                    strokeWidth={2}
                    name="Avg Latency (ms)"
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}



