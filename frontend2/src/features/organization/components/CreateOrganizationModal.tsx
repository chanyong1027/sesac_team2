import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { workspaceApi } from '@/api/workspace.api';
import { useOrganizationStore } from '@/features/organization/store/organizationStore';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const schema = z.object({
  workspaceDisplayName: z.string().min(2, '워크스페이스 이름을 입력하세요'),
  workspaceName: z.string().min(2, 'URL 식별자를 입력하세요').regex(/^[a-z0-9-]+$/, '영문 소문자, 숫자, 하이픈만 가능합니다'),
});

type FormData = z.infer<typeof schema>;

export function CreateOrganizationModal({ isOpen, onClose }: Props) {
  const queryClient = useQueryClient();
  const { currentOrgId } = useOrganizationStore();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const createMutation = useMutation({
    mutationFn: async (data: FormData) => {
      if (!currentOrgId) {
        throw new Error('조직 정보가 없습니다.');
      }
      await workspaceApi.createWorkspace(currentOrgId, {
        name: data.workspaceName,
        displayName: data.workspaceDisplayName,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspaces'] });
      reset();
      onClose();
    },
  });

  const onSubmit = (data: FormData) => {
    createMutation.mutate(data);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-8 w-full max-w-md">
        <h2 className="text-2xl font-bold text-[var(--foreground)] mb-2">새 워크스페이스 만들기</h2>
        <p className="text-sm text-[var(--text-secondary)] mb-6">
          새로운 프로젝트를 위한 작업 공간을 생성합니다.
        </p>

        {!currentOrgId && (
          <div className="mb-5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
            현재 조직이 선택되지 않아 워크스페이스를 만들 수 없습니다.
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {/* 1. Workspace Display Name */}
          <div>
            <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
              워크스페이스 이름
            </label>
            <input
              {...register('workspaceDisplayName')}
              type="text"
              className="w-full px-4 py-3 bg-[var(--input)] border border-[var(--border)] rounded-xl text-[var(--foreground)] placeholder-[var(--text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] transition-all"
              placeholder="예: 내 프로젝트"
              autoFocus
            />
            {errors.workspaceDisplayName && (
              <p className="mt-1 text-sm text-red-400">
                {errors.workspaceDisplayName.message}
              </p>
            )}
          </div>

          {/* 2. Workspace ID (Name) */}
          <div>
            <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
              URL 식별자 (ID)
            </label>
            <div className="relative">
              <input
                {...register('workspaceName')}
                type="text"
                className="w-full px-4 py-3 bg-[var(--input)] border border-[var(--border)] rounded-xl text-[var(--foreground)] placeholder-[var(--text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] transition-all"
                placeholder="my-project"
              />
            </div>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">영문 소문자, 숫자, 하이픈(-)만 사용 가능합니다.</p>
            {errors.workspaceName && (
              <p className="mt-1 text-sm text-red-400">
                {errors.workspaceName.message}
              </p>
            )}
          </div>

          {/* 3. Organization Name */}
          <div className="flex gap-4 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 bg-[var(--muted)] border border-[var(--border)] text-[var(--foreground)] font-semibold rounded-xl hover:bg-[var(--accent)] transition-colors"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending || !currentOrgId}
              className="flex-1 py-3 bg-[var(--primary)] text-white font-semibold rounded-xl hover:bg-[var(--primary-hover)] disabled:opacity-50 transition-colors shadow-[0_0_15px_rgba(168,85,247,0.25)] border border-[var(--border)]"
            >
              {createMutation.isPending ? '생성 중...' : '워크스페이스 생성'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
