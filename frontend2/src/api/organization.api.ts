import api from './axios';
import type {
  OrganizationCreateRequest,
  OrganizationCreateResponse,
  OrganizationMemberResponse,
  OrganizationMemberRemoveResponse,
  ProviderCredentialCreateRequest,
  ProviderCredentialCreateResponse,
  ProviderCredentialSummaryResponse,
  OrganizationApiKeyCreateRequest,
  OrganizationApiKeyCreateResponse,
  OrganizationApiKeySummaryResponse,
} from '@/types/api.types';

export const organizationApi = {
  // 조직 생성 - 현재 백엔드: POST /api/v1/organizations
  createOrganization: (data: OrganizationCreateRequest) =>
    api.post<OrganizationCreateResponse>('/organizations', data),

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
};
