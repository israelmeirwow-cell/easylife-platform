import { NavLink } from 'react-router-dom';
import { Search, Bell, Sparkles } from 'lucide-react';
import type { ComponentType } from 'react';
import {
  BoltIcon,
  ChatBubbleIcon,
  ConnectIcon,
  CogIcon,
  CrmIcon,
  GridIcon,
  InboxIcon,
  TrendUpIcon,
} from '@/components/icons';

/* Quiet SaaS chrome (Linear/Stripe language): flat white bar, hairline border,
   underline tabs — no gradients, no glows, no entrance animation. */

interface NavItem {
  to: string;
  label: string;
  Icon: ComponentType<{ className?: string }>;
}

// Order + icons match design_files/crmChrome.js exactly. Approvals now
// happen inline in the Agents chat, so it's not a top-level tab.
export const NAV_ITEMS: NavItem[] = [
  { to: '/dashboard', label: 'סקירה', Icon: GridIcon },
  { to: '/feed', label: 'פיד חי', Icon: BoltIcon },
  { to: '/inbox', label: 'אינבוקס', Icon: InboxIcon },
  { to: '/agents', label: 'סוכנים', Icon: ChatBubbleIcon },
  { to: '/crm', label: 'CRM', Icon: CrmIcon },
  { to: '/connections', label: 'חיבורים', Icon: ConnectIcon },
  { to: '/cashflow', label: 'תזרים', Icon: TrendUpIcon },
  { to: '/settings', label: 'הגדרות', Icon: CogIcon },
];

export function TopNav({ userName = 'ישראל', userRole = 'בעלים' }: { userName?: string; userRole?: string }) {
  const initial = userName.trim().slice(0, 1) || '?';

  return (
    <header className="sticky top-0 z-40 hidden flex-col border-b border-border bg-surface/95 backdrop-blur md:flex">
      <div className="flex items-center justify-between gap-6 px-6 pb-3 pt-4 lg:px-8">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gold">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <div
            className="text-sm font-semibold tracking-wide text-ink"
            style={{ fontFamily: "'Space Grotesk',sans-serif" }}
          >
            Easy<span className="text-gold"> Life</span>
          </div>
        </div>

        <div className="mx-auto flex w-full max-w-xl items-center gap-2.5 rounded-lg border border-border bg-background px-3.5 py-2">
          <Search className="h-4 w-4 text-faint" />
          <input
            placeholder="חיפוש עסקאות, לידים, אנשי קשר…"
            className="flex-1 bg-transparent text-sm text-ink placeholder:text-faint outline-none"
          />
        </div>

        <div className="flex items-center gap-3">
          <button
            className="relative cursor-pointer rounded-lg border border-border bg-surface p-2 transition-colors hover:bg-surface-raised"
            aria-label="התראות"
          >
            <Bell className="h-4 w-4 text-muted" />
            <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-gold" />
          </button>
          <div className="flex items-center gap-2.5">
            <div className="relative">
              <div className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-surface-raised text-xs font-semibold text-ink">
                {initial}
              </div>
              <span className="absolute -bottom-0.5 -end-0.5 h-2.5 w-2.5 rounded-full border-2 border-surface bg-success" />
            </div>
            <div className="hidden text-end lg:block">
              <div className="text-xs font-medium text-ink">{userName}</div>
              <div className="text-[10px] text-faint">{userRole}</div>
            </div>
          </div>
        </div>
      </div>

      {/* underline tabs */}
      <nav className="flex items-center gap-0.5 overflow-x-auto px-4 scrollbar-hide lg:px-6" aria-label="ניווט ראשי">
        {NAV_ITEMS.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `relative flex shrink-0 items-center gap-1.5 px-3 py-2.5 text-sm transition-colors ${
                isActive ? 'font-medium text-ink' : 'text-muted hover:text-ink'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon className="h-4 w-4 shrink-0" />
                <span className="whitespace-nowrap">{label}</span>
                {isActive && (
                  <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-gold" />
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </header>
  );
}
