import { useQuery } from '@tanstack/react-query';
import { motion, useReducedMotion } from 'framer-motion';
import { Radar } from 'lucide-react';
import { dashboardSummary, listDeals } from '../lib/crm';
import { formatNumber } from '../lib/format';
import { TiltCard } from '../components/aether/TiltCard';
import { RevenueCounter } from '../components/aether/RevenueCounter';
import { InsightsWidget } from '../components/aether/InsightsWidget';
import { Pipeline } from '../components/aether/Pipeline';
import { AIChat } from '../components/aether/AIChat';
import { BusinessAnalytics } from '../components/aether/BusinessAnalytics';
import LunarGravityCard from '../components/aether/LunarGravityCard';

const EASE = [0.16, 1, 0.3, 1] as const;

function agorotToShekels(agorot: number | null | undefined): number {
  return Math.round((agorot ?? 0) / 100);
}

export default function Dashboard() {
  const reduce = useReducedMotion();
  const summaryQ = useQuery({ queryKey: ['dashboard-summary'], queryFn: dashboardSummary });
  const dealsQ = useQuery({ queryKey: ['deals'], queryFn: () => listDeals() });

  const s = summaryQ.data;
  const deals = dealsQ.data ?? [];
  const loading = summaryQ.isLoading;

  // staggered entrance — disabled under reduced-motion
  const fade = (delay: number) =>
    reduce
      ? {}
      : {
          initial: { opacity: 0, y: 18 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.7, ease: EASE, delay },
        };

  return (
    <div className="relative mx-auto max-w-[1500px]" style={{ perspective: '1600px' }}>
      {summaryQ.isError && (
        <div className="mb-5 rounded-2xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          לא הצלחנו לטעון את הנתונים כרגע. ודאו שהשרת פועל ונסו לרענן.
        </div>
      )}

      {/* Hero: holographic lead sphere + revenue */}
      <div className="grid grid-cols-12 gap-4 md:gap-5">
        <motion.div {...fade(0)} className="col-span-12 lg:col-span-8">
          <div className="relative h-[380px] overflow-hidden rounded-[2rem] md:h-[460px]">
            <LunarGravityCard
              title={
                <>
                  הכנסה ב
                  <span className="bg-gradient-to-b from-white via-zinc-300 to-zinc-500 bg-clip-text text-transparent">
                    מהירות המחשבה
                  </span>
                </>
              }
              description="כל הסוכנים חולקים מוח אחד — לידים, שיחות ועסקאות זורמים אליכם בזמן אמת. לחצו על הירח."
            />

            {/* live HUD stats overlaid on the lunar scene (moon stays clickable) */}
            <div className="pointer-events-none absolute inset-x-6 bottom-6 z-30 flex items-end justify-between gap-2">
              <div className="flex flex-wrap gap-2 text-[11px]">
                <Hud color="#7ff0ff" label="אנשי קשר" value={formatNumber(s?.contacts_count)} loading={loading} />
                <Hud color="#8ea3b5" label="לידים" value={formatNumber(s?.leads_count)} loading={loading} />
                <Hud color="#e6edf3" label="עסקאות" value={formatNumber(s?.open_deals_count)} loading={loading} />
              </div>
              <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-border bg-surface/80 px-3 py-1.5 text-[11px] shadow-card backdrop-blur">
                <Radar className="h-3 w-3 text-gold" />
                <span className="text-muted">מוח מרכזי</span>
                <span className="font-medium text-gold">מחובר</span>
              </div>
            </div>
          </div>
        </motion.div>

        <motion.div {...fade(0.1)} className="col-span-12 lg:col-span-4">
          <TiltCard className="h-[380px] md:h-[460px]" intensity={6}>
            <RevenueCounter
              pipelineValueShekels={agorotToShekels(s?.pipeline_value_agorot)}
              wonThisMonthShekels={agorotToShekels(s?.won_this_month_agorot)}
              openDealsCount={s?.open_deals_count ?? 0}
              loading={loading}
            />
          </TiltCard>
        </motion.div>
      </div>

      {/* Insights strip */}
      <motion.div {...fade(0.2)} className="mt-4 md:mt-5">
        <TiltCard className="overflow-hidden" intensity={3}>
          <InsightsWidget
            contactsCount={s?.contacts_count ?? 0}
            openDealsCount={s?.open_deals_count ?? 0}
            tasksOpenCount={s?.tasks_open_count ?? 0}
            ticketsOpenCount={s?.tickets_open_count ?? 0}
            loading={loading}
          />
        </TiltCard>
      </motion.div>

      {/* Pipeline + brain chat */}
      <div className="mt-4 grid grid-cols-12 gap-4 md:mt-5 md:gap-5">
        <motion.div {...fade(0.3)} className="col-span-12 lg:col-span-8">
          <TiltCard className="min-h-[460px] overflow-hidden" intensity={3}>
            <Pipeline deals={deals} loading={dealsQ.isLoading} />
          </TiltCard>
        </motion.div>
        <motion.div {...fade(0.4)} className="col-span-12 lg:col-span-4">
          <TiltCard className="min-h-[460px]" intensity={5}>
            <AIChat />
          </TiltCard>
        </motion.div>
      </div>

      {/* Detailed business analytics — animated charts, live refetch */}
      <motion.div {...fade(0.5)} className="mt-4 md:mt-5">
        <BusinessAnalytics />
      </motion.div>
    </div>
  );
}

function Hud({
  color,
  label,
  value,
  loading,
}: {
  color: string;
  label: string;
  value: string;
  loading?: boolean;
}) {
  return (
    <div className="pointer-events-auto flex items-center justify-start gap-2 rounded-full border border-border bg-surface/80 px-2.5 py-1 shadow-card backdrop-blur">
      <span className="h-1.5 w-1.5 rounded-full animate-pulse-ring" style={{ background: color, boxShadow: `0 0 10px ${color}` }} />
      <span className="font-medium text-ink tabular-nums">{loading ? '···' : value}</span>
      <span className="text-muted">{label}</span>
    </div>
  );
}
