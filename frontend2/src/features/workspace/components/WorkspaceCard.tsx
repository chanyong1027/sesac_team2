import { Link } from 'react-router-dom';
import type { WorkspaceSummaryResponse } from '@/types/api.types';

interface Props {
  workspace: WorkspaceSummaryResponse;
}

export function WorkspaceCard({ workspace }: Props) {
  return (
    <Link
      to={`/orgs/${workspace.organizationId}/workspaces/${workspace.id}`}
      className="block p-6 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-all duration-200 group"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-semibold text-white group-hover:text-indigo-400 transition-colors">
          {workspace.displayName}
        </h3>
        <span className="px-3 py-1 text-xs font-medium bg-indigo-500/20 text-indigo-300 rounded-full">
          {workspace.myRole}
        </span>
      </div>

      <p className="text-slate-400 text-sm mb-4">{workspace.name}</p>

      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>생성: {new Date(workspace.createdAt).toLocaleDateString()}</span>
        <span
          className={`px-2 py-1 rounded ${
            workspace.status === 'ACTIVE'
              ? 'bg-green-500/20 text-green-400'
              : 'bg-slate-500/20 text-slate-400'
          }`}
        >
          {workspace.status}
        </span>
      </div>
    </Link>
  );
}
