import { describe, it, beforeEach, expect, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { PromptDetailPage } from './PromptDetailPage';
import { promptApi } from '@/api/prompt.api';
import { organizationApi } from '@/api/organization.api';

vi.mock('@/api/prompt.api', () => ({
  promptApi: {
    getPrompt: vi.fn(),
    getVersions: vi.fn(),
    getVersion: vi.fn(),
    createVersion: vi.fn(),
    getRelease: vi.fn(),
    releasePrompt: vi.fn(),
    getModelAllowlist: vi.fn(),
    getReleaseHistory: vi.fn(),
  },
}));

vi.mock('@/api/organization.api', () => ({
  organizationApi: {
    getCredentials: vi.fn(),
  },
}));

vi.mock('@/features/organization/store/organizationStore', () => ({
  useOrganizationStore: () => ({ currentOrgId: 1 }),
}));

const mockedPromptApi = vi.mocked(promptApi);
const mockedOrganizationApi = vi.mocked(organizationApi);

const mockAxiosResponse = <T,>(data: T): AxiosResponse<T> => ({
  data,
  status: 200,
  statusText: 'OK',
  headers: {},
  config: { headers: {} } as InternalAxiosRequestConfig,
});

const renderPage = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/orgs/1/workspaces/1/prompts/1']}>
        <Routes>
          <Route path="/orgs/:orgId/workspaces/:workspaceId/prompts/:promptId" element={<PromptDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
};

beforeEach(() => {
  mockedPromptApi.getPrompt.mockResolvedValue(
    mockAxiosResponse({
      id: 1,
      workspaceId: 1,
      promptKey: 'cs-bot',
      description: 'CS Bot',
      status: 'ACTIVE',
      createdAt: '2026-02-01T00:00:00Z',
      updatedAt: '2026-02-01T00:00:00Z',
    })
  );
  mockedPromptApi.getVersions.mockResolvedValue(mockAxiosResponse([]));
  mockedPromptApi.getVersion.mockResolvedValue(
    mockAxiosResponse({
      id: 1,
      promptId: 1,
      versionNumber: 1,
      title: 'v1',
      provider: 'OPENAI',
      model: 'gpt-4o-mini',
      secondaryProvider: null,
      secondaryModel: null,
      systemPrompt: 'system',
      userTemplate: '질문: {{question}}',
      ragEnabled: false,
      modelConfig: {},
      createdBy: 1,
      createdAt: '2026-02-01T00:00:00Z',
    })
  );
  mockedPromptApi.getRelease.mockResolvedValue(
    mockAxiosResponse({
      promptId: 1,
      activeVersionId: 1,
      activeVersionNo: 1,
      releasedAt: '2026-02-01T00:00:00Z',
    })
  );
  mockedPromptApi.releasePrompt.mockResolvedValue(
    mockAxiosResponse({
      promptId: 1,
      activeVersionId: 1,
      activeVersionNo: 1,
      releasedAt: '2026-02-01T00:00:00Z',
    })
  );
  mockedPromptApi.createVersion.mockResolvedValue(
    mockAxiosResponse({
      id: 1,
      versionNumber: 1,
      createdAt: '2026-02-01T00:00:00Z',
    })
  );

  mockedPromptApi.getModelAllowlist.mockResolvedValue(
    mockAxiosResponse({
      OPENAI: ['gpt-4o-mini', 'gpt-4o'],
      ANTHROPIC: ['claude-3-5-sonnet'],
      GEMINI: ['gemini-2.0-flash'],
    })
  );

  mockedPromptApi.getReleaseHistory.mockResolvedValue(mockAxiosResponse([]));

  mockedOrganizationApi.getCredentials.mockResolvedValue(
    mockAxiosResponse([
      { credentialId: 1, provider: 'openai', status: 'ACTIVE', createdAt: '2026-02-01T00:00:00Z' },
      { credentialId: 2, provider: 'anthropic', status: 'ACTIVE', createdAt: '2026-02-01T00:00:00Z' },
    ])
  );
});

describe('PromptDetailPage VersionsTab', () => {
  it('updates model options when provider changes', async () => {
    renderPage();

    const versionsTab = await screen.findByRole('button', { name: /버전 \(Versions\)/ });
    fireEvent.click(versionsTab);

    const openButton = await screen.findByText('+ 새 버전 생성');
    fireEvent.click(openButton);

    const providerSelect = await screen.findByLabelText('Provider');
    const modelSelect = await screen.findByLabelText('Model');

    await waitFor(() => expect(modelSelect).toBeEnabled());
    expect(modelSelect).toHaveTextContent('gpt-4o-mini');

    fireEvent.change(providerSelect, { target: { value: 'ANTHROPIC' } });

    await waitFor(() => expect(modelSelect).toHaveTextContent('claude-3-5-sonnet'));
  });

  it('disables model selection when allowlist fails', async () => {
    mockedPromptApi.getModelAllowlist.mockRejectedValueOnce(new Error('network error'));

    renderPage();

    const versionsTab = await screen.findByRole('button', { name: /버전 \(Versions\)/ });
    fireEvent.click(versionsTab);

    const openButton = await screen.findByText('+ 새 버전 생성');
    fireEvent.click(openButton);

    const modelSelect = await screen.findByLabelText('Model');

    await waitFor(() => expect(modelSelect).toBeDisabled());
    expect(screen.getByText('모델 목록을 불러오지 못했습니다.')).toBeInTheDocument();
  });
});
