import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { animate, useMotionValue, useTransform, motion } from 'framer-motion';
import { TrendingUp, Trophy, Handshake, Percent } from 'lucide-react';
import type { ComponentType } from 'react';
import { dashboardAnalytics, dashboardSummary, listDeals } from '../lib/crm';
import { formatNumber } from '../lib/format';
import { Pipeline } from '../components/aether/Pipeline';
import { AIChat } from '../components/aether/AIChat';
import { BusinessAnalytics } from '../components/aether/BusinessAnalytics';

/* Quiet SaaS overview (Stripe/Linear language): greeting, KPI row, board,
   assistant, analytics. Flat surfaces, no hero spectacle, data first. */

function agorotToShekels(agorot: number | null | undefined): number {
  return Math.round((agorot ?? 0) / 100);
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return 'לילה טוב';
  if (h < 12) return 'בוקר טוב';
  if (h < 18) return 'צהריים טובים';
  return 'ערב טוב';
}

function CountUp({ to, format }: { to: number; format: (n: number) => string }) {
  const v = useMotionValue(0);
  const text = useTransform(v, (x: number) => format(Math.round(x)));
  useEffect(() => {
    const c = animate(v, to, { duration: 1.1, ease: [0.16, 1, 0.3, 1] });
    return () => c.stop();
  }, [v, to]);
  return <motion.span className="tabular-nums">{text}</motion.span>;
}

function Kpi({
  icon: Icon,
  label,
  value,
  format = formatNumber,
  prefix,
  suffix,
  loading,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: number;
  format?: (n: number) => string;
  prefix?: string;
  suffix?: string;
  loading?: boolean;
}) {
  return (
    <div className="glass-card p-4">
      <div className="flex items-center gap-2 text-xs text-muted">
        <Icon className="h-3.5 w-3.5 text-gold" aria-hidden="true" />
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold tracking-tight text-ink">
        {loading ? (
          <span className="inline-block h-7 w-20 animate-pulse rounded bg-surface-raised align-middle" />
        ) : (
          <>
            {prefix && <span className="me-0.5 text-sm text-muted">{prefix}</span>}
            <CountUp to={value} format={format} />
            {suffix && <span className="ms-0.5 text-sm text-muted">{suffix}</span>}
          </>
        )}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const summaryQ = useQuery({ queryKey: ['dashboard-summary'], queryFn: dashboardSummary });
  const analyticsQ = useQuery({ queryKey: ['dashboard-analytics'], queryFn: dashboardAnalytics });
  const dealsQ = useQuery({ queryKey: ['deals'], queryFn: () => listDeals() });

  const s = summaryQ.data;
  const a = analyticsQ.data;
  const deals = dealsQ.data ?? [];
  const loading = summaryQ.isLoading;

  return (
    <div className="mx-auto max-w-[1400px]">
      {summaryQ.isError && (
        <div className="mb-5 rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          לא הצלחנו לטעון את הנתונים כרגע. ודאו שהשרת פועל ונסו לרענן.
        </div>
      )}

      {/* Greeting */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-ink">
            {greeting()}, ישראל
          </h1>
          <p className="mt-1 text-sm text-muted">
            הנה מה שקורה בעסק שלך עכשיו — כל הסוכנים מחוברים למוח אחד.
          </p>
        </div>
        <span className="flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5 text-xs shadow-card">
          <span className="h-2 w-2 rounded-full bg-success animate-pulse-dot" />
          <span className="text-muted">מוח מרכזי</span>
          <span className="font-medium text-success">מחובר</span>
        </span>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi
          icon={TrendingUp}
          label="שווי צינור מכירות"
          value={agorotToShekels(s?.pipeline_value_agorot)}
          prefix="₪"
          loading={loading}
        />
        <Kpi
          icon={Trophy}
          label="נסגר החודש"
          value={agorotToShekels(s?.won_this_month_agorot)}
          prefix="₪"
          loading={loading}
        />
        <Kpi
          icon={Handshake}
          label="עסקאות פתוחות"
          value={s?.open_deals_count ?? 0}
          loading={loading}
        />
        <Kpi
          icon={Percent}
          label="אחוז סגירה"
          value={a?.win_rate_pct ?? 0}
          format={(n) => String(n)}
          suffix="%"
          loading={analyticsQ.isLoading}
        />
      </div>

      {/* Board + assistant */}
      <div className="mt-4 grid grid-cols-12 gap-4">
        <div className="glass-card col-span-12 min-h-[420px] overflow-hidden lg:col-span-8">
          <Pipeline deals={deals} loading={dealsQ.isLoading} />
        </div>
        <div className="glass-card col-span-12 min-h-[420px] overflow-hidden lg:col-span-4">
          <AIChat />
        </div>
      </div>

      {/* Detailed analytics */}
      <div className="mt-6">
        <BusinessAnalytics />
      </div>
    </div>
  );
}
