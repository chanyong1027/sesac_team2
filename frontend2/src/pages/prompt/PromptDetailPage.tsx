import { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { promptApi } from '@/api/prompt.api';
import { organizationApi } from '@/api/organization.api';
import { useOrganizationStore } from '@/features/organization/store/organizationStore';
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
import type { PromptDetailResponse, PromptReleaseResponse, PromptVersionSummaryResponse, ProviderType } from '@/types/api.types';

// 탭 정의
type TabType = 'overview' | 'versions' | 'release' | 'playground';

export function PromptDetailPage() {
    const { orgId, workspaceId: workspaceIdStr, promptId: promptIdStr } = useParams<{ orgId: string; workspaceId: string; promptId: string }>();
    const workspaceId = Number(workspaceIdStr);
    const promptId = Number(promptIdStr);
    const basePath = orgId ? `/orgs/${orgId}/workspaces/${workspaceId}` : `/workspaces/${workspaceId}`;

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

    const {
        data: release,
        isLoading: isReleaseLoading,
        isError: isReleaseError,
    } = useQuery({
        queryKey: ['promptRelease', promptId],
        queryFn: async () => {
            try {
                const response = await promptApi.getRelease(promptId);
                return response.data;
            } catch (error) {
                if (axios.isAxiosError(error) && error.response?.status === 404) {
                    return null;
                }
                throw error;
            }
        },
        enabled: !!promptId,
        retry: false,
    });

    if (isPromptLoading) return <div className="p-8 text-gray-500">로딩 중...</div>;
    if (!prompt) return <div className="p-8 text-gray-500">프롬프트를 찾을 수 없습니다.</div>;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col gap-4">
                <Link
                    to={`${basePath}`}
                    className="inline-flex items-center text-sm text-gray-500 hover:text-gray-900 transition-colors w-fit"
                >
                    <ArrowLeft size={16} className="mr-1" />
                    워크스페이스로 돌아가기
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
                {activeTab === 'overview' && (
                    <OverviewTab
                        prompt={prompt}
                        release={release ?? null}
                        isReleaseLoading={isReleaseLoading}
                        isReleaseError={isReleaseError}
                    />
                )}
                {activeTab === 'versions' && <VersionsTab promptId={promptId} />}
                {activeTab === 'release' && <ReleaseTab promptId={promptId} />}
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

function OverviewTab({
    prompt,
    release,
    isReleaseLoading,
    isReleaseError,
}: {
    prompt: PromptDetailResponse;
    release: PromptReleaseResponse | null;
    isReleaseLoading: boolean;
    isReleaseError: boolean;
}) {
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
                <div className="flex items-center gap-4 mb-6">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center ${release ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-500'}`}>
                        {release ? <CheckCircle2 size={24} /> : <AlertCircle size={24} />}
                    </div>
                    <div>
                        <p className="text-sm text-gray-500">현재 서비스 중인 버전</p>
                        {isReleaseLoading ? (
                            <p className="text-2xl font-bold text-gray-900">불러오는 중...</p>
                        ) : (
                            <p className="text-2xl font-bold text-gray-900">
                                {release ? `v${release.activeVersionNo}` : '릴리즈 없음'}
                            </p>
                        )}
                    </div>
                </div>
                <div className="space-y-2 text-sm">
                    <div className="flex justify-between py-2 border-b border-gray-100">
                        <span className="text-gray-500">배포 일시</span>
                        <span className="text-gray-900">
                            {release ? new Date(release.releasedAt).toLocaleString('ko-KR') : '-'}
                        </span>
                    </div>
                </div>
                {isReleaseError && (
                    <p className="mt-4 text-xs text-rose-600">
                        릴리즈 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.
                    </p>
                )}
                {!isReleaseLoading && !release && !isReleaseError && (
                    <p className="mt-4 text-xs text-amber-600">
                        릴리즈된 버전이 없습니다. 버전 탭에서 새 버전을 만든 뒤 릴리즈 탭에서 배포 버전을 선택하세요.
                    </p>
                )}
            </div>
        </div>
    );
}

function VersionsTab({ promptId }: { promptId: number }) {
    const queryClient = useQueryClient();
    const { currentOrgId } = useOrganizationStore();
    const { orgId } = useParams<{ orgId: string }>();
    const parsedOrgId = orgId ? Number(orgId) : undefined;
    const resolvedOrgId = typeof parsedOrgId === 'number' && Number.isFinite(parsedOrgId)
        ? parsedOrgId
        : currentOrgId;
    const isResolvedOrgId = typeof resolvedOrgId === 'number' && !Number.isNaN(resolvedOrgId);
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [detailVersionId, setDetailVersionId] = useState<number | null>(null);
    const [form, setForm] = useState({
        title: '',
        provider: 'OPENAI' as ProviderType,
        model: '',
        systemPrompt: '',
        userTemplate: '',
        modelConfig: '',
    });
    const [configError, setConfigError] = useState<string | null>(null);
    const presets = [
        {
            label: 'CS-Bot 기본',
            data: {
                title: 'CS-Bot 기본 응답',
                provider: 'OPENAI' as const,
                model: 'gpt-4o-mini',
                systemPrompt: '너는 고객 문의를 친절하고 간결하게 안내하는 CS 챗봇이다.',
                userTemplate: '사용자 질문: {{question}}\n답변:',
                modelConfig: '{"temperature":0.2,"topP":0.9,"maxTokens":512}',
            },
        },
        {
            label: 'FAQ 요약',
            data: {
                title: 'FAQ 요약 응답',
                provider: 'ANTHROPIC' as const,
                model: 'claude-3-5-sonnet',
                systemPrompt: 'FAQ를 근거로 핵심만 요약해 답변한다.',
                userTemplate: '질문: {{question}}\nFAQ:\n{{context}}\n요약 답변:',
                modelConfig: '{"temperature":0.1,"topP":0.8,"maxTokens":400}',
            },
        },
        {
            label: 'RAG 응답',
            data: {
                title: 'RAG 기반 응답',
                provider: 'GEMINI' as const,
                model: 'gemini-2.0-flash',
                systemPrompt: '문서 컨텍스트를 근거로 답하고, 모르면 모른다고 말한다.',
                userTemplate: '컨텍스트:\n{{context}}\n질문: {{question}}\n답변:',
                modelConfig: '{"temperature":0.3,"topP":0.9,"maxTokens":600}',
            },
        },
    ];
    const providerLabel: Record<string, string> = {
        OPENAI: 'OpenAI',
        ANTHROPIC: 'Anthropic',
        GEMINI: 'Gemini',
    };
    const normalizeProviderKey = (raw: string) => {
        const normalized = raw.trim().toLowerCase();
        if (normalized === 'google') return 'GEMINI';
        if (normalized === 'claude') return 'ANTHROPIC';
        return normalized.toUpperCase();
    };

    const { data: credentials, isLoading: isCredsLoading } = useQuery({
        queryKey: ['provider-credentials', resolvedOrgId],
        queryFn: async () => {
            if (!isResolvedOrgId) return [];
            const response = await organizationApi.getCredentials(resolvedOrgId);
            return response.data;
        },
        enabled: isResolvedOrgId,
    });

    const {
        data: modelAllowlist,
        isLoading: isAllowlistLoading,
        isError: isAllowlistError,
    } = useQuery({
        queryKey: ['model-allowlist'],
        queryFn: async () => {
            const response = await promptApi.getModelAllowlist();
            return response.data;
        },
    });

    const availableProviders = Array.from(
        new Set((credentials || []).map((cred) => normalizeProviderKey(cred.provider)))
    ).filter((provider) => providerLabel[provider]);

    const filteredPresets = presets.filter((preset) => availableProviders.includes(preset.data.provider));

    const providerModels = useMemo(() => {
        if (!modelAllowlist) return [];
        return modelAllowlist[form.provider] ?? [];
    }, [modelAllowlist, form.provider]);

    useEffect(() => {
        if (!availableProviders.length) return;
        if (!availableProviders.includes(form.provider)) {
            setForm((prev) => ({ ...prev, provider: availableProviders[0] as ProviderType }));
        }
    }, [availableProviders, form.provider]);

    useEffect(() => {
        if (!providerModels.length) return;
        if (!providerModels.includes(form.model)) {
            setForm((prev) => ({ ...prev, model: providerModels[0] }));
        }
    }, [providerModels, form.model]);

    const { data: versions, isLoading } = useQuery({
        queryKey: ['promptVersions', promptId],
        queryFn: async () => {
            const response = await promptApi.getVersions(promptId);
            return response.data;
        },
    });
    const { data: versionDetail, isLoading: isDetailLoading } = useQuery({
        queryKey: ['promptVersionDetail', promptId, detailVersionId],
        queryFn: async () => {
            if (!detailVersionId) return null;
            const response = await promptApi.getVersion(promptId, detailVersionId);
            return response.data;
        },
        enabled: !!detailVersionId,
    });

    const createMutation = useMutation({
        mutationFn: async () => {
            let parsedConfig: Record<string, any> | undefined = undefined;
            if (form.modelConfig.trim()) {
                try {
                    parsedConfig = JSON.parse(form.modelConfig);
                    setConfigError(null);
                } catch (error) {
                    setConfigError('modelConfig는 올바른 JSON 형식이어야 합니다.');
                    throw error;
                }
            }

            return promptApi.createVersion(promptId, {
                title: form.title.trim(),
                provider: form.provider,
                model: form.model.trim(),
                systemPrompt: form.systemPrompt.trim() || undefined,
                userTemplate: form.userTemplate.trim() || undefined,
                modelConfig: parsedConfig,
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['promptVersions', promptId] });
            setIsCreateOpen(false);
            setForm({
                title: '',
                provider: 'OPENAI',
                model: '',
                systemPrompt: '',
                userTemplate: '',
                modelConfig: '',
            });
            setConfigError(null);
        },
    });

    if (isLoading) return <div className="text-gray-500">버전 정보를 불러오는 중...</div>;

    return (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                <h3 className="font-medium text-gray-900">버전 히스토리</h3>
                <button
                    onClick={() => setIsCreateOpen(true)}
                    className="bg-white border border-gray-300 text-gray-700 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
                >
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
                                <button
                                    onClick={() => setDetailVersionId(ver.id)}
                                    className="text-gray-400 hover:text-indigo-600 p-2 border border-gray-200 rounded-lg hover:border-indigo-200 transition-colors text-xs font-medium"
                                >
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

            {isCreateOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    <div
                        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                        onClick={() => setIsCreateOpen(false)}
                    />
                    <div className="relative w-full max-w-2xl mx-4 bg-white rounded-xl shadow-xl border border-gray-100 text-gray-900">
                        <div className="p-6 border-b border-gray-100">
                            <h4 className="text-lg font-semibold text-gray-900">새 버전 생성</h4>
                            <p className="text-sm text-gray-500 mt-1">
                                버전은 테스트/개발용 시나리오를 관리하고, 릴리즈 탭에서 배포 버전을 선택합니다.
                            </p>
                        </div>
                        <div className="p-6 space-y-4">
                            {!isCredsLoading && availableProviders.length === 0 && (
                                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
                                    등록된 Provider 키가 없습니다. 먼저 Provider 키를 등록해주세요.
                                    <div className="mt-2">
                                        <Link
                                            to={orgId ? `/orgs/${orgId}/settings/provider-keys` : '/settings/provider-keys'}
                                            className="text-amber-800 font-semibold hover:underline"
                                        >
                                            Provider 키 등록하러 가기
                                        </Link>
                                    </div>
                                </div>
                            )}
                            <div className="flex flex-wrap gap-2">
                                {filteredPresets.map((preset) => (
                                    <button
                                        key={preset.label}
                                        type="button"
                                        onClick={() => {
                                            setForm({
                                                ...form,
                                                ...preset.data,
                                            });
                                            setConfigError(null);
                                        }}
                                        className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors"
                                    >
                                        예시 적용: {preset.label}
                                    </button>
                                ))}
                                {!filteredPresets.length && (
                                    <span className="text-xs text-gray-400">
                                        등록된 Provider 기준으로 사용할 수 있는 예시가 없습니다.
                                    </span>
                                )}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">제목</label>
                                <input
                                    type="text"
                                    value={form.title}
                                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                                    placeholder="예: 2026-02-01 실험용"
                                />
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label htmlFor="prompt-provider" className="block text-sm font-medium text-gray-700 mb-1">Provider</label>
                                    <select
                                        id="prompt-provider"
                                        value={form.provider}
                                        onChange={(e) => setForm({ ...form, provider: e.target.value as typeof form.provider })}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                                        disabled={availableProviders.length === 0}
                                    >
                                        {availableProviders.length === 0 && (
                                            <option value="">등록된 Provider 없음</option>
                                        )}
                                        {availableProviders.map((provider) => (
                                            <option key={provider} value={provider}>
                                                {providerLabel[provider] || provider}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label htmlFor="prompt-model" className="block text-sm font-medium text-gray-700 mb-1">Model</label>
                                    <select
                                        id="prompt-model"
                                        value={form.model}
                                        onChange={(e) => setForm({ ...form, model: e.target.value })}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                                        disabled={isAllowlistLoading || isAllowlistError || providerModels.length === 0}
                                    >
                                        {isAllowlistLoading && <option value="">모델 목록 불러오는 중...</option>}
                                        {!isAllowlistLoading && providerModels.length === 0 && (
                                            <option value="">사용 가능한 모델 없음</option>
                                        )}
                                        {providerModels.map((model) => (
                                            <option key={model} value={model}>
                                                {model}
                                            </option>
                                        ))}
                                    </select>
                                    {isAllowlistError && (
                                        <p className="mt-1 text-xs text-rose-600">모델 목록을 불러오지 못했습니다.</p>
                                    )}
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">System Prompt</label>
                                <textarea
                                    value={form.systemPrompt}
                                    onChange={(e) => setForm({ ...form, systemPrompt: e.target.value })}
                                    rows={3}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none resize-none"
                                    placeholder="시스템 프롬프트를 입력하세요."
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">User Template</label>
                                <textarea
                                    value={form.userTemplate}
                                    onChange={(e) => setForm({ ...form, userTemplate: e.target.value })}
                                    rows={4}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none resize-none"
                                    placeholder="사용자 입력 템플릿을 입력하세요."
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Model Config (JSON)</label>
                                <textarea
                                    value={form.modelConfig}
                                    onChange={(e) => setForm({ ...form, modelConfig: e.target.value })}
                                    rows={3}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none font-mono text-xs resize-none"
                                    placeholder='예: {"temperature":0.2,"topP":0.9}'
                                />
                                <p className="mt-1 text-xs text-gray-400">JSON 형식으로 입력하세요. 비워두면 기본값이 사용됩니다.</p>
                                {configError && (
                                    <p className="mt-1 text-xs text-rose-600">{configError}</p>
                                )}
                            </div>
                        </div>
                        <div className="p-6 border-t border-gray-100 flex justify-end gap-3">
                            <button
                                onClick={() => setIsCreateOpen(false)}
                                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                            >
                                취소
                            </button>
                            <button
                                onClick={() => createMutation.mutate()}
                                disabled={
                                    !form.model.trim() ||
                                    createMutation.isPending ||
                                    availableProviders.length === 0 ||
                                    isAllowlistLoading ||
                                    isAllowlistError ||
                                    providerModels.length === 0
                                }
                                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
                            >
                                {createMutation.isPending ? '생성 중...' : '버전 생성'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {detailVersionId && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    <div
                        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                        onClick={() => setDetailVersionId(null)}
                    />
                    <div className="relative w-full max-w-3xl mx-4 bg-white rounded-xl shadow-xl border border-gray-100 text-gray-900">
                        <div className="p-6 border-b border-gray-100 flex items-start justify-between">
                            <div>
                                <h4 className="text-lg font-semibold text-gray-900">버전 상세</h4>
                                <p className="text-sm text-gray-500 mt-1">버전의 설정과 템플릿을 확인합니다.</p>
                            </div>
                            <button
                                onClick={() => setDetailVersionId(null)}
                                className="text-gray-400 hover:text-gray-600"
                            >
                                ✕
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            {isDetailLoading || !versionDetail ? (
                                <div className="text-sm text-gray-500">버전 정보를 불러오는 중...</div>
                            ) : (
                                <>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div>
                                            <div className="text-xs text-gray-500">Version</div>
                                            <div className="text-sm font-semibold text-gray-900">v{versionDetail.versionNumber}</div>
                                        </div>
                                        <div>
                                            <div className="text-xs text-gray-500">Provider / Model</div>
                                            <div className="text-sm font-semibold text-gray-900">
                                                {versionDetail.provider} / {versionDetail.model}
                                            </div>
                                        </div>
                                        <div>
                                            <div className="text-xs text-gray-500">Title</div>
                                            <div className="text-sm text-gray-900">{versionDetail.title || '-'}</div>
                                        </div>
                                        <div>
                                            <div className="text-xs text-gray-500">Created At</div>
                                            <div className="text-sm text-gray-900">{new Date(versionDetail.createdAt).toLocaleString()}</div>
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-xs text-gray-500 mb-2">System Prompt</div>
                                        <pre className="whitespace-pre-wrap text-sm text-gray-900 bg-gray-50 border border-gray-200 rounded-lg p-3">
                                            {versionDetail.systemPrompt || '-'}
                                        </pre>
                                    </div>
                                    <div>
                                        <div className="text-xs text-gray-500 mb-2">User Template</div>
                                        <pre className="whitespace-pre-wrap text-sm text-gray-900 bg-gray-50 border border-gray-200 rounded-lg p-3">
                                            {versionDetail.userTemplate || '-'}
                                        </pre>
                                    </div>
                                    <div>
                                        <div className="text-xs text-gray-500 mb-2">Model Config</div>
                                        <pre className="whitespace-pre-wrap text-xs text-gray-800 bg-gray-50 border border-gray-200 rounded-lg p-3">
                                            {versionDetail.modelConfig ? JSON.stringify(versionDetail.modelConfig, null, 2) : '-'}
                                        </pre>
                                    </div>
                                </>
                            )}
                        </div>
                        <div className="p-6 border-t border-gray-100 flex justify-end">
                            <button
                                onClick={() => setDetailVersionId(null)}
                                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                            >
                                닫기
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function ReleaseTab({ promptId }: { promptId: number }) {
    const queryClient = useQueryClient();
    const [selectedVersionId, setSelectedVersionId] = useState<number | null>(null);
    const [releaseReason, setReleaseReason] = useState('');
    const [releaseMessage, setReleaseMessage] = useState<string | null>(null);
    const [releaseError, setReleaseError] = useState<string | null>(null);

    const { data: versions, isLoading: isVersionsLoading } = useQuery({
        queryKey: ['promptVersions', promptId],
        queryFn: async () => {
            const response = await promptApi.getVersions(promptId);
            return response.data;
        },
    });

    const releaseMutation = useMutation({
        mutationFn: async () => {
            if (!selectedVersionId) {
                throw new Error('버전을 선택해주세요.');
            }
            return promptApi.releasePrompt(promptId, {
                versionId: selectedVersionId,
                reason: releaseReason.trim() || undefined,
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['promptRelease', promptId] });
            queryClient.invalidateQueries({ queryKey: ['promptReleaseHistory', promptId] }); // Add this line
            setReleaseReason('');
            setReleaseMessage('배포가 완료되었습니다.');
            setReleaseError(null);
        },
        onError: (error) => {
            console.error('Release failed:', error);
            setReleaseError('배포에 실패했습니다. 잠시 후 다시 시도해주세요.');
            setReleaseMessage(null);
        },
    });

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
                        <select
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500"
                            value={selectedVersionId ?? ''}
                            onChange={(e) => setSelectedVersionId(Number(e.target.value) || null)}
                            disabled={isVersionsLoading || !versions?.length}
                        >
                            <option value="">
                                {isVersionsLoading
                                    ? '버전 목록을 불러오는 중...'
                                    : versions?.length
                                        ? '배포할 버전을 선택하세요'
                                        : '등록된 버전이 없습니다'}
                            </option>
                            {versions?.map((ver) => (
                                <option key={ver.id} value={ver.id}>
                                    v{ver.versionNumber} · {ver.title || ver.model} ({ver.provider}/{ver.model})
                                </option>
                            ))}
                        </select>
                        <p className="mt-2 text-xs text-gray-400">
                            배포할 버전을 선택하면 현재 서비스 버전이 즉시 변경됩니다.
                        </p>
                        {!isVersionsLoading && !versions?.length && (
                            <p className="mt-2 text-xs text-amber-600">
                                배포할 버전이 없습니다. 먼저 버전을 생성해주세요.
                            </p>
                        )}
                    </div>
                    <button
                        onClick={() => releaseMutation.mutate()}
                        disabled={!selectedVersionId || releaseMutation.isPending}
                        className="px-6 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2 disabled:opacity-50"
                    >
                        <Rocket size={18} />
                        {releaseMutation.isPending ? '배포 중...' : '배포하기'}
                    </button>
                </div>

                <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">배포 사유 (선택)</label>
                    <input
                        value={releaseReason}
                        onChange={(e) => setReleaseReason(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 placeholder:text-gray-400 outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                        placeholder="예: 최신 FAQ 반영"
                    />
                </div>
                {releaseMessage && (
                    <p className="mt-3 text-sm text-emerald-600">{releaseMessage}</p>
                )}
                {releaseError && (
                    <p className="mt-3 text-sm text-rose-600">{releaseError}</p>
                )}
            </div>

            {/* Release History */}
            <ReleaseHistoryList promptId={promptId} activeVersionId={versions?.find(v => v.id === selectedVersionId)?.id} />
        </div>
    );
}

function ReleaseHistoryList({ promptId, activeVersionId }: { promptId: number; activeVersionId?: number }) {
    const queryClient = useQueryClient();
    const [rollbackTargetId, setRollbackTargetId] = useState<number | null>(null);
    const [rollbackReason, setRollbackReason] = useState('');
    const [rollbackError, setRollbackError] = useState<string | null>(null);

    const { data: history, isLoading } = useQuery({
        queryKey: ['promptReleaseHistory', promptId],
        queryFn: async () => {
            const response = await promptApi.getReleaseHistory(promptId);
            return response.data;
        },
    });

    const rollbackMutation = useMutation({
        mutationFn: async () => {
            if (!rollbackTargetId) return;
            return promptApi.rollbackPrompt(promptId, {
                targetVersionId: rollbackTargetId,
                reason: rollbackReason.trim() || undefined,
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['promptReleaseHistory', promptId] });
            queryClient.invalidateQueries({ queryKey: ['promptRelease', promptId] });
            setRollbackTargetId(null);
            setRollbackReason('');
            setRollbackError(null);
        },
        onError: (error) => {
            console.error('Rollback failed:', error);
            setRollbackError('롤백에 실패했습니다. 잠시 후 다시 시도해주세요.');
        },
    });

    if (isLoading) return <div className="text-gray-500">배포 이력을 불러오는 중...</div>;

    return (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-200 bg-gray-50">
                <h3 className="font-medium text-gray-900">배포 이력</h3>
            </div>
            <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm whitespace-nowrap">
                    <thead className="uppercase tracking-wider border-b border-gray-200 bg-gray-50">
                        <tr>
                            <th scope="col" className="px-6 py-3 text-gray-500 font-medium">Version</th>
                            <th scope="col" className="px-6 py-3 text-gray-500 font-medium">Released At</th>
                            <th scope="col" className="px-6 py-3 text-gray-500 font-medium">Reason</th>
                            <th scope="col" className="px-6 py-3 text-gray-500 font-medium">By</th>
                            <th scope="col" className="px-6 py-3 text-gray-500 font-medium text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {history && history.length > 0 ? (
                            history.map((item, index) => {
                                const isLatest = index === 0;
                                return (
                                    <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4 font-medium text-gray-900">
                                            v{item.toVersionNo ?? '?'}
                                            {isLatest && (
                                                <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                                                    Active
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-gray-500">
                                            {new Date(item.createdAt).toLocaleString()}
                                        </td>
                                        <td className="px-6 py-4 text-gray-500">
                                            {item.reason || '-'}
                                        </td>
                                        <td className="px-6 py-4 text-gray-500">
                                            {item.changedByName}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            {!isLatest && (
                                                <button
                                                    onClick={() => setRollbackTargetId(item.toVersionId)}
                                                    className="text-indigo-600 hover:text-indigo-900 font-medium text-xs flex items-center justify-end gap-1 ml-auto"
                                                >
                                                    <RotateCcw size={14} />
                                                    Rollback
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })
                        ) : (
                            <tr>
                                <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                                    배포 이력이 없습니다.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Rollback Modal */}
            {rollbackTargetId && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    <div
                        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                        onClick={() => setRollbackTargetId(null)}
                    />
                    <div className="relative w-full max-w-md mx-4 bg-white rounded-xl shadow-xl border border-gray-100 text-gray-900 p-6">
                        <h4 className="text-lg font-bold text-gray-900 mb-2 flex items-center gap-2">
                            <RotateCcw size={20} className="text-amber-500" />
                            버전 롤백 확인
                        </h4>
                        <p className="text-sm text-gray-600 mb-4">
                            이전 버전으로 롤백하시겠습니까? 롤백은 새로운 배포 이력으로 기록되며, 즉시 반영됩니다.
                        </p>

                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 mb-1">롤백 사유</label>
                            <input
                                value={rollbackReason}
                                onChange={(e) => setRollbackReason(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                                placeholder="예: 이전 버전이 더 안정적임"
                            />
                        </div>

                        {rollbackError && (
                            <p className="mb-4 text-sm text-rose-600 bg-rose-50 p-2 rounded">
                                {rollbackError}
                            </p>
                        )}

                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setRollbackTargetId(null)}
                                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                            >
                                취소
                            </button>
                            <button
                                onClick={() => rollbackMutation.mutate()}
                                disabled={rollbackMutation.isPending}
                                className="px-4 py-2 text-sm font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700 disabled:opacity-50"
                            >
                                {rollbackMutation.isPending ? '처리 중...' : '롤백 실행'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function PlaygroundTab() {
    const { orgId, workspaceId: workspaceIdStr, promptId: promptIdStr } = useParams<{ orgId: string; workspaceId: string; promptId: string }>();
    const promptId = Number(promptIdStr);
    const workspaceId = Number(workspaceIdStr);
    const { currentOrgId } = useOrganizationStore();
    const parsedOrgId = orgId ? Number(orgId) : undefined;
    const resolvedOrgId = typeof parsedOrgId === 'number' && Number.isFinite(parsedOrgId)
        ? parsedOrgId
        : currentOrgId;

    const [selectedApiKey, setSelectedApiKey] = useState<string>('');
    const [apiKeyInputType, setApiKeyInputType] = useState<'select' | 'manual'>('select');
    const [manualApiKey, setManualApiKey] = useState('');

    // Gateway Request State
    const [inputVariables, setInputVariables] = useState<Record<string, string>>({});
    const [ragEnabled, setRagEnabled] = useState(false);
    const [gatewayResponse, setGatewayResponse] = useState<any>(null);
    const [chatHistory, setChatHistory] = useState<{ role: string; content: string }[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Fetch Prompt Key
    const { data: prompt } = useQuery({
        queryKey: ['prompt', workspaceId, promptId],
        queryFn: async () => {
            const response = await promptApi.getPrompt(workspaceId, promptId);
            return response.data;
        },
        enabled: !!workspaceId && !!promptId,
    });

    // Fetch API Keys
    const { data: apiKeys } = useQuery({
        queryKey: ['organizationApiKeys', resolvedOrgId],
        queryFn: async () => {
            if (!resolvedOrgId) return [];
            const response = await organizationApi.getApiKeys(resolvedOrgId);
            return response.data;
        },
        enabled: !!resolvedOrgId,
    });

    useEffect(() => {
        if (apiKeys && apiKeys.length > 0 && apiKeyInputType === 'select' && !selectedApiKey) {
            // Select the first active key by default
            const firstActive = apiKeys.find(k => k.status === 'ACTIVE');
            if (firstActive) setSelectedApiKey(firstActive.keyPrefix + '...'); // We can't get full key, but we need a valid key for request.
            // Actually, we can't use the prefix for the request. The user must copy/paste a full key OR we need to trust the backend to allow test calls.
            // Wait, for SECURITY, the backend typically doesn't return the full key again.
            // Challenge: How to test without the full key if the user forgot it?
            // Solution: For now, we MUST ask the user to input the key MANUALLY or we provide a way to "Test with Internal Auth" if supported.
            // STRICT REQUIREMENT: "User issued API key".
            // So we can only list the keys for reference, but the user MUST input the FULL key manually if we don't store it.
            // However, usually "Playground" implies easy testing. 
            // Let's assume for this "Gateway Simulation", the user MUST provide the FULL key.
            // I will make the default 'manual' entry, but show a dropdown of "Active Keys" just to show we know them, 
            // but we can't fill the value because we don't have it.
            // Oh, wait. If I am the developer, I might have the key.
            // Let's adjust: Default to Manual Input.
            setApiKeyInputType('manual');
        }
    }, [apiKeys]);

    const handleRun = async () => {
        if (!manualApiKey.trim()) {
            setError('API Key를 입력해주세요.');
            return;
        }
        if (!prompt?.promptKey) {
            setError('프롬프트 정보를 불러올 수 없습니다.');
            return;
        }

        setIsLoading(true);
        setError(null);
        setGatewayResponse(null);

        // Prepare variables (assuming single 'question' variable for now, or parsing from UI if we add variable builder)
        // For simplicity, we'll treat the main textarea as the 'question' variable, or a JSON input?
        // Let's use a simple JSON input for variables to be flexible, or just a "question" field.
        // Given previous conversation context ("test case"), let's provide a "User Input" text area and map it to 'question' variable (common pattern).
        const variables = {
            ...inputVariables
        };

        try {
            // Gateway API Call
            const response = await axios.post('http://localhost:8080/v1/chat/completions', {
                workspaceId: workspaceId,
                promptKey: prompt.promptKey,
                variables: variables,
                ragEnabled: ragEnabled
            }, {
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-Key': manualApiKey.trim()
                }
            });

            setGatewayResponse(response.data);
            if (response.data.answer) {
                setChatHistory(prev => [...prev,
                { role: 'user', content: variables.question || JSON.stringify(variables) },
                { role: 'assistant', content: response.data.answer }
                ]);
            }
        } catch (err: any) {
            console.error(err);
            setError(err.response?.data?.message || 'Gateway 요청에 실패했습니다.');
            setGatewayResponse(err.response?.data || { error: 'Unknown error' });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="h-[600px] flex gap-6">
            {/* Left Panel: Configuration & Input */}
            <div className="w-1/3 flex flex-col gap-4 overflow-y-auto pr-2">

                {/* 1. API Key Config */}
                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                    <h3 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                        Authentication
                    </h3>
                    <div className="space-y-3">
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Organization API Key</label>
                            <input
                                type="password"
                                value={manualApiKey}
                                onChange={(e) => setManualApiKey(e.target.value)}
                                placeholder="sk-org-..."
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-indigo-500 outline-none"
                            />
                            <p className="mt-1 text-xs text-gray-400">
                                Settings &gt; API Keys에서 발급받은 키를 입력하세요.
                            </p>
                        </div>
                    </div>
                </div>

                {/* 2. Request Config */}
                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex-1">
                    <h3 className="font-medium text-gray-900 mb-3">Request Parameters</h3>

                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <label className="text-sm text-gray-700 font-medium">RAG (Retrieval)</label>
                            <button
                                onClick={() => setRagEnabled(!ragEnabled)}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${ragEnabled ? 'bg-indigo-600' : 'bg-gray-200'}`}
                            >
                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${ragEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                            </button>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Variable: question</label>
                            <textarea
                                value={inputVariables.question || ''}
                                onChange={(e) => setInputVariables({ ...inputVariables, question: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none h-24"
                                placeholder="질문을 입력하세요..."
                            />
                        </div>

                        {/* Additional variables can be added here if needed */}

                        <div className="pt-2">
                            <button
                                onClick={handleRun}
                                disabled={isLoading || !manualApiKey}
                                className="w-full py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {isLoading ? <Clock size={16} className="animate-spin" /> : <Play size={16} />}
                                Run Request
                            </button>
                        </div>

                        {error && (
                            <div className="p-3 bg-red-50 text-red-600 text-xs rounded-lg break-all">
                                {error}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Right Panel: Response & Logs */}
            <div className="w-2/3 flex flex-col gap-4">
                {/* Response Visualizer */}
                <div className="flex-1 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
                    <div className="p-3 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
                        <h3 className="font-medium text-gray-900">Chat Preview</h3>
                        {gatewayResponse && (
                            <span className="text-xs text-green-600 font-medium px-2 py-0.5 bg-green-50 rounded border border-green-100">
                                200 OK
                            </span>
                        )}
                    </div>
                    <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-slate-50">
                        {chatHistory.length === 0 ? (
                            <div className="h-full flex items-center justify-center text-gray-400 text-sm">
                                <p>요청을 보내면 여기에 대화 내용이 표시됩니다.</p>
                            </div>
                        ) : (
                            chatHistory.map((msg, idx) => (
                                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${msg.role === 'user'
                                        ? 'bg-indigo-600 text-white rounded-br-none'
                                        : 'bg-white border border-gray-200 text-gray-800 rounded-bl-none shadow-sm'
                                        }`}>
                                        <div className="whitespace-pre-wrap">{msg.content}</div>
                                    </div>
                                </div>
                            ))
                        )}
                        {isLoading && (
                            <div className="flex justify-start">
                                <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-none px-4 py-3 shadow-sm">
                                    <div className="flex gap-1">
                                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Raw JSON Response */}
                <div className="h-1/3 bg-gray-900 rounded-xl border border-gray-800 shadow-sm overflow-hidden flex flex-col">
                    <div className="p-2 border-b border-gray-800 bg-gray-950 flex justify-between items-center px-4">
                        <h3 className="text-xs font-mono text-gray-400">Raw JSON Response</h3>
                        {gatewayResponse && (
                            <div className="flex gap-3 text-xs text-gray-500 font-mono">
                                {gatewayResponse.traceId && <span>Trace: {gatewayResponse.traceId.substring(0, 8)}...</span>}
                                <span>Tokens: {gatewayResponse.usage?.totalTokens || '-'}</span>
                            </div>
                        )}
                    </div>
                    <div className="flex-1 p-4 overflow-auto">
                        <pre className="text-xs font-mono text-green-400 whitespace-pre-wrap">
                            {gatewayResponse ? JSON.stringify(gatewayResponse, null, 2) : <span className="text-gray-600">// Waiting for response...</span>}
                        </pre>
                    </div>
                </div>
            </div>
        </div>
    );
}
