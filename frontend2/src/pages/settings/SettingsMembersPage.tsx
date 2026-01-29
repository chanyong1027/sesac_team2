import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { organizationApi } from '@/api/organization.api';
import type { OrganizationMemberResponse } from '@/types/api.types';

// ═══════════════════════════════════════════════════════════════════════════════
// MEMBERS SETTINGS PAGE - Light Theme
// ═══════════════════════════════════════════════════════════════════════════════

// TODO: 실제 orgId는 context나 URL에서 가져와야 함
const MOCK_ORG_ID = 1;

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
      className="inline-flex items-center px-2 py-0.5 text-[10px] uppercase tracking-wider font-medium"
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
        className="w-1.5 h-1.5 rounded-full"
        style={{ background: colors.text }}
      />
      <span className="text-[11px]" style={{ color: colors.text }}>
        {status}
      </span>
    </span>
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
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/20 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className="relative w-full max-w-sm mx-4 p-6"
        style={{
          background: '#FFFFFF',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.15)',
        }}
      >
        <h3
          className="text-lg font-medium text-neutral-900 mb-2"
          style={{ fontFamily: "'Newsreader', serif" }}
        >
          {title}
        </h3>
        <p className="text-sm text-neutral-500 mb-6">{message}</p>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 px-4 py-2.5 text-xs font-medium text-neutral-600 bg-neutral-100 hover:bg-neutral-200 transition-colors disabled:opacity-50"
          >
            취소
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className="flex-1 px-4 py-2.5 text-xs font-medium text-white transition-colors disabled:opacity-50"
            style={{ background: '#DC2626' }}
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

  // 멤버 목록 조회
  const { data: members, isLoading } = useQuery({
    queryKey: ['organization-members', MOCK_ORG_ID],
    queryFn: async () => {
      const response = await organizationApi.getMembers(MOCK_ORG_ID);
      return response.data;
    },
  });

  // 멤버 퇴출
  const removeMutation = useMutation({
    mutationFn: (memberId: number) =>
      organizationApi.removeMember(MOCK_ORG_ID, memberId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization-members'] });
      setMemberToRemove(null);
    },
  });

  return (
    <div>
      {/* Page Header */}
      <div className="mb-8">
        <h1
          className="text-2xl font-medium text-neutral-900 tracking-tight"
          style={{ fontFamily: "'Newsreader', serif" }}
        >
          멤버 관리
        </h1>
        <p className="text-sm text-neutral-500 mt-1">
          조직 멤버를 관리하고 역할을 설정합니다
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: '전체 멤버', value: members?.length || 0, accent: false },
          { label: '관리자', value: members?.filter(m => m.role === 'ADMIN' || m.role === 'OWNER').length || 0, accent: true },
          { label: '활성 멤버', value: members?.filter(m => m.status === 'ACTIVATE').length || 0, accent: false },
        ].map((stat, i) => (
          <div
            key={i}
            className="p-4"
            style={{
              background: '#FFFFFF',
              border: '1px solid #E5E5E5',
            }}
          >
            <p className="text-[10px] uppercase tracking-wider text-neutral-400 mb-1">
              {stat.label}
            </p>
            <p
              className="text-2xl font-light"
              style={{
                fontFamily: "'Newsreader', serif",
                color: stat.accent ? '#0D9488' : '#171717',
              }}
            >
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      {/* Members Table */}
      <div
        style={{
          background: '#FFFFFF',
          border: '1px solid #E5E5E5',
        }}
      >
        {/* Table Header */}
        <div
          className="grid grid-cols-12 gap-4 px-5 py-3 text-[10px] uppercase tracking-wider text-neutral-400"
          style={{ borderBottom: '1px solid #E5E5E5' }}
        >
          <div className="col-span-4">멤버</div>
          <div className="col-span-2">역할</div>
          <div className="col-span-2">상태</div>
          <div className="col-span-3">가입일</div>
          <div className="col-span-1"></div>
        </div>

        {/* Table Body */}
        {isLoading ? (
          <div className="px-5 py-12 text-center">
            <p className="text-sm text-neutral-400">멤버 목록을 불러오는 중...</p>
          </div>
        ) : members && members.length > 0 ? (
          <div>
            {members.map((member, idx) => (
              <div
                key={member.memberId}
                className="grid grid-cols-12 gap-4 px-5 py-4 items-center hover:bg-neutral-50 transition-colors group"
                style={{
                  borderBottom: idx < members.length - 1 ? '1px solid #F5F5F5' : 'none',
                }}
              >
                {/* Member Info */}
                <div className="col-span-4 flex items-center gap-3">
                  <div
                    className="w-8 h-8 flex items-center justify-center text-xs font-medium text-white shrink-0"
                    style={{ background: '#0D9488' }}
                  >
                    {member.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm text-neutral-900 font-medium truncate">
                      {member.name}
                    </p>
                    <p className="text-[11px] text-neutral-400 truncate">
                      {member.email}
                    </p>
                  </div>
                </div>

                {/* Role */}
                <div className="col-span-2">
                  <RoleBadge role={member.role} />
                </div>

                {/* Status */}
                <div className="col-span-2">
                  <StatusDot status={member.status} />
                </div>

                {/* Joined Date */}
                <div className="col-span-3">
                  <span className="text-xs text-neutral-500">
                    {new Date(member.joinedAt).toLocaleDateString('ko-KR', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>
                </div>

                {/* Actions */}
                <div className="col-span-1 flex justify-end">
                  {member.role !== 'OWNER' && (
                    <button
                      onClick={() => setMemberToRemove(member)}
                      className="opacity-0 group-hover:opacity-100 text-[11px] text-red-500 hover:text-red-700 transition-all"
                    >
                      퇴출
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="px-5 py-12 text-center">
            <p className="text-sm text-neutral-400">멤버가 없습니다</p>
          </div>
        )}
      </div>

      {/* Info Box */}
      <div
        className="mt-6 p-4 flex items-start gap-3"
        style={{
          background: '#F0FDFA',
          border: '1px solid #99F6E4',
        }}
      >
        <span className="text-teal-600 text-sm">ℹ</span>
        <div>
          <p className="text-xs text-teal-800 font-medium mb-0.5">
            멤버 초대하기
          </p>
          <p className="text-[11px] text-teal-600">
            새 멤버를 초대하려면 워크스페이스 상세 페이지에서 초대 링크를 생성하세요.
          </p>
        </div>
      </div>

      {/* Confirm Modal */}
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
    </div>
  );
}
