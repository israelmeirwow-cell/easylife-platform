import { useEffect, useMemo, useRef, useState, type FormEvent, type DragEvent } from 'react';
import { useReducedMotion } from 'framer-motion';

/* Dashboard / סקירה — ported 1:1 from the NEW Claude Design handoff
   (docs/claude-design/v2/Dashboard.dc.html). Layout, copy, mock data, tint
   colors, the drag-and-drop kanban pipeline, revenue crosshair chart, monthly
   goal ring + funnel, live feed, assistant chat, tasks, top customers, activity
   heatmap, notification center + deal drawer + toast, count-up and feed-in are
   all verbatim from the design. Colors are the design's literal values. The
   responsive @media system (r-* classes + breakpoints 960/760/520) is injected
   verbatim so mobile behaviour matches the design 1:1. The app <Layout> renders
   the top nav/app chrome, so only the page <main> + fixed overlays live here. */

/* ---------- inline heroicon helper (exact paths from the design) ---------- */
function Ico({ inner, size = 16, className, color, strokeWidth = 1.7 }: { inner: string; size?: number; className?: string; color?: string; strokeWidth?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke={color ?? 'currentColor'}
      strokeWidth={strokeWidth}
      width={size}
      height={size}
      className={className}
      dangerouslySetInnerHTML={{ __html: inner }}
    />
  );
}
const path = (d: string) => `<path stroke-linecap="round" stroke-linejoin="round" d="${d}"/>`;

/* ---------- responsive system (verbatim from the design's <style>) ---------- */
const RESPONSIVE_CSS = `
@media (max-width:960px){ .r-main{padding-inline:18px !important;} .r-4{grid-template-columns:repeat(2,1fr) !important;} .r-32{grid-template-columns:1fr !important;} }
@media (max-width:760px){ .r-2{grid-template-columns:1fr !important;} .r-3{grid-template-columns:1fr !important;} .r-main{padding-inline:14px !important;} .r-kanban{grid-template-columns:repeat(2,minmax(220px,1fr)) !important;} }
@media (max-width:520px){ .r-4{grid-template-columns:1fr !important;} .r-kanban{grid-template-columns:1fr !important;} }
.dash-kcard { cursor:grab; transition:transform .12s ease, box-shadow .12s ease; }
.dash-kcard:hover { transform:translateY(-2px); box-shadow:0 6px 16px rgba(15,23,42,.12); }
.dash-kcard:active { cursor:grabbing; }
.dash-kcol.drag-over { background:rgba(14,139,160,.08) !important; outline:2px dashed rgba(14,139,160,.4); }
@keyframes dash-drawer-in { from { transform:translateX(-100%); } to { transform:translateX(0); } }
@keyframes dash-fade { from { opacity:0; } to { opacity:1; } }
`;

/* ---------- types ---------- */
type StageKey = 'lead' | 'qualified' | 'proposal' | 'negotiation';
interface TimelineItem { icon: string; title: string; text: string; time: string }
interface FileItem { name: string; meta: string }
interface NoteItem { text: string; time: string }
interface Deal {
  id: number; stage: StageKey; account: string; title: string; value: number; owner: string; tint: string;
  contact: { name: string; role: string; phone: string; email: string };
  timeline: TimelineItem[]; files: FileItem[]; notes: NoteItem[];
}
interface Notif { id: number; kind: 'won' | 'approval' | 'lead' | 'msg' | 'pay'; title: string; text: string; time: string; unread: boolean }
interface Task { id: number; label: string; time: string; done: boolean }
interface ChatMsg { role: 'assistant' | 'user'; text: string }
type Period = 'today' | 'week' | 'month';

/* ---------- stage meta ---------- */
const STAGE_META: { key: StageKey; label: string; tint: string }[] = [
  { key: 'lead', label: 'ליד', tint: '#0e8ba0' },
  { key: 'qualified', label: 'מוכשר', tint: '#1666a8' },
  { key: 'proposal', label: 'הצעה', tint: '#b26a00' },
  { key: 'negotiation', label: 'משא ומתן', tint: '#0f172a' },
];

/* ---------- seed data (verbatim from the design's DCLogic) ---------- */
function seedDeals(): Deal[] {
  return [
    { id: 1, stage: 'lead', account: 'סטודיו מיכל', title: 'שדרוג אתר תדמית', value: 18000, owner: 'עד', tint: '#0e8ba0',
      contact: { name: 'מיכל ברק', role: 'מעצבת ראשית', phone: '054-321-9988', email: 'michal@studio.co.il' },
      timeline: [{ icon: '🎯', title: 'ליד נוצר', text: 'הגיע מטופס באתר', time: 'לפני יומיים' }, { icon: '💬', title: 'סוכן וואטסאפ פנה', text: 'שלח הצעת פגישה', time: 'אתמול' }, { icon: '📄', title: 'עסקה נוצרה', text: 'שווי ₪18K', time: 'היום' }],
      files: [{ name: 'בריף עיצוב.pdf', meta: '240KB · היום' }], notes: [{ text: 'מעדיפה פגישות בימי ג׳', time: 'אתמול' }] },
    { id: 2, stage: 'lead', account: 'מוסך דהן', title: 'קמפיין לידים', value: 9000, owner: 'רכ', tint: '#0e8ba0',
      contact: { name: 'יוסי דהן', role: 'בעלים', phone: '052-998-7766', email: 'yossi@dahan.co.il' },
      timeline: [{ icon: '🎯', title: 'ליד נוצר', text: 'פנייה מפייסבוק', time: 'לפני 3 ימים' }, { icon: '💰', title: 'תקציב אושר', text: '₪9K לקמפיין', time: 'אתמול' }],
      files: [], notes: [] },
    { id: 3, stage: 'qualified', account: 'קליניקת נועה', title: 'חבילת סוכנים שנתית', value: 42000, owner: 'נל', tint: '#1666a8',
      contact: { name: 'נועה לוי', role: 'מנהלת', phone: '050-123-4567', email: 'noa@clinic.co.il' },
      timeline: [{ icon: '🎯', title: 'ליד נוצר', text: 'המלצה מלקוח', time: 'לפני שבוע' }, { icon: '📞', title: 'שיחת אפיון', text: '25 דק׳', time: 'לפני 4 ימים' }, { icon: '📄', title: 'הצעה בהכנה', text: 'חבילה שנתית', time: 'היום' }],
      files: [{ name: 'הצעת מחיר.pdf', meta: '180KB · היום' }], notes: [{ text: 'רוצה התחלה בתחילת החודש', time: 'לפני 4 ימים' }] },
    { id: 4, stage: 'qualified', account: 'בית קפה עלית', title: 'ניהול סושיאל', value: 12000, owner: 'עד', tint: '#1666a8',
      contact: { name: 'אבי מזרחי', role: 'מנהל', phone: '050-777-2211', email: 'avi@elite.co.il' },
      timeline: [{ icon: '🎯', title: 'ליד נוצר', text: 'אינסטגרם', time: 'לפני 5 ימים' }, { icon: '💬', title: 'תיאום ציפיות', text: 'וואטסאפ', time: 'לפני יומיים' }],
      files: [], notes: [] },
    { id: 5, stage: 'proposal', account: 'רשת אופנה URBAN', title: 'אוטומציית וואטסאפ', value: 64000, owner: 'רכ', tint: '#b26a00',
      contact: { name: 'דנה כהן', role: 'רכש', phone: '03-555-1234', email: 'dana@urban.co.il' },
      timeline: [{ icon: '🎯', title: 'ליד נוצר', text: 'תערוכה', time: 'לפני שבועיים' }, { icon: '📄', title: 'הצעה נשלחה', text: '₪64K', time: 'לפני 3 ימים' }, { icon: '👀', title: 'ההצעה נצפתה', text: 'הלקוח פתח פעמיים', time: 'אתמול' }],
      files: [{ name: 'הצעה URBAN.pdf', meta: '320KB · לפני 3 ימים' }], notes: [{ text: 'לעקוב אחרי אם אין תשובה עד יום ה׳', time: 'אתמול' }] },
    { id: 6, stage: 'negotiation', account: 'חברת שיפוצים', title: 'חבילת פרו + API', value: 84000, owner: 'עד', tint: '#0f172a',
      contact: { name: 'רון אבני', role: 'מנכ״ל', phone: '050-444-1212', email: 'ron@shipputzim.co.il' },
      timeline: [{ icon: '🎯', title: 'ליד נוצר', text: 'גוגל', time: 'לפני 3 שבועות' }, { icon: '📄', title: 'הצעה נשלחה', text: '₪84K', time: 'לפני שבוע' }, { icon: '🤝', title: 'משא ומתן', text: 'בקשה להנחה 8%', time: 'אתמול' }],
      files: [{ name: 'חוזה טיוטה.pdf', meta: '410KB · אתמול' }], notes: [{ text: 'מוכן לסגור אם ניתן 5% הנחה', time: 'אתמול' }] },
    { id: 7, stage: 'negotiation', account: 'סוכנות נדל״ן', title: 'סוכן לידים + דוחות', value: 38000, owner: 'נל', tint: '#0f172a',
      contact: { name: 'שירה גל', role: 'שותפה', phone: '052-321-4455', email: 'shira@realestate.co.il' },
      timeline: [{ icon: '🎯', title: 'ליד נוצר', text: 'לינקדאין', time: 'לפני חודש' }, { icon: '📄', title: 'הצעה נשלחה', text: '₪38K', time: 'לפני 10 ימים' }],
      files: [], notes: [] },
  ];
}

function seedNotifs(): Notif[] {
  return [
    { id: 1, kind: 'won', title: 'עסקה נסגרה בזכייה 🏆', text: 'חברת שיפוצים · ₪84,000', time: 'לפני 4 דק׳', unread: true },
    { id: 2, kind: 'approval', title: 'סוכן מבקש אישור', text: 'שליחת הצעת מחיר לקליניקת נועה', time: 'לפני 12 דק׳', unread: true },
    { id: 3, kind: 'lead', title: 'ליד חדש מאינסטגרם', text: 'מעוניין בחבילת וידאו', time: 'לפני 23 דק׳', unread: true },
    { id: 4, kind: 'msg', title: 'הודעה ללא מענה', text: 'מוסך דהן ממתין לתשובה', time: 'לפני שעה', unread: false },
    { id: 5, kind: 'pay', title: 'תשלום התקבל', text: 'קליניקת נועה · ₪349', time: 'לפני שעתיים', unread: false },
  ];
}

function seedTasks(): Task[] {
  return [
    { id: 1, label: 'להתקשר לחברת שיפוצים על ההנחה', time: '10:30', done: false },
    { id: 2, label: 'לאשר הצעת מחיר לקליניקת נועה', time: '12:00', done: false },
    { id: 3, label: 'לעקוב אחרי רשת אופנה URBAN', time: '15:00', done: false },
    { id: 4, label: 'לאשר 3 בקשות סוכנים', time: '16:30', done: true },
  ];
}

/* ---------- icon paths ---------- */
const KPI_ICONS = {
  pipeline: 'M2.25 18 9 11.25l4.306 4.307a11.95 11.95 0 0 1 5.814-5.518l2.74-1.22m0 0-5.94-2.28m5.94 2.28-2.28 5.941',
  closed: 'M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  leads: 'M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Z',
  rate: 'M9 14.25l6-6m4.5-3.493V21a.75.75 0 0 1-.75.75H5.25A.75.75 0 0 1 4.5 21V4.757c0-.414.336-.75.75-.75h13.5a.75.75 0 0 1 .75.75Z',
};
const ATT_ICONS = {
  approval: 'M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z',
  msg: 'M8.625 9.75a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z',
  cooling: 'M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
};
const ACT_ICONS = {
  message: 'M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5',
  meeting: 'M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5',
  close: 'M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
};
const NOTIF_META: Record<Notif['kind'], { tint: string; color: string; icon: string }> = {
  won: { tint: 'rgba(18,128,92,.1)', color: '#12805c', icon: 'M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z' },
  approval: { tint: 'rgba(178,106,0,.1)', color: '#b26a00', icon: ATT_ICONS.approval },
  lead: { tint: 'rgba(14,139,160,.1)', color: '#0e8ba0', icon: 'M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Z' },
  msg: { tint: 'rgba(124,108,240,.12)', color: '#7c6cf0', icon: 'M8.625 9.75a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm7.5 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0ZM21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z' },
  pay: { tint: 'rgba(14,116,144,.1)', color: '#0e7490', icon: 'M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Z' },
};

/* ---------- helpers ---------- */
const money = (n: number) => '₪ ' + n.toLocaleString('he-IL');
const moneyK = (n: number) => '₪ ' + (n / 1000).toLocaleString('he-IL', { maximumFractionDigits: 0 }) + 'K';
const av = (t: string) => `linear-gradient(135deg, ${t}, #22b8cf)`;

function greetingText(): string {
  const h = new Date().getHours();
  if (h < 5) return 'לילה טוב';
  if (h < 12) return 'בוקר טוב';
  if (h < 18) return 'צהריים טובים';
  return 'ערב טוב';
}

/* period-driven data */
const KPI_DATA: Record<Period, { closed: number; closedD: string; leads: number; rate: number }> = {
  today: { closed: 8200, closedD: '+6%', leads: 5, rate: 30 },
  week: { closed: 34000, closedD: '+9%', leads: 23, rate: 32 },
  month: { closed: 128000, closedD: '+12.5%', leads: 94, rate: 34 },
};
const REV_SERIES: Record<Period, number[]> = {
  today: [2, 3, 2.5, 4, 3.5, 5, 4.5, 6, 5.5, 7, 6, 8.2],
  week: [18, 22, 20, 26, 24, 30, 34],
  month: [52, 58, 55, 64, 68, 74, 82, 90, 86, 94, 102, 128],
};
const REV_LABELS: Record<Period, string[]> = {
  today: ['08:00', '12:00', '16:00', '20:00'],
  week: ['א׳', 'ג׳', 'ה׳', 'ש׳'],
  month: ['שבוע 1', 'שבוע 2', 'שבוע 3', 'שבוע 4'],
};

/* chart geometry (verbatim from _chart) */
function buildChart(series: number[]) {
  const W = 800, H = 220, pad = 12, n = series.length;
  const max = Math.max(...series), min = Math.min(...series);
  const lo = Math.floor((min - max * 0.1) / 1) * 1, hi = Math.ceil(max * 1.05);
  const yFor = (v: number) => pad + (H - 2 * pad) * (1 - (v - lo) / (hi - lo));
  const stepX = W / (n - 1);
  const points = series.map((v, i) => ({ x: i * stepX, y: yFor(v) }));
  const line = points.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const area = `${line} L${W},${H} L0,${H} Z`;
  const grid: { y: string; top: string; label: string }[] = [];
  for (let k = 0; k <= 3; k++) { const v = lo + (hi - lo) * k / 3; const y = yFor(v); grid.push({ y: y.toFixed(1), top: (y / H * 100).toFixed(2) + '%', label: '₪' + Math.round(v) + 'K' }); }
  return { points, line, area, grid, W, H };
}

/* ---------- count-up (used for KPIs) ---------- */
function CountUp({ to, suffix = '', dur = 900, deps = [] as unknown[] }: { to: number; suffix?: string; dur?: number; deps?: unknown[] }) {
  const [val, setVal] = useState(0);
  const reduce = useReducedMotion();
  useEffect(() => {
    if (reduce) { setVal(to); return; }
    const start = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / dur);
      const e = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(to * e));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [to, reduce, ...deps]);
  return <>{val.toLocaleString('he-IL')}{suffix}</>;
}

/* ================================================================= */
export default function Dashboard() {
  const [period, setPeriod] = useState<Period>('month');
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMsg[]>([
    { role: 'assistant', text: 'בוקר טוב ישראל 👋 יש לך 3 עסקאות במשא ומתן בשווי ₪84K שכדאי לדחוף היום. סוכן הלידים הכניס 12 לידים חדשים מאז אתמול.' },
  ]);
  const [deals, setDeals] = useState<Deal[]>(seedDeals);
  const [notifs, setNotifs] = useState<Notif[]>(seedNotifs);
  const [tasks, setTasks] = useState<Task[]>(seedTasks);
  const [notifOpen, setNotifOpen] = useState(false);
  const [dealId, setDealId] = useState<number | null>(null);
  const [noteInput, setNoteInput] = useState('');
  const [revHover, setRevHover] = useState<number | null>(null);
  const [toast, setToast] = useState('');

  const chatRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<HTMLDivElement>(null);
  const dragId = useRef<number | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>();

  /* ----- period switch resets hover ----- */
  const setPeriodTab = (p: Period) => { setPeriod(p); setRevHover(null); };

  /* ----- toast ----- */
  const showToast = (msg: string) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 2600);
  };
  useEffect(() => () => clearTimeout(toastTimer.current), []);

  /* ----- deal move (drag + drawer select) ----- */
  const moveDeal = (id: number | null, stage: StageKey) => {
    if (id == null) return;
    setDeals((arr) => arr.map((d) => (d.id === id ? { ...d, stage } : d)));
  };

  /* ----- chat send ----- */
  function onSend(e: FormEvent) {
    e.preventDefault();
    const q = input.trim();
    if (!q) return;
    const reply = 'שאלה טובה. לפי המצב הנוכחי הייתי מתמקד בעסקאות במשא ומתן — יש שם ₪122K שקרובים לסגירה. רוצה שאכין סיכום לכל אחת?';
    setInput('');
    setMessages((s) => [...s, { role: 'user', text: q }, { role: 'assistant', text: reply }]);
    setTimeout(() => chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: 'smooth' }), 60);
  }

  /* ----- derived KPIs ----- */
  const periodLabel = { today: 'היום', week: 'השבוע', month: 'החודש' }[period];
  const kpiData = KPI_DATA[period];
  const kpis = [
    { label: 'שווי צינור מכירות', prefix: '₪ ', value: 342000, suffix: '', delta: '', icon: KPI_ICONS.pipeline },
    { label: 'נסגר ' + periodLabel, prefix: '₪ ', value: kpiData.closed, suffix: '', delta: kpiData.closedD, icon: KPI_ICONS.closed },
    { label: 'לידים חדשים', prefix: '', value: kpiData.leads, suffix: '', delta: '▲', icon: KPI_ICONS.leads },
    { label: 'אחוז סגירה', prefix: '', value: kpiData.rate, suffix: '%', delta: '', icon: KPI_ICONS.rate },
  ];

  /* ----- attention ----- */
  const attention = [
    { count: notifs.filter((n) => n.kind === 'approval').length + 2, title: 'אישורי סוכנים', sub: 'ממתינים לאישור שלך', href: '/agents', color: '#b26a00', tint: 'rgba(178,106,0,.1)', icon: ATT_ICONS.approval },
    { count: 5, title: 'הודעות ללא מענה', sub: 'לקוחות שמחכים לתשובה', href: '/inbox', color: '#0e8ba0', tint: 'rgba(14,139,160,.1)', icon: ATT_ICONS.msg },
    { count: 2, title: 'עסקאות מתקררות', sub: 'ללא פעילות מעל 7 ימים', href: '/crm', color: '#d1453b', tint: 'rgba(209,69,59,.09)', icon: ATT_ICONS.cooling },
  ];
  const attentionTotal = attention.reduce((s, a) => s + a.count, 0);

  /* ----- kanban ----- */
  const stagesView = STAGE_META.map((sm) => {
    const list = deals.filter((d) => d.stage === sm.key);
    const sum = list.reduce((a, d) => a + d.value, 0);
    return { ...sm, count: list.length, sumLabel: sum ? moneyK(sum) : '₪0', deals: list };
  });
  const pipelineTotal = moneyK(deals.reduce((a, d) => a + d.value, 0));

  const onColDragOver = (e: DragEvent<HTMLDivElement>) => { e.preventDefault(); e.currentTarget.classList.add('drag-over'); };
  const onColDragLeave = (e: DragEvent<HTMLDivElement>) => { e.currentTarget.classList.remove('drag-over'); };
  const onColDrop = (stage: StageKey) => (e: DragEvent<HTMLDivElement>) => { e.preventDefault(); e.currentTarget.classList.remove('drag-over'); moveDeal(dragId.current, stage); dragId.current = null; };

  /* ----- revenue chart ----- */
  const revSeries = REV_SERIES[period];
  const revLabels = REV_LABELS[period];
  const rev = useMemo(() => buildChart(revSeries), [revSeries]);
  const revActive = revHover != null;
  const ri = revActive ? Math.max(0, Math.min(revSeries.length - 1, revHover!)) : revSeries.length - 1;
  const rpt = rev.points[ri];
  const revValLabel = (v: number) => '₪ ' + Math.round(v * 1000).toLocaleString('he-IL');
  const onChartMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!chartRef.current) return;
    const r = chartRef.current.getBoundingClientRect();
    let i = Math.round((e.clientX - r.left) / r.width * (revSeries.length - 1));
    i = Math.max(0, Math.min(revSeries.length - 1, i));
    if (i !== revHover) setRevHover(i);
  };

  /* ----- goal ----- */
  const goalTargetN = 180000, goalCurrentN = 128000;
  const goalPct = Math.round(goalCurrentN / goalTargetN * 100);
  const R = 52, C = 2 * Math.PI * R;
  const funnel = [
    { label: 'לידים', value: '94', pct: '100%', color: '#0e8ba0' },
    { label: 'מוכשרים', value: '41', pct: '44%', color: '#1666a8' },
    { label: 'הצעות', value: '22', pct: '23%', color: '#b26a00' },
    { label: 'נסגרו', value: '12', pct: '13%', color: '#12805c' },
  ];

  /* ----- feed ----- */
  const feed = [
    { icon: '🏆', label: 'עסקה נסגרה בזכייה', time: 'לפני 4 דק׳', text: 'חברת שיפוצים · חבילת פרו — ₪84,000' },
    { icon: '💬', label: 'הודעה נכנסת', time: 'לפני 11 דק׳', text: 'סוכן וואטסאפ ענה ללקוח על שעות פעילות' },
    { icon: '🎯', label: 'ליד חדש', time: 'לפני 23 דק׳', text: 'ליד מאינסטגרם — מעוניין בחבילת וידאו' },
    { icon: '💰', label: 'תשלום התקבל', time: 'לפני 38 דק׳', text: 'קליניקת נועה — מנוי חודשי ₪349' },
    { icon: '🧠', label: 'זיכרון נשמר', time: 'לפני 52 דק׳', text: 'המוח למד: הרשת מעדיפה פגישות בימי ג׳' },
    { icon: '📄', label: 'עסקה נוצרה', time: 'לפני שעה', text: 'רשת אופנה · אוטומציית וואטסאפ — ₪64K' },
  ];

  /* ----- assistant bubble ----- */
  const bubble = (role: ChatMsg['role']): React.CSSProperties =>
    role === 'user'
      ? { maxWidth: '88%', marginInlineStart: 'auto', border: '1px solid rgba(15,23,42,.08)', background: '#f1f5f9', borderRadius: 16, padding: '10px 14px', fontSize: 13.5, lineHeight: 1.55, color: '#0f172a' }
      : { maxWidth: '88%', marginInlineEnd: 'auto', border: '1px solid rgba(15,23,42,.16)', background: 'rgba(14,139,160,.1)', borderRadius: 16, padding: '10px 14px', fontSize: 13.5, lineHeight: 1.55, color: '#0f172a', boxShadow: 'inset 0 1px 0 rgba(255,255,255,.6)' };

  /* ----- tasks ----- */
  const tasksLeft = tasks.filter((t) => !t.done).length;
  const toggleTask = (id: number) => setTasks((arr) => arr.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));

  /* ----- top customers ----- */
  const topCustomers = [
    { name: 'רשת אופנה URBAN', value: '₪ 64K', initials: 'רא', tint: '#0e8ba0', pct: '100%' },
    { name: 'חברת שיפוצים', value: '₪ 84K', initials: 'חש', tint: '#1666a8', pct: '92%' },
    { name: 'קליניקת נועה', value: '₪ 42K', initials: 'קנ', tint: '#12805c', pct: '58%' },
    { name: 'סוכנות נדל״ן', value: '₪ 38K', initials: 'סנ', tint: '#b26a00', pct: '48%' },
  ];

  /* ----- heatmap ----- */
  const days = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];
  const heatColor = (v: number) => (v === 0 ? '#eef2f7' : v === 1 ? 'rgba(14,139,160,.35)' : v === 2 ? 'rgba(14,139,160,.65)' : '#0e8ba0');
  const heatRows = days.map((d, r) => ({
    label: d,
    cells: Array.from({ length: 12 }, (_, c) => { const v = r === 5 || r === 6 ? (c % 3 === 0 ? 1 : 0) : (r * 7 + c * 3) % 4; return { color: heatColor(v), title: `${v * 4} אירועים` }; }),
  }));

  /* ----- notifications ----- */
  const markNotifRead = (id: number) => setNotifs((arr) => arr.map((x) => (x.id === id ? { ...x, unread: false } : x)));
  const markAllRead = () => setNotifs((arr) => arr.map((x) => ({ ...x, unread: false })));

  /* ----- deal drawer ----- */
  const openDealData = dealId != null ? deals.find((d) => d.id === dealId) ?? deals[0] : null;
  const closeDeal = () => { setDealId(null); setNoteInput(''); };
  const dealInitials = (account: string) => account.replace(/[״׳]/g, '').split(' ').slice(0, 2).map((w) => w[0]).join('');
  const addNote = (e: FormEvent) => {
    e.preventDefault();
    const v = noteInput.trim();
    if (!v || openDealData == null) return;
    setDeals((arr) => arr.map((x) => (x.id === openDealData.id ? { ...x, notes: [{ text: v, time: 'עכשיו' }, ...x.notes] } : x)));
    setNoteInput('');
  };
  const dealActions = openDealData
    ? [
        { label: 'שלח הודעה', icon: ACT_ICONS.message, onClick: () => showToast('נפתחה שיחה עם ' + openDealData.contact.name) },
        { label: 'קבע פגישה', icon: ACT_ICONS.meeting, onClick: () => showToast('פגישה נוספה ליומן') },
        { label: 'סגור עסקה', icon: ACT_ICONS.close, onClick: () => { moveDeal(openDealData.id, 'negotiation'); showToast('כל הכבוד! מסמן את ' + openDealData.title + ' לקראת סגירה'); } },
      ]
    : [];

  const label10: React.CSSProperties = { fontSize: 10, letterSpacing: '.25em', color: '#94a3b8', textTransform: 'uppercase' };
  const sectionLabel: React.CSSProperties = { fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: '#94a3b8', marginBottom: 10 };

  return (
    <div dir="rtl" lang="he">
      <style dangerouslySetInnerHTML={{ __html: RESPONSIVE_CSS }} />

      <main className="r-main" style={{ maxWidth: 1400, margin: '0 auto', padding: '4px 0 8px' }}>
        {/* greeting + period */}
        <div style={{ marginBottom: 22, display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, letterSpacing: '-.01em', color: '#0f172a' }}>{greetingText()}, ישראל</h1>
            <p style={{ margin: '6px 0 0', fontSize: 14, color: '#55627a' }}>הנה מה שקורה בעסק שלך {periodLabel} — כל הסוכנים מחוברים למוח אחד.</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 3, background: '#eef2f7', borderRadius: 11, padding: 4 }}>
              {(['today', 'week', 'month'] as Period[]).map((k) => {
                const on = period === k;
                const l = { today: 'היום', week: 'השבוע', month: 'החודש' }[k];
                return (
                  <button key={k} onClick={() => setPeriodTab(k)} style={{ cursor: 'pointer', fontFamily: 'inherit', border: 'none', borderRadius: 9, padding: '6px 14px', fontSize: 13, background: on ? '#fff' : 'transparent', color: on ? '#0f172a' : '#55627a', fontWeight: on ? 600 : 400, boxShadow: on ? '0 1px 2px rgba(15,23,42,.08)' : 'none' }}>{l}</button>
                );
              })}
            </div>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8, border: '1px solid rgba(15,23,42,.08)', background: '#fff', borderRadius: 999, padding: '7px 14px', fontSize: 12.5, boxShadow: '0 1px 2px rgba(15,23,42,.04)' }}>
              <span className="animate-pulse-dot" style={{ width: 8, height: 8, borderRadius: 999, background: '#12805c' }} />
              <span style={{ color: '#55627a' }}>מוח מרכזי</span>
              <span style={{ fontWeight: 600, color: '#12805c' }}>מחובר</span>
            </span>
          </div>
        </div>

        {/* KPI row */}
        <div className="r-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 }}>
          {kpis.map((k) => (
            <div key={k.label} className="glass-card" style={{ padding: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: '#55627a' }}>
                  <span style={{ color: '#0e8ba0' }}><Ico inner={path(k.icon)} size={15} /></span>{k.label}
                </div>
                {k.delta && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, fontSize: 11, fontWeight: 600, color: '#12805c' }}>{k.delta}</span>}
              </div>
              <div className="tabular-nums" style={{ marginTop: 10, fontSize: 28, fontWeight: 600, letterSpacing: '-.01em', color: '#0f172a' }}>
                {k.prefix && <span style={{ fontSize: 15, color: '#55627a', marginInlineEnd: 2 }}>{k.prefix}</span>}
                <CountUp to={k.value} suffix={k.suffix} deps={[period]} />
              </div>
            </div>
          ))}
        </div>

        {/* needs attention */}
        <div style={{ marginTop: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={label10}>דורש את תשומת לבך</div>
            <span style={{ fontSize: 11.5, color: '#94a3b8' }}>{attentionTotal} פריטים</span>
          </div>
          <div className="r-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14 }}>
            {attention.map((a) => (
              <a key={a.title} href={a.href} className="glass-card" style={{ display: 'block', padding: 18, borderInlineStart: `3px solid ${a.color}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ flex: 'none', width: 38, height: 38, borderRadius: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', background: a.tint, color: a.color }}><Ico inner={path(a.icon)} size={18} /></span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                      <span className="tabular-nums" style={{ fontSize: 22, fontWeight: 600, color: '#0f172a' }}>{a.count}</span>
                      <span style={{ fontSize: 13.5, fontWeight: 600, color: '#0f172a' }}>{a.title}</span>
                    </div>
                    <div style={{ fontSize: 12, color: '#55627a', marginTop: 1 }}>{a.sub}</div>
                  </div>
                  <span style={{ flex: 'none', color: '#94a3b8' }}><Ico inner={path('M15.75 19.5 8.25 12l7.5-7.5')} size={15} className="" /></span>
                </div>
              </a>
            ))}
          </div>
        </div>

        {/* pipeline kanban */}
        <div className="glass-card" style={{ marginTop: 24, padding: 22 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, marginBottom: 18 }}>
            <div>
              <div style={label10}>צינור מכירות</div>
              <div style={{ marginTop: 4, fontSize: 18, fontWeight: 600, fontFamily: "'Space Grotesk',sans-serif" }}>גררו עסקאות בין שלבים · <span className="text-gradient">{pipelineTotal}</span></div>
            </div>
            <span style={{ border: '1px solid rgba(15,23,42,.16)', background: 'rgba(14,139,160,.1)', color: '#0b7688', borderRadius: 999, padding: '4px 11px', fontSize: 11, fontWeight: 600 }}>חי</span>
          </div>
          <div className="r-kanban" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, alignItems: 'start' }}>
            {stagesView.map((col) => (
              <div key={col.key} className="dash-kcol" onDragOver={onColDragOver} onDragLeave={onColDragLeave} onDrop={onColDrop(col.key)}
                style={{ borderRadius: 14, background: '#f8fafc', border: '1px solid rgba(15,23,42,.06)', padding: 12, minHeight: 120, transition: 'background .15s ease' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, padding: '0 2px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <span style={{ width: 8, height: 8, borderRadius: 999, background: col.tint }} />
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{col.label}</span>
                  </div>
                  <span className="tabular-nums" style={{ fontSize: 11, color: '#94a3b8' }}>{col.count} · {col.sumLabel}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {col.deals.map((d) => (
                    <div key={d.id} className="dash-kcard" draggable
                      onDragStart={() => { dragId.current = d.id; }}
                      onDragEnd={() => { dragId.current = null; }}
                      onClick={() => setDealId(d.id)}
                      style={{ background: '#fff', border: '1px solid rgba(15,23,42,.08)', borderTop: `2px solid ${col.tint}`, borderRadius: 11, padding: 12 }}>
                      <div style={{ fontSize: 9.5, letterSpacing: '.12em', textTransform: 'uppercase', color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.account}</div>
                      <div style={{ marginTop: 3, fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.title}</div>
                      <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span className="tabular-nums" style={{ fontSize: 13, fontWeight: 600, color: '#0b7688' }}>{moneyK(d.value)}</span>
                        <span style={{ width: 24, height: 24, borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 600, color: '#fff', background: av(col.tint) }}>{d.owner}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* revenue chart + goal */}
        <div className="r-32" style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, alignItems: 'stretch' }}>
          <div className="glass-card" style={{ padding: 22 }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 8 }}>
              <div>
                <div style={label10}>הכנסות</div>
                <div className="tabular-nums" style={{ marginTop: 4, fontSize: 18, fontWeight: 600, fontFamily: "'Space Grotesk',sans-serif" }}>{revValLabel(revSeries[revSeries.length - 1])}</div>
              </div>
              <div style={{ fontSize: 12, color: '#94a3b8' }}>{periodLabel}</div>
            </div>
            <div ref={chartRef} onMouseMove={onChartMove} onMouseLeave={() => setRevHover(null)} style={{ position: 'relative', cursor: 'crosshair' }}>
              <svg viewBox="0 0 800 220" style={{ width: '100%', display: 'block' }}>
                <defs><linearGradient id="rev-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#0e8ba0" stopOpacity="0.24" /><stop offset="100%" stopColor="#0e8ba0" stopOpacity="0" /></linearGradient></defs>
                {rev.grid.map((g, i) => <line key={i} x1="0" y1={g.y} x2="800" y2={g.y} stroke="rgba(15,23,42,.07)" strokeWidth="1" />)}
                <path d={rev.area} fill="url(#rev-fill)" />
                <path d={rev.line} fill="none" stroke="#0e8ba0" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
                {revActive && <line x1={rpt.x.toFixed(1)} y1="6" x2={rpt.x.toFixed(1)} y2="206" stroke="#0e8ba0" strokeWidth="1.1" strokeDasharray="4 4" />}
              </svg>
              {rev.grid.map((g, i) => (
                <span key={i} className="tabular-nums" style={{ position: 'absolute', top: g.top, insetInlineEnd: 2, transform: 'translateY(-50%)', fontSize: 10, color: '#94a3b8', background: 'rgba(255,255,255,.85)', padding: '0 4px', borderRadius: 4 }}>{g.label}</span>
              ))}
              {revActive && (
                <>
                  <span style={{ position: 'absolute', left: (rpt.x / rev.W * 100).toFixed(2) + '%', top: (rpt.y / rev.H * 100).toFixed(2) + '%', transform: 'translate(-50%,-50%)', width: 11, height: 11, borderRadius: 999, background: '#0e8ba0', border: '2.5px solid #fff', boxShadow: '0 1px 5px rgba(14,139,160,.5)', pointerEvents: 'none' }} />
                  <div className="tabular-nums" style={{ position: 'absolute', left: (rpt.x / rev.W * 100).toFixed(2) + '%', top: (rpt.y / rev.H * 100).toFixed(2) + '%', transform: 'translate(-50%,calc(-100% - 14px))', background: '#0f172a', color: '#fff', borderRadius: 9, padding: '6px 11px', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', pointerEvents: 'none' }}>{revValLabel(revSeries[ri])}</div>
                </>
              )}
            </div>
            <div dir="ltr" style={{ display: 'flex', justifyContent: 'space-between', padding: '0 4px', marginTop: 8, fontSize: 11, color: '#94a3b8' }}>
              {revLabels.map((x, i) => <span key={i}>{x}</span>)}
            </div>
          </div>
          <div className="glass-card" style={{ padding: 22, display: 'flex', flexDirection: 'column' }}>
            <div style={label10}>יעד חודשי</div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '14px 0 6px' }}>
              <div style={{ position: 'relative', width: 150, height: 150 }}>
                <svg viewBox="0 0 120 120" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
                  <circle cx="60" cy="60" r="52" fill="none" stroke="#eef2f7" strokeWidth="12" />
                  <circle cx="60" cy="60" r="52" fill="none" stroke="#0e8ba0" strokeWidth="12" strokeLinecap="round" strokeDasharray={C.toFixed(1)} strokeDashoffset={(C * (1 - goalCurrentN / goalTargetN)).toFixed(1)} style={{ transition: 'stroke-dashoffset 1s cubic-bezier(.22,1,.36,1)' }} />
                </svg>
                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                  <div className="tabular-nums" style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 30, fontWeight: 600, color: '#0f172a' }}>{goalPct}%</div>
                  <div style={{ fontSize: 11, color: '#94a3b8' }}>מהיעד</div>
                </div>
              </div>
            </div>
            <div style={{ textAlign: 'center', fontSize: 13, color: '#55627a' }}>נסגר <b className="tabular-nums" style={{ color: '#0f172a' }}>{money(goalCurrentN)}</b> מתוך <b className="tabular-nums" style={{ color: '#0f172a' }}>{money(goalTargetN)}</b></div>
            <div style={{ marginTop: 14, borderTop: '1px solid rgba(15,23,42,.08)', paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 9 }}>
              {funnel.map((f) => (
                <div key={f.label}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                    <span style={{ color: '#55627a' }}>{f.label}</span>
                    <span className="tabular-nums" style={{ color: '#0f172a', fontWeight: 600 }}>{f.value}</span>
                  </div>
                  <div style={{ height: 6, borderRadius: 999, background: '#f1f5f9', overflow: 'hidden' }}><div style={{ width: f.pct, height: '100%', borderRadius: 999, background: f.color }} /></div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* feed + assistant */}
        <div className="r-32" style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 16, alignItems: 'start' }}>
          <div className="glass-card" style={{ padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
              <div>
                <div style={label10}>פיד חי</div>
                <div style={{ marginTop: 4, fontSize: 18, fontWeight: 600, fontFamily: "'Space Grotesk',sans-serif" }}>מה קורה עכשיו בעסק</div>
              </div>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, border: '1px solid rgba(15,23,42,.16)', background: 'rgba(14,139,160,.1)', color: '#0b7688', borderRadius: 999, padding: '4px 11px', fontSize: 11, fontWeight: 600 }}>
                <span className="animate-pulse-dot" style={{ width: 6, height: 6, borderRadius: 999, background: '#0e8ba0' }} />בזמן אמת
              </span>
            </div>
            <ol style={{ listStyle: 'none', margin: 0, padding: '0 4px', display: 'flex', flexDirection: 'column', gap: 18 }}>
              {feed.map((ev, i) => (
                <li key={i} style={{ display: 'flex', gap: 12, animation: 'feed-in .4s cubic-bezier(.22,1,.36,1) both', animationDelay: `${i * 60}ms` }}>
                  <span style={{ flex: 'none', width: 34, height: 34, borderRadius: 999, border: '1px solid rgba(15,23,42,.08)', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, boxShadow: '0 1px 2px rgba(15,23,42,.04)' }}>{ev.icon}</span>
                  <div style={{ flex: 1, minWidth: 0, paddingTop: 2 }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: 8 }}>
                      <span style={{ fontSize: 13.5, fontWeight: 500 }}>{ev.label}</span>
                      <span style={{ fontSize: 11.5, color: '#94a3b8' }}>{ev.time}</span>
                    </div>
                    <p style={{ margin: '2px 0 0', fontSize: 13.5, color: '#55627a', lineHeight: 1.5 }}>{ev.text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
          <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', padding: 20, minHeight: 440 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ position: 'relative', width: 36, height: 36, borderRadius: 11, background: 'linear-gradient(135deg,#0e8ba0,#22b8cf)', padding: 1.5 }}>
                <div style={{ width: '100%', height: '100%', borderRadius: 9, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Ico inner={path('M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z')} size={16} color="#0b7688" />
                </div>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, fontFamily: "'Space Grotesk',sans-serif" }}>שיחה עם המוח</div>
                <div style={{ fontSize: 10, letterSpacing: '.2em', textTransform: 'uppercase', color: 'rgba(11,118,136,.7)' }}>CEO · AI</div>
              </div>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5, border: '1px solid rgba(15,23,42,.08)', background: '#f1f5f9', borderRadius: 999, padding: '3px 9px', fontSize: 10, color: '#55627a' }}>
                <span className="animate-pulse-dot" style={{ width: 6, height: 6, borderRadius: 999, background: '#12805c' }} />פעיל
              </span>
            </div>
            <div ref={chatRef} className="scrollbar-hide" style={{ marginTop: 16, flex: 1, display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto', border: '1px solid rgba(15,23,42,.08)', borderRadius: 14, background: '#f8fafc', padding: 16 }}>
              {messages.map((m, i) => <div key={i} style={bubble(m.role)}>{m.text}</div>)}
            </div>
            <form onSubmit={onSend} style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8, border: '1px solid rgba(15,23,42,.08)', background: '#f1f5f9', borderRadius: 14, padding: '9px 12px' }}>
              <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="שאלו את המוח — «על מה להתמקד היום?»" style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontFamily: 'inherit', fontSize: 13.5, color: '#0f172a' }} />
              <button type="submit" aria-label="שליחה" style={{ border: 'none', borderRadius: 9, background: 'linear-gradient(135deg,#0e8ba0,#22b8cf)', padding: 7, cursor: 'pointer', display: 'flex' }}>
                <Ico inner={path('M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5')} size={14} color="#fff" />
              </button>
            </form>
          </div>
        </div>

        {/* tasks + top customers + heatmap */}
        <div className="r-3" style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, alignItems: 'start' }}>
          <div className="glass-card" style={{ padding: 22 }}>
            <div style={{ ...label10, marginBottom: 4 }}>המשימות שלי</div>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 14 }}>להיום · {tasksLeft} פתוחות</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {tasks.map((t) => (
                <button key={t.id} onClick={() => toggleTask(t.id)} style={{ cursor: 'pointer', fontFamily: 'inherit', textAlign: 'start', display: 'flex', alignItems: 'center', gap: 11, border: 'none', background: 'none', padding: '9px 4px', borderRadius: 8 }}>
                  <span style={{ flex: 'none', width: 20, height: 20, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', ...(t.done ? { background: '#0e8ba0', border: '1px solid #0e8ba0' } : { background: '#fff', border: '1.5px solid rgba(15,23,42,.2)' }) }}>
                    {t.done && <Ico inner={path('m4.5 12.75 6 6 9-13.5')} size={12} color="#fff" />}
                  </span>
                  <span style={{ flex: 1, fontSize: 13.5, ...(t.done ? { color: '#94a3b8', textDecoration: 'line-through' } : { color: '#0f172a' }) }}>{t.label}</span>
                  <span style={{ fontSize: 11, color: '#94a3b8', whiteSpace: 'nowrap' }}>{t.time}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="glass-card" style={{ padding: 22 }}>
            <div style={{ ...label10, marginBottom: 4 }}>לקוחות מובילים</div>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 14 }}>לפי הכנסה</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {topCustomers.map((c) => (
                <div key={c.name} style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                  <span style={{ flex: 'none', width: 32, height: 32, borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff', background: c.tint }}>{c.initials}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                      <span className="tabular-nums" style={{ fontSize: 13, fontWeight: 600, color: '#0b7688' }}>{c.value}</span>
                    </div>
                    <div style={{ height: 5, borderRadius: 999, background: '#f1f5f9', overflow: 'hidden', marginTop: 5 }}><div style={{ width: c.pct, height: '100%', borderRadius: 999, background: c.tint }} /></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="glass-card" style={{ padding: 22 }}>
            <div style={{ ...label10, marginBottom: 4 }}>מפת פעילות</div>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 14 }}>12 השבועות האחרונים</div>
            <div dir="ltr" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {heatRows.map((row, ri2) => (
                <div key={ri2} style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                  <span style={{ width: 26, fontSize: 9, color: '#94a3b8', textAlign: 'right' }}>{row.label}</span>
                  {row.cells.map((c, ci) => <span key={ci} title={c.title} style={{ width: 14, height: 14, borderRadius: 3, background: c.color }} />)}
                </div>
              ))}
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 8, justifyContent: 'flex-end', fontSize: 10, color: '#94a3b8' }}>
                <span>פחות</span>
                <span style={{ width: 11, height: 11, borderRadius: 3, background: '#eef2f7' }} />
                <span style={{ width: 11, height: 11, borderRadius: 3, background: 'rgba(14,139,160,.35)' }} />
                <span style={{ width: 11, height: 11, borderRadius: 3, background: 'rgba(14,139,160,.65)' }} />
                <span style={{ width: 11, height: 11, borderRadius: 3, background: '#0e8ba0' }} />
                <span>יותר</span>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* ===== NOTIFICATION CENTER (opened via a global event from the top nav bell) ===== */}
      {notifOpen && (
        <>
          <div onClick={() => setNotifOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(15,23,42,.28)', animation: 'dash-fade .2s ease both' }} />
          <aside dir="rtl" style={{ position: 'fixed', top: 0, insetInlineStart: 0, zIndex: 61, width: 'min(400px,92vw)', height: '100vh', background: '#fff', boxShadow: '0 12px 40px rgba(15,23,42,.2)', display: 'flex', flexDirection: 'column', animation: 'dash-drawer-in .28s cubic-bezier(.22,1,.36,1) both' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 22px', borderBottom: '1px solid rgba(15,23,42,.08)' }}>
              <div style={{ fontSize: 17, fontWeight: 600 }}>התראות</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <button onClick={markAllRead} style={{ cursor: 'pointer', fontFamily: 'inherit', border: 'none', background: 'none', fontSize: 12.5, fontWeight: 600, color: '#0b7688' }}>סמן הכל כנקרא</button>
                <button onClick={() => setNotifOpen(false)} aria-label="סגור" style={{ cursor: 'pointer', border: 'none', background: 'none', color: '#94a3b8', padding: 2 }}><Ico inner={path('M6 18 18 6M6 6l12 12')} size={20} strokeWidth={1.8 as never} /></button>
              </div>
            </div>
            <div className="scrollbar-hide" style={{ flex: 1, overflowY: 'auto' }}>
              {notifs.map((n) => {
                const meta = NOTIF_META[n.kind];
                return (
                  <div key={n.id} onClick={() => markNotifRead(n.id)} style={{ display: 'flex', gap: 12, padding: '15px 22px', borderBottom: '1px solid rgba(15,23,42,.06)', cursor: 'pointer', background: n.unread ? 'rgba(14,139,160,.04)' : '#fff' }}>
                    <span style={{ flex: 'none', width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: meta.tint, color: meta.color }}><Ico inner={path(meta.icon)} size={18} /></span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 600, color: '#0f172a' }}>{n.title}</div>
                      <div style={{ fontSize: 12.5, color: '#55627a', lineHeight: 1.5, marginTop: 1 }}>{n.text}</div>
                      <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>{n.time}</div>
                    </div>
                    {n.unread && <span style={{ flex: 'none', width: 8, height: 8, borderRadius: 999, background: '#0e8ba0', marginTop: 6 }} />}
                  </div>
                );
              })}
            </div>
          </aside>
        </>
      )}

      {/* ===== DEAL DRAWER ===== */}
      {openDealData && (
        <>
          <div onClick={closeDeal} style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(15,23,42,.28)', animation: 'dash-fade .2s ease both' }} />
          <aside dir="rtl" style={{ position: 'fixed', top: 0, insetInlineStart: 0, zIndex: 61, width: 'min(460px,94vw)', height: '100vh', background: '#fff', boxShadow: '0 12px 40px rgba(15,23,42,.2)', display: 'flex', flexDirection: 'column', animation: 'dash-drawer-in .28s cubic-bezier(.22,1,.36,1) both' }}>
            <div style={{ padding: 22, borderBottom: '1px solid rgba(15,23,42,.08)' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ flex: 'none', width: 46, height: 46, borderRadius: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 700, color: '#fff', background: av(STAGE_META.find((s) => s.key === openDealData.stage)!.tint) }}>{dealInitials(openDealData.account)}</span>
                  <div><div style={{ fontSize: 17, fontWeight: 600 }}>{openDealData.title}</div><div style={{ fontSize: 13, color: '#94a3b8' }}>{openDealData.account}</div></div>
                </div>
                <button onClick={closeDeal} aria-label="סגור" style={{ cursor: 'pointer', border: 'none', background: 'none', color: '#94a3b8', padding: 2 }}><Ico inner={path('M6 18 18 6M6 6l12 12')} size={20} /></button>
              </div>
              <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ flex: 1 }}><div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>שווי עסקה</div><div className="tabular-nums" style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 24, fontWeight: 600, color: '#0f172a' }}>{money(openDealData.value)}</div></div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>שלב</div>
                  <select value={openDealData.stage} onChange={(e) => moveDeal(openDealData.id, e.target.value as StageKey)} style={{ width: '100%', border: '1px solid rgba(15,23,42,.16)', borderRadius: 10, padding: '8px 10px', fontFamily: 'inherit', fontSize: 13.5, color: '#0f172a', background: '#fff', outline: 'none' }}>
                    {STAGE_META.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
                  </select>
                </div>
              </div>
            </div>
            <div className="scrollbar-hide" style={{ flex: 1, overflowY: 'auto', padding: 22 }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 22 }}>
                {dealActions.map((a) => (
                  <button key={a.label} onClick={a.onClick} style={{ cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 6, border: '1px solid rgba(15,23,42,.14)', background: '#fff', borderRadius: 10, padding: '8px 12px', fontSize: 12.5, fontWeight: 600, color: '#0f172a' }}>
                    <span style={{ color: '#0e8ba0' }}><Ico inner={path(a.icon)} size={18} /></span>{a.label}
                  </button>
                ))}
              </div>
              <div style={sectionLabel}>איש קשר</div>
              <div style={{ border: '1px solid rgba(15,23,42,.08)', borderRadius: 12, padding: 14, marginBottom: 22 }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{openDealData.contact.name}</div>
                <div style={{ fontSize: 12.5, color: '#94a3b8' }}>{openDealData.contact.role}</div>
                <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 7, fontSize: 13 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#55627a' }}><Ico inner={path('M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z')} size={15} color="#94a3b8" /><span dir="ltr">{openDealData.contact.phone}</span></div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#55627a' }}><Ico inner={path('M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75')} size={15} color="#94a3b8" /><span dir="ltr">{openDealData.contact.email}</span></div>
                </div>
              </div>
              <div style={sectionLabel}>טיימליין</div>
              <ol style={{ listStyle: 'none', margin: '0 0 22px', padding: 0, display: 'flex', flexDirection: 'column', gap: 0 }}>
                {openDealData.timeline.map((t, i) => (
                  <li key={i} style={{ display: 'flex', gap: 12 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <span style={{ flex: 'none', width: 28, height: 28, borderRadius: 999, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>{t.icon}</span>
                      {i < openDealData.timeline.length - 1 && <span style={{ flex: 1, width: 2, background: 'rgba(15,23,42,.08)', minHeight: 14 }} />}
                    </div>
                    <div style={{ paddingBottom: 16 }}><div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>{t.title}</div><div style={{ fontSize: 12, color: '#55627a', marginTop: 1 }}>{t.text}</div><div style={{ fontSize: 11, color: '#94a3b8', marginTop: 3 }}>{t.time}</div></div>
                  </li>
                ))}
              </ol>
              <div style={sectionLabel}>קבצים</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 22 }}>
                {openDealData.files.map((f, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, border: '1px solid rgba(15,23,42,.08)', borderRadius: 10, padding: '10px 12px' }}>
                    <Ico inner={path('M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z')} size={18} color="#0e8ba0" strokeWidth={1.6 as never} />
                    <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</div><div style={{ fontSize: 11, color: '#94a3b8' }}>{f.meta}</div></div>
                  </div>
                ))}
              </div>
              <div style={sectionLabel}>הערות</div>
              <form onSubmit={addNote} style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <input value={noteInput} onChange={(e) => setNoteInput(e.target.value)} placeholder="הוסף הערה…" style={{ flex: 1, border: '1px solid rgba(15,23,42,.16)', borderRadius: 10, padding: '9px 12px', fontFamily: 'inherit', fontSize: 13, outline: 'none' }} />
                <button type="submit" style={{ cursor: 'pointer', fontFamily: 'inherit', border: 'none', borderRadius: 10, background: '#0e8ba0', color: '#fff', padding: '9px 14px', fontSize: 13, fontWeight: 600 }}>הוסף</button>
              </form>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {openDealData.notes.map((nt, i) => (
                  <div key={i} style={{ border: '1px solid rgba(15,23,42,.08)', background: '#f8fafc', borderRadius: 10, padding: '10px 12px', fontSize: 13, color: '#0f172a', lineHeight: 1.5 }}>{nt.text}<div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>{nt.time}</div></div>
                ))}
              </div>
            </div>
          </aside>
        </>
      )}

      {/* toast */}
      {toast && (
        <div style={{ position: 'fixed', bottom: 28, insetInlineStart: '50%', transform: 'translateX(50%)', zIndex: 80, background: '#0f172a', color: '#fff', borderRadius: 12, padding: '12px 20px', fontSize: 14, boxShadow: '0 12px 32px rgba(15,23,42,.28)', animation: 'dash-fade .25s ease both' }}>{toast}</div>
      )}
    </div>
  );
}
