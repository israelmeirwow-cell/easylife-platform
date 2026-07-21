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
        className="mb-6 flex flex-wrap items-center gap-1 rounded-2xl border border-border bg-white/[0.03] p-1.5 backdrop-blur-xl"
        aria-label="ניווט CRM"
      >
        {TABS.map(({ to, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `relative rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
                isActive ? 'text-white' : 'text-muted hover:text-ink'
              }`
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <span className="absolute inset-0 rounded-xl border border-gold/30 bg-gold-soft" />
                )}
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
