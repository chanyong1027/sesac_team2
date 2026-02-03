import api from './axios';

// Types
export interface OverviewResponse {
    totalRequests: number;
    requestsChange: number;
    successRate: number;
    errorCount: number;
    totalTokens: number;
    tokensChange: number;
    avgLatencyMs: number;
    p95LatencyMs: number;
    p99LatencyMs: number;
    latencyChange: number;
    totalCost: number;
    costChange: number;
}

export interface TimeseriesDataPoint {
    date: string;
    requests: number;
    tokens: number;
    cost: number;
}

export interface TimeseriesResponse {
    data: TimeseriesDataPoint[];
}

export interface ModelUsage {
    provider: string;
    modelName: string;
    requests: number;
    tokens: number;
    cost: number;
    percentage: number;
}

export interface ModelUsageResponse {
    models: ModelUsage[];
}

export interface PromptUsage {
    promptId: number;
    promptKey: string;
    requests: number;
    tokens: number;
    cost: number;
}

export interface PromptUsageResponse {
    prompts: PromptUsage[];
}

export interface StatisticsQueryParams {
    period: 'daily' | 'weekly' | 'monthly';
    workspaceId?: number;
    from?: string;
    to?: string;
}

// API Functions
export const statisticsApi = {
    getOverview: (orgId: number, params: StatisticsQueryParams) =>
        api.get<OverviewResponse>(`/organizations/${orgId}/stats/overview`, { params }),

    getTimeseries: (orgId: number, params: StatisticsQueryParams) =>
        api.get<TimeseriesResponse>(`/organizations/${orgId}/stats/timeseries`, { params }),

    getByModel: (orgId: number, params: Omit<StatisticsQueryParams, 'period'>) =>
        api.get<ModelUsageResponse>(`/organizations/${orgId}/stats/by-model`, { params }),

    getByPrompt: (orgId: number, params: Omit<StatisticsQueryParams, 'period'>) =>
        api.get<PromptUsageResponse>(`/organizations/${orgId}/stats/by-prompt`, { params }),
};
