import { useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { documentApi } from '@/api/document.api';
import {
    Search,
    Upload,
    FileText,
    Trash2,
    CheckCircle2,
    Loader2,
    AlertCircle,
    File
} from 'lucide-react';
import type { DocumentResponse, RagDocumentStatus } from '@/types/api.types';

export function DocumentListPage() {
    const { workspaceId: workspaceIdParam } = useParams<{ workspaceId: string }>();
    const workspaceId = Number(workspaceIdParam);
    const [searchQuery, setSearchQuery] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);
    const queryClient = useQueryClient();

    // 문서 목록 조회
    const { data: documents, isLoading } = useQuery({
        queryKey: ['documents', workspaceId],
        queryFn: async () => {
            const response = await documentApi.getDocuments(workspaceId);
            return response.data;
        },
        enabled: !!workspaceId,
    });

    // 문서 업로드
    const uploadMutation = useMutation({
        mutationFn: async (file: File) => {
            await documentApi.uploadDocument(workspaceId, file);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['documents', workspaceId] });
            alert('문서 업로드가 시작되었습니다.');
        },
        onError: (error) => {
            console.error('Upload failed:', error);
            alert('문서 업로드에 실패했습니다.');
        }
    });

    // 문서 삭제
    const deleteMutation = useMutation({
        mutationFn: async (docId: number) => {
            await documentApi.deleteDocument(workspaceId, docId);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['documents', workspaceId] });
        },
        onError: (error) => {
            console.error('Delete failed:', error);
            alert('문서 삭제에 실패했습니다.');
        }
    });

    // 파일 선택 핸들러
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const file = e.target.files[0];
            uploadMutation.mutate(file);
            // Input 초기화 (동일 파일 재선택 가능하게)
            e.target.value = '';
        }
    };

    // 삭제 핸들러
    const handleDelete = (docId: number) => {
        if (confirm('정말로 이 문서를 삭제하시겠습니까? 검색 인덱스에서도 제거됩니다.')) {
            deleteMutation.mutate(docId);
        }
    };

    const filteredDocs = documents?.filter(doc =>
        doc.fileName.toLowerCase().includes(searchQuery.toLowerCase())
    ) || [];

    if (isLoading) return <div className="p-8 text-gray-500">로딩 중...</div>;

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-semibold text-gray-900">RAG 문서 (지식 베이스)</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        LLM이 답변 생성 시 참조할 문서를 업로드하고 관리하세요.
                    </p>
                </div>
                <div className="flex gap-2">
                    <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        onChange={handleFileChange}
                        accept=".pdf,.txt,.docx,.md"
                    />
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploadMutation.isPending}
                        className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium text-sm shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {uploadMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                        {uploadMutation.isPending ? '업로드 중...' : '문서 업로드'}
                    </button>
                </div>
            </div>

            {/* Search Bar */}
            <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                    type="text"
                    placeholder="파일명 검색..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                />
            </div>

            {/* Document List */}
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-gray-50 border-b border-gray-200 text-xs uppercase tracking-wider text-gray-500 font-medium">
                            <th className="px-6 py-4">파일명</th>
                            <th className="px-6 py-4">상태</th>
                            <th className="px-6 py-4">업로드 일시</th>
                            <th className="px-6 py-4 text-right">관리</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {filteredDocs.length > 0 ? (
                            filteredDocs.map((doc) => (
                                <tr key={doc.id} className="group hover:bg-gray-50/50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                                                <FileText size={18} />
                                            </div>
                                            <span className="text-sm font-medium text-gray-900">{doc.fileName}</span>
                                        </div>
                                    </td>
                                    {/* Size 컬럼 제거 (API 미지원) */}
                                    <td className="px-6 py-4">
                                        <StatusBadge status={doc.status} />
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-500">
                                        <div className="flex flex-col">
                                            <span>{new Date(doc.createdAt).toLocaleString()}</span>
                                            {/* UploadedBy 제거 (API 미지원) */}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <button
                                            onClick={() => handleDelete(doc.id)}
                                            className="text-gray-400 hover:text-red-600 p-2 rounded-lg hover:bg-red-50 transition-colors"
                                            title="문서 삭제"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                                    <div className="flex flex-col items-center justify-center">
                                        <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mb-3">
                                            <File size={24} className="text-gray-400" />
                                        </div>
                                        <p className="text-sm font-medium text-gray-900">등록된 문서가 없습니다.</p>
                                        <p className="text-xs text-gray-500 mt-1">새 문서를 업로드하여 지식 베이스를 구축하세요.</p>
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

function StatusBadge({ status }: { status: RagDocumentStatus }) {
    if (status === 'UPLOADED') {
        return (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">
                <CheckCircle2 size={12} />
                업로드 완료
            </span>
        );
    }
    if (status === 'PARSING' || status === 'CHUNKING' || status === 'EMBEDDING' || status === 'INDEXING') {
        return (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-100">
                <Loader2 size={12} className="animate-spin" />
                처리 중
            </span>
        );
    }
    if (status === 'DONE' || status === 'ACTIVE') {
        return (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-100">
                <CheckCircle2 size={12} />
                완료
            </span>
        );
    }
    if (status === 'FAILED') {
        return (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-50 text-red-700 border border-red-100">
                <AlertCircle size={12} />
                실패
            </span>
        );
    }
    if (status === 'DELETING') {
        return (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700 border border-gray-200">
                <Loader2 size={12} className="animate-spin" />
                삭제 중
            </span>
        );
    }
    if (status === 'DELETED') {
        return (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-500 border border-gray-200">
                삭제됨
            </span>
        );
    }
    return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200">
            {status}
        </span>
    );
}
