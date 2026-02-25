import { describe, expect, it } from 'vitest';
import {
  calculateUsagePercent,
  formatUsageMonth,
  formatUsdAmount,
  resolvePrimaryLimitUsd,
} from './budgetUsage';

describe('budgetUsage utils', () => {
  it('hard limit을 우선으로 선택한다', () => {
    expect(resolvePrimaryLimitUsd({ hardLimitUsd: 50, softLimitUsd: 40 })).toBe(50);
    expect(resolvePrimaryLimitUsd({ hardLimitUsd: null, softLimitUsd: 40 })).toBe(40);
    expect(resolvePrimaryLimitUsd({ hardLimitUsd: null, softLimitUsd: null })).toBeNull();
  });

  it('예산 사용률을 계산하고 범위를 0~100으로 제한한다', () => {
    expect(calculateUsagePercent(25, 50)).toBe(50);
    expect(calculateUsagePercent(120, 100)).toBe(100);
    expect(calculateUsagePercent(-10, 100)).toBe(0);
    expect(calculateUsagePercent(10, null)).toBeNull();
    expect(calculateUsagePercent(10, 0)).toBeNull();
  });

  it('USD 금액 포맷 규칙을 일관되게 적용한다', () => {
    expect(formatUsdAmount(0)).toBe('$0.00');
    expect(formatUsdAmount(0.0003)).toBe('$0.000300');
    expect(formatUsdAmount(0.3)).toBe('$0.3000');
    expect(formatUsdAmount(-0.3)).toBe('-$0.3000');
    expect(formatUsdAmount(12.345)).toBe('$12.35');
    expect(formatUsdAmount(null)).toBe('-');
  });

  it('월 라벨은 유효값이면 그대로, 아니면 UTC YYYY-MM 포맷으로 보정한다', () => {
    expect(formatUsageMonth('2026-02')).toBe('2026-02');
    expect(formatUsageMonth('invalid')).toMatch(/^\d{4}-(0[1-9]|1[0-2])$/);
    expect(formatUsageMonth(null)).toMatch(/^\d{4}-(0[1-9]|1[0-2])$/);
  });
});
