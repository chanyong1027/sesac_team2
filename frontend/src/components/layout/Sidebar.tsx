import { Link, useLocation, useParams } from 'react-router-dom';
import { 
  LayoutDashboard, 
  FileText, 
  ScrollText, 
  Settings,
  Ship
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: 'dashboard' },
  { icon: FileText, label: 'Prompts', path: 'prompts' },
  { icon: ScrollText, label: 'Logs', path: 'logs' },
];

const settingsItems = [
  { label: 'API Keys', path: 'settings/api-keys' },
  { label: 'Provider Keys', path: 'settings/provider-keys' },
  { label: 'Members', path: 'settings/members' },
];

export function Sidebar() {
  const location = useLocation();
  const { workspaceId } = useParams();

  const isActive = (path: string) => {
    return location.pathname.includes(`/${path}`);
  };

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 border-r bg-card">
      <div className="flex h-full flex-col">
        {/* Logo */}
        <div className="flex h-16 items-center gap-2 border-b px-6">
          <Ship className="h-6 w-6 text-primary" />
          <span className="text-xl font-bold">PromptDock</span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 p-4">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={`/w/${workspaceId}/${item.path}`}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                isActive(item.path)
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </Link>
          ))}

          {/* Settings Section */}
          <div className="pt-4">
            <div className="flex items-center gap-3 px-3 py-2 text-xs font-semibold text-muted-foreground">
              <Settings className="h-4 w-4" />
              SETTINGS
            </div>
            {settingsItems.map((item) => (
              <Link
                key={item.path}
                to={`/w/${workspaceId}/${item.path}`}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 pl-10 text-sm font-medium transition-colors',
                  isActive(item.path)
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                )}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </nav>

        {/* Footer */}
        <div className="border-t p-4">
          <Link
            to="/onboarding"
            className="flex items-center justify-center rounded-lg bg-primary/10 px-3 py-2 text-sm font-medium text-primary hover:bg-primary/20"
          >
            Quick Setup Guide
          </Link>
        </div>
      </div>
    </aside>
  );
}
