import { useEffect, useMemo, useState } from 'react';
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
    ProviderType
} from '@/types/api.types';

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
                    <span className="text-xs text-gray-500 group-hover:text-gray-300 transition-colors">
                        워크스페이스로 돌아가기
                    </span>
                </Link>

                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-white/10 to-white/5 border border-white/10 flex items-center justify-center">
                        <span className="material-symbols-outlined text-2xl text-white">chat_bubble</span>
                    </div>
                    <div className="min-w-0">
                        <div className="flex items-center gap-3">
                            <h1 className="text-3xl font-bold text-white tracking-tight truncate">{prompt.promptKey}</h1>
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-green-500 text-black shadow-[0_0_10px_rgba(34,197,94,0.4)]">
                                {prompt.status}
                            </span>
                        </div>
                        <p className="text-gray-400 text-sm mt-1">Prompt Configuration &amp; Version Control</p>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="border-b border-white/10 flex items-center gap-8 text-sm font-medium">
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
                {activeTab === 'playground' && <PlaygroundTab />}
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
            className={`relative py-3 flex items-center gap-2 transition-colors ${kind === 'playground' ? 'ml-4' : ''} ${active ? 'text-[var(--primary)]' : 'text-gray-400 hover:text-gray-200'} group`}
        >
            <span
                className={`material-symbols-outlined text-lg ${active ? (kind === 'playground' ? 'text-[var(--primary)]' : 'text-[var(--primary)]') : (kind === 'playground' ? 'text-[var(--primary)] group-hover:text-white' : 'text-gray-500 group-hover:text-gray-300')} transition-colors`}
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
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">기본 정보</h2>
                    <div className="flex items-center gap-2">
                        {isEditing ? (
                            <>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setDraftDescription(prompt.description ?? '');
                                        setIsEditing(false);
                                    }}
                                    className="text-xs text-gray-300 hover:text-white transition-colors border border-white/10 px-3 py-1.5 rounded-lg hover:bg-white/5"
                                >
                                    취소
                                </button>
                                <button
                                    type="button"
                                    disabled={saveMutation.isPending}
                                    onClick={() => saveMutation.mutate()}
                                    className="text-xs text-[var(--primary)] hover:text-white transition-colors border border-[var(--primary)]/30 px-3 py-1.5 rounded-lg hover:bg-[var(--primary)]/20 disabled:opacity-50 inline-flex items-center gap-1"
                                >
                                    <Save size={14} />
                                    저장
                                </button>
                            </>
                        ) : (
                            <button
                                type="button"
                                onClick={() => setIsEditing(true)}
                                className="text-xs text-[var(--primary)] hover:text-white transition-colors border border-[var(--primary)]/30 px-3 py-1.5 rounded-lg hover:bg-[var(--primary)]/20"
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
                                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:ring-2 focus:ring-[var(--primary)]/50 focus:border-[var(--primary)] transition-all font-mono tracking-wide"
                                readOnly
                                value={prompt.promptKey}
                            />
                            <button
                                type="button"
                                onClick={() => navigator.clipboard.writeText(prompt.promptKey)}
                                className="absolute right-3 top-3 text-gray-500 hover:text-white transition-colors opacity-0 group-hover:opacity-100"
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
                                ? 'bg-black/40 border-white/10 text-white focus:ring-1 focus:ring-[var(--primary)]/50 focus:border-[var(--primary)]'
                                : 'bg-black/20 border-white/5 text-gray-300'
                                }`}
                            readOnly={!isEditing}
                            value={draftDescription}
                            onChange={(e) => setDraftDescription(e.target.value)}
                        />
                    </div>

                    <div className="pt-4 mt-auto border-t border-white/5">
                        <div className="flex justify-between items-center text-xs">
                            <span className="text-gray-500">Created At</span>
                            <span className="text-gray-300 font-mono">{new Date(prompt.createdAt).toLocaleString('ko-KR')}</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="glass-card rounded-2xl p-8 h-full relative overflow-hidden group">
                <div className="absolute -right-20 -top-20 w-64 h-64 bg-green-500/5 rounded-full blur-[80px] pointer-events-none" />

                <div className="flex items-center justify-between mb-8 relative z-10">
                    <h2 className="text-lg font-bold text-white">최신 배포 상태</h2>
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
                            <div className="text-6xl font-bold text-white tracking-tighter flex items-baseline gap-1">
                                {isReleaseLoading ? (
                                    <span className="text-2xl text-gray-300">Loading...</span>
                                ) : release ? (
                                    <>
                                        v{release.activeVersionNo}
                                        <span className="text-lg font-medium text-gray-500 tracking-normal">latest</span>
                                    </>
                                ) : (
                                    <span className="text-2xl text-gray-300">-</span>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4 border-t border-white/5 pt-6">
                        <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2 text-gray-400 text-sm">
                                <span className="material-symbols-outlined text-sm">schedule</span>
                                <span>Last Deployed</span>
                            </div>
                            <span className="text-white font-mono text-sm">
                                {release ? new Date(release.releasedAt).toLocaleString('ko-KR') : '-'}
                            </span>
                        </div>

                        <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2 text-gray-400 text-sm">
                                <span className="material-symbols-outlined text-sm">person</span>
                                <span>Deployed By</span>
                            </div>
                            <span className="text-white text-sm">
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
                            className="w-full py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-sm font-medium text-gray-300 hover:text-white transition-all flex items-center justify-center gap-2 group"
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
        new Set((credentials || []).map((cred) => normalizeProviderKey(cred.provider)))
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

    if (isLoading) return <div className="text-gray-400">버전 정보를 불러오는 중...</div>;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-lg font-bold text-white">버전 히스토리</h2>
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
                                className={`glass-card rounded-xl p-0 overflow-hidden transition-all group ${isCurrent ? 'hover:border-[var(--primary)]/40' : 'opacity-80 hover:opacity-100 hover:border-white/20'}`}
                            >
                                <div className="p-5 flex items-center justify-between gap-6">
                                    <div className="flex items-center gap-6 min-w-0">
                                        <div className={`w-10 h-10 rounded-lg border flex items-center justify-center text-sm font-bold ${isCurrent ? 'bg-gray-800 border-gray-700 text-gray-300' : 'bg-gray-800/50 border-gray-700/50 text-gray-500'}`}>
                                            v{ver.versionNumber}
                                        </div>
                                        <div className="space-y-1 min-w-0">
                                            <div className="flex items-center gap-3 flex-wrap">
                                                <span className={`text-base font-bold ${isCurrent ? 'text-white' : 'text-gray-300'} truncate`}>
                                                    {ver.title || '(untitled)'}
                                                </span>
                                                {isCurrent ? (
                                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[var(--primary)]/20 text-[var(--primary)] border border-[var(--primary)]/30">
                                                        CURRENT
                                                    </span>
                                                ) : null}
                                            </div>
                                            <div className={`flex items-center gap-2 text-xs ${isCurrent ? 'text-gray-400' : 'text-gray-500'} flex-wrap`}>
                                                <span className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-white/5 border border-white/5">
                                                    <span className={`w-1.5 h-1.5 rounded-full ${providerDotClass(ver.provider)}`} />
                                                    {prettyModel(ver.model)}
                                                </span>
                                                {ver.secondaryProvider && ver.secondaryModel ? (
                                                    <>
                                                        <span className="text-gray-600">/</span>
                                                        <span className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-white/5 border border-white/5">
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
                                            <div className={`text-sm text-gray-300 font-mono ${isCurrent ? '' : 'opacity-80'}`}>
                                                {formatKoDateTime(ver.createdAt)}
                                            </div>
                                        </div>

                                        <div className="text-right hidden md:block">
                                            <div className={`text-xs mb-0.5 ${isCurrent ? 'text-gray-500' : 'text-gray-600'}`}>Author</div>
                                            <div className="flex items-center justify-end gap-2">
                                                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[8px] text-white ${isCurrent ? 'bg-gradient-to-br from-purple-600 to-indigo-700' : 'bg-gray-700 text-gray-300'}`}>
                                                    {(ver.createdByName || '?').slice(0, 1)}
                                                </div>
                                                <span className={`text-sm ${isCurrent ? 'text-gray-300' : 'text-gray-400'}`}>{ver.createdByName || '-'}</span>
                                            </div>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={() => setDetailVersionId(ver.id)}
                                            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors border ${isCurrent ? 'text-gray-300 hover:text-white border-gray-700 hover:border-gray-500' : 'text-gray-500 hover:text-white border-gray-800 hover:border-gray-600'}`}
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
                        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                        onClick={() => setIsCreateOpen(false)}
                    />
                    <div className="relative z-10 w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl overflow-hidden border border-[var(--primary)]/30 shadow-[0_0_0_1px_rgba(168,85,247,0.10),0_0_30px_rgba(168,85,247,0.15),0_25px_50px_-12px_rgba(0,0,0,0.80)] bg-[radial-gradient(140%_140%_at_50%_0%,rgba(22,25,35,0.95)_0%,rgba(10,10,12,0.98)_100%)] backdrop-blur-2xl">
                        <div className="px-8 py-6 border-b border-white/5 flex flex-col gap-2 shrink-0 bg-white/[0.02]">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h4 className="text-xl font-semibold text-white tracking-tight flex items-center gap-2">
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
                                    className="text-gray-400 hover:text-white transition-colors"
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
                                            className="px-3 py-1.5 rounded-full border border-gray-800 bg-gray-900/50 hover:border-[var(--primary)]/40 hover:bg-[var(--primary)]/10 text-xs text-gray-300 transition-all duration-300 flex items-center gap-1.5 group"
                                        >
                                            <span className="material-symbols-outlined text-[14px] text-gray-400 group-hover:text-purple-300 transition-colors">
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
                            <div className="bg-gray-900/60 border border-gray-800/80 rounded-xl p-5 backdrop-blur-sm">
                                <div className="flex flex-col sm:flex-row items-end gap-3">
                                    <div className="flex-1">
                                        <label className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wider">기존 버전 불러오기</label>
                                        <select
                                            value={baseVersionId ?? ''}
                                            onChange={(e) => setBaseVersionId(Number(e.target.value) || null)}
                                            className="w-full bg-[#0c0c0e] border border-[#27272a] rounded-md py-2.5 px-3 text-sm text-gray-100 focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/30 outline-none transition-all"
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
                                        className="px-4 py-2 bg-gray-800/80 hover:bg-gray-700 border border-gray-700 hover:border-gray-600 rounded-md text-xs font-medium text-gray-300 transition-colors shrink-0 shadow-lg disabled:opacity-50"
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
                                <label className="block text-sm font-medium text-gray-300">제목</label>
                                <input
                                    type="text"
                                    value={form.title}
                                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                                    className="w-full bg-[#0c0c0e] border border-[#27272a] rounded-md py-2.5 px-3 text-sm text-gray-100 placeholder-gray-600 focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/30 outline-none transition-all"
                                    placeholder="예: 2026-02-01 실험용"
                                />
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label htmlFor="prompt-provider" className="block text-sm font-medium text-gray-300 mb-1">Provider</label>
                                    <div className="relative group">
                                        <select
                                            id="prompt-provider"
                                            value={form.provider}
                                            onChange={(e) => setForm({ ...form, provider: e.target.value as typeof form.provider })}
                                            className="w-full bg-[#0c0c0e] border border-[#27272a] rounded-md py-2.5 px-3 text-sm appearance-none pr-10 cursor-pointer text-gray-100 focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/30 outline-none transition-all disabled:opacity-50"
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
                                    <label htmlFor="prompt-model" className="block text-sm font-medium text-gray-300 mb-1">Model</label>
                                    <div className="relative group">
                                        <select
                                            id="prompt-model"
                                            value={form.model}
                                            onChange={(e) => setForm({ ...form, model: e.target.value })}
                                            className="w-full bg-[#0c0c0e] border border-[#27272a] rounded-md py-2.5 px-3 text-sm appearance-none pr-10 cursor-pointer text-gray-100 focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/30 outline-none transition-all disabled:opacity-50"
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
                                            className="w-full rounded-md py-2.5 px-3 text-sm text-gray-300 appearance-none pr-10 border border-gray-800 bg-gray-900/30 focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20 outline-none transition-all disabled:opacity-50 cursor-pointer"
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
                                            className="w-full rounded-md py-2.5 px-3 text-sm text-gray-300 appearance-none pr-10 border border-gray-800 bg-gray-900/30 focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20 outline-none transition-all disabled:opacity-50 cursor-pointer"
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
                                <label className="block text-sm font-medium text-gray-300 flex items-center gap-2">
                                    <span className="material-symbols-outlined text-sm text-purple-300">terminal</span>
                                    System Prompt
                                </label>
                                <div className="relative">
                                    <textarea
                                        value={form.systemPrompt}
                                        onChange={(e) => setForm({ ...form, systemPrompt: e.target.value })}
                                        rows={5}
                                        className="w-full rounded-md py-3 px-4 text-sm text-gray-300 placeholder-gray-600 resize-none shadow-inner font-mono bg-[#050507] border border-[#1f2937] focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/30 outline-none transition-all"
                                        placeholder="// 시스템 프롬프트를 입력하세요."
                                    />
                                    <div className="absolute bottom-2 right-3 text-[10px] text-gray-600 font-mono">markdown supported</div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="block text-sm font-medium text-gray-300 flex items-center justify-between">
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
                                    className="w-full rounded-md py-3 px-4 text-sm text-gray-300 placeholder-gray-600 resize-none font-mono bg-[#050507] border border-[var(--primary)]/20 shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)] focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/30 outline-none transition-all"
                                    placeholder="예: 사용자 질문: {{question}}"
                                />
                                <p className="text-[11px] text-gray-400 flex items-center gap-1.5 pl-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--primary)] shadow-[0_0_5px_rgba(168,85,247,0.8)]"></span>
                                    <code className="bg-gray-800 px-1 py-0.5 rounded text-purple-200 font-mono text-[10px]">{'{{question}}'}</code>
                                    변수가 반드시 포함되어야 합니다.
                                </p>
                                {templateError && (
                                    <p className="mt-1 text-xs text-rose-300">{templateError}</p>
                                )}
                            </div>

                            <div className="h-px bg-white/5 my-2"></div>

                            <div className="space-y-1.5">
                                <label className="block text-sm font-medium text-gray-300">
                                    관련 링크 <span className="text-gray-500 text-xs font-normal">(선택)</span>
                                </label>
                                <div className="relative">
                                    <span className="absolute left-3 top-2.5 material-symbols-outlined text-gray-600 text-sm">link</span>
                                    <input
                                        value={form.contextUrl}
                                        onChange={(e) => setForm({ ...form, contextUrl: e.target.value })}
                                        className="w-full rounded-md py-2.5 pl-9 pr-3 text-sm placeholder-gray-600 bg-[#0c0c0e] border border-[#27272a] text-gray-100 focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/30 outline-none transition-all"
                                        placeholder="Jira/Notion 링크를 입력하세요"
                                        type="text"
                                    />
                                </div>
                                <p className="text-[11px] text-gray-500 pl-1">변경 근거를 남겨두면 추적이 쉬워집니다.</p>
                            </div>

                            <div className="space-y-1.5">
                                <label className="block text-sm font-medium text-gray-300 font-mono text-xs">Model Config (JSON)</label>
                                <textarea
                                    value={form.modelConfig}
                                    onChange={(e) => setForm({ ...form, modelConfig: e.target.value })}
                                    rows={2}
                                    className="w-full rounded-md py-3 px-4 text-xs text-gray-300 placeholder-gray-600 resize-none font-mono bg-[#050507] border border-[#1f2937] focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/30 outline-none transition-all"
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
                        <div className="px-8 py-5 border-t border-white/5 bg-[#0a0a0c]/80 flex justify-end gap-3 shrink-0 backdrop-blur-md">
                            <button
                                type="button"
                                onClick={() => setIsCreateOpen(false)}
                                className="px-6 py-2.5 rounded-lg border border-white/10 text-sm font-medium text-gray-300 hover:bg-white/5 hover:text-white hover:border-white/20 transition-all duration-200"
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
                        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                        onClick={() => setDetailVersionId(null)}
                    />
                    <div className="relative w-full max-w-5xl max-h-[90vh] flex flex-col glass-card rounded-2xl shadow-[0_25px_50px_-12px_rgba(0,0,0,0.50),0_0_0_1px_rgba(255,255,255,0.10)_inset] overflow-hidden border border-white/10">
                        <div className="px-8 py-5 border-b border-white/5 flex items-start justify-between bg-white/[0.01]">
                            <div>
                                <div className="flex items-center gap-3">
                                    <h4 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                                        <span className="material-symbols-outlined text-[var(--primary)] text-2xl">settings_suggest</span>
                                        버전 상세
                                    </h4>
                                    {currentRelease?.activeVersionId && detailVersionId === currentRelease.activeVersionId ? (
                                        <span className="px-2 py-0.5 rounded-full bg-[var(--primary)]/10 border border-[var(--primary)]/20 text-[10px] font-mono text-[var(--primary)] font-semibold tracking-wider uppercase">
                                            Active
                                        </span>
                                    ) : null}
                                </div>
                                <p className="text-sm text-gray-400 mt-1 pl-9">버전의 설정과 템플릿을 확인하고 관리합니다.</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setDetailVersionId(null)}
                                className="group text-gray-500 hover:text-white transition-all p-2 rounded-full hover:bg-white/5 border border-transparent hover:border-white/10"
                                aria-label="close version detail modal"
                                title="닫기"
                            >
                                <span className="material-symbols-outlined text-xl group-hover:rotate-90 transition-transform duration-300">close</span>
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-8 space-y-8 bg-gradient-to-b from-transparent to-black/20">
                            {isDetailLoading || !versionDetail ? (
                                <div className="text-sm text-gray-400">버전 정보를 불러오는 중...</div>
                            ) : (
                                <>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                        <div className="space-y-1.5 p-3 rounded-xl hover:bg-white/[0.02] transition-colors border border-transparent hover:border-white/5">
                                            <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Version ID</div>
                                            <div className="flex items-center gap-2">
                                                <span className="font-mono text-lg font-bold text-white tracking-tight">v{versionDetail.versionNumber}</span>
                                                <span
                                                    className="material-symbols-outlined text-green-500 text-sm"
                                                    style={{ fontVariationSettings: "'FILL' 1" }}
                                                >
                                                    check_circle
                                                </span>
                                            </div>
                                        </div>

                                        <div className="space-y-1.5 p-3 rounded-xl hover:bg-white/[0.02] transition-colors border border-transparent hover:border-white/5">
                                            <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Primary Model</div>
                                            <div className="flex items-center text-sm font-medium text-white">
                                                <span className="px-2 py-1 rounded bg-purple-500/10 text-[10px] font-bold text-purple-300 mr-2 border border-purple-500/20 shadow-[0_0_10px_rgba(168,85,247,0.10)]">
                                                    {versionDetail.provider}
                                                </span>
                                                <span className="font-mono text-gray-200">{versionDetail.model}</span>
                                            </div>
                                        </div>

                                        <div className="space-y-1.5 p-3 rounded-xl hover:bg-white/[0.02] transition-colors border border-transparent hover:border-white/5">
                                            <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Title</div>
                                            <div className="text-sm font-medium text-gray-200 truncate">{versionDetail.title || '-'}</div>
                                        </div>

                                        <div className="space-y-1.5 p-3 rounded-xl hover:bg-white/[0.02] transition-colors border border-transparent hover:border-white/5">
                                            <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Created At</div>
                                            <div className="font-mono text-sm text-gray-400">{formatKoDateTime(versionDetail.createdAt)}</div>
                                        </div>

                                        <div className="space-y-1.5 p-3 rounded-xl hover:bg-white/[0.02] transition-colors border border-transparent hover:border-white/5">
                                            <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Fallback Model</div>
                                            <div className="flex items-center text-sm font-medium text-white">
                                                {versionDetail.secondaryProvider && versionDetail.secondaryModel ? (
                                                    <>
                                                        <span className="px-2 py-1 rounded bg-emerald-500/10 text-[10px] font-bold text-emerald-300 mr-2 border border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.10)]">
                                                            {versionDetail.secondaryProvider}
                                                        </span>
                                                        <span className="font-mono text-gray-200">{versionDetail.secondaryModel}</span>
                                                    </>
                                                ) : (
                                                    <span className="text-gray-500">-</span>
                                                )}
                                            </div>
                                        </div>

                                        <div className="space-y-1.5 p-3 rounded-xl hover:bg-white/[0.02] transition-colors border border-transparent hover:border-white/5 opacity-60">
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

                                    <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent w-full"></div>

                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between">
                                            <label className="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center">
                                                <span className="material-symbols-outlined text-sm mr-2 text-[var(--primary)]">terminal</span>
                                                System Prompt
                                            </label>
                                            <span className="text-[10px] text-gray-600 font-mono bg-white/5 px-2 py-0.5 rounded border border-white/5">READ ONLY</span>
                                        </div>

                                        <div className="relative group">
                                            <div className="absolute -inset-0.5 bg-gradient-to-r from-[var(--primary)]/30 to-blue-600/30 rounded-xl blur opacity-20 group-hover:opacity-40 transition duration-500"></div>
                                            <div className="relative w-full rounded-xl p-0 font-mono text-sm leading-relaxed text-gray-300 h-80 overflow-hidden flex flex-col bg-black/30 border border-white/10 shadow-[inset_0_0_20px_rgba(0,0,0,0.5)]">
                                                <div className="flex items-center justify-between px-4 py-2 bg-white/5 border-b border-white/5">
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
                                                className="absolute top-12 right-4 p-2 rounded-lg bg-white/5 hover:bg-[var(--primary)]/20 text-gray-400 hover:text-white border border-white/5 hover:border-[var(--primary)]/30 opacity-0 group-hover:opacity-100 transition-all duration-200 backdrop-blur-md"
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
                                                <div className="w-full bg-[#0a0a0c] border border-white/10 rounded-xl p-4 font-mono text-sm text-purple-200 shadow-inner min-h-[72px] whitespace-pre-wrap">
                                                    {versionDetail.userTemplate || '(empty)'}
                                                </div>
                                            </div>
                                            <div className="space-y-3">
                                                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Model Config</label>
                                                <div className="w-full bg-[#0a0a0c] border border-white/10 rounded-xl p-4 font-mono text-xs text-gray-400 shadow-inner min-h-[72px] whitespace-pre-wrap">
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

                        <div className="px-8 py-5 border-t border-white/5 bg-[#0a0a0c]/50 flex justify-end items-center shrink-0 backdrop-blur-md">
                            <button
                                type="button"
                                onClick={() => setDetailVersionId(null)}
                                className="px-6 py-2.5 rounded-lg text-sm font-medium text-gray-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 transition-all focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/50 shadow-lg"
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
            <div className="glass-card rounded-2xl p-8 relative overflow-hidden group border border-white/10">
                <div className="absolute top-0 right-0 w-64 h-64 bg-[var(--primary)]/5 rounded-full blur-[80px] -mr-16 -mt-16 pointer-events-none" />

                <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
                    Manual Release
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--primary)] shadow-[0_0_15px_rgba(168,85,247,0.5)]" />
                </h3>
                <p className="text-gray-400 text-sm mb-8 leading-relaxed max-w-2xl">
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
                                    className="block w-full rounded-xl border border-white/10 bg-[#0F0E15]/80 text-gray-200 py-3 px-4 text-sm focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] focus:outline-none transition-all cursor-pointer hover:border-white/20 appearance-none"
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
                                    <span className="material-symbols-outlined text-gray-500">expand_more</span>
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
                                className="block w-full rounded-xl border border-white/10 bg-[#0F0E15]/80 text-gray-200 py-3 px-4 text-sm placeholder:text-gray-600 focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] focus:outline-none transition-all hover:border-white/20"
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

            <div className="glass-card rounded-2xl p-8 min-h-[400px] border border-white/10">
                <div className="flex items-center justify-between mb-8 border-b border-white/5 pb-4">
                    <div>
                        <h3 className="text-lg font-bold text-white mb-1">배포 이력</h3>
                        <p className="text-gray-500 text-xs">운영 환경 배포 히스토리를 확인합니다.</p>
                    </div>
                    <button
                        type="button"
                        onClick={() => refetchReleaseHistory()}
                        className="p-2 text-gray-500 hover:text-white transition-colors rounded-lg hover:bg-white/5"
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

                                    <div className="flex-1 frosted-entry p-5 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] hover:border-[var(--primary)]/30 transition-all cursor-default">
                                        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                                            <div>
                                                <div className="flex items-center gap-3 mb-2">
                                                    <h4 className={`font-bold ${isLatest ? 'text-white' : 'text-gray-300'} text-base`}>
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
                                                <div className="flex items-center gap-2 px-2 py-1 rounded bg-white/5 border border-white/5">
                                                    <div className="w-4 h-4 rounded-full bg-gradient-to-br from-purple-600 to-indigo-700 text-[8px] flex items-center justify-center font-bold text-white">
                                                        {(history.changedByName || 'S').slice(0, 1)}
                                                    </div>
                                                    <span className={`text-xs ${isLatest ? 'text-gray-300' : 'text-gray-400'}`}>
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

function PlaygroundTab() {
    return (
        <div className="h-[600px] flex gap-4">
            {/* Left: Settings & Prompt */}
            <div className="w-1/2 flex flex-col gap-4">
                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex-1 flex flex-col">
                    <h3 className="font-medium text-gray-900 mb-3 flex items-center justify-between">
                        <span>System Prompt</span>
                        <div className="flex gap-2">
                            <select
                                className="text-xs border border-gray-300 rounded px-2 py-1 disabled:opacity-50 disabled:cursor-not-allowed"
                                disabled
                                title="준비 중"
                            >
                                <option>GPT-4</option>
                                <option>GPT-3.5-Turbo</option>
                                <option>Claude-3-Opus</option>
                            </select>
                            <button
                                className="text-indigo-600 hover:text-indigo-700 text-xs font-medium flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                                disabled
                                title="준비 중"
                            >
                                <Save size={12} /> 저장
                            </button>
                        </div>
                    </h3>
                    <textarea
                        className="flex-1 w-full p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                        defaultValue="You are a helpful customer support assistant. Always be polite and concise."
                        readOnly
                        title="준비 중"
                    />
                </div>
                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm h-1/3 flex flex-col">
                    <h3 className="font-medium text-gray-900 mb-3">User Input (Test Case)</h3>
                    <textarea
                        className="flex-1 w-full p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                        placeholder="테스트할 사용자 입력을 입력하세요..."
                        defaultValue="환불 규정이 어떻게 되나요?"
                        readOnly
                        title="준비 중"
                    />
                </div>
            </div>

            {/* Right: Output */}
            <div className="w-1/2 bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col">
                <div className="p-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center rounded-t-xl">
                    <h3 className="font-medium text-gray-900">Output</h3>
                    <button
                        className="bg-indigo-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled
                        title="준비 중"
                    >
                        <Play size={14} /> Run
                    </button>
                </div>
                <div className="flex-1 p-4 overflow-auto">
                    <p className="text-sm text-gray-500">
                        플레이그라운드 준비 중 - 기능이 활성화되면 여기에 결과가 표시됩니다.
                    </p>
                </div>
                <div className="p-3 border-t border-gray-200 text-xs text-gray-500 flex justify-between bg-gray-50 rounded-b-xl">
                    <span>Latency: 1.2s</span>
                    <span>Tokens: 154 / 4096</span>
                </div>
            </div>
        </div>
    );
}
