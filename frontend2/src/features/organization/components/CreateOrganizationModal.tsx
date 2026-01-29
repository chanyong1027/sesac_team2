import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { organizationApi } from '@/api/organization.api';
import { workspaceApi } from '@/api/workspace.api';
import { Button } from '@/components/ui/button';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const schema = z.object({
  organizationName: z.string().min(2, '조직 이름을 입력하세요'),
  workspaceName: z.string().min(2, '워크스페이스 이름을 입력하세요'),
  workspaceDisplayName: z.string().min(2, '표시 이름을 입력하세요'),
});

type FormData = z.infer<typeof schema>;

export function CreateOrganizationModal({ isOpen, onClose }: Props) {
  const queryClient = useQueryClient();

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
      // 1. 조직 생성
      const orgResponse = await organizationApi.createOrganization({
        name: data.organizationName,
      });
      const orgId = orgResponse.data.id;

      // 2. 워크스페이스 생성
      await workspaceApi.createWorkspace(orgId, {
        name: data.workspaceName,
        displayName: data.workspaceDisplayName,
      });

      return orgResponse.data;
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
      <div className="bg-slate-800 rounded-2xl p-8 w-full max-w-md shadow-2xl border border-white/10">
        <h2 className="text-2xl font-bold text-white mb-6">새 조직 만들기</h2>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              조직 이름
            </label>
            <input
              {...register('organizationName')}
              type="text"
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="우리 회사"
            />
            {errors.organizationName && (
              <p className="mt-1 text-sm text-red-400">
                {errors.organizationName.message}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              워크스페이스 ID
            </label>
            <input
              {...register('workspaceName')}
              type="text"
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="my-workspace"
            />
            {errors.workspaceName && (
              <p className="mt-1 text-sm text-red-400">
                {errors.workspaceName.message}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              워크스페이스 표시 이름
            </label>
            <input
              {...register('workspaceDisplayName')}
              type="text"
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="내 워크스페이스"
            />
            {errors.workspaceDisplayName && (
              <p className="mt-1 text-sm text-red-400">
                {errors.workspaceDisplayName.message}
              </p>
            )}
          </div>

          <div className="flex gap-4 pt-4">
            <Button
              type="button"
              onClick={onClose}
              variant="outline"
              className="flex-1 py-3 bg-white/10 border-white/10 text-white font-semibold rounded-lg hover:bg-white/20"
            >
              취소
            </Button>
            <Button
              type="submit"
              disabled={createMutation.isPending}
              className="flex-1 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-semibold rounded-lg hover:from-indigo-600 hover:to-purple-700 disabled:opacity-50"
            >
              {createMutation.isPending ? '생성 중...' : '만들기'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
