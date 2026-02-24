import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/features/auth/store';
import { useOrganizationStore } from '@/features/organization/store/organizationStore';
import { workspaceApi } from '@/api/workspace.api';

export function AuthInitializer() {
    const navigate = useNavigate();
    const location = useLocation();
    const { isAuthenticated } = useAuthStore();
    const { currentOrgId, setCurrentOrgId } = useOrganizationStore();

    useEffect(() => {
        const initOrganization = async () => {
            // 이미 조직이 선택되어 있거나 로그인이 안 되어 있으면 스킵
            if (!isAuthenticated) return;
            const isOrgScopedPath = /^\/orgs\/\d+/.test(location.pathname);
            // /orgs/:orgId 경로에서는 URL의 orgId를 단일 소스로 사용한다.
            if (isOrgScopedPath) return;

            try {
                const { data: workspaces } = await workspaceApi.getWorkspaces();

                // 현재 선택된 조직이 유효한지 확인하고, 없으면 첫 번째 워크스페이스의 조직으로 설정
                if (workspaces && workspaces.length > 0) {
                    // 만약 currentOrgId가 null이거나, 현재 currentOrgId가 사용자의 워크스페이스 목록에 있는 조직 중 하나가 아니라면
                    // (여기서는 단순하게 첫번째 워크스페이스의 조직 ID로 초기화)
                    // TODO: 좀 더 정교한 조직 선택 로직 필요 (예: 마지막 선택 조직 기억)
                    if (!currentOrgId || !workspaces.some(ws => ws.organizationId === currentOrgId)) {
                        setCurrentOrgId(workspaces[0].organizationId);
                    }
                } else {
                    // 워크스페이스가 아예 없다면 (퇴출된 회원 또는 신규 유저)
                    setCurrentOrgId(null);

                    // 온보딩 페이지가 아닌 경우에만 리다이렉트
                    if (location.pathname !== '/onboarding') {
                        console.warn('사용자에게 워크스페이스가 없습니다. 온보딩 페이지로 이동합니다.');
                        navigate('/onboarding', { replace: true });
                    }
                }
            } catch (error) {
                console.error('Failed to initialize organization context:', error);
                // 네트워크 에러가 아닌 경우 (예: 401, 403) 로그아웃 처리를 고려할 수 있음
            }
        };

        initOrganization();
    }, [isAuthenticated, setCurrentOrgId, currentOrgId, navigate, location.pathname]);

    return null;
}
