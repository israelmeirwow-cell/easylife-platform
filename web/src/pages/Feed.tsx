import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { ActorType, EventItem } from '../lib/types';
import { relativeTimeHe } from '../lib/time';
import { PageHeader } from '../components/PageHeader';

/* ---------- verb / actor presentation ---------- */

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
};

const FALLBACK_META = { icon: '📌', label: 'אירוע' };

const ACTOR_LABEL: Record<ActorType, string> = {
  agent: 'סוכן',
  human: 'אדם',
  system: 'מערכת',
  contact: 'לקוח',
};

const ACTOR_STYLE: Record<ActorType, string> = {
  agent: 'border-gold/40 bg-gold-soft text-gold-strong',
  human: 'border-border-strong bg-surface-raised text-ink',
  system: 'border-border bg-surface text-muted',
  contact: 'border-success/40 bg-success-soft text-success',
};

function eventSummary(ev: EventItem): string | null {
  const p = ev.payload ?? {};
  for (const key of ['preview_text', 'body', 'text', 'summary', 'title', 'name']) {
    const v = p[key];
    if (typeof v === 'string' && v.trim()) return v;
  }
  return null;
}

/* ---------- SSE hook with auto-reconnect ---------- */

function useFeedStream(onEvent: (ev: EventItem) => void): boolean {
  const cbRef = useRef(onEvent);
  cbRef.current = onEvent;
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    let es: EventSource | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let disposed = false;

    const open = () => {
      if (disposed) return;
      es = new EventSource('/api/feed/stream', { withCredentials: true });
      es.onopen = () => setConnected(true);
      es.onmessage = (msg) => {
        try {
          cbRef.current(JSON.parse(msg.data) as EventItem);
        } catch {
          /* ignore malformed frames (e.g. keep-alive pings) */
        }
      };
      es.onerror = () => {
        setConnected(false);
        es?.close();
        timer = setTimeout(open, 3000);
      };
    };

    open();
    return () => {
      disposed = true;
      if (timer) clearTimeout(timer);
      es?.close();
    };
  }, []);

  return connected;
}

/* ---------- components ---------- */

function ActorBadge({ type }: { type: ActorType }) {
  return (
    <span
      className={`rounded-full border px-2 py-0.5 text-[11px] font-medium leading-4 ${
        ACTOR_STYLE[type] ?? ACTOR_STYLE.system
      }`}
    >
      {ACTOR_LABEL[type] ?? type}
    </span>
  );
}

function EventCard({ ev, isNew, now }: { ev: EventItem; isNew: boolean; now: number }) {
  const meta = VERB_META[ev.verb] ?? FALLBACK_META;
  const summary = eventSummary(ev);
  return (
    <article
      className={`flex items-start gap-4 rounded-2xl border border-border bg-surface p-4 shadow-card ${
        isNew ? 'animate-feed-in' : ''
      }`}
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gold-soft text-lg">
        <span aria-hidden="true">{meta.icon}</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-ink">{meta.label}</span>
          <ActorBadge type={ev.actor_type} />
          {ev.actor_id && <span className="text-xs text-faint">{ev.actor_id}</span>}
          <time className="ms-auto shrink-0 text-xs text-faint" dateTime={ev.ts}>
            {relativeTimeHe(ev.ts, now)}
          </time>
        </div>
        {summary && <p className="mt-1.5 truncate text-sm text-muted">{summary}</p>}
      </div>
    </article>
  );
}

function SkeletonCard() {
  return (
    <div className="flex animate-pulse items-start gap-4 rounded-2xl border border-border bg-surface p-4">
      <div className="h-10 w-10 rounded-full bg-surface-raised" />
      <div className="flex-1 space-y-2.5 py-1">
        <div className="h-3 w-1/3 rounded bg-surface-raised" />
        <div className="h-3 w-2/3 rounded bg-surface-raised" />
      </div>
    </div>
  );
}

function EmptyState({ apiDown }: { apiDown: boolean }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border-strong bg-surface/60 px-6 py-16 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-gold-soft text-2xl">
        ⚡
      </span>
      <p className="text-base font-medium text-ink">עדיין אין אירועים</p>
      <p className="max-w-sm text-sm leading-relaxed text-muted">
        כשהסוכנים יתחילו לעבוד, כל פעולה בעסק — הודעות, לידים, אישורים ותשלומים — תופיע כאן
        בזמן אמת.
      </p>
      {apiDown && (
        <p className="mt-1 text-xs text-warning">השרת אינו זמין כרגע — ננסה להתחבר שוב אוטומטית.</p>
      )}
    </div>
  );
}

/* ---------- page ---------- */

export default function Feed() {
  const [live, setLive] = useState<EventItem[]>([]);
  const [now, setNow] = useState(() => Date.now());

  // refresh relative times every 30s
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const query = useQuery({
    queryKey: ['feed'],
    queryFn: async () => {
      const data = await api<EventItem[] | { items: EventItem[] }>('/api/feed');
      return Array.isArray(data) ? data : (data.items ?? []);
    },
  });

  const handleEvent = useCallback((ev: EventItem) => {
    setLive((prev) => (prev.some((e) => e.id === ev.id) ? prev : [ev, ...prev].slice(0, 200)));
  }, []);

  const connected = useFeedStream(handleEvent);

  const liveIds = useMemo(() => new Set(live.map((e) => e.id)), [live]);
  const events = useMemo(() => {
    const initial = (query.data ?? []).filter((e) => !liveIds.has(e.id));
    return [...live, ...initial];
  }, [live, liveIds, query.data]);

  return (
    <div className="mx-auto w-full max-w-3xl">
      <PageHeader
        title="פיד חי"
        subtitle="כל מה שקורה בעסק — סוכנים, אנשים ולקוחות — בזרם אחד, ברגע שזה קורה."
      />

      <div className="mb-5 flex items-center gap-2 text-xs">
        <span
          className={`h-2.5 w-2.5 rounded-full ${
            connected ? 'animate-pulse-dot bg-success shadow-[0_0_8px_rgba(133,185,138,0.7)]' : 'bg-danger'
          }`}
        />
        <span className={connected ? 'text-success' : 'text-danger'}>
          {connected ? 'מחובר' : 'מנותק — מתחבר מחדש...'}
        </span>
      </div>

      <div className="space-y-3">
        {query.isLoading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : events.length === 0 ? (
          <EmptyState apiDown={query.isError && !connected} />
        ) : (
          events.map((ev) => (
            <EventCard key={ev.id} ev={ev} isNew={liveIds.has(ev.id)} now={now} />
          ))
        )}
      </div>
    </div>
  );
}
