import { type ReactNode, useState, useRef, useEffect } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { useAuthStore } from '@/features/auth/store';
import { useOrganizationWorkspaces } from '@/features/workspace/hooks/useOrganizationWorkspaces';
import { useOrganizationStore } from '@/features/organization/store/organizationStore';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { organizationApi } from '@/api/organization.api';
import { workspaceApi } from '@/api/workspace.api';
import type { WorkspaceSummaryResponse } from '@/types/api.types';
import {
  LayoutDashboard,
  Plus,
  LogOut,
  User,
  Bell,
  Search,
  Menu,
  Key,
  Shield,
  BarChart3,
  MoreHorizontal,
  Pencil,
  Trash2
} from 'lucide-react';
import { CreateOrganizationModal } from '@/features/organization/components/CreateOrganizationModal';

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isOrgModalOpen, setIsOrgModalOpen] = useState(false);
  const { orgId } = useParams<{ orgId: string }>();
  const { currentOrgId } = useOrganizationStore();
  const resolvedOrgId = orgId ? Number(orgId) : currentOrgId ?? null;

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Mobile Sidebar Overlay */}
      {!isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-20 lg:hidden"
          onClick={() => setIsSidebarOpen(true)}
        />
      )}

      {/* Sidebar */}
      <Sidebar
        isOpen={isSidebarOpen}
        orgId={resolvedOrgId}
        onCreateOrg={() => setIsOrgModalOpen(true)}
      />

      {/* Main Content Wrapper */}
      <div className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${isSidebarOpen ? 'lg:ml-64' : 'lg:ml-20'}`}>
        <Header
          toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
        />

        <main className="flex-1 p-6 overflow-y-auto">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>

      <CreateOrganizationModal
        isOpen={isOrgModalOpen}
        onClose={() => setIsOrgModalOpen(false)}
      />
    </div>
  );
}

function Sidebar({ isOpen, onCreateOrg, orgId }: { isOpen: boolean; onCreateOrg: () => void; orgId: number | null }) {
  const location = useLocation();
  const { data: workspaces } = useOrganizationWorkspaces(orgId ?? undefined);
  const resolvedOrgId = orgId ?? workspaces?.[0]?.organizationId ?? null;
  const basePath = resolvedOrgId ? `/orgs/${resolvedOrgId}` : '';
  const dashboardPath = resolvedOrgId ? `${basePath}/dashboard` : '/dashboard';
  const { data: orgDetail } = useQuery({
    queryKey: ['organization', resolvedOrgId],
    queryFn: async () => {
      if (!resolvedOrgId) return null;
      const response = await organizationApi.getOrganization(resolvedOrgId);
      return response.data;
    },
    enabled: !!resolvedOrgId,
  });

  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(`${path}/`);

  return (
    <aside
      className={`
        fixed inset-y-0 left-0 z-30 bg-white border-r border-gray-200 shadow-sm transition-all duration-300 flex flex-col
        ${isOpen ? 'w-64' : 'w-20'}
        ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}
    >
      {/* Logo */}
      <div className="h-16 flex items-center px-6 border-b border-gray-100">
        <Link to={dashboardPath} className="flex items-center gap-2 overflow-hidden">
          <div className="min-w-[32px] w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold text-lg">
            L
          </div>
          <span className={`font-semibold text-gray-900 text-lg transition-opacity duration-200 ${isOpen ? 'opacity-100' : 'opacity-0 hidden'}`}>
            LuminaOps
          </span>
        </Link>
      </div>

      {isOpen && (
        <div className="px-6 py-4 border-b border-gray-100">
          <p className="text-[10px] uppercase tracking-wider text-gray-400">Organization</p>
          <p className="text-sm font-semibold text-gray-900 mt-1">
            {orgDetail?.name ?? '조직 정보 불러오는 중...'}
          </p>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 px-3 py-6 space-y-1 overflow-y-auto">
        <SidebarItem
          icon={<LayoutDashboard size={20} />}
          label="대시보드"
          to={dashboardPath}
          active={location.pathname === dashboardPath}
          isOpen={isOpen}
        />
        <SidebarItem
          icon={<BarChart3 size={20} />}
          label="통계"
          to={`${basePath}/stats`}
          active={isActive(`${basePath}/stats`)}
          isOpen={isOpen}
        />

        {/* Workspace Section */}
        <div className={`mt-8 mb-2 px-3 flex items-center justify-between group ${!isOpen && 'hidden'}`}>
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Workspaces
          </span>
          <button
            onClick={onCreateOrg}
            className="text-gray-400 hover:text-indigo-600 transition-colors"
            title="새 워크스페이스 만들기"
          >
            <Plus size={16} />
          </button>
        </div>

        <div className="space-y-1">
          {workspaces?.slice(0, 5).map(ws => (
            <WorkspaceItem
              key={ws.id}
              workspace={ws}
              isActive={isActive(`/orgs/${ws.organizationId}/workspaces/${ws.id}`)}
              isOpen={isOpen}
            />
          ))}

          {isOpen && workspaces && workspaces.length > 5 && (
            <div className="px-3 py-1 text-xs text-gray-400">
              + {workspaces.length - 5} more
            </div>
          )}

          {!isOpen && (
            <div className="flex justify-center mt-2">
              <button onClick={onCreateOrg} className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500" title="새 워크스페이스 만들기">
                <Plus size={16} />
              </button>
            </div>
          )}
        </div>

        <div className={`mt-8 mb-2 px-3 ${!isOpen && 'hidden'}`}>
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Settings
          </span>
        </div>
        <div className="space-y-1">
          <SidebarItem
            icon={<User size={20} />}
            label="멤버 관리"
            to={`${basePath}/settings/members`}
            active={isActive(`${basePath}/settings/members`)}
            isOpen={isOpen}
          />
          <SidebarItem
            icon={<Key size={20} />}
            label="API 키"
            to={`${basePath}/settings/api-keys`}
            active={isActive(`${basePath}/settings/api-keys`)}
            isOpen={isOpen}
          />
          <SidebarItem
            icon={<Shield size={20} />}
            label="Provider 키"
            to={`${basePath}/settings/provider-keys`}
            active={isActive(`${basePath}/settings/provider-keys`)}
            isOpen={isOpen}
          />
        </div>
      </nav>

      {/* User Profile */}
      <div className="p-4 border-t border-gray-100">
        <div className={`flex items-center gap-3 ${!isOpen && 'justify-center'}`}>
          <UserProfile isOpen={isOpen} />
        </div>
      </div>
    </aside>
  );
}

function WorkspaceItem({ workspace, isActive, isOpen }: { workspace: WorkspaceSummaryResponse; isActive: boolean; isOpen: boolean }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editError, setEditError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  // 메뉴 외부 클릭 시 닫기
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [menuOpen]);

  const updateMutation = useMutation({
    mutationFn: (displayName: string) =>
      workspaceApi.updateWorkspace(workspace.organizationId, workspace.id, { displayName }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization-workspaces', workspace.organizationId] });
      queryClient.invalidateQueries({ queryKey: ['workspaces'] });
      setEditModalOpen(false);
      setEditError(null);
    },
    onError: () => {
      setEditError('이름 수정에 실패했습니다.');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () =>
      workspaceApi.deleteWorkspace(workspace.organizationId, workspace.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization-workspaces', workspace.organizationId] });
      queryClient.invalidateQueries({ queryKey: ['workspaces'] });
      setDeleteModalOpen(false);
    },
    onError: () => {
      setDeleteError('삭제에 실패했습니다.');
    },
  });

  const handleEditClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setEditName(workspace.displayName);
    setEditError(null);
    setMenuOpen(false);
    setEditModalOpen(true);
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDeleteError(null);
    setMenuOpen(false);
    setDeleteModalOpen(true);
  };

  const handleSave = () => {
    if (editName.trim()) {
      updateMutation.mutate(editName.trim());
    }
  };

  return (
    <>
      <div className="relative group">
        <Link
          to={`/orgs/${workspace.organizationId}/workspaces/${workspace.id}`}
          className={`
            flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors
            ${isActive
              ? 'bg-indigo-50 text-indigo-700 font-medium'
              : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}
          `}
          title={workspace.displayName}
        >
          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${workspace.status === 'ACTIVE' ? 'bg-green-500' : 'bg-gray-300'}`} />
          <span className={`flex-1 truncate transition-opacity duration-200 ${isOpen ? 'opacity-100' : 'opacity-0 hidden'}`}>
            {workspace.displayName}
          </span>
        </Link>

        {/* 더보기 버튼 */}
        {isOpen && (
          <div ref={menuRef}>
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setMenuOpen(!menuOpen);
              }}
              className="absolute right-1 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded opacity-0 group-hover:opacity-100 transition-opacity"
              title="더보기"
            >
              <MoreHorizontal size={14} />
            </button>

            {/* 드롭다운 메뉴 */}
            {menuOpen && (
              <div className="absolute right-0 top-full mt-1 w-36 bg-white border border-gray-200 rounded-lg shadow-lg z-50 py-1">
                <button
                  onClick={handleEditClick}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <Pencil size={14} />
                  이름 수정
                </button>
                <button
                  onClick={handleDeleteClick}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                >
                  <Trash2 size={14} />
                  삭제
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 수정 모달 */}
      {editModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setEditModalOpen(false)} />
          <div className="relative bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">워크스페이스 이름 수정</h3>
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="w-full px-4 py-3 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
              placeholder="워크스페이스 이름"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSave();
                if (e.key === 'Escape') setEditModalOpen(false);
              }}
            />
            {editError && (
              <p className="text-sm text-red-600 mt-2">{editError}</p>
            )}
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setEditModalOpen(false)}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                취소
              </button>
              <button
                onClick={handleSave}
                disabled={!editName.trim() || updateMutation.isPending}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              >
                {updateMutation.isPending ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 삭제 확인 모달 */}
      {deleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setDeleteModalOpen(false)} />
          <div className="relative bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4">
            <div className="flex items-start gap-4 mb-4">
              <div className="w-12 h-12 flex items-center justify-center bg-red-100 text-red-600 rounded-full shrink-0">
                <Trash2 size={24} />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">워크스페이스 삭제</h3>
                <p className="text-sm text-gray-500 mt-1">
                  <strong>{workspace.displayName}</strong>을(를) 삭제하시겠습니까?
                </p>
              </div>
            </div>
            <div className="p-4 mb-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800">
                ⚠️ 이 작업은 취소할 수 없습니다. 워크스페이스의 모든 프롬프트와 데이터가 비활성화됩니다.
              </p>
            </div>
            {deleteError && (
              <p className="text-sm text-red-600 mb-4">{deleteError}</p>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteModalOpen(false)}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                취소
              </button>
              <button
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {deleteMutation.isPending ? '삭제 중...' : '삭제'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function SidebarItem({ icon, label, to, active, isOpen }: { icon: ReactNode, label: string, to: string, active: boolean, isOpen: boolean }) {
  return (
    <Link
      to={to}
      className={`
        flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors group
        ${active
          ? 'bg-indigo-50 text-indigo-700'
          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}
      `}
      title={label}
    >
      <span className={active ? 'text-indigo-600' : 'text-gray-400 group-hover:text-gray-600'}>
        {icon}
      </span>
      <span className={`font-medium transition-opacity duration-200 ${isOpen ? 'opacity-100' : 'opacity-0 hidden'}`}>
        {label}
      </span>
    </Link>
  );
}

function UserProfile({ isOpen }: { isOpen: boolean }) {
  const { user, logout } = useAuthStore();

  return (
    <div className={`flex items-center ${isOpen ? 'justify-between w-full' : 'justify-center'}`}>
      <div className="flex items-center gap-3 overflow-hidden">
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-sm font-medium flex-shrink-0">
          {user?.name?.charAt(0).toUpperCase() || <User size={16} />}
        </div>
        {isOpen && (
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{user?.name}</p>
            <p className="text-xs text-gray-500 truncate">{user?.email}</p>
          </div>
        )}
      </div>
      {isOpen && (
        <button
          onClick={logout}
          className="text-gray-400 hover:text-red-500 transition-colors p-1"
          title="로그아웃"
        >
          <LogOut size={16} />
        </button>
      )}
    </div>
  );
}

function Header({ toggleSidebar }: { toggleSidebar: () => void }) {
  return (
    <header className="h-16 bg-white border-b border-gray-200 px-6 flex items-center justify-between sticky top-0 z-10">
      <div className="flex items-center gap-4">
        <button
          onClick={toggleSidebar}
          className="text-gray-500 hover:text-gray-700 p-1.5 rounded-md hover:bg-gray-100 transition-colors"
        >
          <Menu size={20} />
        </button>

        {/* Breadcrumb could go here */}
      </div>

      <div className="flex items-center gap-4">
        <div className="relative hidden md:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input
            type="text"
            placeholder="검색..."
            className="pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none w-64 transition-all"
          />
        </div>
        <button className="relative text-gray-400 hover:text-gray-600 p-2 rounded-full hover:bg-gray-100 transition-colors">
          <Bell size={20} />
          <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white" />
        </button>
      </div>
    </header>
  );
}
