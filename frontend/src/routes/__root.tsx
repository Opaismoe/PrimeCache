import { Link, Outlet, createRootRouteWithContext } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';
import { getApiKey } from '../lib/api';
import { authEvents } from '../lib/events';
import { ApiKeyModal } from '../components/ApiKeyModal';

interface RouterContext {
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
});

function RootLayout() {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(() => !getApiKey());

  useEffect(() => {
    return authEvents.onUnauthorized(() => setShowModal(true));
  }, []);

  const handleSave = () => {
    setShowModal(false);
    queryClient.invalidateQueries();
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {showModal && <ApiKeyModal onSave={handleSave} />}
      <nav className="border-b border-gray-800 bg-gray-900">
        <div className="mx-auto flex max-w-7xl items-center gap-6 px-4 py-3">
          <span className="font-semibold text-white">Cache Warmer</span>
          <NavLink to="/">Dashboard</NavLink>
          <NavLink to="/history">History</NavLink>
          <NavLink to="/config">Config</NavLink>
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
      className="text-sm text-gray-400 hover:text-white [&.active]:font-medium [&.active]:text-white"
    >
      {children}
    </Link>
  );
}
