import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useOrganizationWorkspaces } from '@/features/workspace/hooks/useOrganizationWorkspaces';
import { organizationApi } from '@/api/organization.api';
import { promptApi } from '@/api/prompt.api';
import { documentApi } from '@/api/document.api';
import { logsApi } from '@/api/logs.api';
import {
    MessageSquare,
    FileText,
    Play,
    Activity,
    Plus,
    CheckCircle2,
    Circle,
    Copy,
    Check,
    RefreshCw,
    ExternalLink
} from 'lucide-react';
import type { RequestLogResponse, RequestLogStatus } from '@/types/api.types';

function formatShortDateTime(iso: string) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString('ko-KR', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function statusBadgeClass(status: RequestLogStatus) {
    const base = 'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium border';
    switch (status) {
        case 'SUCCESS':
            return `${base} bg-emerald-50 text-emerald-800 border-emerald-200`;
        case 'FAIL':
            return `${base} bg-rose-50 text-rose-800 border-rose-200`;
        case 'BLOCKED':
            return `${base} bg-amber-50 text-amber-900 border-amber-200`;
        case 'IN_PROGRESS':
        default:
            return `${base} bg-gray-50 text-gray-700 border-gray-200`;
    }
}

function modelLabel(log: RequestLogResponse) {
    return log.usedModel || log.requestedModel || '-';
}

export function WorkspaceDashboardPage() {
    const { orgId, workspaceId: workspaceIdParam } = useParams<{ orgId: string; workspaceId: string }>();
    const navigate = useNavigate();
    const parsedWorkspaceId = Number(workspaceIdParam);
    const isValidWorkspaceId = Number.isInteger(parsedWorkspaceId) && parsedWorkspaceId > 0;
    const parsedOrgId = orgId ? Number(orgId) : undefined;
    const resolvedOrgId = typeof parsedOrgId === 'number' && Number.isFinite(parsedOrgId)
        ? parsedOrgId
        : undefined;

    if (!isValidWorkspaceId) {
        return <div className="p-8 text-gray-500">유효하지 않은 워크스페이스입니다.</div>;
    }

    const workspaceId = parsedWorkspaceId;
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
        enabled: !!workspaceId,
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
        enabled: !!workspaceId,
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

    const hasProviderKeys = (credentials?.length ?? 0) > 0;
    const hasGatewayApiKeys = (apiKeys?.length ?? 0) > 0;
    const hasPrompts = (prompts?.length ?? 0) > 0;
    const hasVersions = (versions?.length ?? 0) > 0;
    const hasRelease = !!release;
    const hasDocuments = (documents?.length ?? 0) > 0;
    const allStepsCompleted = hasProviderKeys && hasGatewayApiKeys && hasPrompts && hasVersions && hasRelease;

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
        enabled: !!workspaceId && !!promptKey,
        retry: false,
    });

    const [copied, setCopied] = useState(false);
    
    const handleCopyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }).catch(() => {
            alert('클립보드 복사에 실패했습니다.');
        });
    };

    if (isWorkspaceLoading) return <div className="p-8 text-gray-500">로딩 중...</div>;
    if (!workspace) return <div className="p-8 text-gray-500">워크스페이스를 찾을 수 없습니다.</div>;

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
        <div className="space-y-8">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-semibold text-gray-900">{workspace.displayName}</h1>
                <p className="text-sm text-gray-500 mt-1 font-mono">{workspace.name}</p>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatCard
                    icon={<MessageSquare className="text-indigo-600" />}
                    label="프롬프트 설정"
                    value={prompts?.length.toString() || "0"}
                    trend={prompts ? '버전 중심 관리' : "-"}
                    to={`${basePath}/prompts`}
                />
                <StatCard
                    icon={<FileText className="text-blue-600" />}
                    label="RAG 문서"
                    value={documents?.length.toString() || "0"}
                    trend={documents?.length ? "연동 완료" : "준비 중"}
                    to={`${basePath}/documents`}
                />
                <StatCard
                    icon={<Activity className="text-emerald-600" />}
                    label="API 사용량"
                    value="-"
                    trend="집계 중"
                // to 없으면 클릭 안됨
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column: Quick Actions & Recent Activity */}
                <div className="lg:col-span-2 space-y-8">
                    {/* Quick Actions */}
                    <section>
                        <h2 className="text-lg font-medium text-gray-900 mb-4">빠른 작업</h2>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <QuickActionButton
                                to={`${basePath}/prompts`}
                                icon={<Plus size={20} />}
                                label="프롬프트 설정"
                                description="기본 프롬프트 확인"
                                color="indigo"
                            />
                            <QuickActionButton
                                to={orgId ? `/orgs/${orgId}/settings/provider-keys` : '/settings/provider-keys'}
                                icon={<Activity size={20} />}
                                label="API 키 등록"
                                description="모델 키 먼저 준비"
                                color="emerald"
                            />
                            <QuickActionButton
                                to={`${basePath}/documents`}
                                icon={<FileText size={20} />}
                                label="문서 업로드"
                                description="지식 베이스 추가"
                                color="blue"
                            />
                            <QuickActionButton
                                to={`${basePath}/prompts`}
                                icon={<Play size={20} />}
                                label="버전 관리"
                                description="버전 생성/배포"
                                color="indigo"
                            />
                        </div>
                    </section>

                    <section className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                        <div className="flex items-start justify-between gap-4 mb-4">
                            <div>
                                <h2 className="text-lg font-medium text-gray-900">최근 요청 (이 프롬프트)</h2>
                                <p className="text-sm text-gray-500 mt-1">
                                    메인 프롬프트(<span className="font-mono text-xs">{promptKey || '-'}</span>)의 최신 5개 요청입니다.
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => refetchRecentLogs()}
                                    className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                                >
                                    <RefreshCw size={16} />
                                    새로고침
                                </button>
                                <Link
                                    to={`${basePath}/logs?promptKey=${encodeURIComponent(promptKey)}`}
                                    className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                                >
                                    전체 보기
                                    <ExternalLink size={16} />
                                </Link>
                            </div>
                        </div>

                        {!promptKey ? (
                            <div className="text-sm text-gray-600">
                                아직 프롬프트가 없습니다. 프롬프트를 먼저 생성하세요.
                                <Link to={`${basePath}/prompts`} className="ml-2 text-indigo-600 font-medium hover:underline">
                                    프롬프트 설정
                                </Link>
                            </div>
                        ) : isRecentLogsLoading ? (
                            <div className="space-y-3">
                                {Array.from({ length: 5 }).map((_, idx) => (
                                    <div key={idx} className="h-14 rounded-lg bg-gray-100 animate-pulse" />
                                ))}
                            </div>
                        ) : isRecentLogsError ? (
                            <div className="text-sm text-gray-700">
                                로그를 불러오지 못했습니다.
                                <button
                                    type="button"
                                    onClick={() => refetchRecentLogs()}
                                    className="ml-2 text-indigo-600 font-medium hover:underline"
                                >
                                    재시도
                                </button>
                            </div>
                        ) : (recentLogs?.content?.length ?? 0) === 0 ? (
                            <div className="text-sm text-gray-500">최근 요청이 없습니다. API 호출 후 확인하세요.</div>
                        ) : (
                            <div className="space-y-2">
                                {recentLogs!.content.map((log) => (
                                    <button
                                        key={log.traceId}
                                        type="button"
                                        onClick={() => navigate(`${basePath}/logs/${log.traceId}`)}
                                        className="w-full text-left rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition-colors px-4 py-3"
                                    >
                                        <div className="flex items-center justify-between gap-3">
                                            <div className="min-w-0">
                                                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                                    <span className={statusBadgeClass(log.status)}>{log.status}</span>
                                                    <span className="text-xs text-gray-500">{formatShortDateTime(log.createdAt)}</span>
                                                    <span className="text-xs text-gray-500">
                                                        {log.provider || '-'} · {modelLabel(log)} · HTTP {log.httpStatus ?? '-'}
                                                    </span>
                                                </div>
                                                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-600">
                                                    <span className="font-mono truncate max-w-[420px]">{log.traceId}</span>
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            navigator.clipboard.writeText(log.traceId);
                                                        }}
                                                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-gray-200 bg-white hover:bg-gray-50 text-gray-700"
                                                    >
                                                        <Copy size={14} />
                                                        복사
                                                    </button>
                                                    <span>latency {log.latencyMs ?? '-'}ms</span>
                                                    <span>tokens {log.totalTokens ?? '-'}</span>
                                                    <span
                                                        className={
                                                            log.ragEnabled
                                                                ? 'px-2 py-0.5 rounded-full text-[11px] font-medium bg-indigo-50 text-indigo-700 border border-indigo-200'
                                                                : 'px-2 py-0.5 rounded-full text-[11px] font-medium bg-gray-50 text-gray-700 border border-gray-200'
                                                        }
                                                    >
                                                        RAG {log.ragEnabled ? 'on' : 'off'}
                                                    </span>
                                                    {log.ragEnabled ? (
                                                        <span className="text-gray-500">
                                                            (chunks {log.ragChunksCount ?? '-'} · rag {log.ragLatencyMs ?? '-'}ms)
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

                {/* Right Column: Getting Started */}
                <div className="space-y-6">
                    <section className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                        <h2 className="text-lg font-medium text-gray-900 mb-4">시작하기 가이드</h2>
                        <div className="space-y-4">
                            <CheckListItem
                                checked={hasProviderKeys}
                                label="Provider 키 등록"
                                subtext="OpenAI/Claude/Gemini 키를 먼저 등록합니다."
                                action={!hasProviderKeys && (
                                    <Link to={orgId ? `/orgs/${orgId}/settings/provider-keys` : '/settings/provider-keys'} className="text-xs text-indigo-600 font-medium hover:underline">등록</Link>
                                )}
                            />
                            <CheckListItem
                                checked={hasGatewayApiKeys}
                                label="Gateway API 키 생성"
                                subtext="외부 시스템에서 호출할 API 키를 생성합니다."
                                action={!hasGatewayApiKeys && (
                                    <Link to={orgId ? `/orgs/${orgId}/settings/api-keys` : '/settings/api-keys'} className="text-xs text-indigo-600 font-medium hover:underline">생성</Link>
                                )}
                            />
                            <CheckListItem
                                checked={hasPrompts}
                                label="프롬프트 설정 확인"
                                subtext="메인 프롬프트는 1개만 관리합니다."
                                action={!hasPrompts && <Link to={`${basePath}/prompts`} className="text-xs text-indigo-600 font-medium hover:underline">설정</Link>}
                            />
                            <CheckListItem
                                checked={hasVersions}
                                label="첫 버전 생성"
                                subtext="이전 버전 내용을 복사해 빠르게 시작합니다."
                                action={!hasVersions && hasPrompts && <Link to={`${basePath}/prompts/${firstPromptId}`} className="text-xs text-indigo-600 font-medium hover:underline">생성</Link>}
                            />
                            <CheckListItem
                                checked={hasRelease}
                                label="배포하기"
                                subtext="릴리즈 탭에서 운영 버전을 선택합니다."
                                action={!hasRelease && hasVersions && <Link to={`${basePath}/prompts/${firstPromptId}`} className="text-xs text-indigo-600 font-medium hover:underline">배포</Link>}
                            />
                            <CheckListItem
                                checked={hasDocuments}
                                label="(선택) 지식 데이터 업로드"
                                subtext="RAG 기반 답변이 필요할 때만 추가하세요."
                                action={!hasDocuments && <Link to={`${basePath}/documents`} className="text-xs text-indigo-600 font-medium hover:underline">업로드</Link>}
                            />
                        </div>
                    </section>
                    {allStepsCompleted ? (
                        <section className="bg-gradient-to-br from-green-50 to-emerald-50 p-6 rounded-xl border border-green-200 shadow-sm">
                            <div className="flex items-start justify-between mb-4">
                                <div>
                                    <h2 className="text-lg font-medium text-gray-900 mb-1">설정 완료! 🎉</h2>
                                    <p className="text-sm text-gray-600">아래 예시를 상황에 맞게 수정해서 사용하세요</p>
                                </div>
                                <button
                                    onClick={() => handleCopyToClipboard(curlExample)}
                                    className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                                >
                                    {copied ? (
                                        <>
                                            <Check size={16} className="text-green-600" />
                                            <span>복사됨</span>
                                        </>
                                    ) : (
                                        <>
                                            <Copy size={16} />
                                            <span>복사</span>
                                        </>
                                    )}
                                </button>
                            </div>
                            <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto">
                                <pre className="text-xs text-gray-100 font-mono">
                                    <code>{curlExample}</code>
                                </pre>
                            </div>
                            <div className="mt-4 space-y-3">
                                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                                    <p className="text-xs font-semibold text-amber-900 mb-2">✏️ 수정 가능한 부분</p>
                                    <ul className="space-y-1.5 text-xs text-amber-900">
                                        <li>• <code className="bg-amber-100 px-1.5 py-0.5 rounded font-mono">X-API-Key</code>: Settings에서 생성한 실제 API 키로 교체</li>
                                        <li>• <code className="bg-amber-100 px-1.5 py-0.5 rounded font-mono">promptKey</code>: 사용할 프롬프트 키로 변경 (현재: {safePromptKey})</li>
                                        <li>• <code className="bg-amber-100 px-1.5 py-0.5 rounded font-mono">variables</code>: 프롬프트 템플릿에 맞는 변수로 수정</li>
                                        <li>• <code className="bg-amber-100 px-1.5 py-0.5 rounded font-mono">ragEnabled</code>: RAG 사용 시 <code className="font-mono">true</code>로 변경</li>
                                    </ul>
                                </div>
                                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                                    <p className="text-xs text-blue-900">
                                        <strong>RAG 사용하기:</strong> <code className="bg-blue-100 px-1.5 py-0.5 rounded font-mono">"ragEnabled": true</code>로 변경하면 업로드한 문서를 기반으로 답변합니다.
                                    </p>
                                </div>
                            </div>
                        </section>
                    ) : (
                        <section className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                            <h2 className="text-lg font-medium text-gray-900 mb-3">빠른 시작 가이드</h2>
                            <ol className="space-y-2 text-sm text-gray-600">
                                <li>1. Provider 키 등록 → 사용할 모델 선택</li>
                                <li>2. Gateway API 키 생성 → 외부 호출용</li>
                                <li>3. 버전 생성 → {'{{question}}'} 템플릿 입력</li>
                                <li>4. 릴리즈 → 운영 버전 지정 후 테스트</li>
                            </ol>
                        </section>
                    )}
                </div>
            </div>
        </div>
    );
}

function StatCard({ icon, label, value, trend, to }: { icon: React.ReactNode, label: string, value: string, trend: string, to?: string }) {
    const content = (
        <div className={`bg-white p-6 rounded-xl border border-gray-200 shadow-sm transition-all ${to ? 'hover:border-indigo-300 hover:shadow-md cursor-pointer group' : ''}`}>
            <div className="flex items-start justify-between mb-4">
                <div className={`p-2 bg-gray-50 rounded-lg group-hover:bg-indigo-50 transition-colors`}>{icon}</div>
                <span className="text-xs font-medium text-gray-400 bg-gray-50 px-2 py-1 rounded-full">{trend}</span>
            </div>
            <p className="text-sm text-gray-500 font-medium group-hover:text-indigo-600 transition-colors">{label}</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">{value}</p>
        </div>
    );

    if (to) {
        return <Link to={to} className="block">{content}</Link>;
    }

    return content;
}

function QuickActionButton({ to, icon, label, description, color }: { to: string, icon: React.ReactNode, label: string, description: string, color: 'indigo' | 'blue' | 'emerald' }) {
    const colorClasses = {
        indigo: 'bg-indigo-50 text-indigo-600 group-hover:bg-indigo-100',
        blue: 'bg-blue-50 text-blue-600 group-hover:bg-blue-100',
        emerald: 'bg-emerald-50 text-emerald-600 group-hover:bg-emerald-100',
    };

    return (
        <Link to={to} className="group p-4 bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:border-gray-300 transition-all flex flex-col items-start text-left">
            <div className={`p-2 rounded-lg mb-3 transition-colors ${colorClasses[color]}`}>
                {icon}
            </div>
            <span className="font-semibold text-gray-900 mb-1">{label}</span>
            <span className="text-xs text-gray-500">{description}</span>
        </Link>
    );
}


function CheckListItem({ checked, label, subtext, action }: { checked: boolean, label: string, subtext?: string, action?: React.ReactNode }) {
    return (
        <div className="flex items-start gap-3">
            <div className={`mt-0.5 ${checked ? 'text-green-500' : 'text-gray-300'}`}>
                {checked ? <CheckCircle2 size={18} /> : <Circle size={18} />}
            </div>
            <div className="flex-1">
                <div className="flex items-center justify-between">
                    <p className={`text-sm font-medium ${checked ? 'text-gray-900 line-through opacity-50' : 'text-gray-900'}`}>
                        {label}
                    </p>
                    {action}
                </div>
                {subtext && <p className="text-xs text-gray-500 mt-0.5">{subtext}</p>}
            </div>
        </div>
    );
}
