import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { organizationApi } from '@/api/organization.api';
import { workspaceApi } from '@/api/workspace.api';
import type { OrganizationMemberResponse } from '@/types/api.types';
import { useOrganizationStore } from '@/features/organization/store/organizationStore';
import { useWorkspaces } from '@/features/workspace/hooks/useWorkspaces';
import { User, Shield, Info, Link as LinkIcon, Check, Copy, AlertCircle } from 'lucide-react';

const roleColors: Record<string, { bg: string; text: string; border: string }> = {
  OWNER: { bg: '#FEF3C7', text: '#92400E', border: '#FCD34D' },
  ADMIN: { bg: '#DBEAFE', text: '#1E40AF', border: '#93C5FD' },
  MEMBER: { bg: '#F3F4F6', text: '#374151', border: '#D1D5DB' },
};

const statusColors: Record<string, { bg: string; text: string }> = {
  ACTIVATE: { bg: '#D1FAE5', text: '#065F46' },
  INACTIVE: { bg: '#FEE2E2', text: '#991B1B' },
  PENDING: { bg: '#FEF3C7', text: '#92400E' },
};

function RoleBadge({ role }: { role: string }) {
  const colors = roleColors[role] || roleColors.MEMBER;
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 text-[10px] uppercase tracking-wider font-medium rounded-full"
      style={{
        background: colors.bg,
        color: colors.text,
        border: `1px solid ${colors.border}`,
      }}
    >
      {role}
    </span>
  );
}

function StatusDot({ status }: { status: string }) {
  const colors = statusColors[status] || statusColors.INACTIVE;
  return (
    <span className="flex items-center gap-1.5">
      <span
        className="w-2 h-2 rounded-full"
        style={{ background: colors.text }}
      />
      <span className="text-xs font-medium text-gray-600">
        {status}
      </span>
    </span>
  );
}

function InviteMemberModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<number | null>(null);
  const [invitationLink, setInvitationLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // 워크스페이스 목록 조회
  const { data: workspaces, isLoading: isWorkspacesLoading } = useWorkspaces();

  const inviteMutation = useMutation({
    mutationFn: (workspaceId: number) =>
      workspaceApi.createInvitation(workspaceId, { role: 'MEMBER' }),
    onSuccess: (response) => {
      setInvitationLink(response.data.invitationUrl);
    },
  });

  const handleCreateLink = () => {
    if (selectedWorkspaceId) {
      inviteMutation.mutate(selectedWorkspaceId);
    }
  };

  const handleCopy = () => {
    if (invitationLink) {
      navigator.clipboard.writeText(invitationLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const resetAndClose = () => {
    setInvitationLink(null);
    setSelectedWorkspaceId(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={resetAndClose}
      />
      <div className="relative w-full max-w-md mx-4 p-6 bg-white rounded-xl shadow-xl border border-gray-100">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          멤버 초대
        </h3>
        <p className="text-sm text-gray-500 mb-6">
          워크스페이스 초대 링크를 생성하여 멤버를 초대합니다.
        </p>

        {!invitationLink ? (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                워크스페이스 선택
              </label>
              {isWorkspacesLoading ? (
                <div className="h-10 bg-gray-100 rounded animate-pulse" />
              ) : workspaces && workspaces.length > 0 ? (
                <select
                  value={selectedWorkspaceId || ''}
                  onChange={(e) => setSelectedWorkspaceId(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm text-gray-900 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                >
                  <option value="" disabled>워크스페이스를 선택하세요</option>
                  {workspaces.map((ws) => (
                    <option key={ws.id} value={ws.id}>
                      {ws.displayName}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="p-3 bg-amber-50 text-amber-700 text-sm rounded-lg flex items-start gap-2">
                  <AlertCircle size={16} className="mt-0.5 shrink-0" />
                  <p>초대 가능한 워크스페이스가 없습니다. 먼저 워크스페이스를 생성해주세요.</p>
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={resetAndClose}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleCreateLink}
                disabled={!selectedWorkspaceId || inviteMutation.isPending}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
              >
                {inviteMutation.isPending ? '생성 중...' : '초대 링크 생성'}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-4 bg-green-50 text-green-800 rounded-lg flex items-center gap-2 text-sm">
              <Check size={16} />
              <span>초대 링크가 생성되었습니다!</span>
            </div>

            <div className="relative">
              <input
                type="text"
                readOnly
                value={invitationLink}
                className="w-full px-4 py-3 text-sm bg-gray-50 border border-gray-200 rounded-lg text-gray-600 pr-12 focus:outline-none"
              />
              <button
                onClick={handleCopy}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-indigo-600 transition-colors rounded-md hover:bg-indigo-50"
                title="복사"
              >
                {copied ? <Check size={16} /> : <Copy size={16} />}
              </button>
            </div>

            <p className="text-xs text-gray-500 text-center">
              이 링크를 멤버에게 전달하세요. 7일 동안 유효합니다.
            </p>

            <button
              onClick={resetAndClose}
              className="w-full mt-2 px-4 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
            >
              닫기
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = '확인',
  isLoading = false,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  isLoading?: boolean;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-sm mx-4 p-6 bg-white rounded-xl shadow-xl border border-gray-100">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          {title}
        </h3>
        <p className="text-sm text-gray-500 mb-6">{message}</p>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            취소
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
          >
            {isLoading ? '처리 중...' : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

export function SettingsMembersPage() {
  const queryClient = useQueryClient();
  const [memberToRemove, setMemberToRemove] = useState<OrganizationMemberResponse | null>(null);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const { currentOrgId } = useOrganizationStore();

  const { data: members, isLoading } = useQuery({
    queryKey: ['organization-members', currentOrgId],
    queryFn: async () => {
      if (!currentOrgId) return [];
      const response = await organizationApi.getMembers(currentOrgId);
      return response.data;
    },
    enabled: !!currentOrgId,
  });

  const removeMutation = useMutation({
    mutationFn: (memberId: number) => {
      if (!currentOrgId) throw new Error("No organization selected");
      return organizationApi.removeMember(currentOrgId, memberId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization-members'] });
      setMemberToRemove(null);
    },
  });

  if (!currentOrgId) return <div>조직을 선택해주세요.</div>;

  return (
    <div>
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
            멤버 관리
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            조직 멤버를 관리하고 역할을 설정합니다.
          </p>
        </div>
        <button
          onClick={() => setIsInviteModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
        >
          <LinkIcon size={16} />
          멤버 초대
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {[
          { label: '전체 멤버', value: members?.length || 0, icon: User },
          { label: '관리자', value: members?.filter(m => m.role === 'ADMIN' || m.role === 'OWNER').length || 0, icon: Shield },
          { label: '활성 멤버', value: members?.filter(m => m.status === 'ACTIVATE').length || 0, icon: User },
        ].map((stat, i) => (
          <div
            key={i}
            className="p-5 bg-white border border-gray-200 rounded-xl shadow-sm"
          >
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                {stat.label}
              </p>
              <stat.icon size={16} className="text-gray-400" />
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="grid grid-cols-12 gap-4 px-6 py-3 bg-gray-50 border-b border-gray-200 text-xs font-medium text-gray-500 uppercase tracking-wider">
          <div className="col-span-4">멤버</div>
          <div className="col-span-2">역할</div>
          <div className="col-span-2">상태</div>
          <div className="col-span-3">가입일</div>
          <div className="col-span-1"></div>
        </div>

        {isLoading ? (
          <div className="px-6 py-12 text-center text-sm text-gray-500">
            멤버 목록을 불러오는 중...
          </div>
        ) : members && members.length > 0 ? (
          <div className="divide-y divide-gray-100">
            {members.map((member) => (
              <div
                key={member.memberId}
                className="grid grid-cols-12 gap-4 px-6 py-4 items-center hover:bg-gray-50 transition-colors group"
              >
                <div className="col-span-4 flex items-center gap-3">
                  <div className="w-9 h-9 flex items-center justify-center text-sm font-bold text-white bg-indigo-500 rounded-full shrink-0 shadow-sm">
                    {member.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {member.name}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      {member.email}
                    </p>
                  </div>
                </div>

                <div className="col-span-2">
                  <RoleBadge role={member.role} />
                </div>

                <div className="col-span-2">
                  <StatusDot status={member.status} />
                </div>

                <div className="col-span-3">
                  <span className="text-sm text-gray-500">
                    {new Date(member.joinedAt).toLocaleDateString('ko-KR', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </span>
                </div>

                <div className="col-span-1 flex justify-end">
                  {member.role !== 'OWNER' && (
                    <button
                      onClick={() => setMemberToRemove(member)}
                      className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-all"
                      title="퇴출"
                    >
                      <User size={16} className="rotate-45" />
                      <span className="sr-only">퇴출</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="px-6 py-12 text-center text-sm text-gray-500">
            멤버가 없습니다.
          </div>
        )}
      </div>

      <div className="mt-6 p-4 flex items-start gap-3 bg-indigo-50 border border-indigo-100 rounded-lg">
        <Info size={18} className="text-indigo-600 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-indigo-900 mb-0.5">
            멤버 초대하기
          </p>
          <p className="text-xs text-indigo-700">
            상단의 '멤버 초대' 버튼을 클릭하여 워크스페이스 초대 링크를 생성할 수 있습니다.
          </p>
        </div>
      </div>

      <ConfirmModal
        isOpen={!!memberToRemove}
        onClose={() => setMemberToRemove(null)}
        onConfirm={() => {
          if (memberToRemove) {
            removeMutation.mutate(memberToRemove.memberId);
          }
        }}
        title="멤버 퇴출"
        message={`${memberToRemove?.name}님을 조직에서 퇴출하시겠습니까? 이 작업은 되돌릴 수 없습니다.`}
        confirmText="퇴출"
        isLoading={removeMutation.isPending}
      />

      <InviteMemberModal
        isOpen={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
      />
    </div>
  );
}
