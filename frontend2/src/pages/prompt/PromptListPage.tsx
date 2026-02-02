import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { promptApi } from '@/api/prompt.api';
import {
    Search,
    Plus,
    Filter,
    MoreHorizontal,
    MessageSquare
} from 'lucide-react';
import type { PromptSummaryResponse } from '@/types/api.types';

export function PromptListPage() {
    const { id } = useParams<{ id: string }>();
    const workspaceId = Number(id);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'DRAFT' | 'ARCHIVED'>('ALL');

    // 프롬프트 목록 조회
    const { data: prompts, isLoading } = useQuery({
        queryKey: ['prompts', workspaceId],
        queryFn: async () => {
            const response = await promptApi.getPrompts(workspaceId);
            return response.data;
        },
        enabled: !!workspaceId,
    });

    // 필터링 로직
    const filteredPrompts = prompts?.filter(prompt => {
        const matchesSearch =
            prompt.promptKey.toLowerCase().includes(searchQuery.toLowerCase()) ||
            prompt.description.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesStatus = statusFilter === 'ALL' || prompt.status === statusFilter;
        return matchesSearch && matchesStatus;
    }) || [];

    if (isLoading) return <div className="p-8 text-gray-500">로딩 중...</div>;

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-semibold text-gray-900">프롬프트</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        LLM 애플리케이션을 위한 프롬프트를 관리하고 배포하세요.
                    </p>
                </div>
                <Link
                    to={`/workspaces/${workspaceId}/prompts/new`}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium text-sm"
                >
                    <Plus size={16} />
                    새 프롬프트
                </Link>
            </div>

            {/* Filters & Search */}
            <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                        type="text"
                        placeholder="프롬프트 키 또는 설명 검색..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                    />
                </div>
                <div className="flex items-center gap-2">
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value as any)}
                        className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                    >
                        <option value="ALL">전체 상태</option>
                        <option value="ACTIVE">배포됨 (Active)</option>
                        <option value="DRAFT">작성 중 (Draft)</option>
                        <option value="ARCHIVED">보관됨 (Archived)</option>
                    </select>
                    <button className="p-2 border border-gray-200 rounded-lg bg-white text-gray-500 hover:bg-gray-50 hover:text-gray-700">
                        <Filter size={18} />
                    </button>
                </div>
            </div>

            {/* Prompts Table */}
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-gray-50 border-b border-gray-200 text-xs uppercase tracking-wider text-gray-500 font-medium">
                            <th className="px-6 py-4">프롬프트 정보</th>
                            <th className="px-6 py-4">배포 상태</th>
                            <th className="px-6 py-4">최근 수정</th>
                            <th className="px-6 py-4 text-right">관리</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {filteredPrompts.length > 0 ? (
                            filteredPrompts.map((prompt) => (
                                <tr key={prompt.id} className="group hover:bg-gray-50/50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="flex items-start gap-4">
                                            <div className="mt-1 p-2 bg-indigo-50 text-indigo-600 rounded-lg group-hover:bg-indigo-100 transition-colors">
                                                <MessageSquare size={18} />
                                            </div>
                                            <div>
                                                <Link
                                                    to={`/workspaces/${workspaceId}/prompts/${prompt.id}`}
                                                    className="text-sm font-semibold text-gray-900 hover:text-indigo-600 mb-0.5 block"
                                                >
                                                    {prompt.promptKey}
                                                </Link>
                                                <p className="text-sm text-gray-500 line-clamp-1">{prompt.description}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <StatusBadge status={prompt.status} />
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="text-sm text-gray-600">
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-gray-500 text-xs">
                                                    {new Date(prompt.updatedAt).toLocaleDateString()}
                                                </span>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <button className="text-gray-400 hover:text-gray-600 p-1 rounded-md hover:bg-gray-100 transition-colors">
                                            <MoreHorizontal size={18} />
                                        </button>
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                                    <div className="flex flex-col items-center justify-center">
                                        <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mb-3">
                                            <Search size={20} className="text-gray-400" />
                                        </div>
                                        <p className="text-sm font-medium text-gray-900">검색 결과가 없습니다</p>
                                        <p className="text-xs text-gray-500 mt-1">다른 검색어나 필터를 시도해보세요.</p>
                                    </div>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function StatusBadge({ status }: { status: PromptSummaryResponse['status'] }) {
    const styles = {
        ACTIVE: 'bg-green-50 text-green-700 border-green-100',
        DRAFT: 'bg-gray-100 text-gray-600 border-gray-200',
        ARCHIVED: 'bg-orange-50 text-orange-700 border-orange-100',
    };

    const labels = {
        ACTIVE: '배포됨',
        DRAFT: '초안',
        ARCHIVED: '보관됨',
    };

    return (
        <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${styles[status]} inline-flex items-center gap-1.5`}>
            <span className={`w-1.5 h-1.5 rounded-full ${status === 'ACTIVE' ? 'bg-green-500' : status === 'DRAFT' ? 'bg-gray-400' : 'bg-orange-400'}`} />
            {labels[status]}
        </span>
    );
}
