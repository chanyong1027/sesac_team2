import type { BudgetUsageResponse } from '@/types/api.types';

function formatUsd(n: number) {
  if (!Number.isFinite(n)) return '-';
  if (n >= 1) return `$${n.toFixed(2)}`;
  return `$${n.toFixed(4)}`;
}

function pct(used: number, limit: number) {
  if (!Number.isFinite(used) || !Number.isFinite(limit) || limit <= 0) return 0;
  return Math.max(0, Math.min(100, (used / limit) * 100));
}

export function BudgetUsageCard({
  title,
  subtitle,
  usage,
  enabled,
  onConfigure,
  variant = 'workspace',
}: {
  title: string;
  subtitle: string;
  usage: BudgetUsageResponse | null;
  enabled: boolean;
  onConfigure: () => void;
  variant?: 'workspace' | 'provider';
}) {
  const used = usage?.usedUsd ?? 0;
  const hard = usage?.hardLimitUsd ?? null;
  const soft = usage?.softLimitUsd ?? null;

  const primaryLimit = hard ?? soft;
  const progress = primaryLimit != null ? pct(used, primaryLimit) : 0;

  const isHardExceeded = enabled && hard != null && (usage?.remainingHardUsd ?? 1) <= 0;
  const isSoftExceeded = enabled && soft != null && (usage?.remainingSoftUsd ?? 1) <= 0;

  return (
    <section className="glass-card rounded-2xl p-5 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 to-purple-600/10 z-0" />

      <div className="relative z-10 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <span className="material-symbols-outlined text-base text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.5)]">
                monetization_on
              </span>
              {title}
            </h3>
            <p className="text-[11px] text-gray-500 mt-1">{subtitle}</p>
          </div>

          <div className="flex items-center gap-2">
            {enabled ? (
              <span
                className={[
                  'px-2 py-0.5 rounded-full text-[10px] font-bold border',
                  isHardExceeded
                    ? 'bg-rose-500/15 border-rose-400/20 text-rose-200'
                    : isSoftExceeded
                      ? 'bg-amber-500/15 border-amber-400/20 text-amber-200'
                      : 'bg-emerald-500/15 border-emerald-400/20 text-emerald-200',
                ].join(' ')}
              >
                {isHardExceeded ? 'BLOCK' : isSoftExceeded ? 'DEGRADE' : 'ON'}
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold border bg-white/5 border-white/10 text-gray-300">
                OFF
              </span>
            )}

            <button
              type="button"
              onClick={onConfigure}
              className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-white/5 hover:bg-white/10 text-gray-300 transition-colors border border-white/5"
            >
              설정
            </button>
          </div>
        </div>

        <div className="flex items-baseline justify-between gap-3">
          <div className="text-2xl font-bold text-white font-mono tracking-tight">
            {formatUsd(used)}
          </div>
          <div className="text-xs font-mono font-bold text-gray-300">
            {primaryLimit != null ? `${formatUsd(used)} / ${formatUsd(primaryLimit)}` : `${formatUsd(used)} / -`}
          </div>
        </div>

        {primaryLimit != null ? (
          <div className="w-full bg-gray-800 rounded-full h-2 overflow-hidden shadow-inner border border-white/5">
            <div
              className={[
                'h-2 rounded-full relative',
                isHardExceeded
                  ? 'bg-gradient-to-r from-rose-500 to-rose-400'
                  : isSoftExceeded
                    ? 'bg-gradient-to-r from-amber-500 to-amber-400'
                    : 'bg-gradient-to-r from-blue-500 to-[var(--primary)]',
              ].join(' ')}
              style={{ width: `${progress}%` }}
            />
          </div>
        ) : (
          <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-[11px] text-gray-500">
            아직 예산 한도가 설정되지 않았습니다. 설정에서 한도를 추가할 수 있어요.
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 text-[11px]">
          <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2">
            <div className="text-gray-500 mb-0.5">요청 수</div>
            <div className="text-gray-200 font-mono">{(usage?.requestCount ?? 0).toLocaleString('ko-KR')}</div>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2">
            <div className="text-gray-500 mb-0.5">토큰</div>
            <div className="text-gray-200 font-mono">{(usage?.totalTokens ?? 0).toLocaleString('ko-KR')}</div>
          </div>
        </div>

        {variant === 'workspace' && enabled && isSoftExceeded ? (
          <div className="rounded-xl border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-[11px] text-amber-100">
            Soft-limit을 초과했습니다. 절약 모드가 적용되어 모델/토큰/RAG 설정이 자동으로 조정될 수 있어요.
          </div>
        ) : null}

        {variant === 'provider' && enabled && isHardExceeded ? (
          <div className="rounded-xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-[11px] text-rose-100">
            Hard-limit을 초과했습니다. 이 Provider 키로 나가는 호출이 차단됩니다(가능하면 failover로 대체).
          </div>
        ) : null}
      </div>
    </section>
  );
}

