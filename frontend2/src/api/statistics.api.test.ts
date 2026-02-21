import { describe, expect, it, vi, beforeEach } from 'vitest';
import { statisticsApi } from './statistics.api';

const { getMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
}));

vi.mock('./axios', () => ({
  default: {
    get: getMock,
  },
}));

describe('statisticsApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('getRagQualityTimeseries uses real backend endpoint and passes params', async () => {
    getMock.mockResolvedValue({ data: { data: [] } } as never);

    await statisticsApi.getRagQualityTimeseries(2, {
      period: 'daily',
      workspaceId: 2,
      from: '2026-02-20T00:00:00',
      to: '2026-02-21T00:00:00',
    });

    expect(getMock).toHaveBeenCalledWith(
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
    getMock.mockResolvedValue({ data: {} } as never);

    const rangeParams = {
      workspaceId: 2,
      from: '2026-02-14T00:00:00',
      to: '2026-02-21T00:00:00',
    };

    await statisticsApi.getByModel(2, rangeParams);
    await statisticsApi.getByPrompt(2, rangeParams);
    await statisticsApi.getErrorDistribution(2, rangeParams);
    await statisticsApi.getRagQuality(2, rangeParams);

    expect(getMock).toHaveBeenNthCalledWith(
      1,
      '/organizations/2/stats/by-model',
      { params: rangeParams }
    );
    expect(getMock).toHaveBeenNthCalledWith(
      2,
      '/organizations/2/stats/by-prompt',
      { params: rangeParams }
    );
    expect(getMock).toHaveBeenNthCalledWith(
      3,
      '/organizations/2/stats/errors',
      { params: rangeParams }
    );
    expect(getMock).toHaveBeenNthCalledWith(
      4,
      '/organizations/2/stats/rag-quality',
      { params: rangeParams }
    );
  });
});
