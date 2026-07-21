import { motion } from 'framer-motion';
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Send, Sparkles } from 'lucide-react';
import { ceoAsk, ceoBrief } from '@/lib/ceo';

interface Msg {
  role: 'user' | 'assistant';
  text: string;
}

export function AIChat() {
  const briefQ = useQuery({ queryKey: ['ceo-brief'], queryFn: ceoBrief });
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Seed the conversation with the executive brief once it loads.
  useEffect(() => {
    if (!briefQ.data || msgs.length) return;
    const b = briefQ.data;
    const focus = b.focus_now.length ? '\n\nלמיקוד עכשיו:\n' + b.focus_now.map((f) => `• ${f}`).join('\n') : '';
    setMsgs([{ role: 'assistant', text: b.headline + focus }]);
  }, [briefQ.data, msgs.length]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [msgs, busy]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const q = input.trim();
    if (!q || busy) return;
    setInput('');
    setMsgs((m) => [...m, { role: 'user', text: q }]);
    setBusy(true);
    try {
      const { answer } = await ceoAsk(q);
      setMsgs((m) => [...m, { role: 'assistant', text: answer }]);
    } catch {
      setMsgs((m) => [...m, { role: 'assistant', text: 'לא הצלחתי לענות כרגע — ודאו שהשרת פועל ונסו שוב.' }]);
    } finally {
      setBusy(false);
    }
  }

  const isLlm = briefQ.data?.source === 'llm';

  return (
    <div className="flex h-full flex-col p-5">
      <div className="flex items-center gap-3">
        <div className="relative h-9 w-9 rounded-xl bg-gradient-to-br from-[#0e8ba0] to-[#22b8cf] p-[1.5px]">
          <div className="flex h-full w-full items-center justify-center rounded-[10px] bg-surface">
            <Sparkles className="h-4 w-4 text-gold-strong" />
          </div>
          <span className="absolute inset-0 -z-10 rounded-xl bg-gradient-to-br from-[#0e8ba0]/40 to-[#22b8cf]/30 blur-md animate-pulse-ring" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-ink" style={{ fontFamily: "'Space Grotesk',sans-serif" }}>
            שיחה עם המוח
          </div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-gold-strong/70">
            {isLlm ? 'CEO · AI' : 'CEO · תובנות חיות'}
          </div>
        </div>
        <span className="flex shrink-0 items-center gap-1 rounded-full border border-border bg-surface-raised px-2 py-0.5 text-[10px] text-muted">
          <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse-ring" />
          פעיל
        </span>
      </div>

      <div ref={scrollRef} className="mt-4 flex-1 space-y-3 overflow-y-auto scrollbar-hide pe-1">
        {briefQ.isLoading && <Bubble role="assistant">קורא את מצב העסק…</Bubble>}
        {msgs.map((m, i) => (
          <Bubble key={i} role={m.role}>
            {m.text.split('\n').map((line, j) => (
              <div key={j}>{line || ' '}</div>
            ))}
          </Bubble>
        ))}
        {busy && (
          <Bubble role="assistant">
            <span className="inline-flex gap-1">
              חושב
              <span className="animate-caret">…</span>
            </span>
          </Bubble>
        )}
      </div>

      <form onSubmit={submit} className="mt-3 flex items-center gap-2 rounded-2xl border border-border bg-surface-raised px-3 py-2.5 focus-within:border-gold/50">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="שאלו את המוח — «על מה להתמקד היום?»"
          className="flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-faint"
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          aria-label="שליחה"
          className="rounded-lg bg-gradient-to-br from-[#0e8ba0] to-[#22b8cf] p-1.5 text-white transition disabled:opacity-40"
        >
          <Send className="h-3.5 w-3.5" />
        </button>
      </form>
    </div>
  );
}

function Bubble({ role, children }: { role: 'user' | 'assistant'; children: ReactNode }) {
  const isUser = role === 'user';
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed text-ink ${
        isUser ? 'ms-auto border border-border bg-surface-raised' : 'me-auto border border-border-strong bg-gold-soft'
      }`}
      style={
        !isUser
          ? { boxShadow: '0 0 30px -10px rgba(14,139,160,0.22), inset 0 1px 0 rgba(255,255,255,0.6)' }
          : undefined
      }
    >
      {children}
    </motion.div>
  );
}
