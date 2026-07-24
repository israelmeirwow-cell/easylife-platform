import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, IS_DEMO } from '../lib/api';
import type { ActorType, EventItem } from '../lib/types';
import { relativeTimeHe } from '../lib/time';

/* "פיד חי" — the live event stream, rebuilt from the Claude Design v2 handoff
   (Feed.dc.html). New structure ported 1:1: pause/resume, summary cards,
   search + agent filter, filter chips with counts, day-grouped timeline, and
   an event detail drawer. The responsive system uses the design's r-* CSS
   (see RESPONSIVE_CSS + the r-3 / r-main classes) at the 760px breakpoint.

   Per the handoff the verb glyph stays an EMOJI (deliberate exception — event
   verbs read as emoji; all structural/interactive icons remain inline SVG).
   The SSE stream keeps its IS_DEMO guard so the demo build renders the
   /api/feed fixture without a backend. */

/* ---------- responsive system (copied verbatim from Feed.dc.html) --------- */

const RESPONSIVE_CSS = `
@media (max-width:760px){ .r-main{padding-inline:14px !important;} .r-3{grid-template-columns:1fr !important;} }
.fe-row:hover .glass-card { box-shadow:0 4px 12px rgba(15,23,42,.1); }
@keyframes dash-drawer-in { from { transform:translateX(-100%); } to { transform:translateX(0); } }
@keyframes dash-fade { from { opacity:0; } to { opacity:1; } }
`;

/* ---------- verb / actor presentation ------------------------------------ */

interface VerbMeta {
  emoji: string;
  label: string;
  tint: string;
}

const VERB_META: Record<string, VerbMeta> = {
  'message.received': { emoji: '💬', label: 'הודעה נכנסת', tint: '#0e7490' },
  'message.sent': { emoji: '📤', label: 'הודעה יוצאת', tint: '#0e8ba0' },
  'lead.seen': { emoji: '🎯', label: 'ליד חדש', tint: '#0e8ba0' },
  'lead.stage_changed': { emoji: '📈', label: 'שלב ליד עודכן', tint: '#6d8bf0' },
  'deal.created': { emoji: '📋', label: 'עסקה נפתחה', tint: '#0e8ba0' },
  'deal.won': { emoji: '🏆', label: 'עסקה נסגרה בזכייה', tint: '#12805c' },
  'deal.lost': { emoji: '📉', label: 'עסקה נסגרה בהפסד', tint: '#b26a00' },
  'approval.requested': { emoji: '✋', label: 'בקשת אישור', tint: '#b26a00' },
  'approval.decided': { emoji: '✅', label: 'החלטת אישור', tint: '#12805c' },
  'order.created': { emoji: '🛒', label: 'הזמנה חדשה', tint: '#b26a00' },
  'payment.received': { emoji: '💰', label: 'תשלום התקבל', tint: '#12805c' },
  'memory.written': { emoji: '🧠', label: 'זיכרון נשמר', tint: '#7c6cf0' },
  'activity.logged': { emoji: '📝', label: 'פעילות נרשמה', tint: '#55627a' },
  'task.created': { emoji: '📌', label: 'משימה נוצרה', tint: '#0e8ba0' },
  'task.completed': { emoji: '✔️', label: 'משימה הושלמה', tint: '#12805c' },
  'ticket.created': { emoji: '🎫', label: 'פנייה חדשה', tint: '#b26a00' },
  'ticket.status_changed': { emoji: '🔄', label: 'סטטוס פנייה עודכן', tint: '#0e7490' },
  'connection.created': { emoji: '🔌', label: 'חיבור נוסף', tint: '#12805c' },
  'connection.removed': { emoji: '🔒', label: 'חיבור הוסר', tint: '#b26a00' },
  'finding.created': { emoji: '💡', label: 'תובנה חדשה', tint: '#7c6cf0' },
  'contact.created': { emoji: '👤', label: 'איש קשר נוסף', tint: '#0e8ba0' },
  'account.created': { emoji: '🏢', label: 'לקוח נוסף', tint: '#0e8ba0' },
};

const FALLBACK_META: VerbMeta = { emoji: '📌', label: 'אירוע', tint: '#94a3b8' };

function verbMeta(verb: string): VerbMeta {
  return VERB_META[verb] ?? FALLBACK_META;
}

const ACTOR_LABEL: Record<ActorType, string> = {
  agent: 'סוכן',
  human: 'אדם',
  system: 'מערכת',
  contact: 'לקוח',
};

// literal design values (equal our tokens) — inline so pills match the drawer exactly
const ACTOR_PILL: Record<ActorType, string> = {
  agent: 'border:1px solid rgba(14,139,160,.4); background:rgba(14,139,160,.1); color:#0b7688;',
  human: 'border:1px solid rgba(15,23,42,.16); background:#f1f5f9; color:#0f172a;',
  system: 'border:1px solid rgba(15,23,42,.08); background:#fff; color:#55627a;',
  contact: 'border:1px solid rgba(18,128,92,.4); background:rgba(18,128,92,.1); color:#12805c;',
};

/* category mapping (design: _cat) — used by filter chips + summary counters */
type Category = 'sales' | 'leads' | 'messages' | 'system';

function categoryOf(verb: string): Category {
  if (verb === 'deal.won' || verb === 'deal.created' || verb === 'deal.lost' || verb === 'payment.received' || verb === 'order.created')
    return 'sales';
  if (verb === 'lead.seen' || verb === 'lead.stage_changed') return 'leads';
  if (verb === 'message.received' || verb === 'message.sent' || verb === 'ticket.created') return 'messages';
  return 'system';
}

function eventSummary(ev: EventItem): string {
  const p = ev.payload ?? {};
  for (const key of ['preview_text', 'body', 'text', 'summary', 'title', 'subject', 'name']) {
    const v = p[key];
    if (typeof v === 'string' && v.trim()) return v;
  }
  return verbMeta(ev.verb).label;
}

function actorName(ev: EventItem): string {
  return ev.actor_id ?? ACTOR_LABEL[ev.actor_type] ?? '';
}

/* ---------- inline SVG helper (structural icons) ---------- */

function Ico({ d, size = 16 }: { d: string; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} width={size} height={size}>
      <path strokeLinecap="round" strokeLinejoin="round" d={d} />
    </svg>
  );
}

const ICON = {
  search: 'm21 21-4.34-4.34M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z',
  play: 'M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z',
  pause: 'M15.75 5.25v13.5m-7.5-13.5v13.5',
  close: 'M6 18 18 6M6 6l12 12',
  chevron: 'M15.75 19.5 8.25 12l7.5-7.5',
  bolt: 'M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z',
  users:
    'M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Z',
  trend: 'M2.25 18 9 11.25l4.306 4.307a11.95 11.95 0 0 1 5.814-5.518l2.74-1.22m0 0-5.94-2.28m5.94 2.28-2.28 5.941',
};

/* ---------- SSE hook with auto-reconnect (IS_DEMO guarded) ---------- */

function useFeedStream(onEvent: (ev: EventItem) => void, paused: boolean): boolean {
  const cbRef = useRef(onEvent);
  cbRef.current = onEvent;
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    // Demo build has no backend / SSE — show "connected" and let the /api/feed
    // fixture render the stream.
    if (IS_DEMO) {
      setConnected(true);
      return;
    }
    let es: EventSource | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let disposed = false;

    const open = () => {
      if (disposed) return;
      es = new EventSource('/api/feed/stream', { withCredentials: true });
      es.onopen = () => setConnected(true);
      es.onmessage = (msg) => {
        if (pausedRef.current) return;
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

/* ---------- page ---------- */

type FilterKey = 'all' | 'agents' | 'sales' | 'leads' | 'messages';

const FILTER_DEFS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'הכל' },
  { key: 'agents', label: 'סוכנים' },
  { key: 'sales', label: 'מכירות' },
  { key: 'leads', label: 'לידים' },
  { key: 'messages', label: 'הודעות' },
];

export default function Feed() {
  const [live, setLive] = useState<EventItem[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const [paused, setPaused] = useState(false);
  const [filter, setFilter] = useState<FilterKey>('all');
  const [agentFilter, setAgentFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [openId, setOpenId] = useState<number | null>(null);

  // refresh relative times every 30s
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const handleEvent = useCallback((ev: EventItem) => {
    setLive((prev) => (prev.some((e) => e.id === ev.id) ? prev : [ev, ...prev].slice(0, 200)));
  }, []);

  const connected = useFeedStream(handleEvent, paused);

  // initial fixture / history load (kept in state so a re-fetch isn't needed)
  const [initial, setInitial] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState(false);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api<EventItem[] | { items: EventItem[] }>('/api/feed');
        if (cancelled) return;
        setInitial(Array.isArray(data) ? data : (data.items ?? []));
      } catch {
        if (!cancelled) setApiError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const liveIds = useMemo(() => new Set(live.map((e) => e.id)), [live]);
  const raw = useMemo(() => {
    const rest = initial.filter((e) => !liveIds.has(e.id));
    return [...live, ...rest];
  }, [live, liveIds, initial]);

  // ----- filtering (design: filter + agentFilter + search) -----
  const filtered = useMemo(() => {
    const q = search.trim();
    return raw.filter((e) => {
      if (filter === 'agents' && e.actor_type !== 'agent') return false;
      if (filter !== 'all' && filter !== 'agents' && categoryOf(e.verb) !== filter) return false;
      if (agentFilter !== 'all' && actorName(e) !== agentFilter) return false;
      if (q) {
        const hay = `${eventSummary(e)} ${actorName(e)} ${verbMeta(e.verb).label}`;
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [raw, filter, agentFilter, search]);

  // ----- day grouping (design: dayOf) -----
  const groups = useMemo(() => {
    const dayOf = (iso: string): string => {
      const d = new Date(iso);
      const t = new Date(now);
      const diff = Math.floor(
        (new Date(t.getFullYear(), t.getMonth(), t.getDate()).getTime() -
          new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) /
          86_400_000,
      );
      if (diff <= 0) return 'היום';
      if (diff === 1) return 'אתמול';
      return 'מוקדם יותר';
    };
    const buckets: Record<string, EventItem[]> = {};
    filtered.forEach((e) => {
      const dl = dayOf(e.ts);
      (buckets[dl] = buckets[dl] ?? []).push(e);
    });
    const order = ['היום', 'אתמול', 'מוקדם יותר'];
    return order.filter((k) => buckets[k]).map((k) => ({ label: k, events: buckets[k] }));
  }, [filtered, now]);

  // ----- summary cards (design: summary) -----
  const summary = useMemo(() => {
    const isToday = (iso: string) => {
      const d = new Date(iso);
      const t = new Date(now);
      return d.getFullYear() === t.getFullYear() && d.getMonth() === t.getMonth() && d.getDate() === t.getDate();
    };
    const todayCount = raw.filter((e) => isToday(e.ts)).length;
    const leadsCount = raw.filter((e) => categoryOf(e.verb) === 'leads').length;
    const salesCount = raw.filter((e) => categoryOf(e.verb) === 'sales').length;
    return [
      { label: 'אירועים היום', value: String(todayCount), color: '#0e8ba0', tint: 'rgba(14,139,160,.1)', d: ICON.bolt },
      { label: 'לידים חדשים', value: String(leadsCount), color: '#1666a8', tint: 'rgba(22,102,168,.1)', d: ICON.users },
      { label: 'מכירות', value: String(salesCount), color: '#12805c', tint: 'rgba(18,128,92,.1)', d: ICON.trend },
    ];
  }, [raw, now]);

  // ----- filter chip counts (design: cnt) -----
  const counts = useMemo(
    () => ({
      all: raw.length,
      agents: raw.filter((e) => e.actor_type === 'agent').length,
      sales: raw.filter((e) => categoryOf(e.verb) === 'sales').length,
      leads: raw.filter((e) => categoryOf(e.verb) === 'leads').length,
      messages: raw.filter((e) => categoryOf(e.verb) === 'messages').length,
    }),
    [raw],
  );

  // ----- agent options for the select (design: agentOptions) -----
  const agentOptions = useMemo(() => {
    const ids = [...new Set(raw.filter((e) => e.actor_type === 'agent').map((e) => actorName(e)).filter(Boolean))];
    return [{ val: 'all', label: 'כל הסוכנים' }, ...ids.map((a) => ({ val: a, label: a }))];
  }, [raw]);

  // ----- drawer detail (design: det) -----
  const detail = useMemo(() => {
    if (openId == null) return null;
    const e = raw.find((x) => x.id === openId);
    if (!e) return null;
    const meta = verbMeta(e.verb);
    const p = e.payload ?? {};
    const amount = typeof p.amount === 'string' ? p.amount : typeof p.amount_agorot === 'number' ? `₪${(p.amount_agorot / 100).toLocaleString('he-IL')}` : null;
    const account = typeof p.account === 'string' ? p.account : typeof p.contact_name === 'string' ? p.contact_name : null;
    const fields: { label: string; value: string }[] = [
      { label: 'סוג', value: meta.label },
      { label: 'מבצע', value: `${ACTOR_LABEL[e.actor_type]} · ${actorName(e)}` },
      { label: 'זמן', value: relativeTimeHe(e.ts, now) },
    ];
    if (amount) fields.push({ label: 'סכום', value: amount });
    const links: { label: string; href: string }[] = [];
    const cat = categoryOf(e.verb);
    if (account) links.push({ label: `פתח לקוח: ${account}`, href: '#/crm' });
    if (cat === 'sales') links.push({ label: 'צפה בעסקה', href: '#/' });
    if (e.verb === 'message.received' || e.verb === 'message.sent') links.push({ label: 'פתח שיחה באינבוקס', href: '#/inbox' });
    return { meta, summary: eventSummary(e), time: relativeTimeHe(e.ts, now), fields, links };
  }, [openId, raw, now]);

  const empty = !loading && filtered.length === 0;

  const chipOn =
    'cursor:pointer; font-family:inherit; border-radius:999px; padding:8px 15px; font-size:13px; font-weight:600; border:1px solid #0e8ba0; background:#0e8ba0; color:#fff;';
  const chipOff =
    'cursor:pointer; font-family:inherit; border-radius:999px; padding:8px 15px; font-size:13px; font-weight:500; border:1px solid rgba(15,23,42,.16); background:#fff; color:#55627a;';

  return (
    <main
      className="r-main"
      dir="rtl"
      style={{ maxWidth: 900, margin: '0 auto', padding: '28px 0 64px' }}
    >
      <style dangerouslySetInnerHTML={{ __html: RESPONSIVE_CSS }} />

      {/* header row: title + pause toggle + connection dot */}
      <div style={{ marginBottom: 20, display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 14 }}>
        <div>
          <div style={{ fontSize: 10, letterSpacing: '.25em', textTransform: 'uppercase', color: '#94a3b8', fontFamily: "'Space Grotesk',sans-serif" }}>
            Live Stream
          </div>
          <h1 style={{ margin: '6px 0 0', fontSize: 26, fontWeight: 600, letterSpacing: '-.01em' }}>פיד חי</h1>
          <p style={{ margin: '7px 0 0', fontSize: 14.5, color: '#55627a', maxWidth: '34em', lineHeight: 1.55 }}>
            כל מה שקורה בעסק — סוכנים, אנשים ולקוחות — בזרם אחד, ברגע שזה קורה.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              borderRadius: 999,
              border: '1px solid rgba(15,23,42,.08)',
              background: '#fff',
              padding: '6px 12px',
              fontSize: 12,
            }}
          >
            <span
              className={connected ? 'animate-pulse-dot' : ''}
              style={{ width: 8, height: 8, borderRadius: 999, background: connected ? '#12805c' : '#c0392b' }}
            />
            <span style={{ color: connected ? '#12805c' : '#c0392b' }}>{connected ? 'מחובר' : 'מתחבר מחדש…'}</span>
          </span>
          <button
            type="button"
            onClick={() => setPaused((v) => !v)}
            style={{
              cursor: 'pointer',
              fontFamily: 'inherit',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 7,
              borderRadius: 999,
              padding: '8px 15px',
              fontSize: 13,
              fontWeight: 600,
              ...(paused
                ? { border: '1px solid rgba(15,23,42,.16)', background: '#fff', color: '#55627a' }
                : { border: '1px solid rgba(18,128,92,.25)', background: 'rgba(18,128,92,.1)', color: '#12805c' }),
            }}
          >
            <Ico d={paused ? ICON.play : ICON.pause} size={14} />
            {paused ? 'הפעל זרימה' : 'השהה זרימה'}
          </button>
        </div>
      </div>

      {/* summary cards — r-3 → 1col @760 */}
      <div className="r-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 20 }}>
        {summary.map((s) => (
          <div key={s.label} className="glass-card" style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 13 }}>
            <span
              style={{
                flex: 'none',
                width: 42,
                height: 42,
                borderRadius: 12,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: s.tint,
                color: s.color,
              }}
            >
              <Ico d={s.d} size={20} />
            </span>
            <div>
              <div style={{ fontSize: 12, color: '#55627a' }}>{s.label}</div>
              <div className="tabular-nums" style={{ fontSize: 24, fontWeight: 600, letterSpacing: '-.01em', marginTop: 2 }}>
                {s.value}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* toolbar: search + agent filter */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 18 }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 180 }}>
          <span style={{ pointerEvents: 'none', position: 'absolute', insetInlineStart: 11, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}>
            <Ico d={ICON.search} size={15} />
          </span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="חיפוש באירועים…"
            style={{
              width: '100%',
              border: '1px solid rgba(15,23,42,.16)',
              background: '#fff',
              borderRadius: 11,
              padding: '9px 12px 9px 34px',
              fontFamily: 'inherit',
              fontSize: 13.5,
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>
        <select
          value={agentFilter}
          onChange={(e) => setAgentFilter(e.target.value)}
          style={{
            border: '1px solid rgba(15,23,42,.16)',
            background: '#fff',
            borderRadius: 11,
            padding: '9px 12px',
            fontFamily: 'inherit',
            fontSize: 13.5,
            color: '#0f172a',
            outline: 'none',
          }}
        >
          {agentOptions.map((o) => (
            <option key={o.val} value={o.val}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {/* filter chips */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 22 }}>
        {FILTER_DEFS.map((f) => {
          const on = filter === f.key;
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              // inline-style string mirrors the design exactly
              style={styleObj(on ? chipOn : chipOff)}
            >
              {f.label}
              <span style={{ marginInlineStart: 6, opacity: 0.7 }}>{counts[f.key]}</span>
            </button>
          );
        })}
      </div>

      {/* grouped timeline */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[0, 1, 2].map((i) => (
            <div key={i} className="animate-pulse" style={{ display: 'flex', alignItems: 'flex-start', gap: 16, borderRadius: 16, border: '1px solid rgba(15,23,42,.08)', background: '#fff', padding: 16 }}>
              <div style={{ width: 36, height: 36, borderRadius: 999, background: '#f1f5f9' }} />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 4 }}>
                <div style={{ height: 12, width: '33%', borderRadius: 6, background: '#f1f5f9' }} />
                <div style={{ height: 12, width: '66%', borderRadius: 6, background: '#f1f5f9' }} />
              </div>
            </div>
          ))}
        </div>
      ) : empty ? (
        <div className="glass-card" style={{ padding: 44, textAlign: 'center', fontSize: 14, color: '#55627a' }}>
          {raw.length === 0
            ? apiError && !connected
              ? 'השרת אינו זמין כרגע — ננסה להתחבר שוב אוטומטית.'
              : 'עדיין אין אירועים — כשהסוכנים יתחילו לעבוד, כל פעולה תופיע כאן בזמן אמת.'
            : 'אין אירועים שתואמים את הסינון'}
        </div>
      ) : (
        groups.map((grp) => (
          <div key={grp.label} style={{ marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '6px 0 14px' }}>
              <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.06em', color: '#94a3b8' }}>{grp.label}</span>
              <span style={{ flex: 1, height: 1, background: 'rgba(15,23,42,.08)' }} />
            </div>
            <div style={{ position: 'relative' }}>
              <div
                style={{
                  pointerEvents: 'none',
                  position: 'absolute',
                  top: 8,
                  bottom: 8,
                  insetInlineStart: 25,
                  width: 1,
                  background: 'linear-gradient(to bottom, rgba(14,139,160,.4) 0%, rgba(15,23,42,.07) 100%)',
                }}
              />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {grp.events.map((ev, i) => {
                  const meta = verbMeta(ev.verb);
                  const isNew = liveIds.has(ev.id);
                  return (
                    <article
                      key={ev.id}
                      className="fe-row"
                      onClick={() => setOpenId(ev.id)}
                      style={{
                        position: 'relative',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 16,
                        paddingInlineStart: 8,
                        cursor: 'pointer',
                        animation: isNew
                          ? 'feed-in .45s cubic-bezier(.22,1,.36,1) both'
                          : `feed-in .4s cubic-bezier(.22,1,.36,1) both`,
                        animationDelay: isNew ? undefined : `${Math.min(i, 8) * 40}ms`,
                      }}
                    >
                      <div
                        style={{
                          position: 'relative',
                          zIndex: 1,
                          marginTop: 12,
                          flex: 'none',
                          width: 36,
                          height: 36,
                          borderRadius: 999,
                          background: '#fff',
                          boxShadow: '0 1px 2px rgba(15,23,42,.04)',
                          border: '1px solid rgba(15,23,42,.08)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 16,
                        }}
                      >
                        {/* verb glyph — deliberate emoji per handoff */}
                        <span aria-hidden="true">{meta.emoji}</span>
                      </div>
                      <div className="glass-card" style={{ flex: 1, minWidth: 0, padding: '15px 16px', transition: 'box-shadow .15s ease' }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 14, fontWeight: 600 }}>{meta.label}</span>
                          <span style={styleObj(`border-radius:999px; padding:2px 9px; font-size:11px; font-weight:600; line-height:1.4; ${ACTOR_PILL[ev.actor_type]}`)}>
                            {ACTOR_LABEL[ev.actor_type]}
                          </span>
                          {ev.actor_id && <span style={{ fontSize: 12, color: '#94a3b8' }}>{ev.actor_id}</span>}
                          <time
                            className="tabular-nums"
                            dateTime={ev.ts}
                            style={{ marginInlineStart: 'auto', flex: 'none', fontSize: 12, color: '#94a3b8' }}
                          >
                            {relativeTimeHe(ev.ts, now)}
                          </time>
                        </div>
                        <p style={{ margin: '6px 0 0', fontSize: 13.5, color: '#55627a', lineHeight: 1.5 }}>{eventSummary(ev)}</p>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          </div>
        ))
      )}

      {/* EVENT DRAWER */}
      {detail && (
        <>
          <div
            onClick={() => setOpenId(null)}
            style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(15,23,42,.28)', animation: 'dash-fade .2s ease both' }}
          />
          <aside
            dir="rtl"
            style={{
              position: 'fixed',
              top: 0,
              insetInlineStart: 0,
              zIndex: 61,
              width: 'min(420px,94vw)',
              height: '100vh',
              background: '#fff',
              boxShadow: '0 12px 40px rgba(15,23,42,.2)',
              display: 'flex',
              flexDirection: 'column',
              animation: 'dash-drawer-in .28s cubic-bezier(.22,1,.36,1) both',
            }}
          >
            <div style={{ padding: 22, borderBottom: '1px solid rgba(15,23,42,.08)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span
                  style={{
                    flex: 'none',
                    width: 46,
                    height: 46,
                    borderRadius: 13,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: `${detail.meta.tint}18`,
                    fontSize: 22,
                  }}
                >
                  <span aria-hidden="true">{detail.meta.emoji}</span>
                </span>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 600 }}>{detail.meta.label}</div>
                  <div style={{ fontSize: 12.5, color: '#94a3b8' }}>{detail.time}</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpenId(null)}
                aria-label="סגור"
                style={{ cursor: 'pointer', border: 'none', background: 'none', color: '#94a3b8' }}
              >
                <Ico d={ICON.close} size={20} />
              </button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: 22 }}>
              <p style={{ margin: '0 0 20px', fontSize: 15, color: '#0f172a', lineHeight: 1.6 }}>{detail.summary}</p>
              <div style={{ border: '1px solid rgba(15,23,42,.08)', borderRadius: 12, padding: 14, display: 'flex', flexDirection: 'column', gap: 9, marginBottom: 20 }}>
                {detail.fields.map((f) => (
                  <div key={f.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5 }}>
                    <span style={{ color: '#94a3b8' }}>{f.label}</span>
                    <span style={{ color: '#0f172a', fontWeight: 500 }}>{f.value}</span>
                  </div>
                ))}
              </div>
              {detail.links.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {detail.links.map((l) => (
                    <a
                      key={l.label}
                      href={l.href}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        border: '1px solid rgba(15,23,42,.08)',
                        borderRadius: 11,
                        padding: '12px 14px',
                        fontSize: 13.5,
                        fontWeight: 600,
                        color: '#0f172a',
                      }}
                    >
                      {l.label}
                      <span style={{ color: '#94a3b8' }}>
                        <Ico d={ICON.chevron} size={15} />
                      </span>
                    </a>
                  ))}
                </div>
              )}
            </div>
          </aside>
        </>
      )}
    </main>
  );
}

/* Parse a design inline-style string ("a:b; c:d;") into a React style object so
   we can keep the design's literal CSS verbatim for the chips/pills. */
function styleObj(css: string): React.CSSProperties {
  const out: Record<string, string> = {};
  css.split(';').forEach((decl) => {
    const idx = decl.indexOf(':');
    if (idx === -1) return;
    const prop = decl.slice(0, idx).trim();
    const val = decl.slice(idx + 1).trim();
    if (!prop) return;
    const camel = prop.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
    out[camel] = val;
  });
  return out as React.CSSProperties;
}
