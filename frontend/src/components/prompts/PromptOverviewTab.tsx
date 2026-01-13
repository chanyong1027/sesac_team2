import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Play, Pause } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { Prompt, PromptStatus } from '@/types';
import { formatDate } from '@/lib/utils';
import { apiClient } from '@/lib/api-client';

interface PromptOverviewTabProps {
  prompt: Prompt;
}

export function PromptOverviewTab({ prompt }: PromptOverviewTabProps) {
  const { workspaceId } = useParams();
  const queryClient = useQueryClient();

  const updateStatusMutation = useMutation({
    mutationFn: async (status: PromptStatus) => {
      return apiClient.patch(`/workspaces/${workspaceId}/prompts/${prompt.id}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prompt', workspaceId, prompt.id] });
      queryClient.invalidateQueries({ queryKey: ['prompts', workspaceId] });
      toast.success('Status updated.');
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to update status.');
    },
  });

  const getStatusVariant = (status: PromptStatus) => {
    switch (status) {
      case 'ACTIVE':
        return 'success';
      case 'PAUSED':
        return 'secondary';
      case 'ARCHIVED':
        return 'outline';
      default:
        return 'default';
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Prompt summary</CardTitle>
          <CardDescription>Key details for the current prompt.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Prompt Key</p>
            <p className="mt-1 font-mono text-sm">{prompt.promptKey}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Status</p>
            <Badge variant={getStatusVariant(prompt.status)} className="mt-1">
              {prompt.status}
            </Badge>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Active Version</p>
            <p className="mt-1 text-sm">{prompt.activeVersionId || 'None'}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Last Updated</p>
            <p className="mt-1 text-sm">{formatDate(prompt.updatedAt)}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Status controls</CardTitle>
          <CardDescription>Pause or resume traffic quickly.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {prompt.status !== 'ACTIVE' && (
            <Button
              className="w-full"
              onClick={() => updateStatusMutation.mutate('ACTIVE')}
              disabled={updateStatusMutation.isPending}
            >
              <Play className="h-4 w-4 mr-2" />
              Activate
            </Button>
          )}
          {prompt.status === 'ACTIVE' && (
            <Button
              className="w-full"
              variant="secondary"
              onClick={() => updateStatusMutation.mutate('PAUSED')}
              disabled={updateStatusMutation.isPending}
            >
              <Pause className="h-4 w-4 mr-2" />
              Pause
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
