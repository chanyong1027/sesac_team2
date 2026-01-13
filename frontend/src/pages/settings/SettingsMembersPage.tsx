import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { UserPlus, Trash } from 'lucide-react';
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
import type { Member, InviteMemberRequest, UpdateMemberRoleRequest, MemberRole } from '@/types';
import { formatDate } from '@/lib/utils';
import { useParams } from 'react-router-dom';

const inviteSchema = z.object({
  email: z.string().email('Enter a valid email.'),
  role: z.string().min(1, 'Role is required.'),
});

type InviteForm = z.infer<typeof inviteSchema>;

const roles: MemberRole[] = ['OWNER', 'ADMIN', 'MEMBER', 'VIEWER'];

export default function SettingsMembersPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const queryClient = useQueryClient();
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [removeId, setRemoveId] = useState<string | null>(null);

  const form = useForm<InviteForm>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { role: 'MEMBER' },
  });

  const { data: members, isLoading } = useQuery({
    queryKey: ['members', workspaceId],
    queryFn: async () => {
      const response = await apiClient.get<Member[]>(
        `/workspaces/${workspaceId}/members`
      );
      return extractData(response);
    },
    enabled: !!workspaceId,
  });

  const inviteMember = useMutation({
    mutationFn: async (payload: InviteMemberRequest) => {
      const response = await apiClient.post<Member>(
        `/workspaces/${workspaceId}/members`,
        payload
      );
      return extractData(response);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members', workspaceId] });
      toast.success('Invitation sent.');
      setIsInviteOpen(false);
      form.reset({ role: 'MEMBER', email: '' });
    },
    onError: (error) => {
      if (error instanceof ApiClientError && isFieldErrorDetails(error.details)) {
        Object.entries(error.details).forEach(([key, messages]) => {
          form.setError(key as keyof InviteForm, { message: messages?.[0] });
        });
      }
      toast.error(error instanceof Error ? error.message : 'Failed to invite member.');
    },
  });

  const updateRole = useMutation({
    mutationFn: async ({ id, role }: { id: string; role: MemberRole }) => {
      const response = await apiClient.patch<Member>(
        `/workspaces/${workspaceId}/members/${id}`,
        { role } satisfies UpdateMemberRoleRequest
      );
      return extractData(response);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members', workspaceId] });
      toast.success('Role updated.');
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to update role.');
    },
  });

  const removeMember = useMutation({
    mutationFn: async (memberId: string) => {
      const response = await apiClient.delete<{ success: boolean }>(
        `/workspaces/${workspaceId}/members/${memberId}`
      );
      return extractData(response);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members', workspaceId] });
      toast.success('Member removed.');
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to remove member.');
    },
  });

  return (
    <div>
      <PageHeader
        title="Members"
        description="Invite teammates and manage roles."
        breadcrumbs={[
          { label: 'Dashboard', href: `/w/${workspaceId}/dashboard` },
          { label: 'Settings', href: `/w/${workspaceId}/settings/members` },
          { label: 'Members' },
        ]}
        actions={
          <Button onClick={() => setIsInviteOpen(true)}>
            <UserPlus className="h-4 w-4 mr-2" />
            Invite member
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Workspace members</CardTitle>
          <CardDescription>Roles control access to prompts and settings.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-52 w-full" />
          ) : (
            <div className="space-y-3">
              {members?.length ? (
                members.map((member) => (
                  <div key={member.id} className="flex flex-wrap items-center justify-between gap-4 rounded-lg border p-4">
                    <div>
                      <p className="font-medium">{member.user.name}</p>
                      <p className="text-sm text-muted-foreground">{member.user.email}</p>
                      <p className="text-xs text-muted-foreground">
                        Invited {formatDate(member.invitedAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Select
                        value={member.role}
                        onChange={(event) => updateRole.mutate({ id: member.id, role: event.target.value as MemberRole })}
                      >
                        {roles.map((role) => (
                          <option key={role} value={role}>
                            {role}
                          </option>
                        ))}
                      </Select>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => setRemoveId(member.id)}
                      >
                        <Trash className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No members yet.</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite member</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={form.handleSubmit((data) =>
              inviteMember.mutate({ email: data.email, role: data.role as MemberRole })
            )}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" {...form.register('email')} placeholder="teammate@company.com" />
              {form.formState.errors.email && (
                <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Select id="role" {...form.register('role')}>
                {roles.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </Select>
              {form.formState.errors.role && (
                <p className="text-sm text-destructive">{form.formState.errors.role.message}</p>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsInviteOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={inviteMember.isPending}>
                {inviteMember.isPending ? 'Sending...' : 'Send invite'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!removeId}
        title="Remove member"
        description="This user will lose access immediately."
        confirmLabel="Remove"
        onConfirm={() => {
          if (!removeId) return;
          removeMember.mutate(removeId);
          setRemoveId(null);
        }}
        onOpenChange={(open) => {
          if (!open) setRemoveId(null);
        }}
      />
    </div>
  );
}



