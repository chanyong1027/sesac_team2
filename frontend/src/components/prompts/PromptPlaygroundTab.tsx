import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Play, Copy, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { JsonEditorTextarea } from '@/components/common/JsonEditorTextarea';
import { apiClient, extractData } from '@/lib/api-client';
import type { Prompt, PromptVersion, PlaygroundRequest, PlaygroundResponse } from '@/types';
import { formatCurrency, copyToClipboard } from '@/lib/utils';

interface PromptPlaygroundTabProps {
  prompt: Prompt;
}

export function PromptPlaygroundTab({ prompt }: PromptPlaygroundTabProps) {
  const { workspaceId, promptId } = useParams();
  const [result, setResult] = useState<PlaygroundResponse | null>(null);
  const [versionId, setVersionId] = useState(prompt.activeVersionId || '');
  const [variables, setVariables] = useState(`{
  "name": "John"
}`);
  const [messages, setMessages] = useState(`[
  { "role": "user", "content": "Hello" }
]`);

  const { data: versions } = useQuery({
    queryKey: ['prompt-versions', workspaceId, promptId],
    queryFn: async () => {
      const response = await apiClient.get<PromptVersion[]>(
        `/workspaces/${workspaceId}/prompts/${promptId}/versions`
      );
      return extractData(response);
    },
    enabled: !!workspaceId && !!promptId,
  });

  const playMutation = useMutation({
    mutationFn: async (payload: PlaygroundRequest) => {
      const response = await apiClient.post<PlaygroundResponse>(
        `/workspaces/${workspaceId}/prompts/${promptId}/playground`,
        payload
      );
      return extractData(response);
    },
    onSuccess: (data) => {
      setResult(data);
      toast.success('Playground run completed.');
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Playground run failed.');
    },
  });

  const handleRun = () => {
    let parsedVariables: PlaygroundRequest['variables'] | undefined;
    let parsedMessages: PlaygroundRequest['messages'] | undefined;

    try {
      parsedVariables = variables ? JSON.parse(variables) : undefined;
    } catch {
      toast.error('Variables JSON is invalid.');
      return;
    }

    try {
      parsedMessages = messages ? JSON.parse(messages) : undefined;
    } catch {
      toast.error('Messages JSON is invalid.');
      return;
    }

    playMutation.mutate({
      versionId,
      variables: parsedVariables,
      messages: parsedMessages,
    });
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Playground</CardTitle>
          <CardDescription>Test a version with variables and message overrides.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="versionId">Version</Label>
            <Select
              id="versionId"
              value={versionId}
              onChange={(event) => setVersionId(event.target.value)}
            >
              <option value="">Select version</option>
              {versions?.map((version) => (
                <option key={version.id} value={version.id}>
                  v{version.versionNumber} {version.name ? `- ${version.name}` : ''}
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Variables (JSON)</Label>
            <JsonEditorTextarea value={variables} onChange={setVariables} rows={6} />
          </div>

          <div className="space-y-2">
            <Label>Messages override (JSON)</Label>
            <JsonEditorTextarea value={messages} onChange={setMessages} rows={8} />
          </div>

          <Button className="w-full" onClick={handleRun} disabled={playMutation.isPending || !versionId}>
            <Play className="h-4 w-4 mr-2" />
            {playMutation.isPending ? 'Running...' : 'Run prompt'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Output</CardTitle>
              <CardDescription>View the response and metadata.</CardDescription>
            </div>
            {result && (
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => copyToClipboard(result.output.text)}>
                  <Copy className="h-4 w-4" />
                </Button>
                {result.traceId && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => window.open(`/w/${workspaceId}/logs/${result.traceId}`, '_blank')}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                )}
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {result ? (
            <div className="space-y-4">
              <div className="rounded-lg border bg-muted/40 p-4 text-sm whitespace-pre-wrap">
                {result.output.text}
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Usage</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Prompt</span>
                      <span className="font-mono">{result.usage.promptTokens}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Completion</span>
                      <span className="font-mono">{result.usage.completionTokens}</span>
                    </div>
                    <div className="flex justify-between font-medium">
                      <span className="text-muted-foreground">Total</span>
                      <span className="font-mono">{result.usage.totalTokens}</span>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Performance</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Latency</span>
                      <span className="font-mono">{result.latency}ms</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Cost</span>
                      <span className="font-mono">{formatCurrency(result.cost)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Model</span>
                      <span className="font-mono">{result.model}</span>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div>
                <Label>Trace ID</Label>
                <div className="mt-2 flex items-center gap-2">
                  <code className="flex-1 rounded bg-muted px-3 py-2 text-xs font-mono">
                    {result.traceId}
                  </code>
                  <Button variant="outline" size="sm" onClick={() => copyToClipboard(result.traceId)}>
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex h-56 items-center justify-center text-sm text-muted-foreground">
              Run a prompt to see output.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}



