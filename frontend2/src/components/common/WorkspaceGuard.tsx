import type { ReactNode } from 'react';
import { Navigate, useLocation, useParams } from 'react-router-dom';
import { useWorkspaces } from '@/features/workspace/hooks/useWorkspaces';
import { AccessDenied } from '@/components/common/AccessDenied';

export function WorkspaceGuard({ children }: { children: ReactNode }) {
  const { orgId, workspaceId: workspaceIdParam } = useParams<{ orgId?: string; workspaceId?: string }>();
  const location = useLocation();
  const { data: workspaces, isLoading } = useWorkspaces();

  const workspaceId = Number(workspaceIdParam);
  const isValidWorkspaceId = Number.isInteger(workspaceId) && workspaceId > 0;

  if (!isValidWorkspaceId) {
    return (
      <AccessDenied
        title="유효하지 않은 워크스페이스"
        description="워크스페이스 ID가 올바르지 않습니다."
      />
    );
  }

  if (isLoading) {
    return <div className="p-8 text-gray-500">워크스페이스 권한을 확인하는 중...</div>;
  }

  if (!workspaces || workspaces.length === 0) {
    // 신규 유저 또는 모든 워크스페이스에서 제거된 케이스
    return <Navigate to="/onboarding" replace />;
  }

  const workspace = workspaces.find((ws) => ws.id === workspaceId);
  if (!workspace) {
    return (
      <AccessDenied
        title="접근 권한이 없습니다"
        description="해당 워크스페이스에 접근할 수 없습니다. URL을 직접 변경한 경우, 접근 가능한 워크스페이스로 이동하세요."
      />
    );
  }

  // URL의 orgId가 workspace의 organizationId와 불일치하면 올바른 경로로 정규화
  const parsedOrgId = orgId ? Number(orgId) : null;
  if (!parsedOrgId || !Number.isFinite(parsedOrgId) || parsedOrgId !== workspace.organizationId) {
    const prefix = orgId
      ? `/orgs/${orgId}/workspaces/${workspaceId}`
      : `/workspaces/${workspaceId}`;
    const suffix = location.pathname.startsWith(prefix) ? location.pathname.slice(prefix.length) : '';
    return (
      <Navigate
        to={`/orgs/${workspace.organizationId}/workspaces/${workspaceId}${suffix}${location.search}`}
        replace
      />
    );
  }

  return children;
}

