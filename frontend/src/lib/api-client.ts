import type { ApiError, ApiResponse } from '@/types';
import { mockApi } from './mock-api';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
const USE_MOCK = !API_BASE_URL;

export class ApiClientError extends Error {
  code?: string;
  details?: ApiError['error']['details'];
  traceId?: string;
  status?: number;

  constructor(message: string, options?: { code?: string; details?: ApiError['error']['details']; traceId?: string; status?: number }) {
    super(message);
    this.name = 'ApiClientError';
    this.code = options?.code;
    this.details = options?.details;
    this.traceId = options?.traceId;
    this.status = options?.status;
  }
}

class ApiClient {
  private baseURL: string;
  private useMock: boolean;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
    this.useMock = USE_MOCK;
  }

  private getAuthToken(): string | null {
    return localStorage.getItem('accessToken');
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
    const url = `${this.baseURL}${endpoint}`;
    const token = this.getAuthToken();

    const headers = new Headers(options.headers);
    headers.set('Content-Type', 'application/json');

    if (token && !endpoint.includes('/auth/')) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    let response: Response;
    try {
      response = await fetch(url, {
        ...options,
        headers,
      });
    } catch (error) {
      throw new ApiClientError('Network error occurred.');
    }

    let payload: ApiResponse<T> | ApiError | null = null;
    try {
      payload = (await response.json()) as ApiResponse<T> | ApiError;
    } catch {
      payload = null;
    }

    if (!response.ok) {
      const apiError = payload as ApiError | null;
      const message = apiError?.error?.message || 'An error occurred.';
      const error = new ApiClientError(message, {
        code: apiError?.error?.code,
        details: apiError?.error?.details,
        traceId: apiError?.error?.traceId,
        status: response.status,
      });

      if (response.status === 401) {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('workspaceId');
        window.location.href = '/login';
      }

      throw error;
    }

    return payload as ApiResponse<T>;
  }

  async get<T>(endpoint: string): Promise<ApiResponse<T>> {
    if (this.useMock) {
      return this.handleMockRequest<T>('GET', endpoint);
    }
    return this.request<T>(endpoint, { method: 'GET' });
  }

  async post<T>(endpoint: string, body?: unknown): Promise<ApiResponse<T>> {
    if (this.useMock) {
      return this.handleMockRequest<T>('POST', endpoint, body);
    }
    return this.request<T>(endpoint, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async patch<T>(endpoint: string, body?: unknown): Promise<ApiResponse<T>> {
    if (this.useMock) {
      return this.handleMockRequest<T>('PATCH', endpoint, body);
    }
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async put<T>(endpoint: string, body?: unknown): Promise<ApiResponse<T>> {
    if (this.useMock) {
      return this.handleMockRequest<T>('PUT', endpoint, body);
    }
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async delete<T>(endpoint: string): Promise<ApiResponse<T>> {
    if (this.useMock) {
      return this.handleMockRequest<T>('DELETE', endpoint);
    }
    return this.request<T>(endpoint, { method: 'DELETE' });
  }

  private parsePath(endpoint: string) {
    const clean = endpoint.split('?')[0];
    return clean.split('/').filter(Boolean);
  }

  private parseQuery(endpoint: string): Record<string, string> {
    const query = endpoint.split('?')[1];
    if (!query) return {};
    return query.split('&').reduce((acc, pair) => {
      const [key, value] = pair.split('=');
      if (key) acc[decodeURIComponent(key)] = decodeURIComponent(value || '');
      return acc;
    }, {} as Record<string, string>);
  }

  private async handleMockRequest<T>(method: string, endpoint: string, body?: unknown): Promise<ApiResponse<T>> {
    const parts = this.parsePath(endpoint);
    const query = this.parseQuery(endpoint);
    const workspaceId = parts[1];
    const promptId = parts[3];
    const keyId = parts[3];
    const memberId = parts[3];

    if (endpoint.includes('/auth/login')) return mockApi.login(body as any) as any;
    if (endpoint.includes('/auth/signup')) return mockApi.signup(body as any) as any;
    if (endpoint === '/workspaces' && method === 'GET') return mockApi.getWorkspaces() as any;
    if (endpoint === '/workspaces' && method === 'POST') return mockApi.createWorkspace(body as any) as any;

    if (parts[0] === 'workspaces' && parts[2] === 'dashboard') {
      if (parts[3] === 'overview') return mockApi.getDashboardOverview(workspaceId) as any;
      if (parts[3] === 'calls') return mockApi.getDashboardCalls(workspaceId) as any;
      if (parts[3] === 'costs') return mockApi.getDashboardCosts(workspaceId) as any;
      if (parts[3] === 'health') return mockApi.getDashboardHealth(workspaceId) as any;
    }

    if (parts[0] === 'workspaces' && parts[2] === 'prompts') {
      if (parts.length === 3 && method === 'GET') return mockApi.getPrompts(workspaceId) as any;
      if (parts.length === 3 && method === 'POST') return mockApi.createPrompt(workspaceId, body as any) as any;
      if (parts.length === 4 && method === 'GET') return mockApi.getPrompt(workspaceId, promptId) as any;
      if (parts[4] === 'versions' && method === 'GET') return mockApi.getPromptVersions(workspaceId, promptId) as any;
      if (parts[4] === 'versions' && method === 'POST') return mockApi.createPromptVersion(workspaceId, promptId, body as any) as any;
      if (parts[4] === 'release' && method === 'GET') return mockApi.getCurrentRelease(workspaceId, promptId) as any;
      if (parts[4] === 'release' && method === 'POST') return mockApi.releasePrompt(workspaceId, promptId, body as any) as any;
      if (parts[4] === 'rollback' && method === 'POST') return mockApi.rollbackPrompt(workspaceId, promptId, body as any) as any;
      if (parts[4] === 'release-history') return mockApi.getReleaseHistory(workspaceId, promptId) as any;
      if (parts[4] === 'playground' && method === 'POST') return mockApi.playground(workspaceId, promptId, body as any) as any;
    }

    if (parts[0] === 'workspaces' && parts[2] === 'logs') {
      if (parts.length === 3) return mockApi.getLogs(workspaceId, query as any) as any;
      if (parts.length === 4) return mockApi.getLog(workspaceId, parts[3]) as any;
    }

    if (parts[0] === 'workspaces' && parts[2] === 'gateway-api-keys') {
      if (parts.length === 3 && method === 'GET') return mockApi.getGatewayApiKeys(workspaceId) as any;
      if (parts.length === 3 && method === 'POST') return mockApi.createGatewayApiKey(workspaceId, body as any) as any;
      if (parts[4] === 'rotate' && method === 'POST') return mockApi.rotateGatewayApiKey(workspaceId, keyId) as any;
      if (parts.length === 4 && method === 'DELETE') return mockApi.deleteGatewayApiKey(workspaceId, keyId) as any;
    }

    if (parts[0] === 'workspaces' && parts[2] === 'provider-keys') {
      if (parts.length === 3 && method === 'GET') return mockApi.getProviderKeys(workspaceId) as any;
      if (parts.length === 3 && method === 'POST') return mockApi.createProviderKey(workspaceId, body as any) as any;
      if (parts[4] === 'verify' && method === 'POST') return mockApi.verifyProviderKey(workspaceId, keyId) as any;
      if (parts[4] === 'rotate' && method === 'POST') return mockApi.rotateProviderKey(workspaceId, keyId) as any;
      if (parts.length === 4 && method === 'DELETE') return mockApi.deleteProviderKey(workspaceId, keyId) as any;
    }

    if (parts[0] === 'workspaces' && parts[2] === 'members') {
      if (parts.length === 3 && method === 'GET') return mockApi.getMembers(workspaceId) as any;
      if (parts.length === 3 && method === 'POST') return mockApi.inviteMember(workspaceId, body as any) as any;
      if (parts.length === 4 && method === 'PATCH') return mockApi.updateMemberRole(workspaceId, memberId, body as any) as any;
      if (parts.length === 4 && method === 'DELETE') return mockApi.removeMember(workspaceId, memberId) as any;
    }

    if (endpoint.includes('/onboarding/tour')) return mockApi.getOnboardingTour() as any;
    if (endpoint.includes('/prompt-templates') && method === 'GET') return mockApi.getTemplates() as any;
    if (endpoint.includes('/prompt-templates') && method === 'POST') {
      const templateId = parts[3];
      return mockApi.applyTemplate(workspaceId, templateId, body as any) as any;
    }
    if (endpoint.includes('/onboarding/wizard')) return mockApi.runOnboardingWizard(workspaceId, body as any) as any;

    return { data: [] as any, meta: { traceId: 'mock', timestamp: new Date().toISOString() } } as any;
  }
}

export const apiClient = new ApiClient(API_BASE_URL);

export function extractData<T>(response: ApiResponse<T>): T {
  return response.data;
}

export function isFieldErrorDetails(details: unknown): details is Record<string, string[]> {
  return !!details && typeof details === 'object' && !Array.isArray(details);
}


