import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { promptApi } from '@/api/prompt.api';
import {
    ArrowLeft,
    MessageSquare,
    GitBranch,
    Rocket,
    Play,
    Clock,
    CheckCircle2,
    AlertCircle,
    Copy,
    Save,
    RotateCcw
} from 'lucide-react';
import type { PromptDetailResponse, PromptVersionSummaryResponse } from '@/types/api.types';

// 탭 정의
type TabType = 'overview' | 'versions' | 'release' | 'playground';

export function PromptDetailPage() {
    const { id: workspaceIdStr, promptId: promptIdStr } = useParams<{ id: string; promptId: string }>();
    const workspaceId = Number(workspaceIdStr);
    const promptId = Number(promptIdStr);

    const [activeTab, setActiveTab] = useState<TabType>('overview');

    // 프롬프트 상세 조회
    const { data: prompt, isLoading: isPromptLoading } = useQuery({
        queryKey: ['prompt', workspaceId, promptId],
        queryFn: async () => {
            const response = await promptApi.getPrompt(workspaceId, promptId);
            return response.data;
        },
        enabled: !!workspaceId && !!promptId,
    });

    if (isPromptLoading) return <div className="p-8 text-gray-500">로딩 중...</div>;
    if (!prompt) return <div className="p-8 text-gray-500">프롬프트를 찾을 수 없습니다.</div>;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col gap-4">
                <Link
                    to={`/workspaces/${workspaceId}/prompts`}
                    className="inline-flex items-center text-sm text-gray-500 hover:text-gray-900 transition-colors w-fit"
                >
                    <ArrowLeft size={16} className="mr-1" />
                    목록으로 돌아가기
                </Link>

                <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-lg">
                            <MessageSquare size={24} />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                                {prompt.promptKey}
                                <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-100">
                                    {prompt.status}
                                </span>
                            </h1>
                            <p className="text-gray-500 mt-1">{prompt.description}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="border-b border-gray-200">
                <nav className="flex items-center gap-6">
                    <TabButton
                        active={activeTab === 'overview'}
                        onClick={() => setActiveTab('overview')}
                        icon={<MessageSquare size={18} />}
                        label="개요 (Overview)"
                    />
                    <TabButton
                        active={activeTab === 'versions'}
                        onClick={() => setActiveTab('versions')}
                        icon={<GitBranch size={18} />}
                        label="버전 (Versions)"
                    />
                    <TabButton
                        active={activeTab === 'release'}
                        onClick={() => setActiveTab('release')}
                        icon={<Rocket size={18} />}
                        label="배포 (Release)"
                    />
                    <TabButton
                        active={activeTab === 'playground'}
                        onClick={() => setActiveTab('playground')}
                        icon={<Play size={18} />}
                        label="Playground"
                    />
                </nav>
            </div>

            {/* Tab Content */}
            <div className="min-h-[400px]">
                {activeTab === 'overview' && <OverviewTab prompt={prompt} />}
                {activeTab === 'versions' && <VersionsTab promptId={promptId} />}
                {activeTab === 'release' && <ReleaseTab />}
                {activeTab === 'playground' && <PlaygroundTab />}
            </div>
        </div>
    );
}

function TabButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
    return (
        <button
            onClick={onClick}
            className={`
        flex items-center gap-2 py-4 border-b-2 transition-colors font-medium text-sm
        ${active
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
      `}
        >
            {icon}
            {label}
        </button>
    );
}

// --- Tab Components ---

function OverviewTab({ prompt }: { prompt: PromptDetailResponse }) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                <h3 className="text-lg font-medium text-gray-900 mb-4">기본 정보</h3>
                <dl className="space-y-4">
                    <div>
                        <dt className="text-sm font-medium text-gray-500">Prompt Key</dt>
                        <dd className="mt-1 text-sm text-gray-900 font-mono bg-gray-50 p-2 rounded flex justify-between items-center group">
                            {prompt.promptKey}
                            <button className="text-gray-400 hover:text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Copy size={14} />
                            </button>
                        </dd>
                    </div>
                    <div>
                        <dt className="text-sm font-medium text-gray-500">Description</dt>
                        <dd className="mt-1 text-sm text-gray-900">{prompt.description}</dd>
                    </div>
                    <div>
                        <dt className="text-sm font-medium text-gray-500">Created At</dt>
                        <dd className="mt-1 text-sm text-gray-900">{new Date(prompt.createdAt).toLocaleString()}</dd>
                    </div>
                </dl>
            </div>

            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                <h3 className="text-lg font-medium text-gray-900 mb-4">최신 배포 상태</h3>
                {/* 배포 정보는 아직 API에 없음. 추후 연동 필요 */}
                <div className="flex items-center gap-4 mb-6">
                    <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center text-gray-400">
                        <CheckCircle2 size={24} />
                    </div>
                    <div>
                        <p className="text-sm text-gray-500">현재 서비스 중인 버전</p>
                        <p className="text-2xl font-bold text-gray-900">-</p>
                    </div>
                </div>
                <div className="space-y-2 text-sm">
                    <div className="flex justify-between py-2 border-b border-gray-100">
                        <span className="text-gray-500">배포 일시</span>
                        <span className="text-gray-900">-</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

function VersionsTab({ promptId }: { promptId: number }) {
    const { data: versions, isLoading } = useQuery({
        queryKey: ['promptVersions', promptId],
        queryFn: async () => {
            const response = await promptApi.getVersions(promptId);
            return response.data;
        },
    });

    if (isLoading) return <div className="text-gray-500">버전 정보를 불러오는 중...</div>;

    return (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                <h3 className="font-medium text-gray-900">버전 히스토리</h3>
                <button className="bg-white border border-gray-300 text-gray-700 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">
                    + 새 버전 생성
                </button>
            </div>
            <div className="divide-y divide-gray-100">
                {versions && versions.length > 0 ? (
                    versions.map((ver) => (
                        <div key={ver.id} className="p-4 hover:bg-gray-50 transition-colors flex items-start gap-4">
                            <div className="mt-1">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold bg-gray-100 text-gray-600`}>
                                    v{ver.versionNumber}
                                </div>
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                    <h4 className="text-sm font-semibold text-gray-900">
                                        {ver.title}
                                    </h4>
                                    <span className="text-xs text-gray-500 border border-gray-200 px-1.5 py-0.5 rounded">{ver.provider} / {ver.model}</span>
                                </div>
                                <div className="flex items-center gap-4 text-xs text-gray-400">
                                    <span className="flex items-center gap-1"><Clock size={12} /> {new Date(ver.createdAt).toLocaleDateString()}</span>
                                    {/* CreatedBy는 ID만 있으므로 이름은 표시 불가 (추후 개선) */}
                                    <span>by User {ver.createdBy}</span>
                                </div>
                            </div>
                            <div>
                                <button className="text-gray-400 hover:text-indigo-600 p-2 border border-gray-200 rounded-lg hover:border-indigo-200 transition-colors text-xs font-medium">
                                    상세 보기
                                </button>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="p-8 text-center text-gray-500 text-sm">
                        생성된 버전이 없습니다.
                    </div>
                )}
            </div>
        </div>
    );
}

function ReleaseTab() {
    return (
        <div className="space-y-6">
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                <h3 className="text-lg font-medium text-gray-900 mb-2">Manual Release</h3>
                <p className="text-sm text-gray-500 mb-6">
                    특정 버전을 선택하여 운영 환경(Production)에 배포합니다.
                    배포 즉시 API 응답에 반영됩니다.
                </p>

                <div className="flex items-end gap-4">
                    <div className="flex-1">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            배포할 버전 선택
                        </label>
                        <select className="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" disabled>
                            <option>버전 목록을 불러오는 중...</option>
                        </select>
                    </div>
                    <button className="px-6 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2 disabled:opacity-50" disabled>
                        <Rocket size={18} />
                        배포하기
                    </button>
                </div>
            </div>
        </div>
    );
}

function PlaygroundTab() {
    return (
        <div className="h-[600px] flex gap-4">
            {/* Left: Settings & Prompt */}
            <div className="w-1/2 flex flex-col gap-4">
                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex-1 flex flex-col">
                    <h3 className="font-medium text-gray-900 mb-3 flex items-center justify-between">
                        <span>System Prompt</span>
                        <div className="flex gap-2">
                            <select className="text-xs border border-gray-300 rounded px-2 py-1">
                                <option>GPT-4</option>
                                <option>GPT-3.5-Turbo</option>
                                <option>Claude-3-Opus</option>
                            </select>
                            <button className="text-indigo-600 hover:text-indigo-700 text-xs font-medium flex items-center gap-1">
                                <Save size={12} /> 저장
                            </button>
                        </div>
                    </h3>
                    <textarea
                        className="flex-1 w-full p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                        defaultValue="You are a helpful customer support assistant. Always be polite and concise."
                    />
                </div>
                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm h-1/3 flex flex-col">
                    <h3 className="font-medium text-gray-900 mb-3">User Input (Test Case)</h3>
                    <textarea
                        className="flex-1 w-full p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                        placeholder="테스트할 사용자 입력을 입력하세요..."
                        defaultValue="환불 규정이 어떻게 되나요?"
                    />
                </div>
            </div>

            {/* Right: Output */}
            <div className="w-1/2 bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col">
                <div className="p-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center rounded-t-xl">
                    <h3 className="font-medium text-gray-900">Output</h3>
                    <button className="bg-indigo-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors flex items-center gap-2">
                        <Play size={14} /> Run
                    </button>
                </div>
                <div className="flex-1 p-4 overflow-auto">
                    <div className="prose prose-sm max-w-none">
                        <p>저희 서비스의 환불 규정은 다음과 같습니다:</p>
                        <ul>
                            <li>구매 후 7일 이내: 전액 환불 가능 (단, 미사용 시)</li>
                            <li>구매 후 7일 ~ 30일: 결제 금액의 50% 환불</li>
                            <li>30일 이후: 환불 불가</li>
                        </ul>
                        <p>추가적인 문의사항은 고객센터(1588-0000)로 연락 주시면 상세히 안내해 드리겠습니다.</p>
                    </div>
                </div>
                <div className="p-3 border-t border-gray-200 text-xs text-gray-500 flex justify-between bg-gray-50 rounded-b-xl">
                    <span>Latency: 1.2s</span>
                    <span>Tokens: 154 / 4096</span>
                </div>
            </div>
        </div>
    );
}
