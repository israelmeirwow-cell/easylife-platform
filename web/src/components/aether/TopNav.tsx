import { motion } from 'framer-motion';
import { NavLink } from 'react-router-dom';
import { Search, Bell, Sparkles } from 'lucide-react';
import type { ComponentType } from 'react';
import {
  BoltIcon,
  ChartIcon,
  CheckCircleIcon,
  CogIcon,
  CrmIcon,
  GridIcon,
  InboxIcon,
} from '@/components/icons';

interface NavItem {
  to: string;
  label: string;
  Icon: ComponentType<{ className?: string }>;
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/dashboard', label: 'סקירה', Icon: GridIcon },
  { to: '/feed', label: 'פיד חי', Icon: BoltIcon },
  { to: '/inbox', label: 'אינבוקס', Icon: InboxIcon },
  { to: '/approvals', label: 'אישורים', Icon: CheckCircleIcon },
  { to: '/crm', label: 'CRM', Icon: CrmIcon },
  { to: '/cashflow', label: 'תזרים', Icon: ChartIcon },
  { to: '/settings', label: 'הגדרות', Icon: CogIcon },
];

export function TopNav({ userName = 'ישראל', userRole = 'בעלים' }: { userName?: string; userRole?: string }) {
  const initial = userName.trim().slice(0, 1) || '?';

  return (
    <motion.header
      initial={{ y: -30, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="sticky top-0 z-40 hidden flex-col gap-3 px-6 py-4 backdrop-blur-xl md:flex lg:px-8"
      style={{ background: 'linear-gradient(180deg, rgba(7,9,14,0.85), rgba(7,9,14,0.4))' }}
    >
      <div className="flex items-center justify-between gap-6">
        <div className="flex items-center gap-3">
          <div className="relative flex h-9 w-9 items-center justify-center rounded-xl glass-card glow-cyan">
            <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-cyan-300/40 to-white/30" />
            <Sparkles className="relative z-10 h-4 w-4 text-white" />
          </div>
          <div>
            <div className="text-sm font-semibold tracking-wide" style={{ fontFamily: "'Space Grotesk',sans-serif" }}>
              Easy<span className="text-cyan-300"> Life</span>
            </div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-white/40">Spatial Intelligence</div>
          </div>
        </div>

        <div className="mx-auto flex w-full max-w-xl items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 backdrop-blur-xl">
          <Search className="h-4 w-4 text-white/50" />
          <input
            placeholder="חיפוש עסקאות, לידים, אנשי קשר…"
            className="flex-1 bg-transparent text-sm text-white/90 placeholder:text-white/40 outline-none"
          />
        </div>

        <div className="flex items-center gap-3">
          <button className="relative rounded-xl border border-white/10 bg-white/5 p-2.5" aria-label="התראות">
            <Bell className="h-4 w-4 text-white/80" />
            <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_10px_#7ff0ff]" />
          </button>
          <div className="flex items-center gap-2.5">
            <div className="relative">
              <div className="h-9 w-9 rounded-full bg-gradient-to-br from-cyan-300 via-white to-slate-400 p-[2px]">
                <div className="flex h-full w-full items-center justify-center rounded-full bg-[#07090E] text-xs font-semibold">
                  {initial}
                </div>
              </div>
              <span className="absolute -bottom-0.5 -end-0.5 h-3 w-3 rounded-full border-2 border-[#07090E] bg-cyan-300 shadow-[0_0_10px_#7ff0ff]" />
            </div>
            <div className="hidden text-end lg:block">
              <div className="text-xs font-medium text-white/90">{userName}</div>
              <div className="text-[10px] text-white/40">{userRole}</div>
            </div>
          </div>
        </div>
      </div>

      <nav className="flex items-center gap-1 overflow-x-auto scrollbar-hide" aria-label="ניווט ראשי">
        {NAV_ITEMS.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `group relative flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium transition-colors ${
                isActive ? 'text-white' : 'text-white/50 hover:text-white/85'
              }`
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <motion.span
                    layoutId="nav-active-pill"
                    className="absolute inset-0 rounded-xl border border-cyan-300/30 bg-cyan-300/10"
                    transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                  />
                )}
                <Icon className="relative z-10 h-4 w-4 shrink-0" />
                <span className="relative z-10 whitespace-nowrap">{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </motion.header>
  );
}
