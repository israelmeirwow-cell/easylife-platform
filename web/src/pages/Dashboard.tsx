import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import { dashboardSummary } from '../lib/crm';
import type { DashboardSummary, DealStage } from '../lib/types';
import { DEAL_STAGE_LABEL, DEAL_STAGES } from '../lib/crmMeta';
import { formatAgorot, formatAgorotCompact, formatNumber } from '../lib/format';
import { PageHeader } from '../components/PageHeader';
import { Card, SkeletonRow } from '../components/ui';
import { AXIS_LABEL, CHART_COLORS, STAGE_CHART_COLORS, TOOLTIP_STYLE } from '../lib/chartTheme';

/* ------------------------------- KPI card -------------------------------- */

function KpiCard({
  label,
  value,
  hint,
  accent,
  icon,
  loading,
}: {
  label: string;
  value: string;
  hint?: string;
  accent: string;
  icon: string;
  loading?: boolean;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <span className="text-sm text-muted">{label}</span>
        <span
          className={`flex h-9 w-9 items-center justify-center rounded-xl text-base ${accent}`}
          aria-hidden
        >
          {icon}
        </span>
      </div>
      {loading ? (
        <SkeletonRow className="mt-3 h-8 w-28" />
      ) : (
        <div className="mt-2 text-2xl font-semibold tracking-tight text-ink">{value}</div>
      )}
      {hint && <div className="mt-1 text-xs text-faint">{hint}</div>}
    </Card>
  );
}

/* --------------------------------- Charts -------------------------------- */

function stageChartData(summary: DashboardSummary) {
  const byStage = new Map(summary.deals_by_stage.map((b) => [b.stage, b]));
  // keep board order, include zeroes so the axis is stable
  return DEAL_STAGES.map((s) => {
    const b = byStage.get(s.key);
    return {
      stage: s.key as DealStage,
      label: DEAL_STAGE_LABEL[s.key],
      count: b?.count ?? 0,
      value_agorot: b?.value_agorot ?? 0,
    };
  });
}

function DealsByStageChart({ summary }: { summary: DashboardSummary }) {
  const data = useMemo(() => stageChartData(summary), [summary]);
  const option: EChartsOption = {
    grid: { top: 24, right: 16, bottom: 28, left: 16, containLabel: true },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      ...TOOLTIP_STYLE,
      formatter: (params: unknown) => {
        const arr = params as { dataIndex: number }[];
        const d = data[arr[0]?.dataIndex ?? 0];
        return `<b>${d.label}</b><br/>${formatNumber(d.count)} עסקאות<br/>${formatAgorot(
          d.value_agorot,
        )}`;
      },
    },
    xAxis: {
      type: 'category',
      inverse: true, // RTL: first stage on the right
      data: data.map((d) => d.label),
      axisLabel: AXIS_LABEL,
      axisLine: { lineStyle: { color: CHART_COLORS.border } },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value',
      minInterval: 1,
      axisLabel: AXIS_LABEL,
      splitLine: { lineStyle: { color: CHART_COLORS.border } },
    },
    series: [
      {
        type: 'bar',
        barWidth: '52%',
        data: data.map((d) => ({
          value: d.count,
          itemStyle: {
            color: STAGE_CHART_COLORS[d.stage] ?? CHART_COLORS.gold,
            borderRadius: [6, 6, 0, 0],
          },
        })),
      },
    ],
  };
  return <ReactECharts option={option} style={{ height: 280 }} notMerge lazyUpdate />;
}

function PipelineValueChart({ summary }: { summary: DashboardSummary }) {
  const data = useMemo(
    () => stageChartData(summary).filter((d) => d.stage !== 'lost'),
    [summary],
  );
  const option: EChartsOption = {
    grid: { top: 24, right: 16, bottom: 28, left: 16, containLabel: true },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      ...TOOLTIP_STYLE,
      formatter: (params: unknown) => {
        const arr = params as { dataIndex: number }[];
        const d = data[arr[0]?.dataIndex ?? 0];
        return `<b>${d.label}</b><br/>${formatAgorot(d.value_agorot)}`;
      },
    },
    xAxis: {
      type: 'category',
      inverse: true,
      data: data.map((d) => d.label),
      axisLabel: AXIS_LABEL,
      axisLine: { lineStyle: { color: CHART_COLORS.border } },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value',
      axisLabel: {
        ...AXIS_LABEL,
        formatter: (v: number) => formatAgorotCompact(v),
      },
      splitLine: { lineStyle: { color: CHART_COLORS.border } },
    },
    series: [
      {
        type: 'bar',
        barWidth: '52%',
        data: data.map((d) => ({
          value: d.value_agorot,
          itemStyle: {
            color: STAGE_CHART_COLORS[d.stage] ?? CHART_COLORS.gold,
            borderRadius: [6, 6, 0, 0],
          },
        })),
      },
    ],
  };
  return <ReactECharts option={option} style={{ height: 280 }} notMerge lazyUpdate />;
}

/* --------------------------------- Page ---------------------------------- */

export default function Dashboard() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['dashboard-summary'],
    queryFn: () => dashboardSummary(),
  });

  const s = data;

  return (
    <div className="mx-auto w-full max-w-7xl">
      <PageHeader
        title="סקירה כללית"
        subtitle="המספרים החשובים של העסק במבט אחד — צינור מכירות, לקוחות ומשימות פתוחות."
      />

      {isError && (
        <div className="mb-5 rounded-xl border border-warning/40 bg-warning-soft px-4 py-3 text-sm text-warning">
          לא הצלחנו לטעון את הנתונים כרגע. ודאו שהשרת פועל ונסו לרענן.
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          label="עסקאות פתוחות"
          value={formatNumber(s?.open_deals_count)}
          accent="bg-info-soft text-info"
          icon="📄"
          loading={isLoading}
        />
        <KpiCard
          label="שווי צינור"
          value={formatAgorotCompact(s?.pipeline_value_agorot)}
          hint={s ? formatAgorot(s.pipeline_value_agorot) : undefined}
          accent="bg-gold-soft text-gold-strong"
          icon="💼"
          loading={isLoading}
        />
        <KpiCard
          label="נסגר החודש"
          value={formatAgorotCompact(s?.won_this_month_agorot)}
          hint={s ? formatAgorot(s.won_this_month_agorot) : undefined}
          accent="bg-success-soft text-success"
          icon="🏆"
          loading={isLoading}
        />
        <KpiCard
          label="אנשי קשר"
          value={formatNumber(s?.contacts_count)}
          accent="bg-charcoal text-gold"
          icon="👥"
          loading={isLoading}
        />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          label="לידים"
          value={formatNumber(s?.leads_count)}
          accent="bg-info-soft text-info"
          icon="🎯"
          loading={isLoading}
        />
        <KpiCard
          label="משימות פתוחות"
          value={formatNumber(s?.tasks_open_count)}
          accent="bg-warning-soft text-warning"
          icon="✅"
          loading={isLoading}
        />
        <KpiCard
          label="טיקטים פתוחים"
          value={formatNumber(s?.tickets_open_count)}
          accent="bg-danger-soft text-danger"
          icon="🎫"
          loading={isLoading}
        />
        <KpiCard
          label="סה״כ עסקאות"
          value={formatNumber(
            s?.deals_by_stage.reduce((acc, b) => acc + b.count, 0),
          )}
          accent="bg-surface-raised text-muted"
          icon="📊"
          loading={isLoading}
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-1 text-sm font-semibold text-ink">עסקאות לפי שלב</h2>
          <p className="mb-2 text-xs text-muted">מספר העסקאות בכל שלב בצינור</p>
          {isLoading || !s ? (
            <SkeletonRow className="h-64 w-full rounded-xl" />
          ) : (
            <DealsByStageChart summary={s} />
          )}
        </Card>
        <Card className="p-5">
          <h2 className="mb-1 text-sm font-semibold text-ink">שווי צינור לפי שלב</h2>
          <p className="mb-2 text-xs text-muted">סכום הכספי הפתוח בכל שלב (₪)</p>
          {isLoading || !s ? (
            <SkeletonRow className="h-64 w-full rounded-xl" />
          ) : (
            <PipelineValueChart summary={s} />
          )}
        </Card>
      </div>
    </div>
  );
}
