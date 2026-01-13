// ===== Common Types =====
export interface ApiResponse<T> {
  data: T;
  meta?: {
    traceId: string;
    timestamp: string;
    [key: string]: any;
  };
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    traceId?: string;
    timestamp?: string;
    details?: Record<string, string[]> | any;
  };
}

export interface PaginationParams {
  page?: number;
  size?: number;
}

export interface PaginationMeta {
  page: number;
  size: number;
  total: number;
  totalPages: number;
}

// ===== Auth Types =====
export interface LoginRequest {
  email: string;
  password: string;
}

export interface SignupRequest {
  email: string;
  password: string;
  name: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken?: string;
  user: User;
}

export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
}

// ===== Workspace Types =====
export interface Workspace {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  updatedAt: string;
  role?: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';
}

export interface CreateWorkspaceRequest {
  name: string;
  slug?: string;
}

// ===== Dashboard Types =====
export interface DashboardOverview {
  totalCalls: number;
  totalCost: number;
  avgLatency: number;
  errorRate: number;
  activePrompts: number;
}

export interface TimeSeriesDataPoint {
  timestamp: string;
  value: number;
}

export interface CallsChartData {
  timestamp: string;
  calls: number;
  errors: number;
}

export interface CostsChartData {
  timestamp: string;
  cost: number;
}

export interface HealthChartData {
  timestamp: string;
  successRate: number;
  avgLatency: number;
}

// ===== Prompt Types =====
export type PromptStatus = 'ACTIVE' | 'PAUSED' | 'ARCHIVED';

export interface Prompt {
  id: string;
  promptKey: string;
  name: string;
  description?: string;
  status: PromptStatus;
  activeVersionId?: string;
  activeVersion?: PromptVersion;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface PromptVersion {
  id: string;
  promptId: string;
  versionNumber: number;
  name?: string;
  messages: Message[];
  model: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  variables?: VariableDefinition[];
  baseVersionId?: string;
  createdAt: string;
  createdBy?: string;
}

export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface VariableDefinition {
  name: string;
  type: 'string' | 'number' | 'boolean';
  description?: string;
  required?: boolean;
  default?: any;
}

export interface CreatePromptRequest {
  promptKey: string;
  name: string;
  description?: string;
  tags?: string[];
}

export interface CreateVersionRequest {
  name?: string;
  messages: Message[];
  model: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  variables?: VariableDefinition[];
  baseVersionId?: string;
}

export interface ReleaseRequest {
  versionId: string;
  reason: string;
  referenceLinks?: string[];
}

export interface RollbackRequest {
  targetVersionId: string;
  reason: string;
  referenceLinks?: string[];
}

export interface Release {
  id: string;
  promptId: string;
  versionId: string;
  version?: PromptVersion;
  releasedAt: string;
  releasedBy?: string;
  reason: string;
  referenceLinks?: string[];
}

export interface PlaygroundRequest {
  versionId: string;
  variables?: Record<string, any>;
  messages?: Message[];
}

export interface PlaygroundResponse {
  output: {
    text: string;
    rawResponse?: any;
  };
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  latency: number;
  cost: number;
  traceId: string;
  model: string;
}

// ===== Log Types =====
export interface Log {
  traceId: string;
  workspaceId: string;
  promptKey: string;
  promptId: string;
  versionId: string;
  statusCode: number;
  latency: number;
  cost: number;
  model: string;
  timestamp: string;
  error?: string;
}

export interface LogDetail extends Log {
  request: {
    variables?: Record<string, any>;
    messages?: Message[];
    headers?: Record<string, string>;
  };
  response: {
    output?: string;
    rawResponse?: any;
  };
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  metadata?: Record<string, any>;
}

export interface LogsQueryParams extends PaginationParams {
  from?: string;
  to?: string;
  promptKey?: string;
  statusCode?: number;
  traceId?: string;
}

// ===== Gateway API Key Types =====
export interface GatewayApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  lastUsedAt?: string;
  createdAt: string;
  expiresAt?: string;
  status: 'ACTIVE' | 'REVOKED' | 'EXPIRED';
}

export interface CreateGatewayApiKeyRequest {
  name: string;
  expiresAt?: string;
}

export interface CreateGatewayApiKeyResponse {
  apiKey: string;
  keyInfo: GatewayApiKey;
}

// ===== Provider Key Types =====
export type Provider = 'OPENAI' | 'ANTHROPIC' | 'GOOGLE' | 'AZURE_OPENAI' | 'COHERE';

export interface ProviderKey {
  id: string;
  provider: Provider;
  label: string;
  keyPrefix: string;
  status: 'ACTIVE' | 'INVALID' | 'EXPIRED';
  lastVerifiedAt?: string;
  createdAt: string;
}

export interface CreateProviderKeyRequest {
  provider: Provider;
  apiKey: string;
  label: string;
}

export interface VerifyProviderKeyResponse {
  valid: boolean;
  message: string;
}

// ===== Member Types =====
export type MemberRole = 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';

export interface Member {
  id: string;
  userId: string;
  user: User;
  role: MemberRole;
  invitedAt: string;
  joinedAt?: string;
  invitedBy?: string;
}

export interface InviteMemberRequest {
  email: string;
  role: MemberRole;
}

export interface UpdateMemberRoleRequest {
  role: MemberRole;
}

// ===== Onboarding Types =====
export interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  completed: boolean;
}

export interface PromptTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  messages: Message[];
  model: string;
  variables?: VariableDefinition[];
}

export interface ApplyTemplateRequest {
  promptKey: string;
  name: string;
}

export interface OnboardingWizardRequest {
  provider: Provider;
  providerApiKey: string;
  templateId: string;
  promptKey: string;
  promptName: string;
}
