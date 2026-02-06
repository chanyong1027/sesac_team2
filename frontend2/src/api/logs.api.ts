import api from './axios';
import type { ApiResponse, RequestLogListResponse, RequestLogResponse } from '@/types/api.types';

export const logsApi = {
  list: async (
    workspaceId: number,
    params?: {
      page?: number;
      size?: number;
      status?: string;
      provider?: string;
      usedModel?: string;
      ragEnabled?: boolean;
      promptKey?: string;
      traceId?: string;
      from?: string;
      to?: string;
    }
  ): Promise<RequestLogListResponse> => {
    const res = await api.get<ApiResponse<RequestLogListResponse>>(
      `/workspaces/${workspaceId}/logs`,
      { params }
    );
    return res.data.data;
  },

  get: async (workspaceId: number, traceId: string): Promise<RequestLogResponse> => {
    const res = await api.get<ApiResponse<RequestLogResponse>>(
      `/workspaces/${workspaceId}/logs/${traceId}`
    );
    return res.data.data;
  },
};

