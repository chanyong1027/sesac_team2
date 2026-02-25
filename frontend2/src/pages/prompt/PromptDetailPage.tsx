import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { promptApi } from '@/api/prompt.api';
import { organizationApi } from '@/api/organization.api';
import { useOrganizationStore } from '@/features/organization/store/organizationStore';
import {
    Play,
    Copy,
    Save
} from 'lucide-react';
import type {
    PromptDetailResponse,
    PromptReleaseHistoryResponse,
    PromptReleaseResponse,
    PromptVersionDetailResponse,
    ProviderType,
    PlaygroundRunResponse,
} from '@/types/api.types';

const PromptEvaluateTab = lazy(async () => {
    const mod = await import('./components/PromptEvaluateTab');
    return { default: mod.PromptEvaluateTab };
});

// 탭 정의
type TabType = 'overview' | 'versions' | 'release' | 'playground' | 'evaluate';

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

    if (isPromptLoading) return <div className="p-8 text-[var(--text-secondary)]">로딩 중...</div>;
    if (!prompt) return <div className="p-8 text-[var(--text-secondary)]">프롬프트를 찾을 수 없습니다.</div>;

    return (
        <div className="max-w-7xl mx-auto space-y-8">
            {/* Header */}
            <div className="space-y-6">
                <Link
                    to={basePath}
                    className="flex items-center gap-2 mb-2 group cursor-pointer w-fit"
                >
                    <span className="material-symbols-outlined text-gray-500 text-sm group-hover:text-[var(--primary)] transition-colors">
                        arrow_back
                    </span>
                    <span className="text-xs text-[var(--text-secondary)] group-hover:text-[var(--foreground)] transition-colors">
                        워크스페이스로 돌아가기
                    </span>
                </Link>

                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[var(--muted)] to-[var(--card)] border border-[var(--border)] flex items-center justify-center">
                        <span className="material-symbols-outlined text-2xl text-[var(--foreground)]">chat_bubble</span>
                    </div>
                    <div className="min-w-0">
                        <div className="flex items-center gap-3">
                            <h1 className="text-3xl font-bold text-[var(--foreground)] tracking-tight truncate">{prompt.promptKey}</h1>
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-green-500 text-black shadow-[0_0_10px_rgba(34,197,94,0.4)]">
                                {prompt.status}
                            </span>
                        </div>
                        <p className="text-[var(--text-secondary)] text-sm mt-1">Prompt Configuration &amp; Version Control</p>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="border-b border-[var(--border)] flex items-center gap-8 text-sm font-medium">
                <nav className="flex items-center gap-8">
                    <TabButton
                        active={activeTab === 'overview'}
                        onClick={() => setActiveTab('overview')}
                        iconName="settings"
                        label="개요 (Overview)"
                    />
                    <TabButton
                        active={activeTab === 'versions'}
                        onClick={() => setActiveTab('versions')}
                        iconName="history"
                        label="버전 (Versions)"
                    />
                    <TabButton
                        active={activeTab === 'release'}
                        onClick={() => setActiveTab('release')}
                        iconName="rocket_launch"
                        label="배포 (Release)"
                    />
                    <TabButton
                        active={activeTab === 'playground'}
                        onClick={() => setActiveTab('playground')}
                        iconName="play_circle"
                        label="Playground"
                        kind="playground"
                    />
                    <TabButton
                        active={activeTab === 'evaluate'}
                        onClick={() => setActiveTab('evaluate')}
                        iconName="analytics"
                        label="Evaluate"
                    />
                </nav>
            </div>

            {/* Tab Content */}
            <div className="min-h-[400px]">
                {activeTab === 'overview' && (
                    <OverviewTab
                        prompt={prompt}
                        promptId={promptId}
                        release={release ?? null}
                        isReleaseLoading={isReleaseLoading}
                        isReleaseError={isReleaseError}
                        onGoRelease={() => setActiveTab('release')}
                    />
                )}
                {activeTab === 'versions' && <VersionsTab promptId={promptId} />}
                {activeTab === 'release' && <ReleaseTab promptId={promptId} />}
                {activeTab === 'playground' && <PlaygroundTab promptId={promptId} />}
                {activeTab === 'evaluate' ? (
                    <Suspense fallback={<div className="p-8 text-[var(--text-secondary)]">로딩 중...</div>}>
                        <PromptEvaluateTab workspaceId={workspaceId} promptId={promptId} />
                    </Suspense>
                ) : null}
            </div>
        </div>
    );
}

function TabButton({
    active,
    onClick,
    iconName,
    label,
    kind = 'default',
}: {
    active: boolean;
    onClick: () => void;
    iconName: string;
    label: string;
    kind?: 'default' | 'playground';
}) {
    return (
        <button
            onClick={onClick}
            className={`relative py-3 flex items-center gap-2 transition-colors ${kind === 'playground' ? 'ml-4' : ''} ${active ? 'text-[var(--primary)]' : 'text-[var(--text-secondary)] hover:text-[var(--foreground)]'} group`}
        >
            <span
                className={`material-symbols-outlined text-lg ${active ? (kind === 'playground' ? 'text-[var(--primary)]' : 'text-[var(--primary)]') : (kind === 'playground' ? 'text-[var(--primary)] group-hover:text-[var(--foreground)]' : 'text-[var(--text-secondary)] group-hover:text-[var(--foreground)]')} transition-colors`}
                aria-hidden="true"
            >
                {iconName}
            </span>
            {label}
            {active ? (
                <span className="absolute bottom-0 left-0 w-full h-0.5 bg-[var(--primary)] shadow-[0_0_10px_rgba(168,85,247,0.8)]" />
            ) : null}
        </button>
    );
}

// --- Tab Components ---

function OverviewTab({
    prompt,
    promptId,
    release,
    isReleaseLoading,
    isReleaseError,
    onGoRelease,
}: {
    prompt: PromptDetailResponse;
    promptId: number;
    release: PromptReleaseResponse | null;
    isReleaseLoading: boolean;
    isReleaseError: boolean;
    onGoRelease: () => void;
}) {
    const queryClient = useQueryClient();
    const [isEditing, setIsEditing] = useState(false);
    const [draftDescription, setDraftDescription] = useState(prompt.description ?? '');

    useEffect(() => {
        // Keep local draft in sync when navigating between prompts.
        setDraftDescription(prompt.description ?? '');
        setIsEditing(false);
    }, [prompt.id, prompt.description]);

    const saveMutation = useMutation({
        mutationFn: async () => {
            return promptApi.updatePrompt(prompt.workspaceId, prompt.id, {
                description: draftDescription,
            });
        },
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ['prompt', prompt.workspaceId, prompt.id] });
            setIsEditing(false);
        },
        onError: () => {
            alert('설명 저장에 실패했습니다.');
        },
    });

    const { data: releaseHistory } = useQuery({
        queryKey: ['promptReleaseHistory', promptId],
        queryFn: async () => {
            try {
                const response = await promptApi.getReleaseHistory(promptId);
                return response.data;
            } catch (error) {
                if (axios.isAxiosError(error) && error.response?.status === 404) {
                    return [];
                }
                return [];
            }
        },
        enabled: !!promptId,
        retry: false,
    });

    const latestReleaseEvent = useMemo(() => {
        if (!releaseHistory || releaseHistory.length === 0) return null;
        return [...releaseHistory].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
    }, [releaseHistory]);

    const { data: activeVersionDetail } = useQuery({
        queryKey: ['promptVersionDetail', promptId, release?.activeVersionId ?? null],
        queryFn: async () => {
            if (!release?.activeVersionId) return null;
            try {
                const response = await promptApi.getVersion(promptId, release.activeVersionId);
                return response.data;
            } catch (error) {
                if (axios.isAxiosError(error) && error.response?.status === 404) {
                    return null;
                }
                return null;
            }
        },
        enabled: !!release?.activeVersionId,
        retry: false,
    });

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="glass-card rounded-2xl p-8 h-full flex flex-col">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-lg font-bold text-[var(--foreground)] flex items-center gap-2">기본 정보</h2>
                    <div className="flex items-center gap-2">
                        {isEditing ? (
                            <>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setDraftDescription(prompt.description ?? '');
                                        setIsEditing(false);
                                    }}
                                    className="text-xs text-[var(--text-secondary)] hover:text-[var(--foreground)] transition-colors border border-[var(--border)] px-3 py-1.5 rounded-lg hover:bg-[var(--muted)]"
                                >
                                    취소
                                </button>
                                <button
                                    type="button"
                                    disabled={saveMutation.isPending}
                                    onClick={() => saveMutation.mutate()}
                                    className="text-xs text-[var(--primary)] hover:text-[var(--foreground)] transition-colors border border-[var(--primary)]/30 px-3 py-1.5 rounded-lg hover:bg-[var(--primary)]/20 disabled:opacity-50 inline-flex items-center gap-1"
                                >
                                    <Save size={14} />
                                    저장
                                </button>
                            </>
                        ) : (
                            <button
                                type="button"
                                onClick={() => setIsEditing(true)}
                                className="text-xs text-[var(--primary)] hover:text-[var(--foreground)] transition-colors border border-[var(--primary)]/30 px-3 py-1.5 rounded-lg hover:bg-[var(--primary)]/20"
                            >
                                수정하기
                            </button>
                        )}
                    </div>
                </div>

                <div className="space-y-6 flex-1">
                    <div className="space-y-2">
                        <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide ml-1">Prompt Key</label>
                        <div className="relative group">
                            <input
                                className="w-full bg-[var(--input)] border border-[var(--border)] rounded-xl px-4 py-3 text-[var(--foreground)] text-sm focus:ring-2 focus:ring-[var(--primary)]/50 focus:border-[var(--primary)] transition-all font-mono tracking-wide"
                                readOnly
                                value={prompt.promptKey}
                            />
                            <button
                                type="button"
                                onClick={async () => { try { await navigator.clipboard.writeText(prompt.promptKey); } catch { /* ignore */ } }}
                                className="absolute right-3 top-3 text-gray-500 hover:text-[var(--foreground)] transition-colors opacity-0 group-hover:opacity-100"
                                aria-label="copy prompt key"
                            >
                                <Copy size={16} />
                            </button>
                        </div>
                        <p className="text-[11px] text-gray-500 pl-1">Use this key in your API calls to reference this prompt.</p>
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide ml-1">Description</label>
                        <textarea
                            className={`w-full border rounded-xl px-4 py-3 text-sm h-24 resize-none transition-all ${isEditing
                                ? 'bg-[var(--input)] border-[var(--border)] text-[var(--foreground)] focus:ring-1 focus:ring-[var(--primary)]/50 focus:border-[var(--primary)]'
                                : 'bg-[var(--muted)] border-[var(--border)] text-[var(--text-secondary)]'
                                }`}
                            readOnly={!isEditing}
                            value={draftDescription}
                            onChange={(e) => setDraftDescription(e.target.value)}
                        />
                    </div>

                    <div className="pt-4 mt-auto border-t border-[var(--border)]">
                        <div className="flex justify-between items-center text-xs">
                            <span className="text-gray-500">Created At</span>
                            <span className="text-[var(--text-secondary)] font-mono">{new Date(prompt.createdAt).toLocaleString('ko-KR')}</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="glass-card rounded-2xl p-8 h-full relative overflow-hidden group">
                <div className="absolute -right-20 -top-20 w-64 h-64 bg-green-500/5 rounded-full blur-[80px] pointer-events-none" />

                <div className="flex items-center justify-between mb-8 relative z-10">
                    <h2 className="text-lg font-bold text-[var(--foreground)]">최신 배포 상태</h2>
                    <div className={`px-2.5 py-1 rounded-full border flex items-center gap-1.5 ${release ? 'bg-green-500/10 border-green-500/20' : 'bg-amber-500/10 border-amber-500/20'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${release ? 'bg-green-500 animate-pulse' : 'bg-amber-400'}`} />
                        <span className={`text-[10px] font-bold tracking-wide ${release ? 'text-green-400' : 'text-amber-300'}`}>
                            {release ? 'OPERATIONAL' : 'NO RELEASE'}
                        </span>
                    </div>
                </div>

                <div className="flex flex-col h-[calc(100%-4rem)] justify-center relative z-10">
                    <div className="flex items-center gap-6 mb-8">
                        <div className="relative">
                            <div className={`w-20 h-20 rounded-full border-2 flex items-center justify-center relative shadow-[0_0_30px_rgba(34,197,94,0.1)] ${release ? 'border-green-500/20 bg-green-500/5' : 'border-amber-500/20 bg-amber-500/5'}`}>
                                {release ? (
                                    <span className="material-symbols-outlined text-4xl text-green-400">check_circle</span>
                                ) : (
                                    <span className="material-symbols-outlined text-4xl text-amber-300">warning</span>
                                )}
                            </div>
                            {release ? (
                                <div className="absolute inset-0 border-2 border-green-500/40 rounded-full animate-[ping_3s_ease-in-out_infinite] opacity-20" />
                            ) : null}
                        </div>
                        <div>
                            <p className="text-sm text-gray-400 font-medium mb-1">현재 서비스 중인 버전</p>
                            <div className="text-6xl font-bold text-[var(--foreground)] tracking-tighter flex items-baseline gap-1">
                                {isReleaseLoading ? (
                                    <span className="text-2xl text-[var(--text-secondary)]">Loading...</span>
                                ) : release ? (
                                    <>
                                        v{release.activeVersionNo}
                                        <span className="text-lg font-medium text-gray-500 tracking-normal">latest</span>
                                    </>
                                ) : (
                                    <span className="text-2xl text-[var(--text-secondary)]">-</span>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4 border-t border-[var(--border)] pt-6">
                        <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2 text-gray-400 text-sm">
                                <span className="material-symbols-outlined text-sm">schedule</span>
                                <span>Last Deployed</span>
                            </div>
                            <span className="text-[var(--foreground)] font-mono text-sm">
                                {release ? new Date(release.releasedAt).toLocaleString('ko-KR') : '-'}
                            </span>
                        </div>

                        <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2 text-gray-400 text-sm">
                                <span className="material-symbols-outlined text-sm">person</span>
                                <span>Deployed By</span>
                            </div>
                            <span className="text-[var(--foreground)] text-sm">
                                {latestReleaseEvent?.changedByName ?? '-'}
                            </span>
                        </div>

                        <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2 text-gray-400 text-sm">
                                <span className="material-symbols-outlined text-sm">model_training</span>
                                <span>Model</span>
                            </div>
                            <span className="text-[var(--primary)] font-mono text-sm bg-[var(--primary)]/10 px-2 py-0.5 rounded border border-[var(--primary)]/20">
                                {activeVersionDetail ? `${activeVersionDetail.provider} / ${activeVersionDetail.model}` : '-'}
                            </span>
                        </div>
                    </div>

                    <div className="mt-8">
                        <button
                            type="button"
                            onClick={onGoRelease}
                            className="w-full py-3 rounded-xl bg-[var(--muted)] hover:bg-[var(--accent)] border border-[var(--border)] text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--foreground)] transition-all flex items-center justify-center gap-2 group"
                        >
                            <span className="material-symbols-outlined group-hover:-translate-y-0.5 transition-transform">history</span>
                            배포 이력 보기
                        </button>
                    </div>
                </div>

                {isReleaseError ? (
                    <p className="mt-4 text-xs text-red-400 relative z-10">
                        릴리즈 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.
                    </p>
                ) : null}
                {!isReleaseLoading && !release && !isReleaseError ? (
                    <p className="mt-4 text-xs text-amber-300 relative z-10">
                        릴리즈된 버전이 없습니다. 버전 탭에서 새 버전을 만든 뒤 릴리즈 탭에서 배포 버전을 선택하세요.
                    </p>
                ) : null}
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
    const [isDetailCopied, setIsDetailCopied] = useState(false);
    const [baseVersionId, setBaseVersionId] = useState<number | null>(null);
    const [form, setForm] = useState({
        title: '',
        provider: 'OPENAI' as ProviderType,
        model: '',
        secondaryProvider: '' as ProviderType | '',
        secondaryModel: '',
        systemPrompt: '',
        userTemplate: '',
        contextUrl: '',
        modelConfig: '',
    });
    const [configError, setConfigError] = useState<string | null>(null);
    const [templateError, setTemplateError] = useState<string | null>(null);
    const [createError, setCreateError] = useState<string | null>(null);
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
    const hasQuestionPlaceholder = (template: string) => template.includes('{{question}}');

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
        new Set((credentials || [])
            .filter((cred) => cred.status === 'ACTIVE')
            .map((cred) => normalizeProviderKey(cred.provider)))
    ).filter((provider) => providerLabel[provider]);

    const filteredPresets = presets.filter((preset) => availableProviders.includes(preset.data.provider));

    const providerModels = useMemo(() => {
        if (!modelAllowlist) return [];
        return modelAllowlist[form.provider] ?? [];
    }, [modelAllowlist, form.provider]);

    const secondaryProviderModels = useMemo(() => {
        if (!modelAllowlist || !form.secondaryProvider) return [];
        return modelAllowlist[form.secondaryProvider as ProviderType] ?? [];
    }, [modelAllowlist, form.secondaryProvider]);

    const isTemplateValid = form.userTemplate.trim().length > 0 && hasQuestionPlaceholder(form.userTemplate);

    useEffect(() => {
        if (!availableProviders.length) return;
        if (!availableProviders.includes(form.provider)) {
            setForm((prev) => ({ ...prev, provider: availableProviders[0] as ProviderType }));
        }
    }, [availableProviders, form.provider]);

    useEffect(() => {
        if (!form.secondaryProvider) return;
        if (!availableProviders.includes(form.secondaryProvider)) {
            setForm((prev) => ({ ...prev, secondaryProvider: '', secondaryModel: '' }));
        }
    }, [availableProviders, form.secondaryProvider]);

    useEffect(() => {
        if (!providerModels.length) return;
        if (!providerModels.includes(form.model)) {
            setForm((prev) => ({ ...prev, model: providerModels[0] }));
        }
    }, [providerModels, form.model]);

    useEffect(() => {
        if (!form.secondaryProvider) {
            if (form.secondaryModel) {
                setForm((prev) => ({ ...prev, secondaryModel: '' }));
            }
            return;
        }
        if (!secondaryProviderModels.length) {
            if (form.secondaryModel) {
                setForm((prev) => ({ ...prev, secondaryModel: '' }));
            }
            return;
        }
        if (!secondaryProviderModels.includes(form.secondaryModel)) {
            setForm((prev) => ({ ...prev, secondaryModel: secondaryProviderModels[0] }));
        }
    }, [form.secondaryProvider, form.secondaryModel, secondaryProviderModels]);

    const { data: currentRelease } = useQuery({
        queryKey: ['promptRelease', promptId],
        queryFn: async () => {
            try {
                const response = await promptApi.getRelease(promptId);
                return response.data;
            } catch (error) {
                if (axios.isAxiosError(error) && error.response?.status === 404) {
                    return null;
                }
                return null;
            }
        },
        enabled: !!promptId,
        retry: false,
    });

    const { data: versions, isLoading } = useQuery({
        queryKey: ['promptVersions', promptId],
        queryFn: async () => {
            const response = await promptApi.getVersions(promptId);
            return response.data;
        },
    });
    const {
        data: baseVersionDetail,
        isLoading: isBaseVersionLoading,
    } = useQuery({
        queryKey: ['promptVersionDetail', promptId, baseVersionId],
        queryFn: async () => {
            if (!baseVersionId) return null;
            const response = await promptApi.getVersion(promptId, baseVersionId);
            return response.data;
        },
        enabled: !!baseVersionId,
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

    useEffect(() => {
        setIsDetailCopied(false);
    }, [detailVersionId]);

    useEffect(() => {
        if (isCreateOpen) {
            if (!baseVersionId && versions && versions.length > 0) {
                setBaseVersionId(versions[0].id);
            }
            return;
        }
        setBaseVersionId(null);
        setConfigError(null);
        setTemplateError(null);
        setCreateError(null);
    }, [isCreateOpen, versions, baseVersionId]);

    const applyBaseVersion = (detail: PromptVersionDetailResponse | null) => {
        if (!detail) return;
        setForm({
            title: detail.title ? `${detail.title} (복사)` : '',
            provider: detail.provider,
            model: detail.model,
            secondaryProvider: detail.secondaryProvider ?? '',
            secondaryModel: detail.secondaryModel ?? '',
            systemPrompt: detail.systemPrompt || '',
            userTemplate: detail.userTemplate || '',
            contextUrl: detail.contextUrl || '',
            modelConfig: detail.modelConfig ? JSON.stringify(detail.modelConfig, null, 2) : '',
        });
        setConfigError(null);
        setTemplateError(null);
        setCreateError(null);
    };

    const createMutation = useMutation({
        mutationFn: async () => {
            setTemplateError(null);
            setCreateError(null);
            const trimmedTemplate = form.userTemplate.trim();
            if (!trimmedTemplate) {
                setTemplateError('userTemplate는 필수입니다.');
                throw new Error('userTemplate required');
            }
            if (!hasQuestionPlaceholder(trimmedTemplate)) {
                setTemplateError('userTemplate에 {{question}} 변수가 필요합니다.');
                throw new Error('userTemplate missing placeholder');
            }

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

            const trimmedSecondaryModel = form.secondaryModel.trim();
            const trimmedSecondaryProvider = form.secondaryProvider || undefined;
            if (!trimmedSecondaryProvider && trimmedSecondaryModel) {
                setCreateError('예비 Provider를 선택해주세요.');
                throw new Error('secondary provider required');
            }
            if (trimmedSecondaryProvider && !trimmedSecondaryModel) {
                setCreateError('예비 모델을 선택해주세요.');
                throw new Error('secondary model required');
            }

            return promptApi.createVersion(promptId, {
                title: form.title.trim(),
                provider: form.provider,
                model: form.model.trim(),
                secondaryProvider: trimmedSecondaryProvider,
                secondaryModel: trimmedSecondaryProvider ? trimmedSecondaryModel : undefined,
                systemPrompt: form.systemPrompt.trim() || undefined,
                userTemplate: trimmedTemplate,
                contextUrl: form.contextUrl.trim() || undefined,
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
                secondaryProvider: '',
                secondaryModel: '',
                systemPrompt: '',
                userTemplate: '',
                contextUrl: '',
                modelConfig: '',
            });
            setConfigError(null);
            setTemplateError(null);
            setCreateError(null);
        },
        onError: (error) => {
            if (error instanceof Error && error.message.startsWith('userTemplate')) {
                return;
            }
            setCreateError('버전 생성에 실패했습니다. 입력 값을 확인해주세요.');
        },
    });

    const providerDotClass = (provider: string) => {
        if (provider === 'OPENAI') return 'bg-blue-400';
        if (provider === 'GEMINI') return 'bg-emerald-400';
        if (provider === 'ANTHROPIC') return 'bg-amber-400';
        return 'bg-gray-500';
    };

    const prettyModel = (model: string) => {
        const raw = model ?? '';
        if (!raw) return '-';
        const lowered = raw.toLowerCase();
        if (lowered.startsWith('gpt')) return raw.replace(/^gpt/i, 'GPT').replace(/-/g, '-');
        if (lowered.startsWith('gemini')) return raw.replace(/^gemini/i, 'Gemini').replace(/-/g, ' ');
        if (lowered.startsWith('claude')) return raw.replace(/^claude/i, 'Claude').replace(/-/g, ' ');
        return raw;
    };

    const formatKoDateTime = (iso: string) => {
        const d = new Date(iso);
        if (Number.isNaN(d.getTime())) return iso;
        return d.toLocaleString('ko-KR', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    if (isLoading) return <div className="text-[var(--text-secondary)]">버전 정보를 불러오는 중...</div>;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-lg font-bold text-[var(--foreground)]">버전 히스토리</h2>
                <button
                    type="button"
                    onClick={() => setIsCreateOpen(true)}
                    className="bg-[var(--primary)] hover:bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-medium shadow-[0_0_15px_rgba(168,85,247,0.4)] transition-all flex items-center gap-2"
                >
                    <span className="material-symbols-outlined text-lg">add</span>
                    + 새 버전 생성
                </button>
            </div>

            <div className="space-y-4">
                {versions && versions.length > 0 ? (
                    versions.map((ver) => {
                        const isCurrent = !!currentRelease?.activeVersionId && ver.id === currentRelease.activeVersionId;
                        return (
                            <div
                                key={ver.id}
                                className={`glass-card rounded-xl p-0 overflow-hidden transition-all group ${isCurrent ? 'hover:border-[var(--primary)]/40' : 'opacity-80 hover:opacity-100 hover:border-[var(--ring)]'}`}
                            >
                                <div className="p-5 flex items-center justify-between gap-6">
                                    <div className="flex items-center gap-6 min-w-0">
                                        <div className={`w-10 h-10 rounded-lg border flex items-center justify-center text-sm font-bold ${isCurrent ? 'bg-[var(--input)] border-[var(--border)] text-[var(--text-secondary)]' : 'bg-[var(--muted)] border-[var(--border)] text-[var(--text-secondary)]'}`}>
                                            v{ver.versionNumber}
                                        </div>
                                        <div className="space-y-1 min-w-0">
                                            <div className="flex items-center gap-3 flex-wrap">
                                                <span className={`text-base font-bold ${isCurrent ? 'text-[var(--foreground)]' : 'text-[var(--text-secondary)]'} truncate`}>
                                                    {ver.title || '(untitled)'}
                                                </span>
                                                {isCurrent ? (
                                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[var(--primary)]/20 text-[var(--primary)] border border-[var(--primary)]/30">
                                                        CURRENT
                                                    </span>
                                                ) : null}
                                            </div>
                                            <div className={`flex items-center gap-2 text-xs ${isCurrent ? 'text-[var(--text-secondary)]' : 'text-[var(--text-secondary)]'} flex-wrap`}>
                                                <span className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-[var(--muted)] border border-[var(--border)]">
                                                    <span className={`w-1.5 h-1.5 rounded-full ${providerDotClass(ver.provider)}`} />
                                                    {prettyModel(ver.model)}
                                                </span>
                                                {ver.secondaryProvider && ver.secondaryModel ? (
                                                    <>
                                                        <span className="text-gray-600">/</span>
                                                        <span className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-[var(--muted)] border border-[var(--border)]">
                                                            <span className={`w-1.5 h-1.5 rounded-full ${providerDotClass(ver.secondaryProvider)}`} />
                                                            {prettyModel(ver.secondaryModel)}
                                                        </span>
                                                    </>
                                                ) : null}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-8 flex-shrink-0">
                                        <div className="text-right">
                                            <div className={`text-xs mb-0.5 ${isCurrent ? 'text-gray-500' : 'text-gray-600'}`}>Last Updated</div>
                                            <div className={`text-sm text-[var(--text-secondary)] font-mono ${isCurrent ? '' : 'opacity-80'}`}>
                                                {formatKoDateTime(ver.createdAt)}
                                            </div>
                                        </div>

                                        <div className="text-right hidden md:block">
                                            <div className={`text-xs mb-0.5 ${isCurrent ? 'text-gray-500' : 'text-gray-600'}`}>Author</div>
                                            <div className="flex items-center justify-end gap-2">
                                                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[8px] text-white ${isCurrent ? 'bg-gradient-to-br from-purple-600 to-indigo-700' : 'bg-gray-700 text-gray-300'}`}>
                                                    {(ver.createdByName || '?').slice(0, 1)}
                                                </div>
                                                <span className={`text-sm ${isCurrent ? 'text-[var(--text-secondary)]' : 'text-[var(--text-secondary)]'}`}>{ver.createdByName || '-'}</span>
                                            </div>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={() => setDetailVersionId(ver.id)}
                                            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors border ${isCurrent ? 'text-[var(--text-secondary)] hover:text-[var(--foreground)] border-[var(--border)] hover:border-[var(--ring)]' : 'text-[var(--text-secondary)] hover:text-[var(--foreground)] border-[var(--border)] hover:border-[var(--ring)]'}`}
                                        >
                                            상세 보기
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })
                ) : (
                    <div className="p-8 text-center text-gray-400 text-sm glass-card rounded-xl">
                        생성된 버전이 없습니다.
                    </div>
                )}
            </div>

            {isCreateOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    <div
                        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
                        onClick={() => setIsCreateOpen(false)}
                    />
                    <div className="relative z-10 w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl overflow-hidden border border-[var(--primary)]/30 shadow-[0_0_0_1px_rgba(168,85,247,0.10),0_0_30px_rgba(168,85,247,0.15),0_25px_50px_-12px_rgba(0,0,0,0.80)] bg-[var(--card)] backdrop-blur-2xl">
                        <div className="px-8 py-6 border-b border-[var(--border)] flex flex-col gap-2 shrink-0 bg-[var(--muted)]/40">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h4 className="text-xl font-semibold text-[var(--foreground)] tracking-tight flex items-center gap-2">
                                        <span className="w-1.5 h-6 rounded-full bg-[var(--primary)] shadow-[0_0_10px_rgba(168,85,247,0.50)]" />
                                        새 버전 생성
                                    </h4>
                                    <p className="text-sm text-gray-400 font-light mt-1 pl-3.5">
                                        버전은 테스트/개발용 시나리오를 관리하고, 릴리즈 탭에서 배포 버전을 선택합니다.
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setIsCreateOpen(false)}
                                    className="text-[var(--text-secondary)] hover:text-[var(--foreground)] transition-colors"
                                    aria-label="close create version modal"
                                    title="닫기"
                                >
                                    <span className="material-symbols-outlined">close</span>
                                </button>
                            </div>

                            <div className="flex gap-3 mt-3 pl-3.5 flex-wrap">
                                {filteredPresets.map((preset) => {
                                    const icon = preset.label.toLowerCase().includes('rag')
                                        ? 'database'
                                        : preset.label.toLowerCase().includes('cs')
                                            ? 'smart_toy'
                                            : 'smart_toy';
                                    return (
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
                                            className="px-3 py-1.5 rounded-full border border-[var(--border)] bg-[var(--muted)] hover:border-[var(--primary)]/40 hover:bg-[var(--primary)]/10 text-xs text-[var(--text-secondary)] transition-all duration-300 flex items-center gap-1.5 group"
                                        >
                                            <span className="material-symbols-outlined text-[14px] text-[var(--text-secondary)] group-hover:text-purple-300 transition-colors">
                                                {icon}
                                            </span>
                                            예시 적용: {preset.label}
                                        </button>
                                    );
                                })}
                                {!filteredPresets.length && (
                                    <span className="text-xs text-gray-400">
                                        등록된 Provider 기준으로 사용할 수 있는 예시가 없습니다.
                                    </span>
                                )}
                            </div>
                        </div>

                        <div className="px-8 py-6 overflow-y-auto flex-1 space-y-6">
                            {!isCredsLoading && availableProviders.length === 0 && (
                                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">
                                    등록된 Provider 키가 없습니다. 먼저 Provider 키를 등록해주세요.
                                    <div className="mt-2">
                                        <Link
                                            to={orgId ? `/orgs/${orgId}/settings/provider-keys` : '/settings/provider-keys'}
                                            className="text-amber-100 font-semibold hover:underline"
                                        >
                                            Provider 키 등록하러 가기
                                        </Link>
                                    </div>
                                </div>
                            )}
                            <div className="bg-[var(--muted)] border border-[var(--border)] rounded-xl p-5 backdrop-blur-sm">
                                <div className="flex flex-col sm:flex-row items-end gap-3">
                                    <div className="flex-1">
                                        <label className="block text-xs font-medium text-[var(--text-secondary)] mb-2 uppercase tracking-wider">기존 버전 불러오기</label>
                                        <select
                                            value={baseVersionId ?? ''}
                                            onChange={(e) => setBaseVersionId(Number(e.target.value) || null)}
                                            className="w-full bg-[var(--input)] border border-[var(--border)] rounded-md py-2.5 px-3 text-sm text-[var(--foreground)] focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/30 outline-none transition-all"
                                            disabled={!versions?.length}
                                        >
                                            <option value="">
                                                {versions?.length ? '복사할 버전을 선택하세요' : '복사할 버전이 없습니다'}
                                            </option>
                                            {versions?.map((ver) => (
                                                <option key={ver.id} value={ver.id}>
                                                    v{ver.versionNumber} · {ver.title || ver.model} ({ver.provider}/{ver.model})
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => applyBaseVersion(baseVersionDetail ?? null)}
                                        disabled={!baseVersionDetail || isBaseVersionLoading}
                                        className="px-4 py-2 bg-[var(--input)] hover:bg-[var(--accent)] border border-[var(--border)] hover:border-[var(--ring)] rounded-md text-xs font-medium text-[var(--text-secondary)] transition-colors shrink-0 shadow-lg disabled:opacity-50"
                                    >
                                        {isBaseVersionLoading ? '불러오는 중...' : '내용 불러오기'}
                                    </button>
                                </div>
                                <p className="text-[11px] text-gray-500 mt-2 flex items-center gap-1">
                                    <span className="material-symbols-outlined text-[12px]">info</span>
                                    이전 버전의 설정을 가져와 빠르게 수정할 수 있습니다.
                                </p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-[var(--text-secondary)]">제목</label>
                                <input
                                    type="text"
                                    value={form.title}
                                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                                    className="w-full bg-[var(--input)] border border-[var(--border)] rounded-md py-2.5 px-3 text-sm text-[var(--foreground)] placeholder-[var(--text-secondary)] focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/30 outline-none transition-all"
                                    placeholder="예: 2026-02-01 실험용"
                                />
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label htmlFor="prompt-provider" className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Provider</label>
                                    <div className="relative group">
                                        <select
                                            id="prompt-provider"
                                            value={form.provider}
                                            onChange={(e) => setForm({ ...form, provider: e.target.value as typeof form.provider })}
                                            className="w-full bg-[var(--input)] border border-[var(--border)] rounded-md py-2.5 px-3 text-sm appearance-none pr-10 cursor-pointer text-[var(--foreground)] focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/30 outline-none transition-all disabled:opacity-50"
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
                                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-500 group-hover:text-purple-300 transition-colors">
                                            <span className="material-symbols-outlined text-sm">dns</span>
                                        </div>
                                    </div>
                                </div>
                                <div>
                                    <label htmlFor="prompt-model" className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Model</label>
                                    <div className="relative group">
                                        <select
                                            id="prompt-model"
                                            value={form.model}
                                            onChange={(e) => setForm({ ...form, model: e.target.value })}
                                            className="w-full bg-[var(--input)] border border-[var(--border)] rounded-md py-2.5 px-3 text-sm appearance-none pr-10 cursor-pointer text-[var(--foreground)] focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/30 outline-none transition-all disabled:opacity-50"
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
                                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-500 group-hover:text-purple-300 transition-colors">
                                            <span className="material-symbols-outlined text-sm">neurology</span>
                                        </div>
                                    </div>
                                    {isAllowlistError && (
                                        <p className="mt-1 text-xs text-rose-300">모델 목록을 불러오지 못했습니다.</p>
                                    )}
                                </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label htmlFor="secondary-provider" className="block text-sm font-medium text-gray-400">
                                        예비 Provider <span className="text-gray-600 text-xs font-normal">(선택)</span>
                                    </label>
                                    <div className="relative">
                                        <select
                                            id="secondary-provider"
                                            value={form.secondaryProvider}
                                            onChange={(e) =>
                                                setForm({
                                                    ...form,
                                                    secondaryProvider: e.target.value as ProviderType | '',
                                                    secondaryModel: '',
                                                })}
                                            className="w-full rounded-md py-2.5 px-3 text-sm text-[var(--text-secondary)] appearance-none pr-10 border border-[var(--border)] bg-[var(--muted)] focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20 outline-none transition-all disabled:opacity-50 cursor-pointer"
                                            disabled={availableProviders.length === 0}
                                        >
                                            <option value="">예비 모델 없음</option>
                                            {availableProviders.map((provider) => (
                                                <option key={provider} value={provider}>
                                                    {providerLabel[provider] || provider}
                                                </option>
                                            ))}
                                        </select>
                                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-600">
                                            <span className="material-symbols-outlined text-sm">expand_more</span>
                                        </div>
                                    </div>
                                </div>
                                <div>
                                    <label htmlFor="secondary-model" className="block text-sm font-medium text-gray-400">
                                        예비 Model <span className="text-gray-600 text-xs font-normal">(선택)</span>
                                    </label>
                                    <div className="relative">
                                        <select
                                            id="secondary-model"
                                            value={form.secondaryModel}
                                            onChange={(e) => setForm({ ...form, secondaryModel: e.target.value })}
                                            className="w-full rounded-md py-2.5 px-3 text-sm text-[var(--text-secondary)] appearance-none pr-10 border border-[var(--border)] bg-[var(--muted)] focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20 outline-none transition-all disabled:opacity-50 cursor-pointer"
                                            disabled={!form.secondaryProvider || isAllowlistLoading || isAllowlistError || secondaryProviderModels.length === 0}
                                        >
                                            {!form.secondaryProvider && <option value="">예비 Provider를 먼저 선택하세요</option>}
                                            {form.secondaryProvider && isAllowlistLoading && (
                                                <option value="">모델 목록 불러오는 중...</option>
                                            )}
                                            {form.secondaryProvider && !isAllowlistLoading && secondaryProviderModels.length === 0 && (
                                                <option value="">사용 가능한 모델 없음</option>
                                            )}
                                            {secondaryProviderModels.map((model) => (
                                                <option key={model} value={model}>
                                                    {model}
                                                </option>
                                            ))}
                                        </select>
                                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-600">
                                            <span className="material-symbols-outlined text-sm">expand_more</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="block text-sm font-medium text-[var(--text-secondary)] flex items-center gap-2">
                                    <span className="material-symbols-outlined text-sm text-purple-300">terminal</span>
                                    System Prompt
                                </label>
                                <div className="relative">
                                    <textarea
                                        value={form.systemPrompt}
                                        onChange={(e) => setForm({ ...form, systemPrompt: e.target.value })}
                                        rows={5}
                                        className="w-full rounded-md py-3 px-4 text-sm text-[var(--foreground)] placeholder-[var(--text-secondary)] resize-none shadow-inner font-mono bg-[var(--input)] border border-[var(--border)] focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/30 outline-none transition-all"
                                        placeholder="// 시스템 프롬프트를 입력하세요."
                                    />
                                    <div className="absolute bottom-2 right-3 text-[10px] text-gray-600 font-mono">markdown supported</div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="block text-sm font-medium text-[var(--text-secondary)] flex items-center justify-between">
                                    <span className="flex items-center gap-2">
                                        <span className="material-symbols-outlined text-sm text-purple-300">code</span>
                                        User Template <span className="text-purple-300 text-xs ml-1">(필수)</span>
                                    </span>
                                </label>
                                <textarea
                                    value={form.userTemplate}
                                    onChange={(e) => {
                                        setForm({ ...form, userTemplate: e.target.value });
                                        setTemplateError(null);
                                    }}
                                    rows={5}
                                    className="w-full rounded-md py-3 px-4 text-sm text-[var(--foreground)] placeholder-[var(--text-secondary)] resize-none font-mono bg-[var(--input)] border border-[var(--primary)]/20 shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)] focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/30 outline-none transition-all"
                                    placeholder="예: 사용자 질문: {{question}}"
                                />
                                <p className="text-[11px] text-gray-400 flex items-center gap-1.5 pl-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--primary)] shadow-[0_0_5px_rgba(168,85,247,0.8)]"></span>
                                    <code className="bg-[var(--muted)] px-1 py-0.5 rounded text-purple-200 font-mono text-[10px]">{'{{question}}'}</code>
                                    변수가 반드시 포함되어야 합니다.
                                </p>
                                {templateError && (
                                    <p className="mt-1 text-xs text-rose-300">{templateError}</p>
                                )}
                            </div>

                            <div className="h-px bg-[var(--border)] my-2"></div>

                            <div className="space-y-1.5">
                                <label className="block text-sm font-medium text-[var(--text-secondary)]">
                                    관련 링크 <span className="text-gray-500 text-xs font-normal">(선택)</span>
                                </label>
                                <div className="relative">
                                    <span className="absolute left-3 top-2.5 material-symbols-outlined text-gray-600 text-sm">link</span>
                                    <input
                                        value={form.contextUrl}
                                        onChange={(e) => setForm({ ...form, contextUrl: e.target.value })}
                                        className="w-full rounded-md py-2.5 pl-9 pr-3 text-sm placeholder-[var(--text-secondary)] bg-[var(--input)] border border-[var(--border)] text-[var(--foreground)] focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/30 outline-none transition-all"
                                        placeholder="Jira/Notion 링크를 입력하세요"
                                        type="text"
                                    />
                                </div>
                                <p className="text-[11px] text-gray-500 pl-1">변경 근거를 남겨두면 추적이 쉬워집니다.</p>
                            </div>

                            <div className="space-y-1.5">
                                <label className="block text-sm font-medium text-[var(--text-secondary)] font-mono text-xs">Model Config (JSON)</label>
                                <textarea
                                    value={form.modelConfig}
                                    onChange={(e) => setForm({ ...form, modelConfig: e.target.value })}
                                    rows={2}
                                    className="w-full rounded-md py-3 px-4 text-xs text-[var(--foreground)] placeholder-[var(--text-secondary)] resize-none font-mono bg-[var(--input)] border border-[var(--border)] focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/30 outline-none transition-all"
                                    placeholder='예: {"temperature":0.2, "topP":0.9}'
                                />
                                <p className="text-[11px] text-gray-500 pl-1">JSON 형식으로 입력하세요. 비워두면 기본값이 사용됩니다.</p>
                                {configError && (
                                    <p className="mt-1 text-xs text-rose-300">{configError}</p>
                                )}
                                {createError && (
                                    <p className="mt-2 text-xs text-rose-300">{createError}</p>
                                )}
                            </div>
                        </div>
                        <div className="px-8 py-5 border-t border-[var(--border)] bg-[var(--muted)]/80 flex justify-end gap-3 shrink-0 backdrop-blur-md">
                            <button
                                type="button"
                                onClick={() => setIsCreateOpen(false)}
                                className="px-6 py-2.5 rounded-lg border border-[var(--border)] text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--muted)] hover:text-[var(--foreground)] hover:border-[var(--ring)] transition-all duration-200"
                            >
                                취소
                            </button>
                            <button
                                type="button"
                                onClick={() => createMutation.mutate()}
                                disabled={Boolean(
                                    !form.model.trim() ||
                                    !isTemplateValid ||
                                    createMutation.isPending ||
                                    availableProviders.length === 0 ||
                                    isAllowlistLoading ||
                                    isAllowlistError ||
                                    providerModels.length === 0 ||
                                    (!!form.secondaryProvider && !form.secondaryModel.trim()) ||
                                    (form.secondaryProvider && secondaryProviderModels.length === 0)
                                )}
                                className="px-6 py-2.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-sm font-medium text-white transition-all duration-300 border border-purple-500 flex items-center gap-2 disabled:opacity-50 shadow-[0_0_20px_rgba(139,92,246,0.4)] hover:shadow-[0_0_30px_rgba(139,92,246,0.6)]"
                            >
                                <span className="material-symbols-outlined text-sm">rocket_launch</span>
                                {createMutation.isPending ? '생성 중...' : '버전 생성'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {detailVersionId && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    <div
                        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
                        onClick={() => setDetailVersionId(null)}
                    />
                    <div className="relative w-full max-w-5xl max-h-[90vh] flex flex-col glass-card rounded-2xl shadow-[0_25px_50px_-12px_rgba(0,0,0,0.50),0_0_0_1px_rgba(255,255,255,0.10)_inset] overflow-hidden border border-[var(--border)]">
                        <div className="px-8 py-5 border-b border-[var(--border)] flex items-start justify-between bg-[var(--muted)]/30">
                            <div>
                                <div className="flex items-center gap-3">
                                    <h4 className="text-xl font-bold text-[var(--foreground)] tracking-tight flex items-center gap-2">
                                        <span className="material-symbols-outlined text-[var(--primary)] text-2xl">settings_suggest</span>
                                        버전 상세
                                    </h4>
                                    {currentRelease?.activeVersionId && detailVersionId === currentRelease.activeVersionId ? (
                                        <span className="px-2 py-0.5 rounded-full bg-[var(--primary)]/10 border border-[var(--primary)]/20 text-[10px] font-mono text-[var(--primary)] font-semibold tracking-wider uppercase">
                                            Active
                                        </span>
                                    ) : null}
                                </div>
                                <p className="text-sm text-[var(--text-secondary)] mt-1 pl-9">버전의 설정과 템플릿을 확인하고 관리합니다.</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setDetailVersionId(null)}
                                className="group text-gray-500 hover:text-[var(--foreground)] transition-all p-2 rounded-full hover:bg-[var(--muted)] border border-transparent hover:border-[var(--border)]"
                                aria-label="close version detail modal"
                                title="닫기"
                            >
                                <span className="material-symbols-outlined text-xl group-hover:rotate-90 transition-transform duration-300">close</span>
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-8 space-y-8 bg-gradient-to-b from-transparent to-[var(--muted)]/40">
                            {isDetailLoading || !versionDetail ? (
                                <div className="text-sm text-[var(--text-secondary)]">버전 정보를 불러오는 중...</div>
                            ) : (
                                <>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                        <div className="space-y-1.5 p-3 rounded-xl hover:bg-[var(--muted)] transition-colors border border-transparent hover:border-[var(--border)]">
                                            <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Version ID</div>
                                            <div className="flex items-center gap-2">
                                                <span className="font-mono text-lg font-bold text-[var(--foreground)] tracking-tight">v{versionDetail.versionNumber}</span>
                                                <span
                                                    className="material-symbols-outlined text-green-500 text-sm"
                                                    style={{ fontVariationSettings: "'FILL' 1" }}
                                                >
                                                    check_circle
                                                </span>
                                            </div>
                                        </div>

                                        <div className="space-y-1.5 p-3 rounded-xl hover:bg-[var(--muted)] transition-colors border border-transparent hover:border-[var(--border)]">
                                            <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Primary Model</div>
                                            <div className="flex items-center text-sm font-medium text-[var(--foreground)]">
                                                <span className="px-2 py-1 rounded bg-purple-500/10 text-[10px] font-bold text-purple-300 mr-2 border border-purple-500/20 shadow-[0_0_10px_rgba(168,85,247,0.10)]">
                                                    {versionDetail.provider}
                                                </span>
                                                <span className="font-mono text-[var(--foreground)]">{versionDetail.model}</span>
                                            </div>
                                        </div>

                                        <div className="space-y-1.5 p-3 rounded-xl hover:bg-[var(--muted)] transition-colors border border-transparent hover:border-[var(--border)]">
                                            <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Title</div>
                                            <div className="text-sm font-medium text-[var(--foreground)] truncate">{versionDetail.title || '-'}</div>
                                        </div>

                                        <div className="space-y-1.5 p-3 rounded-xl hover:bg-[var(--muted)] transition-colors border border-transparent hover:border-[var(--border)]">
                                            <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Created At</div>
                                            <div className="font-mono text-sm text-gray-400">{formatKoDateTime(versionDetail.createdAt)}</div>
                                        </div>

                                        <div className="space-y-1.5 p-3 rounded-xl hover:bg-[var(--muted)] transition-colors border border-transparent hover:border-[var(--border)]">
                                            <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Fallback Model</div>
                                            <div className="flex items-center text-sm font-medium text-[var(--foreground)]">
                                                {versionDetail.secondaryProvider && versionDetail.secondaryModel ? (
                                                    <>
                                                        <span className="px-2 py-1 rounded bg-emerald-500/10 text-[10px] font-bold text-emerald-300 mr-2 border border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.10)]">
                                                            {versionDetail.secondaryProvider}
                                                        </span>
                                                        <span className="font-mono text-[var(--foreground)]">{versionDetail.secondaryModel}</span>
                                                    </>
                                                ) : (
                                                    <span className="text-gray-500">-</span>
                                                )}
                                            </div>
                                        </div>

                                        <div className="space-y-1.5 p-3 rounded-xl hover:bg-[var(--muted)] transition-colors border border-transparent hover:border-[var(--border)] opacity-60">
                                            <div className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">Tokens</div>
                                            <div className="font-mono text-sm text-gray-500">
                                                {(() => {
                                                    const raw = `${versionDetail.systemPrompt || ''}\n${versionDetail.userTemplate || ''}\n${JSON.stringify(versionDetail.modelConfig || {})}`;
                                                    const est = Math.max(1, Math.ceil(raw.length / 4));
                                                    return `~${est.toLocaleString('ko-KR')} est.`;
                                                })()}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="h-px bg-gradient-to-r from-transparent via-[var(--border)] to-transparent w-full"></div>

                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between">
                                            <label className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider flex items-center">
                                                <span className="material-symbols-outlined text-sm mr-2 text-[var(--primary)]">terminal</span>
                                                System Prompt
                                            </label>
                                            <span className="text-[10px] text-gray-600 font-mono bg-[var(--muted)] px-2 py-0.5 rounded border border-[var(--border)]">READ ONLY</span>
                                        </div>

                                        <div className="relative group">
                                            <div className="absolute -inset-0.5 bg-gradient-to-r from-[var(--primary)]/30 to-blue-600/30 rounded-xl blur opacity-20 group-hover:opacity-40 transition duration-500"></div>
                                            <div className="relative w-full rounded-xl p-0 font-mono text-sm leading-relaxed text-[var(--foreground)] h-80 overflow-hidden flex flex-col bg-[var(--input)] border border-[var(--border)] shadow-[inset_0_0_20px_rgba(0,0,0,0.5)]">
                                                <div className="flex items-center justify-between px-4 py-2 bg-[var(--muted)] border-b border-[var(--border)]">
                                                    <div className="flex space-x-1.5">
                                                        <div className="w-2.5 h-2.5 rounded-full bg-red-500/20 border border-red-500/50"></div>
                                                        <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/20 border border-yellow-500/50"></div>
                                                        <div className="w-2.5 h-2.5 rounded-full bg-green-500/20 border border-green-500/50"></div>
                                                    </div>
                                                    <span className="text-[10px] text-gray-500 font-sans">prompt_v{versionDetail.versionNumber}.txt</span>
                                                </div>
                                                <div className="overflow-y-auto p-5 h-full">
                                                    <pre className="whitespace-pre-wrap">{versionDetail.systemPrompt || '(empty)'}</pre>
                                                </div>
                                            </div>

                                            <button
                                                type="button"
                                                onClick={async () => {
                                                    try {
                                                        await navigator.clipboard.writeText(versionDetail.systemPrompt || '');
                                                        setIsDetailCopied(true);
                                                        window.setTimeout(() => setIsDetailCopied(false), 1200);
                                                    } catch {
                                                        // ignore
                                                    }
                                                }}
                                                className="absolute top-12 right-4 p-2 rounded-lg bg-[var(--muted)] hover:bg-[var(--primary)]/20 text-[var(--text-secondary)] hover:text-[var(--foreground)] border border-[var(--border)] hover:border-[var(--primary)]/30 opacity-0 group-hover:opacity-100 transition-all duration-200 backdrop-blur-md"
                                                aria-label="copy system prompt"
                                                title="copy"
                                            >
                                                <span className="material-symbols-outlined text-sm">
                                                    {isDetailCopied ? 'check' : 'content_copy'}
                                                </span>
                                            </button>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div className="space-y-3">
                                                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">User Template</label>
                                                <div className="w-full bg-[var(--input)] border border-[var(--border)] rounded-xl p-4 font-mono text-sm text-[var(--foreground)] shadow-inner min-h-[72px] whitespace-pre-wrap">
                                                    {versionDetail.userTemplate || '(empty)'}
                                                </div>
                                            </div>
                                            <div className="space-y-3">
                                                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Model Config</label>
                                                <div className="w-full bg-[var(--input)] border border-[var(--border)] rounded-xl p-4 font-mono text-xs text-[var(--text-secondary)] shadow-inner min-h-[72px] whitespace-pre-wrap">
                                                    {versionDetail.modelConfig && Object.keys(versionDetail.modelConfig).length
                                                        ? JSON.stringify(versionDetail.modelConfig, null, 2)
                                                        : 'No overrides configured'}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="pt-2">
                                            <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">관련 링크</div>
                                            {versionDetail.contextUrl ? (
                                                <a
                                                    href={versionDetail.contextUrl}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="text-sm text-[var(--primary)] hover:underline break-all"
                                                >
                                                    {versionDetail.contextUrl}
                                                </a>
                                            ) : (
                                                <div className="text-sm text-gray-400">-</div>
                                            )}
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>

                        <div className="px-8 py-5 border-t border-[var(--border)] bg-[var(--muted)]/50 flex justify-end items-center shrink-0 backdrop-blur-md">
                            <button
                                type="button"
                                onClick={() => setDetailVersionId(null)}
                                className="px-6 py-2.5 rounded-lg text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--foreground)] bg-[var(--muted)] hover:bg-[var(--accent)] border border-[var(--border)] hover:border-[var(--ring)] transition-all focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/50 shadow-lg"
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
            try {
                const response = await promptApi.getVersions(promptId);
                return response.data;
            } catch (error) {
                if (axios.isAxiosError(error) && error.response?.status === 404) {
                    return [];
                }
                throw error;
            }
        },
    });

    const { data: releaseHistory, isLoading: isHistoryLoading, refetch: refetchReleaseHistory } = useQuery({
        queryKey: ['promptReleaseHistory', promptId],
        queryFn: async () => {
            try {
                const response = await promptApi.getReleaseHistory(promptId);
                return response.data;
            } catch (error) {
                if (axios.isAxiosError(error) && error.response?.status === 404) {
                    return [];
                }
                return [];
            }
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
            queryClient.invalidateQueries({ queryKey: ['promptReleaseHistory', promptId] });
            setReleaseReason('');
            setReleaseMessage('배포가 완료되었습니다.');
            setReleaseError(null);
            window.setTimeout(() => setReleaseMessage(null), 2500);
        },
        onError: (error) => {
            console.error('Release failed:', error);
            setReleaseError('배포에 실패했습니다. 잠시 후 다시 시도해주세요.');
            setReleaseMessage(null);
        },
    });

    const formatTimelineDate = (iso: string) => {
        const date = new Date(iso);
        if (Number.isNaN(date.getTime())) return iso;
        return date.toLocaleString('ko-KR', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    return (
        <div className="space-y-6">
            <div className="glass-card rounded-2xl p-8 relative overflow-hidden group border border-[var(--border)]">
                <div className="absolute top-0 right-0 w-64 h-64 bg-[var(--primary)]/5 rounded-full blur-[80px] -mr-16 -mt-16 pointer-events-none" />

                <h3 className="text-xl font-bold text-[var(--foreground)] mb-2 flex items-center gap-2">
                    Manual Release
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--primary)] shadow-[0_0_15px_rgba(168,85,247,0.5)]" />
                </h3>
                <p className="text-[var(--text-secondary)] text-sm mb-8 leading-relaxed max-w-2xl">
                    특정 버전을 선택하여 운영 환경(Production)에 배포합니다. 배포 즉시 API 응답에 반영됩니다.
                </p>

                <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 items-end">
                    <div className="lg:col-span-3 space-y-6">
                        <div className="group/input">
                            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 group-hover/input:text-[var(--primary)] transition-colors">
                                배포할 버전 선택
                            </label>
                            <div className="relative">
                                <select
                                    className="block w-full rounded-xl border border-[var(--border)] bg-[var(--input)] text-[var(--foreground)] py-3 px-4 text-sm focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] focus:outline-none transition-all cursor-pointer hover:border-[var(--ring)] appearance-none"
                                    value={selectedVersionId ?? ''}
                                    onChange={(e) => setSelectedVersionId(e.target.value ? Number(e.target.value) : null)}
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
                                <div className="absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none">
                                    <span className="material-symbols-outlined text-[var(--text-secondary)]">expand_more</span>
                                </div>
                            </div>
                            <p className="mt-2 text-[11px] text-gray-500">
                                배포할 버전을 선택하면 현재 서비스 버전이 즉시 변경됩니다.
                            </p>
                            {!isVersionsLoading && !versions?.length ? (
                                <p className="mt-2 text-[11px] text-amber-300">
                                    배포할 버전이 없습니다. 먼저 버전을 생성해주세요.
                                </p>
                            ) : null}
                        </div>

                        <div className="group/input">
                            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 group-hover/input:text-[var(--primary)] transition-colors">
                                배포 사유 (선택)
                            </label>
                            <input
                                value={releaseReason}
                                onChange={(e) => setReleaseReason(e.target.value)}
                                className="block w-full rounded-xl border border-[var(--border)] bg-[var(--input)] text-[var(--foreground)] py-3 px-4 text-sm placeholder:text-[var(--text-secondary)] focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] focus:outline-none transition-all hover:border-[var(--ring)]"
                                placeholder="예: 최신 FAQ 반영"
                                type="text"
                            />
                        </div>

                        {releaseMessage ? (
                            <div className="text-sm text-emerald-200 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3">
                                {releaseMessage}
                            </div>
                        ) : null}
                        {releaseError ? (
                            <div className="text-sm text-rose-200 bg-rose-500/10 border border-rose-500/20 rounded-xl px-4 py-3">
                                {releaseError}
                            </div>
                        ) : null}
                    </div>

                    <div className="lg:col-span-1">
                        <button
                            type="button"
                            onClick={() => releaseMutation.mutate()}
                            disabled={!selectedVersionId || releaseMutation.isPending}
                            className="w-full flex justify-center items-center gap-2 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white font-medium py-3 px-6 rounded-xl shadow-[0_0_15px_rgba(168,85,247,0.35)] transition-all hover:shadow-[0_0_25px_rgba(168,85,247,0.50)] transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50"
                        >
                            <span className="material-symbols-outlined text-xl">rocket_launch</span>
                            {releaseMutation.isPending ? '배포 중...' : '배포하기'}
                        </button>
                    </div>
                </div>
            </div>

            <div className="glass-card rounded-2xl p-8 min-h-[400px] border border-[var(--border)]">
                <div className="flex items-center justify-between mb-8 border-b border-[var(--border)] pb-4">
                    <div>
                        <h3 className="text-lg font-bold text-[var(--foreground)] mb-1">배포 이력</h3>
                        <p className="text-gray-500 text-xs">운영 환경 배포 히스토리를 확인합니다.</p>
                    </div>
                    <button
                        type="button"
                        onClick={() => refetchReleaseHistory()}
                        className="p-2 text-gray-500 hover:text-[var(--foreground)] transition-colors rounded-lg hover:bg-[var(--muted)]"
                        aria-label="refresh release history"
                    >
                        <span className="material-symbols-outlined text-xl">refresh</span>
                    </button>
                </div>

                {isHistoryLoading ? (
                    <div className="text-sm text-gray-500">이력을 불러오는 중...</div>
                ) : releaseHistory && releaseHistory.length > 0 ? (
                    <div className="relative timeline-line ml-2 space-y-6">
                        {releaseHistory.map((history: PromptReleaseHistoryResponse, idx: number) => {
                            const isLatest = idx === 0;
                            const badge =
                                history.changeType === 'ROLLBACK'
                                    ? { label: 'ROLLBACK', className: 'bg-amber-500/15 text-amber-200 border-amber-500/25' }
                                    : isLatest
                                        ? { label: 'SUCCESS', className: 'bg-green-500/20 text-green-300 border-green-500/20' }
                                        : { label: 'ARCHIVED', className: 'bg-gray-700/40 text-gray-300 border-gray-600/30' };

                            return (
                                <div
                                    key={history.id}
                                    className={`relative flex gap-6 pl-8 group ${isLatest ? '' : 'opacity-80 hover:opacity-100 transition-opacity'}`}
                                >
                                    {isLatest ? (
                                        <div className="absolute left-[11px] top-1 w-2.5 h-2.5 rounded-full bg-[var(--background)] border-2 border-[var(--primary)] z-10 shadow-[0_0_8px_rgba(168,85,247,0.8)]" />
                                    ) : (
                                        <div className="absolute left-[12px] top-1 w-2 h-2 rounded-full bg-gray-600 border border-[var(--background)] z-10" />
                                    )}

                                    <div className="flex-1 frosted-entry p-5 rounded-xl border border-[var(--border)] bg-[var(--muted)]/40 hover:bg-[var(--muted)] hover:border-[var(--primary)]/30 transition-all cursor-default">
                                        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                                            <div>
                                                <div className="flex items-center gap-3 mb-2">
                                                    <h4 className={`font-bold ${isLatest ? 'text-[var(--foreground)]' : 'text-[var(--text-secondary)]'} text-base`}>
                                                        v{history.toVersionNo} Release
                                                    </h4>
                                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${badge.className}`}>
                                                        {badge.label}
                                                    </span>
                                                </div>
                                                <p className={`text-sm ${isLatest ? 'text-gray-400' : 'text-gray-500'} font-light`}>
                                                    {history.reason || '배포 사유 없음'}
                                                </p>
                                            </div>
                                            <div className="text-right flex flex-col items-end min-w-[140px]">
                                                <span className={`text-xs font-mono ${isLatest ? 'text-gray-500' : 'text-gray-600'} mb-1`}>
                                                    {formatTimelineDate(history.createdAt)}
                                                </span>
                                                <div className="flex items-center gap-2 px-2 py-1 rounded bg-[var(--muted)] border border-[var(--border)]">
                                                    <div className="w-4 h-4 rounded-full bg-gradient-to-br from-purple-600 to-indigo-700 text-[8px] flex items-center justify-center font-bold text-white">
                                                        {(history.changedByName || 'S').slice(0, 1)}
                                                    </div>
                                                    <span className={`text-xs ${isLatest ? 'text-[var(--text-secondary)]' : 'text-[var(--text-secondary)]'}`}>
                                                        {history.changedByName || 'System'}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="text-sm text-gray-500">배포 이력이 없습니다.</div>
                )}
            </div>
        </div>
    );
}

function PlaygroundTab({ promptId }: { promptId: number }) {
    const queryClient = useQueryClient();
    const { currentOrgId } = useOrganizationStore();
    const { orgId } = useParams<{ orgId: string }>();
    const parsedOrgId = orgId ? Number(orgId) : undefined;
    const resolvedOrgId = typeof parsedOrgId === 'number' && Number.isFinite(parsedOrgId)
        ? parsedOrgId
        : currentOrgId;
    const isResolvedOrgId = typeof resolvedOrgId === 'number' && !Number.isNaN(resolvedOrgId);

    // --- State ---
    const [provider, setProvider] = useState<ProviderType>('OPENAI');
    const [model, setModel] = useState('');
    const [secondaryProvider, setSecondaryProvider] = useState<ProviderType | ''>('');
    const [secondaryModel, setSecondaryModel] = useState('');
    const [systemPrompt, setSystemPrompt] = useState('');
    const [userTemplate, setUserTemplate] = useState('');
    const [temperature, setTemperature] = useState(0.7);
    const [maxTokens, setMaxTokens] = useState(2048);
    const [topP, setTopP] = useState(1.0);
    const [frequencyPenalty, setFrequencyPenalty] = useState(0.0);
    const [ragEnabled, setRagEnabled] = useState(false);
    const [variables, setVariables] = useState<{ key: string; value: string }[]>([]);
    const [result, setResult] = useState<PlaygroundRunResponse | null>(null);
    const [runError, setRunError] = useState<string | null>(null);
    const [saveOpen, setSaveOpen] = useState(false);
    const [saveTitle, setSaveTitle] = useState('');
    const [releaseAfterSave, setReleaseAfterSave] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [outputCopied, setOutputCopied] = useState(false);
    const [selectedVersionId, setSelectedVersionId] = useState<string>('');
    const [loadedVersionId, setLoadedVersionId] = useState<number | null>(null);
    const [versionLoadError, setVersionLoadError] = useState<string | null>(null);

    // --- Queries ---
    const { data: credentials } = useQuery({
        queryKey: ['provider-credentials', resolvedOrgId],
        queryFn: async () => {
            if (!isResolvedOrgId) return [];
            const response = await organizationApi.getCredentials(resolvedOrgId);
            return response.data;
        },
        enabled: isResolvedOrgId,
    });

    const { data: modelAllowlist } = useQuery({
        queryKey: ['model-allowlist'],
        queryFn: async () => {
            const response = await promptApi.getModelAllowlist();
            return response.data;
        },
    });

    const { data: versions } = useQuery({
        queryKey: ['promptVersions', promptId],
        queryFn: async () => {
            const response = await promptApi.getVersions(promptId);
            return response.data;
        },
    });

    // --- Derived ---
    const providerLabel: Record<string, string> = { OPENAI: 'OpenAI', ANTHROPIC: 'Anthropic', GEMINI: 'Gemini' };
    const normalizeProviderKey = (raw: string) => {
        const n = raw.trim().toLowerCase();
        if (n === 'google') return 'GEMINI';
        if (n === 'claude') return 'ANTHROPIC';
        return n.toUpperCase();
    };
    const availableProviders = Array.from(
        new Set((credentials || [])
            .filter((c) => c.status === 'ACTIVE')
            .map((c) => normalizeProviderKey(c.provider)))
    ).filter((p) => providerLabel[p]);

    const providerModels = useMemo(() => {
        if (!modelAllowlist) return [];
        return modelAllowlist[provider] ?? [];
    }, [modelAllowlist, provider]);

    // Extract {{variables}} from userTemplate
    const templateVars = useMemo(() => {
        const matches = userTemplate.match(/\{\{(\w+)\}\}/g) || [];
        return [...new Set(matches.map((m) => m.replace(/\{\{|\}\}/g, '')))];
    }, [userTemplate]);

    // Sync variables list with template vars
    useEffect(() => {
        setVariables((prev) => {
            const existing = new Map(prev.map((v) => [v.key, v.value]));
            return templateVars.map((key) => ({ key, value: existing.get(key) || '' }));
        });
    }, [templateVars]);

    // Auto-select first available provider/model
    useEffect(() => {
        if (availableProviders.length && !availableProviders.includes(provider)) {
            setProvider(availableProviders[0] as ProviderType);
        }
    }, [availableProviders, provider]);

    useEffect(() => {
        if (providerModels.length && !providerModels.includes(model)) {
            setModel(providerModels[0]);
        }
    }, [providerModels, model]);

    const secondaryProviderModels = useMemo(() => {
        if (!modelAllowlist || !secondaryProvider) return [];
        return modelAllowlist[secondaryProvider as ProviderType] ?? [];
    }, [modelAllowlist, secondaryProvider]);

    useEffect(() => {
        if (!secondaryProvider) return;
        if (!availableProviders.includes(secondaryProvider)) {
            setSecondaryProvider('');
            setSecondaryModel('');
        }
    }, [availableProviders, secondaryProvider]);

    useEffect(() => {
        if (!secondaryProvider) {
            if (secondaryModel) setSecondaryModel('');
            return;
        }
        if (!secondaryProviderModels.length) {
            if (secondaryModel) setSecondaryModel('');
            return;
        }
        if (!secondaryProviderModels.includes(secondaryModel)) {
            setSecondaryModel(secondaryProviderModels[0]);
        }
    }, [secondaryProvider, secondaryModel, secondaryProviderModels]);

    // Load version into playground
    const loadVersion = useCallback((versionId: number) => {
        setVersionLoadError(null);
        setResult(null);
        setRunError(null);
        promptApi.getVersion(promptId, versionId).then((res) => {
            const v = res.data;
            setProvider(v.provider);
            setModel(v.model);
            setSecondaryProvider(v.secondaryProvider ?? '');
            setSecondaryModel(v.secondaryModel ?? '');
            setSystemPrompt(v.systemPrompt || '');
            setUserTemplate(v.userTemplate || '');
            setRagEnabled(v.ragEnabled ?? false);
            setTemperature(v.modelConfig?.temperature ?? 0.7);
            setMaxTokens(v.modelConfig?.maxTokens ?? 2048);
            setTopP(v.modelConfig?.topP ?? 1.0);
            setFrequencyPenalty(v.modelConfig?.frequencyPenalty ?? 0.0);
            setLoadedVersionId(versionId);
        }).catch((err) => {
            const msg = axios.isAxiosError(err)
                ? err.response?.data?.message || err.message
                : (err instanceof Error ? err.message : 'Unknown error');
            setVersionLoadError(msg);
        });
    }, [promptId]);

    // --- Mutations ---
    const buildModelConfig = useCallback(() => ({
        temperature,
        maxTokens,
        topP,
        frequencyPenalty,
    }), [temperature, maxTokens, topP, frequencyPenalty]);

    const runMutation = useMutation({
        mutationFn: async () => {
            setRunError(null);
            const varsMap: Record<string, string> = {};
            variables.forEach((v) => { varsMap[v.key] = v.value; });
            const response = await promptApi.playgroundRun(promptId, {
                provider,
                model,
                systemPrompt: systemPrompt || undefined,
                userTemplate,
                ragEnabled,
                modelConfig: buildModelConfig(),
                variables: varsMap,
                baseVersionId: loadedVersionId ?? undefined,
            });
            return response.data;
        },
        onSuccess: (data) => { setResult(data); },
        onError: (err) => {
            const msg = axios.isAxiosError(err) ? err.response?.data?.message || err.message : (err instanceof Error ? err.message : 'Unknown error');
            setRunError(msg);
            setResult(null);
        },
    });

    const saveMutation = useMutation({
        mutationFn: async () => {
            setSaveError(null);
            return promptApi.playgroundSave(promptId, {
                title: saveTitle.trim() || undefined,
                provider,
                model,
                secondaryProvider: secondaryProvider || undefined,
                secondaryModel: secondaryProvider ? secondaryModel || undefined : undefined,
                systemPrompt: systemPrompt || undefined,
                userTemplate,
                ragEnabled,
                modelConfig: buildModelConfig(),
                releaseAfterSave,
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['promptVersions', promptId] });
            queryClient.invalidateQueries({ queryKey: ['promptRelease', promptId] });
            setSaveOpen(false);
            setSaveTitle('');
            setReleaseAfterSave(false);
        },
        onError: (err) => {
            const msg = axios.isAxiosError(err) ? err.response?.data?.message || err.message : (err instanceof Error ? err.message : 'Unknown error');
            setSaveError(msg);
        },
    });

    const providerDotClass = (p: string) => {
        if (p === 'OPENAI') return 'bg-blue-400';
        if (p === 'GEMINI') return 'bg-emerald-400';
        if (p === 'ANTHROPIC') return 'bg-amber-400';
        return 'bg-gray-500';
    };

    const canRun = userTemplate.trim().length > 0
        && model.trim().length > 0
        && availableProviders.includes(provider)
        && providerModels.includes(model);

    return (
        <div className="space-y-6">
            {/* Top bar: version loader */}
            <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-[var(--foreground)] flex items-center gap-2">
                    <span className="material-symbols-outlined text-[var(--primary)]">play_circle</span>
                    Playground
                </h2>
                <div className="flex items-center gap-3">
                    {versions && versions.length > 0 && (
                        <select
                            className="bg-[var(--input)] border border-[var(--border)] rounded-lg text-sm text-[var(--foreground)] px-3 py-1.5 focus:outline-none focus:border-[var(--primary)]"
                            value={selectedVersionId}
                            onChange={(e) => {
                                const val = e.target.value;
                                setSelectedVersionId(val);
                                if (val) {
                                    loadVersion(Number(val));
                                    setSelectedVersionId('');
                                }
                            }}
                        >
                            <option value="">버전 불러오기...</option>
                            {versions.map((v) => (
                                <option key={v.id} value={v.id}>v{v.versionNumber} — {v.title || '(untitled)'}</option>
                            ))}
                        </select>
                    )}
                    <button
                        type="button"
                        onClick={() => { setSaveError(null); setSaveOpen(true); }}
                        disabled={!canRun}
                        className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--foreground)] hover:border-[var(--ring)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        <Save size={14} /> 버전 저장
                    </button>
                </div>
            </div>

            {versionLoadError && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center justify-between">
                    <span>버전 불러오기 실패: {versionLoadError}</span>
                    <button type="button" onClick={() => setVersionLoadError(null)} className="text-red-400 hover:text-red-300 ml-3">
                        <span className="material-symbols-outlined text-sm">close</span>
                    </button>
                </div>
            )}

            <div className="flex gap-5" style={{ minHeight: 560 }}>
                {/* Left panel: settings */}
                <div className="w-1/2 flex flex-col gap-4">
                    {/* Provider & Model */}
                    <div className="glass-card rounded-xl p-5 space-y-4">
                        <div className="flex items-center gap-2 mb-1">
                            <span className="material-symbols-outlined text-base text-gray-400">tune</span>
                            <span className="text-sm font-semibold text-[var(--text-secondary)]">모델 설정</span>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs text-gray-500 mb-1">Provider</label>
                                <select
                                    value={provider}
                                    onChange={(e) => setProvider(e.target.value as ProviderType)}
                                    className="w-full bg-[var(--input)] border border-[var(--border)] rounded-lg text-sm text-[var(--foreground)] px-3 py-2 focus:outline-none focus:border-[var(--primary)]"
                                >
                                    {availableProviders.map((p) => (
                                        <option key={p} value={p}>{providerLabel[p]}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs text-gray-500 mb-1">Model</label>
                                <select
                                    value={model}
                                    onChange={(e) => setModel(e.target.value)}
                                    className="w-full bg-[var(--input)] border border-[var(--border)] rounded-lg text-sm text-[var(--foreground)] px-3 py-2 focus:outline-none focus:border-[var(--primary)]"
                                >
                                    {providerModels.map((m) => (
                                        <option key={m} value={m}>{m}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer select-none">
                                <input
                                    type="checkbox"
                                    checked={ragEnabled}
                                    onChange={(e) => setRagEnabled(e.target.checked)}
                                    className="w-3.5 h-3.5 rounded border-gray-600 accent-[var(--primary)]"
                                />
                                RAG 사용
                            </label>
                        </div>
                    </div>

                    {/* System Prompt */}
                    <div className="glass-card rounded-xl p-5 flex-1 flex flex-col">
                        <label className="flex items-center gap-2 text-sm font-semibold text-[var(--text-secondary)] mb-2">
                            <span className="material-symbols-outlined text-base text-gray-400">psychology</span>
                            System Prompt
                        </label>
                        <textarea
                            value={systemPrompt}
                            onChange={(e) => setSystemPrompt(e.target.value)}
                            placeholder="시스템 프롬프트를 입력하세요..."
                            className="flex-1 w-full p-3 bg-[var(--input)] border border-[var(--border)] rounded-lg text-sm text-[var(--foreground)] font-mono focus:outline-none focus:border-[var(--primary)] resize-none placeholder-[var(--text-secondary)]"
                            rows={4}
                        />
                    </div>

                    {/* User Template */}
                    <div className="glass-card rounded-xl p-5 flex flex-col">
                        <label className="flex items-center gap-2 text-sm font-semibold text-[var(--text-secondary)] mb-2">
                            <span className="material-symbols-outlined text-base text-gray-400">chat</span>
                            User Template
                        </label>
                        <textarea
                            value={userTemplate}
                            onChange={(e) => setUserTemplate(e.target.value)}
                            placeholder="사용자 템플릿을 입력하세요. 예: {{question}}에 대해 답변해주세요."
                            className="w-full p-3 bg-[var(--input)] border border-[var(--border)] rounded-lg text-sm text-[var(--foreground)] font-mono focus:outline-none focus:border-[var(--primary)] resize-none placeholder-[var(--text-secondary)]"
                            rows={3}
                        />
                    </div>

                    {/* Variables */}
                    {templateVars.length > 0 && (
                        <div className="glass-card rounded-xl p-5 space-y-3">
                            <div className="flex items-center gap-2">
                                <span className="material-symbols-outlined text-base text-gray-400">data_object</span>
                                <span className="text-sm font-semibold text-[var(--text-secondary)]">Variables</span>
                            </div>
                            {variables.map((v, i) => (
                                <div key={v.key} className="flex items-center gap-3">
                                    <span className="text-xs text-[var(--primary)] font-mono bg-[var(--primary)]/10 px-2 py-1 rounded border border-[var(--primary)]/20 min-w-[80px] text-center">
                                        {`{{${v.key}}}`}
                                    </span>
                                    <input
                                        value={v.value}
                                        onChange={(e) => {
                                            const next = [...variables];
                                            next[i] = { ...next[i], value: e.target.value };
                                            setVariables(next);
                                        }}
                                        placeholder={`${v.key} 값 입력`}
                                        className="flex-1 bg-[var(--input)] border border-[var(--border)] rounded-lg text-sm text-[var(--foreground)] px-3 py-2 focus:outline-none focus:border-[var(--primary)] placeholder-[var(--text-secondary)]"
                                    />
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Parameters */}
                    <div className="glass-card rounded-xl p-5 space-y-5">
                        <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-base text-gray-400">tune</span>
                            <span className="text-sm font-semibold text-[var(--text-secondary)]">Parameters</span>
                        </div>

                        {/* Temperature */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-xs text-gray-400">Temperature</span>
                                <input
                                    type="number"
                                    value={temperature}
                                    onChange={(e) => setTemperature(Math.min(2, Math.max(0, parseFloat(e.target.value) || 0)))}
                                    step={0.1}
                                    min={0}
                                    max={2}
                                    className="w-16 bg-[var(--input)] border border-[var(--border)] rounded-md text-xs text-[var(--foreground)] px-2 py-1 text-center focus:outline-none focus:border-[var(--primary)] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                />
                            </div>
                            <input
                                type="range"
                                value={temperature}
                                onChange={(e) => setTemperature(parseFloat(e.target.value))}
                                min={0}
                                max={2}
                                step={0.1}
                                className="w-full h-1.5 rounded-full appearance-none cursor-pointer bg-[var(--border)] accent-[var(--primary)] [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[var(--primary)] [&::-webkit-slider-thumb]:shadow-[0_0_8px_rgba(168,85,247,0.5)]"
                            />
                        </div>

                        {/* Max Tokens */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-xs text-gray-400">Max Tokens</span>
                                <input
                                    type="number"
                                    value={maxTokens}
                                    onChange={(e) => setMaxTokens(Math.min(16384, Math.max(100, parseInt(e.target.value) || 100)))}
                                    step={100}
                                    min={100}
                                    max={16384}
                                    className="w-20 bg-[var(--input)] border border-[var(--border)] rounded-md text-xs text-[var(--foreground)] px-2 py-1 text-center focus:outline-none focus:border-[var(--primary)] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                />
                            </div>
                            <input
                                type="range"
                                value={maxTokens}
                                onChange={(e) => setMaxTokens(parseInt(e.target.value))}
                                min={100}
                                max={16384}
                                step={100}
                                className="w-full h-1.5 rounded-full appearance-none cursor-pointer bg-[var(--border)] accent-[var(--primary)] [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[var(--primary)] [&::-webkit-slider-thumb]:shadow-[0_0_8px_rgba(168,85,247,0.5)]"
                            />
                        </div>

                        {/* Top P */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-xs text-gray-400">Top P</span>
                                <input
                                    type="number"
                                    value={topP}
                                    onChange={(e) => setTopP(Math.min(1, Math.max(0, parseFloat(e.target.value) || 0)))}
                                    step={0.05}
                                    min={0}
                                    max={1}
                                    className="w-16 bg-[var(--input)] border border-[var(--border)] rounded-md text-xs text-[var(--foreground)] px-2 py-1 text-center focus:outline-none focus:border-[var(--primary)] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                />
                            </div>
                            <input
                                type="range"
                                value={topP}
                                onChange={(e) => setTopP(parseFloat(e.target.value))}
                                min={0}
                                max={1}
                                step={0.05}
                                className="w-full h-1.5 rounded-full appearance-none cursor-pointer bg-[var(--border)] accent-[var(--primary)] [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[var(--primary)] [&::-webkit-slider-thumb]:shadow-[0_0_8px_rgba(168,85,247,0.5)]"
                            />
                        </div>

                        {/* Frequency Penalty */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-xs text-gray-400">Frequency Penalty</span>
                                <input
                                    type="number"
                                    value={frequencyPenalty}
                                    onChange={(e) => setFrequencyPenalty(Math.min(2, Math.max(0, parseFloat(e.target.value) || 0)))}
                                    step={0.1}
                                    min={0}
                                    max={2}
                                    className="w-16 bg-[var(--input)] border border-[var(--border)] rounded-md text-xs text-[var(--foreground)] px-2 py-1 text-center focus:outline-none focus:border-[var(--primary)] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                />
                            </div>
                            <input
                                type="range"
                                value={frequencyPenalty}
                                onChange={(e) => setFrequencyPenalty(parseFloat(e.target.value))}
                                min={0}
                                max={2}
                                step={0.1}
                                className="w-full h-1.5 rounded-full appearance-none cursor-pointer bg-[var(--border)] accent-[var(--primary)] [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[var(--primary)] [&::-webkit-slider-thumb]:shadow-[0_0_8px_rgba(168,85,247,0.5)]"
                            />
                        </div>
                    </div>
                </div>

                {/* Right panel: output */}
                <div className="w-1/2 flex flex-col gap-4">
                    {/* Run button area */}
                    <div className="glass-card rounded-xl p-5 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <span className={`w-2 h-2 rounded-full ${providerDotClass(provider)}`} />
                            <span className="text-sm text-gray-400">{providerLabel[provider] || provider} / {model || '-'}</span>
                        </div>
                        <button
                            type="button"
                            onClick={() => runMutation.mutate()}
                            disabled={!canRun || runMutation.isPending}
                            className="bg-[var(--primary)] hover:bg-purple-600 text-white px-6 py-2 rounded-lg text-sm font-semibold shadow-[0_0_15px_rgba(168,85,247,0.4)] transition-all flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
                        >
                            {runMutation.isPending ? (
                                <>
                                    <span className="material-symbols-outlined text-base animate-spin">progress_activity</span>
                                    실행 중...
                                </>
                            ) : (
                                <>
                                    <Play size={14} /> Run
                                </>
                            )}
                        </button>
                    </div>

                    {/* Output */}
                    <div className="glass-card rounded-xl flex-1 flex flex-col overflow-hidden">
                        <div className="px-5 py-3 border-b border-[var(--border)] flex items-center justify-between">
                            <span className="text-sm font-semibold text-[var(--text-secondary)] flex items-center gap-2">
                                <span className="material-symbols-outlined text-base text-gray-400">output</span>
                                Output
                            </span>
                            {result && (
                                <button
                                    type="button"
                                    onClick={async () => {
                                        try {
                                            await navigator.clipboard.writeText(result.answer ?? '');
                                            setOutputCopied(true);
                                            setTimeout(() => setOutputCopied(false), 2000);
                                        } catch { /* ignore */ }
                                    }}
                                    className="text-xs text-gray-500 hover:text-[var(--foreground)] flex items-center gap-1 transition-colors"
                                >
                                    <Copy size={12} />
                                    {outputCopied ? '복사됨' : '복사'}
                                </button>
                            )}
                        </div>
                        <div className="flex-1 p-5 overflow-auto">
                            {runError && (
                                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm mb-3">
                                    {runError}
                                </div>
                            )}
                            {result ? (
                                <pre className="text-sm text-[var(--foreground)] whitespace-pre-wrap font-sans leading-relaxed">
                                    {result.answer ?? '(응답 없음)'}
                                </pre>
                            ) : (
                                <div className="flex flex-col items-center justify-center h-full text-gray-600 gap-3">
                                    <span className="material-symbols-outlined text-4xl">play_circle</span>
                                    <p className="text-sm">프롬프트를 설정하고 Run 버튼을 눌러 테스트하세요</p>
                                </div>
                            )}
                        </div>
                        {result && (
                            <div className="px-5 py-3 border-t border-[var(--border)] flex flex-wrap items-center gap-4 text-xs text-gray-500">
                                <span className="flex items-center gap-1.5">
                                    <span className="material-symbols-outlined text-sm">timer</span>
                                    {result.latencyMs != null ? `${(result.latencyMs / 1000).toFixed(2)}s` : '-'}
                                </span>
                                <span className="flex items-center gap-1.5">
                                    <span className="material-symbols-outlined text-sm">token</span>
                                    {result.usage?.inputTokens ?? '-'} in / {result.usage?.outputTokens ?? '-'} out / {result.usage?.totalTokens ?? '-'} total
                                </span>
                                {result.usage?.estimatedCost != null && (
                                    <span className="flex items-center gap-1.5">
                                        <span className="material-symbols-outlined text-sm">payments</span>
                                        ${result.usage.estimatedCost.toFixed(6)}
                                    </span>
                                )}
                                <span className="flex items-center gap-1.5">
                                    <span className="material-symbols-outlined text-sm">smart_toy</span>
                                    {result.usedModel || '-'}
                                </span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Save as version modal */}
            {saveOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setSaveOpen(false)} />
                    <div className="relative z-10 w-full max-w-md rounded-2xl overflow-hidden border border-[var(--primary)]/30 shadow-[0_0_0_1px_rgba(168,85,247,0.10),0_0_30px_rgba(168,85,247,0.15),0_25px_50px_-12px_rgba(0,0,0,0.80)] bg-[var(--card)] backdrop-blur-2xl">
                        <div className="px-6 py-5 border-b border-[var(--border)]">
                            <h4 className="text-lg font-semibold text-[var(--foreground)] flex items-center gap-2">
                                <span className="w-1.5 h-5 rounded-full bg-[var(--primary)] shadow-[0_0_10px_rgba(168,85,247,0.50)]" />
                                새 버전으로 저장
                            </h4>
                            <p className="text-xs text-[var(--text-secondary)] mt-1 pl-3.5">현재 플레이그라운드 설정을 새 프롬프트 버전으로 저장합니다</p>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs text-[var(--text-secondary)] mb-1.5">버전 제목 (선택)</label>
                                <input
                                    value={saveTitle}
                                    onChange={(e) => setSaveTitle(e.target.value)}
                                    placeholder="예: GPT-4o 튜닝 v3"
                                    className="w-full bg-[var(--input)] border border-[var(--border)] rounded-lg text-sm text-[var(--foreground)] px-3 py-2 focus:outline-none focus:border-[var(--primary)] placeholder-[var(--text-secondary)]"
                                />
                            </div>
                            <div className="glass-card rounded-lg p-3 flex items-center justify-between">
                                <div>
                                    <div className="text-sm text-[var(--text-secondary)] font-medium">저장 후 즉시 배포</div>
                                    <div className="text-xs text-gray-500 mt-0.5">새 버전을 바로 활성 릴리즈로 설정합니다</div>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={releaseAfterSave}
                                        onChange={(e) => setReleaseAfterSave(e.target.checked)}
                                        className="sr-only peer"
                                    />
                                    <div className="w-9 h-5 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-gray-400 after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[var(--primary)] peer-checked:after:bg-white" />
                                </label>
                            </div>
                            {saveError && (
                                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                                    {saveError}
                                </div>
                            )}
                        </div>
                        <div className="px-6 py-4 border-t border-[var(--border)] flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => setSaveOpen(false)}
                                className="px-4 py-2 rounded-lg text-sm text-[var(--text-secondary)] hover:text-[var(--foreground)] border border-[var(--border)] hover:border-[var(--ring)] transition-colors"
                            >
                                취소
                            </button>
                            <button
                                type="button"
                                onClick={() => saveMutation.mutate()}
                                disabled={saveMutation.isPending}
                                className="bg-[var(--primary)] hover:bg-purple-600 text-white px-5 py-2 rounded-lg text-sm font-medium shadow-[0_0_15px_rgba(168,85,247,0.4)] transition-all disabled:opacity-50 flex items-center gap-2"
                            >
                                {saveMutation.isPending ? (
                                    <>
                                        <span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>
                                        저장 중...
                                    </>
                                ) : (
                                    <>
                                        <Save size={14} />
                                        {releaseAfterSave ? '저장 & 배포' : '저장'}
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
