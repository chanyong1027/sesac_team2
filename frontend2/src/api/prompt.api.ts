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
    PlaygroundRunRequest,
    PlaygroundRunResponse,
    PlaygroundSaveVersionRequest,
    PlaygroundSaveVersionResponse,
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
    // Prompt Playground
    // =================================================================
    playgroundRun: (promptId: number, data: PlaygroundRunRequest) =>
        api.post<PlaygroundRunResponse>(`/prompts/${promptId}/playground/run`, data),

    playgroundSave: (promptId: number, data: PlaygroundSaveVersionRequest) =>
        api.post<PlaygroundSaveVersionResponse>(`/prompts/${promptId}/playground/save`, data),
};
