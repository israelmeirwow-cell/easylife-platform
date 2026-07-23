import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useReducedMotion } from 'framer-motion';

/* Dashboard / סקירה — ported 1:1 from the Claude Design handoff
   (design_handoff_easy_life_crm/design_files/Dashboard.dc.html). Layout, copy,
   mock data, tint colors, the 3D pipeline board, count-up and feed-in are all
   verbatim from the design. Colors are the design's literal values (they equal
   our tokens). Mock data matches the .dc.html — wire to real APIs later. */

/* ---------- inline heroicons (exact paths from the design) ---------- */
function Ico({ inner, size = 16, className }: { inner: string; size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      width={size}
      height={size}
      className={className}
      dangerouslySetInnerHTML={{ __html: inner }}
    />
  );
}

const P = {
  sparkles:
    '<path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z"/>',
  send:
    '<path stroke-linecap="round" stroke-linejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5"/>',
  kpiTrend:
    '<path stroke-linecap="round" stroke-linejoin="round" d="M2.25 18 9 11.25l4.306 4.307a11.95 11.95 0 0 1 5.814-5.518l2.74-1.22m0 0-5.94-2.28m5.94 2.28-2.28 5.941"/>',
  kpiBanknotes:
    '<path stroke-linecap="round" stroke-linejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 0 1 3 3h-15a3 3 0 0 1 3-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 0 1-.982-3.172M9.497 14.25a7.454 7.454 0 0 0 .981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 0 0 7.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 0 0 2.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 0 1 2.916.52 6.003 6.003 0 0 1-5.395 4.972m0 0a6.726 6.726 0 0 1-2.749 1.35m0 0a6.772 6.772 0 0 1-3.044 0"/>',
  kpiLeads:
    '<path stroke-linecap="round" stroke-linejoin="round" d="M15.75 5.25a3 3 0 0 1 3 3m3 0a6 6 0 0 1-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1 1 21.75 8.25Z"/>',
  kpiRate:
    '<path stroke-linecap="round" stroke-linejoin="round" d="M9 14.25l6-6m4.5-3.493V21a.75.75 0 0 1-.75.75H5.25A.75.75 0 0 1 4.5 21V4.757c0-.414.336-.75.75-.75h13.5a.75.75 0 0 1 .75.75ZM8.25 9a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5Zm7.5 6a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5Z"/>',
  whatsapp:
    '<path stroke-linecap="round" stroke-linejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 0 1-.825-.242m9.345-8.334a2.126 2.126 0 0 0-.476-.095 48.64 48.64 0 0 0-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0 0 11.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155"/>',
  instagram:
    '<path stroke-linecap="round" stroke-linejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z"/><path stroke-linecap="round" stroke-linejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0Z"/>',
  email:
    '<path stroke-linecap="round" stroke-linejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75"/>',
  store:
    '<path stroke-linecap="round" stroke-linejoin="round" d="M15.75 10.5V6a3.75 3.75 0 1 0-7.5 0v4.5m11.356-1.993 1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 0 1-1.12-1.243l1.264-12A1.125 1.125 0 0 1 5.513 7.5h12.974c.576 0 1.059.435 1.119 1.007Z"/>',
};

/* ---------- mock data (verbatim from the design's DCLogic) ---------- */
const KPIS = [
  { label: 'שווי צינור מכירות', prefix: '₪ ', value: 342000, suffix: '', icon: P.kpiTrend },
  { label: 'נסגר החודש', prefix: '₪ ', value: 128000, suffix: '', icon: P.kpiBanknotes },
  { label: 'עסקאות פתוחות', prefix: '', value: 47, suffix: '', icon: P.kpiLeads },
  { label: 'אחוז סגירה', prefix: '', value: 34, suffix: '%', icon: P.kpiRate },
];

const av = (t: string) => `linear-gradient(135deg, ${t}, #22b8cf)`;
const glowOf = (t: string) => `inset 0 1px 0 rgba(255,255,255,.7), 0 10px 30px -18px ${t}66`;

const STAGES = [
  {
    label: 'ליד', tint: '#0e8ba0', depth: '0px', count: 14,
    deals: [
      { account: 'סטודיו מיכל', title: 'שדרוג אתר תדמית', value: '₪ 18K', owner: 'עד', avatarBg: av('#0e8ba0') },
      { account: 'מוסך דהן', title: 'קמפיין לידים', value: '₪ 9K', owner: 'רכ', avatarBg: av('#0e8ba0') },
    ],
  },
  {
    label: 'מוכשר', tint: '#1666a8', depth: '8px', count: 11,
    deals: [
      { account: 'קליניקת נועה', title: 'חבילת סוכנים שנתית', value: '₪ 42K', owner: 'נל', avatarBg: av('#1666a8') },
      { account: 'בית קפה עלית', title: 'ניהול סושיאל', value: '₪ 12K', owner: 'עד', avatarBg: av('#1666a8') },
    ],
  },
  {
    label: 'הצעה', tint: '#b26a00', depth: '16px', count: 8,
    deals: [{ account: 'רשת אופנה', title: 'אוטומציית וואטסאפ', value: '₪ 64K', owner: 'רכ', avatarBg: av('#b26a00') }],
  },
  {
    label: 'משא ומתן', tint: '#0f172a', depth: '24px', count: 6,
    deals: [
      { account: 'חברת שיפוצים', title: 'חבילת פרו + API', value: '₪ 84K', owner: 'עד', avatarBg: av('#334155') },
      { account: 'סוכנות נדל״ן', title: 'סוכן לידים + דוחות', value: '₪ 38K', owner: 'נל', avatarBg: av('#334155') },
    ],
  },
];

const FEED = [
  { icon: '🏆', label: 'עסקה נסגרה בזכייה', time: 'לפני 4 דק׳', text: 'חברת שיפוצים · חבילת פרו — ₪84,000' },
  { icon: '💬', label: 'הודעה נכנסת', time: 'לפני 11 דק׳', text: 'סוכן וואטסאפ ענה ללקוח על שעות פעילות' },
  { icon: '🎯', label: 'ליד חדש', time: 'לפני 23 דק׳', text: 'ליד מאינסטגרם — מעוניין בחבילת וידאו' },
  { icon: '💰', label: 'תשלום התקבל', time: 'לפני 38 דק׳', text: 'קליניקת נועה — מנוי חודשי ₪349' },
  { icon: '🧠', label: 'זיכרון נשמר', time: 'לפני 52 דק׳', text: 'המוח למד: הרשת מעדיפה פגישות בימי ג׳' },
  { icon: '📄', label: 'עסקה נוצרה', time: 'לפני שעה', text: 'רשת אופנה · אוטומציית וואטסאפ — ₪64K' },
];

const CONNECTIONS = [
  { icon: P.whatsapp, iconColor: '#12805c', name: 'WhatsApp Business', meta: 'סוכן פעיל · 142 שיחות היום', tint: 'rgba(18,128,92,.1)' },
  { icon: P.instagram, iconColor: '#7c6cf0', name: 'Instagram', meta: 'סוכן פעיל · מתזמן 3 פוסטים', tint: 'rgba(124,108,240,.12)' },
  { icon: P.email, iconColor: '#0e7490', name: 'Email', meta: 'סוכן תוכן · 2 טיוטות', tint: 'rgba(14,139,160,.1)' },
  { icon: P.store, iconColor: '#b26a00', name: 'החנות שלך', meta: 'סנכרון הזמנות בזמן אמת', tint: 'rgba(178,106,0,.1)' },
];

const OK_PILL: React.CSSProperties = {
  border: '1px solid rgba(18,128,92,.2)', background: 'rgba(18,128,92,.1)', color: '#12805c',
  borderRadius: 999, padding: '3px 10px', fontSize: 11, fontWeight: 600,
};

function greetingText(): string {
  const h = new Date().getHours();
  if (h < 5) return 'לילה טוב';
  if (h < 12) return 'בוקר טוב';
  if (h < 18) return 'צהריים טובים';
  return 'ערב טוב';
}

function CountUp({ to, suffix = '' }: { to: number; suffix?: string }) {
  const [val, setVal] = useState(0);
  const reduce = useReducedMotion();
  useEffect(() => {
    if (reduce) { setVal(to); return; }
    const start = performance.now();
    const dur = 1100;
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / dur);
      const e = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(to * e));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, reduce]);
  return <>{val.toLocaleString('he-IL')}{suffix}</>;
}

interface ChatMsg { role: 'assistant' | 'user'; text: string }

export default function Dashboard() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMsg[]>([
    {
      role: 'assistant',
      text: 'בוקר טוב ישראל 👋 יש לך 3 עסקאות במשא ומתן בשווי ₪84K שכדאי לדחוף היום. סוכן הלידים הכניס 12 לידים חדשים מאז אתמול.',
    },
  ]);
  const chatRef = useRef<HTMLDivElement>(null);

  function onSend(e: FormEvent) {
    e.preventDefault();
    const q = input.trim();
    if (!q) return;
    const reply =
      'שאלה טובה. לפי המצב הנוכחי הייתי מתמקד בעסקאות במשא ומתן — יש שם ₪122K שקרובים לסגירה. רוצה שאכין סיכום לכל אחת?';
    setInput('');
    setMessages((s) => [...s, { role: 'user', text: q }, { role: 'assistant', text: reply }]);
    setTimeout(() => chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: 'smooth' }), 60);
  }

  const bubble = (role: ChatMsg['role']): React.CSSProperties =>
    role === 'user'
      ? { maxWidth: '88%', marginInlineStart: 'auto', border: '1px solid rgba(15,23,42,.08)', background: '#f1f5f9', borderRadius: 16, padding: '10px 14px', fontSize: 13.5, lineHeight: 1.55, color: '#0f172a' }
      : { maxWidth: '88%', marginInlineEnd: 'auto', border: '1px solid rgba(15,23,42,.16)', background: 'rgba(14,139,160,.1)', borderRadius: 16, padding: '10px 14px', fontSize: 13.5, lineHeight: 1.55, color: '#0f172a', boxShadow: '0 0 30px -10px rgba(14,139,160,.22), inset 0 1px 0 rgba(255,255,255,.6)' };

  return (
    <div className="mx-auto max-w-[1400px]">
      {/* greeting */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold tracking-[-.01em] text-ink">{greetingText()}, ישראל</h1>
          <p className="mt-1.5 text-sm text-muted">הנה מה שקורה בעסק שלך עכשיו — כל הסוכנים מחוברים למוח אחד.</p>
        </div>
        <span
          className="flex items-center gap-2 rounded-full border border-border bg-surface px-3.5 py-1.5 text-[12.5px]"
          style={{ boxShadow: '0 1px 2px rgba(15,23,42,.04)' }}
        >
          <span className="h-2 w-2 rounded-full bg-success animate-pulse-dot" />
          <span className="text-muted">מוח מרכזי</span>
          <span className="font-semibold text-success">מחובר</span>
        </span>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        {KPIS.map((k) => (
          <div key={k.label} className="glass-card p-[18px]">
            <div className="flex items-center gap-2 text-[12.5px] text-muted">
              <span className="text-gold"><Ico inner={k.icon} size={15} /></span>
              {k.label}
            </div>
            <div className="mt-2.5 text-[28px] font-semibold tracking-[-.01em] tabular-nums text-ink">
              {k.prefix && <span className="me-0.5 text-[15px] text-muted">{k.prefix}</span>}
              <CountUp to={k.value} suffix={k.suffix} />
            </div>
          </div>
        ))}
      </div>

      {/* board + assistant */}
      <div className="mt-4 grid grid-cols-1 items-stretch gap-4 lg:grid-cols-[2fr_1fr]">
        {/* pipeline */}
        <div className="glass-card overflow-hidden p-6" style={{ perspective: '1400px' }}>
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="text-[10px] uppercase tracking-[.25em] text-faint">צינור מכירות</div>
              <div className="mt-1 text-[18px] font-semibold" style={{ fontFamily: "'Space Grotesk',sans-serif" }}>
                זרימת עסקאות · <span className="text-gradient">₪ 342K</span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-[10.5px]">
              <a href="/crm/deals" className="rounded-full border border-border px-2.5 py-0.5 text-muted">לוח מלא</a>
              <span className="rounded-full border border-border-strong px-2.5 py-0.5 font-semibold text-gold-strong" style={{ background: 'rgba(14,139,160,.1)' }}>
                חי
              </span>
            </div>
          </div>
          <div
            className="grid grid-cols-2 gap-4 lg:grid-cols-4"
            style={{ transform: 'rotateX(6deg) rotateZ(-1deg)', transformStyle: 'preserve-3d' }}
          >
            {STAGES.map((st) => (
              <div key={st.label} className="flex flex-col gap-2.5" style={{ transform: `translateZ(${st.depth})` }}>
                <div className="flex items-center justify-between px-0.5">
                  <div className="flex items-center gap-2">
                    <span className="h-[7px] w-[7px] rounded-full" style={{ background: st.tint, boxShadow: `0 0 10px ${st.tint}` }} />
                    <span className="text-[12.5px] font-semibold text-ink">{st.label}</span>
                  </div>
                  <span className="text-[10.5px] text-faint">{st.count}</span>
                </div>
                <div className="flex flex-col gap-2.5">
                  {st.deals.map((d) => (
                    <div key={d.title} className="glass-card p-[13px]" style={{ boxShadow: glowOf(st.tint) }}>
                      <div className="truncate text-[10px] uppercase tracking-[.14em] text-faint">{d.account}</div>
                      <div className="mt-0.5 truncate text-[13.5px] font-medium text-ink">{d.title}</div>
                      <div className="mt-3 flex items-center justify-between">
                        <span className="text-[13.5px] font-semibold tabular-nums text-gold-strong">{d.value}</span>
                        <span
                          className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold text-white"
                          style={{ background: d.avatarBg }}
                        >
                          {d.owner}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* assistant */}
        <div className="glass-card flex min-h-[440px] flex-col p-5">
          <div className="flex items-center gap-3">
            <div className="relative h-9 w-9 rounded-[11px] p-[1.5px]" style={{ background: 'linear-gradient(135deg,#0e8ba0,#22b8cf)' }}>
              <div className="flex h-full w-full items-center justify-center rounded-[9px] bg-surface text-gold-strong">
                <Ico inner={P.sparkles} size={16} />
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold" style={{ fontFamily: "'Space Grotesk',sans-serif" }}>שיחה עם המוח</div>
              <div className="text-[10px] uppercase tracking-[.2em]" style={{ color: 'rgba(11,118,136,.7)' }}>CEO · AI</div>
            </div>
            <span className="flex items-center gap-1.5 rounded-full border border-border bg-surface-raised px-2.5 py-1 text-[10px] text-muted">
              <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse-dot" />
              פעיל
            </span>
          </div>
          <div
            ref={chatRef}
            className="scrollbar-hide mt-4 flex flex-1 flex-col gap-3 overflow-y-auto rounded-[14px] border border-border p-4"
            style={{ background: '#f8fafc' }}
          >
            {messages.map((m, i) => (
              <div key={i} style={bubble(m.role)}>{m.text}</div>
            ))}
          </div>
          <form onSubmit={onSend} className="mt-3 flex items-center gap-2 rounded-[14px] border border-border bg-surface-raised px-3 py-2.5">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="שאלו את המוח — «על מה להתמקד היום?»"
              className="flex-1 border-none bg-transparent text-[13.5px] text-ink outline-none placeholder:text-faint"
            />
            <button type="submit" aria-label="שליחה" className="flex cursor-pointer rounded-[9px] p-[7px]" style={{ background: 'linear-gradient(135deg,#0e8ba0,#22b8cf)' }}>
              <Ico inner={P.send} size={14} className="text-white" />
            </button>
          </form>
        </div>
      </div>

      {/* feed + connections */}
      <div className="mt-4 grid grid-cols-1 items-start gap-4 lg:grid-cols-[1.6fr_1fr]">
        {/* live feed */}
        <div className="glass-card p-6">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <div className="text-[10px] uppercase tracking-[.25em] text-faint">פיד חי</div>
              <div className="mt-1 text-[18px] font-semibold" style={{ fontFamily: "'Space Grotesk',sans-serif" }}>מה קורה עכשיו בעסק</div>
            </div>
            <span className="flex items-center gap-1.5 rounded-full border border-border-strong px-2.5 py-1 text-[11px] font-semibold text-gold-strong" style={{ background: 'rgba(14,139,160,.1)' }}>
              <span className="h-1.5 w-1.5 rounded-full bg-gold animate-pulse-dot" />
              בזמן אמת
            </span>
          </div>
          <ol className="m-0 flex list-none flex-col gap-5 px-1 p-0">
            {FEED.map((ev, i) => (
              <li
                key={i}
                className="relative flex gap-3"
                style={{ animation: `feed-in .4s cubic-bezier(.22,1,.36,1) both`, animationDelay: `${i * 60}ms` }}
              >
                <span className="z-[1] flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full border border-border bg-surface text-base shadow-card">
                  {ev.icon}
                </span>
                <div className="min-w-0 flex-1 pt-0.5">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="text-[13.5px] font-medium text-ink">{ev.label}</span>
                    <span className="text-[11.5px] text-faint">{ev.time}</span>
                  </div>
                  <p className="mt-0.5 text-[13.5px] leading-normal text-muted">{ev.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        {/* connections */}
        <div className="glass-card p-6">
          <div className="text-[10px] uppercase tracking-[.25em] text-faint">חיבורים</div>
          <div className="mb-[18px] mt-1 text-[18px] font-semibold" style={{ fontFamily: "'Space Grotesk',sans-serif" }}>הערוצים שלך</div>
          <div className="flex flex-col gap-3">
            {CONNECTIONS.map((c) => (
              <div key={c.name} className="flex items-center gap-3 rounded-xl border border-border p-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-[10px]" style={{ background: c.tint, color: c.iconColor }}>
                  <Ico inner={c.icon} size={18} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[13.5px] font-semibold text-ink">{c.name}</div>
                  <div className="text-[11.5px] text-faint">{c.meta}</div>
                </div>
                <span style={OK_PILL}>מחובר</span>
              </div>
            ))}
          </div>
          <a
            href="/connections"
            className="mt-4 block rounded-xl border border-dashed border-border-strong py-2.5 text-center text-[13px] font-semibold text-gold-strong"
          >
            + חיבור ערוץ נוסף
          </a>
        </div>
      </div>
    </div>
  );
}
