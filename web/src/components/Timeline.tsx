import type { EventItem } from '../lib/types';
import { relativeTimeHe } from '../lib/time';
import { EmptyState, SkeletonRow } from './ui';

const VERB_META: Record<string, { icon: string; label: string }> = {
  'message.received': { icon: '💬', label: 'הודעה נכנסת' },
  'message.sent': { icon: '📤', label: 'הודעה יוצאת' },
  'lead.seen': { icon: '🎯', label: 'ליד חדש' },
  'lead.stage_changed': { icon: '📈', label: 'שלב ליד עודכן' },
  'approval.requested': { icon: '✋', label: 'בקשת אישור' },
  'approval.decided': { icon: '✅', label: 'החלטת אישור' },
  'order.created': { icon: '🛒', label: 'הזמנה חדשה' },
  'payment.received': { icon: '💰', label: 'תשלום התקבל' },
  'memory.written': { icon: '🧠', label: 'זיכרון נשמר' },
  'account.created': { icon: '🏢', label: 'חשבון נוצר' },
  'deal.created': { icon: '📄', label: 'עסקה נוצרה' },
  'deal.stage_changed': { icon: '↔️', label: 'שלב עסקה עודכן' },
  'deal.updated': { icon: '✏️', label: 'עסקה עודכנה' },
  'deal.won': { icon: '🏆', label: 'עסקה נסגרה בזכייה' },
  'deal.lost': { icon: '💔', label: 'עסקה אבודה' },
  'task.created': { icon: '📝', label: 'משימה נוצרה' },
  'task.completed': { icon: '☑️', label: 'משימה הושלמה' },
  'ticket.created': { icon: '🎫', label: 'טיקט נפתח' },
  'ticket.status_changed': { icon: '🔁', label: 'סטטוס טיקט עודכן' },
  'activity.logged': { icon: '🗒️', label: 'פעילות תועדה' },
};

const FALLBACK = { icon: '📌', label: 'אירוע' };

function summaryOf(ev: EventItem): string | null {
  const p = ev.payload ?? {};
  for (const key of ['preview_text', 'body', 'text', 'summary', 'title', 'name']) {
    const v = p[key];
    if (typeof v === 'string' && v.trim()) return v;
  }
  return null;
}

export function Timeline({
  events,
  loading,
  now = Date.now(),
}: {
  events: EventItem[];
  loading?: boolean;
  now?: number;
}) {
  if (loading) {
    return (
      <div className="space-y-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex gap-3">
            <SkeletonRow className="h-9 w-9 rounded-full" />
            <div className="flex-1 space-y-2 py-1">
              <SkeletonRow className="h-3 w-1/3" />
              <SkeletonRow className="h-3 w-2/3" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <EmptyState
        icon="🕓"
        title="אין עדיין פעילות"
        hint="כל אירוע שקשור לרשומה הזו — הודעות, עסקאות, פעילויות — יופיע כאן בסדר כרונולוגי."
      />
    );
  }

  return (
    <ol className="relative space-y-5 ps-2">
      {events.map((ev, i) => {
        const meta = VERB_META[ev.verb] ?? FALLBACK;
        const summary = summaryOf(ev);
        const last = i === events.length - 1;
        return (
          <li key={ev.id} className="relative flex gap-3">
            {/* connector line */}
            {!last && (
              <span
                className="absolute start-4 top-9 h-[calc(100%+0.5rem)] w-px bg-border"
                aria-hidden="true"
              />
            )}
            <span className="z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-base shadow-card">
              {meta.icon}
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="text-sm font-medium text-ink">{meta.label}</span>
                <time className="text-xs text-faint" dateTime={ev.ts}>
                  {relativeTimeHe(ev.ts, now)}
                </time>
              </div>
              {summary && <p className="mt-0.5 text-sm text-muted">{summary}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
