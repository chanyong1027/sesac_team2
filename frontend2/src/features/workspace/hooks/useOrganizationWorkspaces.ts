import { useMemo } from 'react';
import { useWorkspaces } from '@/features/workspace/hooks/useWorkspaces';
import { useOrganizationStore } from '@/features/organization/store/organizationStore';

export function useOrganizationWorkspaces(orgId?: number) {
  const { currentOrgId } = useOrganizationStore();
  const targetOrgId = orgId ?? currentOrgId ?? null;
  const query = useWorkspaces();

  const data = useMemo(() => {
    if (!query.data || !Array.isArray(query.data)) return [];
    if (!targetOrgId) return [];
    return query.data.filter((ws) => ws.organizationId === targetOrgId);
  }, [query.data, targetOrgId]);

  return { ...query, data };
}
