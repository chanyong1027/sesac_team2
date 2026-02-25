import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { AxiosError } from 'axios';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { organizationApi } from '@/api/organization.api';
import { budgetApi } from '@/api/budget.api';
import { BudgetPolicyModal } from '@/components/budget/BudgetPolicyModal';
import { useOrganizationStore } from '@/features/organization/store/organizationStore';
import type { BudgetPolicyUpdateRequest, ProviderCredentialSummaryResponse } from '@/types/api.types';

type ProviderKey = 'OPENAI' | 'GEMINI' | 'ANTHROPIC' | 'AZURE_OPENAI';

const providers: ProviderKey[] = ['OPENAI', 'GEMINI', 'ANTHROPIC', 'AZURE_OPENAI'];

const providerInfo: Record<
  ProviderKey,
  {
    label: string;
    subtitle: string;
    // Visual style knobs used to match the provided dark/glass mock.
    accentText: string;
    iconNode: ReactNode;
    isEnterpriseOnly?: boolean;
  }
> = {
  OPENAI: {
    label: 'OpenAI',
    subtitle: 'GPT-4, GPT-3.5 Turbo',
    accentText: 'text-[var(--foreground)]',
    iconNode: (
      <div className="size-12 rounded-xl bg-white text-black flex items-center justify-center shadow-[0_0_15px_rgba(255,255,255,0.10)]">
        <span className="text-lg font-black">O</span>
      </div>
    ),
  },
  GEMINI: {
    label: 'Gemini',
    subtitle: 'Gemini Pro, Ultra',
    accentText: 'text-[var(--foreground)]',
    iconNode: (
      <div className="size-12 rounded-xl bg-gradient-to-r from-blue-500 via-purple-500 to-red-500 p-[1px] shadow-[0_0_15px_rgba(168,85,247,0.20)]">
        <div className="size-full rounded-[11px] bg-[#0f0814] flex items-center justify-center">
          <span className="text-base font-black bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">
            G
          </span>
        </div>
      </div>
    ),
  },
  ANTHROPIC: {
    label: 'Anthropic',
    subtitle: 'Claude 3 Opus, Sonnet',
    accentText: 'text-[var(--foreground)]',
    iconNode: (
      <div className="size-12 rounded-xl bg-[#d09b73] text-[#1a1022] flex items-center justify-center font-serif font-black text-xl shadow-[0_0_15px_rgba(208,155,115,0.20)]">
        A
      </div>
    ),
  },
  AZURE_OPENAI: {
    label: 'Azure OpenAI',
    subtitle: 'Enterprise Only',
    accentText: 'text-[var(--text-secondary)]',
    isEnterpriseOnly: true,
    iconNode: (
      <div className="size-12 rounded-xl bg-blue-600/20 border border-blue-500/30 text-blue-400 flex items-center justify-center">
        <span className="material-symbols-outlined text-2xl">cloud_circle</span>
      </div>
    ),
  },
};

const statusMeta: Record<
  string,
  { label: string; badgeClass: string; textClass: string; dotClass: string; pulse?: boolean }
> = {
  ACTIVE: {
    label: 'ACTIVE',
    badgeClass: 'bg-emerald-500/10 border-emerald-400/30 text-emerald-700 dark:text-emerald-300 pulse-badge',
    textClass: 'text-emerald-700 dark:text-emerald-300',
    dotClass: 'bg-emerald-400',
    pulse: true,
  },
  VERIFYING: {
    label: 'VERIFYING',
    badgeClass: 'bg-amber-500/10 border-amber-400/30 text-amber-700 dark:text-amber-300',
    textClass: 'text-amber-700 dark:text-amber-300',
    dotClass: 'bg-amber-400',
  },
  INVALID: {
    label: 'INVALID',
    badgeClass: 'bg-rose-500/10 border-rose-400/30 text-rose-700 dark:text-rose-300',
    textClass: 'text-rose-700 dark:text-rose-300',
    dotClass: 'bg-rose-400',
  },
  REVOKED: {
    label: 'REVOKED',
    badgeClass: 'bg-[var(--muted)] border-[var(--border)] text-[var(--text-secondary)]',
    textClass: 'text-[var(--text-secondary)]',
    dotClass: 'bg-gray-500',
  },
};

const normalizeProviderKey = (raw: string) => {
  const normalized = raw.trim().toLowerCase();
  if (normalized === 'google') return 'GEMINI';
  if (normalized === 'claude') return 'ANTHROPIC';
  if (normalized === 'azure' || normalized === 'azure_openai' || normalized === 'azure-openai') return 'AZURE_OPENAI';
  return normalized.toUpperCase();
};

const providerToSlug = (provider: ProviderKey): string => {
  switch (provider) {
    case 'OPENAI':
      return 'openai';
    case 'GEMINI':
      return 'gemini';
    case 'ANTHROPIC':
      return 'anthropic';
    case 'AZURE_OPENAI':
      return 'azure_openai';
  }
  // Exhaustiveness guard
  throw new Error(`Unsupported provider: ${provider as never}`);
};

const resolveCredentialError = (error: unknown, fallback: string) => {
  if (!error) {
    return fallback;
  }
  const axiosError = error as AxiosError<{ message?: string }>;
  return axiosError.response?.data?.message || fallback;
};

const formatKoreanDate = (iso: string) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
};

function ProviderCard({
  orgId,
  provider,
  credential,
  onAdd,
  onUpdate,
  onReverify,
  onConfigureBudget,
  isReverifyPending,
}: {
  orgId: number;
  provider: ProviderKey;
  credential?: ProviderCredentialSummaryResponse;
  onAdd: () => void;
  onUpdate: () => void;
  onReverify: () => void;
  onConfigureBudget: () => void;
  isReverifyPending: boolean;
}) {
  const info = providerInfo[provider];

  const status = credential?.status || 'UNKNOWN';
  const meta = statusMeta[status] || {
    label: '미확인',
    badgeClass: 'bg-[var(--muted)] border-[var(--border)] text-[var(--text-secondary)]',
    textClass: 'text-[var(--text-secondary)]',
    dotClass: 'bg-gray-500',
  };
  const isConnected = status === 'ACTIVE';
  const isVerifying = status === 'VERIFYING';
  const isInvalid = status === 'INVALID';
  const isEnterpriseOnly = !!info.isEnterpriseOnly && !credential;
  const supportsBudget = provider !== 'AZURE_OPENAI';
  const providerSlug = providerToSlug(provider);

  const { data: budgetUsage } = useQuery({
    queryKey: ['budget-usage', 'provider', orgId, providerSlug],
    queryFn: async () => {
      const res = await budgetApi.getProviderUsage(orgId, providerSlug);
      return res.data;
    },
    enabled: supportsBudget && isConnected && !isEnterpriseOnly,
    retry: false,
  });

  const { data: budgetPolicy } = useQuery({
    queryKey: ['budget-policy', 'provider', orgId, providerSlug],
    queryFn: async () => {
      const res = await budgetApi.getProviderPolicy(orgId, providerSlug);
      return res.data;
    },
    enabled: supportsBudget && isConnected && !isEnterpriseOnly,
    retry: false,
  });

  const enabledBudget = !!budgetPolicy?.enabled;
  const usedUsd = budgetUsage?.usedUsd ?? null;
  const hardLimitUsd = budgetUsage?.hardLimitUsd ?? null;
  const remainingHardUsd = budgetUsage?.remainingHardUsd ?? null;
  const isHardExceeded = enabledBudget && hardLimitUsd != null && remainingHardUsd != null && remainingHardUsd <= 0;

  const formatUsd = (n: number | null | undefined) => {
    if (n == null || !Number.isFinite(n)) return '-';
    if (n >= 1) return `$${n.toFixed(2)}`;
    return `$${n.toFixed(4)}`;
  };

  return (
    <div
      className={[
        'glass-card rounded-2xl p-6 relative overflow-hidden',
        'border border-[var(--border)]',
        isConnected ? 'border-emerald-400/30' : 'hover:border-[var(--text-secondary)]/40',
        isEnterpriseOnly ? 'opacity-60 hover:opacity-100 border-dashed' : '',
      ].join(' ')}
    >
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-3">
          {info.iconNode}
          <div>
            <h3 className={`text-lg font-bold ${info.accentText}`}>{info.label}</h3>
            <p className="text-xs text-[var(--text-secondary)] font-medium">{info.subtitle}</p>
          </div>
        </div>

        {credential ? (
          <span
            className={[
              'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold tracking-wide border',
              meta.badgeClass,
            ].join(' ')}
          >
            <span className={`size-1.5 rounded-full ${meta.dotClass}`} />
            {meta.label}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium tracking-wide border bg-[var(--muted)] border-[var(--border)] text-[var(--text-secondary)]">
            미확인
          </span>
        )}
      </div>

       {credential ? (
         <div className="space-y-3">
           <div className="p-4 rounded-xl bg-[var(--muted)] border border-[var(--border)] backdrop-blur-sm">
             <p className="text-xs font-medium text-[var(--text-secondary)] mb-1">
               등록일
             </p>
             <p className="font-mono text-sm text-[var(--foreground)]">{formatKoreanDate(credential.createdAt)}</p>
           </div>

           {isConnected && (
             <div className="p-4 rounded-xl bg-[var(--muted)] border border-[var(--border)] backdrop-blur-sm">
               <div className="flex items-center justify-between mb-2">
                 <p className="text-xs font-medium text-[var(--text-secondary)]">이번 달 사용량</p>
                 <div className="flex items-center gap-2">
                   {enabledBudget ? (
                     <span
                       className={[
                         'px-2 py-0.5 rounded-full text-[10px] font-bold border',
                         isHardExceeded
                           ? 'bg-rose-500/15 border-rose-400/20 text-rose-700 dark:text-rose-200'
                           : 'bg-emerald-500/15 border-emerald-400/20 text-emerald-700 dark:text-emerald-200',
                       ].join(' ')}
                     >
                       {isHardExceeded ? 'BLOCK' : 'ON'}
                     </span>
                   ) : (
                     <span className="px-2 py-0.5 rounded-full text-[10px] font-bold border bg-[var(--card)] border-[var(--border)] text-[var(--text-secondary)]">
                       OFF
                     </span>
                   )}
                   <button
                     type="button"
                     onClick={onConfigureBudget}
                     disabled={!supportsBudget}
                     className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-[var(--card)] hover:bg-[var(--accent)] text-[var(--text-secondary)] transition-colors border border-[var(--border)]"
                   >
                     예산 설정
                   </button>
                 </div>
               </div>
               <div className="flex items-baseline justify-between">
                 <p className="font-mono text-sm text-[var(--foreground)]">{formatUsd(usedUsd)}</p>
                 <p className="text-[11px] font-mono text-[var(--text-secondary)]">
                   {hardLimitUsd != null ? `${formatUsd(usedUsd)} / ${formatUsd(hardLimitUsd)}` : `${formatUsd(usedUsd)} / -`}
                 </p>
               </div>
               {enabledBudget && isHardExceeded ? (
                 <p className="mt-2 text-[11px] text-rose-800 dark:text-rose-200">
                   Hard-limit을 초과했습니다. 이 Provider 키로 나가는 호출이 차단됩니다.
                 </p>
               ) : null}
             </div>
           )}

           {isInvalid && (
             <p className="text-xs text-rose-700 dark:text-rose-300 flex items-center gap-1.5">
               <span className="material-symbols-outlined text-sm">error</span>
               API 키 인증에 실패했습니다. 키를 업데이트하거나 재검증해 주세요.
             </p>
           )}

           <div className="flex gap-2">
             <button
               onClick={onUpdate}
               className="flex-1 py-3 rounded-xl border border-[var(--border)] text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--accent)] hover:text-[var(--foreground)] transition-all flex items-center justify-center gap-2"
             >
               <span className="material-symbols-outlined text-lg">refresh</span>
               키 업데이트
             </button>
            {(isInvalid || isVerifying) && (
              <button
                onClick={onReverify}
                disabled={isVerifying || isReverifyPending}
                className="flex-1 py-3 rounded-xl border border-[var(--border)] text-sm font-medium text-[var(--primary)] hover:bg-[var(--accent)] hover:border-[color:rgba(168,85,247,0.25)] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-lg">sync</span>
                {isVerifying || isReverifyPending ? '검증 중...' : '재검증'}
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {isEnterpriseOnly ? (
            <div className="flex items-center justify-center h-24">
              <span className="text-sm text-[var(--text-tertiary)] group-hover:text-[var(--text-secondary)] transition-colors flex items-center gap-2">
                <span className="material-symbols-outlined text-lg">lock</span>
                Contact Sales
              </span>
            </div>
          ) : (
            <>
              <p className="text-sm text-[var(--text-secondary)] leading-relaxed min-h-[40px]">
                {info.label} 모델을 사용하려면 API 키를 등록하세요.
              </p>
              <button
                onClick={onAdd}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-[var(--primary)] to-fuchsia-500 text-white text-sm font-bold shadow-[0_0_20px_rgba(168,85,247,0.30)] hover:shadow-[0_0_30px_rgba(168,85,247,0.50)] hover:scale-[1.02] transition-all duration-300 flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-lg">add</span>
                API 키 등록
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function AddProviderModal({
  isOpen,
  onClose,
  provider,
  onSuccessMessage,
}: {
  isOpen: boolean;
  onClose: () => void;
  provider: ProviderKey | null;
  onSuccessMessage: (message: string) => void;
}) {
  const [apiKey, setApiKey] = useState('');
  const [updateError, setUpdateError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { currentOrgId } = useOrganizationStore();

  const handleClose = () => {
    setUpdateError(null);
    setApiKey('');
    onClose();
  };

  const createMutation = useMutation({
    mutationFn: () => {
      if (!currentOrgId) throw new Error("No organization selected");
      return organizationApi.createCredential(currentOrgId, {
        provider: provider!,
        apiKey,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['provider-credentials', currentOrgId] });
      setUpdateError(null);
      setApiKey('');
      onSuccessMessage('검증이 시작되었습니다. 잠시 후 상태가 갱신됩니다.');
      onClose();
    },
    onError: (error) => {
      setUpdateError(resolveCredentialError(error, 'API 키 검증에 실패했습니다.'));
    },
  });

  if (!isOpen || !provider) return null;

  const info = providerInfo[provider] ?? { label: provider, subtitle: '', accentText: 'text-[var(--foreground)]', iconNode: null };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={handleClose}
      />
      <div className="relative w-full max-w-md mx-4 rounded-2xl border border-[var(--border)] bg-[var(--card)] backdrop-blur-xl shadow-xl overflow-hidden">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 flex items-center justify-center bg-[var(--muted)] text-[var(--primary)] rounded-xl shrink-0 border border-[var(--border)]">
            <span className="material-symbols-outlined text-2xl">vpn_key</span>
          </div>
          <div>
            <h3 className="text-lg font-bold text-[var(--foreground)]">
              {info.label} 연결
            </h3>
            <p className="text-sm text-[var(--text-secondary)]">
              API 키를 안전하게 암호화하여 저장합니다.
            </p>
          </div>
        </div>

        <div className="mb-6">
          <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-2">
            API Key
          </label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => {
              setApiKey(e.target.value);
              if (updateError) setUpdateError(null);
            }}
            placeholder={`sk-... (${info.label} API Key)`}
            className="w-full px-4 py-3 text-sm text-[var(--foreground)] bg-[var(--muted)] border border-[var(--border)] rounded-xl focus:ring-2 focus:ring-[color:rgba(168,85,247,0.45)] focus:border-[color:rgba(168,85,247,0.35)] outline-none transition-all font-mono placeholder:text-[var(--text-tertiary)]"
            autoFocus
          />
          <p className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)] mt-2">
            <span className="material-symbols-outlined text-sm">lock</span>
            키는 서버에 암호화되어 저장되며 클라이언트에 노출되지 않습니다.
          </p>
          {updateError && (
            <p className="mt-2 text-xs text-rose-300">{updateError}</p>
          )}
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleClose}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-[var(--text-secondary)] bg-[var(--muted)] border border-[var(--border)] rounded-xl hover:bg-[var(--accent)] transition-colors"
          >
            취소
          </button>
          <button
            onClick={() => createMutation.mutate()}
            disabled={!apiKey.trim() || createMutation.isPending}
            className="flex-1 px-4 py-2.5 text-sm font-bold text-white bg-[var(--primary)] rounded-xl hover:bg-[var(--primary-hover)] transition-colors disabled:opacity-50 shadow-[0_0_20px_rgba(168,85,247,0.25)]"
          >
            {createMutation.isPending ? '검증 중...' : '연결 및 검증'}
          </button>
        </div>
      </div>
    </div>
  );
}

function UpdateProviderModal({
  isOpen,
  onClose,
  credential,
  onSuccessMessage,
}: {
  isOpen: boolean;
  onClose: () => void;
  credential: ProviderCredentialSummaryResponse | null;
  onSuccessMessage: (message: string) => void;
}) {
  const [apiKey, setApiKey] = useState('');
  const [updateError, setUpdateError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { currentOrgId } = useOrganizationStore();

  const handleClose = () => {
    setUpdateError(null);
    setApiKey('');
    onClose();
  };

  const updateMutation = useMutation({
    mutationFn: () => {
      if (!currentOrgId || !credential) throw new Error('No organization selected');
      return organizationApi.updateCredential(currentOrgId, credential.credentialId, { apiKey });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['provider-credentials', currentOrgId] });
      setUpdateError(null);
      setApiKey('');
      onSuccessMessage('검증이 시작되었습니다. 잠시 후 상태가 갱신됩니다.');
      onClose();
    },
    onError: (error) => {
      setUpdateError(resolveCredentialError(error, 'API 키 검증에 실패했습니다.'));
    },
  });

  if (!isOpen || !credential) return null;

  const normalizedKey = normalizeProviderKey(credential.provider) as ProviderKey;
  const info = providerInfo[normalizedKey] ?? {
    label: credential.provider,
    subtitle: '',
    accentText: 'text-[var(--foreground)]',
    iconNode: null,
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={handleClose}
      />
      <div className="relative w-full max-w-md mx-4 rounded-2xl border border-[var(--border)] bg-[var(--card)] backdrop-blur-xl shadow-xl overflow-hidden">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 flex items-center justify-center bg-[var(--muted)] text-[var(--primary)] rounded-xl shrink-0 border border-[var(--border)]">
            <span className="material-symbols-outlined text-2xl">vpn_key</span>
          </div>
          <div>
            <h3 className="text-lg font-bold text-[var(--foreground)]">
              {info.label} 키 업데이트
            </h3>
            <p className="text-sm text-[var(--text-secondary)]">
              기존 키를 새 키로 교체합니다.
            </p>
          </div>
        </div>

        <div className="mb-6">
          <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-2">
            새 API Key
          </label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => {
              setApiKey(e.target.value);
              if (updateError) setUpdateError(null);
            }}
            placeholder={`sk-... (${info.label} API Key)`}
            className="w-full px-4 py-3 text-sm text-[var(--foreground)] bg-[var(--muted)] border border-[var(--border)] rounded-xl focus:ring-2 focus:ring-[color:rgba(168,85,247,0.45)] focus:border-[color:rgba(168,85,247,0.35)] outline-none transition-all font-mono placeholder:text-[var(--text-tertiary)]"
            autoFocus
          />
          <p className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)] mt-2">
            <span className="material-symbols-outlined text-sm">lock</span>
            키는 서버에 암호화되어 저장되며 클라이언트에 노출되지 않습니다.
          </p>
          {updateError && (
            <p className="mt-2 text-xs text-rose-300">{updateError}</p>
          )}
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleClose}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-[var(--text-secondary)] bg-[var(--muted)] border border-[var(--border)] rounded-xl hover:bg-[var(--accent)] transition-colors"
          >
            취소
          </button>
          <button
            onClick={() => updateMutation.mutate()}
            disabled={!apiKey.trim() || updateMutation.isPending}
            className="flex-1 px-4 py-2.5 text-sm font-bold text-white bg-[var(--primary)] rounded-xl hover:bg-[var(--primary-hover)] transition-colors disabled:opacity-50 shadow-[0_0_20px_rgba(168,85,247,0.25)]"
          >
            {updateMutation.isPending ? '검증 중...' : '업데이트 및 검증'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function SettingsProviderKeysPage() {
   const [addingProvider, setAddingProvider] = useState<ProviderKey | null>(null);
   const [updatingCredential, setUpdatingCredential] = useState<ProviderCredentialSummaryResponse | null>(null);
   const [budgetProvider, setBudgetProvider] = useState<ProviderKey | null>(null);
   const [toastMessage, setToastMessage] = useState<string | null>(null);
   const [toastType, setToastType] = useState<'success' | 'error'>('success');
   const toastTimerRef = useRef<number | null>(null);
   const { currentOrgId } = useOrganizationStore();
   const queryClient = useQueryClient();

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
    setToastMessage(message);
    setToastType(type);
    toastTimerRef.current = window.setTimeout(() => {
      setToastMessage(null);
      toastTimerRef.current = null;
    }, 2000);
  };

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  const { data: credentials, isLoading } = useQuery({
    queryKey: ['provider-credentials', currentOrgId],
    queryFn: async () => {
      if (!currentOrgId) return [];
      const response = await organizationApi.getCredentials(currentOrgId);
      const payload = response.data as
        | ProviderCredentialSummaryResponse[]
        | { data?: ProviderCredentialSummaryResponse[] };
      if (Array.isArray(payload)) {
        return payload;
      }
      return payload?.data ?? [];
    },
    enabled: !!currentOrgId,
    refetchInterval: (query) => {
      const data = query.state.data;
      return Array.isArray(data) && data.some((cred: ProviderCredentialSummaryResponse) => cred.status === 'VERIFYING')
        ? 5000
        : false;
    },
  });

  const reverifyMutation = useMutation({
    mutationFn: async (credentialId: number) => {
      if (!currentOrgId) throw new Error('No organization selected');
      return organizationApi.verifyCredential(currentOrgId, credentialId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['provider-credentials', currentOrgId] });
      showToast('재검증이 시작되었습니다.');
    },
    onError: (error) => {
      showToast(resolveCredentialError(error, '재검증 요청에 실패했습니다.'), 'error');
    },
  });

  const credentialMap = (credentials || []).reduce((acc, cred) => {
    const key = normalizeProviderKey(cred.provider);
    acc[key] = cred;
    return acc;
  }, {} as Record<string, ProviderCredentialSummaryResponse>);

  const budgetProviderSlug = budgetProvider ? providerToSlug(budgetProvider) : '';

  const { data: providerBudgetPolicyForModal } = useQuery({
    queryKey: ['budget-policy', 'provider', currentOrgId, budgetProviderSlug, 'modal'],
    queryFn: async () => {
      if (!currentOrgId || !budgetProviderSlug) return null;
      const res = await budgetApi.getProviderPolicy(currentOrgId, budgetProviderSlug);
      return res.data;
    },
    enabled: !!currentOrgId && !!budgetProviderSlug,
    retry: false,
  });

  const updateProviderBudgetPolicyMutation = useMutation({
    mutationFn: async (payload: BudgetPolicyUpdateRequest) => {
      if (!currentOrgId || !budgetProviderSlug) throw new Error('No organization/provider selected');
      const res = await budgetApi.updateProviderPolicy(currentOrgId, budgetProviderSlug, payload);
      return res.data;
    },
    onSuccess: async () => {
      if (!currentOrgId || !budgetProviderSlug) return;
      await queryClient.invalidateQueries({ queryKey: ['budget-policy', 'provider', currentOrgId, budgetProviderSlug] });
      await queryClient.invalidateQueries({ queryKey: ['budget-usage', 'provider', currentOrgId, budgetProviderSlug] });
      await queryClient.invalidateQueries({ queryKey: ['budget-policy', 'provider', currentOrgId, budgetProviderSlug, 'modal'] });
      showToast('예산 설정이 저장되었습니다.');
      setBudgetProvider(null);
    },
    onError: () => {
      showToast('예산 설정 저장에 실패했습니다.', 'error');
    },
  });

  if (!currentOrgId) {
    return (
      <div className="glass-card rounded-2xl p-6 text-sm text-[var(--text-secondary)] border border-[var(--border)]">
        조직을 선택해주세요.
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <BudgetPolicyModal
        open={!!budgetProvider}
        mode="PROVIDER"
        title={`${budgetProvider ? providerInfo[budgetProvider]?.label ?? budgetProvider : 'Provider'} 예산`}
        description="Hard-limit 초과 시 해당 Provider 키로 나가는 호출이 차단됩니다."
        policy={providerBudgetPolicyForModal ?? null}
        onClose={() => setBudgetProvider(null)}
        onSave={(payload) => updateProviderBudgetPolicyMutation.mutate(payload)}
        isSaving={updateProviderBudgetPolicyMutation.isPending}
      />

      {toastMessage && (
        <div
          className={[
            'fixed top-6 right-6 z-50 rounded-xl px-4 py-3 text-sm font-medium shadow-lg backdrop-blur-xl border',
            toastType === 'error'
              ? 'bg-rose-500/15 border-rose-400/20 text-rose-800 dark:text-rose-200'
              : 'bg-emerald-500/15 border-emerald-400/20 text-emerald-800 dark:text-emerald-200',
          ].join(' ')}
        >
          {toastMessage}
        </div>
      )}

      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-[var(--foreground)] tracking-tight">
            Provider 키
          </h1>
          <p className="text-[var(--text-secondary)] max-w-2xl">
            LLM 제공업체(OpenAI, Anthropic 등)의 API 키를 등록하여 Dynamic Auth 서비스를 연동합니다.
          </p>
        </div>
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--primary)]/10 border border-[var(--primary)]/20 text-xs text-[var(--primary)] font-medium">
          <span className="material-symbols-outlined text-sm">lock</span>
          AES-256 Encrypted
        </div>
      </div>

      <div className="glass-card rounded-2xl p-6 flex flex-col md:flex-row gap-6 items-start md:items-center relative overflow-hidden border border-[var(--border)]">
        <div className="absolute -left-10 -top-10 w-40 h-40 bg-[var(--primary)]/20 rounded-full blur-[60px] pointer-events-none" />
        <div className="relative size-14 rounded-2xl bg-[var(--muted)] border border-[var(--border)] flex items-center justify-center flex-shrink-0 backdrop-blur-md shadow-inner">
          <span className="material-symbols-outlined text-[var(--primary)] text-3xl drop-shadow-[0_0_10px_rgba(168,85,247,0.5)]">
            key_vertical
          </span>
        </div>
        <div className="flex-1 z-10">
          <h3 className="text-lg font-bold text-[var(--foreground)] mb-1">BYOK (Bring Your Own Key) 정책</h3>
          <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
            LuminaOps는 사용자의 API 키를 중계하는 역할만 수행합니다. 모든 키는{' '}
            <span className="text-[var(--primary)] font-medium">Tenant Isolation</span> 원칙에 따라 암호화되어 각 LLM 제공자에게 직접 전송되며,
            저장된 키는 누구도 열람할 수 없습니다.
          </p>
        </div>
        <a
          className="text-sm font-medium text-[var(--primary)] hover:text-[var(--foreground)] flex items-center gap-1 transition-colors z-10 whitespace-nowrap"
          href="#"
        >
          보안 백서 보기 <span className="material-symbols-outlined text-base">arrow_forward</span>
        </a>
      </div>

      {isLoading ? (
        <div className="py-12 text-center text-sm text-[var(--text-secondary)]">
          Provider 목록을 불러오는 중...
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {providers.map((provider) => (
            <ProviderCard
              key={provider}
              orgId={currentOrgId}
              provider={provider}
              credential={credentialMap[provider]}
              onAdd={() => setAddingProvider(provider)}
              onUpdate={() => setUpdatingCredential(credentialMap[provider] ?? null)}
              onReverify={() => {
                const credentialId = credentialMap[provider]?.credentialId;
                if (credentialId) {
                  reverifyMutation.mutate(credentialId);
                }
              }}
              onConfigureBudget={() => {
                if (provider === 'AZURE_OPENAI') {
                  showToast('Azure OpenAI는 현재 예산 가드레일을 지원하지 않습니다.');
                  return;
                }
                setBudgetProvider(provider);
              }}
              isReverifyPending={reverifyMutation.isPending}
            />
          ))}
        </div>
      )}

      <div className="mt-8 pt-8 border-t border-[var(--border)] flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          <span>{(credentials || []).filter(c => c.status === 'ACTIVE').length}개 연결됨</span>
        </div>
      </div>

      <AddProviderModal
        isOpen={!!addingProvider}
        onClose={() => setAddingProvider(null)}
        provider={addingProvider}
        onSuccessMessage={showToast}
      />
      <UpdateProviderModal
        isOpen={!!updatingCredential}
        onClose={() => setUpdatingCredential(null)}
        credential={updatingCredential}
        onSuccessMessage={showToast}
      />
    </div>
  );
}
