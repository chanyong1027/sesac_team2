import { useQuery } from '@tanstack/react-query';
import { workspaceApi } from '@/api/workspace.api';

export function useWorkspaces() {
  return useQuery({
    queryKey: ['workspaces'],
    queryFn: async () => {
      const response = await workspaceApi.getWorkspaces();
      return response.data;
    },
  });
}
