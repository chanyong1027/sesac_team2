import api from './axios';
import type {
    DocumentResponse,
    DocumentUploadResponse
} from '@/types/api.types';

export const documentApi = {
    // 문서 목록 조회
    getDocuments: (workspaceId: number) =>
        api.get<DocumentResponse[]>(`/workspaces/${workspaceId}/documents`),

    // 문서 업로드 (Multipart)
    uploadDocument: (workspaceId: number, file: File) => {
        const formData = new FormData();
        formData.append('file', file);
        return api.post<DocumentUploadResponse>(
            `/workspaces/${workspaceId}/documents`,
            formData,
            {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            }
        );
    },

    // 문서 삭제
    deleteDocument: (workspaceId: number, documentId: number) =>
        api.delete<{ message: string }>(`/workspaces/${workspaceId}/documents/${documentId}`),
};
