import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useWorkspaces } from '@/features/workspace/hooks/useWorkspaces';
import { useAuthStore } from '@/features/auth/store';
import { CreateOrganizationModal } from '@/features/organization/components/CreateOrganizationModal';
import type { WorkspaceSummaryResponse } from '@/types/api.types';

// ═══════════════════════════════════════════════════════════════════════════════
// AMBIENT AURORA BACKGROUND (Simplified for Dashboard)
// ═══════════════════════════════════════════════════════════════════════════════

function AmbientAurora() {
  const [time, setTime] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setTime(t => t + 0.015), 50);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden">
      {/* Deep ocean base */}
      <div
        className="absolute inset-0"
        style={{
          background: `
            linear-gradient(135deg,
              oklch(0.06 0.02 220) 0%,
              oklch(0.04 0.025 200) 50%,
              oklch(0.03 0.02 180) 100%
            )
          `
        }}
      />

      {/* Subtle noise texture */}
      <div
        className="absolute inset-0 opacity-[0.025]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Floating aurora orbs - very subtle */}
      <div
        className="absolute w-[800px] h-[800px] -top-[200px] -right-[200px]"
        style={{
          background: `
            radial-gradient(ellipse 50% 50% at 50% 50%,
              oklch(0.35 0.12 180 / 0.12) 0%,
              oklch(0.3 0.1 195 / 0.06) 40%,
              transparent 70%
            )
          `,
          filter: 'blur(80px)',
          transform: `translate(${Math.sin(time * 0.5) * 20}px, ${Math.cos(time * 0.3) * 15}px)`,
        }}
      />

      <div
        className="absolute w-[600px] h-[600px] -bottom-[100px] -left-[150px]"
        style={{
          background: `
            radial-gradient(ellipse 60% 50% at 50% 50%,
              oklch(0.4 0.15 165 / 0.1) 0%,
              oklch(0.3 0.12 175 / 0.05) 50%,
              transparent 70%
            )
          `,
          filter: 'blur(60px)',
          transform: `translate(${Math.cos(time * 0.4) * 15}px, ${Math.sin(time * 0.6) * 10}px)`,
        }}
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SIDEBAR NAVIGATION
// ═══════════════════════════════════════════════════════════════════════════════

function Sidebar({
  workspaces,
  onCreateNew
}: {
  workspaces: WorkspaceSummaryResponse[] | undefined;
  onCreateNew: () => void;
}) {
  return (
    <aside
      className="fixed left-0 top-0 bottom-0 w-72 flex flex-col z-40"
      style={{
        background: 'oklch(0.08 0.02 210 / 0.8)',
        backdropFilter: 'blur(20px)',
        borderRight: '1px solid oklch(1 0 0 / 0.06)',
      }}
    >
      {/* Logo */}
      <div className="px-6 py-6 border-b border-white/5">
        <Link to="/" className="flex items-center gap-3 group">
          <div className="relative w-9 h-9">
            <div
              className="absolute inset-0 transition-opacity group-hover:opacity-100 opacity-80"
              style={{
                background: 'linear-gradient(135deg, oklch(0.7 0.15 180), oklch(0.65 0.18 160))',
              }}
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <span
                className="text-base font-semibold"
                style={{ fontFamily: "'JetBrains Mono', monospace", color: 'oklch(0.03 0.02 200)' }}
              >
                L
              </span>
            </div>
          </div>
          <span
            className="text-lg tracking-tight"
            style={{ fontFamily: "'Crimson Pro', serif", fontWeight: 400 }}
          >
            <span className="text-white/90">Lumina</span>
            <span style={{ color: 'oklch(0.7 0.15 180)' }}>Ops</span>
          </span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-6 overflow-y-auto">
        {/* Main nav items */}
        <div className="space-y-1 mb-8">
          <NavItem icon="◇" label="대시보드" active />
          <NavItem icon="⬡" label="프롬프트" />
          <NavItem icon="◈" label="문서" />
          <NavItem icon="▣" label="로그" />
        </div>

        {/* Workspaces section */}
        <div className="mb-4">
          <div className="flex items-center justify-between px-3 mb-3">
            <span
              className="text-[10px] uppercase tracking-[0.2em] text-white/30"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              워크스페이스
            </span>
            <button
              onClick={onCreateNew}
              className="text-white/30 hover:text-white/70 transition-colors text-lg leading-none"
            >
              +
            </button>
          </div>

          <div className="space-y-1">
            {workspaces?.slice(0, 5).map((ws) => (
              <Link
                key={ws.id}
                to={`/workspaces/${ws.id}`}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-white/50 hover:text-white/90 hover:bg-white/5 transition-all group"
              >
                <span
                  className="w-2 h-2 rounded-full"
                  style={{
                    background: ws.status === 'ACTIVE'
                      ? 'oklch(0.7 0.18 160)'
                      : 'oklch(0.4 0.05 200)',
                  }}
                />
                <span
                  className="text-sm truncate flex-1"
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                >
                  {ws.displayName}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </nav>

      {/* Bottom section */}
      <div className="px-4 py-4 border-t border-white/5">
        <Link
          to="/settings"
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-white/50 hover:text-white/90 hover:bg-white/5"
        >
          <span className="text-sm opacity-60">⚙</span>
          <span
            className="text-sm"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            설정
          </span>
        </Link>
      </div>
    </aside>
  );
}

function NavItem({
  icon,
  label,
  active = false
}: {
  icon: string;
  label: string;
  active?: boolean;
}) {
  return (
    <button
      className={`
        w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all
        ${active
          ? 'bg-white/10 text-white'
          : 'text-white/50 hover:text-white/90 hover:bg-white/5'
        }
      `}
    >
      <span className="text-sm opacity-60">{icon}</span>
      <span
        className="text-sm"
        style={{ fontFamily: "'JetBrains Mono', monospace" }}
      >
        {label}
      </span>
      {active && (
        <span
          className="ml-auto w-1.5 h-1.5 rounded-full"
          style={{ background: 'oklch(0.7 0.15 180)' }}
        />
      )}
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// HEADER
// ═══════════════════════════════════════════════════════════════════════════════

function Header() {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);

  return (
    <header
      className="fixed top-0 right-0 left-72 z-30 px-8 py-4"
      style={{
        background: 'oklch(0.05 0.02 210 / 0.6)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid oklch(1 0 0 / 0.05)',
      }}
    >
      <div className="flex items-center justify-between">
        {/* Breadcrumb / Page title */}
        <div className="flex items-center gap-3">
          <span
            className="text-[11px] uppercase tracking-[0.15em] text-white/30"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            Overview
          </span>
          <span className="text-white/20">/</span>
          <span
            className="text-[11px] uppercase tracking-[0.15em] text-white/50"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            Workspaces
          </span>
        </div>

        {/* User section */}
        <div className="flex items-center gap-6">
          {/* Notifications placeholder */}
          <button className="relative text-white/40 hover:text-white/70 transition-colors">
            <span className="text-lg">◉</span>
            <span
              className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full"
              style={{ background: 'oklch(0.7 0.2 25)' }}
            />
          </button>

          {/* User avatar & info */}
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium"
              style={{
                background: 'linear-gradient(135deg, oklch(0.5 0.12 180), oklch(0.45 0.14 200))',
                color: 'white',
                fontFamily: "'JetBrains Mono', monospace",
              }}
            >
              {user?.name?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className="hidden sm:block">
              <div
                className="text-sm text-white/80"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
                {user?.name || 'User'}
              </div>
            </div>
          </div>

          {/* Logout */}
          <button
            onClick={logout}
            className="text-[11px] text-white/40 hover:text-white/70 transition-colors px-3 py-1.5 rounded border border-white/10 hover:border-white/20"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            로그아웃
          </button>
        </div>
      </div>
    </header>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// WORKSPACE CARD (Redesigned)
// ═══════════════════════════════════════════════════════════════════════════════

function WorkspaceCardNew({ workspace }: { workspace: WorkspaceSummaryResponse }) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <Link
      to={`/workspaces/${workspace.id}`}
      className="group relative block"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Glow effect on hover */}
      <div
        className="absolute -inset-px rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        style={{
          background: 'linear-gradient(135deg, oklch(0.5 0.15 180 / 0.3), oklch(0.45 0.12 200 / 0.2))',
          filter: 'blur(8px)',
        }}
      />

      {/* Card */}
      <div
        className="relative p-6 rounded-lg transition-all duration-300"
        style={{
          background: isHovered
            ? 'oklch(0.12 0.025 200 / 0.9)'
            : 'oklch(0.1 0.02 210 / 0.8)',
          border: '1px solid oklch(1 0 0 / 0.08)',
          backdropFilter: 'blur(8px)',
        }}
      >
        {/* Status indicator line */}
        <div
          className="absolute top-0 left-6 right-6 h-px"
          style={{
            background: workspace.status === 'ACTIVE'
              ? 'linear-gradient(90deg, transparent, oklch(0.7 0.18 165), transparent)'
              : 'linear-gradient(90deg, transparent, oklch(0.4 0.05 200), transparent)',
          }}
        />

        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1 min-w-0">
            <h3
              className="text-xl text-white/90 group-hover:text-white transition-colors truncate"
              style={{ fontFamily: "'Crimson Pro', serif", fontWeight: 400 }}
            >
              {workspace.displayName}
            </h3>
            <p
              className="text-xs text-white/30 mt-1 truncate"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              {workspace.name}
            </p>
          </div>

          {/* Role badge */}
          <span
            className="px-2.5 py-1 text-[10px] uppercase tracking-wider rounded"
            style={{
              background: 'oklch(0.5 0.12 180 / 0.15)',
              color: 'oklch(0.75 0.12 180)',
              fontFamily: "'JetBrains Mono', monospace",
            }}
          >
            {workspace.myRole}
          </span>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 border-t border-white/5">
          <span
            className="text-[11px] text-white/30"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            {new Date(workspace.createdAt).toLocaleDateString('ko-KR', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            })}
          </span>

          <div className="flex items-center gap-2">
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{
                background: workspace.status === 'ACTIVE'
                  ? 'oklch(0.7 0.18 160)'
                  : 'oklch(0.4 0.05 200)',
                boxShadow: workspace.status === 'ACTIVE'
                  ? '0 0 8px oklch(0.7 0.18 160 / 0.5)'
                  : 'none',
              }}
            />
            <span
              className="text-[10px] uppercase tracking-wider"
              style={{
                color: workspace.status === 'ACTIVE'
                  ? 'oklch(0.7 0.15 160)'
                  : 'oklch(0.5 0.02 200)',
                fontFamily: "'JetBrains Mono', monospace",
              }}
            >
              {workspace.status}
            </span>
          </div>
        </div>

        {/* Hover arrow */}
        <div
          className="absolute right-4 top-1/2 -translate-y-1/2 text-white/0 group-hover:text-white/40 transition-all duration-300 group-hover:translate-x-1"
          style={{ fontFamily: "'JetBrains Mono', monospace" }}
        >
          →
        </div>
      </div>
    </Link>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// EMPTY STATE
// ═══════════════════════════════════════════════════════════════════════════════

function EmptyState({ onCreateNew }: { onCreateNew: () => void }) {
  return (
    <div className="relative flex flex-col items-center justify-center py-24 px-8">
      {/* Glow backdrop */}
      <div
        className="absolute w-[400px] h-[400px] opacity-30"
        style={{
          background: 'radial-gradient(circle, oklch(0.5 0.15 180 / 0.3) 0%, transparent 60%)',
          filter: 'blur(60px)',
        }}
      />

      {/* Icon */}
      <div
        className="relative w-20 h-20 mb-8 flex items-center justify-center"
        style={{
          background: 'oklch(0.12 0.03 200)',
          border: '1px solid oklch(1 0 0 / 0.1)',
          borderRadius: '20px',
        }}
      >
        <span className="text-3xl opacity-40">◇</span>
      </div>

      {/* Text */}
      <h3
        className="relative text-2xl text-white/70 mb-3 text-center"
        style={{ fontFamily: "'Crimson Pro', serif", fontWeight: 300 }}
      >
        아직 워크스페이스가 없습니다
      </h3>
      <p
        className="relative text-sm text-white/30 mb-8 text-center max-w-md"
        style={{ fontFamily: "'JetBrains Mono', monospace" }}
      >
        새 조직을 만들어 첫 워크스페이스를 시작하거나,<br />
        초대 링크를 통해 기존 워크스페이스에 참여하세요.
      </p>

      {/* CTA Button */}
      <button
        onClick={onCreateNew}
        className="relative group px-8 py-4 overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, oklch(0.6 0.15 180), oklch(0.55 0.18 165))',
        }}
      >
        <span
          className="relative z-10 text-sm font-medium tracking-wide"
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            color: 'oklch(0.03 0.02 200)',
          }}
        >
          + 새 조직 만들기
        </span>
        <div
          className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
          style={{
            background: 'linear-gradient(135deg, oklch(0.65 0.16 180), oklch(0.6 0.19 165))',
          }}
        />
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// LOADING STATE
// ═══════════════════════════════════════════════════════════════════════════════

function LoadingState() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
      {[...Array(6)].map((_, i) => (
        <div
          key={i}
          className="p-6 rounded-lg animate-pulse"
          style={{
            background: 'oklch(0.1 0.02 210 / 0.5)',
            border: '1px solid oklch(1 0 0 / 0.05)',
            animationDelay: `${i * 100}ms`,
          }}
        >
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <div
                className="h-6 w-3/4 rounded mb-2"
                style={{ background: 'oklch(0.15 0.02 200)' }}
              />
              <div
                className="h-3 w-1/2 rounded"
                style={{ background: 'oklch(0.12 0.02 200)' }}
              />
            </div>
            <div
              className="h-6 w-16 rounded"
              style={{ background: 'oklch(0.15 0.02 200)' }}
            />
          </div>
          <div className="pt-4 border-t border-white/5 flex justify-between">
            <div
              className="h-3 w-24 rounded"
              style={{ background: 'oklch(0.12 0.02 200)' }}
            />
            <div
              className="h-3 w-16 rounded"
              style={{ background: 'oklch(0.12 0.02 200)' }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════════

export function DashboardPage() {
  const { data: workspaces, isLoading } = useWorkspaces();
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <div className="min-h-screen text-white">
      {/* Google Fonts */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Crimson+Pro:wght@300;400;600&family=JetBrains+Mono:wght@300;400;500&display=swap');
      `}</style>

      {/* Background */}
      <AmbientAurora />

      {/* Sidebar */}
      <Sidebar
        workspaces={workspaces}
        onCreateNew={() => setIsModalOpen(true)}
      />

      {/* Header */}
      <Header />

      {/* Main Content */}
      <main className="ml-72 pt-20 min-h-screen">
        <div className="px-8 py-8">
          {/* Page Header */}
          <div className="flex items-end justify-between mb-10">
            <div>
              <h1
                className="text-4xl md:text-5xl font-light tracking-tight text-white/90"
                style={{ fontFamily: "'Crimson Pro', serif", fontWeight: 300 }}
              >
                워크스페이스
              </h1>
              <p
                className="mt-3 text-sm text-white/40"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
                {workspaces?.length || 0}개의 워크스페이스에 참여 중
              </p>
            </div>

            <button
              onClick={() => setIsModalOpen(true)}
              className="group relative px-6 py-3 overflow-hidden"
              style={{
                background: 'oklch(0.12 0.02 200)',
                border: '1px solid oklch(1 0 0 / 0.1)',
              }}
            >
              <span
                className="relative z-10 flex items-center gap-2 text-sm text-white/70 group-hover:text-white transition-colors"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
                <span className="text-lg leading-none">+</span>
                새 조직
              </span>
              <div
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
                style={{
                  background: 'linear-gradient(135deg, oklch(0.5 0.12 180 / 0.2), oklch(0.45 0.1 200 / 0.15))',
                }}
              />
            </button>
          </div>

          {/* Content */}
          {isLoading ? (
            <LoadingState />
          ) : workspaces && workspaces.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {workspaces.map((workspace) => (
                <WorkspaceCardNew key={workspace.id} workspace={workspace} />
              ))}
            </div>
          ) : (
            <EmptyState onCreateNew={() => setIsModalOpen(true)} />
          )}
        </div>
      </main>

      {/* Modal */}
      <CreateOrganizationModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </div>
  );
}
