import type { QueryClient } from '@tanstack/react-query';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createRootRouteWithContext, Link, Outlet, useRouterState } from '@tanstack/react-router';
import { ChevronDown, Moon, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { TooltipProvider } from '@/components/ui/tooltip';
import logo from '../assets/logo.png';
import { ApiKeyModal } from '../components/ApiKeyModal';
import { getApiKey, getConfig } from '../lib/api';
import { authEvents } from '../lib/events';
import { queryKeys } from '../lib/queryKeys';

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
  const routerState = useRouterState();
  const isPublicRoute = routerState.location.pathname === '/status';
  const [loggedIn, setLoggedIn] = useState(() => !!getApiKey());
  const [forceShowLogin, setForceShowLogin] = useState(false);
  const shouldShowModal = (!isPublicRoute && !loggedIn) || forceShowLogin;
  const { dark, toggle } = useTheme();

  const { data: config } = useQuery({
    queryKey: queryKeys.config.all(),
    queryFn: getConfig,
    enabled: loggedIn,
  });
  const groups = config?.groups ?? [];

  useEffect(() => {
    return authEvents.onUnauthorized(() => setLoggedIn(false));
  }, []);

  const handleSave = () => {
    setLoggedIn(true);
    setForceShowLogin(false);
    queryClient.invalidateQueries();
  };

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-background text-foreground">
        {shouldShowModal && <ApiKeyModal onSave={handleSave} />}
        <nav className="border-b border-border bg-card">
          <div className="mx-auto flex max-w-7xl items-center gap-6 px-4 py-3">
            <span className="font-semibold">
              <img src={logo} alt="PrimeCache" width={32} height={32} />
            </span>
            <div className="ml-auto flex items-center gap-6">
              {loggedIn && !isPublicRoute && <NavLink to="/">Dashboard</NavLink>}
              {loggedIn && !isPublicRoute && groups.length > 0 && (
                <DetailsDropdown groups={groups} />
              )}
              {loggedIn && !isPublicRoute && <NavLink to="/config">Config</NavLink>}
              {loggedIn && !isPublicRoute && <NavLink to="/admin">Admin</NavLink>}
              <NavLink to="/status">Status</NavLink>
              {!loggedIn && (
                <Button variant="ghost" size="sm" onClick={() => setForceShowLogin(true)}>
                  Sign in
                </Button>
              )}
              <Button variant="ghost" size="icon" onClick={toggle} aria-label="Toggle theme">
                {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </nav>
        <main className="mx-auto max-w-7xl px-4 py-6">{!shouldShowModal && <Outlet />}</main>
      </div>
    </TooltipProvider>
  );
}

function NavLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      className="text-sm text-muted-foreground hover:text-foreground [&.active]:font-medium [&.active]:text-foreground"
    >
      {children}
    </Link>
  );
}

function DetailsDropdown({ groups }: { groups: { name: string }[] }) {
  const routerState = useRouterState();
  const isActive = routerState.location.pathname.startsWith('/groups/');

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={`flex items-center gap-1 text-sm hover:text-foreground focus:outline-none ${
          isActive ? 'font-medium text-foreground' : 'text-muted-foreground'
        }`}
      >
        Projects
        <ChevronDown className="h-3 w-3" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {groups.map((g) => (
          <DropdownMenuItem key={g.name}>
            <Link to="/groups/$groupName" params={{ groupName: g.name }} className="w-full">
              {g.name}
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
