import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { organizationApi } from '@/api/organization.api';
import { workspaceApi } from '@/api/workspace.api';
import { useEffect } from 'react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const schema = z.object({
  workspaceDisplayName: z.string().min(2, '워크스페이스 이름을 입력하세요'),
  workspaceName: z.string().min(2, 'URL 식별자를 입력하세요').regex(/^[a-z0-9-]+$/, '영문 소문자, 숫자, 하이픈만 가능합니다'),
  organizationName: z.string().min(2, '조직(팀) 이름을 입력하세요'),
});

type FormData = z.infer<typeof schema>;

export function CreateOrganizationModal({ isOpen, onClose }: Props) {
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  // 워크스페이스 이름 입력 시 조직 이름 자동 채움 (사용자 편의)
  const workspaceDisplayName = watch('workspaceDisplayName');
  useEffect(() => {
    if (workspaceDisplayName && !watch('organizationName')) {
      setValue('organizationName', workspaceDisplayName);
    }
  }, [workspaceDisplayName, setValue, watch]);

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
      <div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-2xl border border-gray-100">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">새 워크스페이스 만들기</h2>
        <p className="text-sm text-gray-500 mb-6">
          새로운 프로젝트를 위한 작업 공간을 생성합니다.
        </p>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {/* 1. Workspace Display Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              워크스페이스 이름
            </label>
            <input
              {...register('workspaceDisplayName')}
              type="text"
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
              placeholder="예: 내 프로젝트"
              autoFocus
            />
            {errors.workspaceDisplayName && (
              <p className="mt-1 text-sm text-red-500">
                {errors.workspaceDisplayName.message}
              </p>
            )}
          </div>

          {/* 2. Workspace ID (Name) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              URL 식별자 (ID)
            </label>
            <div className="relative">
              <input
                {...register('workspaceName')}
                type="text"
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                placeholder="my-project"
              />
            </div>
            <p className="mt-1 text-xs text-gray-500">영문 소문자, 숫자, 하이픈(-)만 사용 가능합니다.</p>
            {errors.workspaceName && (
              <p className="mt-1 text-sm text-red-500">
                {errors.workspaceName.message}
              </p>
            )}
          </div>

          {/* 3. Organization Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              조직(팀) 이름
            </label>
            <input
              {...register('organizationName')}
              type="text"
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
              placeholder="예: 개발팀 (선택 시 자동 입력)"
            />
            <p className="mt-1 text-xs text-gray-500">이 워크스페이스를 관리할 조직의 이름입니다.</p>
            {errors.organizationName && (
              <p className="mt-1 text-sm text-red-500">
                {errors.organizationName.message}
              </p>
            )}
          </div>

          <div className="flex gap-4 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 bg-white border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-colors"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="flex-1 py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-sm"
            >
              {createMutation.isPending ? '생성 중...' : '워크스페이스 생성'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
