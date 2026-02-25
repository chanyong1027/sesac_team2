import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BudgetUsageCard } from './BudgetUsageCard';
import type { BudgetUsageResponse } from '@/types/api.types';

function renderCard(usage: BudgetUsageResponse, enabled = true) {
  return render(
    <BudgetUsageCard
      title="Monthly Budget"
      subtitle="이번 달 사용량 (UTC 2026-02)"
      usage={usage}
      enabled={enabled}
      onConfigure={vi.fn()}
      variant="workspace"
    />
  );
}

describe('BudgetUsageCard', () => {
  it('hard-limit 초과 시 BLOCK 상태를 표시한다', () => {
    renderCard({
      scopeType: 'WORKSPACE',
      scopeId: 1,
      month: '2026-02',
      usedUsd: 60,
      hardLimitUsd: 50,
      softLimitUsd: 40,
      remainingHardUsd: -10,
      remainingSoftUsd: -20,
      requestCount: 20,
      totalTokens: 9855,
      lastUpdatedAt: '2026-02-25T00:00:00Z',
    });

    expect(screen.getByText('BLOCK')).toBeInTheDocument();
    expect(screen.getByText('$60.00 / $50.00')).toBeInTheDocument();
    expect(screen.getByText('20')).toBeInTheDocument();
  });

  it('soft-limit 초과 시 DEGRADE 상태와 안내 문구를 표시한다', () => {
    renderCard({
      scopeType: 'WORKSPACE',
      scopeId: 1,
      month: '2026-02',
      usedUsd: 12,
      hardLimitUsd: null,
      softLimitUsd: 10,
      remainingHardUsd: null,
      remainingSoftUsd: -2,
      requestCount: 3,
      totalTokens: 500,
      lastUpdatedAt: '2026-02-25T00:00:00Z',
    });

    expect(screen.getByText('DEGRADE')).toBeInTheDocument();
    expect(screen.getByText(/Soft-limit을 초과했습니다/)).toBeInTheDocument();
  });

  it('한도 미설정 시 안내 메시지를 표시한다', () => {
    renderCard({
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
    });

    expect(screen.getByText('$0.000542 / -')).toBeInTheDocument();
    expect(screen.getByText(/아직 예산 한도가 설정되지 않았습니다/)).toBeInTheDocument();
  });
});
