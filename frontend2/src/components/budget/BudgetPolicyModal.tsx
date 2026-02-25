import { useEffect, useMemo, useState } from 'react';
import type { BudgetPolicyResponse, BudgetPolicyUpdateRequest } from '@/types/api.types';

type Mode = 'WORKSPACE' | 'PROVIDER';

const KNOWN_PROVIDERS = ['openai', 'gemini', 'anthropic'] as const;

function numberOrNull(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n)) return null;
  return n;
}

function formatUsd(n: number) {
  if (!Number.isFinite(n)) return '-';
  // Guardrail 목적상 대략적인 표시가 중요 -> 소수 4자리까지.
  if (n >= 1) return `$${n.toFixed(2)}`;
  return `$${n.toFixed(4)}`;
}

export function BudgetPolicyModal({
  open,
  mode,
  title,
  description,
  policy,
  onClose,
  onSave,
  isSaving,
}: {
  open: boolean;
  mode: Mode;
  title: string;
  description: string;
  policy: BudgetPolicyResponse | null;
  onClose: () => void;
  onSave: (payload: BudgetPolicyUpdateRequest) => void;
  isSaving?: boolean;
}) {
  const showWorkspaceFields = mode === 'WORKSPACE';

  const initialProviderMap = useMemo<Record<string, string>>(() => {
    const base = policy?.degradeProviderModelMap ?? {};
    return {
      openai: base.openai ?? '',
      gemini: base.gemini ?? '',
      anthropic: base.anthropic ?? '',
    };
  }, [policy]);

  const [enabled, setEnabled] = useState<boolean>(policy?.enabled ?? false);
  const [monthLimitUsd, setMonthLimitUsd] = useState<string>(policy?.monthLimitUsd?.toString() ?? '');
  const [softLimitUsd, setSoftLimitUsd] = useState<string>(policy?.softLimitUsd?.toString() ?? '');
  const [degradeMaxOutputTokens, setDegradeMaxOutputTokens] = useState<string>(
    policy?.degradeMaxOutputTokens?.toString() ?? '512'
  );
  const [degradeDisableRag, setDegradeDisableRag] = useState<boolean>(policy?.degradeDisableRag ?? false);
  const [providerModelMap, setProviderModelMap] = useState<Record<string, string>>(initialProviderMap);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [providerMapJson, setProviderMapJson] = useState('');
  const [jsonError, setJsonError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setEnabled(policy?.enabled ?? false);
    setMonthLimitUsd(policy?.monthLimitUsd?.toString() ?? '');
    setSoftLimitUsd(policy?.softLimitUsd?.toString() ?? '');
    setDegradeMaxOutputTokens(policy?.degradeMaxOutputTokens?.toString() ?? '512');
    setDegradeDisableRag(policy?.degradeDisableRag ?? false);
    setProviderModelMap(initialProviderMap);
    setShowAdvanced(false);
    setProviderMapJson(JSON.stringify(initialProviderMap, null, 2));
    setJsonError(null);
  }, [open, policy, initialProviderMap]);

  if (!open) return null;

  const handleBackdrop = () => {
    if (isSaving) return;
    onClose();
  };

  const handleSave = () => {
    if (isSaving) return;

    let degradeMap = providerModelMap;
    if (showAdvanced) {
      try {
        const parsed = JSON.parse(providerMapJson || '{}');
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          degradeMap = Object.fromEntries(
            Object.entries(parsed).map(([k, v]) => [String(k), String(v ?? '')])
          );
          setJsonError(null);
        } else {
          setJsonError('JSON은 객체 형태여야 합니다. 예: { "openai": "gpt-4o-mini" }');
          return;
        }
      } catch {
        setJsonError('유효한 JSON이 아닙니다.');
        return;
      }
    }

    // 빈 값 제거(서버 저장/파싱 단순화)
    degradeMap = Object.fromEntries(
      Object.entries(degradeMap).filter(([, v]) => String(v).trim().length > 0)
    );

    const payload: BudgetPolicyUpdateRequest = {
      enabled,
      monthLimitUsd: numberOrNull(monthLimitUsd),
    };

    if (showWorkspaceFields) {
      payload.softLimitUsd = numberOrNull(softLimitUsd);
      payload.degradeMaxOutputTokens = numberOrNull(degradeMaxOutputTokens);
      payload.degradeDisableRag = degradeDisableRag;
      payload.degradeProviderModelMap = degradeMap;
      payload.softAction = 'DEGRADE';
    }

    onSave(payload);
  };

  const previewHard = numberOrNull(monthLimitUsd);
  const previewSoft = numberOrNull(softLimitUsd);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={handleBackdrop} />

      <div className="relative w-full max-w-2xl mx-4 rounded-2xl border border-[var(--border)] bg-[var(--card)] backdrop-blur-xl shadow-xl overflow-hidden">
        <div className="px-7 py-6 border-b border-[var(--border)] bg-[var(--muted)]/40">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-[var(--foreground)] flex items-center gap-2">
                <span className="w-1.5 h-5 rounded-full bg-[var(--primary)] shadow-[0_0_10px_rgba(168,85,247,0.45)]" />
                {title}
              </h3>
              <p className="text-sm text-[var(--text-secondary)]">{description}</p>
            </div>

            <button
              type="button"
              onClick={handleBackdrop}
              className="p-2 rounded-xl text-[var(--text-secondary)] hover:text-[var(--foreground)] hover:bg-[var(--muted)] border border-transparent hover:border-[var(--border)] transition-colors disabled:opacity-50"
              disabled={!!isSaving}
              aria-label="close"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
        </div>

        <div className="px-7 py-6 space-y-6 max-h-[70vh] overflow-y-auto scrollbar-hide">
          <div className="flex items-center justify-between gap-4 rounded-xl border border-[var(--border)] bg-[var(--muted)] px-4 py-3">
            <div className="space-y-0.5">
              <div className="text-sm font-semibold text-[var(--foreground)]">예산 가드레일</div>
              <div className="text-[11px] text-[var(--text-secondary)]">
                {enabled
                  ? '활성화됨: 초과 시 차단/절약 모드가 적용됩니다.'
                  : '비활성화됨: 예산 제한을 적용하지 않습니다.'}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setEnabled((v) => !v)}
              className={[
                'h-9 px-3 rounded-lg border text-xs font-bold transition-colors',
                enabled
                  ? 'bg-emerald-500/15 border-emerald-400/25 text-emerald-700 dark:text-emerald-200'
                  : 'bg-[var(--muted)] border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--accent)]',
              ].join(' ')}
            >
              {enabled ? 'ON' : 'OFF'}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Hard-limit (USD)</label>
              <input
                value={monthLimitUsd}
                onChange={(e) => setMonthLimitUsd(e.target.value)}
                placeholder="예: 50"
                inputMode="decimal"
                className="w-full px-4 py-3 text-sm text-[var(--foreground)] bg-[var(--muted)] border border-[var(--border)] rounded-xl focus:ring-2 focus:ring-[color:rgba(168,85,247,0.45)] focus:border-[color:rgba(168,85,247,0.35)] outline-none transition-all font-mono placeholder:text-[var(--text-tertiary)]"
              />
              <p className="text-[11px] text-[var(--text-secondary)]">
                {previewHard != null ? `현재 입력: ${formatUsd(previewHard)} / 월` : '비우면 제한 없음'}
              </p>
            </div>

            {showWorkspaceFields ? (
              <div className="space-y-2">
                <label className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Soft-limit (USD)</label>
                <input
                  value={softLimitUsd}
                  onChange={(e) => setSoftLimitUsd(e.target.value)}
                  placeholder="예: 20"
                  inputMode="decimal"
                  className="w-full px-4 py-3 text-sm text-[var(--foreground)] bg-[var(--muted)] border border-[var(--border)] rounded-xl focus:ring-2 focus:ring-[color:rgba(168,85,247,0.45)] focus:border-[color:rgba(168,85,247,0.35)] outline-none transition-all font-mono placeholder:text-[var(--text-tertiary)]"
                />
                <p className="text-[11px] text-[var(--text-secondary)]">
                  {previewSoft != null ? `현재 입력: ${formatUsd(previewSoft)} / 월` : '비우면 절약 모드 미적용'}
                </p>
              </div>
            ) : (
              <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)] px-4 py-3">
                <div className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1">Tip</div>
                <div className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
                  Provider 예산은 해당 Provider 키로 나가는 호출만 차단합니다. (다른 Provider로 failover 가능)
                </div>
              </div>
            )}
          </div>

          {showWorkspaceFields ? (
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--muted)]/40 p-5 space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-bold text-[var(--foreground)]">절약 모드(Degrade)</div>
                  <div className="text-[11px] text-[var(--text-secondary)]">Soft-limit 초과 시 적용됩니다.</div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (!showAdvanced) {
                      setProviderMapJson(JSON.stringify(providerModelMap, null, 2));
                      if (jsonError) setJsonError(null);
                    }
                    setShowAdvanced((v) => !v);
                  }}
                  className="text-xs font-bold text-[var(--primary)] hover:text-[var(--foreground)] transition-colors"
                >
                  {showAdvanced ? '간단 설정' : '고급(JSON)'}
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Max Output Tokens</label>
                  <input
                    value={degradeMaxOutputTokens}
                    onChange={(e) => setDegradeMaxOutputTokens(e.target.value)}
                    placeholder="예: 512"
                    inputMode="numeric"
                    className="w-full px-4 py-3 text-sm text-[var(--foreground)] bg-[var(--muted)] border border-[var(--border)] rounded-xl focus:ring-2 focus:ring-[color:rgba(168,85,247,0.45)] focus:border-[color:rgba(168,85,247,0.35)] outline-none transition-all font-mono placeholder:text-[var(--text-tertiary)]"
                  />
                  <p className="text-[11px] text-[var(--text-secondary)]">응답 길이를 제한해 비용과 지연을 줄입니다.</p>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">RAG Off</label>
                  <button
                    type="button"
                    onClick={() => setDegradeDisableRag((v) => !v)}
                    className={[
                      'w-full h-[46px] rounded-xl border text-sm font-bold transition-colors',
                      degradeDisableRag
                        ? 'bg-rose-500/15 border-rose-400/20 text-rose-700 dark:text-rose-200'
                        : 'bg-[var(--muted)] border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--accent)]',
                    ].join(' ')}
                  >
                    {degradeDisableRag ? 'RAG 비활성화' : 'RAG 유지'}
                  </button>
                  <p className="text-[11px] text-[var(--text-secondary)]">
                    RAG가 비용/지연을 올리는 워크스페이스에서만 권장합니다.
                  </p>
                </div>
              </div>

              {showAdvanced ? (
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Provider → Cheap Model Map (JSON)</label>
                  <textarea
                    value={providerMapJson}
                    onChange={(e) => {
                      setProviderMapJson(e.target.value);
                      if (jsonError) setJsonError(null);
                    }}
                    rows={6}
                    className="w-full px-4 py-3 text-xs text-[var(--foreground)] bg-[var(--muted)] border border-[var(--border)] rounded-xl focus:ring-2 focus:ring-[color:rgba(168,85,247,0.45)] focus:border-[color:rgba(168,85,247,0.35)] outline-none transition-all font-mono placeholder:text-[var(--text-tertiary)]"
                    placeholder='{\n  "openai": "gpt-4o-mini",\n  "gemini": "gemini-2.0-flash"\n}'
                  />
                  {jsonError ? <p className="text-xs text-rose-700 dark:text-rose-300">{jsonError}</p> : null}
                  <p className="text-[11px] text-[var(--text-secondary)]">
                    키는 provider 식별자(예: openai/gemini), 값은 강제할 모델명입니다.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {KNOWN_PROVIDERS.map((p) => (
                    <div className="space-y-2" key={p}>
                      <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">
                        {p}
                      </label>
                      <input
                        value={providerModelMap[p] ?? ''}
                        onChange={(e) =>
                          setProviderModelMap((prev) => ({ ...prev, [p]: e.target.value }))
                        }
                        placeholder="예: gpt-4o-mini"
                        className="w-full px-3 py-2.5 text-xs text-[var(--foreground)] bg-[var(--muted)] border border-[var(--border)] rounded-xl focus:ring-2 focus:ring-[color:rgba(168,85,247,0.35)] focus:border-[color:rgba(168,85,247,0.25)] outline-none transition-all font-mono placeholder:text-[var(--text-tertiary)]"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : null}
        </div>

        <div className="px-7 py-5 border-t border-[var(--border)] bg-[var(--muted)]/50 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={handleBackdrop}
            className="px-5 py-2.5 rounded-xl border border-[var(--border)] text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--muted)] hover:text-[var(--foreground)] transition-colors disabled:opacity-50"
            disabled={!!isSaving}
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-5 py-2.5 rounded-xl bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-sm font-bold text-white shadow-[0_0_20px_rgba(168,85,247,0.25)] transition-colors disabled:opacity-50"
            disabled={!!isSaving}
          >
            {isSaving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </div>
  );
}
