import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { organizationApi } from '@/api/organization.api';
import { useOrganizationStore } from '@/features/organization/store/organizationStore';
import { Key, Copy, Check, AlertTriangle, Plus } from 'lucide-react';

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
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div className="relative w-full max-w-lg mx-4 p-6 bg-white rounded-xl shadow-xl border border-gray-100">
        <div className="flex items-start gap-4 mb-6">
          <div className="w-12 h-12 flex items-center justify-center bg-green-100 text-green-600 rounded-full shrink-0">
            <Check size={24} />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              API 키가 생성되었습니다
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

export function SettingsApiKeysPage() {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<string | null>(null);
  const { currentOrgId } = useOrganizationStore();

  const { data: apiKeys, isLoading } = useQuery({
    queryKey: ['organization-api-keys', currentOrgId],
    queryFn: async () => {
      if (!currentOrgId) return [];
      const response = await organizationApi.getApiKeys(currentOrgId);
      return response.data;
    },
    enabled: !!currentOrgId,
  });

  const handleKeyCreated = (key: string) => {
    setIsCreateModalOpen(false);
    setNewlyCreatedKey(key);
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
          <div className="col-span-4">이름</div>
          <div className="col-span-3">키 접두사</div>
          <div className="col-span-2">상태</div>
          <div className="col-span-3">마지막 사용</div>
        </div>

        {isLoading ? (
          <div className="px-6 py-12 text-center text-sm text-gray-500">
            API 키 목록을 불러오는 중...
          </div>
        ) : apiKeys && apiKeys.length > 0 ? (
          <div className="divide-y divide-gray-100">
            {apiKeys.map((key) => (
              <div
                key={key.id}
                className="grid grid-cols-12 gap-4 px-6 py-4 items-center hover:bg-gray-50 transition-colors"
              >
                <div className="col-span-4">
                  <p className="text-sm font-medium text-gray-900">
                    {key.name}
                  </p>
                </div>

                <div className="col-span-3">
                  <code className="px-2 py-1 text-xs font-mono bg-gray-100 text-gray-600 rounded">
                    {key.keyPrefix}...
                  </code>
                </div>

                <div className="col-span-2">
                  <StatusBadge status={key.status} />
                </div>

                <div className="col-span-3">
                  <span className="text-sm text-gray-500">
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
    </div>
  );
}
