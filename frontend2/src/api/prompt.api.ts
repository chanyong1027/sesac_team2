import api from './axios';
import type {
    PromptCreateRequest,
    PromptCreateResponse,
    PromptSummaryResponse,
    PromptDetailResponse,
    PromptUpdateRequest,
    ModelAllowlistResponse,
    PromptVersionCreateRequest,
    PromptVersionCreateResponse,
    PromptVersionSummaryResponse,
    PromptVersionDetailResponse,
    PromptReleaseResponse,
    PromptReleaseRequest,
    PromptReleaseHistoryResponse,
    PromptRollbackRequest,
    EvalDatasetCreateRequest,
    EvalDatasetResponse,
    EvalBulkUploadRequest,
    EvalBulkUploadResponse,
    EvalTestCaseResponse,
    PromptEvalDefaultResponse,
    PromptEvalDefaultUpsertRequest,
    EvalRunCreateRequest,
    EvalRunEstimateRequest,
    EvalRunEstimateResponse,
    EvalReleaseCriteriaResponse,
    EvalReleaseCriteriaUpdateRequest,
    EvalRunResponse,
    EvalCancelResponse,
    EvalCaseResultListResponse,
    EvalCaseResultResponse
} from '@/types/api.types';

export const promptApi = {
    // 프롬프트 목록 조회
    getPrompts: (workspaceId: number) =>
        api.get<PromptSummaryResponse[]>(`/workspaces/${workspaceId}/prompts`),

    // 프롬프트 생성
    createPrompt: (workspaceId: number, data: PromptCreateRequest) =>
        api.post<PromptCreateResponse>(`/workspaces/${workspaceId}/prompts`, data),

    // 프롬프트 상세 조회
    getPrompt: (workspaceId: number, promptId: number) =>
        api.get<PromptDetailResponse>(`/workspaces/${workspaceId}/prompts/${promptId}`),

    // 프롬프트 수정
    updatePrompt: (workspaceId: number, promptId: number, data: PromptUpdateRequest) =>
        api.patch<PromptDetailResponse>(`/workspaces/${workspaceId}/prompts/${promptId}`, data),

    // 프롬프트 삭제
    deletePrompt: (workspaceId: number, promptId: number) =>
        api.delete<void>(`/workspaces/${workspaceId}/prompts/${promptId}`),

    // =================================================================
    // Prompt Version
    // =================================================================

    // 모델 allowlist 조회
    getModelAllowlist: () => api.get<ModelAllowlistResponse>(`/models/allowlist`),

    // 버전 목록 조회
    getVersions: (promptId: number) =>
        api.get<PromptVersionSummaryResponse[]>(`/prompts/${promptId}/versions`),

    // 버전 상세 조회
    getVersion: (promptId: number, versionId: number) =>
        api.get<PromptVersionDetailResponse>(`/prompts/${promptId}/versions/${versionId}`),

    // 버전 생성
    createVersion: (promptId: number, data: PromptVersionCreateRequest) =>
        api.post<PromptVersionCreateResponse>(`/prompts/${promptId}/versions`, data),

    // =================================================================
    // Prompt Release
    // =================================================================
    getRelease: (promptId: number) =>
        api.get<PromptReleaseResponse>(`/prompts/${promptId}/release`),

    releasePrompt: (promptId: number, data: PromptReleaseRequest) =>
        api.post<PromptReleaseResponse>(`/prompts/${promptId}/release`, data),

    getReleaseHistory: (promptId: number) =>
        api.get<PromptReleaseHistoryResponse[]>(`/prompts/${promptId}/history`),

    rollbackPrompt: (promptId: number, data: PromptRollbackRequest) =>
        api.post<PromptReleaseResponse>(`/prompts/${promptId}/rollback`, data),

    // =================================================================
    // Prompt Eval
    // =================================================================
    getEvalDatasets: (workspaceId: number, promptId: number) =>
        api.get<EvalDatasetResponse[]>(`/workspaces/${workspaceId}/prompts/${promptId}/eval/datasets`),

    createEvalDataset: (workspaceId: number, promptId: number, data: EvalDatasetCreateRequest) =>
        api.post<EvalDatasetResponse>(`/workspaces/${workspaceId}/prompts/${promptId}/eval/datasets`, data),

    getEvalDatasetCases: (workspaceId: number, promptId: number, datasetId: number) =>
        api.get<EvalTestCaseResponse[]>(`/workspaces/${workspaceId}/prompts/${promptId}/eval/datasets/${datasetId}/testcases`),

    bulkUploadEvalDatasetCases: (
        workspaceId: number,
        promptId: number,
        datasetId: number,
        data: EvalBulkUploadRequest
    ) => api.post<EvalBulkUploadResponse>(
        `/workspaces/${workspaceId}/prompts/${promptId}/eval/datasets/${datasetId}/testcases:bulk-upload`,
        data
    ),

    getEvalDefaults: (workspaceId: number, promptId: number) =>
        api.get<PromptEvalDefaultResponse | null>(`/workspaces/${workspaceId}/prompts/${promptId}/eval/defaults`),

    upsertEvalDefaults: (
        workspaceId: number,
        promptId: number,
        data: PromptEvalDefaultUpsertRequest
    ) => api.put<PromptEvalDefaultResponse>(`/workspaces/${workspaceId}/prompts/${promptId}/eval/defaults`, data),

    createEvalRun: (workspaceId: number, promptId: number, data: EvalRunCreateRequest) =>
        api.post<EvalRunResponse>(`/workspaces/${workspaceId}/prompts/${promptId}/eval/runs`, data),

    estimateEvalRun: (workspaceId: number, promptId: number, data: EvalRunEstimateRequest) =>
        api.post<EvalRunEstimateResponse>(`/workspaces/${workspaceId}/prompts/${promptId}/eval/runs:estimate`, data),

    getEvalRuns: (workspaceId: number, promptId: number) =>
        api.get<EvalRunResponse[]>(`/workspaces/${workspaceId}/prompts/${promptId}/eval/runs`),

    getEvalRun: (workspaceId: number, promptId: number, runId: number) =>
        api.get<EvalRunResponse>(`/workspaces/${workspaceId}/prompts/${promptId}/eval/runs/${runId}`),

    cancelEvalRun: (workspaceId: number, promptId: number, runId: number) =>
        api.post<EvalCancelResponse>(`/workspaces/${workspaceId}/prompts/${promptId}/eval/runs/${runId}:cancel`),

    getEvalRunCases: (workspaceId: number, promptId: number, runId: number, page = 0, size = 20) =>
        api.get<EvalCaseResultListResponse>(
            `/workspaces/${workspaceId}/prompts/${promptId}/eval/runs/${runId}/cases`,
            { params: { page, size } }
        ),

    getEvalRunCase: (workspaceId: number, promptId: number, runId: number, caseResultId: number) =>
        api.get<EvalCaseResultResponse>(
            `/workspaces/${workspaceId}/prompts/${promptId}/eval/runs/${runId}/cases/${caseResultId}`
        ),

    getEvalReleaseCriteria: (workspaceId: number) =>
        api.get<EvalReleaseCriteriaResponse>(`/workspaces/${workspaceId}/eval/release-criteria`),

    updateEvalReleaseCriteria: (workspaceId: number, data: EvalReleaseCriteriaUpdateRequest) =>
        api.put<EvalReleaseCriteriaResponse>(`/workspaces/${workspaceId}/eval/release-criteria`, data),
};
