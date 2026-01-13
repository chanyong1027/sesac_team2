import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Copy, RotateCcw, Trash } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { apiClient, extractData, ApiClientError, isFieldErrorDetails } from '@/lib/api-client';
import type { GatewayApiKey, CreateGatewayApiKeyRequest, CreateGatewayApiKeyResponse } from '@/types';
import { copyToClipboard, formatDate } from '@/lib/utils';
import { useParams } from 'react-router-dom';

const keySchema = z.object({
  name: z.string().min(2, 'Name is required.'),
});

type KeyForm = z.infer<typeof keySchema>;

export default function SettingsApiKeysPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [confirmState, setConfirmState] = useState<{ id: string; action: 'rotate' | 'delete' } | null>(null);

  const form = useForm<KeyForm>({
    resolver: zodResolver(keySchema),
  });

  const { data: keys, isLoading } = useQuery({
    queryKey: ['gateway-keys', workspaceId],
    queryFn: async () => {
      const response = await apiClient.get<GatewayApiKey[]>(
        `/workspaces/${workspaceId}/gateway-api-keys`
      );
      return extractData(response);
    },
    enabled: !!workspaceId,
  });

  const createKey = useMutation({
    mutationFn: async (payload: CreateGatewayApiKeyRequest) => {
      const response = await apiClient.post<CreateGatewayApiKeyResponse>(
        `/workspaces/${workspaceId}/gateway-api-keys`,
        payload
      );
      return extractData(response);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['gateway-keys', workspaceId] });
      setIsCreateOpen(false);
      form.reset();
      setRevealedKey(data.apiKey);
      toast.success('API key created.');
    },
    onError: (error) => {
      if (error instanceof ApiClientError && isFieldErrorDetails(error.details)) {
        Object.entries(error.details).forEach(([key, messages]) => {
          form.setError(key as keyof KeyForm, { message: messages?.[0] });
        });
      }
      toast.error(error instanceof Error ? error.message : 'Failed to create key.');
    },
  });

  const rotateKey = useMutation({
    mutationFn: async (keyId: string) => {
      const response = await apiClient.post<CreateGatewayApiKeyResponse>(
        `/workspaces/${workspaceId}/gateway-api-keys/${keyId}/rotate`
      );
      return extractData(response);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['gateway-keys', workspaceId] });
      setRevealedKey(data.apiKey);
      toast.success('API key rotated.');
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to rotate key.');
    },
  });

  const deleteKey = useMutation({
    mutationFn: async (keyId: string) => {
      const response = await apiClient.delete<{ success: boolean }>(
        `/workspaces/${workspaceId}/gateway-api-keys/${keyId}`
      );
      return extractData(response);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gateway-keys', workspaceId] });
      toast.success('API key deleted.');
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to delete key.');
    },
  });

  return (
    <div>
      <PageHeader
        title="Gateway API keys"
        description="Manage API keys used by gateway clients."
        breadcrumbs={[
          { label: 'Dashboard', href: `/w/${workspaceId}/dashboard` },
          { label: 'Settings', href: `/w/${workspaceId}/settings/api-keys` },
          { label: 'API Keys' },
        ]}
        actions={
          <Button onClick={() => setIsCreateOpen(true)}>
            Create key
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Active keys</CardTitle>
          <CardDescription>Keys are only shown once at creation or rotation.</CardDescription>
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
                      <p className="font-medium">{key.name}</p>
                      <p className="text-sm text-muted-foreground">Prefix: {key.keyPrefix}</p>
                      <p className="text-xs text-muted-foreground">Created {formatDate(key.createdAt)}</p>
                    </div>
                    <div className="flex gap-2">
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
                <p className="text-sm text-muted-foreground">No API keys yet.</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create API key</DialogTitle>
          </DialogHeader>
          <form onSubmit={form.handleSubmit((data) => createKey.mutate(data))} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Key name</Label>
              <Input id="name" {...form.register('name')} placeholder="Gateway Production" />
              {form.formState.errors.name && (
                <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createKey.isPending}>
                {createKey.isPending ? 'Creating...' : 'Create key'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!revealedKey} onOpenChange={() => setRevealedKey(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>API key created</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Copy this key now</Label>
            <div className="flex items-center gap-2">
              <Input value={revealedKey || ''} readOnly />
              <Button variant="outline" onClick={() => copyToClipboard(revealedKey || '')}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!confirmState}
        title={confirmState?.action === 'delete' ? 'Delete API key' : 'Rotate API key'}
        description={
          confirmState?.action === 'delete'
            ? 'This key will stop working immediately.'
            : 'A new key will be issued and the old one will be revoked.'
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



