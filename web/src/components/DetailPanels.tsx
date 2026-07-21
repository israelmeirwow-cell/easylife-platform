import { useState } from 'react';
import type { Activity, Deal, EventItem, Task } from '../lib/types';
import { formatAgorot, formatDate, formatDateTime } from '../lib/format';
import {
  ACTIVITY_KIND_ICON,
  ACTIVITY_KIND_LABEL,
  DEAL_STAGE_LABEL,
  TASK_PRIORITY_LABEL,
  TASK_PRIORITY_TONE,
  TASK_STATUS_LABEL,
} from '../lib/crmMeta';
import { Timeline } from './Timeline';
import { Badge, EmptyState } from './ui';

type TabKey = 'timeline' | 'deals' | 'tasks' | 'activities';

const TAB_LABELS: Record<TabKey, string> = {
  timeline: 'ציר זמן',
  deals: 'עסקאות',
  tasks: 'משימות',
  activities: 'פעילויות',
};

export function DetailPanels({
  timeline,
  timelineLoading,
  deals,
  tasks,
  activities,
  activitiesLoading,
}: {
  timeline: EventItem[];
  timelineLoading?: boolean;
  deals: Deal[];
  tasks: Task[];
  activities: Activity[];
  activitiesLoading?: boolean;
}) {
  const [tab, setTab] = useState<TabKey>('timeline');
  const counts: Record<TabKey, number> = {
    timeline: timeline.length,
    deals: deals.length,
    tasks: tasks.length,
    activities: activities.length,
  };

  return (
    <div className="rounded-2xl border border-border bg-surface shadow-card">
      <div className="flex flex-wrap gap-1 border-b border-border px-2">
        {(Object.keys(TAB_LABELS) as TabKey[]).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            className={`relative rounded-t-lg px-4 py-3 text-sm font-medium transition-colors ${
              tab === k ? 'text-ink' : 'text-muted hover:text-ink'
            }`}
          >
            {TAB_LABELS[k]}
            <span className="ms-1.5 rounded-full bg-surface-raised px-1.5 py-0.5 text-[11px] text-muted">
              {counts[k]}
            </span>
            {tab === k && (
              <span className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-gold" />
            )}
          </button>
        ))}
      </div>

      <div className="p-5">
        {tab === 'timeline' && <Timeline events={timeline} loading={timelineLoading} />}

        {tab === 'deals' &&
          (deals.length === 0 ? (
            <EmptyState icon="📄" title="אין עסקאות משויכות" />
          ) : (
            <ul className="space-y-2.5">
              {deals.map((d) => (
                <li
                  key={d.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface-raised/40 px-4 py-3"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-ink">{d.title}</div>
                    <div className="text-xs text-muted">{DEAL_STAGE_LABEL[d.stage]}</div>
                  </div>
                  <span className="shrink-0 text-sm font-semibold text-gold-strong">
                    {formatAgorot(d.value_agorot)}
                  </span>
                </li>
              ))}
            </ul>
          ))}

        {tab === 'tasks' &&
          (tasks.length === 0 ? (
            <EmptyState icon="✅" title="אין משימות משויכות" />
          ) : (
            <ul className="space-y-2.5">
              {tasks.map((t) => (
                <li
                  key={t.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface-raised/40 px-4 py-3"
                >
                  <div className="min-w-0">
                    <div
                      className={`truncate text-sm font-medium ${
                        t.status === 'done' ? 'text-faint line-through' : 'text-ink'
                      }`}
                    >
                      {t.title}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted">
                      <span>{TASK_STATUS_LABEL[t.status]}</span>
                      {t.due_at && <span>· יעד {formatDate(t.due_at)}</span>}
                    </div>
                  </div>
                  <Badge tone={TASK_PRIORITY_TONE[t.priority]}>
                    {TASK_PRIORITY_LABEL[t.priority]}
                  </Badge>
                </li>
              ))}
            </ul>
          ))}

        {tab === 'activities' &&
          (activitiesLoading ? (
            <p className="text-sm text-muted">טוען…</p>
          ) : activities.length === 0 ? (
            <EmptyState icon="🗒️" title="אין פעילויות מתועדות" />
          ) : (
            <ul className="space-y-3">
              {activities.map((a) => (
                <li key={a.id} className="flex gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-base">
                    {ACTIVITY_KIND_ICON[a.kind]}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <span className="text-sm font-medium text-ink">
                        {ACTIVITY_KIND_LABEL[a.kind]}
                      </span>
                      <time className="text-xs text-faint">
                        {formatDateTime(a.occurred_at)}
                      </time>
                    </div>
                    <p className="mt-0.5 text-sm text-muted">{a.body}</p>
                  </div>
                </li>
              ))}
            </ul>
          ))}
      </div>
    </div>
  );
}
