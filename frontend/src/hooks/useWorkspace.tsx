import type { ReactNode } from 'react';
import { createContext, useCallback, useContext, useMemo, useState } from 'react';

interface WorkspaceState {
  workspaceId: string | null;
  setWorkspaceId: (id: string | null) => void;
}

const WorkspaceContext = createContext<WorkspaceState | undefined>(undefined);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [workspaceId, setWorkspaceIdState] = useState<string | null>(() => {
    return localStorage.getItem('workspaceId');
  });

  const setWorkspaceId = useCallback((id: string | null) => {
    if (id) {
      localStorage.setItem('workspaceId', id);
    } else {
      localStorage.removeItem('workspaceId');
    }
    setWorkspaceIdState(id);
  }, []);

  const value = useMemo(() => ({ workspaceId, setWorkspaceId }), [workspaceId, setWorkspaceId]);

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(): WorkspaceState {
  const context = useContext(WorkspaceContext);
  if (!context) {
    return {
      workspaceId: localStorage.getItem('workspaceId'),
      setWorkspaceId: (id) => {
        if (id) {
          localStorage.setItem('workspaceId', id);
        } else {
          localStorage.removeItem('workspaceId');
        }
      },
    };
  }
  return context;
}
