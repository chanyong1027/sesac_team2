import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { organizationApi } from '@/api/organization.api';
import { workspaceApi } from '@/api/workspace.api';
import { useWorkspaces } from '@/features/workspace/hooks/useWorkspaces';
import { useOrganizationStore } from '@/features/organization/store/organizationStore';
import type { OrganizationApiKeySummaryResponse, OrganizationMemberResponse } from '@/types/api.types';
import { AlertCircle, Check, Copy, Download, Key, Plus, RefreshCw, Search, Shield, UserPlus } from 'lucide-react';

function formatRelativeKorean(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

function downloadCsv(filename: string, rows: Array<Record<string, string | number | null | undefined>>) {
  const headers = Object.keys(rows[0] ?? {});
  const escape = (value: unknown) => {
    const s = String(value ?? '');
    // CSV injection mitigation + quoting
    const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
    return `"${safe.replaceAll('"', '""')}"`;
  };
  const csv = [headers.join(','), ...rows.map((r) => headers.map((h) => escape(r[h])).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function RoleBadge({ role }: { role: string }) {
  const base = 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border';
  if (role === 'OWNER') return <span className={`${base} bg-[color:rgba(146,19,236,0.12)] text-[var(--primary)] border-[color:rgba(146,19,236,0.25)]`}>소유자</span>;
  if (role === 'ADMIN') return <span className={`${base} bg-[color:rgba(59,130,246,0.12)] text-blue-200 border-[color:rgba(59,130,246,0.25)]`}>관리자</span>;
  return <span className={`${base} bg-[color:rgba(255,255,255,0.06)] text-gray-200 border-[color:rgba(255,255,255,0.10)]`}>멤버</span>;
}

function StatusDot({ status }: { status: string }) {
  const color =
    status === 'ACTIVE' ? 'bg-green-500' : status === 'DELETED' ? 'bg-red-500' : 'bg-gray-500';
  const label = status === 'ACTIVE' ? 'Active' : status === 'DELETED' ? 'Deleted' : status;
  return (
    <span className="flex items-center gap-2">
      <span className={`size-2 rounded-full ${color}`} />
      <span className="text-sm text-gray-300">{label}</span>
    </span>
  );
}

function InviteMemberModal({
  orgId,
  isOpen,
  onClose,
}: {
  orgId: number;
  isOpen: boolean;
  onClose: () => void;
}) {
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<number | null>(null);
  const [invitationLink, setInvitationLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const { data: workspaces, isLoading } = useWorkspaces();
  const available = workspaces?.filter((ws) => ws.organizationId === orgId) ?? [];

  const inviteMutation = useMutation({
    mutationFn: (workspaceId: number) => workspaceApi.createInvitation(workspaceId, { role: 'MEMBER' }),
    onSuccess: (response) => setInvitationLink(response.data.invitationUrl),
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Close modal overlay"
      />
      <div className="relative w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-xl">
        <div className="p-6 border-b border-[var(--border)]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-lg bg-[color:rgba(146,19,236,0.18)] text-[var(--primary)] flex items-center justify-center">
                <UserPlus size={18} />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">멤버 초대</h3>
                <p className="text-sm text-gray-400">워크스페이스 초대 링크를 생성합니다.</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg text-gray-300 hover:bg-[color:rgba(255,255,255,0.06)]"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {!invitationLink ? (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-2">
                  워크스페이스 선택
                </label>
                {isLoading ? (
                  <div className="h-10 rounded-lg bg-[color:rgba(255,255,255,0.06)] animate-pulse" />
                ) : (
                  <select
                    value={selectedWorkspaceId ?? ''}
                    onChange={(e) => setSelectedWorkspaceId(e.target.value ? Number(e.target.value) : null)}
                    className="w-full h-10 px-3 rounded-lg bg-[color:rgba(255,255,255,0.04)] border border-[color:rgba(255,255,255,0.10)] text-sm text-white focus:outline-none focus:ring-2 focus:ring-[color:rgba(146,19,236,0.35)]"
                  >
                    <option value="" className="bg-[#1a1a2e] text-gray-300">선택하세요</option>
                    {available.map((ws) => (
                      <option key={ws.id} value={ws.id} className="bg-[#1a1a2e] text-white">
                        {ws.displayName}
                      </option>
                    ))}
                  </select>
                )}
                <p className="mt-2 text-xs text-gray-500">
                  초대 링크는 선택한 워크스페이스의 멤버 권한으로 발급됩니다.
                </p>
              </div>

              <button
                type="button"
                disabled={!selectedWorkspaceId || inviteMutation.isPending}
                onClick={() => selectedWorkspaceId && inviteMutation.mutate(selectedWorkspaceId)}
                className="w-full h-10 rounded-lg bg-[var(--primary)] hover:opacity-90 disabled:opacity-50 text-white text-sm font-medium"
              >
                {inviteMutation.isPending ? '생성 중...' : '초대 링크 생성'}
              </button>

              {inviteMutation.isError ? (
                <div className="text-sm text-rose-200 bg-rose-500/10 border border-rose-500/20 rounded-lg p-3">
                  초대 링크 생성에 실패했습니다. 다시 시도해주세요.
                </div>
              ) : null}
            </>
          ) : (
            <>
              <div className="text-sm text-gray-300">
                아래 링크를 공유하세요. (만료/정책은 서버 설정에 따릅니다)
              </div>
              <div className="relative rounded-lg border border-[var(--border)] bg-[color:rgba(0,0,0,0.25)] p-3">
                <code className="text-xs text-green-300 break-all block pr-10">{invitationLink}</code>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(invitationLink);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  }}
                  className="absolute top-2 right-2 p-2 rounded-lg text-gray-300 hover:bg-[color:rgba(255,255,255,0.06)]"
                  title="Copy"
                >
                  {copied ? <Check size={16} /> : <Copy size={16} />}
                </button>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-full h-10 rounded-lg bg-[color:rgba(255,255,255,0.06)] hover:bg-[color:rgba(255,255,255,0.10)] border border-[color:rgba(255,255,255,0.10)] text-white text-sm font-medium"
              >
                닫기
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ApiKeyRow({
  apiKey,
  onRotate,
}: {
  apiKey: OrganizationApiKeySummaryResponse;
  onRotate: (id: number, name: string) => void;
}) {
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-lg bg-[color:rgba(255,255,255,0.04)] border border-[color:rgba(146,19,236,0.25)] relative overflow-hidden">
      <div className="absolute inset-y-0 left-0 w-1 bg-[var(--primary)]" />
      <div className="flex items-center gap-4">
        <div className="p-2 rounded-lg bg-[color:rgba(146,19,236,0.12)] text-[var(--primary)]">
          <Key size={18} />
        </div>
        <div className="flex flex-col gap-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-white truncate">{apiKey.name}</span>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-green-500/20 text-green-300 border border-green-500/20">
              {apiKey.status}
            </span>
          </div>
          <div className="font-mono text-sm text-gray-400 tracking-wider truncate">
            {apiKey.keyPrefix}...
          </div>
          <div className="text-xs text-gray-500">
            lastUsed: {apiKey.lastUsedAt ? formatRelativeKorean(apiKey.lastUsedAt) : '-'}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onRotate(apiKey.id, apiKey.name)}
          className="px-3 py-2 rounded-lg bg-[color:rgba(255,255,255,0.06)] hover:bg-[color:rgba(255,255,255,0.10)] border border-[color:rgba(255,255,255,0.10)] text-white text-sm font-medium"
          title="Rotate"
        >
          <RefreshCw size={16} />
        </button>
      </div>
    </div>
  );
}

export function OrganizationSecurityPage() {
  const { orgId: orgIdParam } = useParams<{ orgId: string }>();
  const { currentOrgId } = useOrganizationStore();
  const orgId = orgIdParam ? Number(orgIdParam) : currentOrgId ?? null;
  const queryClient = useQueryClient();

  const [inviteOpen, setInviteOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'OWNER' | 'ADMIN' | 'MEMBER'>('ALL');

  const { data: members, isLoading: isMembersLoading, isError: isMembersError } = useQuery({
    queryKey: ['org-members', orgId],
    queryFn: async () => {
      const res = await organizationApi.getMembers(orgId!);
      return res.data;
    },
    enabled: !!orgId,
    retry: false,
  });

  const { data: apiKeys, isLoading: isApiKeysLoading } = useQuery({
    queryKey: ['organization-api-keys', orgId],
    queryFn: async () => {
      const res = await organizationApi.getApiKeys(orgId!);
      return res.data;
    },
    enabled: !!orgId,
    retry: false,
  });

  const removeMemberMutation = useMutation({
    mutationFn: ({ memberId }: { memberId: number }) => organizationApi.removeMember(orgId!, memberId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['org-members', orgId] });
    },
  });

  const [newKeyValue, setNewKeyValue] = useState<string | null>(null);
  const [creatingKey, setCreatingKey] = useState(false);
  const createKeyMutation = useMutation({
    mutationFn: (name: string) => organizationApi.createApiKey(orgId!, { name }),
    onSuccess: async (res) => {
      setNewKeyValue(res.data.apiKey);
      await queryClient.invalidateQueries({ queryKey: ['organization-api-keys', orgId] });
    },
    onSettled: () => setCreatingKey(false),
  });

  const [rotateTarget, setRotateTarget] = useState<{ id: number; name: string } | null>(null);
  const [rotatedKeyValue, setRotatedKeyValue] = useState<string | null>(null);
  const rotateKeyMutation = useMutation({
    mutationFn: ({ id }: { id: number }) => organizationApi.rotateApiKey(orgId!, id, {}),
    onSuccess: async (res) => {
      setRotatedKeyValue(res.data.apiKey);
      await queryClient.invalidateQueries({ queryKey: ['organization-api-keys', orgId] });
    },
  });

  const stats = useMemo(() => {
    const list = members ?? [];
    const total = list.length;
    const adminCount = list.filter((m) => m.role === 'OWNER' || m.role === 'ADMIN').length;
    return { total, adminCount };
  }, [members]);

  const filteredMembers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (members ?? []).filter((m) => {
      if (roleFilter !== 'ALL' && m.role !== roleFilter) return false;
      if (!q) return true;
      return (
        m.name.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q)
      );
    });
  }, [members, search, roleFilter]);

  if (!orgId || Number.isNaN(orgId)) {
    return <div className="text-sm text-gray-300">조직을 선택할 수 없습니다.</div>;
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-white">조직 및 보안</h2>
          <p className="mt-2 text-gray-400">
            사용자 권한 관리 및 Tenant Isolation API 보안 설정을 관리합니다.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => {
              const rows = (members ?? []).map((m) => ({
                memberId: m.memberId,
                userId: m.userId,
                name: m.name,
                email: m.email,
                role: m.role,
                status: m.status,
                joinedAt: m.joinedAt,
              }));
              downloadCsv(`org_${orgId}_members.csv`, rows);
            }}
            className="flex items-center justify-center gap-2 h-10 px-4 rounded-lg bg-[color:rgba(255,255,255,0.06)] border border-[var(--border)] text-white text-sm font-medium hover:bg-[color:rgba(255,255,255,0.10)] transition-colors"
          >
            <Download size={18} />
            CSV 내보내기
          </button>
          <button
            type="button"
            onClick={() => setInviteOpen(true)}
            className="flex items-center justify-center gap-2 h-10 px-4 rounded-lg bg-[var(--primary)] hover:opacity-90 text-white text-sm font-medium transition-all shadow-lg shadow-[color:rgba(146,19,236,0.25)]"
          >
            <UserPlus size={18} />
            멤버 초대
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-6 rounded-xl border border-[var(--border)] bg-[var(--card)] flex flex-col gap-1 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-400">총 멤버</span>
            <span className="p-1.5 rounded-md bg-[color:rgba(146,19,236,0.12)] text-[var(--primary)]">
              <Shield size={18} />
            </span>
          </div>
          <span className="text-3xl font-bold text-white">{stats.total}</span>
          <span className="text-xs text-gray-500">활성 사용자 포함</span>
        </div>
        <div className="p-6 rounded-xl border border-[var(--border)] bg-[var(--card)] flex flex-col gap-1 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-400">관리자</span>
            <span className="p-1.5 rounded-md bg-blue-500/10 text-blue-300">
              <Shield size={18} />
            </span>
          </div>
          <span className="text-3xl font-bold text-white">{stats.adminCount}</span>
          <span className="text-xs text-gray-500">전체 권한 보유</span>
        </div>
      </div>

      {/* Members Table */}
      <div className="flex flex-col rounded-xl border border-[var(--border)] bg-[var(--card)] overflow-hidden shadow-sm">
        <div className="p-4 border-b border-[var(--border)] flex flex-wrap items-center justify-between gap-4">
          <div className="relative max-w-sm w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              className="w-full h-10 pl-10 pr-4 rounded-lg bg-[color:rgba(0,0,0,0.18)] border border-[color:rgba(255,255,255,0.10)] text-sm text-white placeholder-gray-500 focus:ring-2 focus:ring-[color:rgba(146,19,236,0.35)] outline-none"
              placeholder="이름 또는 이메일 검색..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              type="text"
            />
          </div>
          <div className="flex items-center gap-2">
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as typeof roleFilter)}
              className="h-10 pl-3 pr-8 rounded-lg bg-[color:rgba(0,0,0,0.18)] border border-[color:rgba(255,255,255,0.10)] text-sm text-gray-200 focus:ring-2 focus:ring-[color:rgba(146,19,236,0.35)] cursor-pointer"
            >
              <option value="ALL" className="bg-[#1a1a2e] text-gray-300">모든 역할</option>
              <option value="OWNER" className="bg-[#1a1a2e] text-white">소유자</option>
              <option value="ADMIN" className="bg-[#1a1a2e] text-white">관리자</option>
              <option value="MEMBER" className="bg-[#1a1a2e] text-white">멤버</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[color:rgba(0,0,0,0.18)] border-b border-[var(--border)]">
                <th className="px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">사용자</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">역할</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">상태</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">가입일</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider text-right">작업</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[color:rgba(255,255,255,0.08)]">
              {isMembersLoading ? (
                Array.from({ length: 5 }).map((_, idx) => (
                  <tr key={idx}>
                    <td colSpan={5} className="px-6 py-4">
                      <div className="h-10 rounded-lg bg-[color:rgba(255,255,255,0.06)] animate-pulse" />
                    </td>
                  </tr>
                ))
              ) : isMembersError ? (
                <tr>
                  <td colSpan={5} className="px-6 py-6">
                    <div className="flex items-center gap-2 text-rose-200">
                      <AlertCircle size={16} />
                      멤버 목록을 불러오지 못했습니다.
                    </div>
                  </td>
                </tr>
              ) : filteredMembers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-sm text-gray-400">
                    결과가 없습니다.
                  </td>
                </tr>
              ) : (
                filteredMembers.map((m: OrganizationMemberResponse) => (
                  <tr key={m.memberId} className="hover:bg-[color:rgba(0,0,0,0.12)] transition-colors group">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="size-10 rounded-full bg-[color:rgba(146,19,236,0.18)] flex items-center justify-center text-white text-sm font-bold">
                          {m.name?.slice(0, 2) || 'U'}
                        </div>
                        <div>
                          <div className="text-sm font-medium text-white">{m.name}</div>
                          <div className="text-xs text-gray-400">{m.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <RoleBadge role={m.role} />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <StatusDot status={m.status} />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                      {formatRelativeKorean(m.joinedAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <button
                        type="button"
                        disabled={removeMemberMutation.isPending}
                        onClick={() => {
                          if (confirm(`멤버를 퇴출할까요? (${m.email})`)) {
                            removeMemberMutation.mutate({ memberId: m.memberId });
                          }
                        }}
                        className="text-gray-400 hover:text-rose-200 transition-colors opacity-0 group-hover:opacity-100"
                        title="퇴출"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* API Key Management */}
      <div className="flex flex-col gap-6 pt-2">
        <div className="flex flex-col gap-1">
          <h3 className="text-xl font-bold text-white">API 키 관리</h3>
          <p className="text-sm text-gray-400">
            조직 전용 API 키입니다. 모든 키는 <span className="text-[var(--primary)] font-medium">Tenant Isolation</span> 정책에 따라 저장됩니다.
          </p>
        </div>

        <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] p-6 shadow-sm">
          <div className="flex flex-col gap-4">
            {isApiKeysLoading ? (
              <div className="h-16 rounded-lg bg-[color:rgba(255,255,255,0.06)] animate-pulse" />
            ) : (apiKeys?.length ?? 0) === 0 ? (
              <div className="text-sm text-gray-400">아직 API 키가 없습니다.</div>
            ) : (
              apiKeys!.map((k: OrganizationApiKeySummaryResponse) => (
                <ApiKeyRow
                  key={k.id}
                  apiKey={k}
                  onRotate={(id, name) => setRotateTarget({ id, name })}
                />
              ))
            )}

            <button
              type="button"
              onClick={() => {
                const name = prompt('새 API 키 이름을 입력하세요 (예: Default Org Key)');
                if (!name?.trim()) return;
                setCreatingKey(true);
                createKeyMutation.mutate(name.trim());
              }}
              className="flex items-center justify-center gap-2 w-full py-3 rounded-lg border border-dashed border-[color:rgba(255,255,255,0.20)] text-gray-300 hover:bg-[color:rgba(255,255,255,0.06)] hover:border-[var(--primary)] hover:text-[var(--primary)] transition-all"
              disabled={creatingKey}
            >
              <Plus size={18} />
              <span className="text-sm font-medium">새 API 키 생성</span>
            </button>

            {createKeyMutation.isError ? (
              <div className="text-sm text-rose-200 bg-rose-500/10 border border-rose-500/20 rounded-lg p-3">
                API 키 생성에 실패했습니다.
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* Modals */}
      <InviteMemberModal orgId={orgId} isOpen={inviteOpen} onClose={() => setInviteOpen(false)} />

      {(newKeyValue || rotatedKeyValue) ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => {
              setNewKeyValue(null);
              setRotatedKeyValue(null);
            }}
            aria-label="Close key modal overlay"
          />
          <div className="relative w-full max-w-lg rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-xl">
            <div className="p-6 border-b border-[var(--border)]">
              <h3 className="text-lg font-semibold text-white">API 키</h3>
              <p className="text-sm text-gray-400 mt-1">
                이 키는 지금 한 번만 표시됩니다. 안전한 곳에 저장하세요.
              </p>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-black/30 rounded-lg p-4 border border-[color:rgba(255,255,255,0.10)] relative">
                <code className="text-sm font-mono text-green-300 break-all block pr-10">
                  {newKeyValue || rotatedKeyValue}
                </code>
                <button
                  type="button"
                  onClick={() => navigator.clipboard.writeText((newKeyValue || rotatedKeyValue) ?? '')}
                  className="absolute top-2 right-2 p-2 text-gray-300 hover:text-white rounded-lg hover:bg-white/5"
                  title="복사"
                >
                  <Copy size={16} />
                </button>
              </div>
              <button
                type="button"
                onClick={() => {
                  setNewKeyValue(null);
                  setRotatedKeyValue(null);
                }}
                className="w-full h-10 rounded-lg bg-[var(--primary)] hover:opacity-90 text-white text-sm font-medium"
              >
                확인
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {rotateTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setRotateTarget(null)}
            aria-label="Close rotate modal overlay"
          />
          <div className="relative w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-xl">
            <div className="p-6 border-b border-[var(--border)]">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-lg bg-amber-500/10 text-amber-300 flex items-center justify-center">
                  <RefreshCw size={18} />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">API 키 재발급</h3>
                  <p className="text-sm text-gray-400 mt-1">
                    <strong className="text-white">{rotateTarget.name}</strong> 키를 재발급합니다.
                  </p>
                </div>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg text-sm text-amber-200">
                ⚠️ 기존 키는 즉시 무효화됩니다. 사용 중인 서비스에서 새 키로 교체하세요.
              </div>
              {rotateKeyMutation.isError ? (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg text-sm text-rose-200">
                  재발급에 실패했습니다.
                </div>
              ) : null}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setRotateTarget(null)}
                  className="flex-1 h-10 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white text-sm font-medium"
                >
                  취소
                </button>
                <button
                  type="button"
                  disabled={rotateKeyMutation.isPending}
                  onClick={() => rotateKeyMutation.mutate({ id: rotateTarget.id })}
                  className="flex-1 h-10 rounded-lg bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white text-sm font-medium"
                >
                  {rotateKeyMutation.isPending ? '재발급 중...' : '재발급'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
