import api from './axios';
import type {
  BudgetPolicyResponse,
  BudgetPolicyUpdateRequest,
  BudgetUsageResponse,
} from '@/types/api.types';

export const budgetApi = {
  // Workspace
  getWorkspacePolicy: (workspaceId: number) =>
    api.get<BudgetPolicyResponse>(`/workspaces/${workspaceId}/budget-policy`),

  updateWorkspacePolicy: (workspaceId: number, data: BudgetPolicyUpdateRequest) =>
    api.put<BudgetPolicyResponse>(`/workspaces/${workspaceId}/budget-policy`, data),

  getWorkspaceUsage: (workspaceId: number, month?: string) =>
    api.get<BudgetUsageResponse>(`/workspaces/${workspaceId}/budget-usage`, {
      params: month ? { month } : undefined,
    }),

  // Provider (org + provider)
  getProviderPolicy: (orgId: number, provider: string) =>
    api.get<BudgetPolicyResponse>(`/organizations/${orgId}/providers/${provider}/budget-policy`),

  updateProviderPolicy: (orgId: number, provider: string, data: BudgetPolicyUpdateRequest) =>
    api.put<BudgetPolicyResponse>(`/organizations/${orgId}/providers/${provider}/budget-policy`, data),

  getProviderUsage: (orgId: number, provider: string, month?: string) =>
    api.get<BudgetUsageResponse>(`/organizations/${orgId}/providers/${provider}/budget-usage`, {
      params: month ? { month } : undefined,
    }),
};

