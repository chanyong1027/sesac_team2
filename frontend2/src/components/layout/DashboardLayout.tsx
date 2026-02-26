import { type ReactNode, useMemo, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { useAuthStore } from '@/features/auth/store';
import { useOrganizationWorkspaces } from '@/features/workspace/hooks/useOrganizationWorkspaces';
import { useOrganizationStore } from '@/features/organization/store/organizationStore';
import { useQuery } from '@tanstack/react-query';
import { organizationApi } from '@/api/organization.api';
import {
  LayoutDashboard,
  Plus,
  LogOut,
  User,
  Bell,
  Menu,
  Shield,
  BarChart3,
  HelpCircle,
  X
} from 'lucide-react';
import { CreateOrganizationModal } from '@/features/organization/components/CreateOrganizationModal';
import { ThemeToggle } from '@/features/theme/components/ThemeToggle';

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isOrgModalOpen, setIsOrgModalOpen] = useState(false);
  const { orgId } = useParams<{ orgId: string }>();
  const { currentOrgId } = useOrganizationStore();
  const resolvedOrgId = orgId ? Number(orgId) : currentOrgId ?? null;

  return (
    <div className="h-screen overflow-hidden flex bg-[var(--background)] text-[var(--foreground)] relative">
      {/* Background glow (v2 mock) */}
      <div className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-sky-200/50 via-[var(--background)] to-[var(--background)] dark:from-indigo-900/30" />

      {/* Desktop Sidebar */}
      <Sidebar
        mode="desktop"
        orgId={resolvedOrgId}
        onCreateOrg={() => setIsOrgModalOpen(true)}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
      />

      {/* Mobile Sidebar Overlay + Drawer */}
      {isMobileSidebarOpen ? (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setIsMobileSidebarOpen(false)}
            aria-label="Close sidebar overlay"
          />
          <div className="absolute inset-y-0 left-0 w-72 max-w-[85vw]">
            <Sidebar
              mode="mobile"
              orgId={resolvedOrgId}
              onCreateOrg={() => setIsOrgModalOpen(true)}
              onCloseMobile={() => setIsMobileSidebarOpen(false)}
            />
          </div>
        </div>
      ) : null}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative z-10">
        <Header onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)} />

        <main className="flex-1 overflow-y-auto">
          <div className="p-6 md:p-8">
            <div className="max-w-7xl mx-auto">
              {children}
            </div>
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

function Sidebar({
  mode,
  onCreateOrg,
  onCloseMobile,
  orgId,
}: {
  mode: 'desktop' | 'mobile';
  onCreateOrg: () => void;
  onCloseMobile: () => void;
  orgId: number | null;
}) {
  const location = useLocation();
  const variant: 'workspace' | 'org' = location.pathname.includes('/workspaces/') ? 'workspace' : 'org';
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

  const settingsItems = [
    {
      to: `${basePath}/settings/security`,
      label: '조직 및 보안',
      icon: <User size={20} />,
      active: isActive(`${basePath}/settings/security`) || isActive(`${basePath}/settings/members`) || isActive(`${basePath}/settings/api-keys`),
    },
    {
      to: `${basePath}/settings/provider-keys`,
      label: 'Provider 키',
      icon: <Shield size={20} />,
      active: isActive(`${basePath}/settings/provider-keys`),
    },
  ];

  return (
    <aside
      className={`
        ${mode === 'desktop' ? 'hidden md:flex' : 'flex'}
        ${variant === 'workspace' ? 'bg-[var(--sidebar)] border-r border-[var(--sidebar-border)]' : 'glass-panel'}
        flex-col
        ${variant === 'workspace' ? 'w-64' : 'w-72'}
      `}
    >
      {/* Logo */}
      <div className={`h-16 flex items-center px-6 border-b ${variant === 'workspace' ? 'border-[var(--sidebar-border)]' : 'border-[var(--sidebar-border)]'} gap-3`}>
        <Link to={dashboardPath} className="flex items-center gap-3 overflow-hidden">
          {variant === 'workspace' ? (
            <>
              <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-[var(--primary)] to-fuchsia-500 shadow-[0_0_15px_rgba(168,85,247,0.4)]" />
              <span className="font-bold text-lg tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-[var(--foreground)] to-[var(--text-secondary)]">
                LuminaOps
              </span>
            </>
          ) : (
            <>
              <div className="size-9 bg-[color:rgba(168,85,247,0.20)] border border-[color:rgba(168,85,247,0.50)] rounded-xl flex items-center justify-center text-[var(--primary)] shadow-[0_0_15px_rgba(168,85,247,0.25)]">
                <span className="text-sm font-extrabold tracking-tight">✦</span>
              </div>
              <span className="text-lg font-bold tracking-tight text-[var(--foreground)]">LuminaOps</span>
            </>
          )}
        </Link>

        {mode === 'mobile' ? (
          <button
            type="button"
            onClick={onCloseMobile}
            className="ml-auto p-2 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--sidebar-accent)] hover:text-[var(--foreground)] transition-colors"
            aria-label="Close sidebar"
          >
            <X size={18} />
          </button>
        ) : null}
      </div>

      <div className={`px-6 py-4 border-b ${variant === 'workspace' ? 'border-[var(--sidebar-border)]' : 'border-[var(--sidebar-border)]'}`}>
        <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mb-3">
          Organization
        </p>
        <button
          type="button"
          className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl bg-[var(--muted)] border border-[var(--border)] hover:border-[var(--ring)] transition-all group"
        >
          <span className="font-medium text-sm text-[var(--foreground)] truncate">
            {orgDetail?.name ?? '조직 정보 불러오는 중...'}
          </span>
          <span className="text-xs text-[var(--text-secondary)]">▾</span>
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 flex flex-col gap-2 overflow-y-auto">
        <p className="px-2 mt-2 mb-1 text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">Menu</p>
        <SidebarItem
          icon={<LayoutDashboard size={20} />}
          label="대시보드"
          to={dashboardPath}
          active={location.pathname === dashboardPath}
        />
        <SidebarItem
          icon={<BarChart3 size={20} />}
          label="통계"
          to={`${basePath}/stats`}
          active={isActive(`${basePath}/stats`)}
        />

        {/* Workspace Section */}
        <div className="mt-8 mb-2 px-3 flex items-center justify-between">
          <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">
            Workspaces
          </span>
          <button
            type="button"
            onClick={onCreateOrg}
            className="text-[var(--text-secondary)] hover:text-[var(--primary)] transition-colors"
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
                  ? 'bg-[var(--sidebar-accent)] text-[var(--foreground)] border border-[var(--border)]'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--sidebar-accent)] hover:text-[var(--foreground)]'}
              `}
              title={ws.displayName}
            >
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${ws.status === 'ACTIVE' ? 'bg-green-500' : 'bg-gray-500'}`} />
              <span className="truncate">
                {ws.displayName}
              </span>
            </Link>
          ))}

          {workspaces && workspaces.length > 5 && (
            <div className="px-3 py-1 text-xs text-[var(--text-secondary)]">
              + {workspaces.length - 5} more
            </div>
          )}
        </div>

        <div className="mt-8 mb-2 px-3">
          <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">
            Settings
          </span>
        </div>
        <div className="space-y-1">
          {settingsItems.map((item) => (
            <SidebarItem
              key={item.to}
              icon={item.icon}
              label={item.label}
              to={item.to}
              active={item.active}
            />
          ))}
        </div>
      </nav>

      {/* User Profile */}
      <div className="p-4 border-t border-[var(--sidebar-border)]">
        <UserProfile />
      </div>
    </aside>
  );
}

function SidebarItem({ icon, label, to, active }: { icon: ReactNode, label: string, to: string, active: boolean }) {
  return (
    <Link
      to={to}
      className={`
        group flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors border
        ${active ? 'bg-[color:rgba(168,85,247,0.20)] text-[var(--foreground)] border-[color:rgba(168,85,247,0.40)] shadow-[0_0_15px_rgba(168,85,247,0.25)]' : 'border-transparent text-[var(--text-secondary)] hover:bg-[var(--sidebar-accent)] hover:text-[var(--foreground)] hover:border-[var(--border)]'}
      `}
      title={label}
    >
      <span className={active ? 'text-[var(--primary)]' : 'text-[var(--text-secondary)] group-hover:text-[var(--primary)]'}>
        {icon}
      </span>
      <span className="text-sm font-medium">{label}</span>
    </Link>
  );
}

function UserProfile() {
  const { user, logout } = useAuthStore();

  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <div className="relative">
          <div className="size-9 rounded-full bg-[color:rgba(146,19,236,0.25)] flex items-center justify-center text-[var(--primary)] font-bold">
            {user?.name?.charAt(0).toUpperCase() || <User size={16} />}
          </div>
          <div className="absolute bottom-0 right-0 size-2.5 bg-green-500 border-2 border-[var(--sidebar)] rounded-full" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[var(--foreground)] truncate">{user?.name ?? 'User'}</p>
          <p className="text-xs text-[var(--text-secondary)] truncate">{user?.email ?? ''}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={logout}
        className="text-[var(--text-secondary)] hover:text-rose-400 dark:hover:text-rose-300 transition-colors p-2 rounded-lg hover:bg-[var(--sidebar-accent)]"
        title="로그아웃"
      >
        <LogOut size={18} />
      </button>
    </div>
  );
}

function Header({ onOpenMobileSidebar }: { onOpenMobileSidebar: () => void }) {
  const location = useLocation();
  const isWorkspaceRoute = location.pathname.includes('/workspaces/');

  const breadcrumb = useMemo(() => {
    const path = location.pathname;
    if (path.includes('/settings/security')) return { section: '설정', page: '조직 및 보안' };
    if (path.includes('/settings/provider-keys')) return { section: '설정', page: 'Provider 키' };
    if (path.includes('/settings/')) return { section: '설정', page: '조직 설정' };
    if (path.includes('/stats')) return { section: '통계', page: '대시보드' };
    if (path.includes('/workspaces/')) return { section: '워크스페이스', page: '대시보드' };
    return { section: '대시보드', page: '개요' };
  }, [location.pathname]);

  return (
    <header className="h-16 flex items-center justify-between px-6 md:px-8 border-b border-[var(--border)] bg-[color:rgba(248,250,252,0.80)] dark:bg-[color:rgba(19,17,28,0.60)] backdrop-blur-xl sticky top-0 z-30">
      <div className="flex items-center gap-3 text-sm">
        <button
          type="button"
          onClick={onOpenMobileSidebar}
          className="md:hidden p-2 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--sidebar-accent)] hover:text-[var(--foreground)] transition-colors"
          aria-label="Open sidebar"
        >
          <Menu size={20} />
        </button>

        <span className="text-[var(--text-secondary)] hover:text-[var(--foreground)] transition-colors cursor-pointer">{breadcrumb.section}</span>
        <span className="text-[var(--text-secondary)]/30 text-xs">/</span>
        <span className="font-semibold tracking-wide text-[var(--foreground)]">{breadcrumb.page}</span>
      </div>

      <div className="flex items-center gap-3">
        {isWorkspaceRoute ? (
          <div className="relative hidden md:block">
            <input
              type="text"
              placeholder="검색 (Cmd+K)"
              className="bg-[var(--card)] border border-[var(--border)] rounded-full py-1.5 pl-4 pr-10 text-sm text-[var(--foreground)] focus:ring-1 focus:ring-[var(--primary)] focus:border-[var(--primary)] placeholder-[var(--text-secondary)] w-64 transition-all"
            />
            <span className="material-symbols-outlined absolute right-3 top-1.5 text-[var(--text-tertiary)] text-lg">search</span>
          </div>
        ) : null}
        <button
          type="button"
          className="relative p-2 text-[var(--text-secondary)] hover:text-[var(--foreground)] transition-colors rounded-lg"
          aria-label="Notifications"
        >
          <Bell size={20} />
          <span className="absolute top-2 right-2 size-2 bg-red-500 rounded-full border-2 border-[var(--background)] shadow-[0_0_8px_rgba(239,68,68,0.6)]" />
        </button>
        <ThemeToggle />
        <div className="h-6 w-px bg-[var(--border)] hidden sm:block" />
        <Link
          to="/guide"
          className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-[var(--border)] bg-[var(--muted)] text-[var(--text-secondary)] hover:text-[var(--foreground)] hover:bg-[var(--accent)] transition-colors text-xs font-medium backdrop-blur-md"
        >
          <HelpCircle size={18} />
          <span className="hidden sm:inline">가이드</span>
        </Link>
      </div>
    </header>
  );
}
