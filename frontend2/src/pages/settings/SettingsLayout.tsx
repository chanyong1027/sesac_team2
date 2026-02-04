import { useEffect } from 'react';
import { Link, Outlet, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useAuthStore } from '@/features/auth/store';

// ═══════════════════════════════════════════════════════════════════════════════
// SETTINGS LAYOUT - Light Theme with Swiss Precision
// ═══════════════════════════════════════════════════════════════════════════════

export function SettingsLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { orgId } = useParams<{ orgId: string }>();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const basePath = orgId ? `/orgs/${orgId}` : '';
  const navigationItems = [
    { path: `${basePath}/settings/members`, label: '멤버', icon: '◎' },
    { path: `${basePath}/settings/api-keys`, label: 'API 키', icon: '⬡' },
    { path: `${basePath}/settings/provider-keys`, label: 'Provider 키', icon: '◈' },
  ];

  // 인증되지 않은 사용자는 로그인 페이지로
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  return (
    <div className="min-h-screen" style={{ background: '#FAFAFA' }}>
      {/* Google Fonts */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Newsreader:wght@300;400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap');

        .settings-container {
          font-family: 'IBM Plex Mono', monospace;
        }
        .settings-heading {
          font-family: 'Newsreader', serif;
        }
      `}</style>

      <div className="settings-container">
        {/* ════════════════════════════════════════════════════════════════════════ */}
        {/* TOP HEADER */}
        {/* ════════════════════════════════════════════════════════════════════════ */}
        <header
          className="fixed top-0 left-0 right-0 z-50 h-14 px-6 flex items-center justify-between"
          style={{
            background: 'rgba(255, 255, 255, 0.85)',
            backdropFilter: 'blur(12px)',
            borderBottom: '1px solid #E5E5E5',
          }}
        >
          {/* Logo & Back */}
          <div className="flex items-center gap-6">
            <Link
              to={basePath ? `${basePath}/dashboard` : '/dashboard'}
              className="flex items-center gap-2 text-neutral-400 hover:text-neutral-600 transition-colors"
            >
              <span className="text-sm">←</span>
              <span className="text-xs tracking-wide">대시보드</span>
            </Link>

            <div className="h-4 w-px bg-neutral-200" />

            <Link to="/" className="flex items-center gap-2">
              <div
                className="w-6 h-6 flex items-center justify-center text-xs font-medium text-white"
                style={{ background: 'linear-gradient(135deg, #0D9488, #14B8A6)' }}
              >
                L
              </div>
              <span className="settings-heading text-sm font-medium text-neutral-800">
                Lumina<span style={{ color: '#0D9488' }}>Ops</span>
              </span>
            </Link>
          </div>

          {/* User */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div
                className="w-7 h-7 flex items-center justify-center text-xs font-medium text-white"
                style={{ background: '#0D9488' }}
              >
                {user?.name?.charAt(0).toUpperCase() || 'U'}
              </div>
              <span className="text-xs text-neutral-600">{user?.name}</span>
            </div>
            <button
              onClick={logout}
              className="text-xs text-neutral-400 hover:text-neutral-600 transition-colors"
            >
              로그아웃
            </button>
          </div>
        </header>

        {/* ════════════════════════════════════════════════════════════════════════ */}
        {/* MAIN LAYOUT */}
        {/* ════════════════════════════════════════════════════════════════════════ */}
        <div className="flex pt-14">
          {/* SIDEBAR */}
          <aside
            className="fixed left-0 top-14 bottom-0 w-56 p-6"
            style={{
              background: '#FFFFFF',
              borderRight: '1px solid #E5E5E5',
            }}
          >
            <div className="mb-8">
              <h2 className="settings-heading text-lg font-medium text-neutral-900 tracking-tight">
                설정
              </h2>
              <p className="text-[11px] text-neutral-400 mt-1">
                조직 및 서비스 관리
              </p>
            </div>

            <nav className="space-y-1">
              {navigationItems.map((item) => {
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`
                      flex items-center gap-3 px-3 py-2.5 text-xs transition-all
                      ${isActive
                        ? 'text-teal-700 bg-teal-50'
                        : 'text-neutral-500 hover:text-neutral-800 hover:bg-neutral-50'
                      }
                    `}
                    style={{
                      borderLeft: isActive ? '2px solid #0D9488' : '2px solid transparent',
                    }}
                  >
                    <span className="opacity-60">{item.icon}</span>
                    <span className="tracking-wide">{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            {/* Bottom info */}
            <div className="absolute bottom-6 left-6 right-6">
              <div className="p-3 bg-neutral-50 border border-neutral-100">
                <p className="text-[10px] text-neutral-400 uppercase tracking-wider mb-1">
                  Organization
                </p>
                <p className="text-xs text-neutral-600 truncate">
                  {user?.name || 'My Organization'}
                </p>
              </div>
            </div>
          </aside>

          {/* CONTENT */}
          <main className="flex-1 ml-56 min-h-[calc(100vh-56px)]">
            <div className="max-w-4xl mx-auto px-8 py-10">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
