import type { BudgetUsageResponse } from '@/types/api.types';

type BudgetLimitSource = Pick<BudgetUsageResponse, 'hardLimitUsd' | 'softLimitUsd'>;

export function formatUsdAmount(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '-';

  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs === 0) return '$0.00';
  if (abs < 0.01) return `${sign}$${abs.toFixed(6)}`;
  if (abs < 1) return `${sign}$${abs.toFixed(4)}`;
  return `${sign}$${abs.toFixed(2)}`;
}

export function resolvePrimaryLimitUsd(
  usage: BudgetLimitSource | null | undefined,
): number | null {
  if (!usage) return null;
  return usage.hardLimitUsd ?? usage.softLimitUsd ?? null;
}

export function calculateUsagePercent(
  usedUsd: number | null | undefined,
  limitUsd: number | null | undefined,
): number | null {
  if (
    usedUsd == null
    || !Number.isFinite(usedUsd)
    || limitUsd == null
    || !Number.isFinite(limitUsd)
    || limitUsd <= 0
  ) {
    return null;
  }

  return Math.max(0, Math.min(100, (usedUsd / limitUsd) * 100));
}

export function formatUsageMonth(month: string | null | undefined): string {
  if (month && /^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return month;

  const now = new Date();
  const year = now.getUTCFullYear();
  const monthNumber = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${monthNumber}`;
}
