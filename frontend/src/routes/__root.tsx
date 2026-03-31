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
  const [showModal, setShowModal] = useState(() => !isPublicRoute && !getApiKey());
  const { dark, toggle } = useTheme();

  const { data: config } = useQuery({
    queryKey: queryKeys.config.all(),
    queryFn: getConfig,
    enabled: !!getApiKey(),
  });
  const groups = config?.groups ?? [];

  useEffect(() => {
    return authEvents.onUnauthorized(() => setShowModal(true));
  }, []);

  const handleSave = () => {
    setShowModal(false);
    queryClient.invalidateQueries();
  };

  return (
    <TooltipProvider>
    <div className="min-h-screen bg-background text-foreground">
      {showModal && <ApiKeyModal onSave={handleSave} />}
      <nav className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-7xl items-center gap-6 px-4 py-3">
          <span className="font-semibold">
            <img src={logo} alt="PrimeCache" width={32} height={32} />
          </span>
          <div className="ml-auto flex items-center gap-6">
            {!isPublicRoute && <NavLink to="/">Dashboard</NavLink>}
            {!isPublicRoute && groups.length > 0 && <DetailsDropdown groups={groups} />}
            {!isPublicRoute && <NavLink to="/config">Config</NavLink>}
            {!isPublicRoute && <NavLink to="/admin">Admin</NavLink>}
            <NavLink to="/status">Status</NavLink>
            <Button variant="ghost" size="icon" onClick={toggle} aria-label="Toggle theme">
              {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </nav>
      <main className="mx-auto max-w-7xl px-4 py-6">
        <Outlet />
      </main>
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
