import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { Search, Filter } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { apiClient, extractData } from '@/lib/api-client';
import type { Log, LogsQueryParams } from '@/types';
import { formatDate, formatCurrency } from '@/lib/utils';

export default function LogsPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [promptKey, setPromptKey] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const { data, isLoading } = useQuery({
    queryKey: ['logs', workspaceId, searchQuery, promptKey, statusFilter, from, to, page],
    queryFn: async () => {
      const params: LogsQueryParams = {
        page,
        size: pageSize,
      };
      if (searchQuery) params.traceId = searchQuery;
      if (promptKey) params.promptKey = promptKey;
      if (from) params.from = from;
      if (to) params.to = to;
      if (statusFilter !== 'ALL') params.statusCode = parseInt(statusFilter, 10);

      const queryString = new URLSearchParams(
        Object.entries(params).reduce((acc, [key, value]) => {
          if (value !== undefined) acc[key] = String(value);
          return acc;
        }, {} as Record<string, string>)
      ).toString();

      const response = await apiClient.get<{ logs: Log[]; pagination: any }>(
        `/workspaces/${workspaceId}/logs?${queryString}`
      );
      return extractData(response);
    },
    enabled: !!workspaceId,
  });

  const getStatusBadge = (statusCode: number) => {
    if (statusCode >= 200 && statusCode < 300) {
      return <Badge variant="success">{statusCode}</Badge>;
    }
    if (statusCode >= 400) {
      return <Badge variant="destructive">{statusCode}</Badge>;
    }
    return <Badge variant="secondary">{statusCode}</Badge>;
  };

  return (
    <div>
      <PageHeader
        title="Logs"
        description="Search and inspect request traces."
        breadcrumbs={[
          { label: 'Dashboard', href: `/w/${workspaceId}/dashboard` },
          { label: 'Logs' },
        ]}
      />

      <div className="mb-6 grid gap-4 lg:grid-cols-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by trace ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Input
          placeholder="Prompt key"
          value={promptKey}
          onChange={(e) => setPromptKey(e.target.value)}
        />
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="ALL">All Status</option>
            <option value="200">200</option>
            <option value="400">400</option>
            <option value="500">500</option>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[...Array(10)].map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : (
        <>
          <div className="rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Trace ID</TableHead>
                  <TableHead>Prompt Key</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Model</TableHead>
                  <TableHead>Latency</TableHead>
                  <TableHead>Cost</TableHead>
                  <TableHead>Timestamp</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.logs && data.logs.length > 0 ? (
                  data.logs.map((log) => (
                    <TableRow
                      key={log.traceId}
                      className="cursor-pointer"
                      onClick={() => navigate(`/w/${workspaceId}/logs/${log.traceId}`)}
                    >
                      <TableCell className="font-mono text-xs">{log.traceId}</TableCell>
                      <TableCell className="font-mono text-sm">{log.promptKey}</TableCell>
                      <TableCell>{getStatusBadge(log.statusCode)}</TableCell>
                      <TableCell className="font-mono text-xs">{log.model}</TableCell>
                      <TableCell className="text-sm">{Math.round(log.latency)}ms</TableCell>
                      <TableCell className="text-sm">{formatCurrency(log.cost)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(log.timestamp)}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      No logs found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {data?.pagination && data.pagination.totalPages > 1 && (
            <div className="mt-6 flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Page {data.pagination.page} of {data.pagination.totalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page >= data.pagination.totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}



