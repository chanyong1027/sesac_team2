import { useParams } from 'react-router-dom';
import { InvitationLinkGenerator } from '@/features/workspace/components/InvitationLinkGenerator';

export function WorkspaceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const workspaceId = Number(id);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-8">
          워크스페이스 #{workspaceId}
        </h1>

        {/* 초대 링크 생성기 */}
        <InvitationLinkGenerator workspaceId={workspaceId} />

        {/* TODO: 추후 멤버 목록, 프롬프트 관리 등 추가 */}
        <div className="mt-8 p-6 bg-white/5 border border-white/10 rounded-xl">
          <p className="text-slate-400">
            워크스페이스 상세 페이지 - 추후 구현 예정
          </p>
        </div>
      </div>
    </div>
  );
}
