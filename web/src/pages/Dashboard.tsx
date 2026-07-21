import { lazy, Suspense } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, useReducedMotion } from 'framer-motion';
import { Activity, Globe2, Radar } from 'lucide-react';
import { dashboardSummary, listDeals } from '../lib/crm';
import { formatNumber } from '../lib/format';
import { TiltCard } from '../components/aether/TiltCard';
import { RevenueCounter } from '../components/aether/RevenueCounter';
import { InsightsWidget } from '../components/aether/InsightsWidget';
import { Pipeline } from '../components/aether/Pipeline';
import { AIChat } from '../components/aether/AIChat';

// HoloGlobe pulls in three.js — load it lazily so it never blocks the first paint.
const HoloGlobe = lazy(() =>
  import('../components/aether/HoloGlobe').then((m) => ({ default: m.HoloGlobe })),
);

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
          <TiltCard className="relative h-[380px] overflow-hidden md:h-[460px]" intensity={5} spotlight>
            <div className="absolute inset-0">
              <Suspense fallback={<div className="h-full w-full" />}>
                <HoloGlobe />
              </Suspense>
            </div>

            {/* HUD overlays */}
            <div className="pointer-events-none absolute inset-0 p-6">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-cyan-200/80">
                    <Globe2 className="h-3 w-3" /> ספירת לידים חיה
                  </div>
                  <h1
                    className="mt-2 max-w-md text-2xl font-semibold leading-tight tracking-tight text-white md:text-3xl"
                    style={{ fontFamily: "'Space Grotesk','Heebo',sans-serif" }}
                  >
                    הכנסה ב<span className="text-gradient">מהירות המחשבה</span>
                  </h1>
                  <p className="mt-2 max-w-sm text-sm text-white/60">
                    כל הסוכנים חולקים מוח אחד — לידים, שיחות ועסקאות זורמים אליכם בזמן אמת.
                  </p>
                </div>
                <div className="flex flex-col gap-2 text-left text-[11px]">
                  <Hud color="#7ff0ff" label="אנשי קשר" value={formatNumber(s?.contacts_count)} loading={loading} />
                  <Hud color="#8ea3b5" label="לידים חדשים" value={formatNumber(s?.leads_count)} loading={loading} />
                  <Hud color="#e6edf3" label="עסקאות פתוחות" value={formatNumber(s?.open_deals_count)} loading={loading} />
                </div>
              </div>

              <div className="absolute inset-x-6 bottom-6 flex items-center justify-between">
                <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-white/10 bg-black/40 px-3 py-1.5 text-[11px] backdrop-blur">
                  <Radar className="h-3 w-3 text-cyan-300" />
                  <span className="text-white/70">מוח מרכזי</span>
                  <span className="text-cyan-200">מחובר</span>
                </div>
                <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-white/10 bg-black/40 px-3 py-1.5 text-[11px] backdrop-blur">
                  <Activity className="h-3 w-3 text-slate-300" />
                  <span className="text-white/70">משימות פתוחות</span>
                  <span className="text-white tabular-nums">{formatNumber(s?.tasks_open_count)}</span>
                </div>
              </div>
            </div>
          </TiltCard>
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
    <div className="pointer-events-auto flex items-center justify-start gap-2 rounded-full border border-white/10 bg-black/40 px-2.5 py-1 backdrop-blur">
      <span className="h-1.5 w-1.5 rounded-full animate-pulse-ring" style={{ background: color, boxShadow: `0 0 10px ${color}` }} />
      <span className="font-medium text-white tabular-nums">{loading ? '···' : value}</span>
      <span className="text-white/50">{label}</span>
    </div>
  );
}
