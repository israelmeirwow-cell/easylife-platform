import { useRef, useState, type FormEvent } from 'react';

/* אינבוקס — Unified Inbox, ported 1:1 from the Claude Design handoff
   (design_files/Inbox.dc.html). Two-pane conversation list + thread view.
   Layout, copy, seed conversations/messages, tint colors, selection state,
   agent toggle and composer are all verbatim from the design's DCLogic.
   Colors are the design's literal values (they equal our tokens). The top
   nav/app chrome is provided by <Layout>; only the <main> content is here. */

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
  inbox:
    '<path stroke-linecap="round" stroke-linejoin="round" d="M2.25 13.5h3.86a2.25 2.25 0 0 1 2.012 1.244l.256.512a2.25 2.25 0 0 0 2.013 1.244h3.218a2.25 2.25 0 0 0 2.013-1.244l.256-.512a2.25 2.25 0 0 1 2.013-1.244h3.859m-19.5.338V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18v-4.162c0-.224-.034-.447-.1-.661L19.24 5.338a2.25 2.25 0 0 0-2.15-1.588H6.911a2.25 2.25 0 0 0-2.15 1.588L2.35 13.177a2.25 2.25 0 0 0-.1.661Z"/>',
  sparkles:
    '<path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z"/>',
  send:
    '<path stroke-linecap="round" stroke-linejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5"/>',
  chevron:
    '<path stroke-linecap="round" stroke-linejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5"/>',
};

/* ---------- seed data (verbatim from the design's DCLogic._data) ---------- */
type Msg =
  | { day: string }
  | { from: 'them' | 'agent' | 'me' | 'system'; text: string; t: string };

interface Conversation {
  id: string;
  name: string;
  initials: string;
  tint: string;
  channel: string;
  chEmoji: string;
  chTint: string;
  phone: string;
  time: string;
  preview: string;
  unread: number;
  byAgent: boolean;
  agentState: string;
  msgs: Msg[];
}

const SEED: Conversation[] = [
  {
    id: 'c1', name: 'מוסך דהן ובניו', initials: 'מד', tint: '#12805c', channel: 'WhatsApp', chEmoji: '💬', chTint: '#12805c', phone: '050‑123‑4567', time: '12:40', preview: 'אפשר לקבוע תור לשבוע הבא?', unread: 2, byAgent: true, agentState: 'סוכן מטפל',
    msgs: [
      { day: 'היום' },
      { from: 'them', text: 'שלום, אפשר לקבוע תור לטיפול לשבוע הבא?', t: '12:31' },
      { from: 'agent', text: 'בשמחה! יש לנו זמינות ביום ג׳ ב‑10:00 או ביום ד׳ ב‑14:00. מה נוח לך?', t: '12:31' },
      { from: 'them', text: 'יום ג׳ ב‑10:00 מצוין', t: '12:39' },
      { from: 'agent', text: 'מעולה, קבעתי לך תור ליום ג׳ ה‑29.7 בשעה 10:00. שלחתי תזכורת לוואטסאפ 🙌', t: '12:40' },
    ],
  },
  {
    id: 'c2', name: 'סטודיו מיכל', initials: 'סמ', tint: '#0e8ba0', channel: 'Instagram', chEmoji: '📸', chTint: '#7c6cf0', phone: '@studio.michal', time: '11:58', preview: 'תודה! נשמע מעולה', unread: 0, byAgent: false, agentState: 'צוות מטפל',
    msgs: [
      { day: 'היום' },
      { from: 'them', text: 'היי, ראיתי את חבילת הווידאו — כמה זה עולה?', t: '11:20' },
      { from: 'me', text: 'היי מיכל! החבילה מתחילה ב‑₪1,900 לחודש וכוללת 8 סרטונים. אפשר לתאם שיחה קצרה?', t: '11:45' },
      { from: 'them', text: 'תודה! נשמע מעולה', t: '11:58' },
    ],
  },
  {
    id: 'c3', name: 'רשת אופנה URBAN', initials: 'רא', tint: '#b26a00', channel: 'Facebook', chEmoji: '👍', chTint: '#1666a8', phone: 'עמוד עסקי', time: 'אתמול', preview: 'שלחנו הצעת מחיר לאוטומציה', unread: 0, byAgent: true, agentState: 'סוכן מטפל',
    msgs: [
      { day: 'אתמול' },
      { from: 'them', text: 'מעוניינים באוטומציה של מענה ללקוחות בפייסבוק', t: '16:02' },
      { from: 'agent', text: 'נהדר! הכנתי הצעת מחיר מותאמת — שלחתי אליכם למייל וגם כאן. נשמח לענות על שאלות.', t: '16:05' },
    ],
  },
  {
    id: 'c4', name: 'קליניקת נועה', initials: 'קנ', tint: '#7c6cf0', channel: 'Email', chEmoji: '✉️', chTint: '#0e7490', phone: 'noa@clinic.co.il', time: 'אתמול', preview: 'התשלום עבר, תודה רבה', unread: 0, byAgent: false, agentState: 'צוות מטפל',
    msgs: [
      { day: 'אתמול' },
      { from: 'them', text: 'רק מוודאת שהתשלום החודשי עבר', t: '09:10' },
      { from: 'me', text: 'כן, התקבל בהצלחה — קבלה נשלחה למייל 🙏', t: '09:14' },
      { from: 'them', text: 'התשלום עבר, תודה רבה', t: '09:15' },
    ],
  },
  {
    id: 'c5', name: 'בית קפה עלית', initials: 'בק', tint: '#0e7490', channel: 'WhatsApp', chEmoji: '💬', chTint: '#12805c', phone: '052‑998‑7766', time: 'א׳', preview: 'הזמנה חדשה התקבלה מהחנות', unread: 0, byAgent: true, agentState: 'סוכן מטפל',
    msgs: [
      { day: 'יום ראשון' },
      { from: 'system', text: 'הזמנה חדשה מהחנות — ₪860', t: '14:22' },
      { from: 'agent', text: 'ההזמנה נקלטה ונשלח אישור ללקוח אוטומטית ✅', t: '14:22' },
    ],
  },
];

/* ---------- bubble styles (verbatim from the design's renderVals) ---------- */
const meWrap: React.CSSProperties = { display: 'flex', flexDirection: 'column', alignItems: 'flex-start', maxWidth: '78%', alignSelf: 'flex-start' };
const themWrap: React.CSSProperties = { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', maxWidth: '78%', alignSelf: 'flex-end' };
const sysWrap: React.CSSProperties = { display: 'flex', alignSelf: 'center', maxWidth: '80%' };
const meBubble: React.CSSProperties = { background: '#fff', border: '1px solid rgba(15,23,42,.08)', borderRadius: '16px 16px 16px 5px', padding: '9px 13px', fontSize: 14, lineHeight: 1.5, color: '#0f172a', boxShadow: '0 1px 2px rgba(15,23,42,.04)' };
const agentBubble: React.CSSProperties = { background: 'rgba(14,139,160,.1)', border: '1px solid rgba(14,139,160,.2)', borderRadius: '16px 16px 5px 16px', padding: '9px 13px', fontSize: 14, lineHeight: 1.5, color: '#0f172a' };
const myBubble: React.CSSProperties = { background: '#0e8ba0', borderRadius: '16px 16px 5px 16px', padding: '9px 13px', fontSize: 14, lineHeight: 1.5, color: '#fff' };
const sysBubble: React.CSSProperties = { background: '#eef2f7', border: '1px dashed rgba(15,23,42,.16)', borderRadius: 12, padding: '8px 13px', fontSize: 13, color: '#55627a' };
const metaBase: React.CSSProperties = { fontSize: 10.5, color: '#94a3b8', marginTop: 3 };

const rowBaseCommon: React.CSSProperties = { display: 'flex', gap: 12, padding: '13px 14px', cursor: 'pointer', borderBottom: '1px solid rgba(15,23,42,.06)', transition: 'background .15s ease' };

export default function Inbox() {
  const [convos, setConvos] = useState<Conversation[]>(SEED);
  const [activeId, setActiveId] = useState('c1');
  const [agentOn, setAgentOn] = useState(true);
  const [input, setInput] = useState('');
  /* mobile-only (<lg): which pane is visible. Has zero effect at lg+ (both panes shown). */
  const [mobileView, setMobileView] = useState<'list' | 'thread'>('list');
  const threadRef = useRef<HTMLDivElement>(null);

  const active = convos.find((c) => c.id === activeId)!;
  const openCount = convos.filter((c) => c.unread > 0).length + 2;

  function selectConv(id: string) {
    setConvos((s) => s.map((c) => (c.id === id ? { ...c, unread: 0 } : c)));
    setActiveId(id);
    setMobileView('thread');
  }

  function onSend(e: FormEvent) {
    e.preventDefault();
    const q = input.trim();
    if (!q) return;
    setConvos((s) => s.map((c) => (c.id === activeId ? { ...c, msgs: [...c.msgs, { from: 'me', text: q, t: 'עכשיו' }] } : c)));
    setInput('');
    setTimeout(() => threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: 'smooth' }), 50);
  }

  const agentToggleStyle: React.CSSProperties = {
    cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 5,
    borderRadius: 999, padding: '5px 11px', fontSize: 12, fontWeight: 600,
    ...(agentOn
      ? { border: '1px solid #0e8ba0', background: 'rgba(14,139,160,.1)', color: '#0b7688' }
      : { border: '1px solid rgba(15,23,42,.16)', background: '#fff', color: '#55627a' }),
  };
  const agentToggleLabel = agentOn ? 'סוכן פעיל' : 'מענה ידני';
  const agentHint = agentOn ? 'הסוכן עונה אוטומטית · לחצו כדי להשתלט' : 'אתם עונים ידנית · לחצו להחזרת הסוכן';
  const agentState = agentOn ? active.agentState : 'ידני';

  return (
    <main style={{ maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ marginBottom: 22 }}>
        <div style={{ fontSize: 10, letterSpacing: '.25em', textTransform: 'uppercase', color: '#94a3b8', fontFamily: "'Space Grotesk',sans-serif" }}>Unified Inbox</div>
        <h1 className="text-[21px] lg:text-[26px]" style={{ margin: '4px 0 0', fontWeight: 600, letterSpacing: '-.01em' }}>אינבוקס</h1>
        <p style={{ margin: '7px 0 0', fontSize: 14.5, color: '#55627a', maxWidth: '44em', lineHeight: 1.55 }}>
          כל השיחות מכל הערוצים — וואטסאפ, אינסטגרם, פייסבוק ומייל — במקום אחד, עם חלוקה בין הסוכן לבין הצוות.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-4 h-[calc(100dvh-190px)] lg:h-[640px]">
        {/* conversation list — on <lg shown only in 'list' view; always shown at lg+ */}
        <div className={`glass-card flex-col ${mobileView === 'thread' ? 'hidden lg:flex' : 'flex'}`} style={{ overflow: 'hidden', padding: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(15,23,42,.08)', padding: '14px 16px' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 600 }}>
              <Ico inner={P.inbox} size={16} stroke="#0e8ba0" />
              שיחות פתוחות
            </span>
            <span className="tabular-nums" style={{ borderRadius: 999, background: '#f1f5f9', padding: '2px 9px', fontSize: 11.5, color: '#55627a' }}>{openCount}</span>
          </div>
          <div className="scrollbar-hide" style={{ flex: 1, overflowY: 'auto' }}>
            {convos.map((c) => {
              const sel = c.id === activeId;
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
                      <span style={{ fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                      <span style={{ marginInlineStart: 'auto', flex: 'none', fontSize: 11, color: '#94a3b8' }}>{c.time}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                      <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: '#55627a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.preview}</span>
                      {c.unread > 0 && (
                        <span className="tabular-nums" style={{ flex: 'none', minWidth: 18, height: 18, padding: '0 5px', borderRadius: 999, background: '#0e8ba0', color: '#fff', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{c.unread}</span>
                      )}
                    </div>
                    {c.byAgent && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 6, fontSize: 10.5, fontWeight: 600, color: '#0b7688', border: '1px solid rgba(14,139,160,.3)', background: 'rgba(14,139,160,.08)', borderRadius: 999, padding: '1px 7px' }}>
                        <span style={{ width: 5, height: 5, borderRadius: 999, background: '#0e8ba0' }} />מטופל ע״י סוכן
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* message pane — on <lg shown only in 'thread' view; always shown at lg+ */}
        <div className={`glass-card flex-col ${mobileView === 'list' ? 'hidden lg:flex' : 'flex'}`} style={{ overflow: 'hidden', padding: 0 }}>
          {/* thread header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid rgba(15,23,42,.08)', padding: '14px 18px' }}>
            <button
              type="button"
              onClick={() => setMobileView('list')}
              className="lg:hidden inline-flex items-center gap-1 min-h-[44px] px-2 -ms-2"
              style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 600, color: '#0b7688', flex: 'none' }}
            >
              <Ico inner={P.chevron} size={16} width={2} />
              חזרה
            </button>
            <span style={{ width: 40, height: 40, borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, color: '#fff', background: active.tint }}>{active.initials}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 600 }}>{active.name}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#55627a' }}>
                <span>{active.channel}</span><span style={{ color: '#cbd5e1' }}>·</span><span>{active.phone}</span>
              </div>
            </div>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, border: '1px solid rgba(18,128,92,.2)', background: 'rgba(18,128,92,.1)', color: '#12805c', borderRadius: 999, padding: '4px 11px', fontSize: 11.5, fontWeight: 600 }}>
              <span className="animate-pulse-dot" style={{ width: 6, height: 6, borderRadius: 999, background: '#12805c' }} />{agentState}
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

          {/* composer */}
          <div style={{ borderTop: '1px solid rgba(15,23,42,.08)', padding: '12px 16px', background: '#fff' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 9 }}>
              <button type="button" onClick={() => setAgentOn((v) => !v)} style={agentToggleStyle}>
                <Ico inner={P.sparkles} size={13} width={1.6} />
                {agentToggleLabel}
              </button>
              <span style={{ fontSize: 11.5, color: '#94a3b8' }}>{agentHint}</span>
            </div>
            <form onSubmit={onSend} style={{ display: 'flex', alignItems: 'center', gap: 8, border: '1px solid rgba(15,23,42,.16)', background: '#fff', borderRadius: 14, padding: '9px 12px' }}>
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="כתבו הודעה…"
                className="text-[16px] lg:text-[14px]"
                style={{ flex: 1, minWidth: 0, border: 'none', background: 'transparent', outline: 'none', fontFamily: 'inherit', color: '#0f172a' }}
              />
              <button type="submit" aria-label="שליחה" className="min-h-11 min-w-11 lg:min-h-0 lg:min-w-0 items-center justify-center" style={{ border: 'none', borderRadius: 10, background: '#0e8ba0', padding: 9, cursor: 'pointer', display: 'flex' }}>
                <Ico inner={P.send} size={15} stroke="#fff" width={1.8} />
              </button>
            </form>
          </div>
        </div>
      </div>
    </main>
  );
}
