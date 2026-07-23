import { useEffect, useRef, useState } from 'react';

/* "חיבורים" — the Connections page, ported 1:1 from the Claude Design handoff
   (Connections.dc.html). Demo-mode banner + category sections of app cards,
   each with a connect/disconnect toggle that flips state and pops a bottom-center
   toast for 2.6s. The category catalog + toggle logic are lifted verbatim from
   the DCLogic. Colors are the design's literal values (they equal our tokens).
   The app tile glyphs are emoji BY DESIGN. */

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

const GLOBE_ALERT =
  '<path stroke-linecap="round" stroke-linejoin="round" d="M15.59 14.37a6 6 0 0 1-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 0 0 6.16-12.12A14.98 14.98 0 0 0 9.631 8.41m5.96 5.96a14.926 14.926 0 0 1-5.841 2.58m-.119-8.54a6 6 0 0 0-7.381 5.84h4.8"/>';
const CHECK =
  '<path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5"/>';

/* ---------- catalog (verbatim from the design's DCLogic._catalog) ---------- */
interface AppDef {
  slug: string;
  name: string;
  emoji: string;
  tint: string;
  note: string;
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
      { slug: 'whatsapp', name: 'WhatsApp Business', emoji: '💬', tint: 'rgba(18,128,92,.12)', note: 'שיחות ולידים', native: true, on: true },
      { slug: 'telegram', name: 'Telegram', emoji: '✈️', tint: 'rgba(14,116,144,.1)', note: 'הודעות בוט', native: false, on: false },
      { slug: 'messenger', name: 'Messenger', emoji: '💠', tint: 'rgba(22,102,168,.12)', note: 'הודעות פייסבוק', native: false, on: false },
    ],
  },
  {
    cat: 'רשתות חברתיות',
    apps: [
      { slug: 'instagram', name: 'Instagram', emoji: '📸', tint: 'rgba(124,108,240,.12)', note: 'פוסטים ותגובות', native: false, on: true },
      { slug: 'facebook', name: 'Facebook', emoji: '👍', tint: 'rgba(22,102,168,.12)', note: 'עמוד עסקי', native: false, on: false },
      { slug: 'tiktok', name: 'TikTok', emoji: '🎵', tint: 'rgba(15,23,42,.06)', note: 'סרטונים', native: false, on: false },
    ],
  },
  {
    cat: 'דוא״ל',
    apps: [
      { slug: 'gmail', name: 'Gmail', emoji: '✉️', tint: 'rgba(209,69,59,.09)', note: 'תיבת מייל', native: false, on: false },
      { slug: 'outlook', name: 'Outlook', emoji: '📧', tint: 'rgba(14,116,144,.1)', note: 'תיבת מייל', native: false, on: false },
    ],
  },
  {
    cat: 'חנות',
    apps: [
      { slug: 'woo', name: 'WooCommerce', emoji: '🛒', tint: 'rgba(124,108,240,.12)', note: 'הזמנות מהחנות', native: true, on: true },
      { slug: 'shopify', name: 'Shopify', emoji: '🛍️', tint: 'rgba(18,128,92,.12)', note: 'הזמנות מהחנות', native: true, on: false },
    ],
  },
  {
    cat: 'פיננסים',
    apps: [
      { slug: 'green', name: 'חשבונית ירוקה', emoji: '🧾', tint: 'rgba(18,128,92,.12)', note: 'חשבוניות וקבלות', native: true, on: true },
      { slug: 'grow', name: 'Grow · משולם', emoji: '💳', tint: 'rgba(14,139,160,.1)', note: 'סליקת אשראי', native: true, on: false },
      { slug: 'stripe', name: 'Stripe', emoji: '💰', tint: 'rgba(124,108,240,.12)', note: 'תשלומים', native: false, on: false },
    ],
  },
  {
    cat: 'פרודוקטיביות',
    apps: [
      { slug: 'gcal', name: 'Google Calendar', emoji: '📅', tint: 'rgba(22,102,168,.12)', note: 'תורים ופגישות', native: false, on: true },
      { slug: 'gdrive', name: 'Google Drive', emoji: '📁', tint: 'rgba(178,106,0,.1)', note: 'קבצים ומסמכים', native: false, on: false },
      { slug: 'slack', name: 'Slack', emoji: '#️⃣', tint: 'rgba(124,108,240,.12)', note: 'התראות לצוות', native: false, on: false },
    ],
  },
];

/* toggle button styles — verbatim from DCLogic.renderVals */
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

function initialState(): Record<string, boolean> {
  const o: Record<string, boolean> = {};
  CATALOG.forEach((g) => g.apps.forEach((a) => (o[a.slug] = a.on)));
  return o;
}

export default function ConnectionsDesign() {
  const [connected, setConnected] = useState<Record<string, boolean>>(initialState);
  const [toast, setToast] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => () => clearTimeout(timer.current), []);

  function toggle(app: AppDef) {
    setConnected((prev) => {
      const next = { ...prev, [app.slug]: !prev[app.slug] };
      setToast(next[app.slug] ? `${app.name} חובר בהצלחה` : `${app.name} נותק`);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setToast(''), 2600);
      return next;
    });
  }

  return (
    <div className="mx-auto max-w-[1080px]">
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
          חברו את החשבונות של העסק בלחיצה אחת — הסוכנים יתחילו לראות את הפעילות אוטומטית.
        </p>
      </div>

      {/* demo-mode warning banner */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 12,
          border: '1px solid rgba(178,106,0,.3)',
          background: 'rgba(178,106,0,.1)',
          borderRadius: 16,
          padding: '14px 16px',
          marginBottom: 26,
        }}
      >
        <span style={{ flex: 'none', marginTop: 1, lineHeight: 0 }}>
          <Ico inner={GLOBE_ALERT} size={18} color="#b26a00" />
        </span>
        <div style={{ fontSize: 13.5, color: '#0f172a', lineHeight: 1.55 }}>
          <b>מצב דמו.</b> החיבורים החיצוניים יעברו למצב חי ברגע שתאשרו הרשאה. החיבורים הישירים
          (וואטסאפ, חנות, חשבונית) עובדים מיד דרכנו.
        </div>
      </div>

      {/* category sections */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 30 }}>
        {CATALOG.map((g) => (
          <section key={g.cat}>
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
              {g.cat}
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {g.apps.map((app) => {
                const isOn = !!connected[app.slug];
                return (
                  <div
                    key={app.slug}
                    className="glass-card conn-card"
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
                      <div
                        style={{
                          fontSize: 12,
                          color: '#94a3b8',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {app.note}
                      </div>
                    </div>
                    <button onClick={() => toggle(app)} style={isOn ? BTN_ON : BTN_OFF}>
                      {isOn && <Ico inner={CHECK} size={13} />}
                      {isOn ? 'מחובר' : 'חיבור'}
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      {/* toast */}
      {toast && (
        <div
          role="alert"
          style={{
            position: 'fixed',
            bottom: 32,
            insetInlineStart: '50%',
            transform: 'translateX(50%)',
            zIndex: 50,
            border: '1px solid rgba(15,23,42,.08)',
            background: '#fff',
            borderRadius: 12,
            padding: '12px 20px',
            fontSize: 14,
            color: '#0f172a',
            boxShadow: '0 12px 32px rgba(15,23,42,.14)',
            animation: 'feed-in .4s cubic-bezier(.22,1,.36,1) both',
          }}
        >
          {toast}
        </div>
      )}

      {/* card hover lift */}
      <style>{`.conn-card{transition:box-shadow .18s ease, transform .18s ease;}.conn-card:hover{box-shadow:0 4px 12px rgba(15,23,42,.1);}`}</style>
    </div>
  );
}
