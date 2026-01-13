import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { Rocket, RotateCcw } from 'lucide-react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { apiClient, extractData, ApiClientError, isFieldErrorDetails } from '@/lib/api-client';
import type { Prompt, PromptVersion, Release, ReleaseRequest, RollbackRequest } from '@/types';
import { formatDate } from '@/lib/utils';

interface PromptReleaseTabProps {
  prompt: Prompt;
}

const releaseSchema = z.object({
  versionId: z.string().min(1, 'Select a version.'),
  reason: z.string().min(1, 'Reason is required.'),
  referenceLinks: z.string().optional(),
});

const rollbackSchema = z.object({
  targetVersionId: z.string().min(1, 'Select a version.'),
  reason: z.string().min(1, 'Reason is required.'),
  referenceLinks: z.string().optional(),
});

type ReleaseForm = z.infer<typeof releaseSchema>;

type RollbackForm = z.infer<typeof rollbackSchema>;

export function PromptReleaseTab({ prompt }: PromptReleaseTabProps) {
  const { workspaceId, promptId } = useParams();
  const queryClient = useQueryClient();
  const [isReleaseOpen, setIsReleaseOpen] = useState(false);
  const [isRollbackOpen, setIsRollbackOpen] = useState(false);

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

  const { data: currentRelease, isLoading: releaseLoading } = useQuery({
    queryKey: ['prompt-release', workspaceId, promptId],
    queryFn: async () => {
      const response = await apiClient.get<Release | null>(
        `/workspaces/${workspaceId}/prompts/${promptId}/release`
      );
      return extractData(response);
    },
    enabled: !!workspaceId && !!promptId,
  });

  const { data: releaseHistory, isLoading: historyLoading } = useQuery({
    queryKey: ['prompt-release-history', workspaceId, promptId],
    queryFn: async () => {
      const response = await apiClient.get<Release[]>(
        `/workspaces/${workspaceId}/prompts/${promptId}/release-history`
      );
      return extractData(response);
    },
    enabled: !!workspaceId && !!promptId,
  });

  const releaseForm = useForm<ReleaseForm>({
    resolver: zodResolver(releaseSchema),
  });

  const rollbackForm = useForm<RollbackForm>({
    resolver: zodResolver(rollbackSchema),
  });

  const releaseMutation = useMutation({
    mutationFn: async (payload: ReleaseRequest) => {
      const response = await apiClient.post<Release>(
        `/workspaces/${workspaceId}/prompts/${promptId}/release`,
        payload
      );
      return extractData(response);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prompt-release', workspaceId, promptId] });
      queryClient.invalidateQueries({ queryKey: ['prompt-release-history', workspaceId, promptId] });
      toast.success('Release completed.');
      setIsReleaseOpen(false);
      releaseForm.reset();
    },
    onError: (error) => {
      if (error instanceof ApiClientError && isFieldErrorDetails(error.details)) {
        Object.entries(error.details).forEach(([key, messages]) => {
          releaseForm.setError(key as keyof ReleaseForm, { message: messages?.[0] });
        });
      }
      toast.error(error instanceof Error ? error.message : 'Release failed.');
    },
  });

  const rollbackMutation = useMutation({
    mutationFn: async (payload: RollbackRequest) => {
      const response = await apiClient.post<Release>(
        `/workspaces/${workspaceId}/prompts/${promptId}/rollback`,
        payload
      );
      return extractData(response);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prompt-release', workspaceId, promptId] });
      queryClient.invalidateQueries({ queryKey: ['prompt-release-history', workspaceId, promptId] });
      toast.success('Rollback completed.');
      setIsRollbackOpen(false);
      rollbackForm.reset();
    },
    onError: (error) => {
      if (error instanceof ApiClientError && isFieldErrorDetails(error.details)) {
        Object.entries(error.details).forEach(([key, messages]) => {
          rollbackForm.setError(key as keyof RollbackForm, { message: messages?.[0] });
        });
      }
      toast.error(error instanceof Error ? error.message : 'Rollback failed.');
    },
  });

  const handleRelease = (data: ReleaseForm) => {
    releaseMutation.mutate({
      versionId: data.versionId,
      reason: data.reason,
      referenceLinks: data.referenceLinks
        ? data.referenceLinks.split('\n').filter(Boolean)
        : undefined,
    });
  };

  const handleRollback = (data: RollbackForm) => {
    rollbackMutation.mutate({
      targetVersionId: data.targetVersionId,
      reason: data.reason,
      referenceLinks: data.referenceLinks
        ? data.referenceLinks.split('\n').filter(Boolean)
        : undefined,
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Current release</CardTitle>
              <CardDescription>Active release snapshot.</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => setIsReleaseOpen(true)}>
                <Rocket className="h-4 w-4 mr-2" />
                Release
              </Button>
              <Button variant="outline" onClick={() => setIsRollbackOpen(true)}>
                <RotateCcw className="h-4 w-4 mr-2" />
                Rollback
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {releaseLoading ? (
            <Skeleton className="h-20 w-full" />
          ) : currentRelease ? (
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <p className="text-sm text-muted-foreground">Version</p>
                <p className="font-mono">{currentRelease.versionId}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Released at</p>
                <p>{formatDate(currentRelease.releasedAt)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Released by</p>
                <p>{currentRelease.releasedBy || 'System'}</p>
              </div>
              <div className="md:col-span-3">
                <p className="text-sm text-muted-foreground">Reason</p>
                <p>{currentRelease.reason}</p>
              </div>
              {currentRelease.referenceLinks && currentRelease.referenceLinks.length > 0 && (
                <div className="md:col-span-3">
                  <p className="text-sm text-muted-foreground">Reference links</p>
                  <div className="space-y-1">
                    {currentRelease.referenceLinks.map((link) => (
                      <a key={link} href={link} className="text-sm text-primary" target="_blank" rel="noreferrer">
                        {link}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No active release.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Release history</CardTitle>
          <CardDescription>Track releases for {prompt.promptKey}.</CardDescription>
        </CardHeader>
        <CardContent>
          {historyLoading ? (
            <Skeleton className="h-52 w-full" />
          ) : (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Version</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Released by</TableHead>
                    <TableHead>Released at</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {releaseHistory && releaseHistory.length > 0 ? (
                    releaseHistory.map((release) => (
                      <TableRow key={release.id}>
                        <TableCell className="font-mono">
                          {release.versionId}
                          {release.id === currentRelease?.id && (
                            <Badge variant="success" className="ml-2 text-xs">
                              Active
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="max-w-xs truncate">{release.reason}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {release.releasedBy || 'System'}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(release.releasedAt)}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                        No releases yet.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isReleaseOpen} onOpenChange={setIsReleaseOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Release new version</DialogTitle>
            <DialogDescription>Promote a version to active traffic.</DialogDescription>
          </DialogHeader>
          <form onSubmit={releaseForm.handleSubmit(handleRelease)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="versionId">Version</Label>
              <Select id="versionId" {...releaseForm.register('versionId')}>
                <option value="">Select version</option>
                {versions?.map((version) => (
                  <option key={version.id} value={version.id}>
                    v{version.versionNumber} {version.name ? `- ${version.name}` : ''}
                  </option>
                ))}
              </Select>
              {releaseForm.formState.errors.versionId && (
                <p className="text-sm text-destructive">{releaseForm.formState.errors.versionId.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="reason">Reason</Label>
              <Textarea id="reason" rows={3} {...releaseForm.register('reason')} />
              {releaseForm.formState.errors.reason && (
                <p className="text-sm text-destructive">{releaseForm.formState.errors.reason.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="referenceLinks">Reference links (one per line)</Label>
              <Textarea id="referenceLinks" rows={3} {...releaseForm.register('referenceLinks')} />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsReleaseOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={releaseMutation.isPending}>
                {releaseMutation.isPending ? 'Releasing...' : 'Release'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isRollbackOpen} onOpenChange={setIsRollbackOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rollback release</DialogTitle>
            <DialogDescription>Revert traffic to a previous version.</DialogDescription>
          </DialogHeader>
          <form onSubmit={rollbackForm.handleSubmit(handleRollback)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="targetVersionId">Target version</Label>
              <Select id="targetVersionId" {...rollbackForm.register('targetVersionId')}>
                <option value="">Select version</option>
                {versions?.map((version) => (
                  <option key={version.id} value={version.id}>
                    v{version.versionNumber} {version.name ? `- ${version.name}` : ''}
                  </option>
                ))}
              </Select>
              {rollbackForm.formState.errors.targetVersionId && (
                <p className="text-sm text-destructive">{rollbackForm.formState.errors.targetVersionId.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="rollbackReason">Reason</Label>
              <Textarea id="rollbackReason" rows={3} {...rollbackForm.register('reason')} />
              {rollbackForm.formState.errors.reason && (
                <p className="text-sm text-destructive">{rollbackForm.formState.errors.reason.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="rollbackLinks">Reference links (one per line)</Label>
              <Textarea id="rollbackLinks" rows={3} {...rollbackForm.register('referenceLinks')} />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsRollbackOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="destructive" disabled={rollbackMutation.isPending}>
                {rollbackMutation.isPending ? 'Rolling back...' : 'Rollback'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}



