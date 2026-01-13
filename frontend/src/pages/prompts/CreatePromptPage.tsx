import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { apiClient, extractData, ApiClientError, isFieldErrorDetails } from '@/lib/api-client';
import type { CreatePromptRequest, Prompt } from '@/types';

const createPromptSchema = z.object({
  promptKey: z.string().min(3, 'Prompt key must be at least 3 characters.'),
  name: z.string().min(2, 'Name is required.'),
  description: z.string().optional(),
  tags: z.string().optional(),
});

type CreatePromptForm = z.infer<typeof createPromptSchema>;

export default function CreatePromptPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const form = useForm<CreatePromptForm>({
    resolver: zodResolver(createPromptSchema),
  });

  const createPrompt = useMutation({
    mutationFn: async (payload: CreatePromptRequest) => {
      const response = await apiClient.post<Prompt>(
        `/workspaces/${workspaceId}/prompts`,
        payload
      );
      return extractData(response);
    },
    onSuccess: (prompt) => {
      queryClient.invalidateQueries({ queryKey: ['prompts', workspaceId] });
      toast.success('Prompt created.');
      navigate(`/w/${workspaceId}/prompts/${prompt.id}`);
    },
    onError: (error) => {
      if (error instanceof ApiClientError && isFieldErrorDetails(error.details)) {
        Object.entries(error.details).forEach(([key, messages]) => {
          form.setError(key as keyof CreatePromptForm, { message: messages?.[0] });
        });
      }
      toast.error(error instanceof Error ? error.message : 'Failed to create prompt.');
    },
  });

  const handleSubmit = (data: CreatePromptForm) => {
    createPrompt.mutate({
      promptKey: data.promptKey,
      name: data.name,
      description: data.description || undefined,
      tags: data.tags ? data.tags.split(',').map((tag) => tag.trim()).filter(Boolean) : undefined,
    });
  };

  return (
    <div>
      <PageHeader
        title="Create prompt"
        description="Define a new PromptKey and metadata."
        breadcrumbs={[
          { label: 'Dashboard', href: `/w/${workspaceId}/dashboard` },
          { label: 'Prompts', href: `/w/${workspaceId}/prompts` },
          { label: 'New' },
        ]}
      />

      <Card>
        <CardHeader>
          <CardTitle>Prompt details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="promptKey">Prompt key</Label>
              <Input
                id="promptKey"
                placeholder="customer-support-bot"
                {...form.register('promptKey')}
              />
              {form.formState.errors.promptKey && (
                <p className="text-sm text-destructive">{form.formState.errors.promptKey.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" placeholder="Customer Support Bot" {...form.register('name')} />
              {form.formState.errors.name && (
                <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" rows={4} {...form.register('description')} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tags">Tags (comma-separated)</Label>
              <Input id="tags" placeholder="support, chat" {...form.register('tags')} />
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => navigate(-1)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createPrompt.isPending}>
                {createPrompt.isPending ? 'Creating...' : 'Create prompt'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}



