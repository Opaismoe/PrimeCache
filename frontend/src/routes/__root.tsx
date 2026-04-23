import type { QueryClient } from '@tanstack/react-query';
import { useQueryClient } from '@tanstack/react-query';
import {
  createRootRouteWithContext,
  Link,
  Outlet,
  useRouter,
  useRouterState,
} from '@tanstack/react-router';
import {
  Activity,
  BarChart3,
  Globe,
  LayoutDashboard,
  Moon,
  Settings,
  Sun,
  Terminal,
  Webhook,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import logo from '../assets/logo.png';
import { ApiKeyModal } from '../components/ApiKeyModal';
import { me } from '../lib/api';
import { authEvents } from '../lib/events';

interface RouterContext {
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
});

function useTheme() {
  const [dark, setDark] = useState(() => {
    const stored = localStorage.getItem('theme');
    return stored ? stored === 'dark' : true;
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('theme', dark ? 'dark' : 'light');
  }, [dark]);

  return { dark, toggle: () => setDark((d) => !d) };
}

function RootLayout() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const routerState = useRouterState();
  const isPublicRoute = routerState.location.pathname === '/status';
  // null = loading (checking session), true = logged in, false = not logged in
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);
  const [forceShowLogin, setForceShowLogin] = useState(false);
  const shouldShowModal = (!isPublicRoute && loggedIn === false) || forceShowLogin;
  const { dark, toggle } = useTheme();

  useEffect(() => {
    me()
      .then(() => setLoggedIn(true))
      .catch(() => setLoggedIn(false));
  }, []);

  useEffect(() => {
    return authEvents.onUnauthorized(() => setLoggedIn(false));
  }, []);

  const handleSave = () => {
    setLoggedIn(true);
    setForceShowLogin(false);
    queryClient.invalidateQueries();
    router.invalidate();
  };

  return (
    <TooltipProvider>
      <Toaster />
      <div className="flex min-h-screen bg-background text-foreground">
        <Sidebar
          loggedIn={loggedIn === true}
          isPublicRoute={isPublicRoute}
          dark={dark}
          toggleTheme={toggle}
          onSignIn={() => setForceShowLogin(true)}
        />
        <div className="flex min-w-0 flex-1 flex-col">
          {shouldShowModal && <ApiKeyModal onSave={handleSave} />}
          <main className="flex-1 px-6 py-6">{!shouldShowModal && <Outlet />}</main>
        </div>
      </div>
    </TooltipProvider>
  );
}

function Sidebar({
  loggedIn,
  isPublicRoute,
  dark,
  toggleTheme,
  onSignIn,
}: {
  loggedIn: boolean;
  isPublicRoute: boolean;
  dark: boolean;
  toggleTheme: () => void;
  onSignIn: () => void;
}) {
  const showAdmin = loggedIn && !isPublicRoute;

  return (
    <aside className="flex w-56 flex-shrink-0 flex-col border-r border-border bg-card">
      {/* Brand */}
      <div className="flex items-center gap-2.5 border-b border-border px-4 py-4">
        <img src={logo} alt="PrimeCache" width={24} height={24} className="shrink-0" />
        <div className="min-w-0">
          <div className="text-sm font-semibold leading-tight">PrimeCache</div>
          <div className="font-mono text-[10px] text-muted-foreground">self-hosted</div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-3">
        {/* Workspace section */}
        <div className="mb-1 px-2 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
          Workspace
        </div>
        {loggedIn && !isPublicRoute && (
          <>
            <SideLink to="/" icon={<LayoutDashboard className="h-3.5 w-3.5" />} label="Dashboard" />
            <SideLink to="/groups" icon={<BarChart3 className="h-3.5 w-3.5" />} label="Projects" />
            <SideLink to="/history" icon={<Activity className="h-3.5 w-3.5" />} label="History" />
          </>
        )}
        <SideLink to="/status" icon={<Globe className="h-3.5 w-3.5" />} label="Status" />

        {/* Admin section */}
        {showAdmin && (
          <>
            <div className="mb-1 mt-4 px-2 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
              Admin
            </div>
            <SideLink
              to="/admin"
              icon={<Settings className="h-3.5 w-3.5" />}
              label="Groups"
              exactActive
            />
            <SideLink
              href="/admin?section=webhooks"
              icon={<Webhook className="h-3.5 w-3.5" />}
              label="Webhooks"
            />
            <SideLink
              href="/admin?section=api"
              icon={<Terminal className="h-3.5 w-3.5" />}
              label="API"
            />
            <SideLink
              href="/admin?section=settings"
              icon={<Settings className="h-3.5 w-3.5" />}
              label="Settings"
            />
          </>
        )}
      </nav>

      {/* Footer */}
      <div className="border-t border-border px-3 py-3">
        <div className="flex items-center justify-between">
          {loggedIn ? (
            <span className="text-xs text-muted-foreground">Admin</span>
          ) : (
            <button
              type="button"
              onClick={onSignIn}
              className="text-xs text-primary hover:underline"
            >
              Sign in
            </button>
          )}
          <button
            type="button"
            onClick={toggleTheme}
            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Toggle theme"
          >
            {dark ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>
    </aside>
  );
}

function SideLink({
  to,
  href,
  icon,
  label,
  exactActive,
}: {
  to?: string;
  href?: string;
  icon: React.ReactNode;
  label: string;
  exactActive?: boolean;
}) {
  const routerState = useRouterState();
  const currentPath = routerState.location.pathname;
  const rawSearch = typeof window !== 'undefined' ? window.location.search : '';

  let isActive: boolean;
  if (href) {
    const [hrefPath, hrefQuery = ''] = href.split('?');
    isActive = currentPath === hrefPath && (hrefQuery === '' || rawSearch.includes(hrefQuery));
  } else if (exactActive) {
    isActive = currentPath === to && !rawSearch.includes('section=');
  } else {
    isActive = currentPath === to || currentPath.startsWith(`${to ?? ''}/`);
  }

  const cls = `mb-0.5 flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors ${
    isActive
      ? 'bg-muted font-medium text-foreground'
      : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
  }`;

  const inner = (
    <>
      <span className="shrink-0">{icon}</span>
      <span>{label}</span>
    </>
  );

  if (href) {
    return (
      <a href={href} className={cls}>
        {inner}
      </a>
    );
  }

  if (!to) return null;

  return (
    <Link to={to} className={cls}>
      {inner}
    </Link>
  );
}
