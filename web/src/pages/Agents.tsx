import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AGENT_DEFS,
  AGENT_ORDER,
  approveReply,
  DEFAULT_ENABLED,
  fallbackAck,
  HOURS_OPTIONS,
  leadAddedReply,
  PLACEHOLDER,
  quickActionsFor,
  rejectReply,
  seedConversations,
  seedSettings,
  TONE_OPTIONS,
  userMessage,
  type AgentKey,
  type AgentMessage,
  type AgentSettings,
  type Conversation,
  type RecurringTask,
} from '../lib/agentsData';

/* "הסוכנים שלך" — the agent chat workspace, ported 1:1 from the upgraded
   Claude Design handoff (docs/claude-design/v2/Agents.dc.html). Structure,
   copy, mock data, tint colors, sizes and interactions match the design.
   Tint colors are literal design hex values (they already equal our tokens:
   #0e8ba0=gold, #12805c=success, #7c6cf0=magenta-glow, #b26a00=warning).

   Responsive system: the r-split main grid (320px | 1fr) collapses to a
   single column with height:auto at ≤860px, and r-main padding drops to
   16px — replicated verbatim from the design's <style> media block. */

const AGENTS_CSS = `
@media (max-width:860px){ .r-split{grid-template-columns:1fr !important; height:auto !important;} .r-main{padding-inline:16px !important;} }
@media (max-width:600px){ .ag-head{ flex-wrap:wrap !important; } .ag-head-actions{ width:100% !important; order:3 !important; justify-content:flex-end !important; } }
.ag-row:hover { background:rgba(14,139,160,.05); }
.qa:hover { background:#eef2f7; }
@keyframes dash-drawer-in { from { transform:translateX(-100%); } to { transform:translateX(0); } }
@keyframes dash-fade { from { opacity:0; } to { opacity:1; } }
@keyframes td-blink { 0%,60%,100%{opacity:.25;} 30%{opacity:1;} }
.td b { display:inline-block; width:7px; height:7px; border-radius:999px; background:#94a3b8; margin:0 1.5px; animation:td-blink 1.2s infinite; }
.td b:nth-child(2){animation-delay:.2s;} .td b:nth-child(3){animation-delay:.4s;}
`;

const AGENT_ICON_PATHS: Record<AgentKey, string> = {
  whatsapp:
    'M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 0 1-.825-.242m9.345-8.334a2.126 2.126 0 0 0-.476-.095 48.64 48.64 0 0 0-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0 0 11.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155',
  video:
    'm15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h8.25a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25H4.5A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z',
  social:
    'M15.59 14.37a6 6 0 0 1-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 0 0 6.16-12.12A14.98 14.98 0 0 0 9.631 8.41m5.96 5.96a14.926 14.926 0 0 1-5.841 2.58m-.119-8.54a6 6 0 0 0-7.381 5.84h4.8',
  content:
    'm16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10',
};

function AgentGlyph({ agentKey, size = 22 }: { agentKey: AgentKey; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} width={size} height={size}>
      <path strokeLinecap="round" strokeLinejoin="round" d={AGENT_ICON_PATHS[agentKey]} />
    </svg>
  );
}

/* ---- message bubbles by type ---- */

function TypingBubble() {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
      <div
        className="td"
        style={{
          background: '#fff',
          border: '1px solid rgba(15,23,42,.08)',
          borderRadius: '16px 16px 16px 5px',
          padding: '12px 16px',
        }}
      >
        <b></b>
        <b></b>
        <b></b>
      </div>
    </div>
  );
}

function TextBubble({ m }: { m: AgentMessage }) {
  const isUser = m.role === 'user';
  return (
    <div style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start' }}>
      <div
        style={{
          maxWidth: '88%',
          whiteSpace: 'pre-line',
          fontSize: 14,
          lineHeight: 1.6,
          padding: '11px 14px',
          ...(isUser
            ? { alignSelf: 'flex-end', background: '#0e8ba0', color: '#fff', borderRadius: '16px 16px 5px 16px' }
            : {
                alignSelf: 'flex-start',
                background: '#fff',
                color: '#0f172a',
                border: '1px solid rgba(15,23,42,.08)',
                borderRadius: '16px 16px 16px 5px',
                boxShadow: '0 1px 2px rgba(15,23,42,.04)',
              }),
        }}
      >
        {m.text}
      </div>
    </div>
  );
}

const primaryBtn: React.CSSProperties = {
  cursor: 'pointer',
  fontFamily: 'inherit',
  border: 'none',
  borderRadius: 11,
  background: '#0e8ba0',
  color: '#fff',
  padding: '8px 18px',
  fontSize: 13.5,
  fontWeight: 600,
};
const ghostBtn: React.CSSProperties = {
  cursor: 'pointer',
  fontFamily: 'inherit',
  border: '1px solid rgba(15,23,42,.16)',
  borderRadius: 11,
  background: '#fff',
  color: '#0f172a',
  padding: '8px 18px',
  fontSize: 13.5,
  fontWeight: 600,
};

function ApprovalCard({ m, onApprove, onReject }: { m: AgentMessage; onApprove: () => void; onReject: () => void }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
      <div
        style={{
          maxWidth: '94%',
          border: '1px solid rgba(178,106,0,.28)',
          background: 'rgba(178,106,0,.06)',
          borderRadius: '16px 16px 16px 5px',
          padding: 15,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, fontWeight: 700, color: '#b26a00' }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} width={16} height={16}>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
            />
          </svg>
          בקשת אישור
        </div>
        <p style={{ margin: '8px 0 0', fontSize: 13.5, color: '#0f172a', lineHeight: 1.55 }}>{m.body}</p>
        <div
          style={{
            marginTop: 10,
            border: '1px solid rgba(15,23,42,.08)',
            background: '#fff',
            borderRadius: 12,
            padding: '11px 13px',
            fontSize: 13,
            color: '#0f172a',
            lineHeight: 1.55,
          }}
        >
          {m.preview}
        </div>
        <div style={{ marginTop: 12, display: 'flex', gap: 9 }}>
          <button type="button" onClick={onApprove} style={primaryBtn}>
            אישור ושליחה
          </button>
          <button
            type="button"
            onClick={onReject}
            style={{
              cursor: 'pointer',
              fontFamily: 'inherit',
              border: '1px solid rgba(209,69,59,.3)',
              borderRadius: 11,
              background: 'rgba(209,69,59,.09)',
              color: '#d1453b',
              padding: '8px 18px',
              fontSize: 13.5,
              fontWeight: 600,
            }}
          >
            דחייה
          </button>
        </div>
      </div>
    </div>
  );
}

function CampaignCard({ m, onApprove, onReject }: { m: AgentMessage; onApprove: () => void; onReject: () => void }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
      <div
        style={{
          maxWidth: '94%',
          border: '1px solid rgba(14,139,160,.25)',
          background: '#fff',
          borderRadius: '16px 16px 16px 5px',
          padding: 15,
          boxShadow: '0 1px 2px rgba(15,23,42,.04)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, fontWeight: 700, color: '#0b7688' }}>
          <span style={{ width: 9, height: 9, borderRadius: 999, background: '#12805c' }} />
          {m.title}
        </div>
        <div
          style={{
            marginTop: 10,
            borderInlineStart: '3px solid #12805c',
            background: '#f8fafc',
            borderRadius: 8,
            padding: '11px 13px',
            fontSize: 13.5,
            color: '#0f172a',
            lineHeight: 1.6,
          }}
        >
          {m.preview}
        </div>
        <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 14, fontSize: 12, color: '#55627a' }}>
          <span>👥 {m.audience}</span>
          <span>🕐 {m.timing}</span>
        </div>
        <div style={{ marginTop: 12, display: 'flex', gap: 9 }}>
          <button type="button" onClick={onApprove} style={primaryBtn}>
            שליחה עכשיו
          </button>
          <button type="button" onClick={onReject} style={ghostBtn}>
            עריכה
          </button>
        </div>
      </div>
    </div>
  );
}

function VideoCard({ m, onApprove, onReject }: { m: AgentMessage; onApprove: () => void; onReject: () => void }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
      <div
        style={{
          maxWidth: '94%',
          border: '1px solid rgba(124,108,240,.25)',
          background: '#fff',
          borderRadius: '16px 16px 16px 5px',
          padding: 14,
          boxShadow: '0 1px 2px rgba(15,23,42,.04)',
        }}
      >
        <div
          style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, fontWeight: 700, color: '#6b5cf0', marginBottom: 10 }}
        >
          <span style={{ width: 9, height: 9, borderRadius: 999, background: '#7c6cf0' }} />
          {m.title}
        </div>
        <div
          style={{
            position: 'relative',
            width: '100%',
            aspectRatio: '16/9',
            borderRadius: 12,
            overflow: 'hidden',
            background: 'linear-gradient(135deg,#0e1a2b,#25406b)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <span
            style={{
              width: 52,
              height: 52,
              borderRadius: 999,
              background: 'rgba(255,255,255,.92)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg viewBox="0 0 24 24" fill="#0e1a2b" width={22} height={22} style={{ marginInlineStart: 3 }}>
              <path d="M8 5v14l11-7z" />
            </svg>
          </span>
          <span
            style={{
              position: 'absolute',
              bottom: 8,
              insetInlineEnd: 8,
              background: 'rgba(15,23,42,.7)',
              color: '#fff',
              fontSize: 11,
              borderRadius: 6,
              padding: '2px 7px',
            }}
          >
            {m.duration}
          </span>
        </div>
        <div style={{ marginTop: 8, fontSize: 12, color: '#55627a' }}>{m.meta}</div>
        <div style={{ marginTop: 12, display: 'flex', gap: 9 }}>
          <button type="button" onClick={onApprove} style={primaryBtn}>
            אישור ופרסום
          </button>
          <button type="button" onClick={onReject} style={ghostBtn}>
            גרסה נוספת
          </button>
        </div>
      </div>
    </div>
  );
}

function LeadsCard({ m, onAdd }: { m: AgentMessage; onAdd: (name: string) => void }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
      <div
        style={{
          maxWidth: '94%',
          border: '1px solid rgba(14,139,160,.25)',
          background: '#fff',
          borderRadius: '16px 16px 16px 5px',
          padding: 15,
          boxShadow: '0 1px 2px rgba(15,23,42,.04)',
        }}
      >
        <div
          style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, fontWeight: 700, color: '#0b7688', marginBottom: 12 }}
        >
          <span style={{ width: 9, height: 9, borderRadius: 999, background: '#0e8ba0' }} />
          {m.title}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {m.leads?.map((ld) => (
            <div
              key={ld.name}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 11,
                border: '1px solid rgba(15,23,42,.08)',
                borderRadius: 11,
                padding: '10px 12px',
              }}
            >
              <span
                style={{
                  flex: 'none',
                  width: 34,
                  height: 34,
                  borderRadius: 999,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 14,
                  background: ld.tint,
                }}
              >
                {ld.emoji}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600 }}>{ld.name}</div>
                <div style={{ fontSize: 11.5, color: '#94a3b8' }}>{ld.note}</div>
              </div>
              <button
                type="button"
                onClick={() => onAdd(ld.name)}
                style={{
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  flex: 'none',
                  border: '1px solid rgba(14,139,160,.3)',
                  background: 'rgba(14,139,160,.08)',
                  color: '#0b7688',
                  borderRadius: 9,
                  padding: '6px 11px',
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                הוסף ל‑CRM
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---- toggle switch ---- */

function Switch({ on, onClick }: { on: boolean; onClick: (e: React.MouseEvent) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onClick}
      style={{
        cursor: 'pointer',
        flex: 'none',
        position: 'relative',
        width: 38,
        height: 22,
        borderRadius: 999,
        border: 'none',
        padding: 0,
        background: on ? '#0e8ba0' : '#cbd5e1',
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 3,
          insetInlineStart: on ? 3 : 19,
          width: 16,
          height: 16,
          borderRadius: 999,
          background: '#fff',
          boxShadow: '0 1px 2px rgba(15,23,42,.2)',
        }}
      />
    </button>
  );
}

/* ---- profile drawer ---- */

function TaskRow({ label, done }: { label: string; done: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 2px', fontSize: 13.5 }}>
      <span
        style={{
          flex: 'none',
          width: 19,
          height: 19,
          borderRadius: 6,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          ...(done
            ? { background: '#0e8ba0', border: '1px solid #0e8ba0' }
            : { background: '#fff', border: '1.5px solid rgba(15,23,42,.2)' }),
        }}
      >
        {done && (
          <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={3} width={11} height={11}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
          </svg>
        )}
      </span>
      <span style={done ? { color: '#94a3b8', textDecoration: 'line-through' } : { color: '#0f172a' }}>{label}</span>
    </div>
  );
}

const sectionLabel: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: '.08em',
  textTransform: 'uppercase',
  color: '#94a3b8',
  marginBottom: 10,
};

function ProfileDrawer({
  agentKey,
  enabled,
  settings,
  recurring,
  onClose,
  onToggleAgent,
  onTone,
  onHours,
  onAuto,
  onAddTask,
  onRemoveTask,
}: {
  agentKey: AgentKey;
  enabled: boolean;
  settings: AgentSettings;
  recurring: RecurringTask[];
  onClose: () => void;
  onToggleAgent: () => void;
  onTone: (v: string) => void;
  onHours: (v: string) => void;
  onAuto: () => void;
  onAddTask: (label: string) => void;
  onRemoveTask: (index: number) => void;
}) {
  const def = AGENT_DEFS[agentKey];
  const [taskInput, setTaskInput] = useState('');

  return createPortal(
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 60,
          background: 'rgba(15,23,42,.28)',
          animation: 'dash-fade .2s ease both',
        }}
      />
      <aside
        dir="rtl"
        style={{
          position: 'fixed',
          top: 0,
          insetInlineStart: 0,
          zIndex: 61,
          width: 'min(460px,94vw)',
          height: '100vh',
          background: '#fff',
          boxShadow: '0 12px 40px rgba(15,23,42,.2)',
          display: 'flex',
          flexDirection: 'column',
          animation: 'dash-drawer-in .28s cubic-bezier(.22,1,.36,1) both',
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
            <span
              style={{
                flex: 'none',
                width: 52,
                height: 52,
                borderRadius: 15,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                background: def.tint,
              }}
            >
              <AgentGlyph agentKey={agentKey} size={26} />
            </span>
            <div>
              <div style={{ fontSize: 18, fontWeight: 600 }}>{def.name}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                <span style={{ width: 8, height: 8, borderRadius: 999, background: enabled ? '#12805c' : '#cbd5e1' }} />
                <span style={{ fontSize: 12.5, color: enabled ? '#12805c' : '#94a3b8' }}>{enabled ? 'פעיל' : 'כבוי'}</span>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="סגור"
            style={{ cursor: 'pointer', border: 'none', background: 'none', color: '#94a3b8' }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} width={20} height={20}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="scrollbar-hide" style={{ flex: 1, overflowY: 'auto', padding: 22 }}>
          <p style={{ margin: '0 0 20px', fontSize: 14, color: '#55627a', lineHeight: 1.65 }}>{def.bio}</p>

          {/* stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 22 }}>
            {def.stats.map(([value, label]) => (
              <div
                key={label}
                style={{ border: '1px solid rgba(15,23,42,.08)', borderRadius: 12, padding: 12, textAlign: 'center' }}
              >
                <div
                  className="tabular-nums"
                  style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 20, fontWeight: 600, color: '#0f172a' }}
                >
                  {value}
                </div>
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{label}</div>
              </div>
            ))}
          </div>

          {/* capabilities */}
          <div style={sectionLabel}>יכולות</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 22 }}>
            {def.caps.map((c) => (
              <span
                key={c}
                style={{
                  border: '1px solid rgba(14,139,160,.25)',
                  background: 'rgba(14,139,160,.06)',
                  color: '#0b7688',
                  borderRadius: 999,
                  padding: '5px 11px',
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                {c}
              </span>
            ))}
          </div>

          {/* daily tasks */}
          <div style={sectionLabel}>משימות היום</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 18 }}>
            {def.daily.map((t) => (
              <TaskRow key={t.label} label={t.label} done={t.done} />
            ))}
          </div>

          {/* weekly tasks */}
          <div style={sectionLabel}>משימות השבוע</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 18 }}>
            {def.weekly.map((t) => (
              <TaskRow key={t.label} label={t.label} done={t.done} />
            ))}
          </div>

          {/* recurring tasks */}
          <div style={sectionLabel}>משימות קבועות</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
            {recurring.map((t, i) => (
              <div
                key={`${t.label}-${i}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  border: '1px solid rgba(15,23,42,.08)',
                  borderRadius: 11,
                  padding: '10px 12px',
                }}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#0e8ba0"
                  strokeWidth={1.6}
                  width={16}
                  height={16}
                  style={{ flex: 'none' }}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99"
                  />
                </svg>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{t.label}</div>
                  <div style={{ fontSize: 11.5, color: '#94a3b8' }}>{t.freq}</div>
                </div>
                <button
                  type="button"
                  onClick={() => onRemoveTask(i)}
                  aria-label="הסר"
                  style={{ cursor: 'pointer', border: 'none', background: 'none', color: '#94a3b8' }}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const v = taskInput.trim();
              if (!v) return;
              onAddTask(v);
              setTaskInput('');
            }}
            style={{ display: 'flex', gap: 8, marginBottom: 22 }}
          >
            <input
              value={taskInput}
              onChange={(e) => setTaskInput(e.target.value)}
              placeholder="הוסף משימה קבועה…"
              style={{
                flex: 1,
                border: '1px solid rgba(15,23,42,.16)',
                borderRadius: 10,
                padding: '9px 12px',
                fontFamily: 'inherit',
                fontSize: 13,
                outline: 'none',
              }}
            />
            <button
              type="submit"
              style={{
                cursor: 'pointer',
                fontFamily: 'inherit',
                border: 'none',
                borderRadius: 10,
                background: '#0e8ba0',
                color: '#fff',
                padding: '9px 14px',
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              הוסף
            </button>
          </form>

          {/* settings */}
          <div style={sectionLabel}>הגדרות</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <label style={{ display: 'block' }}>
              <span style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: '#55627a', marginBottom: 6 }}>
                טון הדיבור
              </span>
              <select
                value={settings.tone}
                onChange={(e) => onTone(e.target.value)}
                style={{
                  width: '100%',
                  border: '1px solid rgba(15,23,42,.16)',
                  borderRadius: 11,
                  padding: '10px 12px',
                  fontFamily: 'inherit',
                  fontSize: 14,
                  color: '#0f172a',
                  background: '#fff',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              >
                {TONE_OPTIONS.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ display: 'block' }}>
              <span style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: '#55627a', marginBottom: 6 }}>
                שעות פעילות
              </span>
              <select
                value={settings.hours}
                onChange={(e) => onHours(e.target.value)}
                style={{
                  width: '100%',
                  border: '1px solid rgba(15,23,42,.16)',
                  borderRadius: 11,
                  padding: '10px 12px',
                  fontFamily: 'inherit',
                  fontSize: 14,
                  color: '#0f172a',
                  background: '#fff',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              >
                {HOURS_OPTIONS.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </label>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                border: '1px solid rgba(15,23,42,.08)',
                borderRadius: 12,
                padding: '12px 14px',
              }}
            >
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 600 }}>מענה אוטומטי</div>
                <div style={{ fontSize: 12, color: '#94a3b8' }}>הסוכן עונה ללקוחות ללא אישור</div>
              </div>
              <Switch on={settings.auto} onClick={onAuto} />
            </div>
          </div>
        </div>

        <div style={{ borderTop: '1px solid rgba(15,23,42,.08)', padding: '16px 22px' }}>
          <button
            type="button"
            onClick={onToggleAgent}
            style={{
              cursor: 'pointer',
              fontFamily: 'inherit',
              width: '100%',
              borderRadius: 12,
              padding: 12,
              fontSize: 14,
              fontWeight: 600,
              ...(enabled
                ? { border: '1px solid rgba(209,69,59,.3)', background: 'rgba(209,69,59,.09)', color: '#d1453b' }
                : { border: 'none', background: '#0e8ba0', color: '#fff' }),
            }}
          >
            {enabled ? 'כיבוי הסוכן' : 'הפעלת הסוכן'}
          </button>
        </div>
      </aside>
    </>,
    document.body,
  );
}

/* ============ main page ============ */

export default function Agents() {
  const [active, setActive] = useState<AgentKey>('whatsapp');
  const [convs, setConvs] = useState<Record<AgentKey, Conversation[]>>(() => seedConversations());
  const [activeConv, setActiveConv] = useState<Partial<Record<AgentKey, string>>>({});
  const [enabled, setEnabled] = useState<Record<AgentKey, boolean>>({ ...DEFAULT_ENABLED });
  const [settings, setSettings] = useState<Record<AgentKey, AgentSettings>>(() => seedSettings());
  const [recurring, setRecurring] = useState<Record<AgentKey, RecurringTask[]>>(() => {
    const o = {} as Record<AgentKey, RecurringTask[]>;
    AGENT_ORDER.forEach((k) => (o[k] = AGENT_DEFS[k].recurring.map((r) => ({ ...r }))));
    return o;
  });
  const [profileOpen, setProfileOpen] = useState(false);
  const [input, setInput] = useState('');
  const [toast, setToast] = useState('');
  const [typing, setTyping] = useState<Record<string, boolean>>({});
  const chatRef = useRef<HTMLDivElement>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>();

  const def = AGENT_DEFS[active];
  const convList = convs[active];
  const activeConvId = activeConv[active] || convList[0].id;
  const conv = convList.find((c) => c.id === activeConvId) || convList[0];
  const messages = conv.msgs;
  const quickActions = quickActionsFor(active);
  const activeCount = AGENT_ORDER.filter((k) => enabled[k]).length;
  const isTyping = !!typing[active + activeConvId];

  useEffect(() => {
    const t = setTimeout(() => chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: 'smooth' }), 60);
    return () => clearTimeout(t);
  }, [messages.length, active, activeConvId, isTyping]);

  useEffect(() => () => clearTimeout(toastTimer.current), []);

  function showToast(m: string) {
    setToast(m);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 2400);
  }

  function append(key: AgentKey, convId: string, msg: AgentMessage) {
    setConvs((prev) => ({
      ...prev,
      [key]: prev[key].map((cv) => (cv.id === convId ? { ...cv, msgs: [...cv.msgs, msg] } : cv)),
    }));
  }

  function agentReply(key: AgentKey, convId: string, msg: AgentMessage) {
    const tk = key + convId;
    setTyping((s) => ({ ...s, [tk]: true }));
    setTimeout(() => {
      setTyping((s) => ({ ...s, [tk]: false }));
      append(key, convId, msg);
    }, 900);
  }

  function runQuickAction(qa: (typeof quickActions)[number]) {
    append(active, activeConvId, userMessage(qa.label));
    agentReply(active, activeConvId, qa.respond());
  }

  function onSend(e: React.FormEvent) {
    e.preventDefault();
    const q = input.trim();
    if (!q) return;
    setInput('');
    append(active, activeConvId, userMessage(q));
    agentReply(active, activeConvId, fallbackAck());
  }

  function toggleAgent(k: AgentKey) {
    const was = enabled[k];
    setEnabled((s) => ({ ...s, [k]: !was }));
    showToast(AGENT_DEFS[k].name + (was ? ' כובה' : ' הופעל'));
  }

  const enabledActive = enabled[active];
  const setActive_ = settings[active];

  return (
    <main className="r-main" style={{ maxWidth: 1240, margin: '0 auto' }}>
      <style dangerouslySetInnerHTML={{ __html: AGENTS_CSS }} />

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
          הסוכנים שלך
        </h1>
        <p style={{ margin: '7px 0 0', fontSize: 14, color: '#55627a' }}>
          דברו עם הסוכנים, נהלו את המשימות וההגדרות שלהם — והם ישלחו לכם לאישור לפני שיוצאים לדרך.
        </p>
      </div>

      <div className="r-split" style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 16, height: 680 }}>
        {/* agent list */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: 0 }}>
          <div
            style={{
              padding: '14px 16px',
              borderBottom: '1px solid rgba(15,23,42,.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 600, color: '#55627a' }}>הסוכנים שלך</span>
            <span style={{ fontSize: 11.5, color: '#94a3b8' }}>{activeCount} פעילים</span>
          </div>
          <div className="scrollbar-hide" style={{ flex: 1, overflowY: 'auto' }}>
            {AGENT_ORDER.map((k) => {
              const d = AGENT_DEFS[k];
              const sel = k === active;
              const on = enabled[k];
              return (
                <div
                  key={k}
                  className="ag-row"
                  onClick={() => setActive(k)}
                  style={{
                    display: 'flex',
                    gap: 12,
                    padding: '14px 16px',
                    cursor: 'pointer',
                    borderBottom: '1px solid rgba(15,23,42,.06)',
                    alignItems: 'center',
                    transition: 'background .15s ease',
                    ...(sel
                      ? { background: 'rgba(14,139,160,.08)', boxShadow: 'inset 3px 0 0 #0e8ba0' }
                      : { background: '#fff' }),
                  }}
                >
                  <span
                    style={{
                      position: 'relative',
                      flex: 'none',
                      width: 44,
                      height: 44,
                      borderRadius: 13,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fff',
                      background: d.tint,
                      opacity: on ? 1 : 0.5,
                    }}
                  >
                    <AgentGlyph agentKey={k} size={22} />
                    {on && (
                      <span
                        style={{
                          position: 'absolute',
                          bottom: -2,
                          insetInlineEnd: -2,
                          width: 12,
                          height: 12,
                          borderRadius: 999,
                          border: '2px solid #fff',
                          background: '#12805c',
                        }}
                      />
                    )}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 600,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {d.name}
                    </div>
                    <div
                      style={{
                        fontSize: 11.5,
                        color: '#94a3b8',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {on ? d.cap : 'כבוי'}
                    </div>
                  </div>
                  <Switch
                    on={on}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleAgent(k);
                    }}
                  />
                </div>
              );
            })}
          </div>
          <div style={{ padding: '14px 16px', borderTop: '1px solid rgba(15,23,42,.08)' }}>
            <button
              type="button"
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'center',
                fontSize: 13,
                fontWeight: 600,
                color: '#0b7688',
                border: '1px dashed rgba(15,23,42,.16)',
                borderRadius: 12,
                padding: 10,
                background: 'none',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              + הוספת סוכן
            </button>
          </div>
        </div>

        {/* chat */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: 0 }}>
          <div
            className="ag-head"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              borderBottom: '1px solid rgba(15,23,42,.08)',
              padding: '13px 18px',
            }}
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
                color: '#fff',
                background: def.tint,
              }}
            >
              <AgentGlyph agentKey={active} size={22} />
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{def.name}</div>
              <div style={{ fontSize: 12, color: '#55627a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{def.cap}</div>
            </div>
            <div className="ag-head-actions" style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 'none' }}>
              <select
                value={activeConvId}
                onChange={(e) => setActiveConv((s) => ({ ...s, [active]: e.target.value }))}
                title="היסטוריית שיחות"
                style={{
                  border: '1px solid rgba(15,23,42,.14)',
                  background: '#fff',
                  borderRadius: 10,
                  padding: '7px 10px',
                  fontFamily: 'inherit',
                  fontSize: 12.5,
                  color: '#0f172a',
                  outline: 'none',
                  maxWidth: 150,
                }}
              >
                {convList.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.title}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setProfileOpen(true)}
                style={{
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  border: '1px solid rgba(15,23,42,.14)',
                  background: '#fff',
                  borderRadius: 10,
                  padding: '7px 11px',
                  fontSize: 12.5,
                  fontWeight: 600,
                  color: '#0f172a',
                  flex: 'none',
                }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} width={14} height={14}>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M17.982 18.725A7.488 7.488 0 0 0 12 15.75a7.488 7.488 0 0 0-5.982 2.975m11.963 0a9 9 0 1 0-11.963 0m11.963 0A8.966 8.966 0 0 1 12 21a8.966 8.966 0 0 1-5.982-2.275M15 9.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
                  />
                </svg>
                פרופיל
              </button>
            </div>
          </div>

          <div
            ref={chatRef}
            className="scrollbar-hide"
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '22px 20px',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              background: '#f8fafc',
            }}
          >
            {messages.map((m) => {
              if (m.type === 'text') return <TextBubble key={m.id} m={m} />;
              if (m.type === 'approval')
                return (
                  <ApprovalCard
                    key={m.id}
                    m={m}
                    onApprove={() => agentReply(active, activeConvId, approveReply('approval'))}
                    onReject={() => agentReply(active, activeConvId, rejectReply('approval'))}
                  />
                );
              if (m.type === 'campaign')
                return (
                  <CampaignCard
                    key={m.id}
                    m={m}
                    onApprove={() => agentReply(active, activeConvId, approveReply('campaign'))}
                    onReject={() => agentReply(active, activeConvId, rejectReply('campaign'))}
                  />
                );
              if (m.type === 'video')
                return (
                  <VideoCard
                    key={m.id}
                    m={m}
                    onApprove={() => agentReply(active, activeConvId, approveReply('video'))}
                    onReject={() => agentReply(active, activeConvId, rejectReply('video'))}
                  />
                );
              if (m.type === 'leads')
                return (
                  <LeadsCard
                    key={m.id}
                    m={m}
                    onAdd={(name) => agentReply(active, activeConvId, leadAddedReply(name))}
                  />
                );
              return null;
            })}
            {isTyping && <TypingBubble />}
          </div>

          {/* quick actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '12px 16px 0' }}>
            {quickActions.map((qa) => (
              <button
                key={qa.label}
                type="button"
                className="qa"
                onClick={() => runQuickAction(qa)}
                style={{
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  border: '1px solid rgba(15,23,42,.14)',
                  background: '#fff',
                  borderRadius: 999,
                  padding: '7px 13px',
                  fontSize: 12.5,
                  fontWeight: 600,
                  color: '#0f172a',
                  transition: 'background .15s ease',
                }}
              >
                <span style={{ color: '#0e8ba0' }}>+</span>
                {qa.label}
              </button>
            ))}
          </div>

          {/* composer */}
          <div style={{ padding: '12px 16px 14px' }}>
            <form
              onSubmit={onSend}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                border: '1px solid rgba(15,23,42,.16)',
                background: '#fff',
                borderRadius: 14,
                padding: '9px 12px',
              }}
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={PLACEHOLDER[active]}
                style={{
                  flex: 1,
                  border: 'none',
                  background: 'transparent',
                  outline: 'none',
                  fontFamily: 'inherit',
                  fontSize: 14,
                  color: '#0f172a',
                }}
              />
              <button
                type="submit"
                aria-label="שליחה"
                style={{ border: 'none', borderRadius: 10, background: '#0e8ba0', padding: 9, cursor: 'pointer', display: 'flex' }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={1.8} width={15} height={15}>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5"
                  />
                </svg>
              </button>
            </form>
          </div>
        </div>
      </div>

      {profileOpen && (
        <ProfileDrawer
          agentKey={active}
          enabled={enabledActive}
          settings={setActive_}
          recurring={recurring[active]}
          onClose={() => setProfileOpen(false)}
          onToggleAgent={() => toggleAgent(active)}
          onTone={(v) => setSettings((s) => ({ ...s, [active]: { ...s[active], tone: v } }))}
          onHours={(v) => setSettings((s) => ({ ...s, [active]: { ...s[active], hours: v } }))}
          onAuto={() => setSettings((s) => ({ ...s, [active]: { ...s[active], auto: !s[active].auto } }))}
          onAddTask={(label) => {
            setRecurring((s) => ({ ...s, [active]: [...s[active], { label, freq: 'מותאם אישית' }] }));
            showToast('משימה קבועה נוספה');
          }}
          onRemoveTask={(index) =>
            setRecurring((s) => ({ ...s, [active]: s[active].filter((_, j) => j !== index) }))
          }
        />
      )}

      {toast &&
        createPortal(
          <div
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
              animation: 'dash-fade .25s ease both',
            }}
          >
            {toast}
          </div>,
          document.body,
        )}
    </main>
  );
}
