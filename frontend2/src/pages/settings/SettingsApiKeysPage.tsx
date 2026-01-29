import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { organizationApi } from '@/api/organization.api';
import type { OrganizationApiKeySummaryResponse } from '@/types/api.types';

// ═══════════════════════════════════════════════════════════════════════════════
// API KEYS SETTINGS PAGE - Light Theme
// ═══════════════════════════════════════════════════════════════════════════════

// TODO: 실제 orgId는 context나 URL에서 가져와야 함
const MOCK_ORG_ID = 1;

function StatusBadge({ status }: { status: string }) {
  const isActive = status === 'ACTIVE';
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[10px] uppercase tracking-wider font-medium"
      style={{
        background: isActive ? '#D1FAE5' : '#FEE2E2',
        color: isActive ? '#065F46' : '#991B1B',
      }}
    >
      <span
        className="w-1 h-1 rounded-full"
        style={{ background: isActive ? '#10B981' : '#EF4444' }}
      />
      {status}
    </span>
  );
}

function CreateKeyModal({
  isOpen,
  onClose,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (key: string) => void;
}) {
  const [name, setName] = useState('');
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: () => organizationApi.createApiKey(MOCK_ORG_ID, { name }),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['organization-api-keys'] });
      onSuccess(response.data.apiKey);
      setName('');
    },
  });

  if (!isOpen) return null;

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
        <h3
          className="text-lg font-medium text-neutral-900 mb-1"
          style={{ fontFamily: "'Newsreader', serif" }}
        >
          새 API 키 생성
        </h3>
        <p className="text-xs text-neutral-500 mb-6">
          외부 서비스에서 LuminaOps API를 사용하기 위한 키를 생성합니다
        </p>

        <div className="mb-6">
          <label className="block text-[10px] uppercase tracking-wider text-neutral-500 mb-2">
            키 이름
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="예: Production API Key"
            className="w-full px-3 py-2.5 text-sm text-neutral-900 placeholder-neutral-300 focus:outline-none transition-colors"
            style={{
              background: '#FAFAFA',
              border: '1px solid #E5E5E5',
            }}
          />
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
            disabled={!name.trim() || createMutation.isPending}
            className="flex-1 px-4 py-2.5 text-xs font-medium text-white transition-colors disabled:opacity-50"
            style={{ background: '#0D9488' }}
          >
            {createMutation.isPending ? '생성 중...' : '생성'}
          </button>
        </div>
      </div>
    </div>
  );
}

function KeyRevealModal({
  isOpen,
  onClose,
  apiKey,
}: {
  isOpen: boolean;
  onClose: () => void;
  apiKey: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(apiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" />

      <div
        className="relative w-full max-w-lg mx-4 p-6"
        style={{
          background: '#FFFFFF',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.15)',
        }}
      >
        <div className="flex items-start gap-3 mb-4">
          <div
            className="w-10 h-10 flex items-center justify-center text-lg shrink-0"
            style={{ background: '#D1FAE5', color: '#065F46' }}
          >
            ✓
          </div>
          <div>
            <h3
              className="text-lg font-medium text-neutral-900"
              style={{ fontFamily: "'Newsreader', serif" }}
            >
              API 키가 생성되었습니다
            </h3>
            <p className="text-xs text-neutral-500 mt-0.5">
              이 키는 다시 표시되지 않습니다. 안전한 곳에 저장하세요.
            </p>
          </div>
        </div>

        <div
          className="p-4 mb-6 font-mono text-sm break-all"
          style={{
            background: '#171717',
            color: '#22D3EE',
          }}
        >
          {apiKey}
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleCopy}
            className="flex-1 px-4 py-2.5 text-xs font-medium transition-colors"
            style={{
              background: copied ? '#D1FAE5' : '#F5F5F5',
              color: copied ? '#065F46' : '#525252',
            }}
          >
            {copied ? '✓ 복사됨' : '클립보드에 복사'}
          </button>
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 text-xs font-medium text-white transition-colors"
            style={{ background: '#0D9488' }}
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
}

export function SettingsApiKeysPage() {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<string | null>(null);

  // API 키 목록 조회
  const { data: apiKeys, isLoading } = useQuery({
    queryKey: ['organization-api-keys', MOCK_ORG_ID],
    queryFn: async () => {
      const response = await organizationApi.getApiKeys(MOCK_ORG_ID);
      return response.data;
    },
  });

  const handleKeyCreated = (key: string) => {
    setIsCreateModalOpen(false);
    setNewlyCreatedKey(key);
  };

  return (
    <div>
      {/* Page Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1
            className="text-2xl font-medium text-neutral-900 tracking-tight"
            style={{ fontFamily: "'Newsreader', serif" }}
          >
            API 키
          </h1>
          <p className="text-sm text-neutral-500 mt-1">
            외부 서비스 연동을 위한 API 키를 관리합니다
          </p>
        </div>

        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="px-4 py-2.5 text-xs font-medium text-white transition-colors hover:opacity-90"
          style={{ background: '#0D9488' }}
        >
          + 새 API 키
        </button>
      </div>

      {/* Warning Banner */}
      <div
        className="p-4 mb-6 flex items-start gap-3"
        style={{
          background: '#FFFBEB',
          border: '1px solid #FCD34D',
        }}
      >
        <span className="text-amber-600 text-sm">⚠</span>
        <div>
          <p className="text-xs text-amber-800 font-medium mb-0.5">
            API 키 보안
          </p>
          <p className="text-[11px] text-amber-700">
            API 키는 생성 시 한 번만 표시됩니다. 키가 노출된 경우 즉시 삭제하고 새로 생성하세요.
          </p>
        </div>
      </div>

      {/* API Keys Table */}
      <div
        style={{
          background: '#FFFFFF',
          border: '1px solid #E5E5E5',
        }}
      >
        {/* Table Header */}
        <div
          className="grid grid-cols-12 gap-4 px-5 py-3 text-[10px] uppercase tracking-wider text-neutral-400"
          style={{ borderBottom: '1px solid #E5E5E5' }}
        >
          <div className="col-span-4">이름</div>
          <div className="col-span-3">키 접두사</div>
          <div className="col-span-2">상태</div>
          <div className="col-span-3">마지막 사용</div>
        </div>

        {/* Table Body */}
        {isLoading ? (
          <div className="px-5 py-12 text-center">
            <p className="text-sm text-neutral-400">API 키 목록을 불러오는 중...</p>
          </div>
        ) : apiKeys && apiKeys.length > 0 ? (
          <div>
            {apiKeys.map((key, idx) => (
              <div
                key={key.id}
                className="grid grid-cols-12 gap-4 px-5 py-4 items-center hover:bg-neutral-50 transition-colors"
                style={{
                  borderBottom: idx < apiKeys.length - 1 ? '1px solid #F5F5F5' : 'none',
                }}
              >
                {/* Name */}
                <div className="col-span-4">
                  <p className="text-sm text-neutral-900 font-medium">
                    {key.name}
                  </p>
                </div>

                {/* Key Prefix */}
                <div className="col-span-3">
                  <code
                    className="px-2 py-1 text-xs"
                    style={{
                      background: '#F5F5F5',
                      color: '#525252',
                      fontFamily: "'IBM Plex Mono', monospace",
                    }}
                  >
                    {key.keyPrefix}...
                  </code>
                </div>

                {/* Status */}
                <div className="col-span-2">
                  <StatusBadge status={key.status} />
                </div>

                {/* Last Used */}
                <div className="col-span-3">
                  <span className="text-xs text-neutral-500">
                    {key.lastUsedAt
                      ? new Date(key.lastUsedAt).toLocaleDateString('ko-KR', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })
                      : '사용 기록 없음'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="px-5 py-12 text-center">
            <div className="mb-3">
              <span className="text-3xl opacity-20">⬡</span>
            </div>
            <p className="text-sm text-neutral-500 mb-1">API 키가 없습니다</p>
            <p className="text-xs text-neutral-400">
              새 API 키를 생성하여 외부 서비스와 연동하세요
            </p>
          </div>
        )}
      </div>

      {/* Usage Info */}
      <div className="mt-6 p-4" style={{ background: '#FAFAFA', border: '1px solid #E5E5E5' }}>
        <p className="text-[10px] uppercase tracking-wider text-neutral-400 mb-2">
          사용 방법
        </p>
        <div className="space-y-2">
          <code
            className="block p-3 text-xs"
            style={{
              background: '#171717',
              color: '#A3E635',
              fontFamily: "'IBM Plex Mono', monospace",
            }}
          >
            curl -H "X-API-Key: your_api_key" \<br />
            &nbsp;&nbsp;https://api.luminaops.io/v1/chat
          </code>
        </div>
      </div>

      {/* Modals */}
      <CreateKeyModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={handleKeyCreated}
      />

      <KeyRevealModal
        isOpen={!!newlyCreatedKey}
        onClose={() => setNewlyCreatedKey(null)}
        apiKey={newlyCreatedKey || ''}
      />
    </div>
  );
}
