import { Link, Outlet, createRootRouteWithContext } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';
import { getApiKey } from '../lib/api';
import { authEvents } from '../lib/events';
import { ApiKeyModal } from '../components/ApiKeyModal';
import { Button } from '@/components/ui/button';
import { Moon, Sun } from 'lucide-react';

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
  const [showModal, setShowModal] = useState(() => !getApiKey());
  const { dark, toggle } = useTheme();

  useEffect(() => {
    return authEvents.onUnauthorized(() => setShowModal(true));
  }, []);

  const handleSave = () => {
    setShowModal(false);
    queryClient.invalidateQueries();
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {showModal && <ApiKeyModal onSave={handleSave} />}
      <nav className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-7xl items-center gap-6 px-4 py-3">
          <span className="font-semibold">Cache Warmer</span>
          <NavLink to="/">Dashboard</NavLink>
          <NavLink to="/history">History</NavLink>
          <NavLink to="/config">Config</NavLink>
          <div className="ml-auto">
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
