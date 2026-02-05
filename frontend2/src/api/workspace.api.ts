import api from './axios';
import type {
  WorkspaceSummaryResponse,
  WorkspaceCreateRequest,
  WorkspaceCreateResponse,
  WorkspaceUpdateRequest,
  WorkspaceUpdateResponse,
  WorkspaceDeleteResponse,
  WorkspaceInviteCreateRequest,
  WorkspaceInviteCreateResponse,
  WorkspaceInviteAcceptRequest,
  WorkspaceInviteAcceptResponse,
} from '@/types/api.types';

export const workspaceApi = {
  // 워크스페이스 목록 조회 - API 스펙: GET /api/v1/workspaces
  getWorkspaces: () =>
    api.get<WorkspaceSummaryResponse[]>('/workspaces'),

  // 워크스페이스 생성 - 현재 백엔드: POST /api/v1/organizations/{orgId}/workspaces
  createWorkspace: (orgId: number, data: WorkspaceCreateRequest) =>
    api.post<WorkspaceCreateResponse>(
      `/organizations/${orgId}/workspaces`,
      data
    ),

  // 워크스페이스 수정 - 현재 백엔드: PATCH /api/v1/organizations/{orgId}/workspaces/{workspaceId}
  updateWorkspace: (orgId: number, workspaceId: number, data: WorkspaceUpdateRequest) =>
    api.patch<WorkspaceUpdateResponse>(
      `/organizations/${orgId}/workspaces/${workspaceId}`,
      data
    ),

  // 워크스페이스 삭제 - 현재 백엔드: DELETE /api/v1/organizations/{orgId}/workspaces/{workspaceId}
  deleteWorkspace: (orgId: number, workspaceId: number) =>
    api.delete<WorkspaceDeleteResponse>(
      `/organizations/${orgId}/workspaces/${workspaceId}`
    ),

  // 초대 링크 생성 - 현재 백엔드: POST /api/v1/workspaces/{wsId}/invitation-links
  createInvitation: (wsId: number, data: WorkspaceInviteCreateRequest) =>
    api.post<WorkspaceInviteCreateResponse>(
      `/workspaces/${wsId}/invitation-links`,
      data
    ),

  // 초대 수락 - 현재 백엔드: POST /api/v1/invitations/accept
  acceptInvitation: (data: WorkspaceInviteAcceptRequest) =>
    api.post<WorkspaceInviteAcceptResponse>(
      '/invitations/accept',
      data
    ),
};
