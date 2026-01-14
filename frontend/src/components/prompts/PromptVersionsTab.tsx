import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { JsonEditorTextarea } from '@/components/common/JsonEditorTextarea';
import { apiClient, extractData, ApiClientError, isFieldErrorDetails } from '@/lib/api-client';
import type { CreateVersionRequest, Prompt, PromptVersion } from '@/types';
import { formatDate } from '@/lib/utils';

interface PromptVersionsTabProps {
  prompt: Prompt;
}

const versionSchema = z.object({
  name: z.string().optional(),
  model: z.string().min(2, 'Model is required.'),
  temperature: z.string().optional(),
  maxTokens: z.string().optional(),
  baseVersionId: z.string().optional(),
  messages: z.string().min(2, 'Messages JSON is required.'),
});

type VersionForm = z.infer<typeof versionSchema>;

export function PromptVersionsTab({ prompt }: PromptVersionsTabProps) {
  const { workspaceId, promptId } = useParams();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const { data: versions, isLoading } = useQuery({
    queryKey: ['prompt-versions', workspaceId, promptId],
    queryFn: async () => {
      const response = await apiClient.get<PromptVersion[]>(
        `/workspaces/${workspaceId}/prompts/${promptId}/versions`
      );
      return extractData(response);
    },
    enabled: !!workspaceId && !!promptId,
  });

  const defaultBaseVersion = useMemo(() => {
    if (prompt.activeVersionId) return prompt.activeVersionId;
    if (!versions || versions.length === 0) return undefined;
    return [...versions].sort((a, b) => b.versionNumber - a.versionNumber)[0].id;
  }, [prompt.activeVersionId, versions]);

  const form = useForm<VersionForm>({
    resolver: zodResolver(versionSchema),
    defaultValues: {
      baseVersionId: defaultBaseVersion,
      messages: JSON.stringify(
        [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: 'Hello {{name}}!' },
        ],
        null,
        2
      ),
    },
  });

  useEffect(() => {
    if (defaultBaseVersion && !form.getValues('baseVersionId')) {
      form.setValue('baseVersionId', defaultBaseVersion);
    }
  }, [defaultBaseVersion, form]);

  const createVersion = useMutation({
    mutationFn: async (payload: CreateVersionRequest) => {
      const response = await apiClient.post<PromptVersion>(
        `/workspaces/${workspaceId}/prompts/${promptId}/versions`,
        payload
      );
      return extractData(response);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prompt-versions', workspaceId, promptId] });
      toast.success('Version created.');
      setIsDialogOpen(false);
      form.reset();
    },
    onError: (error) => {
      if (error instanceof ApiClientError && isFieldErrorDetails(error.details)) {
        Object.entries(error.details).forEach(([key, messages]) => {
          form.setError(key as keyof VersionForm, { message: messages?.[0] });
        });
      }
      toast.error(error instanceof Error ? error.message : 'Failed to create version.');
    },
  });

  const handleSubmit = (data: VersionForm) => {
    let parsedMessages: CreateVersionRequest['messages'];
    try {
      parsedMessages = JSON.parse(data.messages);
    } catch {
      toast.error('Messages JSON is invalid.');
      return;
    }

    createVersion.mutate({
      name: data.name || undefined,
      model: data.model,
      temperature: data.temperature ? Number(data.temperature) : undefined,
      maxTokens: data.maxTokens ? Number(data.maxTokens) : undefined,
      baseVersionId: data.baseVersionId || undefined,
      messages: parsedMessages,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button onClick={() => setIsDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Version
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Versions</CardTitle>
          <CardDescription>Track and compare prompt iterations.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-60 w-full" />
          ) : (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Version</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Model</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {versions && versions.length > 0 ? (
                    versions.map((version) => (
                      <TableRow key={version.id}>
                        <TableCell className="font-mono">v{version.versionNumber}</TableCell>
                        <TableCell>{version.name || 'Untitled'}</TableCell>
                        <TableCell className="font-mono text-sm">{version.model}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatDate(version.createdAt)}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                        No versions yet.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create new version</DialogTitle>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input id="name" {...form.register('name')} placeholder="New variant" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="model">Model</Label>
                <Input id="model" {...form.register('model')} placeholder="gpt-4" />
                {form.formState.errors.model && (
                  <p className="text-sm text-destructive">{form.formState.errors.model.message}</p>
                )}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="temperature">Temperature</Label>
                <Input id="temperature" {...form.register('temperature')} placeholder="0.7" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="maxTokens">Max tokens</Label>
                <Input id="maxTokens" {...form.register('maxTokens')} placeholder="1024" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="baseVersionId">Base version</Label>
              <Select id="baseVersionId" {...form.register('baseVersionId')}>
                <option value="">Latest / Active</option>
                {versions?.map((version) => (
                  <option key={version.id} value={version.id}>
                    v{version.versionNumber} {version.name ? `- ${version.name}` : ''}
                  </option>
                ))}
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="messages">Messages (JSON)</Label>
              <JsonEditorTextarea
                value={form.watch('messages')}
                onChange={(value) => form.setValue('messages', value)}
                rows={8}
              />
              {form.formState.errors.messages && (
                <p className="text-sm text-destructive">{form.formState.errors.messages.message}</p>
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createVersion.isPending}>
                {createVersion.isPending ? 'Creating...' : 'Create version'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}




