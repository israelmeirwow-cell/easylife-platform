import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { Send, Sparkles } from 'lucide-react';

const SCRIPT = [
  'בודק את מצב הצינור והפעילות האחרונה…',
  'יש 3 עסקאות שלא זזו בשבוע האחרון — אולי כדאי לשלוח תזכורת ללקוחות?',
  'זיהיתי עלייה בפניות חדשות בוואטסאפ מאז אתמול. רוצה שאסכם אותן?',
];

export function AIChat() {
  const [typed, setTyped] = useState('');
  const [line, setLine] = useState(0);

  useEffect(() => {
    const full = SCRIPT[line];
    if (typed.length < full.length) {
      const t = setTimeout(() => setTyped(full.slice(0, typed.length + 1)), 22);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => {
      setTyped('');
      setLine((l) => (l + 1) % SCRIPT.length);
    }, 2600);
    return () => clearTimeout(t);
  }, [typed, line]);

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
          <div className="text-[10px] uppercase tracking-[0.2em] text-gold-strong/70">תצוגה מקדימה</div>
        </div>
        <span className="shrink-0 rounded-full border border-border bg-surface-raised px-2 py-0.5 text-[10px] text-faint">
          בקרוב
        </span>
      </div>

      <div className="mt-4 flex-1 space-y-3 overflow-hidden">
        <Bubble role="user">איפה כדאי לי להתמקד הבוקר?</Bubble>
        <Bubble role="assistant">
          {typed}
          <span className="ms-0.5 inline-block h-3 w-[2px] translate-y-0.5 bg-gold animate-caret" />
        </Bubble>
      </div>

      <div className="mt-3 flex items-center gap-2 rounded-2xl border border-border bg-surface-raised px-3 py-2.5 opacity-60">
        <input
          disabled
          placeholder="צ'אט עם המוח — בקרוב…"
          className="flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-faint"
        />
        <button disabled className="rounded-lg bg-gradient-to-br from-[#0e8ba0] to-[#22b8cf] p-1.5 text-white">
          <Send className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

function Bubble({ role, children }: { role: 'user' | 'assistant'; children: React.ReactNode }) {
  const isUser = role === 'user';
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm text-ink ${
        isUser ? 'me-auto border border-border bg-surface-raised' : 'border border-border-strong bg-gold-soft'
      }`}
      style={
        !isUser
          ? { boxShadow: '0 0 30px -10px rgba(14,139,160,0.25), inset 0 1px 0 rgba(255,255,255,0.6)' }
          : undefined
      }
    >
      {children}
    </motion.div>
  );
}
