import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Plus, Building2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { apiClient, extractData, ApiClientError, isFieldErrorDetails } from '@/lib/api-client';
import { useWorkspace } from '@/hooks/useWorkspace';
import type { Workspace, CreateWorkspaceRequest } from '@/types';

const workspaceSchema = z.object({
  name: z.string().min(2, 'Workspace name must be at least 2 characters.'),
  slug: z.string().optional(),
});

type WorkspaceForm = z.infer<typeof workspaceSchema>;

export default function WorkspacesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { setWorkspaceId } = useWorkspace();
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const { data: workspaces, isLoading } = useQuery({
    queryKey: ['workspaces'],
    queryFn: async () => {
      const response = await apiClient.get<Workspace[]>('/workspaces');
      return extractData(response);
    },
  });

  const form = useForm<WorkspaceForm>({
    resolver: zodResolver(workspaceSchema),
  });

  const createWorkspace = useMutation({
    mutationFn: async (payload: CreateWorkspaceRequest) => {
      const response = await apiClient.post<Workspace>('/workspaces', payload);
      return extractData(response);
    },
    onSuccess: (workspace) => {
      queryClient.invalidateQueries({ queryKey: ['workspaces'] });
      setIsCreateOpen(false);
      form.reset();
      toast.success('Workspace created.');
      setWorkspaceId(workspace.id);
      navigate(`/w/${workspace.id}/dashboard`);
    },
    onError: (error) => {
      if (error instanceof ApiClientError && isFieldErrorDetails(error.details)) {
        Object.entries(error.details).forEach(([key, messages]) => {
          form.setError(key as keyof WorkspaceForm, { message: messages?.[0] });
        });
      }
      toast.error(error instanceof Error ? error.message : 'Failed to create workspace.');
    },
  });

  const handleSelectWorkspace = (workspaceId: string) => {
    setWorkspaceId(workspaceId);
    navigate(`/w/${workspaceId}/dashboard`);
  };

  return (
    <div>
      <PageHeader
        title="Workspaces"
        description="Choose a workspace to manage prompts and traffic."
        actions={
          <Button onClick={() => setIsCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New workspace
          </Button>
        }
      />

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[...Array(4)].map((_, index) => (
            <Skeleton key={index} className="h-32 w-full" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {(workspaces || []).map((workspace) => (
            <Card
              key={workspace.id}
              className="cursor-pointer transition hover:border-primary/40"
              onClick={() => handleSelectWorkspace(workspace.id)}
            >
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  {workspace.name}
                </CardTitle>
                <CardDescription>{workspace.slug}</CardDescription>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Role: {workspace.role || 'MEMBER'}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create workspace</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={form.handleSubmit((data) => createWorkspace.mutate(data))}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="name">Workspace name</Label>
              <Input id="name" {...form.register('name')} placeholder="PromptOps Team" />
              {form.formState.errors.name && (
                <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="slug">Slug (optional)</Label>
              <Input id="slug" {...form.register('slug')} placeholder="promptops-team" />
              {form.formState.errors.slug && (
                <p className="text-sm text-destructive">{form.formState.errors.slug.message}</p>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createWorkspace.isPending}>
                {createWorkspace.isPending ? 'Creating...' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}



