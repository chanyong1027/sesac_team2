import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useWorkspaces } from '@/features/workspace/hooks/useWorkspaces';
import { useOrganizationStore } from '@/features/organization/store/organizationStore';
import { organizationApi } from '@/api/organization.api';
import { CreateOrganizationModal } from '@/features/organization/components/CreateOrganizationModal';
import type { WorkspaceSummaryResponse } from '@/types/api.types';
import {
    Plus,
    ArrowRight,
    Layout,
    Users,
    Key
} from 'lucide-react';

export function OrganizationDashboardPage() {
    const { data: workspaces, isLoading } = useWorkspaces();
    const { currentOrgId } = useOrganizationStore();
    const [isModalOpen, setIsModalOpen] = useState(false);

    // 멤버 수 조회
    const { data: members } = useQuery({
        queryKey: ['organization-members', currentOrgId],
        queryFn: async () => {
            if (!currentOrgId) return [];
            const response = await organizationApi.getMembers(currentOrgId);
            return response.data;
        },
        enabled: !!currentOrgId,
    });

    // API Key 수 조회 (선택적)
    const { data: apiKeys } = useQuery({
        queryKey: ['organization-api-keys', currentOrgId],
        queryFn: async () => {
            if (!currentOrgId) return [];
            const response = await organizationApi.getApiKeys(currentOrgId);
            return response.data;
        },
        enabled: !!currentOrgId,
    });

    if (isLoading) {
        return <DashboardSkeleton />;
    }

    return (
        <div className="space-y-8">
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-semibold text-gray-900">내 워크스페이스</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        총 {workspaces?.length || 0}개의 워크스페이스에 참여하고 있습니다.
                    </p>
                </div>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium text-sm shadow-sm"
                >
                    <Plus size={16} />
                    새 워크스페이스 만들기
                </button>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatCard
                    label="Total Workspaces"
                    value={workspaces?.length || 0}
                    icon={<Layout className="text-indigo-600" />}
                />
                <StatCard
                    label="Organization Members"
                    value={members?.length || 0}
                    icon={<Users className="text-emerald-600" />}
                    subtext="현재 조직 멤버"
                />
                <StatCard
                    label="Active API Keys"
                    value={apiKeys?.length || 0}
                    icon={<Key className="text-blue-600" />}
                    subtext="사용 가능한 키"
                />
            </div>

            {/* Workspace Grid */}
            {workspaces && workspaces.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {workspaces.map((workspace) => (
                        <WorkspaceCard key={workspace.id} workspace={workspace} />
                    ))}

                    {/* Create New Card (Optional) */}
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="flex flex-col items-center justify-center p-6 rounded-xl border-2 border-dashed border-gray-200 hover:border-indigo-300 hover:bg-indigo-50/50 transition-all group h-full min-h-[180px]"
                    >
                        <div className="w-12 h-12 rounded-full bg-white border border-gray-100 flex items-center justify-center text-gray-400 group-hover:text-indigo-600 shadow-sm mb-3 group-hover:scale-110 transition-transform">
                            <Plus size={24} />
                        </div>
                        <span className="text-sm font-medium text-gray-600 group-hover:text-indigo-700">새 워크스페이스 시작하기</span>
                        <span className="text-xs text-gray-400 mt-1">새 워크스페이스 생성 및 팀원 초대</span>
                    </button>
                </div>
            ) : (
                <EmptyState onCreate={() => setIsModalOpen(true)} />
            )}

            <CreateOrganizationModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
            />
        </div>
    );
}

function StatCard({ label, value, icon, subtext }: { label: string, value: string | number, icon: React.ReactNode, subtext?: string }) {
    return (
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex items-start justify-between">
            <div>
                <p className="text-sm font-medium text-gray-500">{label}</p>
                <p className="text-3xl font-semibold text-gray-900 mt-2">{value}</p>
                {subtext && <p className="text-xs text-gray-400 mt-1">{subtext}</p>}
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
                {icon}
            </div>
        </div>
    );
}

function WorkspaceCard({ workspace }: { workspace: WorkspaceSummaryResponse }) {
    return (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all group flex flex-col h-full">
            <div className="p-6 flex-1">
                <div className="flex items-start justify-between mb-4">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center text-gray-600 font-bold text-lg border border-gray-100">
                        {workspace.displayName.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex items-center gap-2">
                        <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${workspace.status === 'ACTIVE'
                            ? 'bg-green-50 text-green-700 border border-green-100'
                            : 'bg-gray-100 text-gray-600 border border-gray-200'
                            }`}>
                            {workspace.status}
                        </span>
                    </div>
                </div>

                <h3 className="text-lg font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors mb-1">
                    {workspace.displayName}
                </h3>
                <p className="text-sm text-gray-500 font-mono mb-4">
                    {workspace.name}
                </p>

                <div className="flex items-center gap-4 text-xs text-gray-400">
                    <span className="flex items-center gap-1">
                        <Layout size={12} /> role: {workspace.myRole}
                    </span>
                    <span>•</span>
                    <span>{new Date(workspace.createdAt).toLocaleDateString()}</span>
                </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-50 bg-gray-50/50 rounded-b-xl flex items-center justify-between group-hover:bg-indigo-50/30 transition-colors">
                <span className="text-xs font-medium text-gray-500">대시보드 이동</span>
                <Link
                    to={`/orgs/${workspace.organizationId}/workspaces/${workspace.id}`}
                    className="text-indigo-600 hover:text-indigo-700 p-1 rounded-full hover:bg-indigo-100 transition-colors"
                >
                    <ArrowRight size={18} />
                </Link>
            </div>
        </div>
    );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
    return (
        <div className="text-center py-20 bg-white rounded-xl border border-dashed border-gray-300">
            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <Layout className="text-gray-400" size={32} />
            </div>
            <h3 className="text-lg font-medium text-gray-900">아직 워크스페이스가 없습니다</h3>
            <p className="text-sm text-gray-500 mt-1 mb-6 max-w-sm mx-auto">
                새로운 워크스페이스를 만들어보세요.
            </p>
            <button
                onClick={onCreate}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium text-sm"
            >
                <Plus size={16} />
                새 워크스페이스 만들기
            </button>
        </div>
    );
}

function DashboardSkeleton() {
    return (
        <div className="space-y-8 animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-48" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[1, 2, 3].map(i => (
                    <div key={i} className="h-32 bg-gray-200 rounded-xl" />
                ))}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[1, 2, 3].map(i => (
                    <div key={i} className="h-64 bg-gray-200 rounded-xl" />
                ))}
            </div>
        </div>
    );
}
