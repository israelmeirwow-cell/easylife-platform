import { NavLink } from 'react-router-dom';
import {
  LayoutGrid,
  Zap,
  Inbox,
  Layers,
  Settings,
  type LucideIcon,
} from 'lucide-react';

/* Mobile bottom navigation — the standard app tab bar (≤5 items, labels under
   icons, flat). Desktop navigation lives in TopNav; this renders md:hidden.
   (Replaces the macOS-style magnifying dock — decorative, and 8 items broke
   the bottom-nav-limit UX rule.) */

const items: { icon: LucideIcon; label: string; to: string }[] = [
  { icon: LayoutGrid, label: 'סקירה', to: '/dashboard' },
  { icon: Zap, label: 'פיד', to: '/feed' },
  { icon: Inbox, label: 'אינבוקס', to: '/inbox' },
  { icon: Layers, label: 'CRM', to: '/crm/deals' },
  { icon: Settings, label: 'הגדרות', to: '/settings' },
];

export function Dock() {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 flex items-stretch justify-around border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      aria-label="ניווט תחתון"
    >
      {items.map(({ icon: Icon, label, to }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            `flex min-h-[52px] flex-1 flex-col items-center justify-center gap-0.5 text-[10px] transition-colors ${
              isActive ? 'font-medium text-gold-strong' : 'text-muted'
            }`
          }
        >
          {({ isActive }) => (
            <>
              <Icon className="h-5 w-5" aria-hidden="true" />
              <span>{label}</span>
              {isActive && <span className="absolute top-0 h-0.5 w-8 rounded-full bg-gold" />}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
