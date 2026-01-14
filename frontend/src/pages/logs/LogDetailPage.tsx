import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { Copy } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { apiClient, extractData } from '@/lib/api-client';
import type { LogDetail } from '@/types';
import { copyToClipboard, formatCurrency, formatDate } from '@/lib/utils';

export default function LogDetailPage() {
  const { workspaceId, traceId } = useParams<{ workspaceId: string; traceId: string }>();

  const { data, isLoading } = useQuery({
    queryKey: ['log', workspaceId, traceId],
    queryFn: async () => {
      const response = await apiClient.get<LogDetail>(
        `/workspaces/${workspaceId}/logs/${traceId}`
      );
      return extractData(response);
    },
    enabled: !!workspaceId && !!traceId,
  });

  if (isLoading) {
    return <Skeleton className="h-64 w-full" />;
  }

  if (!data) {
    return <div className="text-sm text-muted-foreground">Log not found.</div>;
  }

  return (
    <div>
      <PageHeader
        title="Trace detail"
        description="Inspect request and response metadata."
        breadcrumbs={[
          { label: 'Dashboard', href: `/w/${workspaceId}/dashboard` },
          { label: 'Logs', href: `/w/${workspaceId}/logs` },
          { label: data.traceId },
        ]}
        actions={
          <Button variant="outline" onClick={() => copyToClipboard(data.traceId)}>
            <Copy className="h-4 w-4 mr-2" />
            Copy trace ID
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Latency</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{data.latency}ms</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Cost</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{formatCurrency(data.cost)}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Model</CardTitle>
          </CardHeader>
          <CardContent className="text-lg font-semibold">{data.model}</CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Request</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div>
              <p className="text-muted-foreground">Prompt Key</p>
              <p className="font-mono">{data.promptKey}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Timestamp</p>
              <p>{formatDate(data.timestamp)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Variables</p>
              <pre className="rounded bg-muted p-3 text-xs">
                {JSON.stringify(data.request.variables || {}, null, 2)}
              </pre>
            </div>
            <div>
              <p className="text-muted-foreground">Messages</p>
              <pre className="rounded bg-muted p-3 text-xs">
                {JSON.stringify(data.request.messages || [], null, 2)}
              </pre>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Response</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div>
              <p className="text-muted-foreground">Status</p>
              <p>{data.statusCode}</p>
            </div>
            {data.error && (
              <div>
                <p className="text-muted-foreground">Error</p>
                <p className="text-destructive">{data.error}</p>
              </div>
            )}
            <div>
              <p className="text-muted-foreground">Output</p>
              <pre className="rounded bg-muted p-3 text-xs">
                {data.response.output || 'No output'}
              </pre>
            </div>
            <div>
              <p className="text-muted-foreground">Usage</p>
              <div className="flex justify-between text-xs">
                <span>Prompt</span>
                <span>{data.usage.promptTokens}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span>Completion</span>
                <span>{data.usage.completionTokens}</span>
              </div>
              <div className="flex justify-between text-xs font-medium">
                <span>Total</span>
                <span>{data.usage.totalTokens}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}



