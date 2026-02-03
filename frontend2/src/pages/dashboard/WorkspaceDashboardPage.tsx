import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useOrganizationWorkspaces } from '@/features/workspace/hooks/useOrganizationWorkspaces';
import { organizationApi } from '@/api/organization.api';
import { promptApi } from '@/api/prompt.api';
import { documentApi } from '@/api/document.api';
import {
    MessageSquare,
    FileText,
    Play,
    Activity,
    Plus,
    CheckCircle2,
    Circle
} from 'lucide-react';

export function WorkspaceDashboardPage() {
    const { orgId, workspaceId: workspaceIdParam } = useParams<{ orgId: string; workspaceId: string }>();
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

    // 문서 목록 조회 (통계용)
    const { data: documents } = useQuery({
        queryKey: ['documents', workspaceId],
        queryFn: async () => {
            const response = await documentApi.getDocuments(workspaceId);
            return response.data;
        },
        enabled: !!workspaceId,
    });

    if (isWorkspaceLoading) return <div className="p-8 text-gray-500">로딩 중...</div>;
    if (!workspace) return <div className="p-8 text-gray-500">워크스페이스를 찾을 수 없습니다.</div>;

    const hasProviderKeys = (credentials?.length ?? 0) > 0;

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
                                checked={!!prompts && prompts.length > 0}
                                label="프롬프트 설정 확인"
                                subtext="메인 프롬프트는 1개만 관리합니다."
                                action={(!prompts || prompts.length === 0) && <Link to={`${basePath}/prompts`} className="text-xs text-indigo-600 font-medium hover:underline">설정</Link>}
                            />
                            <CheckListItem
                                checked={false}
                                label="첫 버전 생성"
                                subtext="이전 버전 내용을 복사해 빠르게 시작합니다."
                                action={<Link to={`${basePath}/prompts`} className="text-xs text-indigo-600 font-medium hover:underline">생성</Link>}
                            />
                            <CheckListItem
                                checked={false}
                                label="배포하기"
                                subtext="릴리즈 탭에서 운영 버전을 선택합니다."
                                action={<Link to={`${basePath}/prompts`} className="text-xs text-indigo-600 font-medium hover:underline">배포</Link>}
                            />
                            <CheckListItem
                                checked={!!documents && documents.length > 0}
                                label="지식 데이터 업로드"
                                subtext="RAG 기반 답변이 필요할 때만 추가하세요."
                                action={(!documents || documents.length === 0) && <Link to={`${basePath}/documents`} className="text-xs text-indigo-600 font-medium hover:underline">업로드</Link>}
                            />
                        </div>
                    </section>
                    <section className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                        <h2 className="text-lg font-medium text-gray-900 mb-3">LLM 초심자 가이드</h2>
                        <ol className="space-y-2 text-sm text-gray-600">
                            <li>1. Provider 키 등록 → 사용할 모델 선택</li>
                            <li>2. 버전 생성 → {'{{question}}'} 템플릿 입력</li>
                            <li>3. 릴리즈 → 운영 버전 지정 후 테스트</li>
                        </ol>
                    </section>
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
