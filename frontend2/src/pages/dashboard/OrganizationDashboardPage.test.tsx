import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { OrganizationDashboardPage } from './OrganizationDashboardPage';
import { useOrganizationWorkspaces } from '@/features/workspace/hooks/useOrganizationWorkspaces';
import { organizationApi } from '@/api/organization.api';
import { documentApi } from '@/api/document.api';
import { budgetApi } from '@/api/budget.api';
import type {
  BudgetUsageResponse,
  WorkspaceSummaryResponse,
} from '@/types/api.types';

vi.mock('@/features/workspace/hooks/useOrganizationWorkspaces', () => ({
  useOrganizationWorkspaces: vi.fn(),
}));

vi.mock('@/features/organization/store/organizationStore', () => ({
  useOrganizationStore: () => ({ currentOrgId: 1 }),
}));

vi.mock('@/api/organization.api', () => ({
  organizationApi: {
    getMembers: vi.fn(),
    getApiKeys: vi.fn(),
  },
}));

vi.mock('@/api/document.api', () => ({
  documentApi: {
    getDocuments: vi.fn(),
  },
}));

vi.mock('@/api/budget.api', () => ({
  budgetApi: {
    getWorkspaceUsage: vi.fn(),
  },
}));

vi.mock('@/features/organization/components/CreateOrganizationModal', () => ({
  CreateOrganizationModal: () => null,
}));

const mockedUseOrganizationWorkspaces = vi.mocked(useOrganizationWorkspaces);
const mockedOrganizationApi = vi.mocked(organizationApi);
const mockedDocumentApi = vi.mocked(documentApi);
const mockedBudgetApi = vi.mocked(budgetApi);

const mockAxiosResponse = <T,>(data: T): AxiosResponse<T> => ({
  data,
  status: 200,
  statusText: 'OK',
  headers: {},
  config: { headers: {} } as InternalAxiosRequestConfig,
});

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/orgs/1/dashboard']}>
        <Routes>
          <Route path="/orgs/:orgId/dashboard" element={<OrganizationDashboardPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

const workspace: WorkspaceSummaryResponse = {
  id: 1,
  organizationId: 1,
  name: 'real',
  displayName: 'real',
  status: 'ACTIVE',
  myRole: 'OWNER',
  createdAt: '2026-02-01T00:00:00Z',
};

beforeEach(() => {
  vi.clearAllMocks();

  mockedUseOrganizationWorkspaces.mockReturnValue({
    data: [workspace],
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  } as unknown as ReturnType<typeof useOrganizationWorkspaces>);

  mockedOrganizationApi.getMembers.mockResolvedValue(mockAxiosResponse([]));
  mockedOrganizationApi.getApiKeys.mockResolvedValue(mockAxiosResponse([]));
  mockedDocumentApi.getDocuments.mockResolvedValue(mockAxiosResponse([]));
});

describe('OrganizationDashboardPage budget card', () => {
  it('워크스페이스 예산 사용률(used/limit) 기준으로 퍼센트, Reqs, Cost를 표시한다', async () => {
    const usage: BudgetUsageResponse = {
      scopeType: 'WORKSPACE',
      scopeId: 1,
      month: '2026-02',
      usedUsd: 1,
      hardLimitUsd: 2,
      softLimitUsd: 1.5,
      remainingHardUsd: 1,
      remainingSoftUsd: 0.5,
      requestCount: 28,
      totalTokens: 9855,
      lastUpdatedAt: '2026-02-25T00:00:00Z',
    };
    mockedBudgetApi.getWorkspaceUsage.mockResolvedValue(mockAxiosResponse(usage));

    renderPage();

    expect(await screen.findByText('UTC 2026-02')).toBeInTheDocument();
    expect(await screen.findByText('50%')).toBeInTheDocument();
    expect(await screen.findByText('Reqs: 28')).toBeInTheDocument();
    expect(await screen.findByText('Cost: $1.00')).toBeInTheDocument();
  });

  it('한도가 없으면 퍼센트는 - 로 표시하고 Cost/Reqs는 budget-usage 값을 사용한다', async () => {
    const usage: BudgetUsageResponse = {
      scopeType: 'WORKSPACE',
      scopeId: 1,
      month: '2026-02',
      usedUsd: 0.000542,
      hardLimitUsd: null,
      softLimitUsd: null,
      remainingHardUsd: null,
      remainingSoftUsd: null,
      requestCount: 28,
      totalTokens: 9855,
      lastUpdatedAt: '2026-02-25T00:00:00Z',
    };
    mockedBudgetApi.getWorkspaceUsage.mockResolvedValue(mockAxiosResponse(usage));

    renderPage();

    expect(await screen.findByText('UTC 2026-02')).toBeInTheDocument();
    expect(await screen.findByText('Reqs: 28')).toBeInTheDocument();
    expect(await screen.findByText('Cost: $0.000542')).toBeInTheDocument();
    expect(await screen.findByText('-')).toBeInTheDocument();
  });
});
