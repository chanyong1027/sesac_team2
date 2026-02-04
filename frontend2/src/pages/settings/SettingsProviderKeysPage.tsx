import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { organizationApi } from '@/api/organization.api';
import { useOrganizationStore } from '@/features/organization/store/organizationStore';
import type { ProviderCredentialSummaryResponse } from '@/types/api.types';
import { Shield, Check, Terminal, ExternalLink, Plus } from 'lucide-react';

const providerInfo: Record<string, { name: string; color: string; bgColor: string; borderColor: string; icon: string }> = {
  OPENAI: {
    name: 'OpenAI',
    color: '#000000',
    bgColor: '#FFFFFF',
    borderColor: '#E5E5E5',
    icon: 'text-gray-900',
  },
  ANTHROPIC: {
    name: 'Anthropic',
    color: '#D4A574',
    bgColor: '#FFFBF5',
    borderColor: '#E8DCCB',
    icon: 'text-amber-700',
  },
  GEMINI: {
    name: 'Gemini',
    color: '#8B5CF6',
    bgColor: '#F5F3FF',
    borderColor: '#DDD6FE',
    icon: 'text-purple-600',
  },
};

const providers = ['OPENAI', 'ANTHROPIC', 'GEMINI'];

const normalizeProviderKey = (raw: string) => {
  const normalized = raw.trim().toLowerCase();
  if (normalized === 'google') return 'GEMINI';
  if (normalized === 'claude') return 'ANTHROPIC';
  return normalized.toUpperCase();
};

function ProviderCard({
  provider,
  credential,
  onAdd,
  onUpdate,
}: {
  provider: string;
  credential?: ProviderCredentialSummaryResponse;
  onAdd: () => void;
  onUpdate: () => void;
}) {
  const info = providerInfo[provider] || {
    name: provider,
    color: '#525252',
    bgColor: '#FFFFFF',
    borderColor: '#E5E5E5',
    icon: 'text-gray-500',
  };

  const isConnected = !!credential;

  return (
    <div
      className={`p-6 rounded-xl border transition-all ${isConnected ? 'shadow-sm' : 'hover:shadow-md hover:border-indigo-200'
        }`}
      style={{
        background: info.bgColor,
        borderColor: isConnected ? '#10B981' : info.borderColor,
      }}
    >
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 rounded-lg flex items-center justify-center bg-white shadow-sm border border-gray-100`}>
            <span className={`text-xl font-bold ${info.icon}`}>{info.name.charAt(0)}</span>
          </div>
          <div>
            <h3 className="text-base font-bold text-gray-900">
              {info.name}
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              {isConnected ? '연결 완료' : '미연결'}
            </p>
          </div>
        </div>

        {isConnected && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full bg-green-100 text-green-700">
            <Check size={12} />
            Active
          </span>
        )}
      </div>

      {isConnected ? (
        <div className="space-y-3">
          <div className="p-3 bg-white/50 border border-black/5 rounded-lg">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
              등록일
            </p>
            <p className="text-sm font-medium text-gray-900">
              {new Date(credential.createdAt).toLocaleDateString('ko-KR', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </p>
          </div>
          <button
            onClick={onUpdate}
            className="w-full py-2.5 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 hover:text-gray-900 transition-colors"
          >
            키 업데이트
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-gray-500 leading-relaxed min-h-[40px]">
            {info.name} 모델을 사용하려면 API 키를 등록하세요.
          </p>
          <button
            onClick={onAdd}
            className="w-full py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors shadow-sm flex items-center justify-center gap-2"
          >
            <Plus size={16} />
            API 키 등록
          </button>
        </div>
      )}
    </div>
  );
}

function AddProviderModal({
  isOpen,
  onClose,
  provider,
}: {
  isOpen: boolean;
  onClose: () => void;
  provider: string | null;
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
      setApiKey('');
      onClose();
    },
  });

  if (!isOpen || !provider) return null;

  const info = providerInfo[provider];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-md mx-4 p-6 bg-white rounded-xl shadow-xl border border-gray-100">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 flex items-center justify-center bg-indigo-50 text-indigo-600 rounded-lg shrink-0">
            <Shield size={24} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900">
              {info?.name} 연결
            </h3>
            <p className="text-sm text-gray-500">
              API 키를 안전하게 암호화하여 저장합니다.
            </p>
          </div>
        </div>

        <div className="mb-6">
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            API Key
          </label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={`sk-... (${info?.name} API Key)`}
            className="w-full px-4 py-3 text-sm text-gray-900 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all font-mono"
            autoFocus
          />
          <p className="flex items-center gap-1.5 text-xs text-gray-500 mt-2">
            <Shield size={12} />
            키는 서버에 암호화되어 저장되며 클라이언트에 노출되지 않습니다.
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            취소
          </button>
          <button
            onClick={() => createMutation.mutate()}
            disabled={!apiKey.trim() || createMutation.isPending}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 shadow-sm"
          >
            {createMutation.isPending ? '연결 중...' : '연결하기'}
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
}: {
  isOpen: boolean;
  onClose: () => void;
  credential: ProviderCredentialSummaryResponse | null;
}) {
  const [apiKey, setApiKey] = useState('');
  const queryClient = useQueryClient();
  const { currentOrgId } = useOrganizationStore();

  const updateMutation = useMutation({
    mutationFn: () => {
      if (!currentOrgId || !credential) throw new Error('No organization selected');
      return organizationApi.updateCredential(currentOrgId, credential.credentialId, { apiKey });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['provider-credentials', currentOrgId] });
      setUpdateError(null);
      setApiKey('');
      onClose();
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : 'API 키 업데이트에 실패했습니다.';
      setUpdateError(message);
    },
  });

  if (!isOpen || !credential) return null;

  const info = providerInfo[normalizeProviderKey(credential.provider)];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={handleClose}
      />
      <div className="relative w-full max-w-md mx-4 p-6 bg-white rounded-xl shadow-xl border border-gray-100">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 flex items-center justify-center bg-indigo-50 text-indigo-600 rounded-lg shrink-0">
            <Shield size={24} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900">
              {info?.name} 키 업데이트
            </h3>
            <p className="text-sm text-gray-500">
              기존 키를 새 키로 교체합니다.
            </p>
          </div>
        </div>

        <div className="mb-6">
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            새 API Key
          </label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => {
              setApiKey(e.target.value);
              if (updateError) setUpdateError(null);
            }}
            placeholder={`sk-... (${info?.name} API Key)`}
            className="w-full px-4 py-3 text-sm text-gray-900 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all font-mono"
            autoFocus
          />
          <p className="flex items-center gap-1.5 text-xs text-gray-500 mt-2">
            <Shield size={12} />
            키는 서버에 암호화되어 저장되며 클라이언트에 노출되지 않습니다.
          </p>
          {updateError && (
            <p className="mt-2 text-xs text-rose-600">{updateError}</p>
          )}
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleClose}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            취소
          </button>
          <button
            onClick={() => updateMutation.mutate()}
            disabled={!apiKey.trim() || updateMutation.isPending}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 shadow-sm"
          >
            {updateMutation.isPending ? '업데이트 중...' : '업데이트'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function SettingsProviderKeysPage() {
  const [addingProvider, setAddingProvider] = useState<string | null>(null);
  const [updatingCredential, setUpdatingCredential] = useState<ProviderCredentialSummaryResponse | null>(null);
  const { currentOrgId } = useOrganizationStore();

  const { data: credentials, isLoading } = useQuery({
    queryKey: ['provider-credentials', currentOrgId],
    queryFn: async () => {
      if (!currentOrgId) return [];
      const response = await organizationApi.getCredentials(currentOrgId);
      return response.data;
    },
    enabled: !!currentOrgId,
  });

  const credentialMap = (credentials || []).reduce((acc, cred) => {
    const key = normalizeProviderKey(cred.provider);
    acc[key] = cred;
    return acc;
  }, {} as Record<string, ProviderCredentialSummaryResponse>);

  if (!currentOrgId) return <div>조직을 선택해주세요.</div>;

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
          Provider 키
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          LLM 제공업체(OpenAI, Anthropic 등)의 API 키를 등록하여 서비스를 연동합니다.
        </p>
      </div>

      <div className="p-5 mb-8 flex items-start gap-4 bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-100 rounded-xl">
        <div className="p-2 bg-white rounded-lg shadow-sm text-indigo-600">
          <Terminal size={20} />
        </div>
        <div>
          <p className="text-sm font-bold text-indigo-900 mb-1">
            BYOK (Bring Your Own Key)
          </p>
          <p className="text-xs text-indigo-700 leading-relaxed max-w-2xl">
            LuminaOps는 사용자의 API 키를 중계하는 역할만 수행합니다.
            모든 요청은 등록된 키를 사용하여 각 LLM 제공자에게 직접 전송되므로,
            비용과 사용량을 각 제공자 대시보드에서 투명하게 관리할 수 있습니다.
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="py-12 text-center text-sm text-gray-500">
          Provider 목록을 불러오는 중...
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {providers.map((provider) => (
            <ProviderCard
              key={provider}
              provider={provider}
              credential={credentialMap[provider]}
              onAdd={() => setAddingProvider(provider)}
              onUpdate={() => setUpdatingCredential(credentialMap[provider] ?? null)}
            />
          ))}
        </div>
      )}

      <div className="mt-8 pt-8 border-t border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <span className="w-2 h-2 rounded-full bg-green-500"></span>
          <span>{Object.keys(credentialMap).length}개 연결됨</span>
        </div>
        <a href="#" className="hidden text-xs text-indigo-600 hover:underline flex items-center gap-1">
          지원하는 모델 목록 보기 <ExternalLink size={10} />
        </a>
      </div>

      <AddProviderModal
        isOpen={!!addingProvider}
        onClose={() => setAddingProvider(null)}
        provider={addingProvider}
      />
      <UpdateProviderModal
        isOpen={!!updatingCredential}
        onClose={() => setUpdatingCredential(null)}
        credential={updatingCredential}
      />
    </div>
  );
}
