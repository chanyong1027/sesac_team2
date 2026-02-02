import { useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, MessageSquare } from 'lucide-react';
import { promptApi } from '@/api/prompt.api';

export function PromptCreatePage() {
    const { id } = useParams<{ id: string }>();
    const workspaceId = Number(id);
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
            navigate(`/workspaces/${workspaceId}/prompts`);
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
                to={`/workspaces/${workspaceId}/prompts`}
                className="inline-flex items-center text-sm text-gray-500 hover:text-gray-900 mb-6 transition-colors"
            >
                <ArrowLeft size={16} className="mr-1" />
                목록으로 돌아가기
            </Link>

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-3 bg-indigo-50 text-indigo-600 rounded-lg">
                        <MessageSquare size={24} />
                    </div>
                    <div>
                        <h1 className="text-xl font-semibold text-gray-900">새 프롬프트 생성</h1>
                        <p className="text-sm text-gray-500">새로운 프롬프트 템플릿을 식별할 키와 설명을 입력하세요.</p>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label htmlFor="promptKey" className="block text-sm font-medium text-gray-700 mb-1">
                            프롬프트 키 (Prompt Key)
                        </label>
                        <input
                            type="text"
                            id="promptKey"
                            value={formData.promptKey}
                            onChange={(e) => setFormData({ ...formData, promptKey: e.target.value })}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all placeholder:text-gray-400"
                            placeholder="예: customer-support-bot"
                            required
                        />
                        <p className="mt-1.5 text-xs text-gray-500">
                            영문 소문자, 숫자, 하이픈(-)만 사용할 수 있습니다. API 호출 시 식별자로 사용됩니다.
                        </p>
                    </div>

                    <div>
                        <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                            설명 (Optional)
                        </label>
                        <textarea
                            id="description"
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            rows={3}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all placeholder:text-gray-400 resize-none"
                            placeholder="이 프롬프트의 용도와 목적을 설명해주세요."
                        />
                    </div>

                    <div className="pt-4 flex items-center justify-end gap-3">
                        <button
                            type="button"
                            onClick={() => navigate(-1)}
                            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                        >
                            취소
                        </button>
                        <button
                            type="submit"
                            disabled={createMutation.isPending || !formData.promptKey}
                            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                        >
                            {createMutation.isPending ? '생성 중...' : '프롬프트 생성'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
