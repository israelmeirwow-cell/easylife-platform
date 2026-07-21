import { NavLink, Outlet } from 'react-router-dom';
import type { ComponentType } from 'react';
import {
  BoltIcon,
  ChartIcon,
  CheckCircleIcon,
  CogIcon,
  InboxIcon,
  UsersIcon,
} from './icons';

interface NavItem {
  to: string;
  label: string;
  Icon: ComponentType<{ className?: string }>;
}

const NAV_ITEMS: NavItem[] = [
  { to: '/inbox', label: 'אינבוקס', Icon: InboxIcon },
  { to: '/crm', label: 'לקוחות', Icon: UsersIcon },
  { to: '/feed', label: 'פיד חי', Icon: BoltIcon },
  { to: '/approvals', label: 'אישורים', Icon: CheckCircleIcon },
  { to: '/cashflow', label: 'תזרים', Icon: ChartIcon },
  { to: '/settings', label: 'הגדרות', Icon: CogIcon },
];

function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-gold shadow-glow">
        <span className="h-1.5 w-1.5 rounded-full bg-ivory" />
      </span>
      <span className="text-lg font-semibold tracking-wide text-gold">Easy Life</span>
    </div>
  );
}

export default function Layout() {
  return (
    <div className="flex min-h-dvh">
      {/* Sidebar — first flex child, so in RTL it sits on the RIGHT */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-e border-border bg-surface/60 md:flex">
        <div className="px-6 pb-6 pt-7">
          <Logo />
        </div>
        <nav className="flex-1 space-y-1 px-3" aria-label="ניווט ראשי">
          {NAV_ITEMS.map(({ to, label, Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-gold-soft text-gold shadow-glow'
                    : 'text-muted hover:bg-surface-raised hover:text-ivory'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span className="absolute inset-y-2 start-0 w-0.5 rounded-full bg-gold" />
                  )}
                  <Icon className="h-5 w-5 shrink-0" />
                  <span>{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-border px-6 py-4 text-xs text-faint">
          גרסת פיתוח מוקדמת
        </div>
      </aside>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center justify-between border-b border-border bg-background/85 px-4 backdrop-blur md:px-8">
          <div className="flex items-center gap-3">
            <span className="md:hidden">
              <Logo />
            </span>
            <div className="hidden md:block">
              <div className="text-sm font-medium text-ivory">העסק שלי</div>
              <div className="text-xs text-faint">שם העסק יופיע כאן</div>
            </div>
          </div>
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface-raised text-sm font-semibold text-gold transition hover:border-gold/40"
            aria-label="פרופיל משתמש"
          >
            י
          </button>
        </header>

        <main className="flex-1 px-4 pb-24 pt-8 md:px-8 md:pb-10">
          <Outlet />
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav
        className="fixed inset-x-0 bottom-0 z-20 flex items-stretch justify-around border-t border-border bg-surface/95 backdrop-blur md:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        aria-label="ניווט תחתון"
      >
        {NAV_ITEMS.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] transition-colors ${
                isActive ? 'text-gold' : 'text-muted'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon className={`h-5 w-5 ${isActive ? 'drop-shadow-[0_0_6px_rgba(201,169,106,0.5)]' : ''}`} />
                <span>{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
