import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { CheckCircle2, RotateCcw, Trash } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { apiClient, extractData, ApiClientError, isFieldErrorDetails } from '@/lib/api-client';
import type { ProviderKey, CreateProviderKeyRequest, VerifyProviderKeyResponse, Provider } from '@/types';
import { formatDate } from '@/lib/utils';
import { useParams } from 'react-router-dom';

const providerSchema = z.object({
  provider: z.string().min(1, 'Provider is required.'),
  label: z.string().min(2, 'Label is required.'),
  apiKey: z.string().min(6, 'API key is required.'),
});

type ProviderForm = z.infer<typeof providerSchema>;

const providerOptions: Provider[] = ['OPENAI', 'ANTHROPIC', 'GOOGLE', 'AZURE_OPENAI', 'COHERE'];

export default function SettingsProviderKeysPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [confirmState, setConfirmState] = useState<{ id: string; action: 'rotate' | 'delete' } | null>(null);

  const form = useForm<ProviderForm>({
    resolver: zodResolver(providerSchema),
  });

  const { data: keys, isLoading } = useQuery({
    queryKey: ['provider-keys', workspaceId],
    queryFn: async () => {
      const response = await apiClient.get<ProviderKey[]>(
        `/workspaces/${workspaceId}/provider-keys`
      );
      return extractData(response);
    },
    enabled: !!workspaceId,
  });

  const createKey = useMutation({
    mutationFn: async (payload: CreateProviderKeyRequest) => {
      const response = await apiClient.post<ProviderKey>(
        `/workspaces/${workspaceId}/provider-keys`,
        payload
      );
      return extractData(response);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['provider-keys', workspaceId] });
      setIsCreateOpen(false);
      form.reset();
      toast.success('Provider key saved.');
    },
    onError: (error) => {
      if (error instanceof ApiClientError && isFieldErrorDetails(error.details)) {
        Object.entries(error.details).forEach(([key, messages]) => {
          form.setError(key as keyof ProviderForm, { message: messages?.[0] });
        });
      }
      toast.error(error instanceof Error ? error.message : 'Failed to save provider key.');
    },
  });

  const verifyKey = useMutation({
    mutationFn: async (keyId: string) => {
      const response = await apiClient.post<VerifyProviderKeyResponse>(
        `/workspaces/${workspaceId}/provider-keys/${keyId}/verify`
      );
      return extractData(response);
    },
    onSuccess: (data) => {
      toast.success(data.message);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Verification failed.');
    },
  });

  const rotateKey = useMutation({
    mutationFn: async (keyId: string) => {
      const response = await apiClient.post<ProviderKey>(
        `/workspaces/${workspaceId}/provider-keys/${keyId}/rotate`
      );
      return extractData(response);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['provider-keys', workspaceId] });
      toast.success('Provider key rotated.');
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Rotation failed.');
    },
  });

  const deleteKey = useMutation({
    mutationFn: async (keyId: string) => {
      const response = await apiClient.delete<{ success: boolean }>(
        `/workspaces/${workspaceId}/provider-keys/${keyId}`
      );
      return extractData(response);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['provider-keys', workspaceId] });
      toast.success('Provider key deleted.');
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Delete failed.');
    },
  });

  return (
    <div>
      <PageHeader
        title="Provider keys"
        description="Store provider credentials and verify connectivity."
        breadcrumbs={[
          { label: 'Dashboard', href: `/w/${workspaceId}/dashboard` },
          { label: 'Settings', href: `/w/${workspaceId}/settings/provider-keys` },
          { label: 'Provider Keys' },
        ]}
        actions={
          <Button onClick={() => setIsCreateOpen(true)}>
            Add provider
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Provider credentials</CardTitle>
          <CardDescription>Verify keys before production traffic.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-52 w-full" />
          ) : (
            <div className="space-y-3">
              {keys?.length ? (
                keys.map((key) => (
                  <div key={key.id} className="flex items-center justify-between rounded-lg border p-4">
                    <div>
                      <p className="font-medium">{key.label}</p>
                      <p className="text-sm text-muted-foreground">
                        {key.provider} · Prefix {key.keyPrefix}
                      </p>
                      <p className="text-xs text-muted-foreground">Created {formatDate(key.createdAt)}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => verifyKey.mutate(key.id)}>
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                        Verify
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setConfirmState({ id: key.id, action: 'rotate' })}
                      >
                        <RotateCcw className="h-4 w-4 mr-2" />
                        Rotate
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => setConfirmState({ id: key.id, action: 'delete' })}
                      >
                        <Trash className="h-4 w-4 mr-2" />
                        Delete
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No provider keys yet.</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add provider key</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={form.handleSubmit((data) =>
              createKey.mutate({
                provider: data.provider as Provider,
                label: data.label,
                apiKey: data.apiKey,
              })
            )}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="provider">Provider</Label>
              <Select id="provider" {...form.register('provider')}>
                <option value="">Select provider</option>
                {providerOptions.map((provider) => (
                  <option key={provider} value={provider}>
                    {provider}
                  </option>
                ))}
              </Select>
              {form.formState.errors.provider && (
                <p className="text-sm text-destructive">{form.formState.errors.provider.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="label">Label</Label>
              <Input id="label" {...form.register('label')} placeholder="OpenAI Production" />
              {form.formState.errors.label && (
                <p className="text-sm text-destructive">{form.formState.errors.label.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="apiKey">API key</Label>
              <Input id="apiKey" type="password" {...form.register('apiKey')} placeholder="sk-..." />
              {form.formState.errors.apiKey && (
                <p className="text-sm text-destructive">{form.formState.errors.apiKey.message}</p>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createKey.isPending}>
                {createKey.isPending ? 'Saving...' : 'Save'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!confirmState}
        title={confirmState?.action === 'delete' ? 'Delete provider key' : 'Rotate provider key'}
        description={
          confirmState?.action === 'delete'
            ? 'This key will be removed immediately.'
            : 'Rotation will replace the existing credential.'
        }
        confirmLabel={confirmState?.action === 'delete' ? 'Delete' : 'Rotate'}
        onConfirm={() => {
          if (!confirmState) return;
          if (confirmState.action === 'delete') {
            deleteKey.mutate(confirmState.id);
          } else {
            rotateKey.mutate(confirmState.id);
          }
          setConfirmState(null);
        }}
        onOpenChange={(open) => {
          if (!open) setConfirmState(null);
        }}
      />
    </div>
  );
}



