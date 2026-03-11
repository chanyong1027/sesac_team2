import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { WorkspaceLogDetailPage } from './WorkspaceLogDetailPage';
import { logsApi } from '@/api/logs.api';
import type {
  RequestLogAttemptTimelineResponse,
  RequestLogResponse,
} from '@/types/api.types';

vi.mock('@/api/logs.api', () => ({
  logsApi: {
    get: vi.fn(),
    getAttempts: vi.fn(),
    list: vi.fn(),
  },
}));

const mockedLogsApi = vi.mocked(logsApi);

const baseLog: RequestLogResponse = {
  requestId: '0d6ec5e9-4ff9-4869-a67c-f8bd9540f13a',
  traceId: 'trace-1',
  status: 'SUCCESS',
  httpStatus: 200,
  latencyMs: 900,
  provider: 'openai',
  requestedModel: 'gpt-4o-mini',
  usedModel: 'gpt-4o-mini',
  isFailover: false,
  inputTokens: 100,
  outputTokens: 50,
  totalTokens: 150,
  promptKey: 'test-prompt',
  ragEnabled: false,
  ragLatencyMs: 0,
  ragChunksCount: 0,
  ragTopK: 0,
  ragSimilarityThreshold: 0,
  requestPath: '/v1/chat/completions',
  errorCode: null,
  errorMessage: null,
  failReason: null,
  createdAt: '2026-03-01T00:00:00Z',
  finishedAt: '2026-03-01T00:00:00.900Z',
  requestPayload: '{"variables":{"question":"hello"}}',
  responsePayload: 'ok',
  requestSource: 'GATEWAY',
  retrievedDocuments: [],
  cost: 0.001,
};

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/orgs/1/workspaces/2/logs/trace-1']}>
        <Routes>
          <Route path="/orgs/:orgId/workspaces/:workspaceId/logs/:traceId" element={<WorkspaceLogDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('WorkspaceLogDetailPage attempt timeline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('RECORDED 모드에서 시도 내역을 표시한다', async () => {
    const attempts: RequestLogAttemptTimelineResponse = {
      collectionMode: 'RECORDED',
      attempts: [
        {
          attemptNo: 1,
          route: 'PRIMARY',
          retry: false,
          result: 'FAIL',
          provider: 'openai',
          requestedModel: 'gpt-4o-mini',
          usedModel: null,
          startedAt: '2026-03-01T00:00:00Z',
          endedAt: '2026-03-01T00:00:00.400Z',
          latencyMs: 400,
          httpStatus: 503,
          errorCode: 'GW-UP-UNAVAILABLE',
          failReason: 'HTTP_503',
          errorMessage: 'unavailable',
          backoffAfterMs: 200,
        },
        {
          attemptNo: 2,
          route: 'FAILOVER',
          retry: true,
          result: 'SUCCESS',
          provider: 'anthropic',
          requestedModel: 'claude-3-5-haiku',
          usedModel: 'claude-3-5-haiku',
          startedAt: '2026-03-01T00:00:00.600Z',
          endedAt: '2026-03-01T00:00:00.900Z',
          latencyMs: 300,
          httpStatus: 200,
          errorCode: null,
          failReason: null,
          errorMessage: null,
          backoffAfterMs: null,
        },
      ],
    };

    mockedLogsApi.get.mockResolvedValue(baseLog);
    mockedLogsApi.getAttempts.mockResolvedValue(attempts);

    renderPage();

    expect(await screen.findByText('실행 내역 (시도 단위)')).toBeInTheDocument();
    expect(await screen.findByText('RECORDED')).toBeInTheDocument();
    expect(await screen.findByText('PRIMARY')).toBeInTheDocument();
    expect(await screen.findByText('FAILOVER')).toBeInTheDocument();
    expect(await screen.findByText('RETRY')).toBeInTheDocument();
  });

  it('MISSING 모드에서 과거 로그 안내 문구를 표시한다', async () => {
    mockedLogsApi.get.mockResolvedValue(baseLog);
    mockedLogsApi.getAttempts.mockResolvedValue({
      collectionMode: 'MISSING',
      attempts: [],
    });

    renderPage();

    expect(await screen.findByText('MISSING')).toBeInTheDocument();
    expect(await screen.findByText(/attempt 수집 배포 이전 데이터입니다/)).toBeInTheDocument();
  });

  it('DERIVED_SINGLE 모드에서 파생 데이터 라벨을 표시한다', async () => {
    mockedLogsApi.get.mockResolvedValue({
      ...baseLog,
      requestSource: 'PLAYGROUND',
    });
    mockedLogsApi.getAttempts.mockResolvedValue({
      collectionMode: 'DERIVED_SINGLE',
      attempts: [
        {
          attemptNo: 1,
          route: 'PRIMARY',
          retry: false,
          result: 'SUCCESS',
          provider: 'openai',
          requestedModel: 'gpt-4o-mini',
          usedModel: 'gpt-4o-mini',
          startedAt: '2026-03-01T00:00:00Z',
          endedAt: '2026-03-01T00:00:00.900Z',
          latencyMs: 900,
          httpStatus: 200,
          errorCode: null,
          failReason: null,
          errorMessage: null,
          backoffAfterMs: null,
        },
      ],
    });

    renderPage();

    expect(await screen.findByText('DERIVED_SINGLE')).toBeInTheDocument();
    expect(await screen.findByText('파생 데이터')).toBeInTheDocument();
  });
});
