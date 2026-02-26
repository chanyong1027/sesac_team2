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
    errorCount: number;
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
    avgLatencyMs?: number | null;
}

export interface ModelUsageResponse {
    models: ModelUsage[];
}

export interface PromptUsage {
    promptId?: number | null;
    promptKey?: string;
    id?: number | null;
    key?: string;
    name?: string;
    version?: number | string | null;
    promptVersion?: number | string | null;
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

export interface StatisticsRangeQueryParams {
    workspaceId?: number;
    from?: string;
    to?: string;
}

export type Period = StatisticsQueryParams['period'];

// API Functions
export const statisticsApi = {
    getOverview: (orgId: number, params: StatisticsQueryParams) =>
        api.get<OverviewResponse>(`/organizations/${orgId}/stats/overview`, { params }),

    getTimeseries: (orgId: number, params: StatisticsQueryParams) =>
        api.get<TimeseriesResponse>(`/organizations/${orgId}/stats/timeseries`, { params }),

    getByModel: (orgId: number, params: StatisticsRangeQueryParams) =>
        api.get<ModelUsageResponse>(`/organizations/${orgId}/stats/by-model`, { params }),

    getByPrompt: (orgId: number, params: StatisticsRangeQueryParams) =>
        api.get<PromptUsageResponse>(`/organizations/${orgId}/stats/by-prompt`, { params }),

    getErrorDistribution: (orgId: number, params: StatisticsRangeQueryParams) =>
        api.get<ErrorDistributionResponse>(`/organizations/${orgId}/stats/errors`, { params }),

    getRagQuality: (orgId: number, params: StatisticsRangeQueryParams) =>
        api.get<RagQualityResponse>(`/organizations/${orgId}/stats/rag-quality`, { params }),

    getRagQualityTimeseries: (orgId: number, params: StatisticsQueryParams) =>
        api.get<RagQualityTimeseriesResponse>(`/organizations/${orgId}/stats/rag-quality/timeseries`, { params }),
};

export interface ErrorDistributionItem {
    status: string;
    errorCode: string | null;
    failReason: string | null;
    count: number;
}

export interface ErrorDistributionResponse {
    items: ErrorDistributionItem[];
    totalErrors: number;
}

export interface RagQualityResponse {
    ragTotalCount: number;
    ragHitCount: number;
    hitRate: number;
    avgSimilarityThreshold: number;
    truncatedCount: number;
    truncationRate: number;
    totalChunks: number;
    avgRagLatencyMs: number;
}

export interface RagQualityDataPoint {
    date: string;
    ragTotalCount: number;
    ragHitCount: number;
    hitRate: number;
    avgSimilarityThreshold: number;
    truncatedCount: number;
    truncationRate: number;
    totalChunks: number;
    avgRagLatencyMs: number;
}

export interface RagQualityTimeseriesResponse {
    data: RagQualityDataPoint[];
}
