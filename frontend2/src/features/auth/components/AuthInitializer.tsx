import { useEffect } from 'react';
import { useAuthStore } from '@/features/auth/store';
import { useOrganizationStore } from '@/features/organization/store/organizationStore';
import { workspaceApi } from '@/api/workspace.api';

export function AuthInitializer() {
    const { isAuthenticated } = useAuthStore();
    const { currentOrgId, setCurrentOrgId } = useOrganizationStore();

    useEffect(() => {
        const initOrganization = async () => {
            // 이미 조직이 선택되어 있거나 로그인이 안 되어 있으면 스킵
            if (!isAuthenticated) return;

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
                    // 워크스페이스가 아예 없다면(신규 유저 등), 선택된 조직 정보도 날려야 함 (잘못된 캐싱 방지)
                    setCurrentOrgId(null);
                }
            } catch (error) {
                console.error('Failed to initialize organization context:', error);
            }
        };

        initOrganization();
    }, [isAuthenticated, setCurrentOrgId, currentOrgId]);

    return null;
}
