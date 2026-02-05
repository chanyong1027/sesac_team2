import api from './axios';
import type {
  OrganizationCreateRequest,
  OrganizationCreateResponse,
  OrganizationMemberResponse,
  OrganizationMemberRemoveResponse,
  ProviderCredentialCreateRequest,
  ProviderCredentialCreateResponse,
  ProviderCredentialSummaryResponse,
  ProviderCredentialUpdateRequest,
  OrganizationApiKeyCreateRequest,
  OrganizationApiKeyCreateResponse,
  OrganizationApiKeySummaryResponse,
  OrganizationDetailResponse,
} from '@/types/api.types';

export const organizationApi = {
  // 조직 생성 - 현재 백엔드: POST /api/v1/organizations
  createOrganization: (data: OrganizationCreateRequest) =>
    api.post<OrganizationCreateResponse>('/organizations', data),

  // 조직 상세 조회 - GET /api/v1/organizations/{orgId}
  getOrganization: (orgId: number) =>
    api.get<OrganizationDetailResponse>(`/organizations/${orgId}`),

  // 멤버 목록 조회 - 현재 백엔드: GET /api/v1/organizations/{orgId}/members
  getMembers: (orgId: number) =>
    api.get<OrganizationMemberResponse[]>(
      `/organizations/${orgId}/members`
    ),

  // 멤버 퇴출 - 현재 백엔드: DELETE /api/v1/organizations/{orgId}/members/{memberId}
  removeMember: (orgId: number, memberId: number) =>
    api.delete<OrganizationMemberRemoveResponse>(
      `/organizations/${orgId}/members/${memberId}`
    ),

  // Provider 자격증명 등록 - 현재 백엔드: POST /api/v1/organizations/{orgId}/credentials
  createCredential: (orgId: number, data: ProviderCredentialCreateRequest) =>
    api.post<ProviderCredentialCreateResponse>(
      `/organizations/${orgId}/credentials`,
      data
    ),

  // Provider 자격증명 목록 - 현재 백엔드: GET /api/v1/organizations/{orgId}/credentials
  getCredentials: (orgId: number) =>
    api.get<ProviderCredentialSummaryResponse[]>(
      `/organizations/${orgId}/credentials`
    ),

  // Provider 자격증명 업데이트 - PUT /api/v1/organizations/{orgId}/credentials/{credentialId}
  updateCredential: (
    orgId: number,
    credentialId: number,
    data: ProviderCredentialUpdateRequest
  ) =>
    api.put<ProviderCredentialCreateResponse>(
      `/organizations/${orgId}/credentials/${credentialId}`,
      data
    ),

  // API 키 생성 - 현재 백엔드: POST /api/v1/organizations/{orgId}/api-keys
  createApiKey: (orgId: number, data: OrganizationApiKeyCreateRequest) =>
    api.post<OrganizationApiKeyCreateResponse>(
      `/organizations/${orgId}/api-keys`,
      data
    ),

  // API 키 목록 - 현재 백엔드: GET /api/v1/organizations/{orgId}/api-keys
  getApiKeys: (orgId: number) =>
    api.get<OrganizationApiKeySummaryResponse[]>(
      `/organizations/${orgId}/api-keys`
    ),

  // API 키 재발급 - POST /api/v1/organizations/{orgId}/api-keys/{keyId}/rotate
  rotateApiKey: (orgId: number, keyId: number, data: { reason?: string }) =>
    api.post<{ apiKey: string; rotatedAt: string }>(
      `/organizations/${orgId}/api-keys/${keyId}/rotate`,
      data
    ),
};
