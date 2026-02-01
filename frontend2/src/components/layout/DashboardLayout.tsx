import { type ReactNode, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { useAuthStore } from '@/features/auth/store';
import { useOrganizationWorkspaces } from '@/features/workspace/hooks/useOrganizationWorkspaces';
import { useOrganizationStore } from '@/features/organization/store/organizationStore';
import {
  LayoutDashboard,
  Plus,
  LogOut,
  User,
  Bell,
  Search,
  Menu,
  Key,
  Shield
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

      {/* Navigation */}
      <nav className="flex-1 px-3 py-6 space-y-1 overflow-y-auto">
        <SidebarItem
          icon={<LayoutDashboard size={20} />}
          label="대시보드"
          to={dashboardPath}
          active={location.pathname === dashboardPath}
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
            <Link
              key={ws.id}
              to={`/orgs/${ws.organizationId}/workspaces/${ws.id}`}
              className={`
                flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors relative
                ${isActive(`/orgs/${ws.organizationId}/workspaces/${ws.id}`)
                  ? 'bg-indigo-50 text-indigo-700 font-medium'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}
              `}
              title={ws.displayName}
            >
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${ws.status === 'ACTIVE' ? 'bg-green-500' : 'bg-gray-300'}`} />
              <span className={`truncate transition-opacity duration-200 ${isOpen ? 'opacity-100' : 'opacity-0 hidden'}`}>
                {ws.displayName}
              </span>
            </Link>
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
