import { useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { promptApi } from '@/api/prompt.api';

export function PromptCreatePage() {
    const { orgId, workspaceId: workspaceIdParam } = useParams<{ orgId: string; workspaceId: string }>();
    const workspaceId = Number(workspaceIdParam);
    const basePath = orgId ? `/orgs/${orgId}/workspaces/${workspaceId}` : `/workspaces/${workspaceId}`;
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    const [formData, setFormData] = useState({
        promptKey: '',
        description: ''
    });

    const createMutation = useMutation({
        mutationFn: async () => {
            await promptApi.createPrompt(workspaceId, formData);
        },
        onSuccess: () => {
            // 목록 캐시 무효화
            queryClient.invalidateQueries({ queryKey: ['prompts', workspaceId] });
            navigate(`${basePath}/prompts`);
        },
        onError: (error) => {
            console.error('Failed to create prompt:', error);
            alert('프롬프트 생성에 실패했습니다.');
        }
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        createMutation.mutate();
    };

    return (
        <div className="max-w-2xl mx-auto py-8">
            <Link
                to={`${basePath}/prompts`}
                className="flex items-center gap-2 mb-6 group cursor-pointer w-fit"
            >
                <span className="material-symbols-outlined text-[var(--text-secondary)] text-sm group-hover:text-[var(--primary)] transition-colors">arrow_back</span>
                <span className="text-xs text-[var(--text-secondary)] group-hover:text-[var(--foreground)] transition-colors">목록으로 돌아가기</span>
            </Link>

            <div className="glass-card rounded-2xl p-8">
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-12 h-12 rounded-xl bg-[var(--surface-subtle)] border border-[var(--border)] flex items-center justify-center">
                        <span className="material-symbols-outlined text-2xl text-[var(--foreground)]">chat_bubble</span>
                    </div>
                    <div>
                        <h1 className="text-xl font-semibold text-[var(--foreground)]">새 프롬프트 생성</h1>
                        <p className="text-sm text-[var(--text-secondary)]">새로운 프롬프트 템플릿을 식별할 키와 설명을 입력하세요.</p>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label htmlFor="promptKey" className="block text-sm font-medium text-[var(--foreground)] mb-2">
                            프롬프트 키 (Prompt Key)
                        </label>
                        <input
                            type="text"
                            id="promptKey"
                            value={formData.promptKey}
                            onChange={(e) => setFormData({ ...formData, promptKey: e.target.value })}
                            className="w-full px-4 py-3 bg-[var(--input)] border border-[var(--border)] rounded-xl text-[var(--foreground)] placeholder:text-[var(--text-tertiary)] focus:ring-2 focus:ring-[var(--primary)]/50 focus:border-[var(--primary)] outline-none transition-all font-mono tracking-wide"
                            placeholder="예: customer-support-bot"
                            required
                        />
                        <p className="mt-2 text-xs text-[var(--text-secondary)]">
                            영문 소문자, 숫자, 하이픈(-)만 사용할 수 있습니다. API 호출 시 식별자로 사용됩니다.
                        </p>
                    </div>

                    <div>
                        <label htmlFor="description" className="block text-sm font-medium text-[var(--foreground)] mb-2">
                            설명 (Optional)
                        </label>
                        <textarea
                            id="description"
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            rows={3}
                            className="w-full px-4 py-3 bg-[var(--input)] border border-[var(--border)] rounded-xl text-[var(--foreground)] focus:ring-1 focus:ring-[var(--primary)]/50 focus:border-[var(--primary)] outline-none transition-all placeholder:text-[var(--text-tertiary)] resize-none"
                            placeholder="이 프롬프트의 용도와 목적을 설명해주세요."
                        />
                    </div>

                    <div className="pt-4 flex items-center justify-end gap-3">
                        <button
                            type="button"
                            onClick={() => navigate(-1)}
                            className="px-4 py-2 text-sm font-medium text-[var(--foreground)] bg-[var(--surface-subtle)] border border-[var(--border)] rounded-xl hover:bg-[var(--hover)] transition-colors"
                        >
                            취소
                        </button>
                        <button
                            type="submit"
                            disabled={createMutation.isPending || !formData.promptKey}
                            className="px-4 py-2 text-sm font-semibold text-white bg-[var(--primary)] rounded-xl hover:bg-[var(--primary-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2 shadow-[0_0_15px_rgba(168,85,247,0.25)] border border-[var(--primary-hover)]"
                        >
                            {createMutation.isPending ? '생성 중...' : '프롬프트 생성'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
