import { motion } from 'framer-motion';
import { Users, Briefcase, ListChecks, Ticket as TicketIcon } from 'lucide-react';
import { formatNumber } from '@/lib/format';

interface InsightRow {
  icon: typeof Users;
  tint: string;
  label: string;
  note: string;
  value: number;
}

export function InsightsWidget({
  contactsCount,
  openDealsCount,
  tasksOpenCount,
  ticketsOpenCount,
  loading,
}: {
  contactsCount: number;
  openDealsCount: number;
  tasksOpenCount: number;
  ticketsOpenCount: number;
  loading?: boolean;
}) {
  const insights: InsightRow[] = [
    { icon: Users, tint: '#7ff0ff', label: 'אנשי קשר במערכת', note: 'כולם ממוזגים אוטומטית', value: contactsCount },
    { icon: Briefcase, tint: '#e6edf3', label: 'עסקאות פתוחות בצינור', note: 'ראו פירוט בעמוד CRM', value: openDealsCount },
    { icon: ListChecks, tint: '#8ea3b5', label: 'משימות פתוחות', note: 'ממתינות לטיפול', value: tasksOpenCount },
    { icon: TicketIcon, tint: '#f0a37f', label: 'טיקטים פתוחים', note: 'פניות שירות פעילות', value: ticketsOpenCount },
  ];

  return (
    <div className="relative p-5">
      <div
        className="pointer-events-none absolute -inset-px rounded-3xl opacity-60 blur-lg"
        style={{ background: 'conic-gradient(from 0deg, #7ff0ff33, #e6edf333, #8ea3b533, #7ff0ff33)' }}
      />
      <div className="relative">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-cyan-300 animate-pulse-ring" style={{ boxShadow: '0 0 10px #7ff0ff' }} />
            <div className="text-[10px] uppercase tracking-[0.25em] text-white/50">תובנות עסק</div>
          </div>
        </div>
        <div className="mt-4 space-y-2.5">
          {insights.map((i, idx) => (
            <motion.div
              key={i.label}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 * idx + 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3"
            >
              <div
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                style={{
                  background: `radial-gradient(circle, ${i.tint}33 0%, transparent 70%)`,
                  border: `1px solid ${i.tint}55`,
                }}
              >
                <i.icon className="h-3.5 w-3.5" style={{ color: i.tint }} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm text-white/90">{i.label}</div>
                <div className="text-[10px] text-white/40">{i.note}</div>
              </div>
              <div className="shrink-0 text-lg font-semibold tabular-nums text-white" style={{ fontFamily: "'Space Grotesk',sans-serif" }}>
                {loading ? '···' : formatNumber(i.value)}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
