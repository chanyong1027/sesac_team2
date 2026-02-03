import api from './axios';
import type {
  RagSearchResponse,
  WorkspaceRagSettingsResponse,
  WorkspaceRagSettingsUpdateRequest,
} from '@/types/api.types';

export const ragApi = {
  search: (
    workspaceId: number,
    query: string,
    options?: { topK?: number; similarityThreshold?: number }
  ) =>
    api.get<RagSearchResponse>(`/workspaces/${workspaceId}/rag/search`, {
      params: {
        query,
        topK: options?.topK,
        similarityThreshold: options?.similarityThreshold,
      },
    }),

  getSettings: (workspaceId: number) =>
    api.get<WorkspaceRagSettingsResponse>(
      `/workspaces/${workspaceId}/rag/settings`
    ),

  updateSettings: (
    workspaceId: number,
    data: WorkspaceRagSettingsUpdateRequest
  ) =>
    api.put<WorkspaceRagSettingsResponse>(
      `/workspaces/${workspaceId}/rag/settings`,
      data
    ),
};
