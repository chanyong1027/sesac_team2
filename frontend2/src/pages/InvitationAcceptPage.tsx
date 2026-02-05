import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { workspaceApi } from '@/api/workspace.api';
import { useAuthStore } from '@/features/auth/store';

export function InvitationAcceptPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const [navigationError, setNavigationError] = useState<string | null>(null);
  const token = searchParams.get('token');

  const acceptMutation = useMutation({
    mutationFn: () => workspaceApi.acceptInvitation({ token: token! }),
    onSuccess: (response) => {
      const payload = (response.data as any).data ?? response.data;
      const { workspaceId, organizationId } = payload;
      const resolvedWorkspaceId = Number(workspaceId);
      if (!Number.isFinite(resolvedWorkspaceId)) {
        console.warn('Invitation accept: missing workspaceId', payload);
        setNavigationError('워크스페이스 정보를 찾을 수 없습니다.');
        return;
      }
      if (organizationId) {
        navigate(`/orgs/${organizationId}/workspaces/${resolvedWorkspaceId}`);
      } else {
        navigate(`/workspaces/${resolvedWorkspaceId}`);
      }
    },
  });

  useEffect(() => {
    if (!token) {
      navigate('/dashboard');
      return;
    }

    if (!isAuthenticated) {
      // 🔑 초대 토큰을 sessionStorage에 저장 후 로그인으로 이동
      // LoginPage에서 로그인 성공 시 이 토큰으로 자동 수락 처리
      sessionStorage.setItem('pendingInvitation', token);
      navigate('/login');
      return;
    }

    // 로그인 상태면 바로 수락 시도
    acceptMutation.mutate();
  }, [token, isAuthenticated]);

  if (acceptMutation.isPending) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-white text-lg">초대를 수락하는 중...</p>
        </div>
      </div>
    );
  }

  if (navigationError) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 text-lg mb-4">{navigationError}</p>
          <p className="text-gray-400">다시 시도하거나 대시보드로 이동해주세요.</p>
          <button
            onClick={() => navigate('/dashboard')}
            className="mt-6 px-6 py-3 bg-blue-500 text-white rounded-lg"
          >
            대시보드로 이동
          </button>
        </div>
      </div>
    );
  }

  if (acceptMutation.isError) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 text-lg mb-4">초대 수락에 실패했습니다.</p>
          <p className="text-gray-400">링크가 만료되었거나 유효하지 않습니다.</p>
          <button
            onClick={() => navigate('/dashboard')}
            className="mt-6 px-6 py-3 bg-blue-500 text-white rounded-lg"
          >
            대시보드로 이동
          </button>
        </div>
      </div>
    );
  }

  return null;
}
