import { useRef, useState, type FormEvent } from 'react';

/* אינבוקס — Unified Inbox, ported 1:1 from the Claude Design v2 handoff
   (docs/claude-design/v2/Inbox.dc.html). THREE-pane layout:
   conversation list | thread | customer info panel.
   Layout, copy, seed conversations/messages, tint colors, selection state,
   filters (status + channel), search, AI suggestions, quick replies, agent
   toggle, archive / mark-unread, toast and composer are verbatim from the
   design's DCLogic. Colors are the design's literal values (= our tokens).
   The top nav/app chrome is provided by <Layout>; only the page root is here.
   Responsive: the design's exact r-inbox @media system is injected verbatim. */

/* ---------- inline heroicons (exact paths from the design) ---------- */
function Ico({ inner, size = 16, stroke = 'currentColor', width = 1.7 }: { inner: string; size?: number; stroke?: string; width?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke={stroke}
      strokeWidth={width}
      width={size}
      height={size}
      dangerouslySetInnerHTML={{ __html: inner }}
    />
  );
}

const P = {
  search:
    '<path stroke-linecap="round" stroke-linejoin="round" d="m21 21-4.34-4.34M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z"/>',
  sparkles:
    '<path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z"/>',
  send:
    '<path stroke-linecap="round" stroke-linejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5"/>',
  chevron:
    '<path stroke-linecap="round" stroke-linejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5"/>',
  eye:
    '<path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z"/><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"/>',
  archive:
    '<path stroke-linecap="round" stroke-linejoin="round" d="m20.25 7.5-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5m6 4.125 2.25 2.25m0 0 2.25-2.25M12 13.875V7.5m8.25 0H3.75m16.5 0a1.125 1.125 0 0 0-1.125-1.125H4.875A1.125 1.125 0 0 0 3.75 7.5"/>',
  msg:
    '<path stroke-linecap="round" stroke-linejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5"/>',
  user:
    '<path stroke-linecap="round" stroke-linejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Z"/>',
  plus:
    '<path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15"/>',
};

/* ---------- responsive system — verbatim from the design's <style> block ---------- */
const INBOX_MEDIA = `
@media (max-width:1080px){ .r-inbox{grid-template-columns:minmax(0,2fr) minmax(0,3fr) !important;} .inbox-info{display:none !important;} }
@media (max-width:760px){ .r-inbox{grid-template-columns:1fr !important; height:auto !important;} .r-main{padding-inline:14px !important;} }
`;

/* ---------- seed data (verbatim from the design's DCLogic._data) ---------- */
type Msg =
  | { day: string }
  | { from: 'them' | 'agent' | 'me' | 'system'; text: string; t: string };

type Status = 'open' | 'pending' | 'closed';

interface Deal {
  title: string;
  value: string;
  stage: string;
}

interface Conversation {
  id: string;
  name: string;
  initials: string;
  tint: string;
  channel: string;
  ch: string;
  chEmoji: string;
  chTint: string;
  phone: string;
  time: string;
  preview: string;
  unread: number;
  byAgent: boolean;
  status: Status;
  archived?: boolean;
  role: string;
  deals: Deal[];
  msgs: Msg[];
}

const SEED: Conversation[] = [
  {
    id: 'c1', name: 'מוסך דהן ובניו', initials: 'מד', tint: '#12805c', channel: 'WhatsApp', ch: 'whatsapp', chEmoji: '💬', chTint: '#12805c', phone: '050-123-4567', time: '12:40', preview: 'אפשר לקבוע תור לשבוע הבא?', unread: 2, byAgent: true, status: 'pending',
    role: 'בעלים · לקוח', deals: [{ title: 'קמפיין לידים', value: '₪9K', stage: 'ליד' }],
    msgs: [
      { day: 'היום' },
      { from: 'them', text: 'שלום, אפשר לקבוע תור לטיפול לשבוע הבא?', t: '12:31' },
      { from: 'agent', text: 'בשמחה! יש זמינות ביום ג׳ ב‑10:00 או ד׳ ב‑14:00. מה נוח?', t: '12:31' },
      { from: 'them', text: 'יום ג׳ ב‑10:00 מצוין', t: '12:39' },
      { from: 'agent', text: 'מעולה, קבעתי תור ליום ג׳ 29.7 בשעה 10:00. שלחתי תזכורת 🙌', t: '12:40' },
    ],
  },
  {
    id: 'c2', name: 'סטודיו מיכל', initials: 'סמ', tint: '#0e8ba0', channel: 'Instagram', ch: 'instagram', chEmoji: '📸', chTint: '#7c6cf0', phone: '@studio.michal', time: '11:58', preview: 'תודה! נשמע מעולה', unread: 0, byAgent: false, status: 'open',
    role: 'מעצבת · לקוחה', deals: [{ title: 'שדרוג אתר תדמית', value: '₪18K', stage: 'ליד' }],
    msgs: [
      { day: 'היום' },
      { from: 'them', text: 'היי, ראיתי את חבילת הווידאו — כמה זה עולה?', t: '11:20' },
      { from: 'me', text: 'היי מיכל! החבילה מ‑₪1,900 לחודש וכוללת 8 סרטונים. לתאם שיחה?', t: '11:45' },
      { from: 'them', text: 'תודה! נשמע מעולה', t: '11:58' },
    ],
  },
  {
    id: 'c3', name: 'רשת אופנה URBAN', initials: 'רא', tint: '#b26a00', channel: 'Facebook', ch: 'facebook', chEmoji: '👍', chTint: '#1666a8', phone: 'עמוד עסקי', time: 'אתמול', preview: 'שלחנו הצעת מחיר לאוטומציה', unread: 1, byAgent: true, status: 'pending',
    role: 'רכש · לקוח', deals: [{ title: 'אוטומציית וואטסאפ', value: '₪64K', stage: 'הצעה' }],
    msgs: [
      { day: 'אתמול' },
      { from: 'them', text: 'מעוניינים באוטומציה של מענה בפייסבוק', t: '16:02' },
      { from: 'agent', text: 'נהדר! הכנתי הצעת מחיר מותאמת — שלחתי למייל וגם כאן.', t: '16:05' },
    ],
  },
  {
    id: 'c4', name: 'קליניקת נועה', initials: 'קנ', tint: '#7c6cf0', channel: 'Email', ch: 'email', chEmoji: '✉️', chTint: '#0e7490', phone: 'noa@clinic.co.il', time: 'אתמול', preview: 'התשלום עבר, תודה רבה', unread: 0, byAgent: false, status: 'closed',
    role: 'מנהלת · לקוחה', deals: [{ title: 'חבילת סוכנים שנתית', value: '₪42K', stage: 'מוכשר' }],
    msgs: [
      { day: 'אתמול' },
      { from: 'them', text: 'רק מוודאת שהתשלום החודשי עבר', t: '09:10' },
      { from: 'me', text: 'כן, התקבל — קבלה נשלחה למייל 🙏', t: '09:14' },
      { from: 'them', text: 'התשלום עבר, תודה רבה', t: '09:15' },
    ],
  },
  {
    id: 'c5', name: 'בית קפה עלית', initials: 'בק', tint: '#0e7490', channel: 'WhatsApp', ch: 'whatsapp', chEmoji: '💬', chTint: '#12805c', phone: '052-998-7766', time: 'א׳', preview: 'הזמנה חדשה התקבלה מהחנות', unread: 0, byAgent: true, status: 'closed',
    role: 'מנהל · לקוח', deals: [{ title: 'ניהול סושיאל', value: '₪12K', stage: 'מוכשר' }],
    msgs: [
      { day: 'יום ראשון' },
      { from: 'system', text: 'הזמנה חדשה מהחנות — ₪860', t: '14:22' },
      { from: 'agent', text: 'ההזמנה נקלטה ונשלח אישור ללקוח אוטומטית ✅', t: '14:22' },
    ],
  },
  {
    id: 'c6', name: 'דנה — ליד חדש', initials: 'דל', tint: '#1666a8', channel: 'Instagram', ch: 'instagram', chEmoji: '📸', chTint: '#7c6cf0', phone: '@dana_k', time: '09:05', preview: 'מעוניינת במחיר לחבילת וידאו', unread: 1, byAgent: false, status: 'open',
    role: 'ליד · לא במערכת', deals: [],
    msgs: [
      { day: 'היום' },
      { from: 'them', text: 'היי! מעוניינת במחיר לחבילת וידאו לעסק שלי', t: '09:05' },
    ],
  },
];

/* ---------- filter / pill tint tables (verbatim from the design) ---------- */
const stTint: Record<Status, [string, string, string]> = {
  open: ['rgba(14,139,160,.1)', '#0b7688', 'פתוח'],
  pending: ['rgba(178,106,0,.1)', '#b26a00', 'ממתין'],
  closed: ['rgba(18,128,92,.1)', '#12805c', 'נסגר'],
};
const stTintD: Record<string, [string, string]> = {
  'ליד': ['rgba(14,116,144,.1)', '#0e7490'],
  'מוכשר': ['rgba(14,139,160,.1)', '#0b7688'],
  'הצעה': ['rgba(178,106,0,.1)', '#b26a00'],
  'משא ומתן': ['rgba(15,23,42,.06)', '#0f172a'],
};

/* ---------- bubble styles (verbatim from the design's renderVals) ---------- */
const meWrap: React.CSSProperties = { display: 'flex', flexDirection: 'column', alignItems: 'flex-start', maxWidth: '80%', alignSelf: 'flex-start' };
const themWrap: React.CSSProperties = { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', maxWidth: '80%', alignSelf: 'flex-end' };
const sysWrap: React.CSSProperties = { display: 'flex', alignSelf: 'center', maxWidth: '80%' };
const meBubble: React.CSSProperties = { background: '#fff', border: '1px solid rgba(15,23,42,.08)', borderRadius: '16px 16px 16px 5px', padding: '9px 13px', fontSize: 14, lineHeight: 1.5, color: '#0f172a', boxShadow: '0 1px 2px rgba(15,23,42,.04)' };
const agentBubble: React.CSSProperties = { background: 'rgba(14,139,160,.1)', border: '1px solid rgba(14,139,160,.2)', borderRadius: '16px 16px 5px 16px', padding: '9px 13px', fontSize: 14, lineHeight: 1.5, color: '#0f172a' };
const myBubble: React.CSSProperties = { background: '#0e8ba0', borderRadius: '16px 16px 5px 16px', padding: '9px 13px', fontSize: 14, lineHeight: 1.5, color: '#fff' };
const sysBubble: React.CSSProperties = { background: '#eef2f7', border: '1px dashed rgba(15,23,42,.16)', borderRadius: 12, padding: '8px 13px', fontSize: 13, color: '#55627a' };
const metaBase: React.CSSProperties = { fontSize: 10.5, color: '#94a3b8', marginTop: 3 };

const rowBaseCommon: React.CSSProperties = { display: 'flex', gap: 12, padding: '13px 14px', cursor: 'pointer', borderBottom: '1px solid rgba(15,23,42,.06)', transition: 'background .15s ease' };

const statusFilterDefs: [string, string][] = [['all', 'הכל'], ['unread', 'לא נקרא'], ['pending', 'ממתין'], ['closed', 'נסגר']];
const channelFilterDefs: [string, string][] = [['all', 'הכל'], ['whatsapp', '💬'], ['instagram', '📸'], ['facebook', '👍'], ['email', '✉️']];
const suggBank = [
  'תודה על הפנייה! אשמח לעזור — מתי נוח לך לשיחה קצרה?',
  'בהחלט. שלחתי לך את כל הפרטים, ואם יש שאלה נוספת אני כאן 🙏',
];
const quickReplyDefs = ['תודה על הפנייה!', 'אחזור אליך בהקדם', 'אפשר לתאם שיחה?', 'שלחתי הצעת מחיר'];

export default function Inbox() {
  const [convos, setConvos] = useState<Conversation[]>(SEED);
  const [activeId, setActiveId] = useState('c1');
  const [input, setInput] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [chFilter, setChFilter] = useState('all');
  const [toast, setToast] = useState('');
  /* mobile-only (≤760): which pane is visible. No effect above the breakpoint. */
  const [mobileView, setMobileView] = useState<'list' | 'thread'>('list');
  const threadRef = useRef<HTMLDivElement>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>();

  function fireToast(m: string) {
    setToast(m);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 2400);
  }

  const active = convos.find((c) => c.id === activeId) || convos[0];
  const agentOn = !!active.byAgent;
  const stC = agentOn ? '#0e8ba0' : '#94a3b8';
  const agentState = agentOn ? 'סוכן עונה' : 'מענה ידני';

  /* ---------- filtered list ---------- */
  const q = search.trim();
  const shown = convos.filter((c) => {
    if (c.archived) return false;
    if (chFilter !== 'all' && c.ch !== chFilter) return false;
    if (statusFilter === 'unread' && !(c.unread > 0)) return false;
    if (statusFilter === 'pending' && c.status !== 'pending') return false;
    if (statusFilter === 'closed' && c.status !== 'closed') return false;
    if (q && !(c.name.includes(q) || c.preview.includes(q))) return false;
    return true;
  });

  function selectConv(id: string) {
    setConvos((s) => s.map((c) => (c.id === id ? { ...c, unread: 0 } : c)));
    setActiveId(id);
    setMobileView('thread');
  }

  function send(text: string) {
    const id = activeId;
    setConvos((s) => s.map((c) => (c.id === id
      ? { ...c, msgs: [...c.msgs, { from: 'me', text, t: 'עכשיו' }], preview: text, status: c.status === 'closed' ? 'open' : c.status }
      : c)));
    setTimeout(() => threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: 'smooth' }), 50);
  }

  function onSend(e: FormEvent) {
    e.preventDefault();
    const v = input.trim();
    if (!v) return;
    send(v);
    setInput('');
  }

  function toggleAgent() {
    const id = activeId;
    setConvos((s) => s.map((c) => (c.id === id ? { ...c, byAgent: !c.byAgent } : c)));
  }

  function onToggleRead() {
    const id = activeId;
    setConvos((s) => s.map((c) => (c.id === id ? { ...c, unread: c.unread > 0 ? 0 : 1 } : c)));
    fireToast('סומן');
  }

  function onArchive() {
    const id = activeId;
    setConvos((s) => {
      const next = s.map((c) => (c.id === id ? { ...c, archived: true } : c));
      const fallback = next.find((c) => c.id !== id && !c.archived);
      if (fallback) setActiveId(fallback.id);
      return next;
    });
    fireToast('השיחה הועברה לארכיון');
  }

  /* ---------- AI suggestions (based on last them message) ---------- */
  const lastThem = [...active.msgs].reverse().find((m): m is Extract<Msg, { from: string }> => 'from' in m && m.from === 'them');
  const showAI = !!lastThem && active.status !== 'closed';

  /* ---------- button style helpers ---------- */
  const sBtn = (on: boolean): React.CSSProperties => ({
    cursor: 'pointer', fontFamily: 'inherit', border: 'none', borderRadius: 8, padding: '5px 10px', fontSize: 12, fontWeight: 600,
    ...(on ? { background: '#0e8ba0', color: '#fff' } : { background: '#f1f5f9', color: '#55627a' }),
  });
  const chBtn = (on: boolean): React.CSSProperties => ({
    cursor: 'pointer', fontFamily: 'inherit', border: 'none', borderRadius: 8, padding: '4px 10px', fontSize: 12,
    ...(on ? { background: 'rgba(14,139,160,.12)', color: '#0b7688', fontWeight: 600 } : { background: 'transparent', color: '#94a3b8' }),
  });

  const agentToggleStyle: React.CSSProperties = {
    cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 5,
    borderRadius: 999, padding: '5px 11px', fontSize: 12, fontWeight: 600,
    ...(agentOn
      ? { border: '1px solid #0e8ba0', background: 'rgba(14,139,160,.1)', color: '#0b7688' }
      : { border: '1px solid rgba(15,23,42,.16)', background: '#fff', color: '#55627a' }),
  };
  const agentToggleLabel = agentOn ? 'סוכן עונה אוטומטית' : 'מענה ידני';
  const agentHint = agentOn ? 'הסוכן עונה אוטומטית · לחצו כדי להשתלט' : 'אתם עונים ידנית · לחצו להחזרת הסוכן';

  const infoFields = [
    { label: 'ערוץ', value: active.channel, dir: 'ltr' as const },
    { label: 'פרטים', value: active.phone, dir: 'ltr' as const },
    { label: 'סטטוס', value: stTint[active.status][2], dir: 'rtl' as const },
  ];

  return (
    <main className="r-main" style={{ maxWidth: 1320, margin: '0 auto' }}>
      <style dangerouslySetInnerHTML={{ __html: INBOX_MEDIA }} />

      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 10, letterSpacing: '.25em', textTransform: 'uppercase', color: '#94a3b8', fontFamily: "'Space Grotesk',sans-serif" }}>Unified Inbox</div>
        <h1 style={{ margin: '6px 0 0', fontSize: 24, fontWeight: 600, letterSpacing: '-.01em' }}>אינבוקס</h1>
      </div>

      <div className="r-inbox" style={{ display: 'grid', gridTemplateColumns: '320px minmax(0,1fr) 280px', gap: 16, height: 660 }}>

        {/* ---------- conversation list ---------- */}
        <div className={`glass-card flex flex-col ${mobileView === 'thread' ? 'max-[760px]:hidden' : ''}`} style={{ overflow: 'hidden', padding: 0 }}>
          <div style={{ padding: '12px 14px', borderBottom: '1px solid rgba(15,23,42,.08)' }}>
            <div style={{ position: 'relative', marginBottom: 10 }}>
              <span style={{ pointerEvents: 'none', position: 'absolute', insetInlineStart: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}>
                <Ico inner={P.search} size={14} width={1.8} />
              </span>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="חיפוש בשיחות…"
                style={{ width: '100%', border: '1px solid rgba(15,23,42,.14)', background: '#f8fafc', borderRadius: 10, padding: '8px 10px 8px 30px', fontFamily: 'inherit', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 7 }}>
              {statusFilterDefs.map(([k, l]) => (
                <button key={k} onClick={() => setStatusFilter(k)} style={sBtn(statusFilter === k)}>{l}</button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
              {channelFilterDefs.map(([k, l]) => (
                <button key={k} onClick={() => setChFilter(k)} title={k} style={chBtn(chFilter === k)}>{l}</button>
              ))}
            </div>
          </div>
          <div className="scrollbar-hide" style={{ flex: 1, overflowY: 'auto' }}>
            {shown.map((c) => {
              const sel = c.id === activeId;
              const st = stTint[c.status];
              return (
                <div
                  key={c.id}
                  onClick={() => selectConv(c.id)}
                  style={{ ...rowBaseCommon, ...(sel ? { background: 'rgba(14,139,160,.07)', boxShadow: 'inset 3px 0 0 #0e8ba0' } : { background: '#fff' }) }}
                >
                  <div style={{ position: 'relative', flex: 'none' }}>
                    <span style={{ width: 42, height: 42, borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, color: '#fff', background: c.tint }}>{c.initials}</span>
                    <span style={{ position: 'absolute', bottom: -2, insetInlineEnd: -2, width: 18, height: 18, borderRadius: 999, border: '2px solid #fff', background: c.chTint, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9 }}>{c.chEmoji}</span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                      <span style={{ fontSize: 14, fontWeight: c.unread > 0 ? 700 : 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                      <span style={{ marginInlineStart: 'auto', flex: 'none', fontSize: 11, color: '#94a3b8' }}>{c.time}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                      <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: '#55627a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.preview}</span>
                      {c.unread > 0 && (
                        <span className="tabular-nums" style={{ flex: 'none', minWidth: 18, height: 18, padding: '0 5px', borderRadius: 999, background: '#0e8ba0', color: '#fff', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{c.unread}</span>
                      )}
                    </div>
                    <div style={{ marginTop: 6, display: 'flex', gap: 5 }}>
                      {c.byAgent && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10.5, fontWeight: 600, color: '#0b7688', border: '1px solid rgba(14,139,160,.3)', background: 'rgba(14,139,160,.08)', borderRadius: 999, padding: '1px 7px' }}>
                          <span style={{ width: 5, height: 5, borderRadius: 999, background: '#0e8ba0' }} />סוכן
                        </span>
                      )}
                      <span style={{ borderRadius: 999, padding: '1px 8px', fontSize: 10, fontWeight: 600, background: st[0], color: st[1] }}>{st[2]}</span>
                    </div>
                  </div>
                </div>
              );
            })}
            {shown.length === 0 && (
              <div style={{ padding: '40px 20px', textAlign: 'center', fontSize: 13, color: '#94a3b8' }}>אין שיחות שתואמות את הסינון</div>
            )}
          </div>
        </div>

        {/* ---------- thread ---------- */}
        <div className={`glass-card flex flex-col ${mobileView === 'list' ? 'max-[760px]:hidden' : ''}`} style={{ overflow: 'hidden', padding: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid rgba(15,23,42,.08)', padding: '13px 18px' }}>
            <button
              type="button"
              onClick={() => setMobileView('list')}
              className="min-[761px]:hidden"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 4, border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 600, color: '#0b7688', flex: 'none', padding: 0 }}
            >
              <Ico inner={P.chevron} size={16} width={2} />
              חזרה
            </button>
            <span style={{ width: 38, height: 38, borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, color: '#fff', background: active.tint }}>{active.initials}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 600 }}>{active.name}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#55627a' }}>
                <span>{active.channel}</span><span style={{ color: '#cbd5e1' }}>·</span><span>{active.phone}</span>
              </div>
            </div>
            <button onClick={onToggleRead} title="סמן כלא נקרא" style={{ cursor: 'pointer', border: '1px solid rgba(15,23,42,.1)', background: '#fff', borderRadius: 9, padding: 7, color: '#55627a', display: 'flex' }}>
              <Ico inner={P.eye} size={16} width={1.6} />
            </button>
            <button onClick={onArchive} title="ארכוב" style={{ cursor: 'pointer', border: '1px solid rgba(15,23,42,.1)', background: '#fff', borderRadius: 9, padding: 7, color: '#55627a', display: 'flex' }}>
              <Ico inner={P.archive} size={16} width={1.6} />
            </button>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, border: `1px solid ${stC}22`, background: `${stC}14`, color: stC, borderRadius: 999, padding: '4px 11px', fontSize: 11.5, fontWeight: 600 }}>
              <span className="animate-pulse-dot" style={{ width: 6, height: 6, borderRadius: 999, background: stC }} />{agentState}
            </span>
          </div>

          {/* messages */}
          <div ref={threadRef} className="scrollbar-hide" style={{ flex: 1, overflowY: 'auto', padding: '22px 20px', display: 'flex', flexDirection: 'column', gap: 10, background: '#f8fafc' }}>
            {active.msgs.map((m, i) => {
              if ('day' in m) {
                return (
                  <div key={i} style={{ alignSelf: 'center', margin: '6px 0', fontSize: 11, color: '#94a3b8', background: '#eef2f7', borderRadius: 999, padding: '3px 12px' }}>{m.day}</div>
                );
              }
              let wrap: React.CSSProperties;
              let bubble: React.CSSProperties;
              let meta = m.t;
              let metaStyle: React.CSSProperties = metaBase;
              if (m.from === 'them') { wrap = meWrap; bubble = meBubble; metaStyle = { ...metaBase, alignSelf: 'flex-start' }; }
              else if (m.from === 'agent') { wrap = themWrap; bubble = agentBubble; meta = '🤖 סוכן · ' + m.t; metaStyle = { ...metaBase, alignSelf: 'flex-end' }; }
              else if (m.from === 'system') { wrap = sysWrap; bubble = sysBubble; meta = ''; metaStyle = { display: 'none' }; }
              else { wrap = themWrap; bubble = myBubble; meta = 'את/ה · ' + m.t; metaStyle = { ...metaBase, alignSelf: 'flex-end' }; }
              return (
                <div key={i} style={wrap}>
                  <div style={bubble}>{m.text}</div>
                  <div style={metaStyle}>{meta}</div>
                </div>
              );
            })}
          </div>

          {/* AI suggestions */}
          {showAI && (
            <div style={{ borderTop: '1px solid rgba(15,23,42,.08)', padding: '10px 16px 0', background: '#fff' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 600, color: '#0b7688', marginBottom: 7 }}>
                <Ico inner={P.sparkles} size={13} width={1.6} />הצעות מענה מהסוכן
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {suggBank.map((text) => (
                  <button key={text} onClick={() => send(text)} style={{ cursor: 'pointer', fontFamily: 'inherit', textAlign: 'start', border: '1px solid rgba(14,139,160,.25)', background: 'rgba(14,139,160,.06)', color: '#0f172a', borderRadius: 12, padding: '8px 12px', fontSize: 12.5, lineHeight: 1.4, maxWidth: '100%' }}>{text}</button>
                ))}
              </div>
            </div>
          )}

          {/* quick replies + composer */}
          <div style={{ borderTop: '1px solid rgba(15,23,42,.08)', padding: '10px 16px 14px', background: '#fff' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 9, flexWrap: 'wrap' }}>
              <button onClick={toggleAgent} style={agentToggleStyle}>
                <Ico inner={P.sparkles} size={13} width={1.6} />
                {agentToggleLabel}
              </button>
              <span style={{ fontSize: 11.5, color: '#94a3b8' }}>{agentHint}</span>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 9 }}>
              {quickReplyDefs.map((label) => (
                <button key={label} className="qr" onClick={() => setInput(label)} style={{ cursor: 'pointer', fontFamily: 'inherit', border: '1px solid rgba(15,23,42,.14)', background: '#f8fafc', borderRadius: 999, padding: '5px 11px', fontSize: 12, color: '#0f172a', transition: 'background .15s ease' }}>{label}</button>
              ))}
            </div>
            <form onSubmit={onSend} style={{ display: 'flex', alignItems: 'center', gap: 8, border: '1px solid rgba(15,23,42,.16)', background: '#fff', borderRadius: 14, padding: '9px 12px' }}>
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="כתבו הודעה…"
                style={{ flex: 1, minWidth: 0, border: 'none', background: 'transparent', outline: 'none', fontFamily: 'inherit', fontSize: 14, color: '#0f172a' }}
              />
              <button type="submit" aria-label="שליחה" style={{ border: 'none', borderRadius: 10, background: '#0e8ba0', padding: 9, cursor: 'pointer', display: 'flex' }}>
                <Ico inner={P.send} size={15} stroke="#fff" width={1.8} />
              </button>
            </form>
          </div>
        </div>

        {/* ---------- customer info panel (hidden ≤1080 via .inbox-info) ---------- */}
        <div className="glass-card inbox-info" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: 0 }}>
          <div className="scrollbar-hide" style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', paddingBottom: 18, borderBottom: '1px solid rgba(15,23,42,.08)' }}>
              <span style={{ width: 60, height: 60, borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 20, color: '#fff', background: active.tint }}>{active.initials}</span>
              <div style={{ fontSize: 16, fontWeight: 600, marginTop: 10 }}>{active.name}</div>
              <div style={{ fontSize: 12.5, color: '#94a3b8' }}>{active.role}</div>
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <span title="הודעה" style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(14,139,160,.1)', color: '#0b7688', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                  <Ico inner={P.msg} size={17} width={1.6} />
                </span>
                <span title="כרטיס CRM" style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(14,139,160,.1)', color: '#0b7688', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                  <Ico inner={P.user} size={17} width={1.6} />
                </span>
                <span title="עסקה חדשה" style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(14,139,160,.1)', color: '#0b7688', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                  <Ico inner={P.plus} size={17} width={1.6} />
                </span>
              </div>
            </div>
            <div style={{ padding: '16px 0', borderBottom: '1px solid rgba(15,23,42,.08)', display: 'flex', flexDirection: 'column', gap: 9 }}>
              {infoFields.map((f) => (
                <div key={f.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5 }}>
                  <span style={{ color: '#94a3b8' }}>{f.label}</span>
                  <span style={{ color: '#0f172a', fontWeight: 500 }} dir={f.dir}>{f.value}</span>
                </div>
              ))}
            </div>
            <div style={{ paddingTop: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#94a3b8', marginBottom: 10 }}>עסקאות פתוחות</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {active.deals.map((d) => {
                  const p = stTintD[d.stage] || ['#f1f5f9', '#55627a'];
                  return (
                    <div key={d.title} style={{ display: 'block', border: '1px solid rgba(15,23,42,.08)', borderRadius: 11, padding: '11px 12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.title}</span>
                        <span className="tabular-nums" style={{ fontSize: 13, fontWeight: 600, color: '#0b7688' }}>{d.value}</span>
                      </div>
                      <span style={{ display: 'inline-block', marginTop: 7, borderRadius: 999, padding: '1px 8px', fontSize: 10.5, fontWeight: 600, background: p[0], color: p[1] }}>{d.stage}</span>
                    </div>
                  );
                })}
                {active.deals.length === 0 && (
                  <div style={{ fontSize: 12.5, color: '#94a3b8', textAlign: 'center', padding: 8 }}>אין עסקאות פתוחות</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {toast && (
        <div style={{ position: 'fixed', bottom: 28, insetInlineStart: '50%', transform: 'translateX(50%)', zIndex: 80, background: '#0f172a', color: '#fff', borderRadius: 12, padding: '12px 20px', fontSize: 14, boxShadow: '0 12px 32px rgba(15,23,42,.28)' }}>{toast}</div>
      )}
    </main>
  );
}
