import api from './axios';
import type { ApiResponse, RequestLogListResponse, RequestLogResponse } from '@/types/api.types';

export interface LogsListParams {
  page?: number;
  size?: number;
  status?: string;
  failover?: boolean;
  provider?: string;
  usedModel?: string;
  ragEnabled?: boolean;
  promptKey?: string;
  traceId?: string;
  errorCode?: string;
  requestSource?: string;
  from?: string;
  to?: string;
}

export const logsApi = {
  list: async (
    workspaceId: number,
    params?: LogsListParams
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
