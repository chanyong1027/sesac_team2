import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { organizationApi } from '@/api/organization.api';
import type { ProviderCredentialSummaryResponse } from '@/types/api.types';

// ═══════════════════════════════════════════════════════════════════════════════
// PROVIDER KEYS SETTINGS PAGE - Light Theme
// ═══════════════════════════════════════════════════════════════════════════════

// TODO: 실제 orgId는 context나 URL에서 가져와야 함
const MOCK_ORG_ID = 1;

const providerInfo: Record<string, { name: string; color: string; bgColor: string; icon: string }> = {
  OPENAI: {
    name: 'OpenAI',
    color: '#000000',
    bgColor: '#F5F5F5',
    icon: '◆',
  },
  ANTHROPIC: {
    name: 'Anthropic',
    color: '#D4A574',
    bgColor: '#FEF7ED',
    icon: '◇',
  },
  GOOGLE: {
    name: 'Google AI',
    color: '#4285F4',
    bgColor: '#EBF3FE',
    icon: '◈',
  },
  GEMINI: {
    name: 'Gemini',
    color: '#8B5CF6',
    bgColor: '#F3E8FF',
    icon: '✦',
  },
};

const providers = ['OPENAI', 'ANTHROPIC', 'GOOGLE', 'GEMINI'];

function ProviderCard({
  provider,
  credential,
  onAdd,
}: {
  provider: string;
  credential?: ProviderCredentialSummaryResponse;
  onAdd: () => void;
}) {
  const info = providerInfo[provider] || {
    name: provider,
    color: '#525252',
    bgColor: '#F5F5F5',
    icon: '○',
  };

  const isConnected = !!credential;

  return (
    <div
      className="p-5 transition-all hover:shadow-sm"
      style={{
        background: '#FFFFFF',
        border: '1px solid #E5E5E5',
      }}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 flex items-center justify-center text-lg"
            style={{ background: info.bgColor, color: info.color }}
          >
            {info.icon}
          </div>
          <div>
            <h3 className="text-sm font-medium text-neutral-900">
              {info.name}
            </h3>
            <p className="text-[11px] text-neutral-400">
              {isConnected ? '연결됨' : '연결되지 않음'}
            </p>
          </div>
        </div>

        {isConnected ? (
          <span
            className="px-2 py-0.5 text-[10px] uppercase tracking-wider font-medium"
            style={{
              background: '#D1FAE5',
              color: '#065F46',
            }}
          >
            활성
          </span>
        ) : null}
      </div>

      {isConnected ? (
        <div className="space-y-3">
          <div
            className="p-3"
            style={{ background: '#FAFAFA', border: '1px solid #F5F5F5' }}
          >
            <p className="text-[10px] uppercase tracking-wider text-neutral-400 mb-1">
              등록일
            </p>
            <p className="text-xs text-neutral-600">
              {new Date(credential.createdAt).toLocaleDateString('ko-KR', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </p>
          </div>
          <button
            className="w-full py-2 text-xs text-neutral-500 hover:text-neutral-700 hover:bg-neutral-50 transition-colors"
            style={{ border: '1px solid #E5E5E5' }}
          >
            키 업데이트
          </button>
        </div>
      ) : (
        <button
          onClick={onAdd}
          className="w-full py-2.5 text-xs font-medium text-white transition-colors hover:opacity-90"
          style={{ background: '#0D9488' }}
        >
          + API 키 등록
        </button>
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
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: () =>
      organizationApi.createCredential(MOCK_ORG_ID, {
        provider: provider!,
        apiKey,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['provider-credentials'] });
      setApiKey('');
      onClose();
    },
  });

  if (!isOpen || !provider) return null;

  const info = providerInfo[provider];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/20 backdrop-blur-sm"
        onClick={onClose}
      />

      <div
        className="relative w-full max-w-md mx-4 p-6"
        style={{
          background: '#FFFFFF',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.15)',
        }}
      >
        <div className="flex items-center gap-3 mb-6">
          <div
            className="w-10 h-10 flex items-center justify-center text-lg"
            style={{ background: info.bgColor, color: info.color }}
          >
            {info.icon}
          </div>
          <div>
            <h3
              className="text-lg font-medium text-neutral-900"
              style={{ fontFamily: "'Newsreader', serif" }}
            >
              {info.name} 연결
            </h3>
            <p className="text-xs text-neutral-500">
              API 키를 입력하여 연결하세요
            </p>
          </div>
        </div>

        <div className="mb-6">
          <label className="block text-[10px] uppercase tracking-wider text-neutral-500 mb-2">
            API 키
          </label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={`${info.name} API 키를 입력하세요`}
            className="w-full px-3 py-2.5 text-sm text-neutral-900 placeholder-neutral-300 focus:outline-none transition-colors"
            style={{
              background: '#FAFAFA',
              border: '1px solid #E5E5E5',
              fontFamily: "'IBM Plex Mono', monospace",
            }}
          />
          <p className="text-[11px] text-neutral-400 mt-2">
            키는 암호화되어 안전하게 저장됩니다
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 text-xs font-medium text-neutral-600 bg-neutral-100 hover:bg-neutral-200 transition-colors"
          >
            취소
          </button>
          <button
            onClick={() => createMutation.mutate()}
            disabled={!apiKey.trim() || createMutation.isPending}
            className="flex-1 px-4 py-2.5 text-xs font-medium text-white transition-colors disabled:opacity-50"
            style={{ background: '#0D9488' }}
          >
            {createMutation.isPending ? '연결 중...' : '연결'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function SettingsProviderKeysPage() {
  const [addingProvider, setAddingProvider] = useState<string | null>(null);

  // Provider 자격증명 목록 조회
  const { data: credentials, isLoading } = useQuery({
    queryKey: ['provider-credentials', MOCK_ORG_ID],
    queryFn: async () => {
      const response = await organizationApi.getCredentials(MOCK_ORG_ID);
      return response.data;
    },
  });

  // Provider별 credential 매핑
  const credentialMap = (credentials || []).reduce((acc, cred) => {
    acc[cred.provider] = cred;
    return acc;
  }, {} as Record<string, ProviderCredentialSummaryResponse>);

  return (
    <div>
      {/* Page Header */}
      <div className="mb-8">
        <h1
          className="text-2xl font-medium text-neutral-900 tracking-tight"
          style={{ fontFamily: "'Newsreader', serif" }}
        >
          Provider 키
        </h1>
        <p className="text-sm text-neutral-500 mt-1">
          LLM 제공업체의 API 키를 등록하여 서비스를 연동합니다
        </p>
      </div>

      {/* BYOK Info */}
      <div
        className="p-4 mb-6 flex items-start gap-3"
        style={{
          background: '#F0FDFA',
          border: '1px solid #99F6E4',
        }}
      >
        <span className="text-teal-600 text-sm">◈</span>
        <div>
          <p className="text-xs text-teal-800 font-medium mb-0.5">
            BYOK (Bring Your Own Key)
          </p>
          <p className="text-[11px] text-teal-600">
            자체 API 키를 사용하여 비용을 직접 관리하고, 사용량을 투명하게 확인할 수 있습니다.
          </p>
        </div>
      </div>

      {/* Provider Grid */}
      {isLoading ? (
        <div className="py-12 text-center">
          <p className="text-sm text-neutral-400">Provider 목록을 불러오는 중...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {providers.map((provider) => (
            <ProviderCard
              key={provider}
              provider={provider}
              credential={credentialMap[provider]}
              onAdd={() => setAddingProvider(provider)}
            />
          ))}
        </div>
      )}

      {/* Stats */}
      <div
        className="mt-8 p-5"
        style={{
          background: '#FFFFFF',
          border: '1px solid #E5E5E5',
        }}
      >
        <p className="text-[10px] uppercase tracking-wider text-neutral-400 mb-4">
          연결 현황
        </p>
        <div className="flex items-center gap-8">
          <div>
            <p
              className="text-3xl font-light"
              style={{
                fontFamily: "'Newsreader', serif",
                color: '#0D9488',
              }}
            >
              {Object.keys(credentialMap).length}
            </p>
            <p className="text-xs text-neutral-500 mt-0.5">연결된 Provider</p>
          </div>
          <div className="h-12 w-px bg-neutral-200" />
          <div>
            <p
              className="text-3xl font-light text-neutral-900"
              style={{ fontFamily: "'Newsreader', serif" }}
            >
              {providers.length - Object.keys(credentialMap).length}
            </p>
            <p className="text-xs text-neutral-500 mt-0.5">미연결</p>
          </div>
        </div>
      </div>

      {/* Add Provider Modal */}
      <AddProviderModal
        isOpen={!!addingProvider}
        onClose={() => setAddingProvider(null)}
        provider={addingProvider}
      />
    </div>
  );
}
