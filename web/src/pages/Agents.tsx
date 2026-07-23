import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Plus } from 'lucide-react';
import {
  AGENT_DEFS,
  AGENT_ORDER,
  approveReply,
  fallbackAck,
  leadAddedReply,
  quickActionsFor,
  rejectReply,
  seedThreads,
  userMessage,
  PLACEHOLDER,
  type AgentKey,
  type AgentMessage,
} from '../lib/agentsData';

/* "סוכנים" — the agent chat workspace, implemented from the Claude Design
   handoff (Agents.dc.html). Structure, copy, and message-type cards are
   ported 1:1; tint colors below are literal design values that already
   equal our existing tokens (see comments) — no new colors introduced. */

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

const WARNING_ICON = 'M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z';
const AUDIENCE_ICON =
  'M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z';
const TIMING_ICON =
  'M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5';

function MiniIcon({ d, className }: { d: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} width={14} height={14} className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d={d} />
    </svg>
  );
}

function AgentAvatar({ agentKey, size = 44 }: { agentKey: AgentKey; size?: number }) {
  const def = AGENT_DEFS[agentKey];
  return (
    <span
      className="relative flex shrink-0 items-center justify-center rounded-[13px] text-white"
      style={{ width: size, height: size, background: def.tint }}
    >
      <AgentGlyph agentKey={agentKey} size={Math.round(size * 0.5)} />
      <span
        className="absolute rounded-full border-2 border-surface bg-success"
        style={{ bottom: -2, insetInlineEnd: -2, width: size * 0.27, height: size * 0.27 }}
      />
    </span>
  );
}

function AgentListRow({ agentKey, selected, onSelect }: { agentKey: AgentKey; selected: boolean; onSelect: () => void }) {
  const def = AGENT_DEFS[agentKey];
  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex w-full items-center gap-3 border-b border-border/60 px-4 py-3.5 text-start transition-colors last:border-b-0 hover:bg-gold/5"
      style={selected ? { background: 'rgba(14,139,160,.08)', boxShadow: 'inset 3px 0 0 var(--color-gold)' } : undefined}
    >
      <AgentAvatar agentKey={agentKey} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-ink">{def.name}</div>
        <div className="truncate text-[11.5px] text-faint">{def.status}</div>
      </div>
    </button>
  );
}

/* ---- message bubbles by type ---- */

function TextBubble({ m }: { m: AgentMessage }) {
  const isUser = m.role === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[88%] whitespace-pre-line rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
          isUser
            ? 'rounded-ee-md bg-gold text-white'
            : 'rounded-es-md border border-border bg-surface text-ink shadow-card'
        }`}
      >
        {m.text}
      </div>
    </div>
  );
}

function ApprovalCard({ m, onApprove, onReject }: { m: AgentMessage; onApprove: () => void; onReject: () => void }) {
  return (
    <div className="flex justify-start">
      <div className="max-w-[94%] rounded-2xl rounded-es-md border border-warning/30 bg-warning-soft p-4">
        <div className="flex items-center gap-2 text-[13.5px] font-bold text-warning">
          <MiniIcon d={WARNING_ICON} className="h-4 w-4" />
          בקשת אישור
        </div>
        <p className="mt-2 text-[13.5px] leading-relaxed text-ink">{m.body}</p>
        <div className="mt-2.5 rounded-xl border border-border bg-surface px-3.5 py-2.5 text-[13px] leading-relaxed text-ink">
          {m.preview}
        </div>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={onApprove}
            className="cursor-pointer rounded-xl bg-gold px-4.5 py-2 text-[13.5px] font-semibold text-white transition-colors hover:bg-gold-hover"
          >
            אישור ושליחה
          </button>
          <button
            type="button"
            onClick={onReject}
            className="cursor-pointer rounded-xl border border-danger/30 bg-danger-soft px-4.5 py-2 text-[13.5px] font-semibold text-danger"
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
    <div className="flex justify-start">
      <div className="max-w-[94%] rounded-2xl rounded-es-md border p-4 shadow-card" style={{ borderColor: 'rgba(14,139,160,.25)' }}>
        <div className="flex items-center gap-2 text-[13.5px] font-bold text-gold-strong">
          <span className="h-2.5 w-2.5 rounded-full bg-success" />
          {m.title}
        </div>
        <div
          className="mt-2.5 rounded-lg bg-surface-raised px-3.5 py-2.5 text-[13.5px] leading-relaxed text-ink"
          style={{ borderInlineStart: '3px solid var(--color-success)' }}
        >
          {m.preview}
        </div>
        <div className="mt-2.5 flex items-center gap-3.5 text-xs text-muted">
          <span className="flex items-center gap-1">
            <MiniIcon d={AUDIENCE_ICON} />
            {m.audience}
          </span>
          <span className="flex items-center gap-1">
            <MiniIcon d={TIMING_ICON} />
            {m.timing}
          </span>
        </div>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={onApprove}
            className="cursor-pointer rounded-xl bg-gold px-4.5 py-2 text-[13.5px] font-semibold text-white transition-colors hover:bg-gold-hover"
          >
            שליחה עכשיו
          </button>
          <button
            type="button"
            onClick={onReject}
            className="cursor-pointer rounded-xl border border-border-strong bg-surface px-4.5 py-2 text-[13.5px] font-semibold text-ink"
          >
            עריכה
          </button>
        </div>
      </div>
    </div>
  );
}

function VideoCard({ m, onApprove, onReject }: { m: AgentMessage; onApprove: () => void; onReject: () => void }) {
  return (
    <div className="flex justify-start">
      <div className="max-w-[94%] rounded-2xl rounded-es-md border p-3.5 shadow-card" style={{ borderColor: 'rgba(124,108,240,.25)' }}>
        <div className="mb-2.5 flex items-center gap-2 text-[13.5px] font-bold" style={{ color: '#6b5cf0' }}>
          <span className="h-2.5 w-2.5 rounded-full bg-magenta-glow" />
          {m.title}
        </div>
        <div
          className="relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-xl"
          style={{ background: 'linear-gradient(135deg,#0e1a2b,#25406b)' }}
        >
          <span className="flex h-13 w-13 items-center justify-center rounded-full bg-white/92">
            <svg viewBox="0 0 24 24" fill="#0e1a2b" width="22" height="22" style={{ marginInlineStart: 3 }}>
              <path d="M8 5v14l11-7z" />
            </svg>
          </span>
          <span className="absolute bottom-2 rounded-md bg-ink/70 px-2 py-0.5 text-[11px] text-white" style={{ insetInlineEnd: 8 }}>
            {m.duration}
          </span>
        </div>
        <div className="mt-2 text-xs text-muted">{m.meta}</div>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={onApprove}
            className="cursor-pointer rounded-xl bg-gold px-4.5 py-2 text-[13.5px] font-semibold text-white transition-colors hover:bg-gold-hover"
          >
            אישור ופרסום
          </button>
          <button
            type="button"
            onClick={onReject}
            className="cursor-pointer rounded-xl border border-border-strong bg-surface px-4.5 py-2 text-[13.5px] font-semibold text-ink"
          >
            גרסה נוספת
          </button>
        </div>
      </div>
    </div>
  );
}

function LeadsCard({ m, onAdd }: { m: AgentMessage; onAdd: (name: string) => void }) {
  return (
    <div className="flex justify-start">
      <div className="max-w-[94%] rounded-2xl rounded-es-md border p-4 shadow-card" style={{ borderColor: 'rgba(14,139,160,.25)' }}>
        <div className="mb-3 flex items-center gap-2 text-[13.5px] font-bold text-gold-strong">
          <span className="h-2.5 w-2.5 rounded-full bg-gold" />
          {m.title}
        </div>
        <div className="flex flex-col gap-2.5">
          {m.leads?.map((ld) => (
            <div key={ld.name} className="flex items-center gap-3 rounded-xl border border-border px-3 py-2.5">
              <span
                className="flex h-8.5 w-8.5 shrink-0 items-center justify-center rounded-full text-sm"
                style={{ background: ld.tint }}
              >
                {ld.emoji}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13.5px] font-semibold text-ink">{ld.name}</div>
                <div className="truncate text-[11.5px] text-faint">{ld.note}</div>
              </div>
              <button
                type="button"
                onClick={() => onAdd(ld.name)}
                className="shrink-0 cursor-pointer rounded-lg border px-2.5 py-1.5 text-xs font-semibold text-gold-strong"
                style={{ borderColor: 'rgba(14,139,160,.3)', background: 'rgba(14,139,160,.08)' }}
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

export default function Agents() {
  const [active, setActive] = useState<AgentKey>('whatsapp');
  const [threads, setThreads] = useState(() => seedThreads());
  const [input, setInput] = useState('');
  const chatRef = useRef<HTMLDivElement>(null);
  const quickActions = quickActionsFor(active);
  const messages = threads[active];

  useEffect(() => {
    const t = setTimeout(() => chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: 'smooth' }), 60);
    return () => clearTimeout(t);
  }, [messages.length, active]);

  function append(key: AgentKey, msg: AgentMessage) {
    setThreads((prev) => ({ ...prev, [key]: [...prev[key], msg] }));
  }

  function runQuickAction(qa: ReturnType<typeof quickActionsFor>[number]) {
    append(active, userMessage(qa.label));
    setTimeout(() => append(active, qa.respond()), 380);
  }

  function onSend(e: React.FormEvent) {
    e.preventDefault();
    const q = input.trim();
    if (!q) return;
    setInput('');
    append(active, userMessage(q));
    setTimeout(() => append(active, fallbackAck()), 420);
  }

  return (
    <div className="mx-auto w-full max-w-[1240px]">
      <div className="mb-5">
        <h1 className="text-2xl font-semibold tracking-tight text-ink" style={{ fontFamily: "'Space Grotesk','Heebo',sans-serif" }}>
          הסוכנים שלך
        </h1>
        <p className="mt-1.5 text-sm text-muted">
          דברו עם הסוכנים, בקשו מהם ליצור קמפיינים, סרטונים ומחקרים — והם ישלחו לכם לאישור לפני שיוצאים לדרך.
        </p>
      </div>

      <div className="grid h-[660px] grid-cols-1 gap-4 lg:grid-cols-[300px_1fr]">
        {/* agent list */}
        <div className="glass-card flex flex-col overflow-hidden !p-0">
          <div className="border-b border-border px-4 py-3.5 text-[13px] font-semibold text-muted">סוכנים פעילים</div>
          <div className="scrollbar-hide flex-1 overflow-y-auto">
            {AGENT_ORDER.map((k) => (
              <AgentListRow key={k} agentKey={k} selected={k === active} onSelect={() => setActive(k)} />
            ))}
          </div>
          <div className="border-t border-border px-4 py-3.5">
            <button
              type="button"
              className="w-full cursor-pointer rounded-xl border border-dashed border-border-strong py-2.5 text-center text-[13px] font-semibold text-gold-strong"
            >
              + הוספת סוכן
            </button>
          </div>
        </div>

        {/* chat */}
        <div className="glass-card flex flex-col overflow-hidden !p-0">
          <div className="flex items-center gap-3 border-b border-border px-4.5 py-3.5">
            <AgentAvatar agentKey={active} size={42} />
            <div className="min-w-0 flex-1">
              <div className="text-[15px] font-semibold text-ink">{AGENT_DEFS[active].name}</div>
              <div className="text-xs text-muted">{AGENT_DEFS[active].cap}</div>
            </div>
            <span className="flex items-center gap-1.5 rounded-full border border-success/20 bg-success-soft px-2.5 py-1 text-[11.5px] font-semibold text-success">
              <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse-dot" />
              פעיל
            </span>
          </div>

          <div ref={chatRef} className="scrollbar-hide flex-1 space-y-3 overflow-y-auto p-5" style={{ background: '#f8fafc' }}>
            <AnimatePresence initial={false}>
              {messages.map((m) => (
                <motion.div
                  key={m.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                >
                  {m.type === 'text' && <TextBubble m={m} />}
                  {m.type === 'approval' && (
                    <ApprovalCard
                      m={m}
                      onApprove={() => append(active, approveReply('approval'))}
                      onReject={() => append(active, rejectReply('approval'))}
                    />
                  )}
                  {m.type === 'campaign' && (
                    <CampaignCard
                      m={m}
                      onApprove={() => append(active, approveReply('campaign'))}
                      onReject={() => append(active, rejectReply('campaign'))}
                    />
                  )}
                  {m.type === 'video' && (
                    <VideoCard
                      m={m}
                      onApprove={() => append(active, approveReply('video'))}
                      onReject={() => append(active, rejectReply('video'))}
                    />
                  )}
                  {m.type === 'leads' && <LeadsCard m={m} onAdd={(name) => append(active, leadAddedReply(name))} />}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {/* quick actions */}
          <div className="flex flex-wrap items-center gap-2 px-4 pt-3">
            {quickActions.map((qa) => (
              <button
                key={qa.label}
                type="button"
                onClick={() => runQuickAction(qa)}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-border-strong bg-surface px-3.5 py-1.5 text-[12.5px] font-semibold text-ink transition-colors hover:bg-surface-raised"
              >
                <Plus className="h-3 w-3 text-gold" />
                {qa.label}
              </button>
            ))}
          </div>

          {/* composer */}
          <form onSubmit={onSend} className="flex items-center gap-2 px-4 pb-3.5 pt-3">
            <div className="flex flex-1 items-center gap-2 rounded-2xl border border-border-strong bg-surface px-3 py-2.5">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={PLACEHOLDER[active]}
                className="flex-1 border-none bg-transparent text-sm text-ink outline-none placeholder:text-faint"
              />
              <button
                type="submit"
                aria-label="שליחה"
                className="flex cursor-pointer items-center justify-center rounded-lg bg-gold p-2 transition-colors hover:bg-gold-hover"
              >
                <Send className="h-3.5 w-3.5 text-white" />
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
