// Mock API for development when VITE_API_BASE_URL is not set
import type * as Types from '@/types';

const consume = (..._args: unknown[]) => {
  void _args;
};

// Simple in-memory storage for mock data
let mockWorkspaces: Types.Workspace[] = [
  {
    id: 'ws-1',
    name: 'My Workspace',
    slug: 'my-workspace',
    role: 'OWNER',
    createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

let mockPrompts: Types.Prompt[] = [
  {
    id: 'p-1',
    promptKey: 'customer-support-bot',
    name: 'Customer Support Bot',
    description: 'AI assistant for customer support',
    status: 'ACTIVE',
    activeVersionId: 'v-1',
    tags: ['support', 'chatbot'],
    createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'p-2',
    promptKey: 'content-summarizer',
    name: 'Content Summarizer',
    description: 'Summarizes long articles',
    status: 'ACTIVE',
    activeVersionId: 'v-2',
    tags: ['content', 'summarization'],
    createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

let mockTemplates: Types.PromptTemplate[] = [
  {
    id: 'tpl-1',
    name: 'Customer Support Bot',
    description: 'AI-powered customer service assistant',
    category: 'Support',
    model: 'gpt-4',
    messages: [
      { role: 'system', content: 'You are a helpful customer support assistant.' },
      { role: 'user', content: 'Hello, I need help with {{issue}}' },
    ],
    variables: [
      { name: 'issue', type: 'string', description: 'Customer issue description', required: true },
    ],
  },
  {
    id: 'tpl-2',
    name: 'Content Summarizer',
    description: 'Summarize long-form content',
    category: 'Content',
    model: 'gpt-3.5-turbo',
    messages: [
      { role: 'system', content: 'Summarize the following content concisely.' },
      { role: 'user', content: '{{content}}' },
    ],
    variables: [
      { name: 'content', type: 'string', description: 'Content to summarize', required: true },
    ],
  },
  {
    id: 'tpl-3',
    name: 'Code Review Assistant',
    description: 'Review code and provide feedback',
    category: 'Development',
    model: 'gpt-4',
    messages: [
      { role: 'system', content: 'You are an expert code reviewer.' },
      { role: 'user', content: 'Review this code:\n\n{{code}}' },
    ],
    variables: [
      { name: 'code', type: 'string', description: 'Code to review', required: true },
    ],
  },
  {
    id: 'tpl-4',
    name: 'Email Writer',
    description: 'Draft professional emails',
    category: 'Communication',
    model: 'gpt-3.5-turbo',
    messages: [
      { role: 'system', content: 'Write a professional email.' },
      { role: 'user', content: 'Write an email about: {{topic}}' },
    ],
    variables: [
      { name: 'topic', type: 'string', description: 'Email topic', required: true },
    ],
  },
];

let mockLogs: Types.Log[] = Array.from({ length: 50 }, (_, i) => ({
  traceId: `trace-${i + 1}`,
  workspaceId: 'ws-1',
  promptKey: i % 2 === 0 ? 'customer-support-bot' : 'content-summarizer',
  promptId: i % 2 === 0 ? 'p-1' : 'p-2',
  versionId: i % 2 === 0 ? 'v-1' : 'v-2',
  statusCode: i % 10 === 0 ? 500 : 200,
  latency: 100 + Math.random() * 500,
  cost: 0.001 + Math.random() * 0.01,
  model: 'gpt-4',
  timestamp: new Date(Date.now() - i * 60 * 60 * 1000).toISOString(),
  error: i % 10 === 0 ? 'Rate limit exceeded' : undefined,
}));

let mockPromptVersions: Types.PromptVersion[] = [
  {
    id: 'v-1',
    promptId: 'p-1',
    versionNumber: 1,
    name: 'Initial version',
    messages: [
      { role: 'system', content: 'You are a helpful assistant.' },
      { role: 'user', content: 'Hello {{name}}!' },
    ],
    model: 'gpt-4',
    temperature: 0.7,
    maxTokens: 1000,
    createdAt: new Date().toISOString(),
    createdBy: 'user-1',
  },
  {
    id: 'v-2',
    promptId: 'p-2',
    versionNumber: 2,
    name: 'Summarizer v2',
    messages: [
      { role: 'system', content: 'Summarize the content in 3 bullet points.' },
      { role: 'user', content: '{{content}}' },
    ],
    model: 'gpt-3.5-turbo',
    temperature: 0.2,
    maxTokens: 800,
    createdAt: new Date().toISOString(),
    createdBy: 'user-1',
  },
];

let mockReleases: Types.Release[] = [
  {
    id: 'rel-1',
    promptId: 'p-1',
    versionId: 'v-1',
    releasedAt: new Date().toISOString(),
    releasedBy: 'user-1',
    reason: 'Initial release',
    referenceLinks: ['https://jira.example.com/PD-1'],
  },
];

let mockGatewayKeys: Types.GatewayApiKey[] = [
  {
    id: 'gk-1',
    name: 'Primary Gateway Key',
    keyPrefix: 'pd_live_',
    lastUsedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    status: 'ACTIVE',
  },
];

let mockProviderKeys: Types.ProviderKey[] = [
  {
    id: 'pk-1',
    provider: 'OPENAI',
    label: 'OpenAI Prod',
    keyPrefix: 'sk-',
    status: 'ACTIVE',
    lastVerifiedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  },
];

let mockMembers: Types.Member[] = [
  {
    id: 'm-1',
    userId: 'user-1',
    user: {
      id: 'user-1',
      email: 'admin@promptdock.ai',
      name: 'Admin User',
    },
    role: 'OWNER',
    invitedAt: new Date().toISOString(),
    joinedAt: new Date().toISOString(),
  },
];

let mockOnboardingSteps: Types.OnboardingStep[] = [
  {
    id: 'step-1',
    title: 'Connect provider',
    description: 'Add your first provider key to enable API calls.',
    completed: true,
  },
  {
    id: 'step-2',
    title: 'Create a prompt',
    description: 'Start with a template or create your own prompt.',
    completed: false,
  },
  {
    id: 'step-3',
    title: 'Send traffic',
    description: 'Generate logs and inspect traces.',
    completed: false,
  },
];

export const mockApi = {
  // Auth
  login: async (req: Types.LoginRequest): Promise<Types.ApiResponse<Types.AuthResponse>> => {
    await delay(500);
    return {
      data: {
        accessToken: 'mock-token-' + Date.now(),
        user: {
          id: 'user-1',
          email: req.email,
          name: 'Test User',
        },
      },
      meta: {
        traceId: generateTraceId(),
        timestamp: new Date().toISOString(),
      },
    };
  },

  signup: async (req: Types.SignupRequest): Promise<Types.ApiResponse<Types.AuthResponse>> => {
    await delay(500);
    return {
      data: {
        accessToken: 'mock-token-' + Date.now(),
        user: {
          id: 'user-1',
          email: req.email,
          name: req.name,
        },
      },
      meta: {
        traceId: generateTraceId(),
        timestamp: new Date().toISOString(),
      },
    };
  },

  // Workspaces
  getWorkspaces: async (): Promise<Types.ApiResponse<Types.Workspace[]>> => {
    await delay(300);
    return {
      data: mockWorkspaces,
      meta: {
        traceId: generateTraceId(),
        timestamp: new Date().toISOString(),
      },
    };
  },

  createWorkspace: async (req: Types.CreateWorkspaceRequest): Promise<Types.ApiResponse<Types.Workspace>> => {
    await delay(500);
    const newWorkspace: Types.Workspace = {
      id: 'ws-' + Date.now(),
      name: req.name,
      slug: req.slug || req.name.toLowerCase().replace(/\s+/g, '-'),
      role: 'OWNER',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    mockWorkspaces.push(newWorkspace);
    return {
      data: newWorkspace,
      meta: {
        traceId: generateTraceId(),
        timestamp: new Date().toISOString(),
      },
    };
  },

  // Dashboard
  getDashboardOverview: async (workspaceId: string): Promise<Types.ApiResponse<Types.DashboardOverview>> => {
    await delay(400);
    consume(workspaceId);
    return {
      data: {
        totalCalls: 15234,
        totalCost: 45.67,
        avgLatency: 245,
        errorRate: 0.02,
        activePrompts: mockPrompts.filter(p => p.status === 'ACTIVE').length,
      },
      meta: {
        traceId: generateTraceId(),
        timestamp: new Date().toISOString(),
      },
    };
  },

  getDashboardCalls: async (
    workspaceId: string,
    from?: string,
    to?: string,
    interval?: string
  ): Promise<Types.ApiResponse<Types.CallsChartData[]>> => {
    await delay(400);
    consume(workspaceId, from, to, interval);
    const data = Array.from({ length: 24 }, (_, i) => ({
      timestamp: new Date(Date.now() - (23 - i) * 60 * 60 * 1000).toISOString(),
      calls: 400 + Math.floor(Math.random() * 200),
      errors: Math.floor(Math.random() * 10),
    }));
    return {
      data,
      meta: {
        traceId: generateTraceId(),
        timestamp: new Date().toISOString(),
      },
    };
  },

  getDashboardCosts: async (
    workspaceId: string,
    from?: string,
    to?: string,
    interval?: string
  ): Promise<Types.ApiResponse<Types.CostsChartData[]>> => {
    await delay(400);
    consume(workspaceId, from, to, interval);
    const data = Array.from({ length: 24 }, (_, i) => ({
      timestamp: new Date(Date.now() - (23 - i) * 60 * 60 * 1000).toISOString(),
      cost: 1 + Math.random() * 3,
    }));
    return {
      data,
      meta: {
        traceId: generateTraceId(),
        timestamp: new Date().toISOString(),
      },
    };
  },

  getDashboardHealth: async (
    workspaceId: string,
    from?: string,
    to?: string,
    interval?: string
  ): Promise<Types.ApiResponse<Types.HealthChartData[]>> => {
    await delay(400);
    consume(workspaceId, from, to, interval);
    const data = Array.from({ length: 24 }, (_, i) => ({
      timestamp: new Date(Date.now() - (23 - i) * 60 * 60 * 1000).toISOString(),
      successRate: 95 + Math.random() * 5,
      avgLatency: 200 + Math.random() * 100,
    }));
    return {
      data,
      meta: {
        traceId: generateTraceId(),
        timestamp: new Date().toISOString(),
      },
    };
  },

  // Prompts
  getPrompts: async (workspaceId: string): Promise<Types.ApiResponse<Types.Prompt[]>> => {
    await delay(300);
    consume(workspaceId);
    return {
      data: mockPrompts,
      meta: {
        traceId: generateTraceId(),
        timestamp: new Date().toISOString(),
      },
    };
  },

  getPrompt: async (workspaceId: string, promptId: string): Promise<Types.ApiResponse<Types.Prompt>> => {
    await delay(300);
    consume(workspaceId);
    const prompt = mockPrompts.find(p => p.id === promptId);
    if (!prompt) throw new Error('Prompt not found');
    return {
      data: {
        ...prompt,
        activeVersion: {
          id: 'v-1',
          promptId: prompt.id,
          versionNumber: 1,
          name: 'Initial version',
          messages: [
            { role: 'system', content: 'You are a helpful assistant.' },
            { role: 'user', content: 'Hello {{name}}!' },
          ],
          model: 'gpt-4',
          temperature: 0.7,
          maxTokens: 1000,
          createdAt: prompt.createdAt,
          createdBy: 'user-1',
        },
      },
      meta: {
        traceId: generateTraceId(),
        timestamp: new Date().toISOString(),
      },
    };
  },

  createPrompt: async (
    workspaceId: string,
    req: Types.CreatePromptRequest
  ): Promise<Types.ApiResponse<Types.Prompt>> => {
    await delay(500);
    consume(workspaceId);
    const newPrompt: Types.Prompt = {
      id: 'p-' + Date.now(),
      promptKey: req.promptKey,
      name: req.name,
      description: req.description,
      status: 'ACTIVE',
      tags: req.tags,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    mockPrompts.push(newPrompt);
    return {
      data: newPrompt,
      meta: {
        traceId: generateTraceId(),
        timestamp: new Date().toISOString(),
      },
    };
  },

  getPromptVersions: async (
    workspaceId: string,
    promptId: string
  ): Promise<Types.ApiResponse<Types.PromptVersion[]>> => {
    await delay(300);
    consume(workspaceId);
    return {
      data: mockPromptVersions.filter(v => v.promptId === promptId),
      meta: {
        traceId: generateTraceId(),
        timestamp: new Date().toISOString(),
      },
    };
  },

  createPromptVersion: async (
    workspaceId: string,
    promptId: string,
    req: Types.CreateVersionRequest
  ): Promise<Types.ApiResponse<Types.PromptVersion>> => {
    await delay(500);
    consume(workspaceId);
    const existing = mockPromptVersions.filter(v => v.promptId === promptId);
    const versionNumber = existing.length ? Math.max(...existing.map(v => v.versionNumber)) + 1 : 1;
    const newVersion: Types.PromptVersion = {
      id: `v-${Date.now()}`,
      promptId,
      versionNumber,
      name: req.name,
      messages: req.messages,
      model: req.model,
      temperature: req.temperature,
      maxTokens: req.maxTokens,
      topP: req.topP,
      frequencyPenalty: req.frequencyPenalty,
      presencePenalty: req.presencePenalty,
      variables: req.variables,
      baseVersionId: req.baseVersionId,
      createdAt: new Date().toISOString(),
      createdBy: 'user-1',
    };
    mockPromptVersions.push(newVersion);
    return {
      data: newVersion,
      meta: {
        traceId: generateTraceId(),
        timestamp: new Date().toISOString(),
      },
    };
  },

  getCurrentRelease: async (
    workspaceId: string,
    promptId: string
  ): Promise<Types.ApiResponse<Types.Release | null>> => {
    await delay(300);
    consume(workspaceId);
    const release = mockReleases.find(r => r.promptId === promptId) || null;
    return {
      data: release,
      meta: {
        traceId: generateTraceId(),
        timestamp: new Date().toISOString(),
      },
    };
  },

  getReleaseHistory: async (
    workspaceId: string,
    promptId: string
  ): Promise<Types.ApiResponse<Types.Release[]>> => {
    await delay(300);
    consume(workspaceId);
    return {
      data: mockReleases.filter(r => r.promptId === promptId),
      meta: {
        traceId: generateTraceId(),
        timestamp: new Date().toISOString(),
      },
    };
  },

  releasePrompt: async (
    workspaceId: string,
    promptId: string,
    req: Types.ReleaseRequest
  ): Promise<Types.ApiResponse<Types.Release>> => {
    await delay(400);
    consume(workspaceId);
    const release: Types.Release = {
      id: `rel-${Date.now()}`,
      promptId,
      versionId: req.versionId,
      releasedAt: new Date().toISOString(),
      releasedBy: 'user-1',
      reason: req.reason,
      referenceLinks: req.referenceLinks,
    };
    mockReleases.unshift(release);
    return {
      data: release,
      meta: {
        traceId: generateTraceId(),
        timestamp: new Date().toISOString(),
      },
    };
  },

  rollbackPrompt: async (
    workspaceId: string,
    promptId: string,
    req: Types.RollbackRequest
  ): Promise<Types.ApiResponse<Types.Release>> => {
    await delay(400);
    consume(workspaceId);
    const release: Types.Release = {
      id: `rel-${Date.now()}`,
      promptId,
      versionId: req.targetVersionId,
      releasedAt: new Date().toISOString(),
      releasedBy: 'user-1',
      reason: req.reason,
      referenceLinks: req.referenceLinks,
    };
    mockReleases.unshift(release);
    return {
      data: release,
      meta: {
        traceId: generateTraceId(),
        timestamp: new Date().toISOString(),
      },
    };
  },

  playground: async (
    workspaceId: string,
    promptId: string,
    req: Types.PlaygroundRequest
  ): Promise<Types.ApiResponse<Types.PlaygroundResponse>> => {
    await delay(700);
    consume(workspaceId, promptId);
    const output = `Playground response for version ${req.versionId}.`;
    return {
      data: {
        output: { text: output },
        usage: {
          promptTokens: 120,
          completionTokens: 80,
          totalTokens: 200,
        },
        latency: 320,
        cost: 0.0042,
        traceId: generateTraceId(),
        model: 'gpt-4',
      },
      meta: {
        traceId: generateTraceId(),
        timestamp: new Date().toISOString(),
      },
    };
  },

  // Templates
  getTemplates: async (): Promise<Types.ApiResponse<Types.PromptTemplate[]>> => {
    await delay(300);
    return {
      data: mockTemplates,
      meta: {
        traceId: generateTraceId(),
        timestamp: new Date().toISOString(),
      },
    };
  },

  applyTemplate: async (
    workspaceId: string,
    templateId: string,
    req: Types.ApplyTemplateRequest
  ): Promise<Types.ApiResponse<Types.Prompt>> => {
    await delay(500);
    consume(workspaceId, templateId);
    const newPrompt: Types.Prompt = {
      id: `p-${Date.now()}`,
      promptKey: req.promptKey,
      name: req.name,
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    mockPrompts.push(newPrompt);
    return {
      data: newPrompt,
      meta: {
        traceId: generateTraceId(),
        timestamp: new Date().toISOString(),
      },
    };
  },

  getOnboardingTour: async (): Promise<Types.ApiResponse<Types.OnboardingStep[]>> => {
    await delay(300);
    return {
      data: mockOnboardingSteps,
      meta: {
        traceId: generateTraceId(),
        timestamp: new Date().toISOString(),
      },
    };
  },

  runOnboardingWizard: async (
    workspaceId: string,
    req: Types.OnboardingWizardRequest
  ): Promise<Types.ApiResponse<{ success: boolean }>> => {
    await delay(600);
    consume(workspaceId, req);
    return {
      data: { success: true },
      meta: {
        traceId: generateTraceId(),
        timestamp: new Date().toISOString(),
      },
    };
  },

  // Logs
  getLogs: async (
    workspaceId: string,
    params: Types.LogsQueryParams
  ): Promise<Types.ApiResponse<{ logs: Types.Log[]; pagination: Types.PaginationMeta }>> => {
    await delay(400);
    consume(workspaceId);
    const page = params.page || 1;
    const size = params.size || 20;
    const start = (page - 1) * size;
    const end = start + size;
    
    return {
      data: {
        logs: mockLogs.slice(start, end),
        pagination: {
          page,
          size,
          total: mockLogs.length,
          totalPages: Math.ceil(mockLogs.length / size),
        },
      },
      meta: {
        traceId: generateTraceId(),
        timestamp: new Date().toISOString(),
      },
    };
  },

  getLog: async (workspaceId: string, traceId: string): Promise<Types.ApiResponse<Types.LogDetail>> => {
    await delay(300);
    consume(workspaceId);
    const log = mockLogs.find(l => l.traceId === traceId);
    if (!log) throw new Error('Log not found');
    
    return {
      data: {
        ...log,
        request: {
          variables: { name: 'John' },
          messages: [
            { role: 'system', content: 'You are a helpful assistant.' },
            { role: 'user', content: 'Hello John!' },
          ],
        },
        response: {
          output: 'Hello! How can I help you today?',
        },
        usage: {
          promptTokens: 20,
          completionTokens: 10,
          totalTokens: 30,
        },
      },
      meta: {
        traceId: generateTraceId(),
        timestamp: new Date().toISOString(),
      },
    };
  },

  // Gateway API Keys
  getGatewayApiKeys: async (
    workspaceId: string
  ): Promise<Types.ApiResponse<Types.GatewayApiKey[]>> => {
    await delay(300);
    consume(workspaceId);
    return {
      data: mockGatewayKeys,
      meta: {
        traceId: generateTraceId(),
        timestamp: new Date().toISOString(),
      },
    };
  },

  createGatewayApiKey: async (
    workspaceId: string,
    req: Types.CreateGatewayApiKeyRequest
  ): Promise<Types.ApiResponse<Types.CreateGatewayApiKeyResponse>> => {
    await delay(400);
    consume(workspaceId);
    const key: Types.GatewayApiKey = {
      id: `gk-${Date.now()}`,
      name: req.name,
      keyPrefix: 'pd_live_',
      createdAt: new Date().toISOString(),
      status: 'ACTIVE',
    };
    mockGatewayKeys.unshift(key);
    return {
      data: {
        apiKey: `pd_live_${Math.random().toString(36).slice(2)}`,
        keyInfo: key,
      },
      meta: {
        traceId: generateTraceId(),
        timestamp: new Date().toISOString(),
      },
    };
  },

  rotateGatewayApiKey: async (
    workspaceId: string,
    keyId: string
  ): Promise<Types.ApiResponse<Types.CreateGatewayApiKeyResponse>> => {
    await delay(400);
    consume(workspaceId, keyId);
    return {
      data: {
        apiKey: `pd_live_${Math.random().toString(36).slice(2)}`,
        keyInfo: mockGatewayKeys[0],
      },
      meta: {
        traceId: generateTraceId(),
        timestamp: new Date().toISOString(),
      },
    };
  },

  deleteGatewayApiKey: async (
    workspaceId: string,
    keyId: string
  ): Promise<Types.ApiResponse<{ success: boolean }>> => {
    await delay(300);
    consume(workspaceId, keyId);
    mockGatewayKeys = mockGatewayKeys.filter(key => key.id !== keyId);
    return {
      data: { success: true },
      meta: {
        traceId: generateTraceId(),
        timestamp: new Date().toISOString(),
      },
    };
  },

  // Provider Keys
  getProviderKeys: async (
    workspaceId: string
  ): Promise<Types.ApiResponse<Types.ProviderKey[]>> => {
    await delay(300);
    consume(workspaceId);
    return {
      data: mockProviderKeys,
      meta: {
        traceId: generateTraceId(),
        timestamp: new Date().toISOString(),
      },
    };
  },

  createProviderKey: async (
    workspaceId: string,
    req: Types.CreateProviderKeyRequest
  ): Promise<Types.ApiResponse<Types.ProviderKey>> => {
    await delay(400);
    consume(workspaceId);
    const key: Types.ProviderKey = {
      id: `pk-${Date.now()}`,
      provider: req.provider,
      label: req.label,
      keyPrefix: req.apiKey.slice(0, 4),
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
    };
    mockProviderKeys.unshift(key);
    return {
      data: key,
      meta: {
        traceId: generateTraceId(),
        timestamp: new Date().toISOString(),
      },
    };
  },

  verifyProviderKey: async (
    workspaceId: string,
    keyId: string
  ): Promise<Types.ApiResponse<Types.VerifyProviderKeyResponse>> => {
    await delay(300);
    consume(workspaceId, keyId);
    return {
      data: { valid: true, message: 'Key verified successfully.' },
      meta: {
        traceId: generateTraceId(),
        timestamp: new Date().toISOString(),
      },
    };
  },

  rotateProviderKey: async (
    workspaceId: string,
    keyId: string
  ): Promise<Types.ApiResponse<Types.ProviderKey>> => {
    await delay(300);
    consume(workspaceId, keyId);
    return {
      data: mockProviderKeys[0],
      meta: {
        traceId: generateTraceId(),
        timestamp: new Date().toISOString(),
      },
    };
  },

  deleteProviderKey: async (
    workspaceId: string,
    keyId: string
  ): Promise<Types.ApiResponse<{ success: boolean }>> => {
    await delay(300);
    consume(workspaceId, keyId);
    mockProviderKeys = mockProviderKeys.filter(key => key.id !== keyId);
    return {
      data: { success: true },
      meta: {
        traceId: generateTraceId(),
        timestamp: new Date().toISOString(),
      },
    };
  },

  // Members
  getMembers: async (workspaceId: string): Promise<Types.ApiResponse<Types.Member[]>> => {
    await delay(300);
    consume(workspaceId);
    return {
      data: mockMembers,
      meta: {
        traceId: generateTraceId(),
        timestamp: new Date().toISOString(),
      },
    };
  },

  inviteMember: async (
    workspaceId: string,
    req: Types.InviteMemberRequest
  ): Promise<Types.ApiResponse<Types.Member>> => {
    await delay(400);
    consume(workspaceId);
    const member: Types.Member = {
      id: `m-${Date.now()}`,
      userId: `user-${Date.now()}`,
      user: {
        id: `user-${Date.now()}`,
        email: req.email,
        name: req.email.split('@')[0],
      },
      role: req.role,
      invitedAt: new Date().toISOString(),
    };
    mockMembers.unshift(member);
    return {
      data: member,
      meta: {
        traceId: generateTraceId(),
        timestamp: new Date().toISOString(),
      },
    };
  },

  updateMemberRole: async (
    workspaceId: string,
    memberId: string,
    req: Types.UpdateMemberRoleRequest
  ): Promise<Types.ApiResponse<Types.Member>> => {
    await delay(300);
    consume(workspaceId, memberId);
    const member = mockMembers.find(m => m.id === memberId);
    if (member) member.role = req.role;
    return {
      data: member as Types.Member,
      meta: {
        traceId: generateTraceId(),
        timestamp: new Date().toISOString(),
      },
    };
  },

  removeMember: async (
    workspaceId: string,
    memberId: string
  ): Promise<Types.ApiResponse<{ success: boolean }>> => {
    await delay(300);
    consume(workspaceId, memberId);
    mockMembers = mockMembers.filter(m => m.id !== memberId);
    return {
      data: { success: true },
      meta: {
        traceId: generateTraceId(),
        timestamp: new Date().toISOString(),
      },
    };
  },
};

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function generateTraceId(): string {
  return `trace-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
