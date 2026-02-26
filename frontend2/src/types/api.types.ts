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
export type RequestLogStatus = 'IN_PROGRESS' | 'SUCCESS' | 'FAIL' | 'BLOCKED' | 'TIMEOUT';

export interface RetrievedDocument {
  id: number;
  content: string;
  score: number | null;
  documentId?: number | null;
  documentName?: string | null;
  durationMs?: number | null;
  ranking?: number | null;
}

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
  ragTopK?: number;
  ragSimilarityThreshold?: number;
  requestPath?: string;
  errorCode: string | null;
  errorMessage: string | null;
  failReason: string | null;
  createdAt: string;
  finishedAt: string | null;
  requestPayload: string | null;
  responsePayload: string | null;
  requestSource: string | null;
  retrievedDocuments?: RetrievedDocument[];
  cost?: number;
}

export interface RequestLogListResponse {
  content: RequestLogResponse[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

// ========================================
// Budget Guardrail
// ========================================
export type BudgetScopeType = 'WORKSPACE' | 'PROVIDER_CREDENTIAL';
export type BudgetSoftAction = 'DEGRADE';

export interface BudgetPolicyResponse {
  scopeType: BudgetScopeType;
  scopeId: number;
  monthLimitUsd: number | null;
  softLimitUsd: number | null;
  softAction: BudgetSoftAction;
  degradeProviderModelMap: Record<string, string>;
  degradeMaxOutputTokens: number | null;
  degradeDisableRag: boolean | null;
  enabled: boolean;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface BudgetPolicyUpdateRequest {
  monthLimitUsd?: number | null;
  softLimitUsd?: number | null;
  softAction?: BudgetSoftAction;
  degradeProviderModelMap?: Record<string, string>;
  degradeMaxOutputTokens?: number | null;
  degradeDisableRag?: boolean | null;
  enabled?: boolean;
}

export interface BudgetUsageResponse {
  scopeType: BudgetScopeType;
  scopeId: number;
  month: string; // YYYY-MM (UTC)
  usedUsd: number;
  hardLimitUsd: number | null;
  softLimitUsd: number | null;
  remainingHardUsd: number | null;
  remainingSoftUsd: number | null;
  requestCount: number;
  totalTokens: number;
  lastUpdatedAt: string | null;
}

// 에러 응답
export interface ErrorResponse {
  code: string;
  message: string;
  timestamp: string;
  fieldErrors: Record<string, string> | null;
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

export interface EmailAvailabilityResponse {
  available: boolean;
  message: string;
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

export type OrganizationRole = 'OWNER' | 'ADMIN' | 'MEMBER';

export interface OrganizationMemberRoleUpdateRequest {
  role: OrganizationRole;
}

export interface OrganizationMemberRoleUpdateResponse {
  memberId: number;
  previousRole: OrganizationRole;
  newRole: OrganizationRole;
  updatedAt: string;
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

export type InvitationPreviewStatus = 'VALID';

export interface WorkspaceInvitePreviewResponse {
  organizationId: number;
  organizationName: string;
  workspaceId: number;
  workspaceName: string;
  role: string;
  inviterName: string;
  expiresAt: string;
  status: InvitationPreviewStatus;
  invitationMessage: string | null;
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
// Prompt Eval
// ========================================
export type EvalMode = 'CANDIDATE_ONLY' | 'COMPARE_ACTIVE';
export type EvalRunStatus = 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
export type EvalCaseStatus = 'QUEUED' | 'RUNNING' | 'OK' | 'ERROR' | 'SKIPPED';
export type EvalTriggerType = 'MANUAL' | 'AUTO_VERSION_CREATE';
export type RubricTemplateCode = 'GENERAL_TEXT' | 'SUMMARY' | 'JSON_EXTRACTION' | 'CLASSIFICATION' | 'CUSTOM';

export interface EvalDatasetCreateRequest {
  name: string;
  description?: string;
}

export interface EvalDatasetResponse {
  id: number;
  workspaceId: number;
  name: string;
  description: string | null;
  createdBy: number;
  createdAt: string;
  updatedAt: string;
}

export interface EvalTestCaseCreateRequest {
  externalId?: string;
  input: string;
  contextJson?: Record<string, any>;
  expectedJson?: Record<string, any>;
  constraintsJson?: Record<string, any>;
}

export interface EvalBulkUploadRequest {
  testCases: EvalTestCaseCreateRequest[];
  replaceExisting?: boolean;
}

export interface EvalBulkUploadResponse {
  datasetId: number;
  uploadedCount: number;
}

export interface EvalTestCaseResponse {
  id: number;
  datasetId: number;
  caseOrder: number;
  externalId: string | null;
  input: string;
  contextJson: Record<string, any> | null;
  expectedJson: Record<string, any> | null;
  constraintsJson: Record<string, any> | null;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PromptEvalDefaultResponse {
  promptId: number;
  datasetId: number | null;
  rubricTemplateCode: RubricTemplateCode;
  rubricOverrides: Record<string, any> | null;
  defaultMode: EvalMode;
  autoEvalEnabled: boolean;
  updatedBy: number;
  updatedAt: string;
}

export interface PromptEvalDefaultUpsertRequest {
  datasetId?: number;
  rubricTemplateCode: RubricTemplateCode;
  rubricOverrides?: Record<string, any>;
  defaultMode: EvalMode;
  autoEvalEnabled: boolean;
}

export interface EvalRunCreateRequest {
  promptVersionId: number;
  datasetId: number;
  mode: EvalMode;
  rubricTemplateCode: RubricTemplateCode;
  rubricOverrides?: Record<string, any>;
}

export interface EvalRunEstimateRequest {
  promptVersionId: number;
  datasetId: number;
  mode: EvalMode;
  rubricTemplateCode: RubricTemplateCode;
}

export interface EvalRunEstimateResponse {
  estimatedCases: number;
  estimatedCallsMin: number;
  estimatedCallsMax: number;
  estimatedTokensMin: number;
  estimatedTokensMax: number;
  estimatedCostUsdMin: number;
  estimatedCostUsdMax: number;
  estimatedCostTier: 'LOW' | 'MEDIUM' | 'HIGH';
  estimatedDurationSecMin: number;
  estimatedDurationSecMax: number;
  estimateNotice: string;
  assumptions: Record<string, any>;
}

export interface EvalReleaseCriteriaResponse {
  workspaceId: number;
  minPassRate: number;
  minAvgOverallScore: number;
  maxErrorRate: number;
  minImprovementNoticeDelta: number;
  updatedBy: number;
  updatedAt: string | null;
}

export interface EvalReleaseCriteriaUpdateRequest {
  minPassRate: number;
  minAvgOverallScore: number;
  maxErrorRate: number;
  minImprovementNoticeDelta: number;
}

export interface EvalReleaseCriteriaAuditResponse {
  id: number;
  workspaceId: number;
  minPassRate: number;
  minAvgOverallScore: number;
  maxErrorRate: number;
  minImprovementNoticeDelta: number;
  changedBy: number | null;
  changedAt: string;
}

export interface EvalRunResponse {
  id: number;
  promptId: number;
  promptVersionId: number;
  workspaceId: number;
  datasetId: number;
  mode: EvalMode;
  triggerType: EvalTriggerType;
  rubricTemplateCode: RubricTemplateCode;
  rubricOverrides: Record<string, any> | null;
  candidateProvider: string | null;
  candidateModel: string | null;
  judgeProvider: string | null;
  judgeModel: string | null;
  status: EvalRunStatus;
  totalCases: number;
  processedCases: number;
  passedCases: number;
  failedCases: number;
  errorCases: number;
  summary: Record<string, any> | null;
  cost: Record<string, any> | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

export interface EvalCancelResponse {
  runId: number;
  status: EvalRunStatus;
}

export interface EvalCaseResultResponse {
  id: number;
  evalRunId: number;
  testCaseId: number;
  status: EvalCaseStatus;
  candidateOutput: string | null;
  baselineOutput: string | null;
  candidateMeta: Record<string, any> | null;
  baselineMeta: Record<string, any> | null;
  ruleChecks: Record<string, any> | null;
  judgeOutput: Record<string, any> | null;
  overallScore: number | null;
  pass: boolean | null;
  errorCode: string | null;
  errorMessage: string | null;
  startedAt: string | null;
  completedAt: string | null;
  humanReviewVerdict: EvalHumanReviewVerdict;
  humanOverridePass: boolean | null;
  humanReviewComment: string | null;
  humanReviewCategory: string | null;
  humanReviewedBy: number | null;
  humanReviewedAt: string | null;
  effectivePass: boolean | null;
}

export interface EvalCaseResultListResponse {
  content: EvalCaseResultResponse[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
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


// ========================================
// Prompt Eval - Extended (Human Review, Stats, Drafts)
// ========================================
export type EvalHumanReviewVerdict = 'CORRECT' | 'INCORRECT' | 'UNREVIEWED';

export interface EvalCaseHumanReviewUpsertRequest {
  verdict: EvalHumanReviewVerdict;
  overridePass?: boolean;
  comment?: string;
  category?: string;
  requestId?: string;
}

export interface EvalCaseHumanReviewAuditResponse {
  id: number;
  workspaceId: number;
  evalRunId: number;
  evalCaseResultId: number;
  verdict: EvalHumanReviewVerdict;
  overridePass: boolean | null;
  comment: string | null;
  category: string | null;
  requestId: string | null;
  changedBy: number | null;
  changedAt: string;
}

export interface EvalCaseResultTableRowResponse {
  id: number;
  testCaseId: number;
  status: EvalCaseStatus;
  overallScore: number | null;
  pass: boolean | null;
  effectivePass: boolean | null;
  humanReviewVerdict: EvalHumanReviewVerdict;
  labels: string[];
  reason: string | null;
  startedAt: string | null;
  completedAt: string | null;
}

export interface EvalCaseResultTableListResponse {
  content: EvalCaseResultTableRowResponse[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export interface EvalCaseResultStatsResponse {
  okCount: number;
  runningCount: number;
  errorCount: number;
  passTrueCount: number;
  passFalseCount: number;
  effectivePassTrueCount: number;
  effectivePassFalseCount: number;
  humanCorrectCount: number;
  humanIncorrectCount: number;
  humanUnreviewedCount: number;
  topLabelCounts: Record<string, number>;
}

export interface EvalJudgeAccuracyMetricsResponse {
  runId: number;
  totalCases: number;
  reviewedCount: number;
  correctCount: number;
  incorrectCount: number;
  accuracy: number | null;
  overrideRate: number | null;
  tp: number;
  tn: number;
  fp: number;
  fn: number;
  precision: number | null;
  recall: number | null;
  f1: number | null;
  specificity: number | null;
  balancedAccuracy: number | null;
  note: string;
}

export interface EvalJudgeAccuracyRollupResponse {
  promptId: number;
  promptVersionId: number | null;
  from: string | null;
  to: string | null;
  totalCases: number;
  reviewedCount: number;
  correctCount: number;
  incorrectCount: number;
  accuracy: number | null;
  overrideRate: number | null;
  tp: number;
  tn: number;
  fp: number;
  fn: number;
  precision: number | null;
  recall: number | null;
  f1: number | null;
  specificity: number | null;
  balancedAccuracy: number | null;
  note: string;
}

export interface PromptEvalDefaultDraftResponse {
  promptId: number;
  datasetId: number | null;
  rubricTemplateCode: RubricTemplateCode | null;
  rubricOverrides: Record<string, any> | null;
  criteriaAnchors: Record<string, any> | null;
  defaultMode: EvalMode | null;
  autoEvalEnabled: boolean | null;
  completedSections: Record<string, boolean>;
  updatedAt: string;
}

export interface PromptEvalDefaultDraftSectionRequest {
  datasetId?: number;
  rubricTemplateCode?: RubricTemplateCode;
  rubricOverrides?: Record<string, any>;
  criteriaAnchors?: Record<string, any>;
  defaultMode?: EvalMode;
  autoEvalEnabled?: boolean;
}

export interface RubricCriterionAnchor {
  score: number;
  example: string;
}

export interface RubricAnchorsConfig {
  [criterionKey: string]: RubricCriterionAnchor[];
}
