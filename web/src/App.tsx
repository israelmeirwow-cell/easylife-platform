import { Suspense, lazy, useEffect, useState } from 'react';
import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import { Spinner } from './components/ui';
import { IS_DEMO } from './lib/api';
import { me } from './lib/auth';
import Login from './pages/Login';
import Feed from './pages/Feed';
import Inbox from './pages/Inbox';
import Agents from './pages/Agents';
import CrmDesign from './pages/CrmDesign';
import ConnectionsDesign from './pages/ConnectionsDesign';
import Connections from './pages/Connections';
import Approvals from './pages/Approvals';
import Cashflow from './pages/Cashflow';
import Settings from './pages/Settings';
// Heavier pages load lazily so they don't bloat the initial bundle.
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Landing = lazy(() => import('./pages/Landing'));
import CrmLayout from './pages/crm/CrmLayout';
import LeadsPage from './pages/crm/LeadsPage';
import ContactsPage from './pages/crm/ContactsPage';
import ContactDetailPage from './pages/crm/ContactDetailPage';
import AccountsPage from './pages/crm/AccountsPage';
import AccountDetailPage from './pages/crm/AccountDetailPage';
import DealsPage from './pages/crm/DealsPage';
import TasksPage from './pages/crm/TasksPage';
import TicketsPage from './pages/crm/TicketsPage';

const lazyFallback = (
  <div className="flex items-center justify-center py-24">
    <Spinner className="h-6 w-6" />
  </div>
);

/**
 * Route guard for the app shell. In a demo build there is no backend, so it
 * renders immediately. Otherwise it probes GET /api/auth/me: while pending it
 * shows the spinner, on success it renders the nested routes, and on 401 it
 * redirects to /login.
 */
function RequireAuth() {
  const [status, setStatus] = useState<'checking' | 'authed' | 'anon'>(
    IS_DEMO ? 'authed' : 'checking',
  );

  useEffect(() => {
    if (IS_DEMO) return;
    let alive = true;
    me()
      .then(() => alive && setStatus('authed'))
      .catch(() => alive && setStatus('anon'));
    return () => {
      alive = false;
    };
  }, []);

  if (status === 'checking') return lazyFallback;
  if (status === 'anon') return <Navigate to="/login" replace />;
  return <Outlet />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      {/* Marketing landing (Claude Design Landing.dc.html) — standalone full
          page with its own chrome, outside the app <Layout>. */}
      <Route
        path="/landing"
        element={<Suspense fallback={lazyFallback}><Landing /></Suspense>}
      />

      <Route element={<RequireAuth />}>
      <Route element={<Layout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route
          path="/dashboard"
          element={<Suspense fallback={lazyFallback}><Dashboard /></Suspense>}
        />

        {/* CRM — the Claude Design single page (accounts/contacts/deals tabs).
            The legacy working sub-pages stay reachable under /crm/*. */}
        <Route path="/crm" element={<CrmDesign />} />
        <Route path="/crm" element={<CrmLayout />}>
          <Route path="leads" element={<LeadsPage />} />
          <Route path="contacts" element={<ContactsPage />} />
          <Route path="contacts/:id" element={<ContactDetailPage />} />
          <Route path="accounts" element={<AccountsPage />} />
          <Route path="accounts/:id" element={<AccountDetailPage />} />
          <Route path="deals" element={<DealsPage />} />
          <Route path="tasks" element={<TasksPage />} />
          <Route path="tickets" element={<TicketsPage />} />
        </Route>

        <Route path="/inbox" element={<Inbox />} />
        <Route path="/agents" element={<Agents />} />
        {/* Connections — the Claude Design demo page; the live Composio-wired
            page stays reachable at /connections/live. */}
        <Route path="/connections" element={<ConnectionsDesign />} />
        <Route path="/connections/live" element={<Connections />} />
        <Route path="/feed" element={<Feed />} />
        {/* Approvals now happen inline in Agents chat (design handoff);
            route kept reachable, just not in the primary nav. */}
        <Route path="/approvals" element={<Approvals />} />
        <Route path="/cashflow" element={<Cashflow />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
      </Route>
    </Routes>
  );
}
