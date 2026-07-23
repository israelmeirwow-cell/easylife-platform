import { useMemo, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';

/* "תזרים" — Cashflow / Cash Intelligence, ported 1:1 from the Claude Design
   handoff (Cashflow.dc.html). Layout, copy, mock data, tint colors and the
   interactive income-vs-expenses chart (green income / red expense line,
   crosshair + dual tooltip, draw-in), the range chips + inline calendar, and
   the _chart()/R range-map recompute logic are all verbatim from the design's
   DCLogic. Colors are the design's literal values (they equal our tokens). */

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
  chart:
    '<path stroke-linecap="round" stroke-linejoin="round" d="M3.75 3v11.25A2.25 2.25 0 0 0 6 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0 1 18 16.5h-2.25m-7.5 0h7.5m-7.5 0-1 3m8.5-3 1 3m0 0 .5 1.5m-.5-1.5h-9.5m0 0-.5 1.5M9 11.25v1.5M12 9v3.75m3-6v6"/>',
  calendar:
    '<path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5"/>',
  arrowUpRight:
    '<path stroke-linecap="round" stroke-linejoin="round" d="M4.5 19.5 19.5 4.5m0 0H9m10.5 0V15"/>',
};

/* ---------- feature card icons (heroicons, from the design) ---------- */
const FEATURES = [
  {
    title: 'זיהוי הכנסות אוטומטי',
    desc: 'כל חשבונית, סליקה והזמנה מהחנות נכנסת לתזרים לבד — בלי הקלדה ובלי אקסל.',
    icon: '<path stroke-linecap="round" stroke-linejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25Z"/>',
  },
  {
    title: 'מעקב הוצאות חכם',
    desc: 'המערכת מסווגת את ההוצאות ומראה בדיוק לאן הכסף הולך בכל חודש.',
    icon: '<path stroke-linecap="round" stroke-linejoin="round" d="M2.25 6 9 12.75l4.286-4.286a11.948 11.948 0 0 1 4.306 6.43l.776 2.898m0 0 3.182-5.511m-3.182 5.51-5.511-3.181"/>',
  },
  {
    title: 'תחזית תזרים',
    desc: 'רואים קדימה מתי צפוי מחסור או עודף במזומן — לפני שזה קורה.',
    icon: '<path stroke-linecap="round" stroke-linejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z"/>',
  },
  {
    title: 'התראות בזמן אמת',
    desc: 'מקבלים התראה לפני שהיתרה יורדת מתחת לסף שהגדרתם.',
    icon: '<path stroke-linecap="round" stroke-linejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0"/>',
  },
];

/* ---------- source tiles (line SVG icons, from the design) ---------- */
const SOURCES = [
  { icon: '<path stroke-linecap="round" stroke-linejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25Z"/>', name: 'חשבונית ירוקה', sub: 'חשבוניות וקבלות' },
  { icon: '<path stroke-linecap="round" stroke-linejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Z"/>', name: 'Grow · משולם', sub: 'סליקת אשראי' },
  { icon: '<path stroke-linecap="round" stroke-linejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 0 0-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 0 0-16.536-1.84M7.5 14.25 5.106 5.272M6 20.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm12.75 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z"/>', name: 'WooCommerce', sub: 'הזמנות מהחנות' },
  { icon: '<path stroke-linecap="round" stroke-linejoin="round" d="M15.75 10.5V6a3.75 3.75 0 1 0-7.5 0v4.5m11.356-1.993 1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 0 1-1.12-1.243l1.264-12A1.125 1.125 0 0 1 5.513 7.5h12.974c.576 0 1.059.435 1.119 1.007Z"/>', name: 'Shopify', sub: 'הזמנות מהחנות' },
  { icon: '<path stroke-linecap="round" stroke-linejoin="round" d="M21 12a2.25 2.25 0 0 0-2.25-2.25H15a3 3 0 1 1-6 0H5.25A2.25 2.25 0 0 0 3 12m18 0v6a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 9m18 0V6a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 6v3"/>', name: 'PayPal', sub: 'תשלומים' },
  { icon: '<path stroke-linecap="round" stroke-linejoin="round" d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/>', name: 'Stripe', sub: 'תשלומים' },
  { icon: '<path stroke-linecap="round" stroke-linejoin="round" d="M13.5 21v-7.5a.75.75 0 0 1 .75-.75h3a.75.75 0 0 1 .75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349M3.75 21V9.349m0 0a3.001 3.001 0 0 0 3.75-.615A2.993 2.993 0 0 0 9.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 0 0 2.25 1.016c.896 0 1.7-.393 2.25-1.016a3.001 3.001 0 0 0 3.75.614m-16.5 0a3.004 3.004 0 0 1-.621-4.72l1.189-1.19A1.5 1.5 0 0 1 5.378 3h13.243a1.5 1.5 0 0 1 1.06.44l1.19 1.189a3 3 0 0 1-.621 4.72M6.75 18h3.75a.75.75 0 0 0 .75-.75V13.5a.75.75 0 0 0-.75-.75H6.75a.75.75 0 0 0-.75.75v3.75c0 .414.336.75.75.75Z"/>', name: 'Square', sub: 'תשלומים בעסק' },
  { icon: '<path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5"/>', name: 'ייבוא CSV', sub: 'נתונים ידניים' },
];

/* ---------- KPI stats (from the design's DCLogic) ---------- */
const STATS = [
  { label: 'הכנסות החודש', value: '₪ 48,200', delta: '+12.5%', up: true, note: 'מגמת עלייה החודש' },
  { label: 'הוצאות החודש', value: '₪ 29,800', delta: '-8%', up: false, note: 'ירידה מהחודש שעבר' },
  { label: 'מאזן נטו', value: '₪ 18,400', delta: '+21%', up: true, note: 'תזרים חיובי' },
  { label: 'צפי לחודש הבא', value: '₪ 22,100', delta: '+9%', up: true, note: 'על בסיס המגמה' },
];

const shk = (v: number) => '₪ ' + v.toLocaleString('he-IL');

const EXPENSE_CATS = [
  { name: 'שכר ועובדים', amount: 12400, pct: 42, color: '#0e8ba0' },
  { name: 'ספקים ומלאי', amount: 6900, pct: 23, color: '#1666a8' },
  { name: 'שיווק ופרסום', amount: 4200, pct: 14, color: '#7c6cf0' },
  { name: 'שכירות', amount: 3200, pct: 11, color: '#b26a00' },
  { name: 'תוכנה ומנויים', amount: 1800, pct: 6, color: '#0e7490' },
  { name: 'אחר', amount: 1300, pct: 4, color: '#94a3b8' },
];

const INCOME_SOURCES = [
  { name: 'מנויים ושירותים', amount: 26800, pct: 56, color: '#12805c' },
  { name: 'מכירות מהחנות', amount: 12500, pct: 26, color: '#0e8ba0' },
  { name: 'פרויקטים', amount: 6400, pct: 13, color: '#1666a8' },
  { name: 'אחר', amount: 2500, pct: 5, color: '#94a3b8' },
];

const TRANSACTIONS = [
  { date: '23.7', desc: 'תשלום מנוי — קליניקת נועה', cat: 'מנויים', kind: 'in' as const, amount: 349 },
  { date: '22.7', desc: 'ספק — חומרי גלם', cat: 'ספקים', kind: 'out' as const, amount: 2140 },
  { date: '22.7', desc: 'הזמנה מהחנות #1043', cat: 'חנות', kind: 'in' as const, amount: 1240 },
  { date: '21.7', desc: 'קמפיין פייסבוק', cat: 'שיווק', kind: 'out' as const, amount: 900 },
  { date: '20.7', desc: 'פרויקט — רשת אופנה URBAN', cat: 'פרויקטים', kind: 'in' as const, amount: 6400 },
  { date: '19.7', desc: 'שכירות משרד — יולי', cat: 'שכירות', kind: 'out' as const, amount: 3200 },
  { date: '18.7', desc: 'מנוי תוכנה — Grow', cat: 'תוכנה', kind: 'out' as const, amount: 190 },
];

/* ---------- chart engine (ported verbatim from DCLogic._chart / R) ---------- */
const TODAY = new Date('2026-07-23');
const fmtShort = (d: Date) => d.toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' });
const fmtLong = (d: Date) => d.toLocaleDateString('he-IL', { day: 'numeric', month: 'long', year: 'numeric' });

interface ChartSpec {
  n: number;
  start: string;
  spanDays: number;
  xLabels: string[];
  sub: string;
}

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
  const axisMax = Math.ceil((Math.max(...inV) + 6) / 10) * 10;
  const yFor = (v: number) => pad + (H - 2 * pad) * (1 - v / axisMax);
  const stepX = W / (n - 1);
  const inPts = inV.map((v, i) => ({ x: i * stepX, y: yFor(v) }));
  const outPts = outV.map((v, i) => ({ x: i * stepX, y: yFor(v) }));
  const toLine = (pts: { x: number; y: number }[]) =>
    pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const inPath = toLine(inPts), outPath = toLine(outPts);
  const inArea = `${inPath} L${W},${H} L0,${H} Z`;
  const grid: { y: string; top: string; label: string }[] = [];
  for (let k = 0; k <= 4; k++) {
    const v = axisMax * k / 4;
    const y = yFor(v);
    grid.push({ y: y.toFixed(1), top: (y / H * 100).toFixed(2) + '%', label: '₪ ' + Math.round(v) + 'K' });
  }
  const fmt = (d: Date) => d.toLocaleDateString('he-IL', { day: 'numeric', month: 'long' });
  const start = new Date(spec.start);
  const dates = inV.map((_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + Math.round(i * spec.spanDays / (n - 1)));
    return fmt(d);
  });
  return { inV, outV, inPts, outPts, inPath, outPath, inArea, grid, dates, xLabels: spec.xLabels, rangeSub: spec.sub, W, H };
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

export default function Cashflow() {
  const reduce = useReducedMotion();
  const [range, setRange] = useState('3m');
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [calOpen, setCalOpen] = useState(false);
  const [fromDate, setFromDate] = useState<Date | null>(null);
  const [calMonth, setCalMonth] = useState<Date | null>(null);
  const chartRef = useRef<HTMLDivElement>(null);

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
  const hoverNet = money(c.inV[idx] - c.outV[idx]);
  const hoverDate = (hoverActive ? '' : 'עדכני · ') + c.dates[idx];
  const hoverLeft = (inP.x / c.W * 100).toFixed(2) + '%';
  const hoverX = inP.x.toFixed(1);
  const hoverInTop = (inP.y / c.H * 100).toFixed(2) + '%';
  const hoverOutTop = (outP.y / c.H * 100).toFixed(2) + '%';

  function onMove(e: React.MouseEvent) {
    if (!chartRef.current) return;
    const rect = chartRef.current.getBoundingClientRect();
    let i = Math.round((e.clientX - rect.left) / rect.width * (n - 1));
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

  const rTabOn: React.CSSProperties = {
    cursor: 'pointer', fontFamily: 'inherit', border: 'none', borderRadius: 8, background: '#fff',
    fontWeight: 600, color: '#0f172a', boxShadow: '0 1px 2px rgba(15,23,42,.06)',
  };
  const rTabOff: React.CSSProperties = {
    cursor: 'pointer', fontFamily: 'inherit', border: 'none', borderRadius: 8, background: 'transparent',
    color: '#94a3b8',
  };

  const calBtnStyle: React.CSSProperties = {
    cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 5,
    borderRadius: 10, fontSize: 11, fontWeight: 600,
    ...(fromDate
      ? { border: '1px solid #0e8ba0', background: 'rgba(14,139,160,.1)', color: '#0b7688' }
      : { border: '1px solid rgba(15,23,42,.16)', background: '#fff', color: '#55627a' }),
  };
  const calBtnLabel = fromDate ? fmtShort(fromDate) : 'בחר תאריך';
  const fromLabel = fromDate ? 'מ־' + fmtLong(fromDate) : 'לא נבחר תאריך';

  const lineClass = reduce ? undefined : 'cf-line';

  return (
    <div dir="rtl" className="mx-auto max-w-[1180px]">
      {/* scoped animation/hover styles from the design */}
      <style>{`
        .cf-line { stroke-dasharray:1; stroke-dashoffset:1; animation:cf-draw 1.8s ease-in-out .2s forwards; }
        @keyframes cf-draw { to { stroke-dashoffset:0; } }
        .cf-feat { transition:transform .18s ease, box-shadow .18s ease; }
        .cf-feat:hover { transform:translateY(-3px); box-shadow:0 4px 12px rgba(15,23,42,.1); }
        .cf-src { transition:background .15s ease; }
        .cf-src:hover { background:#f1f5f9; }
        .cf-scroll { scrollbar-width:none; -ms-overflow-style:none; }
        .cf-scroll::-webkit-scrollbar { display:none; }
      `}</style>

      {/* header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 10, letterSpacing: '.25em', textTransform: 'uppercase', color: '#94a3b8', fontFamily: "'Space Grotesk',sans-serif" }}>Cash Intelligence</div>
        <h1 style={{ margin: '6px 0 0', fontSize: 26, fontWeight: 600, letterSpacing: '-.01em' }}>תזרים</h1>
        <p style={{ margin: '7px 0 0', fontSize: 14.5, color: '#55627a', maxWidth: '44em', lineHeight: 1.55 }}>
          תמונת מזומנים חיה מחשבוניות, סליקה והזמנות מהחנות — בלי חיבור לבנק ובלי אקסל.
        </p>
      </div>

      {/* hero */}
      <div style={{ border: '1px solid rgba(15,23,42,.08)', borderRadius: 28, overflow: 'hidden', background: 'linear-gradient(to bottom,#fff,#eef2f8)', boxShadow: '0 1px 2px rgba(15,23,42,.04)' }}>
        <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-6 items-center px-5 pt-6 pb-2.5 lg:px-[34px] lg:pt-[34px] lg:pb-[10px]">
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: '#0b7688' }}>
              <span className="animate-pulse-dot" style={{ width: 7, height: 7, borderRadius: 999, background: '#0e8ba0' }} />
              מתעדכן בזמן אמת
            </div>
            <h2 className="text-[32px] sm:text-[38px] lg:text-[44px]" style={{ margin: '12px 0 0', fontFamily: "'Space Grotesk','Heebo',sans-serif", fontWeight: 600, lineHeight: 1.05, letterSpacing: '-.02em' }}>
              כל התזרים שלך,<br /><span className="text-gradient">בזמן אמת.</span>
            </h2>
            <p style={{ margin: '14px 0 0', fontSize: 16, color: '#55627a', lineHeight: 1.6, maxWidth: '28em' }}>
              הכנסות, הוצאות ותחזית — נאספים לבד מחשבוניות, סליקה והזמנות מהחנות. בלי חיבור לבנק ובלי גיליון אלקטרוני.
            </p>
          </div>

          {/* balance card */}
          <div className="p-5 lg:p-[26px]" style={{ position: 'relative', borderRadius: 20, overflow: 'hidden', border: '1px solid rgba(15,23,42,.08)', background: '#fff', color: '#0f172a', minHeight: 214, display: 'flex', flexDirection: 'column', justifyContent: 'center', boxShadow: '0 1px 2px rgba(15,23,42,.04)' }}>
            <div style={{ position: 'relative' }}>
              <div style={{ fontSize: 12, letterSpacing: '.14em', color: '#0b7688', fontWeight: 600 }}>יתרה נוכחית</div>
              <div className="tabular-nums text-[36px] lg:text-[46px]" style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 600, letterSpacing: '-.02em', marginTop: 8, color: '#0f172a' }}>₪ 86,400</div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 13, color: '#12805c', marginTop: 6 }}>
                <Ico inner={P.trendUp} size={14} style={{ strokeWidth: 2 }} />
                21% מהחודש שעבר
              </div>
              <div style={{ marginTop: 22, paddingTop: 18, borderTop: '1px solid rgba(15,23,42,.08)', display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[
                  { dot: '#12805c', label: 'נכנס החודש', val: '₪ 48,200' },
                  { dot: '#d1453b', label: 'יצא החודש', val: '₪ 29,800' },
                  { dot: '#0e8ba0', label: 'ממתין לגבייה', val: '₪ 11,350' },
                ].map((r) => (
                  <div key={r.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#55627a' }}>
                      <span style={{ width: 8, height: 8, borderRadius: 999, background: r.dot }} />{r.label}
                    </span>
                    <span className="tabular-nums" style={{ fontSize: 14.5, fontWeight: 600, color: '#0f172a' }}>{r.val}</span>
                  </div>
                ))}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 10, borderTop: '1px dashed rgba(15,23,42,.1)' }}>
                  <span style={{ fontSize: 13, color: '#94a3b8' }}>צפי לחודש הבא</span>
                  <span className="tabular-nums" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 14.5, fontWeight: 600, color: '#12805c' }}>
                    <Ico inner={P.trendUp} size={13} style={{ strokeWidth: 2 }} />
                    ₪ 22,100
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* dashboard mockup */}
        <div className="mt-4 mx-3 mb-3 lg:mt-[22px] lg:mx-5 lg:mb-5" style={{ border: '1px solid rgba(15,23,42,.08)', borderRadius: 20, overflow: 'hidden', background: '#fff', boxShadow: '0 1px 3px rgba(15,23,42,.07)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid rgba(15,23,42,.08)', padding: '11px 16px' }}>
            <Ico inner={P.chart} size={16} style={{ color: '#55627a', strokeWidth: 1.6 }} />
            <span style={{ fontSize: 14, fontWeight: 600 }}>תזרים</span>
          </div>

          {/* KPI row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 p-3.5">
            {STATS.map((s) => (
              <div key={s.label} style={{ border: '1px solid rgba(15,23,42,.08)', borderRadius: 14, padding: 15 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 12, color: '#55627a' }}>{s.label}</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, fontSize: 11, fontWeight: 600, color: s.up ? '#12805c' : '#d1453b' }}>
                    {s.delta} <Ico inner={s.up ? P.arrowUp : P.arrowDown} size={12} />
                  </span>
                </div>
                <div className="tabular-nums" style={{ marginTop: 8, fontSize: 24, fontWeight: 600, letterSpacing: '-.01em' }}>{s.value}</div>
                <div style={{ marginTop: 3, fontSize: 11, color: '#94a3b8' }}>{s.note}</div>
              </div>
            ))}
          </div>

          {/* area chart */}
          <div style={{ padding: '0 14px 14px' }}>
            <div className="p-3 lg:p-4" style={{ border: '1px solid rgba(15,23,42,.08)', borderRadius: 14 }}>
              <div className="flex flex-wrap items-center justify-between gap-y-2 mb-3">
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>הכנסות מול הוצאות</div>
                  <div style={{ fontSize: 12, color: '#94a3b8' }}>{c.rangeSub}</div>
                </div>
                <div className="max-w-full" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  <div className="cf-scroll max-w-full overflow-x-auto" style={{ display: 'flex', gap: 2, borderRadius: 10, background: '#f1f5f9', padding: 2, fontSize: 11 }}>
                    {RANGE_DEFS.map((r) => (
                      <button
                        key={r.key}
                        type="button"
                        onClick={() => { setRange(r.key); setFromDate(null); setHoverIdx(null); setCalOpen(false); }}
                        className="shrink-0 whitespace-nowrap px-[11px] py-1 min-h-[40px] lg:min-h-0"
                        style={(!fromDate && range === r.key) ? rTabOn : rTabOff}
                      >
                        {r.label}
                      </button>
                    ))}
                  </div>
                  <button type="button" onClick={() => setCalOpen((v) => !v)} className="shrink-0 whitespace-nowrap px-[11px] py-1.5 min-h-[40px] lg:min-h-0" style={calBtnStyle}>
                    <Ico inner={P.calendar} size={14} style={{ strokeWidth: 1.7 }} />
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

              {/* net-balance readout + legend */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 4, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <span style={{ fontSize: 12, color: '#55627a' }}>מאזן נטו</span>
                  <span className="tabular-nums" style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 24, fontWeight: 600, color: '#0f172a' }}>{hoverNet}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginInlineStart: 'auto', fontSize: 12 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#55627a' }}>
                    <span style={{ width: 11, height: 11, borderRadius: 3, background: '#12805c' }} />הכנסות <b className="tabular-nums" style={{ color: '#0f172a', fontWeight: 600 }}>{hoverIn}</b>
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#55627a' }}>
                    <span style={{ width: 11, height: 11, borderRadius: 3, background: '#d1453b' }} />הוצאות <b className="tabular-nums" style={{ color: '#0f172a', fontWeight: 600 }}>{hoverOut}</b>
                  </span>
                </div>
              </div>
              <div style={{ fontSize: 11.5, color: '#94a3b8', marginBottom: 12 }}>{hoverDate}</div>

              {/* chart svg */}
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
                  <path d={c.inArea} fill="url(#cf-in)" />
                  <path key={`in-${range}-${fromDate?.getTime() ?? 'x'}`} className={lineClass} d={c.inPath} fill="none" stroke="#12805c" strokeWidth={2.4} strokeLinejoin="round" strokeLinecap="round" pathLength={1} />
                  <path key={`out-${range}-${fromDate?.getTime() ?? 'x'}`} className={lineClass} d={c.outPath} fill="none" stroke="#d1453b" strokeWidth={2.2} strokeLinejoin="round" strokeLinecap="round" pathLength={1} />
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
                    <span style={{ position: 'absolute', left: hoverLeft, top: hoverInTop, transform: 'translate(-50%,-50%)', width: 11, height: 11, borderRadius: 999, background: '#12805c', border: '2.5px solid #fff', boxShadow: '0 1px 4px rgba(18,128,92,.5)', pointerEvents: 'none' }} />
                    <span style={{ position: 'absolute', left: hoverLeft, top: hoverOutTop, transform: 'translate(-50%,-50%)', width: 11, height: 11, borderRadius: 999, background: '#d1453b', border: '2.5px solid #fff', boxShadow: '0 1px 4px rgba(209,69,59,.5)', pointerEvents: 'none' }} />
                    <div style={{ position: 'absolute', left: hoverLeft, top: hoverInTop, transform: 'translate(-50%,calc(-100% - 14px))', background: '#0f172a', color: '#fff', borderRadius: 10, padding: '8px 11px', fontSize: 11.5, whiteSpace: 'nowrap', pointerEvents: 'none', boxShadow: '0 8px 20px rgba(15,23,42,.25)' }}>
                      <div className="tabular-nums" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: '#31b98a' }} />הכנסות {hoverIn}</div>
                      <div className="tabular-nums" style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: '#e77' }} />הוצאות {hoverOut}</div>
                    </div>
                  </>
                )}
              </div>

              {/* x-axis labels */}
              <div dir="ltr" style={{ display: 'flex', justifyContent: 'space-between', padding: '0 4px', marginTop: 8, fontSize: 11, color: '#94a3b8' }}>
                {c.xLabels.map((x, i) => <span key={i}>{x}</span>)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* financial breakdown */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2" style={{ marginTop: 20 }}>
        <div className="glass-card" style={{ padding: 22 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ fontSize: 15, fontWeight: 600 }}>לאן הכסף הולך</div>
            <span style={{ fontSize: 12, color: '#94a3b8' }}>הוצאות החודש</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {EXPENSE_CATS.map((cat) => (
              <div key={cat.name}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, fontSize: 13 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#0f172a' }}>
                    <span style={{ width: 9, height: 9, borderRadius: 3, background: cat.color }} />{cat.name}
                  </span>
                  <span className="tabular-nums" style={{ color: '#55627a' }}>{shk(cat.amount)} · {cat.pct}%</span>
                </div>
                <div style={{ height: 7, borderRadius: 999, background: '#f1f5f9', overflow: 'hidden' }}>
                  <div style={{ width: `${cat.pct}%`, background: cat.color, height: '100%', borderRadius: 999 }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-card" style={{ padding: 22 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ fontSize: 15, fontWeight: 600 }}>מקורות הכנסה</div>
            <span style={{ fontSize: 12, color: '#94a3b8' }}>הכנסות החודש</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {INCOME_SOURCES.map((cat) => (
              <div key={cat.name}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, fontSize: 13 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#0f172a' }}>
                    <span style={{ width: 9, height: 9, borderRadius: 3, background: cat.color }} />{cat.name}
                  </span>
                  <span className="tabular-nums" style={{ color: '#55627a' }}>{shk(cat.amount)} · {cat.pct}%</span>
                </div>
                <div style={{ height: 7, borderRadius: 999, background: '#f1f5f9', overflow: 'hidden' }}>
                  <div style={{ width: `${cat.pct}%`, background: cat.color, height: '100%', borderRadius: 999 }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* recent transactions */}
      <div className="glass-card" style={{ marginTop: 16, padding: 22 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ fontSize: 15, fontWeight: 600 }}>תנועות אחרונות</div>
          <a href="#" style={{ fontSize: 12.5, fontWeight: 600, color: '#0b7688' }}>כל התנועות</a>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {TRANSACTIONS.map((t, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 0', borderBottom: '1px solid rgba(15,23,42,.06)' }}>
              <span style={{ width: 9, height: 9, borderRadius: 999, background: t.kind === 'in' ? '#12805c' : '#d1453b', flex: 'none' }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.desc}</div>
                <div style={{ fontSize: 11.5, color: '#94a3b8' }}>{t.date} · {t.cat}</div>
              </div>
              <span className="tabular-nums" style={{ fontSize: 14, fontWeight: 600, color: t.kind === 'in' ? '#12805c' : '#d1453b' }}>
                {(t.kind === 'in' ? '+ ' : '− ') + shk(t.amount)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* feature cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2" style={{ marginTop: 20 }}>
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

      {/* sources */}
      <div style={{ marginTop: 30 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>מתחבר למקורות שכבר יש לך</h3>
          <span style={{ fontSize: 12, color: '#94a3b8' }}>ללא חיבור לבנק</span>
        </div>
        <div className="grid grid-cols-2 gap-1.5 lg:grid-cols-4">
          {SOURCES.map((s) => (
            <div key={s.name} className="cf-src" style={{ display: 'flex', alignItems: 'center', gap: 12, borderRadius: 14, padding: 12 }}>
              <span style={{ flex: 'none', width: 40, height: 40, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0e8ba0', background: '#fff', boxShadow: '0 1px 2px rgba(15,23,42,.04)', border: '1px solid rgba(15,23,42,.08)' }}>
                <Ico inner={s.icon} size={20} />
              </span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</div>
                <div style={{ fontSize: 12, color: '#55627a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.sub}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, borderTop: '1px solid rgba(15,23,42,.08)', paddingTop: 22, fontSize: 14, color: '#55627a' }}>
        התזרים ייפתח אוטומטית ברגע שתחברו מקור פיננסי אחד
        <a href="/connections" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 600, color: '#0b7688' }}>
          לחיבורים <Ico inner={P.arrowUpRight} size={15} style={{ strokeWidth: 1.8 }} />
        </a>
      </div>
    </div>
  );
}
