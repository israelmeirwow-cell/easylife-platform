import { NavLink, useLocation } from 'react-router-dom';
import { Search, Bell, Sparkles } from 'lucide-react';
import { useLayoutEffect, useRef, type ComponentType } from 'react';
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
  const navRef = useRef<HTMLElement>(null);
  const { pathname } = useLocation();

  // keep the active tab centered in the horizontally-scrollable row (mobile).
  // scrollIntoView is unreliable in RTL, so scroll by the measured center delta.
  // Resolve the active tab from pathname + NAV_ITEMS order (aria-current can lag
  // a frame). useLayoutEffect runs after layout is committed, so rects are valid.
  useLayoutEffect(() => {
    const idx = NAV_ITEMS.findIndex(
      (i) => pathname === i.to || pathname.startsWith(i.to + '/'),
    );
    const nav = navRef.current;
    const active = nav?.children[idx] as HTMLElement | undefined;
    if (idx < 0 || !nav || !active) return;
    const navRect = nav.getBoundingClientRect();
    const actRect = active.getBoundingClientRect();
    const delta = actRect.left + actRect.width / 2 - (navRect.left + navRect.width / 2);
    if (Math.abs(delta) > 1) nav.scrollBy({ left: delta });
  }, [pathname]);

  return (
    // Visible on ALL sizes — the design's chrome: top bar + horizontally
    // scrollable tab row (the .dc.html nav is overflow-x:auto, mobile included).
    <header className="sticky top-0 z-40 flex flex-col border-b border-border bg-surface/95 backdrop-blur">
      <div className="flex items-center justify-between gap-3 px-4 pb-3 pt-3 md:gap-6 md:px-6 md:pt-4 lg:px-8">
        {/* logo → landing page (per the design's crmChrome: logo links to Landing) */}
        <NavLink to="/landing" className="flex items-center gap-2.5" aria-label="Easy Life — דף הבית">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gold">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <div
            className="text-sm font-semibold tracking-wide text-ink"
            style={{ fontFamily: "'Space Grotesk',sans-serif" }}
          >
            Easy<span className="text-gold"> Life</span>
          </div>
        </NavLink>

        <div className="mx-auto hidden w-full max-w-xl items-center gap-2.5 rounded-lg border border-border bg-background px-3.5 py-2 md:flex">
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
      <nav ref={navRef} className="flex items-center gap-0.5 overflow-x-auto px-4 scrollbar-hide lg:px-6" aria-label="ניווט ראשי">
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
