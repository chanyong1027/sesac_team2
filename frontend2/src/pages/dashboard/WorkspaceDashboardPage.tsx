import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useWorkspaces } from '@/features/workspace/hooks/useWorkspaces';
import { promptApi } from '@/api/prompt.api';
import { documentApi } from '@/api/document.api';
import {
    MessageSquare,
    FileText,
    Play,
    Activity,
    Clock,
    Plus,
    ArrowRight,
    CheckCircle2,
    Circle
} from 'lucide-react';

export function WorkspaceDashboardPage() {
    const { id } = useParams<{ id: string }>();
    const workspaceId = Number(id);

    // 워크스페이스 정보 조회 (캐시 활용)
    const { data: workspaces, isLoading: isWorkspaceLoading } = useWorkspaces();
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

    // 최근 활동 (Mock - 실제 API 구현 시 대체)
    // 간단히 최신 프롬프트나 문서를 보여줄 수도 있음
    const recentPrompts = prompts ? [...prompts].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()).slice(0, 3) : [];

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
                    label="총 프롬프트"
                    value={prompts?.length.toString() || "0"}
                    trend={prompts ? `최근 ${recentPrompts.length}건 활동` : "-"}
                    to={`/workspaces/${id}/prompts`}
                />
                <StatCard
                    icon={<FileText className="text-blue-600" />}
                    label="RAG 문서"
                    value={documents?.length.toString() || "0"}
                    trend={documents?.length ? "연동 완료" : "준비 중"}
                    to={`/workspaces/${id}/documents`}
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
                                to={`/workspaces/${id}/prompts/new`}
                                icon={<Plus size={20} />}
                                label="프롬프트 생성"
                                description="새 템플릿 만들기"
                                color="indigo"
                            />
                            <QuickActionButton
                                to={`/workspaces/${id}/documents`}
                                icon={<FileText size={20} />}
                                label="문서 업로드"
                                description="지식 베이스 추가"
                                color="blue"
                            />
                            <QuickActionButton
                                to={`/workspaces/${id}/playground`}
                                icon={<Play size={20} />}
                                label="Playground"
                                description="프롬프트 테스트"
                                color="emerald"
                            />
                        </div>
                    </section>

                    {/* Recent Activity */}
                    <section>
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-medium text-gray-900">최근 프롬프트</h2>
                            <Link to={`/workspaces/${id}/prompts`} className="text-sm text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1">
                                모두 보기 <ArrowRight size={14} />
                            </Link>
                        </div>
                        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                            {recentPrompts.length > 0 ? (
                                <div className="divide-y divide-gray-100">
                                    {recentPrompts.map((prompt) => (
                                        <ActivityItem
                                            key={prompt.id}
                                            type="prompt"
                                            title={prompt.promptKey}
                                            action={`Status: ${prompt.status}`}
                                            time={new Date(prompt.updatedAt).toLocaleDateString()}
                                            user="User" // 사용자 정보는 현재 API에 없음
                                        />
                                    ))}
                                </div>
                            ) : (
                                <div className="p-8 text-center text-gray-500 text-sm">
                                    최근 활동이 없습니다.
                                </div>
                            )}
                        </div>
                    </section>
                </div>

                {/* Right Column: Getting Started */}
                <div className="space-y-6">
                    <section className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                        <h2 className="text-lg font-medium text-gray-900 mb-4">시작하기 가이드</h2>
                        <div className="space-y-4">
                            <CheckListItem
                                checked={true}
                                label="워크스페이스 생성"
                            />
                            <CheckListItem
                                checked={!!prompts && prompts.length > 0}
                                label="첫 번째 프롬프트 만들기"
                                action={(!prompts || prompts.length === 0) && <Link to={`/workspaces/${id}/prompts/new`} className="text-xs text-indigo-600 font-medium hover:underline">생성</Link>}
                            />
                            <CheckListItem
                                checked={!!documents && documents.length > 0}
                                label="지식 데이터 업로드"
                                action={(!documents || documents.length === 0) && <Link to={`/workspaces/${id}/documents`} className="text-xs text-indigo-600 font-medium hover:underline">업로드</Link>}
                            />
                            <CheckListItem
                                checked={false}
                                label="API 키 발급"
                            />
                        </div>
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

function ActivityItem({ type, title, action, time, user }: { type: 'prompt' | 'document', title: string, action: string, time: string, user: string }) {
    return (
        <div className="p-4 flex items-center gap-4 hover:bg-gray-50 transition-colors">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${type === 'prompt' ? 'bg-indigo-100 text-indigo-600' : 'bg-blue-100 text-blue-600'}`}>
                {type === 'prompt' ? <MessageSquare size={14} /> : <FileText size={14} />}
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{title}</p>
                <p className="text-xs text-gray-500">{action} • by {user}</p>
            </div>
            <div className="text-xs text-gray-400 flexItems-center gap-1 whitespace-nowrap">
                <Clock size={12} /> {time}
            </div>
        </div>
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
