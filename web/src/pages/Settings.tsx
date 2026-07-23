import { useState } from 'react';

/* Settings / הגדרות — ported 1:1 from the Claude Design handoff
   (docs/claude-design/design_files/Settings.dc.html). Layout, copy, mock data,
   toggle switches, "saved" flag and the ₪349 plan card are verbatim from the
   design. Colors are the design's literal values (they equal our tokens).
   The app <Layout> provides the nav/chrome, so only the <main> content is
   rendered here. Mock data inline — wire to real APIs later. */

/* ---------- toggle switch (44×26 track, 20px knob, teal on / slate off) ---- */
function trackStyle(on: boolean): React.CSSProperties {
  return {
    cursor: 'pointer',
    flex: 'none',
    position: 'relative',
    width: 44,
    height: 26,
    borderRadius: 999,
    border: 'none',
    transition: 'background .18s ease',
    padding: 0,
    background: on ? '#0e8ba0' : '#cbd5e1',
  };
}

function knobStyle(on: boolean): React.CSSProperties {
  return {
    position: 'absolute',
    top: 3,
    insetInlineStart: on ? 3 : 21,
    width: 20,
    height: 20,
    borderRadius: 999,
    background: '#fff',
    boxShadow: '0 1px 2px rgba(15,23,42,.2)',
    transition: 'inset-inline-start .18s ease',
  };
}

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} role="switch" aria-checked={on} style={trackStyle(on)}>
      <span style={knobStyle(on)} />
    </button>
  );
}

/* ---------- shared field styles ---------- */
const inputStyle: React.CSSProperties = {
  width: '100%',
  border: '1px solid rgba(15,23,42,.16)',
  background: '#fff',
  borderRadius: 12,
  padding: '10px 13px',
  fontFamily: 'inherit',
  color: '#0f172a',
  outline: 'none',
  boxSizing: 'border-box',
};

const labelSpan: React.CSSProperties = {
  display: 'block',
  fontSize: 12.5,
  fontWeight: 600,
  color: '#55627a',
  marginBottom: 6,
};

function Field({ label, defaultValue, ltr }: { label: string; defaultValue: string; ltr?: boolean }) {
  const [focused, setFocused] = useState(false);
  return (
    <label style={{ display: 'block' }}>
      <span style={labelSpan}>{label}</span>
      <input
        dir={ltr ? 'ltr' : undefined}
        defaultValue={defaultValue}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className="text-[16px] sm:text-[14px]"
        style={{
          ...inputStyle,
          transition: 'border .15s ease, box-shadow .15s ease',
          borderColor: focused ? '#0e8ba0' : 'rgba(15,23,42,.16)',
          boxShadow: focused ? '0 0 0 3px rgba(14,139,160,.15)' : 'none',
        }}
      />
    </label>
  );
}

const sectionTitle: React.CSSProperties = { fontSize: 16, fontWeight: 600 };
const rowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 14,
  padding: '13px 0',
  borderBottom: '1px solid rgba(15,23,42,.06)',
};

/* ---------- mock data (verbatim from the design's DCLogic) ---------- */
interface AgentRow { key: string; emoji: string; name: string; desc: string; on: boolean }
interface NotifRow { key: string; name: string; desc: string; on: boolean }

const INITIAL_AGENTS: AgentRow[] = [
  { key: 'video', emoji: '🎬', name: 'סוכן וידאו', desc: 'יוצר סרטוני מוצר ופרסום', on: true },
  { key: 'wa', emoji: '💬', name: 'סוכן וואטסאפ', desc: 'שירות לקוחות 24/7', on: true },
  { key: 'ig', emoji: '📸', name: 'סוכן אינסטגרם', desc: 'פרסום תוכן ומענה', on: true },
  { key: 'leads', emoji: '🎯', name: 'סוכן לידים', desc: 'לכידה וסינון לידים', on: true },
  { key: 'content', emoji: '✍️', name: 'סוכן תוכן', desc: 'כתיבת פוסטים ומיילים', on: false },
  { key: 'reports', emoji: '📊', name: 'סוכן דוחות', desc: 'סיכומים שבועיים', on: false },
];

const INITIAL_NOTIFS: NotifRow[] = [
  { key: 'push', name: 'התראות פוש', desc: 'אירועים חשובים ישר למכשיר', on: true },
  { key: 'wa', name: 'סיכום יומי בוואטסאפ', desc: 'תמצית מה שקרה בעסק בכל בוקר', on: true },
  { key: 'email', name: 'דוח שבועי במייל', desc: 'ביצועים ותובנות אחת לשבוע', on: false },
  { key: 'approvals', name: 'התראות אישורים', desc: 'כשסוכן מבקש אישור לפעולה', on: true },
];

export default function Settings() {
  const [agents, setAgents] = useState<AgentRow[]>(INITIAL_AGENTS);
  const [notifs, setNotifs] = useState<NotifRow[]>(INITIAL_NOTIFS);
  const [saved, setSaved] = useState(false);

  const activeAgents = agents.filter((a) => a.on).length;
  const totalAgents = agents.length;

  function toggleAgent(i: number) {
    setAgents((arr) => arr.map((a, idx) => (idx === i ? { ...a, on: !a.on } : a)));
    setSaved(false);
  }
  function toggleNotif(i: number) {
    setNotifs((arr) => arr.map((n, idx) => (idx === i ? { ...n, on: !n.on } : n)));
    setSaved(false);
  }

  return (
    <main style={{ maxWidth: 920, margin: '0 auto' }}>
      <div style={{ marginBottom: 22 }}>
        <h1
          className="text-[21px] lg:text-[26px]"
          style={{
            margin: 0,
            fontWeight: 600,
            letterSpacing: '-.01em',
            fontFamily: "'Space Grotesk','Heebo',sans-serif",
          }}
        >
          הגדרות
        </h1>
        <p style={{ margin: '7px 0 0', fontSize: 14, color: '#55627a' }}>
          נהלו את הפרופיל, פרטי העסק, הסוכנים וההתראות — הכל במקום אחד.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16 }}>
        {/* profile */}
        <section className="glass-card p-4 sm:px-6 sm:py-[22px]">
          <div style={{ ...sectionTitle, marginBottom: 16 }}>פרופיל</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 18 }}>
            <span
              style={{
                width: 56,
                height: 56,
                borderRadius: 999,
                background: 'linear-gradient(135deg,#0e8ba0,#22b8cf)',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: 20,
              }}
            >
              י
            </span>
            <div>
              <button
                style={{
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  border: '1px solid rgba(15,23,42,.16)',
                  background: '#fff',
                  borderRadius: 10,
                  padding: '7px 14px',
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                החלפת תמונה
              </button>
              <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 6 }}>PNG או JPG · עד 2MB</div>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            <Field label="שם מלא" defaultValue="ישראל ישראלי" />
            <Field label="תפקיד" defaultValue="בעלים" />
            <Field label="אימייל" defaultValue="israel@easylife.co.il" ltr />
            <Field label="טלפון" defaultValue="050-123-4567" ltr />
          </div>
        </section>

        {/* business */}
        <section className="glass-card p-4 sm:px-6 sm:py-[22px]">
          <div style={{ ...sectionTitle, marginBottom: 16 }}>פרטי העסק</div>
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            <Field label="שם העסק" defaultValue="חיים קלים בע״מ" />
            <Field label="ח.פ / ע.מ" defaultValue="515123456" ltr />
            <Field label="תחום" defaultValue="שירותים עסקיים" />
            <Field label="מטבע" defaultValue="₪ שקל חדש (ILS)" />
          </div>
        </section>

        {/* agents */}
        <section className="glass-card p-4 sm:px-6 sm:py-[22px]">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <div style={sectionTitle}>הסוכנים שלך</div>
            <span style={{ fontSize: 12, color: '#94a3b8' }}>
              {activeAgents} פעילים מתוך {totalAgents}
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {agents.map((a, i) => (
              <div key={a.key} style={rowStyle}>
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
                    background: 'rgba(14,139,160,.1)',
                  }}
                >
                  {a.emoji}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14.5, fontWeight: 600 }}>{a.name}</div>
                  <div style={{ fontSize: 12.5, color: '#94a3b8' }}>{a.desc}</div>
                </div>
                <Toggle on={a.on} onClick={() => toggleAgent(i)} />
              </div>
            ))}
          </div>
        </section>

        {/* notifications */}
        <section className="glass-card p-4 sm:px-6 sm:py-[22px]">
          <div style={{ ...sectionTitle, marginBottom: 6 }}>התראות</div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {notifs.map((n, i) => (
              <div key={n.key} style={rowStyle}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14.5, fontWeight: 600 }}>{n.name}</div>
                  <div style={{ fontSize: 12.5, color: '#94a3b8' }}>{n.desc}</div>
                </div>
                <Toggle on={n.on} onClick={() => toggleNotif(i)} />
              </div>
            ))}
          </div>
        </section>

        {/* plan */}
        <section className="glass-card p-4 sm:px-6 sm:py-[22px]">
          <div style={{ ...sectionTitle, marginBottom: 16 }}>מנוי וחיוב</div>
          <div
            className="flex flex-col items-stretch gap-4 sm:flex-row sm:items-center"
            style={{
              border: '1px solid rgba(14,139,160,.25)',
              background: 'rgba(14,139,160,.06)',
              borderRadius: 16,
              padding: 18,
            }}
          >
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 17, fontWeight: 600 }}>חבילת עסקי</span>
                <span
                  style={{
                    borderRadius: 999,
                    background: '#0e8ba0',
                    color: '#fff',
                    padding: '2px 9px',
                    fontSize: 10.5,
                    fontWeight: 700,
                  }}
                >
                  פעיל
                </span>
              </div>
              <div style={{ fontSize: 13, color: '#55627a', marginTop: 4 }}>כל הסוכנים · פיד חי · עוזר AI מלא</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div
                className="tabular-nums"
                style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 26, fontWeight: 600 }}
              >
                ₪ 349
              </div>
              <div style={{ fontSize: 11.5, color: '#94a3b8' }}>לחודש · מתחדש 1.8</div>
            </div>
            <a
              href="/landing#pricing"
              className="text-center sm:text-start"
              style={{
                flex: 'none',
                border: '1px solid rgba(15,23,42,.16)',
                background: '#fff',
                borderRadius: 12,
                padding: '9px 16px',
                fontSize: 13.5,
                fontWeight: 600,
                color: '#0f172a',
              }}
            >
              שדרוג חבילה
            </a>
          </div>
        </section>

        <div className="flex flex-wrap justify-end" style={{ gap: 10, paddingTop: 4 }}>
          <button
            style={{
              cursor: 'pointer',
              fontFamily: 'inherit',
              border: '1px solid rgba(15,23,42,.16)',
              background: '#fff',
              borderRadius: 12,
              padding: '11px 20px',
              fontSize: 14,
              fontWeight: 600,
              color: '#0f172a',
            }}
          >
            ביטול
          </button>
          <button
            onClick={() => setSaved(true)}
            style={{
              cursor: 'pointer',
              fontFamily: 'inherit',
              border: 'none',
              borderRadius: 12,
              background: '#0e8ba0',
              color: '#fff',
              padding: '11px 22px',
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            {saved ? 'נשמר ✓' : 'שמירת שינויים'}
          </button>
        </div>
      </div>
    </main>
  );
}
