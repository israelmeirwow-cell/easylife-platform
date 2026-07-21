import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import Login from './pages/Login';
import Feed from './pages/Feed';
import Inbox from './pages/Inbox';
import Crm from './pages/Crm';
import Approvals from './pages/Approvals';
import Cashflow from './pages/Cashflow';
import Settings from './pages/Settings';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<Layout />}>
        <Route index element={<Navigate to="/feed" replace />} />
        <Route path="/inbox" element={<Inbox />} />
        <Route path="/crm" element={<Crm />} />
        <Route path="/feed" element={<Feed />} />
        <Route path="/approvals" element={<Approvals />} />
        <Route path="/cashflow" element={<Cashflow />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/feed" replace />} />
      </Route>
    </Routes>
  );
}
