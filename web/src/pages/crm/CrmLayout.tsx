import { NavLink, Outlet } from 'react-router-dom';

const TABS = [
  { to: '/crm/deals', label: 'עסקאות' },
  { to: '/crm/leads', label: 'לידים' },
  { to: '/crm/contacts', label: 'אנשי קשר' },
  { to: '/crm/accounts', label: 'חשבונות' },
  { to: '/crm/tasks', label: 'משימות' },
  { to: '/crm/tickets', label: 'טיקטים' },
];

export default function CrmLayout() {
  return (
    <div className="mx-auto w-full max-w-7xl">
      {/* Secondary sub-nav */}
      <nav
        className="mb-6 flex flex-wrap items-center gap-1 border-b border-border"
        aria-label="ניווט CRM"
      >
        {TABS.map(({ to, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `relative -mb-px rounded-t-lg px-4 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? 'text-ink'
                  : 'text-muted hover:text-ink'
              }`
            }
          >
            {({ isActive }) => (
              <>
                {label}
                {isActive && (
                  <span className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-gold" />
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <Outlet />
    </div>
  );
}
