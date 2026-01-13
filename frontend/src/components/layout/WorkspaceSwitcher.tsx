import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { Check, ChevronsUpDown, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { apiClient, extractData } from '@/lib/api-client';
import type { Workspace } from '@/types';
import { useWorkspace } from '@/hooks/useWorkspace';

export function WorkspaceSwitcher() {
  const { workspaceId: routeWorkspaceId } = useParams();
  const navigate = useNavigate();
  const { workspaceId, setWorkspaceId } = useWorkspace();

  const { data: workspaces, isLoading } = useQuery({
    queryKey: ['workspaces'],
    queryFn: async () => {
      const response = await apiClient.get<Workspace[]>('/workspaces');
      return extractData(response);
    },
  });

  const activeWorkspaceId = routeWorkspaceId || workspaceId || '';
  const currentWorkspace = workspaces?.find(w => w.id === activeWorkspaceId);

  const handleSelectWorkspace = (id: string) => {
    setWorkspaceId(id);
    navigate(`/w/${id}/dashboard`);
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger>
        <Button variant="outline" className="w-64 justify-between">
          <span className="truncate">
            {currentWorkspace?.name || 'Select workspace'}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-64">
        {workspaces?.map((workspace) => (
          <DropdownMenuItem
            key={workspace.id}
            onClick={() => handleSelectWorkspace(workspace.id)}
            className="flex items-center justify-between"
          >
            <div className="flex flex-col">
              <span className="font-medium">{workspace.name}</span>
              <span className="text-xs text-muted-foreground">{workspace.slug}</span>
            </div>
            {workspace.id === activeWorkspaceId && <Check className="h-4 w-4" />}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => navigate('/workspaces')}>
          <Plus className="mr-2 h-4 w-4" />
          Create workspace
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}



