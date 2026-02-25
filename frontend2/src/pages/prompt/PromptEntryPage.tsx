import { useEffect, useMemo } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { promptApi } from '@/api/prompt.api';
import { ArrowRight } from 'lucide-react';

export function PromptEntryPage() {
  const { orgId, workspaceId: workspaceIdParam } = useParams<{ orgId: string; workspaceId: string }>();
  const parsedWorkspaceId = Number(workspaceIdParam);
  const isValidWorkspaceId = Number.isInteger(parsedWorkspaceId) && parsedWorkspaceId > 0;
  const navigate = useNavigate();

  const workspaceId = parsedWorkspaceId;
  const basePath = orgId ? `/orgs/${orgId}/workspaces/${workspaceId}` : `/workspaces/${workspaceId}`;

  const { data: prompts, isLoading } = useQuery({
    queryKey: ['prompts', workspaceId],
    queryFn: async () => {
      const response = await promptApi.getPrompts(workspaceId);
      return response.data;
    },
    enabled: isValidWorkspaceId,
  });

  const orderedPrompts = useMemo(() => {
    if (!prompts) return [];
    return [...prompts].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }, [prompts]);

  useEffect(() => {
    if (!isValidWorkspaceId || !orderedPrompts.length) return;
    navigate(`${basePath}/prompts/${orderedPrompts[0].id}`, { replace: true });
  }, [isValidWorkspaceId, orderedPrompts, basePath, navigate]);

  if (!isValidWorkspaceId) {
    return <div className="p-8 text-[var(--text-secondary)]">유효하지 않은 워크스페이스입니다.</div>;
  }

  if (isLoading) {
    return <div className="p-8 text-[var(--text-secondary)]">메인 프롬프트를 찾는 중...</div>;
  }

  if (!prompts || prompts.length === 0) {
    return (
      <div className="glass-card p-8 rounded-2xl text-center space-y-4 max-w-2xl mx-auto">
        <h1 className="text-xl font-semibold text-[var(--foreground)]">프롬프트가 없습니다</h1>
        <p className="text-sm text-[var(--text-secondary)]">
          워크스페이스에 메인 프롬프트를 만들고 릴리즈 버전을 설정하세요.
        </p>
        <Link
          to={`${basePath}/prompts/new`}
          className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--primary)] text-white rounded-xl hover:bg-[var(--primary-hover)] transition-colors text-sm font-semibold shadow-[0_0_15px_rgba(168,85,247,0.25)] border border-[var(--primary-hover)]"
        >
          새 프롬프트 만들기
          <ArrowRight size={16} />
        </Link>
      </div>
    );
  }

  return null;
}
