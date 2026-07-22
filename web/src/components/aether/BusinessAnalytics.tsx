import { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { animate, motion, useMotionValue, useTransform, useReducedMotion } from 'framer-motion';
import ReactECharts from 'echarts-for-react';
import { Link } from 'react-router-dom';
import {
  Trophy,
  Percent,
  Coins,
  Flame,
  ArrowUpRight,
} from 'lucide-react';
import type { ComponentType } from 'react';
import { dashboardAnalytics } from '@/lib/crm';
import { formatAgorotCompact, formatNumber } from '@/lib/format';
import {
  AXIS_LABEL,
  CHART_ANIMATION,
  CHART_COLORS,
  STAGE_CHART_COLORS,
  TOOLTIP_STYLE,
} from '@/lib/chartTheme';

/* The "detailed business picture" section: monthly deal flow, funnels, rhythm.
   Charts are ECharts with fluid entrance + smooth update transitions; data
   refetches every 30s so the charts genuinely MOVE as the business changes. */

const HEB_MONTHS = ['ינו', 'פבר', 'מרץ', 'אפר', 'מאי', 'יוני', 'יולי', 'אוג', 'ספט', 'אוק', 'נוב', 'דצמ'];
const HEB_DAYS = ['ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳', 'א׳']; // ISO weekday order (Mon..Sun)
const LEAD_STAGE_LABELS: Record<string, string> = {
  new: 'חדשים',
  contacted: 'נוצר קשר',
  qualified: 'מוכשרים',
  won: 'הומרו',
  lost: 'אבדו',
};
const TICKET_LABELS: Record<string, string> = {
  new: 'חדש',
  open: 'פתוח',
  pending: 'ממתין',
  resolved: 'נפתר',
  closed: 'סגור',
};

function monthLabel(key: string): string {
  const m = parseInt(key.slice(5), 10);
  return HEB_MONTHS[(m - 1 + 12) % 12] ?? key;
}

function CountUp({ to, format }: { to: number; format: (n: number) => string }) {
  const v = useMotionValue(0);
  const text = useTransform(v, (x: number) => format(Math.round(x)));
  useEffect(() => {
    const c = animate(v, to, { duration: 1.6, ease: [0.16, 1, 0.3, 1] });
    return () => c.stop();
  }, [v, to]);
  return <motion.span className="tabular-nums">{text}</motion.span>;
}

function Kpi({
  icon: Icon,
  label,
  value,
  format,
  suffix,
  tint,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: number;
  format: (n: number) => string;
  suffix?: string;
  tint: string;
}) {
  return (
    <motion.div
      whileHover={{ y: -3 }}
      className="glass-card flex items-center gap-4 p-5"
    >
      <span
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
        style={{ background: `${tint}18`, color: tint }}
      >
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <div className="text-xs text-muted">{label}</div>
        <div
          className="mt-0.5 text-2xl font-semibold tracking-tight text-ink"
          style={{ fontFamily: "'Space Grotesk','Heebo',sans-serif" }}
        >
          <CountUp to={value} format={format} />
          {suffix && <span className="ms-0.5 text-sm text-muted">{suffix}</span>}
        </div>
      </div>
    </motion.div>
  );
}

export function BusinessAnalytics() {
  const reduce = useReducedMotion();
  const q = useQuery({
    queryKey: ['dashboard-analytics'],
    queryFn: dashboardAnalytics,
    refetchInterval: 30_000, // charts transition live as the business moves
  });
  const a = q.data;

  const base = { ...CHART_ANIMATION, animation: !reduce } as const;

  const monthlyOption = useMemo(() => {
    const months = a?.monthly ?? [];
    return {
      ...base,
      grid: { top: 34, bottom: 26, left: 10, right: 10, containLabel: true },
      tooltip: { trigger: 'axis', ...TOOLTIP_STYLE },
      legend: {
        top: 0,
        textStyle: AXIS_LABEL,
        itemWidth: 14,
        itemHeight: 8,
        data: ['עסקאות חדשות', 'הכנסות שנסגרו'],
      },
      xAxis: {
        type: 'category',
        data: months.map((m) => monthLabel(m.month)),
        axisLabel: AXIS_LABEL,
        axisLine: { lineStyle: { color: CHART_COLORS.border } },
        axisTick: { show: false },
      },
      yAxis: [
        {
          type: 'value',
          axisLabel: { ...AXIS_LABEL, formatter: (v: number) => formatNumber(v) },
          splitLine: { lineStyle: { color: CHART_COLORS.border, opacity: 0.6 } },
        },
        {
          type: 'value',
          axisLabel: {
            ...AXIS_LABEL,
            formatter: (v: number) => formatAgorotCompact(v),
          },
          splitLine: { show: false },
        },
      ],
      series: [
        {
          name: 'עסקאות חדשות',
          type: 'bar',
          data: months.map((m) => m.created_count),
          barWidth: 18,
          itemStyle: {
            borderRadius: [6, 6, 0, 0],
            color: {
              type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: CHART_COLORS.cyan },
                { offset: 1, color: `${CHART_COLORS.cyan}55` },
              ],
            },
          },
        },
        {
          name: 'הכנסות שנסגרו',
          type: 'line',
          yAxisIndex: 1,
          smooth: true,
          symbol: 'circle',
          symbolSize: 8,
          data: months.map((m) => m.won_agorot),
          lineStyle: { width: 3, color: CHART_COLORS.gold },
          itemStyle: { color: CHART_COLORS.gold, borderColor: '#fff', borderWidth: 2 },
          areaStyle: {
            color: {
              type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: `${CHART_COLORS.gold}33` },
                { offset: 1, color: `${CHART_COLORS.gold}00` },
              ],
            },
          },
        },
      ],
    };
  }, [a?.monthly, reduce]);

  const ticketsOption = useMemo(() => {
    const buckets = (a?.tickets_by_status ?? []).filter((b) => b.count > 0);
    const palette = [CHART_COLORS.danger, CHART_COLORS.gold, CHART_COLORS.warning, CHART_COLORS.success, CHART_COLORS.faint];
    return {
      ...base,
      tooltip: { trigger: 'item', ...TOOLTIP_STYLE },
      series: [
        {
          type: 'pie',
          radius: ['62%', '85%'],
          center: ['50%', '52%'],
          avoidLabelOverlap: true,
          itemStyle: { borderColor: '#fff', borderWidth: 3, borderRadius: 8 },
          label: { show: false },
          data: buckets.map((b, i) => ({
            name: TICKET_LABELS[b.key] ?? b.key,
            value: b.count,
            itemStyle: { color: palette[i % palette.length] },
          })),
        },
      ],
    };
  }, [a?.tickets_by_status, reduce]);

  const weekOption = useMemo(() => {
    const days = a?.activity_by_weekday ?? [];
    return {
      ...base,
      grid: { top: 12, bottom: 22, left: 6, right: 6, containLabel: true },
      tooltip: { trigger: 'axis', ...TOOLTIP_STYLE },
      xAxis: {
        type: 'category',
        data: days.map((d) => HEB_DAYS[parseInt(d.key, 10)] ?? d.key),
        axisLabel: AXIS_LABEL,
        axisLine: { lineStyle: { color: CHART_COLORS.border } },
        axisTick: { show: false },
      },
      yAxis: {
        type: 'value',
        axisLabel: AXIS_LABEL,
        splitLine: { lineStyle: { color: CHART_COLORS.border, opacity: 0.6 } },
      },
      series: [
        {
          type: 'bar',
          data: days.map((d) => d.count),
          barWidth: 16,
          itemStyle: {
            borderRadius: [6, 6, 0, 0],
            color: {
              type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: CHART_COLORS.violet },
                { offset: 1, color: `${CHART_COLORS.violet}44` },
              ],
            },
          },
        },
      ],
    };
  }, [a?.activity_by_weekday, reduce]);

  const funnel = a?.leads_funnel ?? [];
  const funnelMax = Math.max(1, ...funnel.map((b) => b.count));
  const topDeals = a?.top_open_deals ?? [];
  const topMax = Math.max(1, ...topDeals.map((d) => d.value_agorot));
  const weeklyActivity = (a?.activity_by_weekday ?? []).reduce((s, d) => s + d.count, 0);

  return (
    <section aria-label="אנליטיקה עסקית">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-[0.25em] text-faint">אנליטיקה עסקית</div>
          <h2
            className="mt-1 text-lg font-semibold text-ink"
            style={{ fontFamily: "'Space Grotesk','Heebo',sans-serif" }}
          >
            התמונה המלאה של <span className="text-gradient">העסק שלך</span>
          </h2>
        </div>
        <span className="flex items-center gap-1.5 rounded-full border border-border-strong bg-gold-soft px-2.5 py-1 text-[10px] text-gold-strong">
          <span className="h-1.5 w-1.5 rounded-full bg-gold animate-pulse-dot" />
          מתעדכן חי
        </span>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Kpi icon={Trophy} label="סה״כ הכנסות שנסגרו" value={Math.round((a?.won_total_agorot ?? 0) / 100)} format={formatNumber} suffix="₪" tint={CHART_COLORS.gold} />
        <Kpi icon={Percent} label="אחוז סגירה" value={a?.win_rate_pct ?? 0} format={(n) => String(n)} suffix="%" tint={CHART_COLORS.success} />
        <Kpi icon={Coins} label="עסקה ממוצעת" value={Math.round((a?.avg_deal_agorot ?? 0) / 100)} format={formatNumber} suffix="₪" tint={CHART_COLORS.violet} />
        <Kpi icon={Flame} label="פעולות בעסק" value={weeklyActivity} format={formatNumber} tint={CHART_COLORS.danger} />
      </div>

      {/* Monthly trend + tickets donut */}
      <div className="mt-4 grid grid-cols-12 gap-4">
        <div className="glass-card col-span-12 p-5 lg:col-span-8">
          <div className="mb-1 flex items-center justify-between">
            <div className="text-sm font-semibold text-ink">מגמה חודשית — עסקאות והכנסות</div>
            <span className="text-[10px] text-faint">6 חודשים אחרונים</span>
          </div>
          {q.isLoading ? (
            <div className="h-[260px] animate-pulse rounded-xl bg-surface-raised" />
          ) : (
            <ReactECharts option={monthlyOption} style={{ height: 260 }} notMerge={false} lazyUpdate />
          )}
        </div>

        <div className="glass-card col-span-12 p-5 lg:col-span-4">
          <div className="mb-1 flex items-center justify-between">
            <div className="text-sm font-semibold text-ink">פניות שירות</div>
            <Link to="/crm/tickets" className="text-[10px] text-faint transition hover:text-ink">
              לכל הפניות
            </Link>
          </div>
          {q.isLoading ? (
            <div className="h-[220px] animate-pulse rounded-xl bg-surface-raised" />
          ) : (a?.tickets_by_status ?? []).every((b) => b.count === 0) ? (
            <div className="flex h-[220px] items-center justify-center text-xs text-faint">
              אין פניות פתוחות — מצוין 🎉
            </div>
          ) : (
            <ReactECharts option={ticketsOption} style={{ height: 220 }} notMerge={false} lazyUpdate />
          )}
          <div className="mt-1 flex flex-wrap justify-center gap-x-3 gap-y-1 text-[10px] text-muted">
            {(a?.tickets_by_status ?? [])
              .filter((b) => b.count > 0)
              .map((b) => (
                <span key={b.key}>
                  {TICKET_LABELS[b.key] ?? b.key} · {b.count}
                </span>
              ))}
          </div>
        </div>
      </div>

      {/* Funnel + weekday rhythm + top deals */}
      <div className="mt-4 grid grid-cols-12 gap-4">
        <div className="glass-card col-span-12 p-5 md:col-span-4">
          <div className="mb-3 text-sm font-semibold text-ink">משפך לידים</div>
          <div className="flex flex-col gap-2.5">
            {funnel.map((b, i) => (
              <div key={b.key}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="text-muted">{LEAD_STAGE_LABELS[b.key] ?? b.key}</span>
                  <span className="font-medium text-ink tabular-nums">{b.count}</span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-surface-raised">
                  <motion.div
                    className="h-full rounded-full"
                    style={{
                      background: `linear-gradient(90deg, ${CHART_COLORS.gold}, ${CHART_COLORS.cyan})`,
                      opacity: 1 - i * 0.12,
                    }}
                    initial={{ width: 0 }}
                    animate={{ width: `${(b.count / funnelMax) * 100}%` }}
                    transition={{ duration: 1, delay: i * 0.1, ease: [0.16, 1, 0.3, 1] }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-card col-span-12 p-5 md:col-span-4">
          <div className="mb-1 text-sm font-semibold text-ink">קצב פעילות שבועי</div>
          {q.isLoading ? (
            <div className="h-[200px] animate-pulse rounded-xl bg-surface-raised" />
          ) : (
            <ReactECharts option={weekOption} style={{ height: 200 }} notMerge={false} lazyUpdate />
          )}
        </div>

        <div className="glass-card col-span-12 p-5 md:col-span-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-sm font-semibold text-ink">עסקאות מובילות</div>
            <Link to="/crm/deals" className="flex items-center gap-0.5 text-[10px] text-faint transition hover:text-ink">
              ללוח <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
          {topDeals.length === 0 && !q.isLoading && (
            <div className="flex h-[180px] items-center justify-center text-xs text-faint">
              אין עסקאות פתוחות כרגע
            </div>
          )}
          <div className="flex flex-col gap-3">
            {topDeals.map((d, i) => (
              <div key={d.id}>
                <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                  <span className="truncate text-ink">{d.title}</span>
                  <span className="shrink-0 font-semibold text-gold-strong tabular-nums">
                    {formatAgorotCompact(d.value_agorot)}
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-surface-raised">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: STAGE_CHART_COLORS[d.stage] ?? CHART_COLORS.gold }}
                    initial={{ width: 0 }}
                    animate={{ width: `${(d.value_agorot / topMax) * 100}%` }}
                    transition={{ duration: 1, delay: 0.2 + i * 0.08, ease: [0.16, 1, 0.3, 1] }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
