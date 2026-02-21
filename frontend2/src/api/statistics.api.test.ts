import { describe, expect, it, vi, beforeEach } from 'vitest';
import api from './axios';
import { statisticsApi } from './statistics.api';

vi.mock('./axios', () => ({
  default: {
    get: vi.fn(),
  },
}));

describe('statisticsApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('getRagQualityTimeseries uses real backend endpoint and passes params', async () => {
    const mockedApi = vi.mocked(api);
    mockedApi.get.mockResolvedValue({ data: { data: [] } } as never);

    await statisticsApi.getRagQualityTimeseries(2, {
      period: 'daily',
      workspaceId: 2,
      from: '2026-02-20T00:00:00',
      to: '2026-02-21T00:00:00',
    });

    expect(mockedApi.get).toHaveBeenCalledWith(
      '/organizations/2/stats/rag-quality/timeseries',
      {
        params: {
          period: 'daily',
          workspaceId: 2,
          from: '2026-02-20T00:00:00',
          to: '2026-02-21T00:00:00',
        },
      }
    );
  });

  it('range-based APIs pass workspaceId/from/to without period', async () => {
    const mockedApi = vi.mocked(api);
    mockedApi.get.mockResolvedValue({ data: {} } as never);

    const rangeParams = {
      workspaceId: 2,
      from: '2026-02-14T00:00:00',
      to: '2026-02-21T00:00:00',
    };

    await statisticsApi.getByModel(2, rangeParams);
    await statisticsApi.getByPrompt(2, rangeParams);
    await statisticsApi.getErrorDistribution(2, rangeParams);
    await statisticsApi.getRagQuality(2, rangeParams);

    expect(mockedApi.get).toHaveBeenNthCalledWith(
      1,
      '/organizations/2/stats/by-model',
      { params: rangeParams }
    );
    expect(mockedApi.get).toHaveBeenNthCalledWith(
      2,
      '/organizations/2/stats/by-prompt',
      { params: rangeParams }
    );
    expect(mockedApi.get).toHaveBeenNthCalledWith(
      3,
      '/organizations/2/stats/errors',
      { params: rangeParams }
    );
    expect(mockedApi.get).toHaveBeenNthCalledWith(
      4,
      '/organizations/2/stats/rag-quality',
      { params: rangeParams }
    );
  });
});
