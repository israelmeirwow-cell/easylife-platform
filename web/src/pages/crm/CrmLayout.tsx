import { NavLink, Outlet } from 'react-router-dom';
import {
  Handshake,
  Target,
  Contact,
  Building2,
  ListChecks,
  Ticket,
  type LucideIcon,
} from 'lucide-react';

const TABS: { to: string; label: string; icon: LucideIcon }[] = [
  { to: '/crm/deals', label: 'עסקאות', icon: Handshake },
  { to: '/crm/leads', label: 'לידים', icon: Target },
  { to: '/crm/contacts', label: 'אנשי קשר', icon: Contact },
  { to: '/crm/accounts', label: 'חשבונות', icon: Building2 },
  { to: '/crm/tasks', label: 'משימות', icon: ListChecks },
  { to: '/crm/tickets', label: 'טיקטים', icon: Ticket },
];

export default function CrmLayout() {
  return (
    <div className="mx-auto w-full max-w-7xl">
      {/* segmented sub-nav — active tab gets the accent pill (readable ink, not white) */}
      <nav
        className="scrollbar-hide mb-6 flex items-center gap-1 overflow-x-auto rounded-2xl border border-border bg-surface/70 p-1.5 shadow-card backdrop-blur-xl"
        aria-label="ניווט CRM"
      >
        {TABS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `relative flex shrink-0 items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
                isActive ? 'text-gold-strong' : 'text-muted hover:text-ink'
              }`
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <span className="absolute inset-0 rounded-xl border border-gold/30 bg-gold-soft shadow-card" />
                )}
                <Icon className="relative z-10 h-4 w-4" aria-hidden="true" />
                <span className="relative z-10">{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <Outlet />
    </div>
  );
}
