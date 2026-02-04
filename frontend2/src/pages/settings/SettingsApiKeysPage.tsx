import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { organizationApi } from '@/api/organization.api';
import { useOrganizationStore } from '@/features/organization/store/organizationStore';
import { Key, Copy, Check, AlertTriangle, Plus, RefreshCw } from 'lucide-react';

function StatusBadge({ status }: { status: string }) {
  const isActive = status === 'ACTIVE';
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-medium rounded-full ${isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
        }`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-green-500' : 'bg-red-500'
          }`}
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
  const { currentOrgId } = useOrganizationStore();

  const createMutation = useMutation({
    mutationFn: () => {
      if (!currentOrgId) throw new Error("No organization selected");
      return organizationApi.createApiKey(currentOrgId, { name });
    },
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
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-md mx-4 p-6 bg-white rounded-xl shadow-xl border border-gray-100">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          새 API 키 생성
        </h3>
        <p className="text-sm text-gray-500 mb-6">
          외부 서비스에서 LuminaOps API를 사용하기 위한 키를 생성합니다.
        </p>

        <div className="mb-6">
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            키 이름
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="예: Production API Key"
            className="w-full px-4 py-3 text-sm text-gray-900 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
            autoFocus
          />
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
            disabled={!name.trim() || createMutation.isPending}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 shadow-sm"
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
  title = 'API 키가 생성되었습니다',
}: {
  isOpen: boolean;
  onClose: () => void;
  apiKey: string;
  title?: string;
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
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div className="relative w-full max-w-lg mx-4 p-6 bg-white rounded-xl shadow-xl border border-gray-100">
        <div className="flex items-start gap-4 mb-6">
          <div className="w-12 h-12 flex items-center justify-center bg-green-100 text-green-600 rounded-full shrink-0">
            <Check size={24} />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              {title}
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              이 키는 지금 한 번만 표시됩니다. 안전한 곳에 복사하여 저장하세요.
            </p>
          </div>
        </div>

        <div className="bg-gray-900 rounded-lg p-4 mb-6 relative group">
          <code className="text-sm font-mono text-green-400 break-all block pr-8">
            {apiKey}
          </code>
          <button
            onClick={handleCopy}
            className="absolute top-2 right-2 p-2 text-gray-400 hover:text-white transition-colors"
            title="복사"
          >
            {copied ? <Check size={16} /> : <Copy size={16} />}
          </button>
        </div>

        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
          >
            확인 및 닫기
          </button>
        </div>
      </div>
    </div>
  );
}

function RotateConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  isPending,
  keyName,
  errorMessage,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  isPending: boolean;
  keyName: string;
  errorMessage?: string;
}) {
  const [reason, setReason] = useState('');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-md mx-4 p-6 bg-white rounded-xl shadow-xl border border-gray-100">
        <div className="flex items-start gap-4 mb-6">
          <div className="w-12 h-12 flex items-center justify-center bg-amber-100 text-amber-600 rounded-full shrink-0">
            <RefreshCw size={24} />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              API 키 재발급
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              <strong>{keyName}</strong> 키를 재발급하시겠습니까?
            </p>
          </div>
        </div>

        <div className="p-4 mb-4 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-sm text-amber-800">
            ⚠️ 기존 키는 즉시 무효화됩니다. 해당 키를 사용 중인 모든 서비스에서 새 키로 교체해야 합니다.
          </p>
        </div>

        <div className="mb-6">
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            재발급 사유 (선택)
          </label>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="예: 키 노출로 인한 긴급 교체"
            className="w-full px-4 py-3 text-sm text-gray-900 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
          />
        </div>

        {errorMessage && (
          <div className="p-3 mb-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-700">
              ❌ {errorMessage}
            </p>
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            취소
          </button>
          <button
            onClick={() => onConfirm(reason)}
            disabled={isPending}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-50 shadow-sm"
          >
            {isPending ? '재발급 중...' : '재발급'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function SettingsApiKeysPage() {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<string | null>(null);
  const [rotateTarget, setRotateTarget] = useState<{ id: number; name: string } | null>(null);
  const [rotatedKey, setRotatedKey] = useState<string | null>(null);
  const [rotateError, setRotateError] = useState<string | null>(null);
  const { currentOrgId } = useOrganizationStore();
  const queryClient = useQueryClient();

  const { data: apiKeys, isLoading } = useQuery({
    queryKey: ['organization-api-keys', currentOrgId],
    queryFn: async () => {
      if (!currentOrgId) return [];
      const response = await organizationApi.getApiKeys(currentOrgId);
      return response.data;
    },
    enabled: !!currentOrgId,
  });

  const rotateMutation = useMutation({
    mutationFn: ({ keyId, reason }: { keyId: number; reason: string }) => {
      if (!currentOrgId) throw new Error('No organization selected');
      return organizationApi.rotateApiKey(currentOrgId, keyId, { reason: reason || undefined });
    },
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['organization-api-keys'] });
      setRotateTarget(null);
      setRotateError(null);
      setRotatedKey(response.data.apiKey);
    },
    onError: () => {
      setRotateError('재발급에 실패했습니다. 다시 시도해주세요.');
    },
  });

  const handleKeyCreated = (key: string) => {
    setIsCreateModalOpen(false);
    setNewlyCreatedKey(key);
  };

  const handleRotateConfirm = (reason: string) => {
    if (rotateTarget) {
      setRotateError(null);  // 재시도 시 에러 초기화
      rotateMutation.mutate({ keyId: rotateTarget.id, reason });
    }
  };

  const handleRotateModalClose = () => {
    setRotateTarget(null);
    setRotateError(null);  // 모달 닫을 때 에러 초기화
  };

  if (!currentOrgId) return <div>조직을 선택해주세요.</div>;

  return (
    <div>
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
            API 키
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            외부 서비스 연동을 위한 API 키를 관리합니다.
          </p>
        </div>
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
        >
          <Plus size={16} />
          새 API 키
        </button>
      </div>

      <div className="p-4 mb-6 flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-lg">
        <AlertTriangle size={18} className="text-amber-600 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-amber-900 mb-0.5">
            보안 주의사항
          </p>
          <p className="text-xs text-amber-700">
            API 키는 생성 시 한 번만 표시됩니다. 키가 노출된 경우 즉시 삭제하고 새로 생성하세요.
          </p>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="grid grid-cols-12 gap-4 px-6 py-3 bg-gray-50 border-b border-gray-200 text-xs font-medium text-gray-500 uppercase tracking-wider">
          <div className="col-span-3">이름</div>
          <div className="col-span-3">키 접두사</div>
          <div className="col-span-2">상태</div>
          <div className="col-span-2">마지막 사용</div>
          <div className="col-span-2"></div>
        </div>

        {isLoading ? (
          <div className="px-6 py-12 text-center text-sm text-gray-500">
            API 키 목록을 불러오는 중...
          </div>
        ) : apiKeys && apiKeys.length > 0 ? (
          <div className="divide-y divide-gray-100">
            {apiKeys.map((apiKey) => (
              <div
                key={apiKey.id}
                className="grid grid-cols-12 gap-4 px-6 py-4 items-center hover:bg-gray-50 transition-colors"
              >
                <div className="col-span-3">
                  <p className="text-sm font-medium text-gray-900">
                    {apiKey.name}
                  </p>
                </div>

                <div className="col-span-3">
                  <code className="px-2 py-1 text-xs font-mono bg-gray-100 text-gray-600 rounded">
                    {apiKey.keyPrefix}...
                  </code>
                </div>

                <div className="col-span-2">
                  <StatusBadge status={apiKey.status} />
                </div>

                <div className="col-span-2">
                  <span className="text-sm text-gray-500">
                    {apiKey.lastUsedAt
                      ? new Date(apiKey.lastUsedAt).toLocaleDateString('ko-KR', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })
                      : '-'}
                  </span>
                </div>

                <div className="col-span-2 text-right">
                  <button
                    onClick={() => setRotateTarget({ id: apiKey.id, name: apiKey.name })}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors"
                  >
                    <RefreshCw size={12} />
                    재발급
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="px-6 py-16 text-center">
            <div className="w-12 h-12 mx-auto bg-gray-100 rounded-full flex items-center justify-center text-gray-400 mb-3">
              <Key size={24} />
            </div>
            <p className="text-sm font-medium text-gray-900 mb-1">API 키가 없습니다</p>
            <p className="text-xs text-gray-500">
              새 API 키를 생성하여 외부 서비스와 연동하세요.
            </p>
          </div>
        )}
      </div>

      <div className="mt-8 p-6 bg-gray-900 rounded-xl text-gray-300">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">
          사용 예시
        </p>
        <code className="block p-4 bg-black rounded-lg text-sm font-mono overflow-x-auto">
          <span className="text-purple-400">curl</span> -H <span className="text-green-400">"X-API-Key: your_api_key"</span> \<br />
          &nbsp;&nbsp;https://api.luminaops.io/v1/chat/completions
        </code>
      </div>

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

      <RotateConfirmModal
        key={rotateTarget?.id}
        isOpen={!!rotateTarget}
        onClose={handleRotateModalClose}
        onConfirm={handleRotateConfirm}
        isPending={rotateMutation.isPending}
        keyName={rotateTarget?.name || ''}
        errorMessage={rotateError || undefined}
      />

      <KeyRevealModal
        isOpen={!!rotatedKey}
        onClose={() => setRotatedKey(null)}
        apiKey={rotatedKey || ''}
        title="API 키가 재발급되었습니다"
      />
    </div>
  );
}
