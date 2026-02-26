import { useParams, Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { useOrganizationWorkspaces } from '@/features/workspace/hooks/useOrganizationWorkspaces';
import { organizationApi } from '@/api/organization.api';
import { promptApi } from '@/api/prompt.api';
import { documentApi } from '@/api/document.api';
import { logsApi } from '@/api/logs.api';
import { statisticsApi } from '@/api/statistics.api';
import { budgetApi } from '@/api/budget.api';
import { BudgetPolicyModal } from '@/components/budget/BudgetPolicyModal';
import { BudgetUsageCard } from '@/components/budget/BudgetUsageCard';
import { formatUsageMonth } from '@/features/budget/utils/budgetUsage';
import {
    Copy,
    Check,
    RefreshCw,
    ExternalLink
} from 'lucide-react';
import type {
    BudgetPolicyUpdateRequest,
    RequestLogResponse,
    RequestLogStatus,
} from '@/types/api.types';

function formatTimeHHmmss(iso: string) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleTimeString('ko-KR', { hour12: false });
}

function activityStatusLabel(status: RequestLogStatus) {
    if (status === 'FAIL') return 'FAILED';
    return status;
}

function activityStatusBadgeClass(status: RequestLogStatus) {
    const base = 'px-2 py-0.5 rounded text-[10px] font-bold shadow border';
    switch (status) {
        case 'SUCCESS':
            return `${base} bg-green-500/15 text-green-700 dark:text-green-300 border-green-500/30 shadow-[0_0_10px_rgba(34,197,94,0.25)]`;
        case 'FAIL':
            return `${base} bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30 shadow-[0_0_10px_rgba(239,68,68,0.25)]`;
        case 'BLOCKED':
            return `${base} bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30 shadow-[0_0_10px_rgba(245,158,11,0.22)]`;
        case 'IN_PROGRESS':
        default:
            return `${base} bg-[var(--surface-subtle)] text-[var(--text-secondary)] border-[var(--border)] shadow-none`;
    }
}

function modelLabel(log: RequestLogResponse) {
    return log.usedModel || log.requestedModel || '-';
}

function formatLatency(latencyMs: number | null) {
    if (!latencyMs || latencyMs <= 0) return '-';
    return `${(latencyMs / 1000).toFixed(1)}s`;
}

function formatTokens(tokens: number | null) {
    if (!tokens || tokens <= 0) return '-';
    return `${tokens.toLocaleString('ko-KR')} tok`;
}

function isIndexingStatus(s: string) {
    return ['UPLOADED', 'PARSING', 'CHUNKING', 'EMBEDDING', 'INDEXING', 'PROCESSING', 'DELETING']
        .includes(String(s).toUpperCase());
}

export function WorkspaceDashboardPage() {
    const { orgId, workspaceId: workspaceIdParam } = useParams<{ orgId: string; workspaceId: string }>();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const parsedWorkspaceId = Number(workspaceIdParam);
    const isValidWorkspaceId = Number.isInteger(parsedWorkspaceId) && parsedWorkspaceId > 0;
    const workspaceId = isValidWorkspaceId ? parsedWorkspaceId : 0;
    const parsedOrgId = orgId ? Number(orgId) : undefined;
    const resolvedOrgId = typeof parsedOrgId === 'number' && Number.isFinite(parsedOrgId)
        ? parsedOrgId
        : undefined;
    const basePath = orgId ? `/orgs/${orgId}/workspaces/${workspaceId}` : `/workspaces/${workspaceId}`;

    // 워크스페이스 정보 조회 (캐시 활용)
    const { data: workspaces, isLoading: isWorkspaceLoading } = useOrganizationWorkspaces(resolvedOrgId);
    const workspace = workspaces?.find(w => w.id === workspaceId);

    // 프롬프트 목록 조회 (통계용)
    const { data: prompts } = useQuery({
        queryKey: ['prompts', workspaceId],
        queryFn: async () => {
            const response = await promptApi.getPrompts(workspaceId);
            return response.data;
        },
        enabled: isValidWorkspaceId,
    });

    const { data: credentials } = useQuery({
        queryKey: ['provider-credentials', resolvedOrgId],
        queryFn: async () => {
            if (!resolvedOrgId) return [];
            const response = await organizationApi.getCredentials(resolvedOrgId);
            return response.data;
        },
        enabled: !!resolvedOrgId,
    });

    const { data: apiKeys } = useQuery({
        queryKey: ['organization-api-keys', resolvedOrgId],
        queryFn: async () => {
            if (!resolvedOrgId) return [];
            const response = await organizationApi.getApiKeys(resolvedOrgId);
            return response.data;
        },
        enabled: !!resolvedOrgId,
    });

    // 문서 목록 조회 (통계용)
    const { data: documents } = useQuery({
        queryKey: ['documents', workspaceId],
        queryFn: async () => {
            const response = await documentApi.getDocuments(workspaceId);
            return response.data;
        },
        enabled: isValidWorkspaceId,
    });

    const firstPromptId = prompts?.[0]?.id;
    const promptKey = prompts?.[0]?.promptKey || '';

    const { data: versions } = useQuery({
        queryKey: ['prompt-versions', firstPromptId],
        queryFn: async () => {
            if (!firstPromptId) return [];
            const response = await promptApi.getVersions(firstPromptId);
            return response.data;
        },
        enabled: !!firstPromptId,
    });

    const { data: release } = useQuery({
        queryKey: ['prompt-release', firstPromptId],
        queryFn: async () => {
            if (!firstPromptId) return null;
            try {
                const response = await promptApi.getRelease(firstPromptId);
                return response.data;
            } catch {
                return null;
            }
        },
        enabled: !!firstPromptId,
    });

    const { data: overviewData } = useQuery({
        queryKey: ['stats-overview', resolvedOrgId, 'daily', workspaceId],
        queryFn: () => statisticsApi.getOverview(resolvedOrgId!, {
            period: 'daily',
            workspaceId
        }),
        enabled: !!resolvedOrgId,
        retry: false,
    });

    const hasProviderKeys = (credentials?.length ?? 0) > 0;
    const hasGatewayApiKeys = (apiKeys?.length ?? 0) > 0;
    const hasPrompts = (prompts?.length ?? 0) > 0;
    const hasVersions = (versions?.length ?? 0) > 0;
    const hasRelease = !!release;

    const {
        data: recentLogs,
        isLoading: isRecentLogsLoading,
        isError: isRecentLogsError,
        refetch: refetchRecentLogs,
    } = useQuery({
        queryKey: ['recent-logs', workspaceId, promptKey],
        queryFn: async () =>
            logsApi.list(workspaceId, {
                promptKey,
                page: 0,
                size: 5,
            }),
        enabled: isValidWorkspaceId && !!promptKey,
        retry: false,
    });

    const [copiedCurl, setCopiedCurl] = useState(false);
    const [isBudgetModalOpen, setIsBudgetModalOpen] = useState(false);

    const { data: workspaceBudgetPolicy } = useQuery({
        queryKey: ['budget-policy', 'workspace', workspaceId],
        queryFn: async () => {
            const res = await budgetApi.getWorkspacePolicy(workspaceId);
            return res.data;
        },
        enabled: isValidWorkspaceId,
        retry: false,
    });

    const { data: workspaceBudgetUsage } = useQuery({
        queryKey: ['budget-usage', 'workspace', workspaceId],
        queryFn: async () => {
            const res = await budgetApi.getWorkspaceUsage(workspaceId);
            return res.data;
        },
        enabled: isValidWorkspaceId,
        retry: false,
    });

    const updateWorkspaceBudgetPolicyMutation = useMutation({
        mutationFn: async (payload: BudgetPolicyUpdateRequest) => {
            const res = await budgetApi.updateWorkspacePolicy(workspaceId, payload);
            return res.data;
        },
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ['budget-policy', 'workspace', workspaceId] });
            await queryClient.invalidateQueries({ queryKey: ['budget-usage', 'workspace', workspaceId] });
            setIsBudgetModalOpen(false);
        },
    });
    
    const handleCopyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text).then(() => {
            setCopiedCurl(true);
            setTimeout(() => setCopiedCurl(false), 2000);
        }).catch(() => {
            alert('클립보드 복사에 실패했습니다.');
        });
    };

    if (!isValidWorkspaceId) {
        return <div className="p-8 text-[var(--text-secondary)]">유효하지 않은 워크스페이스입니다.</div>;
    }
    if (isWorkspaceLoading) return <div className="p-8 text-[var(--text-secondary)]">로딩 중...</div>;
    if (!workspace) return <div className="p-8 text-[var(--text-secondary)]">워크스페이스를 찾을 수 없습니다.</div>;

    const overview = overviewData?.data;
    const statsLink = orgId ? `/orgs/${orgId}/stats` : undefined;

    const gatewayApiKey = apiKeys?.[0]?.keyPrefix ? `${apiKeys[0].keyPrefix}...` : 'YOUR_GATEWAY_API_KEY';
    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'https://api.luminaops.com';
    const safePromptKey = promptKey || 'your-prompt-key';
    
    const curlExample = `curl -X POST "${apiBaseUrl}/v1/chat/completions" \\
	  -H "X-API-Key: ${gatewayApiKey}" \\
	  -H "Content-Type: application/json" \\
	  -d '{
	    "workspaceId": ${workspaceId},
	    "promptKey": "${safePromptKey}",
	    "variables": {
	      "question": "안녕하세요!"
	    },
	    "ragEnabled": false
  }'`;

    return (
        <div className="relative">
            {/* Background orbs */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
                <div className="absolute top-[-10%] left-[20%] w-[500px] h-[500px] bg-[var(--primary)]/5 rounded-full blur-[120px]" />
                <div className="absolute bottom-[-10%] right-[10%] w-[600px] h-[600px] bg-blue-600/5 rounded-full blur-[120px]" />
            </div>

            <div className="relative z-10 max-w-7xl mx-auto space-y-8">
                <BudgetPolicyModal
                    open={isBudgetModalOpen}
                    mode="WORKSPACE"
                    title="워크스페이스 예산"
                    description="Soft-limit 초과 시 절약 모드(저가 모델/토큰 제한/RAG off)를 적용합니다."
                    policy={workspaceBudgetPolicy ?? null}
                    onClose={() => setIsBudgetModalOpen(false)}
                    onSave={(payload) => updateWorkspaceBudgetPolicyMutation.mutate(payload)}
                    isSaving={updateWorkspaceBudgetPolicyMutation.isPending}
                />

                {/* Workspace Header */}
                <div className="flex justify-between items-end">
                    <div>
                        <h1 className="text-3xl font-bold mb-1 text-[var(--foreground)] dark:neon-text tracking-tight">{workspace.displayName}</h1>
                        <p className="text-[var(--text-secondary)] text-sm">LLMOps workspace settings &amp; overview</p>
                    </div>
                    <div className="flex gap-2">
                        <span className="px-2 py-1 rounded text-[10px] font-bold bg-green-500/10 text-green-700 dark:text-green-300 border border-green-500/30">
                            SYSTEM OPERATIONAL
                        </span>
                    </div>
                </div>

                {/* Top Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Link to={`${basePath}/prompts`} className="block">
                        <div className="glass-card rounded-2xl p-6 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                <span className="material-symbols-outlined text-6xl text-[var(--primary)]">chat</span>
                            </div>
                            <div className="flex justify-between items-start mb-4 relative z-10">
                                <div className="p-2.5 rounded-xl bg-gradient-to-br from-[var(--primary)]/20 to-purple-900/40 text-[var(--primary)] border border-[var(--primary)]/20 shadow-[0_0_15px_rgba(168,85,247,0.15)]">
                                    <span className="material-symbols-outlined text-xl">chat</span>
                                </div>
                                <span className="px-2 py-1 rounded text-[10px] font-semibold bg-[var(--muted)] text-[var(--text-secondary)] border border-[var(--border)]">
                                    버전 중심 관리
                                </span>
                            </div>
                            <h3 className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide mb-1">프롬프트 설정</h3>
                            <div className="flex items-baseline gap-2">
                                <p className="text-4xl font-bold text-[var(--foreground)] tracking-tight">{prompts?.length ?? 0}</p>
                                {release?.activeVersionNo ? (
                                    <span className="text-xs font-medium text-[var(--primary)] px-1.5 py-0.5 rounded bg-[var(--primary)]/10 border border-[var(--primary)]/20">
                                        v{release.activeVersionNo} active
                                    </span>
                                ) : null}
                            </div>
                        </div>
                    </Link>

                    <Link to={`${basePath}/documents`} className="block">
                        <div className="glass-card rounded-2xl p-6 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                <span className="material-symbols-outlined text-6xl text-blue-500">description</span>
                            </div>
                            <div className="flex justify-between items-start mb-4 relative z-10">
                                <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-900/40 text-blue-400 border border-blue-500/20 shadow-[0_0_15px_rgba(59,130,246,0.15)]">
                                    <span className="material-symbols-outlined text-xl">description</span>
                                </div>
                                <span className="px-2 py-1 rounded text-[10px] font-semibold bg-[var(--muted)] text-[var(--text-secondary)] border border-[var(--border)]">
                                    {documents == null
                                        ? 'Checking..'
                                        : documents.length === 0
                                            ? 'No Docs'
                                            : (documents ?? []).some(d => isIndexingStatus(d.status))
                                                ? 'Indexing..'
                                                : 'Ready'}
                                </span>
                            </div>
                            <h3 className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide mb-1">RAG 문서</h3>
                            <div className="flex items-baseline gap-2">
                                <p className="text-4xl font-bold text-[var(--foreground)] tracking-tight">{documents?.length ?? 0}</p>
                                <span className="text-xs text-[var(--text-secondary)]">Documents</span>
                            </div>
                        </div>
                    </Link>

                    <Link to={statsLink ?? '#'} className="block">
                        <div className="glass-card rounded-2xl p-6 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                <span className="material-symbols-outlined text-6xl text-emerald-500">graphic_eq</span>
                            </div>
                            <div className="flex justify-between items-start mb-4 relative z-10">
                                <div className="p-2.5 rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-900/40 text-emerald-400 border border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.15)]">
                                    <span className="material-symbols-outlined text-xl">graphic_eq</span>
                                </div>
                                <span className="px-2 py-1 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                    Failover: {recentLogs?.content?.filter(l => l.isFailover).length ?? 0}
                                </span>
                            </div>
                            <h3 className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide mb-1">API Reliability</h3>
                            <div className="flex items-baseline gap-2">
                                <p className="text-4xl font-bold text-[var(--foreground)] tracking-tight">
                                    {overview ? `${Math.round(overview.successRate ?? 0)}%` : '-'}
                                </p>
                                <span className="text-xs text-[var(--text-secondary)]">Success</span>
                            </div>
                        </div>
                    </Link>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left Column */}
                    <div className="lg:col-span-2 space-y-8">
                        {/* Quick Actions */}
                        <div>
                            <h2 className="text-sm font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-4">Quick Actions</h2>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <QuickActionCard
                                    to={`${basePath}/prompts`}
                                    icon="add"
                                    title="프롬프트 설정"
                                    subtitle="기본 프롬프트 확인"
                                    color="purple"
                                />
                                <QuickActionCard
                                    to={orgId ? `/orgs/${orgId}/settings/provider-keys` : '/settings/provider-keys'}
                                    icon="vpn_key"
                                    title="API 키 등록"
                                    subtitle="모델 키 먼저 준비"
                                    color="teal"
                                />
                                <QuickActionCard
                                    to={`${basePath}/documents`}
                                    icon="upload_file"
                                    title="문서 업로드"
                                    subtitle="지식 베이스 추가"
                                    color="blue"
                                />
                                <QuickActionCard
                                    to={`${basePath}/prompts`}
                                    icon="history"
                                    title="버전 관리"
                                    subtitle="버전 생성/배포"
                                    color="pink"
                                />
                            </div>
                        </div>

                        {/* Recent Activity */}
                        <section className="glass-card rounded-2xl overflow-hidden">
                            <div className="p-5 border-b border-[var(--border)] flex justify-between items-center bg-[var(--muted)]/40">
                                <div>
                                    <h2 className="text-base font-bold text-[var(--foreground)] flex items-center gap-2">
                                        Recent Activity
                                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                                    </h2>
                                    <p className="text-xs text-[var(--text-secondary)] mt-1">
                                        Monitoring real-time requests for '{promptKey || workspace.displayName}'
                                    </p>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => refetchRecentLogs()}
                                        className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--foreground)] rounded-lg hover:bg-[var(--muted)] transition-colors"
                                        aria-label="refresh recent logs"
                                    >
                                        <RefreshCw size={18} />
                                    </button>
                                    <Link
                                        to={`${basePath}/logs?promptKey=${encodeURIComponent(promptKey)}`}
                                        className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--foreground)] rounded-lg hover:bg-[var(--muted)] transition-colors"
                                        aria-label="open logs page"
                                    >
                                        <ExternalLink size={18} />
                                    </Link>
                                </div>
                            </div>

                            {!promptKey ? (
                                <div className="p-4 text-sm text-[var(--text-secondary)]">
                                    아직 프롬프트가 없습니다. 프롬프트를 먼저 생성하세요.
                                    <Link to={`${basePath}/prompts`} className="ml-2 text-[var(--primary)] font-medium hover:underline">
                                        프롬프트 설정
                                    </Link>
                                </div>
                            ) : isRecentLogsLoading ? (
                                <div className="p-4 space-y-3">
                                    {Array.from({ length: 5 }).map((_, idx) => (
                                        <div key={idx} className="h-16 rounded-xl bg-[var(--surface-subtle)] animate-pulse" />
                                    ))}
                                </div>
                            ) : isRecentLogsError ? (
                                <div className="p-4 text-sm text-[var(--foreground)]">
                                    로그를 불러오지 못했습니다.
                                    <button
                                        type="button"
                                        onClick={() => refetchRecentLogs()}
                                        className="ml-2 text-[var(--primary)] font-medium hover:underline"
                                    >
                                        재시도
                                    </button>
                                </div>
                            ) : (recentLogs?.content?.length ?? 0) === 0 ? (
                                <div className="p-4 text-sm text-[var(--text-secondary)]">최근 요청이 없습니다. API 호출 후 확인하세요.</div>
                            ) : (
                                <div className="divide-y divide-[var(--border)]">
                                    {recentLogs!.content.map((log) => (
                                        <button
                                            key={log.traceId}
                                            type="button"
                                            onClick={() => navigate(`${basePath}/logs/${log.traceId}`)}
                                            className="w-full text-left p-4 hover:bg-[var(--surface-subtle)] transition-colors group"
                                        >
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="flex items-center gap-3">
                                                    <span className={activityStatusBadgeClass(log.status)}>{activityStatusLabel(log.status)}</span>
                                                    <span className="text-xs text-[var(--text-secondary)]">{formatTimeHHmmss(log.createdAt)}</span>
                                                    <span className="text-xs text-[var(--text-tertiary)] mx-1">|</span>
                                                    <span className="text-xs text-[var(--foreground)] font-medium">{modelLabel(log)}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span
                                                        className={
                                                            log.ragEnabled
                                                                ? 'px-2 py-0.5 rounded-full text-[10px] font-bold bg-[var(--primary)]/20 text-[var(--primary)] border border-[var(--primary)]/30 flex items-center gap-1'
                                                                : 'px-2 py-0.5 rounded-full text-[10px] font-bold bg-[var(--surface-subtle)] text-[var(--text-secondary)] border border-[var(--border)] flex items-center gap-1'
                                                        }
                                                    >
                                                        <span className={`w-1.5 h-1.5 rounded-full ${log.ragEnabled ? 'bg-[var(--primary)] animate-pulse' : 'bg-[var(--text-secondary)]'}`} />
                                                        RAG {log.ragEnabled ? 'ON' : 'OFF'}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-6">
                                                    <div className="flex items-center gap-2">
                                                        <code className={`text-[11px] font-mono text-[var(--text-secondary)] transition-colors ${log.status === 'FAIL' ? 'group-hover:text-red-600 dark:group-hover:text-red-400' : 'group-hover:text-[var(--primary)]'}`}>
                                                            {log.traceId.slice(0, 8)}...
                                                        </code>
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                navigator.clipboard.writeText(log.traceId);
                                                            }}
                                                            className="text-[var(--text-tertiary)] hover:text-[var(--foreground)] transition-colors opacity-0 group-hover:opacity-100"
                                                            aria-label="copy trace id"
                                                        >
                                                            <Copy size={14} />
                                                        </button>
                                                    </div>
                                                    <div className="flex items-center gap-4 text-xs font-mono text-[var(--text-secondary)]">
                                                        <span className="flex items-center gap-1">
                                                            <span className="text-[var(--text-secondary)]">⏱</span> <span className="text-[var(--foreground)]">{formatLatency(log.latencyMs)}</span>
                                                        </span>
                                                        <span className="flex items-center gap-1">
                                                            <span className="text-[var(--text-secondary)]">∑</span> <span className="text-[var(--foreground)]">{formatTokens(log.totalTokens)}</span>
                                                        </span>
                                                        {log.status === 'FAIL' ? (
                                                            <span className="flex items-center gap-1">
                                                                <span className="text-[var(--text-secondary)]">!</span>{' '}
                                                                <span className="text-red-600 dark:text-red-400">{log.failReason || log.errorCode || 'Error'}</span>
                                                            </span>
                                                        ) : null}
                                                    </div>
                                                </div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </section>
                    </div>

                    {/* Right Column */}
                    <div className="space-y-6">
                        <BudgetUsageCard
                            title="Monthly Budget"
                            subtitle={`이번 달 사용량 (UTC ${formatUsageMonth(workspaceBudgetUsage?.month)})`}
                            usage={workspaceBudgetUsage ?? null}
                            enabled={!!workspaceBudgetPolicy?.enabled}
                            onConfigure={() => setIsBudgetModalOpen(true)}
                            variant="workspace"
                        />

                        <section className="glass-card rounded-2xl p-6">
                            <h2 className="text-sm font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-4 border-b border-[var(--border)] pb-2">
                                Quick Setup
                            </h2>
                            <div className="relative space-y-4">
                                <div className="absolute left-[9px] top-2 bottom-4 w-0.5 bg-[var(--border)] -z-10" />
                                <SetupStep
                                    idx={1}
                                    checked={hasProviderKeys}
                                    title="Provider 키 등록"
                                    description="OpenAI/Claude/Gemini API keys"
                                    action={!hasProviderKeys ? (
                                        <Link to={orgId ? `/orgs/${orgId}/settings/provider-keys` : '/settings/provider-keys'} className="text-xs text-[var(--primary)] font-medium hover:underline">
                                            등록
                                        </Link>
                                    ) : null}
                                />
                                <SetupStep
                                    idx={2}
                                    checked={hasGatewayApiKeys}
                                    title="Gateway 키 생성"
                                    description="Service API Access Key"
                                    action={!hasGatewayApiKeys ? (
                                        <Link to={orgId ? `/orgs/${orgId}/settings/api-keys` : '/settings/api-keys'} className="text-xs text-[var(--primary)] font-medium hover:underline">
                                            생성
                                        </Link>
                                    ) : null}
                                />
                                <SetupStep
                                    idx={3}
                                    checked={hasVersions}
                                    title="첫 버전 생성"
                                    description="Create v1.0 prompt"
                                    action={!hasVersions && hasPrompts ? (
                                        <Link to={`${basePath}/prompts/${firstPromptId}`} className="text-xs text-[var(--primary)] font-medium hover:underline">
                                            생성
                                        </Link>
                                    ) : null}
                                />
                                <SetupStep
                                    idx={4}
                                    checked={hasRelease}
                                    title="배포"
                                    description="Publish to production"
                                    dim={!hasVersions}
                                    action={!hasRelease && hasVersions ? (
                                        <Link to={`${basePath}/prompts/${firstPromptId}`} className="text-xs text-[var(--primary)] font-medium hover:underline">
                                            배포
                                        </Link>
                                    ) : null}
                                />
                            </div>
                        </section>

                        <section className="glass-card rounded-2xl p-6 flex flex-col h-auto border border-[var(--primary)]/20 shadow-[0_0_20px_rgba(0,0,0,0.3)]">
                            <div className="flex justify-between items-center mb-3">
                                <h2 className="text-sm font-bold text-[var(--foreground)] flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
                                    Unified API Endpoint
                                </h2>
                                <button
                                    type="button"
                                    onClick={() => handleCopyToClipboard(curlExample)}
                                    className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium rounded-md bg-[var(--muted)] hover:bg-[var(--accent)] text-[var(--text-secondary)] transition-colors border border-[var(--border)]"
                                >
                                    {copiedCurl ? (
                                        <>
                                            <Check size={12} />
                                            COPIED
                                        </>
                                    ) : (
                                        <>
                                            <Copy size={12} />
                                            COPY
                                        </>
                                    )}
                                </button>
                            </div>

                            <div className="bg-[var(--muted)] rounded-xl p-4 font-mono text-[11px] text-[var(--foreground)] overflow-x-auto border border-[var(--border)] shadow-inner relative">
                                <div className="absolute top-2 right-2 text-[10px] text-[var(--text-tertiary)] font-bold uppercase select-none">BASH</div>
                                <pre><code>{curlExample}</code></pre>
                            </div>

                            <div className="mt-3 flex gap-2">
                                <div className="flex-1 p-2 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-[10px] font-bold text-blue-700 dark:text-blue-300">Tip</span>
                                    </div>
                                    <p className="text-[10px] text-blue-800/80 dark:text-blue-200/70 leading-relaxed">
                                        Set <code className="bg-blue-500/10 dark:bg-blue-900/50 px-1 rounded text-blue-800 dark:text-blue-200">ragEnabled</code> to <span className="text-[var(--foreground)]">true</span> to use your indexed documents context.
                                    </p>
                                </div>
                            </div>
                        </section>
                    </div>
                </div>
            </div>
        </div>
    );
}

function QuickActionCard({
    to,
    icon,
    title,
    subtitle,
    color,
}: {
    to: string;
    icon: string;
    title: string;
    subtitle: string;
    color: 'purple' | 'teal' | 'blue' | 'pink';
}) {
    const iconBoxClass = (() => {
        switch (color) {
            case 'teal':
                return 'from-teal-500/20 to-teal-800/20 text-teal-400 group-hover:shadow-[0_0_15px_rgba(45,212,191,0.3)]';
            case 'blue':
                return 'from-blue-500/20 to-blue-800/20 text-blue-400 group-hover:shadow-[0_0_15px_rgba(59,130,246,0.3)]';
            case 'pink':
                return 'from-pink-500/20 to-pink-800/20 text-pink-400 group-hover:shadow-[0_0_15px_rgba(236,72,153,0.3)]';
            case 'purple':
            default:
                return 'from-[var(--primary)]/20 to-purple-800/20 text-[var(--primary)] group-hover:shadow-[0_0_15px_rgba(168,85,247,0.3)]';
        }
    })();

    const hoverBorderClass = (() => {
        switch (color) {
            case 'teal':
                return 'hover:border-teal-500/40';
            case 'blue':
                return 'hover:border-blue-500/40';
            case 'pink':
                return 'hover:border-pink-500/40';
            case 'purple':
            default:
                return 'hover:border-[var(--primary)]/40';
        }
    })();

    return (
        <Link
            to={to}
            className={`glass-card p-4 rounded-xl text-left hover:bg-[var(--muted)] transition-all group border border-[var(--border)] ${hoverBorderClass}`}
        >
            <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${iconBoxClass} flex items-center justify-center mb-3 transition-all`}>
                <span className="material-symbols-outlined">{icon}</span>
            </div>
            <div className="font-medium text-sm text-[var(--foreground)]">{title}</div>
            <div className="text-[11px] text-[var(--text-secondary)] mt-1">{subtitle}</div>
        </Link>
    );
}

function SetupStep({
    idx,
    checked,
    title,
    description,
    action,
    dim = false,
}: {
    idx: number;
    checked: boolean;
    title: string;
    description: string;
    action?: ReactNode;
    dim?: boolean;
}) {
    const opacity = dim ? 'opacity-50' : '';

    return (
        <div className={`flex gap-3 relative ${opacity}`}>
            {checked ? (
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-green-500/15 text-green-700 dark:text-green-300 border border-green-500/30 flex items-center justify-center shadow-[0_0_10px_rgba(34,197,94,0.25)] z-10">
                    <span className="material-symbols-outlined text-[14px] font-bold">check</span>
                </span>
            ) : (
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[var(--surface-subtle)] border border-[var(--border)] text-[var(--text-secondary)] flex items-center justify-center z-10 text-[10px] font-bold">
                    {idx}
                </span>
            )}

            <div className="flex-1">
                <div className="flex items-center justify-between gap-3">
                <div className={`text-sm font-medium ${checked ? 'text-[var(--text-secondary)]' : 'text-[var(--foreground)]'}`}>
                        {title}
                    </div>
                    {action}
                </div>
                <div className={`text-[11px] ${checked ? 'text-[var(--text-secondary)]' : 'text-[var(--foreground)]'}`}>
                    {description}
                </div>
            </div>
        </div>
    );
}
