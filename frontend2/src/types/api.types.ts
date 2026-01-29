// ========================================
// 공통 응답 래퍼 (api-spec.md 기준)
// ========================================
export interface ApiResponse<T> {
  code: string;
  message: string;
  data: T;
}

// 에러 응답
export interface ErrorResponse {
  code: string;
  message: string;
  timestamp: string;
  fieldErrors: FieldError[] | null;
}

export interface FieldError {
  field: string;
  message: string;
}

// ========================================
// Auth (A. 계정 및 조직 관리)
// ========================================
export interface UserSignupRequest {
  email: string;
  password: string;
  name: string;
}

export interface UserSignupResponse {
  id: number;
  email: string;
  name: string;
}

export interface UserLoginRequest {
  email: string;
  password: string;
}

export interface UserLoginResponse {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
}

export interface UserMeResponse {
  id: number;
  email: string;
  name: string;
  status: string;
}

export interface UserProfileUpdateRequest {
  name: string;
}

export interface UserProfileUpdateResponse {
  id: number;
  email: string;
  name: string;
}

// ========================================
// Organization
// ========================================
export interface OrganizationCreateRequest {
  name: string;
}

export interface OrganizationCreateResponse {
  id: number;
  name: string;
  status: string;
}

export interface OrganizationMemberResponse {
  memberId: number;
  userId: number;
  email: string;
  name: string;
  role: string;
  status: string;
  joinedAt: string;
}

export interface OrganizationMemberRemoveResponse {
  memberId: number;
  removedAt: string;
}

// ========================================
// Workspace
// ========================================
export interface WorkspaceSummaryResponse {
  id: number;
  organizationId: number;
  name: string;
  displayName: string;
  status: string;
  myRole: string;
  createdAt: string;
}

export interface WorkspaceCreateRequest {
  name: string;
  displayName: string;
}

export interface WorkspaceCreateResponse {
  id: number;
  name: string;
  status: string;
}

// ========================================
// Invitation
// ========================================
export interface WorkspaceInviteCreateRequest {
  role: string;
}

export interface WorkspaceInviteCreateResponse {
  invitationUrl: string;
  token: string;
  expiredAt: string;
}

export interface WorkspaceInviteAcceptRequest {
  token: string;
}

export interface WorkspaceInviteAcceptResponse {
  organizationId: number;
  workspaceId: number;
}

// ========================================
// Provider Credential
// ========================================
export interface ProviderCredentialCreateRequest {
  provider: string;
  apiKey: string;
}

export interface ProviderCredentialCreateResponse {
  id: number;
  provider: string;
  status: string;
}

export interface ProviderCredentialSummaryResponse {
  id: number;
  provider: string;
  status: string;
  createdAt: string;
}

// ========================================
// Organization API Key
// ========================================
export interface OrganizationApiKeyCreateRequest {
  name: string;
}

export interface OrganizationApiKeyCreateResponse {
  apiKey: string;
}

export interface OrganizationApiKeySummaryResponse {
  id: number;
  name: string;
  keyPrefix: string;
  status: string;
  lastUsedAt: string | null;
}

// ========================================
// Gateway Chat
// ========================================
export interface GatewayChatRequest {
  promptKey: string;
  variables: Record<string, string>;
}

export interface GatewayChatResponse {
  traceId: string;
  answer: string;
  usage: GatewayChatUsage;
}

export interface GatewayChatUsage {
  totalTokens: number;
  estimatedCost: number;
}
