import { Suspense, lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import { Spinner } from './components/ui';
import Login from './pages/Login';
import Feed from './pages/Feed';
import Inbox from './pages/Inbox';
import Approvals from './pages/Approvals';
import Cashflow from './pages/Cashflow';
import Settings from './pages/Settings';
// Dashboard pulls in ECharts — load it lazily so it doesn't bloat the initial bundle.
const Dashboard = lazy(() => import('./pages/Dashboard'));
import CrmLayout from './pages/crm/CrmLayout';
import LeadsPage from './pages/crm/LeadsPage';
import ContactsPage from './pages/crm/ContactsPage';
import ContactDetailPage from './pages/crm/ContactDetailPage';
import AccountsPage from './pages/crm/AccountsPage';
import AccountDetailPage from './pages/crm/AccountDetailPage';
import DealsPage from './pages/crm/DealsPage';
import TasksPage from './pages/crm/TasksPage';
import TicketsPage from './pages/crm/TicketsPage';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<Layout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route
          path="/dashboard"
          element={
            <Suspense
              fallback={
                <div className="flex items-center justify-center py-24">
                  <Spinner className="h-6 w-6" />
                </div>
              }
            >
              <Dashboard />
            </Suspense>
          }
        />

        {/* CRM section with inner sub-nav */}
        <Route path="/crm" element={<CrmLayout />}>
          <Route index element={<Navigate to="/crm/deals" replace />} />
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
        <Route path="/feed" element={<Feed />} />
        <Route path="/approvals" element={<Approvals />} />
        <Route path="/cashflow" element={<Cashflow />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  );
}
