import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { workspaceApi } from '@/api/workspace.api';

interface Props {
  workspaceId: number;
}

export function InvitationLinkGenerator({ workspaceId }: Props) {
  const [invitationUrl, setInvitationUrl] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState('MEMBER');

  const mutation = useMutation({
    mutationFn: () =>
      workspaceApi.createInvitation(workspaceId, { role: selectedRole }),
    onSuccess: (response) => {
      setInvitationUrl(response.data.invitationUrl);
    },
  });

  const copyToClipboard = () => {
    if (invitationUrl) {
      navigator.clipboard.writeText(invitationUrl);
      alert('링크가 복사되었습니다!');
    }
  };

  return (
    <div className="p-6 bg-white/5 border border-white/10 rounded-xl">
      <h3 className="text-lg font-semibold text-white mb-4">팀원 초대</h3>

      <div className="flex gap-4 mb-4">
        <select
          value={selectedRole}
          onChange={(e) => setSelectedRole(e.target.value)}
          className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="MEMBER">멤버</option>
          <option value="ADMIN">관리자</option>
        </select>

        <button
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending}
          className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50"
        >
          {mutation.isPending ? '생성 중...' : '초대 링크 생성'}
        </button>
      </div>

      {invitationUrl && (
        <div className="flex items-center gap-2 p-3 bg-black/30 rounded-lg">
          <input
            type="text"
            value={invitationUrl}
            readOnly
            className="flex-1 bg-transparent text-gray-300 text-sm outline-none"
          />
          <button
            onClick={copyToClipboard}
            className="px-4 py-2 bg-white/10 text-white text-sm rounded-lg hover:bg-white/20 transition-colors"
          >
            복사
          </button>
        </div>
      )}
    </div>
  );
}
