import { useEffect, useRef, useState } from 'react';

/* "חיבורים" — the Connections page, ported 1:1 from the NEW Claude Design handoff
   (v2/Connections.dc.html). Summary cards + search/status filters + category
   sections of app cards, each with a connect/disconnect toggle. Opening a card
   slides in a detail DRAWER (sync stats, permission switches, activity log);
   connecting an app runs a 3-step connect WIZARD modal (permissions → syncing →
   success). All toggles pop a bottom-center toast. Catalog, sync data, permission
   defs, wizard/drawer logic are lifted verbatim from the DCLogic. Colors are the
   design's literal values (they equal our tokens). App tile glyphs are emoji BY
   DESIGN. The app <Layout> renders the nav/chrome, so we render only the page root.
   The r-* responsive system (r-main / r-3) is injected verbatim via a <style> tag. */

/* ---------- inline heroicons (exact paths from the design) ---------- */
function Ico({ inner, size = 16, color }: { inner: string; size?: number; color?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke={color ?? 'currentColor'}
      strokeWidth={1.7}
      width={size}
      height={size}
      dangerouslySetInnerHTML={{ __html: inner }}
    />
  );
}

const CHECK = '<path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5"/>';
const LINK_ICON =
  '<path stroke-linecap="round" stroke-linejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244"/>';
const BOLT_ICON =
  '<path stroke-linecap="round" stroke-linejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z"/>';
const SYNC_ICON =
  '<path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99"/>';
const SEARCH_ICON =
  '<path stroke-linecap="round" stroke-linejoin="round" d="m21 21-4.34-4.34M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z"/>';
const CLOSE_ICON =
  '<path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12"/>';

/* ---------- catalog (verbatim from the design's DCLogic._catalog) ---------- */
interface AppDef {
  slug: string;
  name: string;
  emoji: string;
  tint: string;
  native: boolean;
  on: boolean;
}
interface CategoryDef {
  cat: string;
  apps: AppDef[];
}

const CATALOG: CategoryDef[] = [
  {
    cat: 'הודעות',
    apps: [
      { slug: 'whatsapp', name: 'WhatsApp Business', emoji: '💬', tint: 'rgba(18,128,92,.12)', native: true, on: true },
      { slug: 'telegram', name: 'Telegram', emoji: '✈️', tint: 'rgba(14,116,144,.1)', native: false, on: false },
      { slug: 'messenger', name: 'Messenger', emoji: '💠', tint: 'rgba(22,102,168,.12)', native: false, on: false },
    ],
  },
  {
    cat: 'רשתות חברתיות',
    apps: [
      { slug: 'instagram', name: 'Instagram', emoji: '📸', tint: 'rgba(124,108,240,.12)', native: false, on: true },
      { slug: 'facebook', name: 'Facebook', emoji: '👍', tint: 'rgba(22,102,168,.12)', native: false, on: false },
      { slug: 'tiktok', name: 'TikTok', emoji: '🎵', tint: 'rgba(15,23,42,.06)', native: false, on: false },
    ],
  },
  {
    cat: 'דוא״ל',
    apps: [
      { slug: 'gmail', name: 'Gmail', emoji: '✉️', tint: 'rgba(209,69,59,.09)', native: false, on: false },
      { slug: 'outlook', name: 'Outlook', emoji: '📧', tint: 'rgba(14,116,144,.1)', native: false, on: false },
    ],
  },
  {
    cat: 'חנות',
    apps: [
      { slug: 'woo', name: 'WooCommerce', emoji: '🛒', tint: 'rgba(124,108,240,.12)', native: true, on: true },
      { slug: 'shopify', name: 'Shopify', emoji: '🛍️', tint: 'rgba(18,128,92,.12)', native: true, on: false },
    ],
  },
  {
    cat: 'פיננסים',
    apps: [
      { slug: 'green', name: 'חשבונית ירוקה', emoji: '🧾', tint: 'rgba(18,128,92,.12)', native: true, on: true },
      { slug: 'grow', name: 'Grow · משולם', emoji: '💳', tint: 'rgba(14,139,160,.1)', native: true, on: false },
      { slug: 'stripe', name: 'Stripe', emoji: '💰', tint: 'rgba(124,108,240,.12)', native: false, on: false },
    ],
  },
  {
    cat: 'פרודוקטיביות',
    apps: [
      { slug: 'gcal', name: 'Google Calendar', emoji: '📅', tint: 'rgba(22,102,168,.12)', native: false, on: true },
      { slug: 'gdrive', name: 'Google Drive', emoji: '📁', tint: 'rgba(178,106,0,.1)', native: false, on: false },
      { slug: 'slack', name: 'Slack', emoji: '#️⃣', tint: 'rgba(124,108,240,.12)', native: false, on: false },
    ],
  },
];

const ALL_APPS: Record<string, AppDef> = (() => {
  const a: Record<string, AppDef> = {};
  CATALOG.forEach((g) => g.apps.forEach((x) => (a[x.slug] = x)));
  return a;
})();

/* ---------- sync data (verbatim from DCLogic._syncData) ---------- */
interface SyncData {
  synced: string;
  items: string;
  stats: [string, string][];
  log: [string, string, string][];
}
const SYNC: Record<string, SyncData> = {
  whatsapp: {
    synced: 'לפני 2 דק׳',
    items: '142 שיחות',
    stats: [['שיחות היום', '142'], ['לידים', '12']],
    log: [
      ['💬', 'נענו 38 הודעות אוטומטית', 'לפני 2 דק׳'],
      ['🎯', 'לידים הועברו ל‑CRM', 'לפני 20 דק׳'],
      ['📅', 'נקבע תור ללקוח', 'לפני שעה'],
    ],
  },
  instagram: {
    synced: 'לפני 8 דק׳',
    items: '3 פוסטים',
    stats: [['תגובות', '24'], ['הודעות', '9']],
    log: [
      ['📸', 'פורסם פוסט מתוזמן', 'לפני 8 דק׳'],
      ['💬', 'נענתה תגובה', 'לפני 30 דק׳'],
    ],
  },
  woo: {
    synced: 'לפני 5 דק׳',
    items: '8 הזמנות',
    stats: [['הזמנות היום', '8'], ['הכנסה', '₪4.2K']],
    log: [
      ['🛒', 'הזמנה #1043 נקלטה', 'לפני 5 דק׳'],
      ['💰', 'תשלום סונכרן לתזרים', 'לפני 12 דק׳'],
    ],
  },
  green: {
    synced: 'לפני 15 דק׳',
    items: '6 חשבוניות',
    stats: [['חשבוניות', '6'], ['סכום', '₪8.1K']],
    log: [
      ['🧾', 'חשבונית הופקה אוטומטית', 'לפני 15 דק׳'],
      ['💰', 'קבלה נשלחה ללקוח', 'לפני שעה'],
    ],
  },
  gcal: {
    synced: 'לפני 3 דק׳',
    items: '5 אירועים',
    stats: [['פגישות', '5'], ['תזכורות', '11']],
    log: [
      ['📅', 'נקבעה פגישה', 'לפני 3 דק׳'],
      ['🔔', 'נשלחה תזכורת', 'לפני 40 דק׳'],
    ],
  },
};

/* ---------- permission defs (verbatim from DCLogic._permDefs) ---------- */
const PERM_DEFS: [string, string, string][] = [
  ['read', 'קריאת נתונים', 'הסוכן רואה שיחות, הזמנות ופעילות'],
  ['write', 'כתיבה ופעולות', 'הסוכן יכול לשלוח, לעדכן וליצור'],
  ['auto', 'מענה אוטומטי', 'הסוכן עונה ללקוחות ללא אישור'],
];

type PermSet = Record<string, boolean>;

/* ---------- style constants (verbatim from DCLogic.renderVals) ---------- */
const DOT_ON: React.CSSProperties = {
  width: 7,
  height: 7,
  borderRadius: 999,
  background: '#12805c',
  boxShadow: '0 0 6px rgba(18,128,92,.5)',
};
const DOT_OFF: React.CSSProperties = { width: 7, height: 7, borderRadius: 999, background: '#cbd5e1' };
const BTN_ON: React.CSSProperties = {
  cursor: 'pointer',
  fontFamily: 'inherit',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  flex: 'none',
  borderRadius: 10,
  border: '1px solid rgba(18,128,92,.3)',
  background: 'rgba(18,128,92,.1)',
  color: '#12805c',
  padding: '7px 11px',
  fontSize: 12,
  fontWeight: 600,
};
const BTN_OFF: React.CSSProperties = {
  cursor: 'pointer',
  fontFamily: 'inherit',
  flex: 'none',
  border: 'none',
  borderRadius: 10,
  background: 'linear-gradient(135deg,#0e8ba0,#22b8cf)',
  color: '#fff',
  padding: '7px 14px',
  fontSize: 12,
  fontWeight: 600,
};

function switchStyles(on: boolean): { track: React.CSSProperties; knob: React.CSSProperties } {
  return {
    track: {
      flex: 'none',
      position: 'relative',
      width: 40,
      height: 23,
      borderRadius: 999,
      background: on ? '#0e8ba0' : '#cbd5e1',
    },
    knob: {
      position: 'absolute',
      top: 3,
      insetInlineStart: on ? 3 : 20,
      width: 17,
      height: 17,
      borderRadius: 999,
      background: '#fff',
      boxShadow: '0 1px 2px rgba(15,23,42,.2)',
    },
  };
}

/* ---------- initial state builders ---------- */
function initConnected(): Record<string, boolean> {
  const o: Record<string, boolean> = {};
  CATALOG.forEach((g) => g.apps.forEach((a) => (o[a.slug] = a.on)));
  return o;
}
function initPerms(): Record<string, PermSet> {
  const o: Record<string, PermSet> = {};
  CATALOG.forEach((g) =>
    g.apps.forEach((a) => (o[a.slug] = { read: a.on, write: a.on, auto: a.on && a.native })),
  );
  return o;
}

type StatusFilter = 'all' | 'connected' | 'available';

export default function ConnectionsDesign() {
  const [connected, setConnected] = useState<Record<string, boolean>>(initConnected);
  const [perms, setPerms] = useState<Record<string, PermSet>>(initPerms);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [drawerSlug, setDrawerSlug] = useState<string | null>(null);

  // wizard state
  const [wizSlug, setWizSlug] = useState<string | null>(null);
  const [wizStep, setWizStep] = useState(0);
  const [wizPerms, setWizPerms] = useState<PermSet>({ read: true, write: true, auto: false });

  const [toast, setToast] = useState('');
  const toastTimer = useRef<ReturnType<typeof setTimeout>>();
  const wizTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(
    () => () => {
      clearTimeout(toastTimer.current);
      clearTimeout(wizTimer.current);
    },
    [],
  );

  function popToast(m: string) {
    setToast(m);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 2400);
  }

  function disconnect(slug: string) {
    setConnected((prev) => ({ ...prev, [slug]: false }));
    popToast(`${ALL_APPS[slug].name} נותק`);
  }

  function togglePerm(slug: string, k: string) {
    setPerms((prev) => ({ ...prev, [slug]: { ...(prev[slug] || {}), [k]: !(prev[slug] && prev[slug][k]) } }));
  }

  /* ----- wizard flow ----- */
  function wizStart(slug: string) {
    const app = ALL_APPS[slug];
    setWizSlug(slug);
    setWizStep(0);
    setWizPerms({ read: true, write: true, auto: app.native });
  }
  function wizClose() {
    setWizSlug(null);
    setWizStep(0);
    clearTimeout(wizTimer.current);
  }
  function wizNext() {
    if (wizStep !== 0 || !wizSlug) return;
    const slug = wizSlug;
    setWizStep(1);
    wizTimer.current = setTimeout(() => {
      setConnected((prev) => ({ ...prev, [slug]: true }));
      setPerms((prev) => ({ ...prev, [slug]: { ...wizPerms } }));
      setWizStep(2);
    }, 1800);
  }

  const totalConnected = Object.values(connected).filter(Boolean).length;

  const summary = [
    {
      label: 'חיבורים פעילים',
      value: String(totalConnected),
      color: '#12805c',
      tint: 'rgba(18,128,92,.1)',
      icon: LINK_ICON,
    },
    { label: 'פעילות היום', value: '164', color: '#0e8ba0', tint: 'rgba(14,139,160,.1)', icon: BOLT_ICON },
    { label: 'סנכרון אחרון', value: 'עכשיו', color: '#b26a00', tint: 'rgba(178,106,0,.1)', icon: SYNC_ICON },
  ];

  const q = search.trim();

  const statusFilterDefs: { key: StatusFilter; label: string }[] = [
    { key: 'all', label: 'הכל' },
    { key: 'connected', label: 'מחוברים' },
    { key: 'available', label: 'זמינים' },
  ];
  const filterBtnStyle = (on: boolean): React.CSSProperties => ({
    cursor: 'pointer',
    fontFamily: 'inherit',
    border: 'none',
    borderRadius: 8,
    padding: '6px 12px',
    fontSize: 12.5,
    fontWeight: 600,
    ...(on ? { background: '#0e8ba0', color: '#fff' } : { background: '#f1f5f9', color: '#55627a' }),
  });

  // filtered groups
  const groups = CATALOG.map((g) => {
    const apps = g.apps.filter((a) => {
      const on = !!connected[a.slug];
      if (statusFilter === 'connected' && !on) return false;
      if (statusFilter === 'available' && on) return false;
      if (q && !a.name.includes(q)) return false;
      return true;
    });
    return { label: g.cat, apps };
  }).filter((g) => g.apps.length > 0);

  // detail drawer derived
  const drawerApp = drawerSlug ? ALL_APPS[drawerSlug] : null;
  const drawerOn = drawerSlug ? !!connected[drawerSlug] : false;
  const drawerSync = drawerSlug ? SYNC[drawerSlug] : undefined;
  const drawerLog: [string, string, string][] = drawerSync?.log || [['🔌', 'החיבור נוצר', 'היום']];
  const drawerStats: [string, string][] = drawerSync?.stats || [
    ['—', '—'],
    ['—', '—'],
  ];

  // wizard derived
  const wizApp = wizSlug ? ALL_APPS[wizSlug] : null;
  const barColor = (i: number) => (i <= wizStep ? '#0e8ba0' : 'rgba(15,23,42,.1)');

  return (
    <div className="r-main" style={{ maxWidth: 1080, marginInline: 'auto' }}>
      {/* r-* responsive system — injected verbatim from the design */}
      <style
        dangerouslySetInnerHTML={{
          __html:
            '@media (max-width:960px){ .r-main{padding-inline:18px !important;} .r-3{grid-template-columns:1fr !important;} }' +
            '@media (max-width:760px){ .r-main{padding-inline:14px !important;} }' +
            '.conn-card{transition:box-shadow .18s ease, transform .18s ease; cursor:pointer;}' +
            '.conn-card:hover{box-shadow:0 4px 12px rgba(15,23,42,.1); transform:translateY(-2px);}' +
            '@keyframes cn-drawer-in{from{transform:translateX(-100%);}to{transform:translateX(0);}}' +
            '@keyframes cn-fade{from{opacity:0;}to{opacity:1;}}' +
            '@keyframes cn-spin{to{transform:rotate(360deg);}}' +
            '.cn-spin{animation:cn-spin .9s linear infinite;}',
        }}
      />

      {/* heading */}
      <div style={{ marginBottom: 20 }}>
        <h1
          style={{
            margin: 0,
            fontSize: 26,
            fontWeight: 600,
            letterSpacing: '-.01em',
            fontFamily: "'Space Grotesk','Heebo',sans-serif",
          }}
        >
          חיבורים
        </h1>
        <p style={{ margin: '7px 0 0', fontSize: 14, color: '#55627a' }}>
          חברו את החשבונות של העסק — הסוכנים יתחילו לראות את הפעילות ולפעול אוטומטית.
        </p>
      </div>

      {/* summary cards */}
      <div
        className="r-3"
        style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 22 }}
      >
        {summary.map((s) => (
          <div
            key={s.label}
            className="glass-card"
            style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 13 }}
          >
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
              <Ico inner={s.icon} size={20} />
            </span>
            <div>
              <div style={{ fontSize: 12, color: '#55627a' }}>{s.label}</div>
              <div
                className="tabular-nums"
                style={{ fontSize: 24, fontWeight: 600, letterSpacing: '-.01em', marginTop: 2 }}
              >
                {s.value}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* toolbar: search + status filters */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 22 }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 180 }}>
          <span
            style={{
              pointerEvents: 'none',
              position: 'absolute',
              insetInlineStart: 11,
              top: '50%',
              transform: 'translateY(-50%)',
              color: '#94a3b8',
            }}
          >
            <Ico inner={SEARCH_ICON} size={15} />
          </span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="חיפוש חיבור…"
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
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          {statusFilterDefs.map((f) => (
            <button key={f.key} onClick={() => setStatusFilter(f.key)} style={filterBtnStyle(statusFilter === f.key)}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* category sections */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 30 }}>
        {groups.map((g) => (
          <section key={g.label}>
            <h2
              style={{
                margin: '0 0 12px',
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: '.08em',
                textTransform: 'uppercase',
                color: '#94a3b8',
              }}
            >
              {g.label}
            </h2>
            <div className="r-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
              {g.apps.map((app) => {
                const isOn = !!connected[app.slug];
                const sd = SYNC[app.slug];
                const statusText = isOn ? (sd ? `סונכרן ${sd.synced}` : 'מחובר') : 'לא מחובר';
                return (
                  <div
                    key={app.slug}
                    className="glass-card conn-card"
                    onClick={() => setDrawerSlug(app.slug)}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 15 }}
                  >
                    <span
                      style={{
                        flex: 'none',
                        width: 44,
                        height: 44,
                        borderRadius: 12,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 20,
                        background: app.tint,
                      }}
                    >
                      {app.emoji}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span
                          style={{
                            fontWeight: 600,
                            fontSize: 14,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {app.name}
                        </span>
                        {app.native && (
                          <span
                            style={{
                              flex: 'none',
                              borderRadius: 999,
                              background: 'rgba(14,139,160,.1)',
                              color: '#0b7688',
                              padding: '1px 6px',
                              fontSize: 9,
                              fontWeight: 700,
                            }}
                          >
                            ישיר
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                        <span style={isOn ? DOT_ON : DOT_OFF} />
                        <span
                          style={{
                            fontSize: 12,
                            color: isOn ? '#12805c' : '#94a3b8',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {statusText}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (isOn) disconnect(app.slug);
                        else wizStart(app.slug);
                      }}
                      style={isOn ? BTN_ON : BTN_OFF}
                    >
                      {isOn && <Ico inner={CHECK} size={13} color="currentColor" />}
                      {isOn ? 'מחובר' : 'חיבור'}
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      {/* ---------- CONNECT WIZARD ---------- */}
      {wizApp && (
        <div
          onClick={wizClose}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 70,
            background: 'rgba(15,23,42,.4)',
            animation: 'cn-fade .2s ease both',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            dir="rtl"
            style={{
              width: 'min(440px,100%)',
              background: '#fff',
              borderRadius: 20,
              boxShadow: '0 24px 60px rgba(15,23,42,.28)',
              overflow: 'hidden',
              animation: 'cn-fade .2s ease both',
            }}
          >
            {/* header */}
            <div
              style={{
                padding: '18px 22px',
                borderBottom: '1px solid rgba(15,23,42,.08)',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <span
                style={{
                  flex: 'none',
                  width: 38,
                  height: 38,
                  borderRadius: 11,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 18,
                  background: wizApp.tint,
                }}
              >
                {wizApp.emoji}
              </span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 600 }}>חיבור {wizApp.name}</div>
                <div style={{ fontSize: 12, color: '#94a3b8' }}>שלב {wizStep + 1} מתוך 3</div>
              </div>
              <button
                onClick={wizClose}
                aria-label="סגור"
                style={{ cursor: 'pointer', border: 'none', background: 'none', color: '#94a3b8' }}
              >
                <Ico inner={CLOSE_ICON} size={20} color="currentColor" />
              </button>
            </div>
            {/* progress bars */}
            <div style={{ display: 'flex', gap: 6, padding: '14px 22px 0' }}>
              {[0, 1, 2].map((i) => (
                <span key={i} style={{ flex: 1, height: 4, borderRadius: 999, background: barColor(i) }} />
              ))}
            </div>
            <div style={{ padding: 22 }}>
              {/* step 1 — permissions */}
              {wizStep === 0 && (
                <>
                  <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>אילו הרשאות לתת?</div>
                  <p style={{ margin: '0 0 16px', fontSize: 13, color: '#55627a', lineHeight: 1.5 }}>
                    בחרו מה הסוכן יורשה לעשות דרך {wizApp.name}. אפשר לשנות בכל רגע.
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {PERM_DEFS.map(([k, label, desc]) => {
                      const sw = switchStyles(!!wizPerms[k]);
                      return (
                        <button
                          key={k}
                          onClick={() => setWizPerms((prev) => ({ ...prev, [k]: !prev[k] }))}
                          style={{
                            cursor: 'pointer',
                            fontFamily: 'inherit',
                            textAlign: 'start',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 12,
                            border: '1px solid rgba(15,23,42,.1)',
                            borderRadius: 12,
                            padding: '12px 14px',
                            background: '#fff',
                          }}
                        >
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 13.5, fontWeight: 600 }}>{label}</div>
                            <div style={{ fontSize: 12, color: '#94a3b8' }}>{desc}</div>
                          </div>
                          <span style={sw.track}>
                            <span style={sw.knob} />
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
              {/* step 2 — syncing */}
              {wizStep === 1 && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '26px 0' }}>
                  <span
                    className="cn-spin"
                    style={{
                      width: 52,
                      height: 52,
                      borderRadius: 999,
                      border: '4px solid rgba(14,139,160,.2)',
                      borderTopColor: '#0e8ba0',
                      display: 'block',
                    }}
                  />
                  <div style={{ fontSize: 15, fontWeight: 600, marginTop: 18 }}>מסנכרן את {wizApp.name}…</div>
                  <div style={{ fontSize: 13, color: '#55627a', marginTop: 6 }}>
                    מושך נתונים אחרונים ומחבר לסוכנים…
                  </div>
                </div>
              )}
              {/* step 3 — success */}
              {wizStep === 2 && (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    padding: '22px 0',
                    textAlign: 'center',
                  }}
                >
                  <span
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: 999,
                      background: 'rgba(18,128,92,.12)',
                      color: '#12805c',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Ico inner={CHECK} size={30} color="currentColor" />
                  </span>
                  <div style={{ fontSize: 16, fontWeight: 600, marginTop: 14 }}>{wizApp.name} מחובר!</div>
                  <p style={{ margin: '8px 0 0', fontSize: 13, color: '#55627a', lineHeight: 1.55, maxWidth: '26em' }}>
                    הסוכנים יתחילו לראות את הפעילות מיד. אפשר לנהל הרשאות מכרטיס החיבור בכל רגע.
                  </p>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 10, padding: '0 22px 22px' }}>
              {wizStep === 0 && (
                <button
                  onClick={wizNext}
                  style={{
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    flex: 1,
                    border: 'none',
                    borderRadius: 12,
                    background: '#0e8ba0',
                    color: '#fff',
                    padding: 12,
                    fontSize: 14,
                    fontWeight: 600,
                  }}
                >
                  אישור וחיבור
                </button>
              )}
              {wizStep === 2 && (
                <button
                  onClick={wizClose}
                  style={{
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    flex: 1,
                    border: 'none',
                    borderRadius: 12,
                    background: '#0e8ba0',
                    color: '#fff',
                    padding: 12,
                    fontSize: 14,
                    fontWeight: 600,
                  }}
                >
                  סיום
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ---------- DETAIL DRAWER ---------- */}
      {drawerApp && (
        <>
          <div
            onClick={() => setDrawerSlug(null)}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 60,
              background: 'rgba(15,23,42,.28)',
              animation: 'cn-fade .2s ease both',
            }}
          />
          <aside
            dir="rtl"
            style={{
              position: 'fixed',
              top: 0,
              insetInlineStart: 0,
              zIndex: 61,
              width: 'min(440px,94vw)',
              height: '100vh',
              background: '#fff',
              boxShadow: '0 12px 40px rgba(15,23,42,.2)',
              display: 'flex',
              flexDirection: 'column',
              animation: 'cn-drawer-in .28s cubic-bezier(.22,1,.36,1) both',
            }}
          >
            <div
              style={{
                padding: 22,
                borderBottom: '1px solid rgba(15,23,42,.08)',
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: 12,
              }}
            >
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
                    fontSize: 22,
                    background: drawerApp.tint,
                  }}
                >
                  {drawerApp.emoji}
                </span>
                <div>
                  <div style={{ fontSize: 17, fontWeight: 600 }}>{drawerApp.name}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                    <span style={drawerOn ? DOT_ON : DOT_OFF} />
                    <span style={{ fontSize: 12.5, color: drawerOn ? '#12805c' : '#94a3b8' }}>
                      {drawerOn ? (drawerSync ? `סונכרן ${drawerSync.synced}` : 'מחובר') : 'לא מחובר'}
                    </span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setDrawerSlug(null)}
                aria-label="סגור"
                style={{ cursor: 'pointer', border: 'none', background: 'none', color: '#94a3b8' }}
              >
                <Ico inner={CLOSE_ICON} size={20} color="currentColor" />
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: 22 }} className="scrollbar-hide">
              {drawerOn ? (
                <>
                  {/* sync stats */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 22 }}>
                    {drawerStats.map(([label, value], i) => (
                      <div key={i} style={{ border: '1px solid rgba(15,23,42,.08)', borderRadius: 12, padding: 12 }}>
                        <div style={{ fontSize: 11, color: '#94a3b8' }}>{label}</div>
                        <div className="tabular-nums" style={{ fontSize: 18, fontWeight: 600, marginTop: 3 }}>
                          {value}
                        </div>
                      </div>
                    ))}
                  </div>
                  {/* permissions */}
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: '.08em',
                      textTransform: 'uppercase',
                      color: '#94a3b8',
                      marginBottom: 10,
                    }}
                  >
                    הרשאות
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 22 }}>
                    {PERM_DEFS.map(([k, label, desc]) => {
                      const sw = switchStyles(!!(perms[drawerApp.slug] && perms[drawerApp.slug][k]));
                      return (
                        <button
                          key={k}
                          onClick={() => togglePerm(drawerApp.slug, k)}
                          style={{
                            cursor: 'pointer',
                            fontFamily: 'inherit',
                            textAlign: 'start',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 12,
                            border: '1px solid rgba(15,23,42,.08)',
                            borderRadius: 12,
                            padding: '11px 13px',
                            background: '#fff',
                          }}
                        >
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 13.5, fontWeight: 600 }}>{label}</div>
                            <div style={{ fontSize: 12, color: '#94a3b8' }}>{desc}</div>
                          </div>
                          <span style={sw.track}>
                            <span style={sw.knob} />
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  {/* activity log */}
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: '.08em',
                      textTransform: 'uppercase',
                      color: '#94a3b8',
                      marginBottom: 10,
                    }}
                  >
                    לוג פעילות
                  </div>
                  <ol style={{ listStyle: 'none', margin: '0 0 22px', padding: 0, display: 'flex', flexDirection: 'column' }}>
                    {drawerLog.map((l, i) => (
                      <li key={i} style={{ display: 'flex', gap: 11 }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                          <span
                            style={{
                              flex: 'none',
                              width: 26,
                              height: 26,
                              borderRadius: 999,
                              background: '#f1f5f9',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: 12,
                            }}
                          >
                            {l[0]}
                          </span>
                          {i < drawerLog.length - 1 && (
                            <span style={{ flex: 1, width: 2, background: 'rgba(15,23,42,.08)', minHeight: 12 }} />
                          )}
                        </div>
                        <div style={{ paddingBottom: 14 }}>
                          <div style={{ fontSize: 13, color: '#0f172a' }}>{l[1]}</div>
                          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{l[2]}</div>
                        </div>
                      </li>
                    ))}
                  </ol>
                </>
              ) : (
                <div style={{ textAlign: 'center', padding: '20px 0' }}>
                  <p style={{ fontSize: 14, color: '#55627a', lineHeight: 1.6 }}>
                    {drawerApp.name} עדיין לא מחובר. חברו אותו כדי שהסוכנים יראו את הפעילות.
                  </p>
                </div>
              )}
            </div>

            <div style={{ borderTop: '1px solid rgba(15,23,42,.08)', padding: '16px 22px' }}>
              {drawerOn ? (
                <button
                  onClick={() => {
                    disconnect(drawerApp.slug);
                    setDrawerSlug(null);
                  }}
                  style={{
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    width: '100%',
                    border: '1px solid rgba(209,69,59,.3)',
                    borderRadius: 12,
                    background: 'rgba(209,69,59,.09)',
                    color: '#d1453b',
                    padding: 11,
                    fontSize: 14,
                    fontWeight: 600,
                  }}
                >
                  ניתוק החיבור
                </button>
              ) : (
                <button
                  onClick={() => {
                    const slug = drawerApp.slug;
                    setDrawerSlug(null);
                    wizStart(slug);
                  }}
                  style={{
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    width: '100%',
                    border: 'none',
                    borderRadius: 12,
                    background: '#0e8ba0',
                    color: '#fff',
                    padding: 12,
                    fontSize: 14,
                    fontWeight: 600,
                  }}
                >
                  חיבור עכשיו
                </button>
              )}
            </div>
          </aside>
        </>
      )}

      {/* toast */}
      {toast && (
        <div
          role="alert"
          style={{
            position: 'fixed',
            bottom: 28,
            insetInlineStart: '50%',
            transform: 'translateX(50%)',
            zIndex: 80,
            background: '#0f172a',
            color: '#fff',
            borderRadius: 12,
            padding: '12px 20px',
            fontSize: 14,
            boxShadow: '0 12px 32px rgba(15,23,42,.28)',
            animation: 'cn-fade .25s ease both',
          }}
        >
          {toast}
        </div>
      )}
    </div>
  );
}
