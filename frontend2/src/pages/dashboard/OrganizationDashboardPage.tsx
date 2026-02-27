import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueries, useQuery } from '@tanstack/react-query';
import { useOrganizationWorkspaces } from '@/features/workspace/hooks/useOrganizationWorkspaces';
import { useOrganizationStore } from '@/features/organization/store/organizationStore';
import { organizationApi } from '@/api/organization.api';
import { documentApi } from '@/api/document.api';
import { budgetApi } from '@/api/budget.api';
import { CreateOrganizationModal } from '@/features/organization/components/CreateOrganizationModal';
import type { BudgetUsageResponse, WorkspaceSummaryResponse } from '@/types/api.types';
import {
    calculateUsagePercent,
    formatUsageMonth,
    formatUsdAmount,
    resolvePrimaryLimitUsd,
} from '@/features/budget/utils/budgetUsage';
import {
    Plus,
    ArrowRight,
    LayoutGrid,
    Users,
    KeyRound,
    CheckCircle2,
    Loader2,
    Ban,
    AlertTriangle
} from 'lucide-react';

export function OrganizationDashboardPage() {
    const { data: workspaces, isLoading } = useOrganizationWorkspaces();
    const { currentOrgId } = useOrganizationStore();
    const [isModalOpen, setIsModalOpen] = useState(false);

    const sortedWorkspaces = useMemo(() => {
        return [...(workspaces ?? [])].sort((a, b) => {
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });
    }, [workspaces]);

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

    const workspaceBudgetUsages = useQueries({
        queries: sortedWorkspaces.map((ws) => ({
            queryKey: ['budget-usage', 'workspace', ws.id],
            queryFn: async () => {
                try {
                    const response = await budgetApi.getWorkspaceUsage(ws.id);
                    return response.data;
                } catch {
                    return null;
                }
            },
            enabled: !!ws?.id,
            retry: false,
            staleTime: 1000 * 60, // 1m
        })),
    });

    const workspaceDocuments = useQueries({
        queries: sortedWorkspaces.map((ws) => ({
            queryKey: ['documents', ws.id],
            queryFn: async () => {
                const response = await documentApi.getDocuments(ws.id);
                return response.data;
            },
            enabled: !!ws?.id,
            retry: false,
            staleTime: 1000 * 30, // 30s
            refetchOnWindowFocus: false,
        })),
    });

    if (isLoading) {
        return <DashboardSkeleton />;
    }

    return (
        <div className="space-y-10 pb-20">
            {/* Page Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                    <h1 className="text-3xl font-bold text-[var(--foreground)] mb-2 tracking-tight">내 워크스페이스</h1>
                    <p className="text-[var(--text-secondary)] text-sm font-medium">
                        총 <span className="text-[var(--primary)] font-bold">{sortedWorkspaces.length}개</span>의 워크스페이스에 참여하고 있습니다.
                    </p>
                </div>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="flex items-center justify-center gap-2 rounded-xl h-12 px-8 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white text-sm font-bold shadow-[0_0_25px_rgba(168,85,247,0.4)] hover:shadow-[0_0_30px_rgba(168,85,247,0.6)] transition-all transform hover:-translate-y-0.5 border border-[var(--border)]"
                >
                    <Plus size={18} />
                    <span className="tracking-wide">새 워크스페이스 만들기</span>
                </button>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatCard
                    label="전체 워크스페이스"
                    value={sortedWorkspaces.length}
                    icon={<LayoutGrid className="text-[var(--primary)]" />}
                />
                <StatCard
                    label="조직 멤버"
                    value={members?.length || 0}
                    icon={<Users className="text-[var(--primary)]" />}
                />
                <StatCard
                    label="사용 가능 API 키"
                    value={apiKeys?.length || 0}
                    icon={<KeyRound className="text-[var(--primary)]" />}
                />
            </div>

            {/* Workspace Grid */}
            {sortedWorkspaces.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {sortedWorkspaces.map((workspace, idx) => (
                        <WorkspaceCard
                            key={workspace.id}
                            workspace={workspace}
                            budgetUsage={workspaceBudgetUsages[idx]?.data ?? null}
                            documents={workspaceDocuments[idx]?.data ?? null}
                            docsLoading={Boolean(
                                workspaceDocuments[idx]?.isLoading
                                && workspaceDocuments[idx]?.data == null
                            )}
                        />
                    ))}

                    {/* Create New Card (Optional) */}
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="group flex flex-col items-center justify-center bg-[var(--card)] rounded-2xl border border-dashed border-[var(--border)] hover:border-[var(--primary)] hover:bg-[var(--muted)] hover:shadow-[0_0_15px_rgba(168,85,247,0.25)] transition-all duration-300 min-h-[300px] cursor-pointer backdrop-blur-sm"
                    >
                        <div className="w-20 h-20 rounded-full bg-[var(--muted)] group-hover:bg-[color:rgba(168,85,247,0.20)] flex items-center justify-center text-[var(--text-secondary)] group-hover:text-[var(--primary)] transition-all mb-6 border border-[var(--border)] group-hover:scale-110 group-hover:border-[color:rgba(168,85,247,0.30)] shadow-xl">
                            <Plus size={34} />
                        </div>
                        <span className="text-[var(--foreground)] text-xl font-bold mb-2 tracking-tight">새 워크스페이스 시작하기</span>
                        <span className="text-[var(--text-secondary)] text-sm font-medium">새 워크스페이스 생성 및 팀원 초대</span>
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
        <div className="glass-card rounded-2xl p-6 relative overflow-hidden group hover:border-[var(--primary)]/30 transition-all">
            <div className="absolute -right-6 -top-6 w-24 h-24 bg-[var(--primary)]/10 rounded-full blur-2xl group-hover:bg-[var(--primary)]/20 transition-all" />
            <div className="flex justify-between items-start relative z-10">
                <div>
                    <p className="text-[var(--text-secondary)] text-xs font-bold uppercase tracking-wider mb-2">{label}</p>
                    <p className="text-[var(--foreground)] text-5xl font-light tracking-tight">{value}</p>
                    {subtext ? <p className="mt-3 text-[var(--text-secondary)] text-xs">{subtext}</p> : null}
                </div>
                <div className="w-12 h-12 rounded-xl bg-[var(--muted)] border border-[var(--border)] flex items-center justify-center shadow-inner">
                    {icon}
                </div>
            </div>
        </div>
    );
}

function WorkspaceCard({
    workspace,
    budgetUsage,
    documents,
    docsLoading,
}: {
    workspace: WorkspaceSummaryResponse;
    budgetUsage: BudgetUsageResponse | null;
    documents: Array<{ status: string }> | null;
    docsLoading: boolean;
}) {
    const rag = getRagStatus(documents, docsLoading);
    const monthLabel = formatUsageMonth(budgetUsage?.month);
    const usedUsd = budgetUsage?.usedUsd ?? 0;
    const primaryLimit = resolvePrimaryLimitUsd(budgetUsage);
    const usagePercentRaw = calculateUsagePercent(usedUsd, primaryLimit);
    const usagePercentRounded = usagePercentRaw == null ? null : Math.round(usagePercentRaw);
    const hasUsageValue = budgetUsage != null;
    const requestCountText = hasUsageValue ? budgetUsage.requestCount.toLocaleString('ko-KR') : '-';
    const costText = hasUsageValue ? formatUsdAmount(usedUsd) : '-';
    const usageBarClass = usagePercentRounded != null && usagePercentRounded >= 90
        ? 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]'
        : 'bg-gradient-to-r from-[var(--primary)] to-purple-400 shadow-[0_0_10px_rgba(168,85,247,0.5)]';
    const usageTextClass = usagePercentRounded != null && usagePercentRounded >= 90 ? 'text-red-600 dark:text-red-400' : 'text-[var(--foreground)]';

    return (
        <div className="glass-card glass-card-hover rounded-2xl p-0 flex flex-col group h-full">
            <div className="p-6 pb-4 flex justify-between items-start">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[var(--muted)] to-transparent border border-[var(--border)] flex items-center justify-center text-[var(--foreground)] shadow-lg backdrop-blur-md">
                    <span className="text-xl font-bold">{workspace.displayName.charAt(0).toUpperCase()}</span>
                </div>
                <span className={badgeClass(workspace.status)}>{workspace.status}</span>
            </div>

            <div className="flex-1">
                <div className="px-6 flex-1">
                <h3 className="text-[var(--foreground)] text-xl font-bold mb-1 group-hover:text-[var(--primary)] transition-colors tracking-tight">
                    {workspace.displayName}
                </h3>
                <p className="text-[var(--text-secondary)] text-xs mb-6 font-mono opacity-70">ID: {workspace.name}</p>

                <div className="space-y-5 py-5 border-t border-dashed border-[var(--border)]">
                    <div className="flex items-center justify-between text-sm">
                        <span className="text-[var(--text-secondary)] text-xs font-semibold uppercase tracking-wider">RAG 상태</span>
                        <div className={`flex items-center gap-1.5 text-xs font-bold px-2 py-1 rounded-md border ${rag.pillClass}`}>
                            {rag.icon}
                            {rag.label}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <div className="flex justify-between items-end">
                            <div className="flex flex-col">
                                <span className="text-[var(--text-secondary)] text-xs font-medium">예산 사용량</span>
                                <span className="text-[10px] text-[var(--text-secondary)]">UTC {monthLabel}</span>
                            </div>
                            <span className={`${usageTextClass} text-xs font-bold`}>
                                {usagePercentRounded != null ? `${usagePercentRounded}%` : '-'}
                            </span>
                        </div>
                        <div className="w-full h-1.5 bg-[var(--muted)] rounded-full overflow-hidden border border-[var(--border)]">
                            <div
                                className={`h-full ${usageBarClass} rounded-full`}
                                style={{ width: `${usagePercentRaw ?? 0}%` }}
                            />
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-[var(--text-secondary)] font-medium">
                            <span>요청: {requestCountText}</span>
                            <span>비용: {costText}</span>
                        </div>
                    </div>
                </div>
            </div>
            </div>

            <div className="mt-auto px-6 py-4 flex items-center justify-between border-t border-[var(--border)] bg-[var(--muted)]/40">
                <span className="text-[11px] text-[var(--text-secondary)] font-medium">
                    {formatRelativeTime(workspace.createdAt)} 업데이트
                </span>
                <Link
                    to={`/orgs/${workspace.organizationId}/workspaces/${workspace.id}`}
                    className="text-[var(--primary)] hover:text-[var(--foreground)] text-xs font-bold flex items-center gap-1 transition-colors group/btn"
                >
                    대시보드 이동
                    <ArrowRight size={14} className="group-hover/btn:translate-x-1 transition-transform" />
                </Link>
            </div>
        </div>
    );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
    return (
        <div className="text-center py-20 glass-card rounded-2xl border border-dashed border-[var(--border)]">
            <div className="w-16 h-16 bg-[var(--muted)] rounded-full flex items-center justify-center mx-auto mb-4 border border-[var(--border)]">
                <LayoutGrid className="text-[var(--text-secondary)]" size={32} />
            </div>
            <h3 className="text-lg font-semibold text-[var(--foreground)]">아직 워크스페이스가 없습니다</h3>
            <p className="text-sm text-[var(--text-secondary)] mt-1 mb-6 max-w-sm mx-auto">
                새로운 워크스페이스를 만들어보세요.
            </p>
            <button
                onClick={onCreate}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-[var(--primary)] text-white rounded-xl hover:bg-[var(--primary-hover)] transition-colors font-semibold text-sm shadow-[0_0_15px_rgba(168,85,247,0.25)] border border-[var(--border)]"
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
            <div className="h-8 bg-[var(--muted)] rounded w-48" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[1, 2, 3].map(i => (
                    <div key={i} className="h-32 bg-[var(--muted)] rounded-2xl" />
                ))}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[1, 2, 3].map(i => (
                    <div key={i} className="h-64 bg-[var(--muted)] rounded-2xl" />
                ))}
            </div>
        </div>
    );
}

function badgeClass(status: string) {
    // Visually align with ACTIVE / INDEXING / WARNING styles in the mock.
    const base = 'inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold border tracking-wider';
    if (status === 'ACTIVE') return `${base} bg-green-500/10 text-green-700 dark:text-green-300 border-green-500/25`;
    if (status === 'INDEXING') return `${base} bg-yellow-500/10 text-yellow-700 dark:text-yellow-300 border-yellow-500/25`;
    if (status === 'FAILED') return `${base} bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/25`;
    return `${base} bg-gray-500/10 text-[var(--text-secondary)] border-gray-500/20`;
}

function getRagStatus(documents: Array<{ status: string }> | null, isLoading: boolean) {
    if (isLoading) {
        return {
            label: '처리 중',
            pillClass: 'text-amber-700 dark:text-amber-300 bg-amber-500/10 border-amber-500/25',
            icon: <Loader2 size={14} className="animate-spin" />,
        };
    }
    const docs = documents ?? [];
    if (docs.length === 0) {
        return {
            label: '비활성',
            pillClass: 'text-[var(--text-secondary)] bg-[var(--muted)] border-[var(--border)]',
            icon: <Ban size={14} />,
        };
    }

    const statuses = new Set(docs.map((d) => String(d.status).toUpperCase()));
    if (statuses.has('FAILED')) {
        return {
            label: '경고',
            pillClass: 'text-red-700 dark:text-red-300 bg-red-500/10 border-red-500/25',
            icon: <AlertTriangle size={14} />,
        };
    }

    // Any "in flight" status -> processing.
    const inFlight = ['UPLOADED', 'PARSING', 'CHUNKING', 'EMBEDDING', 'INDEXING', 'PROCESSING', 'DELETING']
        .some((s) => statuses.has(s));
    if (inFlight) {
        return {
            label: '처리 중',
            pillClass: 'text-amber-700 dark:text-amber-300 bg-amber-500/10 border-amber-500/25',
            icon: <Loader2 size={14} className="animate-spin" />,
        };
    }

    return {
        label: '준비됨',
        pillClass: 'text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 border-emerald-500/25 shadow-[0_0_10px_rgba(16,185,129,0.15)]',
        icon: <CheckCircle2 size={14} />,
    };
}

function formatRelativeTime(iso: string) {
    const then = new Date(iso).getTime();
    if (!Number.isFinite(then)) return '-';
    const diffMs = Date.now() - then;
    const diffMin = Math.max(0, Math.floor(diffMs / 60000));
    if (diffMin < 1) return '방금 전';
    if (diffMin < 60) return `${diffMin}분 전`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `${diffH}시간 전`;
    const diffD = Math.floor(diffH / 24);
    return `${diffD}일 전`;
}
