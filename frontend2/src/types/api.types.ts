// ========================================
// 공통 응답 래퍼 (api-spec.md 기준)
// ========================================
export interface ApiResponse<T> {
  code: string;
  message: string;
  data: T;
}

// ========================================
// Logs
// ========================================
export type RequestLogStatus = 'IN_PROGRESS' | 'SUCCESS' | 'FAIL' | 'BLOCKED';

export interface RequestLogResponse {
  requestId: string;
  traceId: string;
  status: RequestLogStatus;
  httpStatus: number | null;
  latencyMs: number | null;
  provider: string | null;
  requestedModel: string | null;
  usedModel: string | null;
  isFailover: boolean;
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  promptKey: string | null;
  ragEnabled: boolean;
  ragLatencyMs: number | null;
  ragChunksCount: number | null;
  errorCode: string | null;
  errorMessage: string | null;
  failReason: string | null;
  createdAt: string;
  finishedAt: string | null;
}

export interface RequestLogListResponse {
  content: RequestLogResponse[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
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
  refreshToken: string;
  tokenType: string;
  expiresInSec: number;
  refreshExpiresInSec: number;
}

export interface TokenRefreshRequest {
  refreshToken: string;
}

export interface TokenRefreshResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresInSec: number;
  refreshExpiresInSec: number;
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

export interface OrganizationDetailResponse {
  id: number;
  name: string;
  status: string;
  createdAt: string;
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

export interface WorkspaceUpdateRequest {
  displayName: string;
}

export interface WorkspaceUpdateResponse {
  id: number;
  name: string;
  displayName: string;
  status: string;
}

export interface WorkspaceDeleteResponse {
  workspaceId: number;
  message: string;
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

export interface ProviderCredentialUpdateRequest {
  apiKey: string;
}

export interface ProviderCredentialCreateResponse {
  credentialId: number;
  provider: string;
  status: string;
  createdAt: string;
  lastVerifiedAt?: string | null;
}

export interface ProviderCredentialSummaryResponse {
  credentialId: number;
  provider: string;
  status: string;
  lastVerifiedAt?: string | null;
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

export interface OrganizationApiKeyRotateRequest {
  reason?: string;
}

export interface OrganizationApiKeyRotateResponse {
  apiKey: string;
  rotatedAt: string;
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

// ========================================
// Prompt
// ========================================
export type PromptStatus = 'DRAFT' | 'ACTIVE' | 'ARCHIVED';

export interface PromptCreateRequest {
  promptKey: string;
  description: string;
}

export interface PromptCreateResponse {
  id: number;
  promptKey: string;
  description: string;
  status: PromptStatus;
  createdAt: string;
}

export interface PromptSummaryResponse {
  id: number;
  promptKey: string;
  description: string;
  status: PromptStatus;
  createdAt: string;
  updatedAt: string;
}

export interface PromptDetailResponse {
  id: number;
  workspaceId: number;
  promptKey: string;
  description: string;
  status: PromptStatus;
  createdAt: string;
  updatedAt: string;
}

export interface PromptUpdateRequest {
  description?: string;
  status?: PromptStatus;
}

// ========================================
// Prompt Release
// ========================================
export interface PromptReleaseResponse {
  promptId: number;
  activeVersionId: number;
  activeVersionNo: number;
  releasedAt: string;
}

export interface PromptReleaseRequest {
  versionId: number;
  reason?: string;
}

export interface PromptReleaseHistoryResponse {
  id: number;
  promptId: number;
  fromVersionId: number | null;
  fromVersionNo: number | null;
  toVersionId: number;
  toVersionNo: number;
  changeType: 'RELEASE' | 'ROLLBACK';
  reason?: string;
  changedBy: number;
  changedByName: string;
  createdAt: string;
}

export interface PromptRollbackRequest {
  targetVersionId: number;
  reason?: string;
}
// ========================================
// Prompt Version
// ========================================
export type ProviderType = 'OPENAI' | 'ANTHROPIC' | 'GEMINI';

export type ModelAllowlistResponse = Record<ProviderType, string[]>;

export interface PromptVersionSummaryResponse {
  id: number;
  versionNumber: number;
  title: string;
  provider: ProviderType;
  model: string;
  secondaryProvider: ProviderType | null;
  secondaryModel: string | null;
  createdBy: number;
  createdByName: string;
  createdAt: string;
}

export interface PromptVersionDetailResponse {
  id: number;
  promptId: number;
  versionNumber: number;
  title: string;
  provider: ProviderType;
  model: string;
  secondaryProvider: ProviderType | null;
  secondaryModel: string | null;
  systemPrompt: string;
  userTemplate: string;
  ragEnabled: boolean;
  contextUrl?: string;
  modelConfig: Record<string, any>;
  createdBy: number;
  createdAt: string;
}

export interface PromptVersionCreateRequest {
  title: string;
  provider: ProviderType;
  model: string;
  secondaryProvider?: ProviderType;
  secondaryModel?: string;
  systemPrompt?: string;
  userTemplate?: string;
  contextUrl?: string;
  modelConfig?: Record<string, any>;
}

export interface PromptVersionCreateResponse {
  id: number;
  versionNumber: number;
  createdAt: string;
}

// ========================================
// Document (RAG)
// ========================================
export type RagDocumentStatus =
  | 'UPLOADED'
  | 'PARSING'
  | 'CHUNKING'
  | 'EMBEDDING'
  | 'INDEXING'
  | 'DONE'
  | 'FAILED'
  | 'ACTIVE'
  | 'DELETING'
  | 'DELETED';

export interface DocumentResponse {
  id: number;
  fileName: string;
  status: RagDocumentStatus;
  createdAt: string;
}

export interface ChunkPreviewResponse {
  chunkIndex: number | null;
  chunkTotal: number | null;
  content: string;
}

export interface DocumentPreviewResponse {
  document: DocumentResponse;
  extractedPreview: string;
  chunkSamples: ChunkPreviewResponse[];
  totalChunks: number;
}

export interface DocumentUploadResponse {
  documentId: number;
  status: RagDocumentStatus;
}

export interface ChunkDetailResponse {
  content: string;
  score: number | null;
  documentId: number | null;
  documentName: string | null;
}

export interface RagSearchResponse {
  chunks: ChunkDetailResponse[];
}

export interface WorkspaceRagSettingsResponse {
  workspaceId: number;
  topK: number;
  similarityThreshold: number;
  maxChunks: number;
  maxContextChars: number;
  hybridEnabled: boolean;
  rerankEnabled: boolean;
  rerankTopN: number;
  chunkSize: number;
  chunkOverlapTokens: number;
}

export interface WorkspaceRagSettingsUpdateRequest {
  topK: number;
  similarityThreshold: number;
  maxChunks: number;
  maxContextChars: number;
  hybridEnabled: boolean;
  rerankEnabled: boolean;
  rerankTopN: number;
  chunkSize: number;
  chunkOverlapTokens: number;
}

// ========================================
// Prompt Playground
// ========================================
export interface PlaygroundRunRequest {
  provider: ProviderType;
  model: string;
  systemPrompt?: string;
  userTemplate: string;
  ragEnabled?: boolean;
  modelConfig?: Record<string, any>;
  variables: Record<string, string>;
  baseVersionId?: number;
}

export interface PlaygroundUsage {
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  estimatedCost: number | null;
}

export interface PlaygroundRunResponse {
  traceId: string;
  answer: string;
  usedModel: string;
  usage: PlaygroundUsage;
  latencyMs: number;
  executedAt: string;
}

export interface PlaygroundSaveVersionRequest {
  title?: string;
  provider: ProviderType;
  model: string;
  secondaryProvider?: ProviderType;
  secondaryModel?: string;
  systemPrompt?: string;
  userTemplate: string;
  ragEnabled?: boolean;
  contextUrl?: string;
  modelConfig?: Record<string, any>;
  releaseAfterSave: boolean;
}

export interface PlaygroundSaveVersionResponse {
  version: PromptVersionCreateResponse;
  released: boolean;
}
