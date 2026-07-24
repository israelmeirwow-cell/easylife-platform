import { useMemo, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';

/* "תזרים" — Cashflow / Cash Intelligence, ported 1:1 from the v2 Claude Design
   handoff (Cashflow.dc.html). Layout, copy, mock data, tint colors and all the
   interactive features (income-vs-expenses line/bars chart with crosshair + dual
   tooltip + draw-in, clickable series legend, compare-to-previous, range chips +
   inline calendar, expense pie, month-vs-month bars, forecast cards, pending
   invoices, sortable/filterable/searchable transactions table with CSV export +
   detail drawer + show-more, add-transaction drawer, and toasts) are verbatim
   from the design's DCLogic. Colors are the design's literal values.
   The responsive r-* system is injected verbatim from the design's <style>. */

/* ---------- responsive system (verbatim @media block from the design) ---------- */
const CASHFLOW_CSS = `
@media (max-width:960px){ .r-main{padding-inline:18px !important;} .r-4{grid-template-columns:repeat(2,1fr) !important;} .r-32{grid-template-columns:1fr !important;} }
@media (max-width:760px){ .r-hero{grid-template-columns:1fr !important;} .r-2{grid-template-columns:1fr !important;} .r-3{grid-template-columns:1fr !important;} .r-main{padding-inline:14px !important;} }
@media (max-width:520px){ .r-4{grid-template-columns:1fr !important;} }
.cf-line { stroke-dasharray:1; stroke-dashoffset:1; animation:cf-draw 1.6s ease-in-out .1s forwards; }
@keyframes cf-draw { to { stroke-dashoffset:0; } }
.cf-feat { transition:transform .18s ease, box-shadow .18s ease; }
.cf-feat:hover { transform:translateY(-3px); box-shadow:0 4px 12px rgba(15,23,42,.1); }
.cf-src:hover { background:#f1f5f9; }
.txn-row:hover { background:rgba(241,245,249,.6); }
.cf-th { cursor:pointer; user-select:none; } .cf-th:hover { color:#0f172a; }
.cf-scroll { scrollbar-width:none; -ms-overflow-style:none; }
.cf-scroll::-webkit-scrollbar { display:none; }
@keyframes dash-drawer-in { from { transform:translateX(-100%); } to { transform:translateX(0); } }
@keyframes dash-fade { from { opacity:0; } to { opacity:1; } }
`;

/* ---------- inline heroicons (exact paths from the design) ---------- */
function Ico({ inner, size = 16, className, style }: { inner: string; size?: number; className?: string; style?: React.CSSProperties }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      width={size}
      height={size}
      className={className}
      style={style}
      dangerouslySetInnerHTML={{ __html: inner }}
    />
  );
}

const P = {
  trendUp:
    '<path stroke-linecap="round" stroke-linejoin="round" d="M2.25 18 9 11.25l4.306 4.307a11.95 11.95 0 0 1 5.814-5.518l2.74-1.22m0 0-5.94-2.28m5.94 2.28-2.28 5.941"/>',
  arrowUp:
    '<path stroke-linecap="round" stroke-linejoin="round" d="M4.5 19.5 19.5 4.5m0 0H9m10.5 0V15"/>',
  arrowDown:
    '<path stroke-linecap="round" stroke-linejoin="round" d="M19.5 4.5 4.5 19.5m0 0h10.5m-10.5 0V9"/>',
  calendar:
    '<path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5"/>',
  compare:
    '<path stroke-linecap="round" stroke-linejoin="round" d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5"/>',
  line:
    '<path stroke-linecap="round" stroke-linejoin="round" d="M2.25 18 9 11.25l4.306 4.307a11.95 11.95 0 0 1 5.814-5.518l2.74-1.22"/>',
  bars:
    '<path stroke-linecap="round" stroke-linejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z"/>',
  search:
    '<path stroke-linecap="round" stroke-linejoin="round" d="m21 21-4.34-4.34M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z"/>',
  csv:
    '<path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5"/>',
  alert:
    '<path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"/>',
  close:
    '<path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12"/>',
  doc:
    '<path stroke-linecap="round" stroke-linejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Z"/>',
};

/* ---------- feature cards (2 items — from the design's DCLogic) ---------- */
const FEATURES = [
  {
    title: 'זיהוי הכנסות אוטומטי',
    desc: 'כל חשבונית, סליקה והזמנה מהחנות נכנסת לתזרים לבד.',
    icon: '<path stroke-linecap="round" stroke-linejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25Z"/>',
  },
  {
    title: 'התראות בזמן אמת',
    desc: 'התראה לפני שהיתרה יורדת מתחת לסף שהגדרת.',
    icon: '<path stroke-linecap="round" stroke-linejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0"/>',
  },
];

/* ---------- KPI stats (from the design's DCLogic) ---------- */
const STATS = [
  { label: 'הכנסות החודש', value: '₪ 48,200', delta: '+12.5%', up: true, note: 'מגמת עלייה' },
  { label: 'הוצאות החודש', value: '₪ 29,800', delta: '-8%', up: false, note: 'ירידה מהחודש שעבר' },
  { label: 'רווחיות (נטו)', value: '₪ 18,400', delta: '+21%', up: true, note: 'שולי רווח 38%' },
  { label: 'ממתין לגבייה', value: '₪ 11,350', delta: '', up: true, note: '5 חשבוניות פתוחות' },
];

const shk = (v: number) => '₪ ' + v.toLocaleString('he-IL');

/* ---------- expenses pie (from the design's DCLogic) ---------- */
const EXPENSE_CATS = [
  { name: 'שכר ועובדים', amount: 12400, pct: 42, color: '#0e8ba0' },
  { name: 'ספקים ומלאי', amount: 6900, pct: 23, color: '#1666a8' },
  { name: 'שיווק ופרסום', amount: 4200, pct: 14, color: '#7c6cf0' },
  { name: 'שכירות', amount: 3200, pct: 11, color: '#b26a00' },
  { name: 'תוכנה ומנויים', amount: 1800, pct: 6, color: '#0e7490' },
  { name: 'אחר', amount: 1300, pct: 4, color: '#94a3b8' },
];
const CIRC = 2 * Math.PI * 40;
const PIE = (() => {
  let acc = 0;
  return EXPENSE_CATS.map((cat) => {
    const len = (CIRC * cat.pct) / 100;
    const seg = { color: cat.color, dash: `${len.toFixed(1)} ${(CIRC - len).toFixed(1)}`, offset: (-acc).toFixed(1) };
    acc += len;
    return seg;
  });
})();

/* ---------- month vs month (from the design's DCLogic) ---------- */
const MOM = [
  { label: 'הכנסות', cur: '₪48.2K', prevPct: '72%', curPct: '100%', delta: 0.14, bar: '#12805c' },
  { label: 'הוצאות', cur: '₪29.8K', prevPct: '100%', curPct: '92%', delta: -0.08, bar: '#d1453b' },
  { label: 'נטו', cur: '₪18.4K', prevPct: '55%', curPct: '100%', delta: 0.21, bar: '#0e8ba0' },
].map((m) => ({
  ...m,
  color: m.delta >= 0 ? '#12805c' : '#d1453b',
  deltaLabel: (m.delta >= 0 ? '▲ ' : '▼ ') + Math.abs(Math.round(m.delta * 100)) + '%',
}));

/* ---------- forecast (from the design's DCLogic) ---------- */
const FORECAST = [
  { label: 'צפי יתרה ב‑30 יום', value: '₪ 96,900', delta: '▲ 12%', color: '#12805c' },
  { label: 'צפי יתרה ב‑60 יום', value: '₪ 108,400', delta: '▲ 19%', color: '#12805c' },
];

/* ---------- pending invoices (from the design's DCLogic) ---------- */
const okP: React.CSSProperties = { borderRadius: 999, padding: '2px 9px', fontSize: 10.5, fontWeight: 600, background: 'rgba(178,106,0,.1)', color: '#b26a00' };
const lateP: React.CSSProperties = { borderRadius: 999, padding: '2px 9px', fontSize: 10.5, fontWeight: 600, background: 'rgba(209,69,59,.1)', color: '#d1453b' };
const TINTS = ['#0e8ba0', '#1666a8', '#12805c', '#b26a00'];
const tint = (s: string) => {
  let h = 0;
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return TINTS[Math.abs(h) % TINTS.length];
};
const ini = (s: string) => s.replace(/[״׳"]/g, '').split(' ').slice(0, 2).map((w) => w[0]).join('');
const INV_RAW = [
  { name: 'רשת אופנה URBAN', number: '#2041', due: '26.7', amount: 6400, late: false },
  { name: 'חברת שיפוצים', number: '#2038', due: '22.7', amount: 3200, late: true },
  { name: 'קליניקת נועה', number: '#2044', due: '31.7', amount: 1750, late: false },
];
const INVOICES = INV_RAW.map((i) => ({
  name: i.name, number: i.number, due: i.due, initials: ini(i.name), tint: tint(i.name),
  amount: shk(i.amount), status: i.late ? 'באיחור' : 'ממתין', pill: i.late ? lateP : okP,
}));

/* ---------- transactions seed (from the design's DCLogic) ---------- */
interface Txn { id: number; date: string; desc: string; cat: string; kind: 'in' | 'out'; amount: number; method: string; source: string; }
const seedTxns = (): Txn[] => [
  { id: 1, date: '23.7', desc: 'תשלום מנוי — קליניקת נועה', cat: 'מנויים', kind: 'in', amount: 349, method: 'חשבונית', source: 'חשבונית ירוקה' },
  { id: 2, date: '22.7', desc: 'ספק — חומרי גלם', cat: 'ספקים', kind: 'out', amount: 2140, method: 'העברה', source: 'העברה בנקאית' },
  { id: 3, date: '22.7', desc: 'הזמנה מהחנות #1043', cat: 'חנות', kind: 'in', amount: 1240, method: 'אשראי', source: 'WooCommerce' },
  { id: 4, date: '21.7', desc: 'קמפיין פייסבוק', cat: 'שיווק', kind: 'out', amount: 900, method: 'אשראי', source: 'Meta Ads' },
  { id: 5, date: '20.7', desc: 'פרויקט — רשת אופנה URBAN', cat: 'פרויקטים', kind: 'in', amount: 6400, method: 'העברה', source: 'חשבונית ירוקה' },
  { id: 6, date: '19.7', desc: 'שכירות משרד — יולי', cat: 'שכירות', kind: 'out', amount: 3200, method: 'העברה', source: 'הוראת קבע' },
  { id: 7, date: '18.7', desc: 'מנוי תוכנה — Grow', cat: 'תוכנה', kind: 'out', amount: 190, method: 'אשראי', source: 'Grow' },
  { id: 8, date: '17.7', desc: 'הזמנה מהחנות #1041', cat: 'חנות', kind: 'in', amount: 820, method: 'אשראי', source: 'WooCommerce' },
  { id: 9, date: '16.7', desc: 'תשלום מנוי — בית קפה עלית', cat: 'מנויים', kind: 'in', amount: 349, method: 'חשבונית', source: 'חשבונית ירוקה' },
  { id: 10, date: '15.7', desc: 'משכורת — עובד במשרה חלקית', cat: 'שכר', kind: 'out', amount: 5400, method: 'העברה', source: 'העברה בנקאית' },
  { id: 11, date: '14.7', desc: 'סליקת אשראי — לקוח מזדמן', cat: 'חנות', kind: 'in', amount: 540, method: 'אשראי', source: 'Grow' },
  { id: 12, date: '12.7', desc: 'ספק אריזות', cat: 'ספקים', kind: 'out', amount: 760, method: 'אשראי', source: 'אשראי עסקי' },
  { id: 13, date: '11.7', desc: 'פרויקט — קליניקת נועה', cat: 'פרויקטים', kind: 'in', amount: 4200, method: 'העברה', source: 'חשבונית ירוקה' },
  { id: 14, date: '10.7', desc: 'חשמל ומים', cat: 'תפעול', kind: 'out', amount: 640, method: 'הוראת קבע', source: 'הוראת קבע' },
];

/* ---------- chart engine (ported verbatim from DCLogic._chart / R) ---------- */
const TODAY = new Date('2026-07-23');
const fmtShort = (d: Date) => d.toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' });
const fmtLong = (d: Date) => d.toLocaleDateString('he-IL', { day: 'numeric', month: 'long', year: 'numeric' });

interface ChartSpec { n: number; start: string; spanDays: number; xLabels: string[]; sub: string; }
interface Bar { w: string; inX: string; inY: string; inH: string; outX: string; outY: string; outH: string; inTitle: string; outTitle: string; }

function chartOf(spec: ChartSpec) {
  const n = spec.n, W = 900, H = 230, pad = 14;
  const inV = Array.from({ length: n }, (_, i) => {
    const t = i / (n - 1);
    return Math.round(40 + 52 * t + 6 * Math.sin(i * 0.8) + 3 * Math.cos(i * 0.4));
  });
  const outV = Array.from({ length: n }, (_, i) => {
    const t = i / (n - 1);
    return Math.round(24 + 26 * t + 5 * Math.sin(i * 0.7 + 1) + 2 * Math.cos(i * 0.5));
  });
  const netV = inV.map((v, i) => v - outV[i]);
  const prevV = inV.map((v) => Math.round(v * 0.85));
  const axisMax = Math.ceil((Math.max(...inV) + 6) / 10) * 10;
  const yFor = (v: number) => pad + (H - 2 * pad) * (1 - v / axisMax);
  const stepX = W / (n - 1);
  const pts = (arr: number[]) => arr.map((v, i) => ({ x: i * stepX, y: yFor(v) }));
  const inPts = pts(inV), outPts = pts(outV);
  const toLine = (a: { x: number; y: number }[]) =>
    a.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const inPath = toLine(inPts), outPath = toLine(outPts), netPath = toLine(pts(netV)), prevPath = toLine(pts(prevV));
  const inArea = `${inPath} L${W},${H} L0,${H} Z`;
  const grid: { y: string; top: string; label: string }[] = [];
  for (let k = 0; k <= 4; k++) {
    const v = (axisMax * k) / 4;
    const y = yFor(v);
    grid.push({ y: y.toFixed(1), top: ((y / H) * 100).toFixed(2) + '%', label: '₪ ' + Math.round(v) + 'K' });
  }
  // bars: sample to <=12
  const bstep = Math.max(1, Math.ceil(n / 12));
  const bidx: number[] = [];
  for (let i = 0; i < n; i += bstep) bidx.push(i);
  const bw = W / bidx.length, barW = Math.min(16, bw / 3);
  const bars: Bar[] = bidx.map((i, k) => {
    const cx = k * bw + bw / 2;
    const inH = ((H - 2 * pad) * inV[i]) / axisMax, outH = ((H - 2 * pad) * outV[i]) / axisMax;
    return {
      w: barW.toFixed(1), inX: (cx - barW - 1).toFixed(1), inY: (H - pad - inH).toFixed(1), inH: inH.toFixed(1),
      outX: (cx + 1).toFixed(1), outY: (H - pad - outH).toFixed(1), outH: outH.toFixed(1),
      inTitle: 'הכנסות ₪' + Math.round(inV[i] * 1000).toLocaleString('he-IL'),
      outTitle: 'הוצאות ₪' + Math.round(outV[i] * 1000).toLocaleString('he-IL'),
    };
  });
  const fmt = (d: Date) => d.toLocaleDateString('he-IL', { day: 'numeric', month: 'long' });
  const start = new Date(spec.start);
  const dates = inV.map((_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + Math.round((i * spec.spanDays) / (n - 1)));
    return fmt(d);
  });
  return { inV, outV, netV, inPts, outPts, inPath, outPath, netPath, prevPath, inArea, grid, bars, dates, xLabels: spec.xLabels, rangeSub: spec.sub, W, H };
}

const R: Record<string, ChartSpec> = {
  '30d': { n: 30, start: '2026-06-24', spanDays: 29, xLabels: ['24.6', '9.7', '24.7'], sub: 'ב־30 הימים האחרונים' },
  '3m': { n: 40, start: '2026-04-25', spanDays: 89, xLabels: ['אפריל', 'מאי', 'יוני', 'יולי'], sub: 'ב־3 החודשים האחרונים' },
  '6m': { n: 26, start: '2026-01-23', spanDays: 181, xLabels: ['ינואר', 'מרץ', 'מאי', 'יולי'], sub: 'ב־6 החודשים האחרונים' },
  '1y': { n: 12, start: '2025-07-23', spanDays: 364, xLabels: ['יולי 25', 'אוק׳', 'ינואר', 'יולי 26'], sub: 'ב־12 החודשים האחרונים' },
};

const RANGE_DEFS = [
  { key: '30d', label: '30 יום' },
  { key: '3m', label: '3 חודשים' },
  { key: '6m', label: 'חצי שנה' },
  { key: '1y', label: 'שנה' },
];

const money = (v: number) => '₪ ' + Math.round(v * 1000).toLocaleString('he-IL');

/* pill/tab base styles */
const chipOn: React.CSSProperties = { cursor: 'pointer', fontFamily: 'inherit', border: 'none', borderRadius: 8, background: '#fff', padding: '4px 11px', fontWeight: 600, color: '#0f172a', boxShadow: '0 1px 2px rgba(15,23,42,.06)' };
const chipOff: React.CSSProperties = { cursor: 'pointer', fontFamily: 'inherit', border: 'none', borderRadius: 8, background: 'transparent', padding: '4px 11px', color: '#94a3b8' };
const selStyle: React.CSSProperties = { border: '1px solid rgba(15,23,42,.16)', background: '#fff', borderRadius: 10, padding: '7px 10px', fontFamily: 'inherit', fontSize: 13, color: '#0f172a', outline: 'none' };

type Kind = 'in' | 'out';
interface AddForm { kind: Kind; desc: string; amount: string; cat: string; method: string; }

export default function Cashflow() {
  const reduce = useReducedMotion();
  const [range, setRange] = useState('3m');
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [calOpen, setCalOpen] = useState(false);
  const [fromDate, setFromDate] = useState<Date | null>(null);
  const [calMonth, setCalMonth] = useState<Date | null>(null);
  const [chartView, setChartView] = useState<'line' | 'bars'>('line');
  const [compare, setCompare] = useState(false);
  const [series, setSeries] = useState({ in: true, out: true, net: false });
  const chartRef = useRef<HTMLDivElement>(null);

  /* transactions state */
  const [txns, setTxns] = useState<Txn[]>(seedTxns);
  const [txnSearch, setTxnSearch] = useState('');
  const [txnType, setTxnType] = useState<'all' | 'in' | 'out'>('all');
  const [txnCat, setTxnCat] = useState('all');
  const [txnSort, setTxnSort] = useState<'desc' | 'cat' | 'date' | 'method' | 'amount'>('date');
  const [txnDir, setTxnDir] = useState(-1);
  const [txnShow, setTxnShow] = useState(8);
  const [txnId, setTxnId] = useState<number | null>(null);

  /* add drawer + toast */
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState<AddForm>({ kind: 'out', desc: '', amount: '', cat: '', method: 'אשראי' });
  const [toast, setToast] = useState('');
  const toastTimer = useRef<ReturnType<typeof setTimeout>>();

  function showToast(m: string) {
    setToast(m);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 2600);
  }

  /* build the active chart spec (custom fromDate overrides the range chips) */
  const c = useMemo(() => {
    let spec: ChartSpec;
    if (fromDate) {
      const span = Math.max(2, Math.round((TODAY.getTime() - fromDate.getTime()) / 86400000));
      let nn = span <= 31 ? Math.min(span, 31) : span <= 95 ? 40 : span <= 190 ? 26 : Math.min(52, Math.round(span / 7));
      nn = Math.max(6, nn);
      spec = {
        n: nn,
        start: fromDate.toISOString().slice(0, 10),
        spanDays: span,
        xLabels: [fmtShort(fromDate), '', fmtShort(TODAY)],
        sub: 'מ־' + fmtLong(fromDate),
      };
    } else {
      spec = R[range] || R['3m'];
    }
    return chartOf(spec);
  }, [range, fromDate]);

  const n = c.inPts.length;
  const hoverActive = hoverIdx != null;
  const idx = hoverActive ? Math.max(0, Math.min(n - 1, hoverIdx)) : n - 1;
  const inP = c.inPts[idx], outP = c.outPts[idx];

  const hoverIn = money(c.inV[idx]);
  const hoverOut = money(c.outV[idx]);
  const hoverNet = money(c.netV[idx]);
  const hoverDate = (hoverActive ? '' : 'עדכני · ') + c.dates[idx];
  const hoverLeft = ((inP.x / c.W) * 100).toFixed(2) + '%';
  const hoverX = inP.x.toFixed(1);
  const hoverInTop = ((inP.y / c.H) * 100).toFixed(2) + '%';
  const hoverOutTop = ((outP.y / c.H) * 100).toFixed(2) + '%';

  function onMove(e: React.MouseEvent) {
    if (!chartRef.current) return;
    const rect = chartRef.current.getBoundingClientRect();
    let i = Math.round(((e.clientX - rect.left) / rect.width) * (n - 1));
    i = Math.max(0, Math.min(n - 1, i));
    if (i !== hoverIdx) setHoverIdx(i);
  }

  /* calendar */
  const cal = calMonth ? new Date(calMonth) : new Date('2026-07-01');
  const cy = cal.getFullYear(), cm = cal.getMonth();
  const firstPad = new Date(cy, cm, 1).getDay();
  const dim = new Date(cy, cm + 1, 0).getDate();
  const calMonthLabel = cal.toLocaleDateString('he-IL', { month: 'long', year: 'numeric' });

  const dayBase: React.CSSProperties = {
    cursor: 'pointer', fontFamily: 'inherit', border: 'none', background: 'none',
    borderRadius: 8, height: 30, fontSize: 12, color: '#0f172a',
  };
  type CalDay = { key: string; label: string; style: React.CSSProperties; onClick?: () => void };
  const calDays: CalDay[] = [];
  for (let i = 0; i < firstPad; i++) {
    calDays.push({ key: 'pad' + i, label: '', style: { height: 30, visibility: 'hidden' } });
  }
  for (let day = 1; day <= dim; day++) {
    const d = new Date(cy, cm, day);
    const future = d > TODAY;
    const sel = fromDate != null && d.toDateString() === fromDate.toDateString();
    const today = d.toDateString() === TODAY.toDateString();
    let st: React.CSSProperties = { ...dayBase };
    if (future) st = { ...st, color: '#cbd5e1', cursor: 'default' };
    else if (sel) st = { ...st, background: '#0e8ba0', color: '#fff', fontWeight: 700 };
    else if (today) st = { ...st, boxShadow: 'inset 0 0 0 1px rgba(14,139,160,.4)', color: '#0b7688', fontWeight: 600 };
    calDays.push({
      key: 'd' + day,
      label: String(day),
      style: st,
      onClick: future ? undefined : () => { setFromDate(d); setRange('custom'); setCalOpen(false); setHoverIdx(null); },
    });
  }
  function shiftMonth(delta: number) {
    const b = calMonth ? new Date(calMonth) : new Date('2026-07-01');
    setCalMonth(new Date(b.getFullYear(), b.getMonth() + delta, 1));
  }

  const calBtnStyle: React.CSSProperties = {
    cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 5,
    borderRadius: 10, padding: '6px 11px', fontSize: 11, fontWeight: 600,
    ...(fromDate
      ? { border: '1px solid #0e8ba0', background: 'rgba(14,139,160,.1)', color: '#0b7688' }
      : { border: '1px solid rgba(15,23,42,.16)', background: '#fff', color: '#55627a' }),
  };
  const calBtnLabel = fromDate ? fmtShort(fromDate) : 'בחר תאריך';
  const fromLabel = fromDate ? 'מ־' + fmtLong(fromDate) : 'לא נבחר תאריך';

  const compareStyle: React.CSSProperties = {
    cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 5,
    borderRadius: 10, padding: '6px 11px', fontSize: 11, fontWeight: 600,
    ...(compare
      ? { border: '1px solid #0e8ba0', background: 'rgba(14,139,160,.1)', color: '#0b7688' }
      : { border: '1px solid rgba(15,23,42,.16)', background: '#fff', color: '#55627a' }),
  };

  const legBtn = (on: boolean): React.CSSProperties => ({
    cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 6,
    border: '1px solid rgba(15,23,42,.12)', borderRadius: 999, padding: '5px 11px', fontSize: 12,
    color: '#55627a', background: '#fff', opacity: on ? 1 : 0.4,
  });
  const legend = [
    { key: 'in' as const, label: 'הכנסות', swatch: '#12805c', value: money(c.inV[idx]) },
    { key: 'out' as const, label: 'הוצאות', swatch: '#d1453b', value: money(c.outV[idx]) },
    { key: 'net' as const, label: 'נטו', swatch: '#0e8ba0', value: money(c.netV[idx]) },
  ];

  const vBtn = (on: boolean): React.CSSProperties => ({
    cursor: 'pointer', fontFamily: 'inherit', border: 'none', borderRadius: 8, padding: '5px 9px',
    display: 'flex', alignItems: 'center',
    ...(on ? { background: '#fff', color: '#0f172a', boxShadow: '0 1px 2px rgba(15,23,42,.08)' } : { background: 'transparent', color: '#94a3b8' }),
  });

  const lineClass = reduce ? undefined : 'cf-line';

  /* ---------- transactions pipeline ---------- */
  const catOptions = useMemo(() => ['all', ...Array.from(new Set(txns.map((t) => t.cat)))], [txns]);
  const parseDate = (s: string) => { const [d, m] = s.split('.').map(Number); return m * 100 + d; };
  const filtered = useMemo(() => {
    let f = txns.filter((t) => (txnType === 'all' || t.kind === txnType) && (txnCat === 'all' || t.cat === txnCat));
    const tq = txnSearch.trim();
    if (tq) f = f.filter((t) => [t.desc, t.cat, t.method].some((v) => v.includes(tq)));
    const sk = txnSort, sd = txnDir;
    f = [...f].sort((a, b) => {
      let x: number | string, y: number | string;
      if (sk === 'amount') { x = a.amount; y = b.amount; }
      else if (sk === 'date') { x = parseDate(a.date); y = parseDate(b.date); }
      else { x = a[sk]; y = b[sk]; }
      if (typeof x === 'number' && typeof y === 'number') return (x - y) * sd;
      return String(x).localeCompare(String(y), 'he') * sd;
    });
    return f;
  }, [txns, txnType, txnCat, txnSearch, txnSort, txnDir]);
  const totalF = filtered.length;
  const shown = filtered.slice(0, txnShow);
  const txnEmpty = totalF === 0;
  const hasMore = totalF > txnShow;
  const remaining = totalF - txnShow;

  const txnCols: { key: typeof txnSort; label: string }[] = [
    { key: 'desc', label: 'תיאור' },
    { key: 'cat', label: 'קטגוריה' },
    { key: 'date', label: 'תאריך' },
    { key: 'method', label: 'אמצעי' },
  ];
  function onSort(key: typeof txnSort) {
    setTxnDir((d) => (txnSort === key ? -d : 1));
    setTxnSort(key);
  }

  /* txn detail drawer */
  const txnOpen = txnId != null;
  const txnDetail = txnOpen ? txns.find((x) => x.id === txnId) || txns[0] : null;

  /* add + export */
  function addTxn() {
    const rec: Txn = {
      id: Date.now() % 100000, date: '24.7', desc: addForm.desc || 'תנועה חדשה', cat: addForm.cat || 'אחר',
      kind: addForm.kind, amount: parseInt(addForm.amount) || 0, method: addForm.method, source: 'הזנה ידנית',
    };
    setTxns((cur) => [rec, ...cur]);
    setAddOpen(false);
    showToast('התנועה נוספה בהצלחה');
  }
  function exportTxns(rows: Txn[]) {
    try {
      const head = ['תיאור', 'קטגוריה', 'תאריך', 'אמצעי', 'סוג', 'סכום'];
      const lines = [head.join(',')];
      rows.forEach((t) => lines.push([t.desc, t.cat, t.date, t.method, t.kind === 'in' ? 'הכנסה' : 'הוצאה', t.amount].map((v) => '"' + String(v).replace(/"/g, '""') + '"').join(',')));
      const csv = '﻿' + lines.join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'easylife-txns.csv';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      showToast('יוצאו ' + rows.length + ' תנועות');
    } catch {
      showToast('הייצוא נכשל בסביבה הזו');
    }
  }
  const setAf = (k: keyof AddForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setAddForm((s) => ({ ...s, [k]: e.target.value }));

  return (
    <div dir="rtl" className="r-main mx-auto max-w-[1180px]">
      <style dangerouslySetInnerHTML={{ __html: CASHFLOW_CSS }} />

      {/* page header */}
      <div style={{ marginBottom: 20, display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div style={{ fontSize: 10, letterSpacing: '.25em', textTransform: 'uppercase', color: '#94a3b8', fontFamily: "'Space Grotesk',sans-serif" }}>Cash Intelligence</div>
          <h1 style={{ margin: '6px 0 0', fontSize: 26, fontWeight: 600, letterSpacing: '-.01em' }}>תזרים</h1>
          <p style={{ margin: '7px 0 0', fontSize: 14.5, color: '#55627a', maxWidth: '44em', lineHeight: 1.55 }}>
            תמונת מזומנים חיה מחשבוניות, סליקה והזמנות מהחנות — בלי חיבור לבנק ובלי אקסל.
          </p>
        </div>
        <button
          type="button"
          onClick={() => { setAddForm({ kind: 'out', desc: '', amount: '', cat: '', method: 'אשראי' }); setAddOpen(true); }}
          style={{ cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 6, border: 'none', borderRadius: 12, background: '#0e8ba0', color: '#fff', padding: '10px 16px', fontSize: 14, fontWeight: 600 }}
        >
          <span style={{ fontSize: 16, lineHeight: 1 }}>+</span> תנועה חדשה
        </button>
      </div>

      {/* low balance alert */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, border: '1px solid rgba(178,106,0,.3)', background: 'rgba(178,106,0,.08)', borderRadius: 14, padding: '13px 16px', marginBottom: 18 }}>
        <span style={{ flex: 'none', width: 34, height: 34, borderRadius: 10, background: 'rgba(178,106,0,.14)', color: '#b26a00', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Ico inner={P.alert} size={18} style={{ strokeWidth: 1.8 }} />
        </span>
        <div style={{ flex: 1, fontSize: 13.5, color: '#0f172a', lineHeight: 1.5 }}>
          <b>שים לב לתזרים.</b> צפי היתרה ב‑9 באוגוסט יורד מתחת לסף שהגדרת (₪20,000). שקול להאיץ גבייה של ₪11,350 שממתינים.
        </div>
        <a href="#" style={{ flex: 'none', fontSize: 12.5, fontWeight: 600, color: '#b26a00' }}>הגדר סף</a>
      </div>

      {/* KPI row */}
      <div className="r-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 16 }}>
        {STATS.map((s) => (
          <div key={s.label} className="glass-card" style={{ padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 12, color: '#55627a' }}>{s.label}</span>
              {s.delta && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, fontSize: 11, fontWeight: 600, color: s.up ? '#12805c' : '#d1453b' }}>
                  {s.delta} <Ico inner={s.up ? P.arrowUp : P.arrowDown} size={12} />
                </span>
              )}
            </div>
            <div className="tabular-nums" style={{ marginTop: 8, fontSize: 24, fontWeight: 600, letterSpacing: '-.01em' }}>{s.value}</div>
            <div style={{ marginTop: 3, fontSize: 11, color: '#94a3b8' }}>{s.note}</div>
          </div>
        ))}
      </div>

      {/* chart card */}
      <div className="glass-card" style={{ padding: 22 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600 }}>הכנסות מול הוצאות</div>
            <div style={{ fontSize: 12, color: '#94a3b8' }}>{c.rangeSub}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <button type="button" onClick={() => setCompare((v) => !v)} style={compareStyle}>
              <Ico inner={P.compare} size={13} />השווה לתקופה קודמת
            </button>
            <div style={{ display: 'flex', gap: 2, borderRadius: 10, background: '#f1f5f9', padding: 2 }}>
              <button type="button" title="קו" onClick={() => setChartView('line')} style={vBtn(chartView === 'line')}><Ico inner={P.line} size={15} /></button>
              <button type="button" title="עמודות" onClick={() => setChartView('bars')} style={vBtn(chartView === 'bars')}><Ico inner={P.bars} size={15} /></button>
            </div>
            <div className="cf-scroll" style={{ display: 'flex', gap: 2, borderRadius: 10, background: '#f1f5f9', padding: 2, fontSize: 11, overflowX: 'auto', maxWidth: '100%' }}>
              {RANGE_DEFS.map((r) => (
                <button
                  key={r.key}
                  type="button"
                  onClick={() => { setRange(r.key); setFromDate(null); setHoverIdx(null); setCalOpen(false); }}
                  style={{ ...((!fromDate && range === r.key) ? chipOn : chipOff), whiteSpace: 'nowrap', flexShrink: 0 }}
                >
                  {r.label}
                </button>
              ))}
            </div>
            <button type="button" onClick={() => setCalOpen((v) => !v)} style={calBtnStyle}>
              <Ico inner={P.calendar} size={14} />
              {calBtnLabel}
            </button>
          </div>
        </div>

        {/* inline calendar */}
        {calOpen && (
          <div style={{ border: '1px solid rgba(15,23,42,.1)', borderRadius: 14, boxShadow: '0 8px 24px rgba(15,23,42,.1)', padding: 14, marginBottom: 14, maxWidth: 300 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <button type="button" onClick={() => shiftMonth(-1)} aria-label="חודש קודם" style={{ cursor: 'pointer', border: 'none', background: 'none', color: '#55627a', padding: '4px 8px', fontSize: 18, lineHeight: 1 }}>›</button>
              <span style={{ fontSize: 13, fontWeight: 600 }}>{calMonthLabel}</span>
              <button type="button" onClick={() => shiftMonth(1)} aria-label="חודש הבא" style={{ cursor: 'pointer', border: 'none', background: 'none', color: '#55627a', padding: '4px 8px', fontSize: 18, lineHeight: 1 }}>‹</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2, marginBottom: 4, fontSize: 10, color: '#94a3b8', textAlign: 'center' }}>
              {['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'].map((w) => <span key={w}>{w}</span>)}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2 }}>
              {calDays.map((d) => (
                <button key={d.key} type="button" onClick={d.onClick} style={d.style}>{d.label}</button>
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, fontSize: 11 }}>
              <button type="button" onClick={() => { setFromDate(null); setRange('3m'); setCalOpen(false); setHoverIdx(null); }} style={{ cursor: 'pointer', border: 'none', background: 'none', color: '#0b7688', fontWeight: 600, fontFamily: 'inherit' }}>איפוס</button>
              <span style={{ color: '#94a3b8' }}>{fromLabel}</span>
            </div>
          </div>
        )}

        {/* legend (clickable) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontSize: 12, color: '#55627a' }}>מאזן נטו</span>
            <span className="tabular-nums" style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 22, fontWeight: 600, color: '#0f172a' }}>{hoverNet}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginInlineStart: 'auto', flexWrap: 'wrap' }}>
            {legend.map((l) => (
              <button key={l.key} type="button" onClick={() => setSeries((s) => ({ ...s, [l.key]: !s[l.key] }))} style={legBtn(series[l.key])}>
                <span style={{ width: 11, height: 11, borderRadius: 3, background: l.swatch }} />{l.label} <b className="tabular-nums" style={{ fontWeight: 600 }}>{l.value}</b>
              </button>
            ))}
          </div>
        </div>
        <div style={{ fontSize: 11.5, color: '#94a3b8', marginBottom: 12 }}>{hoverDate}</div>

        {/* LINE view */}
        {chartView === 'line' && (
          <div ref={chartRef} onMouseMove={onMove} onMouseLeave={() => setHoverIdx(null)} style={{ position: 'relative', cursor: 'crosshair' }}>
            <svg viewBox="0 0 900 230" style={{ width: '100%', display: 'block' }}>
              <defs>
                <linearGradient id="cf-in" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#12805c" stopOpacity="0.2" />
                  <stop offset="100%" stopColor="#12805c" stopOpacity="0" />
                </linearGradient>
              </defs>
              {c.grid.map((g, i) => (
                <line key={i} x1="0" y1={g.y} x2="900" y2={g.y} stroke="rgba(15,23,42,.07)" strokeWidth={1} />
              ))}
              {compare && (
                <path d={c.prevPath} fill="none" stroke="#94a3b8" strokeWidth={1.6} strokeDasharray="5 5" opacity={0.7} />
              )}
              {series.in && (
                <>
                  <path d={c.inArea} fill="url(#cf-in)" />
                  <path key={`in-${range}-${fromDate?.getTime() ?? 'x'}`} className={lineClass} d={c.inPath} fill="none" stroke="#12805c" strokeWidth={2.4} strokeLinejoin="round" strokeLinecap="round" pathLength={1} />
                </>
              )}
              {series.out && (
                <path key={`out-${range}-${fromDate?.getTime() ?? 'x'}`} className={lineClass} d={c.outPath} fill="none" stroke="#d1453b" strokeWidth={2.2} strokeLinejoin="round" strokeLinecap="round" pathLength={1} />
              )}
              {series.net && (
                <path key={`net-${range}-${fromDate?.getTime() ?? 'x'}`} className={lineClass} d={c.netPath} fill="none" stroke="#0e8ba0" strokeWidth={2.2} strokeDasharray="2 3" strokeLinejoin="round" strokeLinecap="round" pathLength={1} />
              )}
              {hoverActive && (
                <line x1={hoverX} y1="8" x2={hoverX} y2="216" stroke="#0e8ba0" strokeWidth={1.2} strokeDasharray="4 4" />
              )}
            </svg>

            {/* Y-axis gridline labels */}
            {c.grid.map((g, i) => (
              <span key={i} className="tabular-nums" style={{ position: 'absolute', top: g.top, insetInlineEnd: 2, transform: 'translateY(-50%)', fontSize: 10, color: '#94a3b8', background: 'rgba(255,255,255,.85)', padding: '0 4px', borderRadius: 4 }}>{g.label}</span>
            ))}

            {/* crosshair markers + dual tooltip */}
            {hoverActive && (
              <>
                {series.in && <span style={{ position: 'absolute', left: hoverLeft, top: hoverInTop, transform: 'translate(-50%,-50%)', width: 11, height: 11, borderRadius: 999, background: '#12805c', border: '2.5px solid #fff', boxShadow: '0 1px 4px rgba(18,128,92,.5)', pointerEvents: 'none' }} />}
                {series.out && <span style={{ position: 'absolute', left: hoverLeft, top: hoverOutTop, transform: 'translate(-50%,-50%)', width: 11, height: 11, borderRadius: 999, background: '#d1453b', border: '2.5px solid #fff', boxShadow: '0 1px 4px rgba(209,69,59,.5)', pointerEvents: 'none' }} />}
                <div style={{ position: 'absolute', left: hoverLeft, top: hoverInTop, transform: 'translate(-50%,calc(-100% - 14px))', background: '#0f172a', color: '#fff', borderRadius: 10, padding: '8px 11px', fontSize: 11.5, whiteSpace: 'nowrap', pointerEvents: 'none', boxShadow: '0 8px 20px rgba(15,23,42,.25)' }}>
                  <div className="tabular-nums" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: '#31b98a' }} />הכנסות {hoverIn}</div>
                  <div className="tabular-nums" style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: '#e77' }} />הוצאות {hoverOut}</div>
                </div>
              </>
            )}
          </div>
        )}

        {/* BARS view */}
        {chartView === 'bars' && (
          <div style={{ position: 'relative' }}>
            <svg viewBox="0 0 900 230" style={{ width: '100%', display: 'block' }}>
              {c.grid.map((g, i) => (
                <line key={i} x1="0" y1={g.y} x2="900" y2={g.y} stroke="rgba(15,23,42,.07)" strokeWidth={1} />
              ))}
              {c.bars.map((b, i) => (
                <g key={i}>
                  {series.in && <rect x={b.inX} y={b.inY} width={b.w} height={b.inH} rx={3} fill="#12805c"><title>{b.inTitle}</title></rect>}
                  {series.out && <rect x={b.outX} y={b.outY} width={b.w} height={b.outH} rx={3} fill="#d1453b"><title>{b.outTitle}</title></rect>}
                </g>
              ))}
            </svg>
            {c.grid.map((g, i) => (
              <span key={i} className="tabular-nums" style={{ position: 'absolute', top: g.top, insetInlineEnd: 2, transform: 'translateY(-50%)', fontSize: 10, color: '#94a3b8', background: 'rgba(255,255,255,.85)', padding: '0 4px', borderRadius: 4 }}>{g.label}</span>
            ))}
          </div>
        )}

        {/* x-axis labels */}
        <div dir="ltr" style={{ display: 'flex', justifyContent: 'space-between', padding: '0 4px', marginTop: 8, fontSize: 11, color: '#94a3b8' }}>
          {c.xLabels.map((x, i) => <span key={i}>{x}</span>)}
        </div>
      </div>

      {/* breakdown: pie + month-vs-month + forecast */}
      <div className="r-3" style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, alignItems: 'start' }}>
        {/* expenses pie */}
        <div className="glass-card" style={{ padding: 22 }}>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>הוצאות לפי קטגוריה</div>
          <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 14 }}>סה״כ ₪ 29,800 החודש</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <svg viewBox="0 0 100 100" width={120} height={120} style={{ flex: 'none', transform: 'rotate(-90deg)' }}>
              <circle cx={50} cy={50} r={40} fill="none" stroke="#f1f5f9" strokeWidth={16} />
              {PIE.map((p, i) => (
                <circle key={i} cx={50} cy={50} r={40} fill="none" stroke={p.color} strokeWidth={16} strokeDasharray={p.dash} strokeDashoffset={p.offset} />
              ))}
            </svg>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {EXPENSE_CATS.map((p) => (
                <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5 }}>
                  <span style={{ width: 9, height: 9, borderRadius: 3, background: p.color }} />
                  <span style={{ flex: 1, color: '#0f172a' }}>{p.name}</span>
                  <span className="tabular-nums" style={{ color: '#55627a' }}>{p.pct}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* month vs month */}
        <div className="glass-card" style={{ padding: 22 }}>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>חודש מול חודש</div>
          <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 16 }}>יולי לעומת יוני</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {MOM.map((m) => (
              <div key={m.label}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 6 }}>
                  <span style={{ color: '#55627a' }}>{m.label}</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 600, color: m.color }}>{m.cur} <span style={{ fontSize: 11 }}>{m.deltaLabel}</span></span>
                </div>
                <div dir="ltr" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ flex: 1, height: 8, borderRadius: 999, background: '#f1f5f9', overflow: 'hidden' }}><div style={{ width: m.prevPct, height: '100%', background: '#cbd5e1' }} /></div>
                  <div style={{ flex: 1, height: 8, borderRadius: 999, background: '#f1f5f9', overflow: 'hidden' }}><div style={{ width: m.curPct, height: '100%', background: m.bar }} /></div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 14, display: 'flex', gap: 14, fontSize: 11, color: '#94a3b8' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 9, height: 9, borderRadius: 2, background: '#cbd5e1' }} />יוני</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 9, height: 9, borderRadius: 2, background: '#0e8ba0' }} />יולי</span>
          </div>
        </div>

        {/* forecast */}
        <div className="glass-card" style={{ padding: 22 }}>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>תחזית תזרים</div>
          <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 16 }}>צפי על בסיס המגמה הנוכחית</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {FORECAST.map((f) => (
              <div key={f.label} style={{ border: '1px solid rgba(15,23,42,.08)', borderRadius: 12, padding: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 12.5, color: '#55627a' }}>{f.label}</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: f.color }}>{f.delta}</span>
                </div>
                <div className="tabular-nums" style={{ marginTop: 6, fontFamily: "'Space Grotesk',sans-serif", fontSize: 22, fontWeight: 600 }}>{f.value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* pending invoices */}
      <div className="glass-card" style={{ marginTop: 16, padding: 22 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600 }}>חשבוניות שממתינות לתשלום</div>
            <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>סה״כ ₪ 11,350 · 5 חשבוניות</div>
          </div>
          <a href="#" style={{ fontSize: 12.5, fontWeight: 600, color: '#0b7688' }}>כל החשבוניות</a>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {INVOICES.map((i) => (
            <div key={i.number} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 0', borderBottom: '1px solid rgba(15,23,42,.06)' }}>
              <span style={{ flex: 'none', width: 34, height: 34, borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff', background: i.tint }}>{i.initials}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{i.name}</div>
                <div style={{ fontSize: 11.5, color: '#94a3b8' }}>חשבונית {i.number} · יעד {i.due}</div>
              </div>
              <span style={i.pill}>{i.status}</span>
              <span className="tabular-nums" style={{ fontSize: 14, fontWeight: 600, color: '#0f172a', minWidth: 70, textAlign: 'end' }}>{i.amount}</span>
            </div>
          ))}
        </div>
      </div>

      {/* transactions table */}
      <div className="glass-card" style={{ marginTop: 16, padding: 0, overflow: 'hidden' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '20px 22px 14px' }}>
          <div style={{ fontSize: 15, fontWeight: 600 }}>תנועות אחרונות</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <div style={{ position: 'relative' }}>
              <span style={{ pointerEvents: 'none', position: 'absolute', insetInlineStart: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}>
                <Ico inner={P.search} size={14} style={{ strokeWidth: 1.8 }} />
              </span>
              <input value={txnSearch} onChange={(e) => { setTxnSearch(e.target.value); setTxnShow(8); }} placeholder="חיפוש…" style={{ border: '1px solid rgba(15,23,42,.16)', background: '#fff', borderRadius: 10, padding: '7px 10px 7px 30px', fontFamily: 'inherit', fontSize: 13, outline: 'none', width: 150 }} />
            </div>
            <select value={txnType} onChange={(e) => { setTxnType(e.target.value as 'all' | 'in' | 'out'); setTxnShow(8); }} style={selStyle}>
              <option value="all">הכל</option>
              <option value="in">הכנסות</option>
              <option value="out">הוצאות</option>
            </select>
            <select value={txnCat} onChange={(e) => { setTxnCat(e.target.value); setTxnShow(8); }} style={selStyle}>
              {catOptions.map((o) => <option key={o} value={o}>{o === 'all' ? 'כל הקטגוריות' : o}</option>)}
            </select>
            <button type="button" onClick={() => exportTxns(filtered)} style={{ cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 5, border: '1px solid rgba(15,23,42,.16)', background: '#fff', borderRadius: 10, padding: '7px 11px', fontSize: 13, fontWeight: 600, color: '#0f172a' }}>
              <Ico inner={P.csv} size={14} />CSV
            </button>
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', minWidth: 640, borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(15,23,42,.08)', background: 'rgba(241,245,249,.5)' }}>
                {txnCols.map((col) => (
                  <th key={col.key} className="cf-th" onClick={() => onSort(col.key)} style={{ padding: '11px 16px', textAlign: 'start', fontSize: 12, fontWeight: 600, color: '#55627a', whiteSpace: 'nowrap' }}>
                    {col.label}<span style={{ marginInlineStart: 4, color: '#0e8ba0' }}>{txnSort === col.key ? (txnDir > 0 ? '↑' : '↓') : ''}</span>
                  </th>
                ))}
                <th style={{ padding: '11px 16px', textAlign: 'start', fontSize: 12, fontWeight: 600, color: '#55627a' }}>סכום</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((t) => (
                <tr key={t.id} className="txn-row" onClick={() => setTxnId(t.id)} style={{ borderBottom: '1px solid rgba(15,23,42,.06)', cursor: 'pointer', transition: 'background .15s ease' }}>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ width: 8, height: 8, borderRadius: 999, background: t.kind === 'in' ? '#12805c' : '#d1453b' }} />
                      <span style={{ fontWeight: 500, color: '#0f172a' }}>{t.desc}</span>
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', color: '#55627a' }}>{t.cat}</td>
                  <td style={{ padding: '12px 16px', color: '#55627a' }}>{t.date}</td>
                  <td style={{ padding: '12px 16px', color: '#55627a' }}>{t.method}</td>
                  <td className="tabular-nums" style={{ padding: '12px 16px', fontWeight: 600, color: t.kind === 'in' ? '#12805c' : '#d1453b' }}>{(t.kind === 'in' ? '+ ' : '− ') + shk(t.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {txnEmpty && <div style={{ padding: 40, textAlign: 'center', fontSize: 14, color: '#55627a' }}>לא נמצאו תנועות</div>}
        {hasMore && (
          <div style={{ padding: 14, textAlign: 'center', borderTop: '1px solid rgba(15,23,42,.06)' }}>
            <button type="button" onClick={() => setTxnShow((s) => s + 6)} style={{ cursor: 'pointer', fontFamily: 'inherit', border: '1px solid rgba(15,23,42,.16)', background: '#fff', borderRadius: 10, padding: '8px 20px', fontSize: 13.5, fontWeight: 600, color: '#0f172a' }}>הצג עוד ({remaining})</button>
          </div>
        )}
      </div>

      {/* feature cards */}
      <div className="r-2" style={{ marginTop: 20, display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 12 }}>
        {FEATURES.map((f) => (
          <div key={f.title} className="glass-card cf-feat" style={{ padding: 20 }}>
            <span style={{ display: 'flex', width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center', background: 'rgba(14,139,160,.1)', color: '#0e8ba0', marginBottom: 12 }}>
              <Ico inner={f.icon} size={20} />
            </span>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>{f.title}</h3>
            <p style={{ margin: '6px 0 0', fontSize: 13, color: '#55627a', lineHeight: 1.55 }}>{f.desc}</p>
          </div>
        ))}
      </div>

      {/* ADD TXN DRAWER */}
      {addOpen && (
        <>
          <div onClick={() => setAddOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(15,23,42,.28)', animation: 'dash-fade .2s ease both' }} />
          <aside dir="rtl" style={{ position: 'fixed', top: 0, insetInlineStart: 0, zIndex: 61, width: 'min(420px,94vw)', height: '100vh', background: '#fff', boxShadow: '0 12px 40px rgba(15,23,42,.2)', display: 'flex', flexDirection: 'column', animation: 'dash-drawer-in .28s cubic-bezier(.22,1,.36,1) both' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 22px', borderBottom: '1px solid rgba(15,23,42,.08)' }}>
              <div style={{ fontSize: 17, fontWeight: 600 }}>תנועה חדשה</div>
              <button type="button" onClick={() => setAddOpen(false)} aria-label="סגור" style={{ cursor: 'pointer', border: 'none', background: 'none', color: '#94a3b8' }}><Ico inner={P.close} size={20} style={{ strokeWidth: 1.8 }} /></button>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); addTxn(); }} className="cf-scroll" style={{ flex: 1, overflowY: 'auto', padding: 22, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                {([{ k: 'out' as const, label: 'הוצאה' }, { k: 'in' as const, label: 'הכנסה' }]).map((o) => {
                  const on = addForm.kind === o.k;
                  const acc = o.k === 'in' ? '#12805c' : '#d1453b';
                  return (
                    <button key={o.k} type="button" onClick={() => setAddForm((s) => ({ ...s, kind: o.k }))} style={{ cursor: 'pointer', fontFamily: 'inherit', flex: 1, borderRadius: 11, padding: 10, fontSize: 14, fontWeight: 600, border: `1px solid ${on ? acc : 'rgba(15,23,42,.16)'}`, background: on ? (o.k === 'in' ? 'rgba(18,128,92,.1)' : 'rgba(209,69,59,.09)') : '#fff', color: on ? acc : '#55627a' }}>{o.label}</button>
                  );
                })}
              </div>
              <label style={{ display: 'block' }}>
                <span style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: '#55627a', marginBottom: 6 }}>תיאור</span>
                <input value={addForm.desc} onChange={setAf('desc')} placeholder="למשל: תשלום ספק" style={{ width: '100%', border: '1px solid rgba(15,23,42,.16)', borderRadius: 11, padding: '10px 12px', fontFamily: 'inherit', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
              </label>
              <label style={{ display: 'block' }}>
                <span style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: '#55627a', marginBottom: 6 }}>סכום (₪)</span>
                <input value={addForm.amount} onChange={setAf('amount')} placeholder="0" style={{ width: '100%', border: '1px solid rgba(15,23,42,.16)', borderRadius: 11, padding: '10px 12px', fontFamily: 'inherit', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
              </label>
              <label style={{ display: 'block' }}>
                <span style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: '#55627a', marginBottom: 6 }}>קטגוריה</span>
                <input value={addForm.cat} onChange={setAf('cat')} placeholder="למשל: ספקים" style={{ width: '100%', border: '1px solid rgba(15,23,42,.16)', borderRadius: 11, padding: '10px 12px', fontFamily: 'inherit', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
              </label>
              <label style={{ display: 'block' }}>
                <span style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: '#55627a', marginBottom: 6 }}>אמצעי</span>
                <select value={addForm.method} onChange={setAf('method')} style={{ width: '100%', border: '1px solid rgba(15,23,42,.16)', borderRadius: 11, padding: '10px 12px', fontFamily: 'inherit', fontSize: 14, color: '#0f172a', background: '#fff', outline: 'none', boxSizing: 'border-box' }}>
                  <option value="אשראי">אשראי</option>
                  <option value="העברה">העברה בנקאית</option>
                  <option value="מזומן">מזומן</option>
                  <option value="חשבונית">חשבונית</option>
                </select>
              </label>
              <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                <button type="submit" style={{ cursor: 'pointer', fontFamily: 'inherit', flex: 1, border: 'none', borderRadius: 12, background: '#0e8ba0', color: '#fff', padding: 12, fontSize: 14, fontWeight: 600 }}>הוספה</button>
                <button type="button" onClick={() => setAddOpen(false)} style={{ cursor: 'pointer', fontFamily: 'inherit', border: '1px solid rgba(15,23,42,.16)', borderRadius: 12, background: '#fff', color: '#0f172a', padding: '12px 18px', fontSize: 14, fontWeight: 600 }}>ביטול</button>
              </div>
            </form>
          </aside>
        </>
      )}

      {/* TXN DETAIL DRAWER */}
      {txnOpen && txnDetail && (
        <>
          <div onClick={() => setTxnId(null)} style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(15,23,42,.28)', animation: 'dash-fade .2s ease both' }} />
          <aside dir="rtl" style={{ position: 'fixed', top: 0, insetInlineStart: 0, zIndex: 61, width: 'min(420px,94vw)', height: '100vh', background: '#fff', boxShadow: '0 12px 40px rgba(15,23,42,.2)', display: 'flex', flexDirection: 'column', animation: 'dash-drawer-in .28s cubic-bezier(.22,1,.36,1) both' }}>
            <div style={{ padding: 22, borderBottom: '1px solid rgba(15,23,42,.08)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <div style={{ fontSize: 12, color: txnDetail.kind === 'in' ? '#12805c' : '#d1453b', fontWeight: 600 }}>{txnDetail.kind === 'in' ? 'הכנסה' : 'הוצאה'}</div>
                <div className="tabular-nums" style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 28, fontWeight: 600, marginTop: 4, color: txnDetail.kind === 'in' ? '#12805c' : '#d1453b' }}>{(txnDetail.kind === 'in' ? '+ ' : '− ') + shk(txnDetail.amount)}</div>
                <div style={{ fontSize: 14, color: '#0f172a', marginTop: 6 }}>{txnDetail.desc}</div>
              </div>
              <button type="button" onClick={() => setTxnId(null)} aria-label="סגור" style={{ cursor: 'pointer', border: 'none', background: 'none', color: '#94a3b8' }}><Ico inner={P.close} size={20} style={{ strokeWidth: 1.8 }} /></button>
            </div>
            <div className="cf-scroll" style={{ flex: 1, overflowY: 'auto', padding: 22 }}>
              <div style={{ border: '1px solid rgba(15,23,42,.08)', borderRadius: 12, padding: 14, display: 'flex', flexDirection: 'column', gap: 9 }}>
                {[
                  { label: 'קטגוריה', value: txnDetail.cat },
                  { label: 'תאריך', value: txnDetail.date + '.2026' },
                  { label: 'אמצעי', value: txnDetail.method },
                  { label: 'סטטוס', value: 'נרשם' },
                ].map((f) => (
                  <div key={f.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5 }}>
                    <span style={{ color: '#94a3b8' }}>{f.label}</span>
                    <span style={{ color: '#0f172a', fontWeight: 500 }}>{f.value}</span>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 20, fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: '#94a3b8', marginBottom: 10 }}>מקור</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 11, border: '1px solid rgba(15,23,42,.08)', borderRadius: 12, padding: '12px 14px' }}>
                <span style={{ flex: 'none', width: 36, height: 36, borderRadius: 10, background: 'rgba(14,139,160,.1)', color: '#0e8ba0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Ico inner={P.doc} size={18} style={{ strokeWidth: 1.6 }} /></span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{txnDetail.source}</div>
                  <div style={{ fontSize: 11.5, color: '#94a3b8' }}>נקלט אוטומטית</div>
                </div>
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
