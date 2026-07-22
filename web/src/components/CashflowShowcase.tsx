import { motion } from 'framer-motion';
import { FrameSequence } from './FrameSequence';
import {
  Receipt,
  TrendingDown,
  LineChart as LineChartIcon,
  Bell,
  CreditCard,
  ShoppingCart,
  ShoppingBag,
  Wallet,
  Banknote,
  Store,
  FileUp,
  ArrowUpRight,
  ArrowDownRight,
  PanelsTopLeft,
} from 'lucide-react';
import type { ComponentType } from 'react';

/* Cashflow "coming soon" showcase — the rich dashboard-mockup layout from the
   21st.dev reference, on Easy Life's LIGHT theme.

   Motion note: content is ALWAYS visible (no opacity-0-gated entrance, which can
   freeze invisible if rAF is paused). Movement comes from things that don't hide
   content — the area chart draws itself in, cards lift on hover, and a live dot
   pulses — so it reads as alive, never static, and never blank. */

type Feature = { title: string; subtitle: string; icon: ComponentType<{ className?: string }> };
type Source = { name: string; subtitle: string; icon: ComponentType<{ className?: string }> };
type Stat = { label: string; value: string; delta: string; up: boolean; note: string };

const STATS: Stat[] = [
  { label: 'הכנסות החודש', value: '₪48,200', delta: '+12.5%', up: true, note: 'מגמת עלייה החודש' },
  { label: 'הוצאות החודש', value: '₪29,800', delta: '-8%', up: false, note: 'ירידה מהחודש שעבר' },
  { label: 'מאזן נטו', value: '₪18,400', delta: '+21%', up: true, note: 'תזרים חיובי' },
  { label: 'צפי לחודש הבא', value: '₪22,100', delta: '+9%', up: true, note: 'על בסיס המגמה' },
];

const FEATURES: Feature[] = [
  { title: 'זיהוי הכנסות אוטומטי', subtitle: 'כל חשבונית, סליקה והזמנה מהחנות נכנסת לתזרים לבד — בלי הקלדה ובלי אקסל.', icon: Receipt },
  { title: 'מעקב הוצאות חכם', subtitle: 'המערכת מסווגת את ההוצאות ומראה בדיוק לאן הכסף הולך בכל חודש.', icon: TrendingDown },
  { title: 'תחזית תזרים', subtitle: 'רואים קדימה מתי צפוי מחסור או עודף במזומן — לפני שזה קורה.', icon: LineChartIcon },
  { title: 'התראות בזמן אמת', subtitle: 'מקבלים התראה לפני שהיתרה יורדת מתחת לסף שהגדרתם.', icon: Bell },
];

const SOURCES: Source[] = [
  { name: 'חשבונית ירוקה', subtitle: 'חשבוניות וקבלות', icon: Receipt },
  { name: 'Grow · משולם', subtitle: 'סליקת אשראי', icon: CreditCard },
  { name: 'WooCommerce', subtitle: 'הזמנות מהחנות', icon: ShoppingCart },
  { name: 'Shopify', subtitle: 'הזמנות מהחנות', icon: ShoppingBag },
  { name: 'PayPal', subtitle: 'תשלומים', icon: Wallet },
  { name: 'Stripe', subtitle: 'תשלומים', icon: Banknote },
  { name: 'Square', subtitle: 'תשלומים בעסק', icon: Store },
  { name: 'ייבוא CSV', subtitle: 'נתונים ידניים', icon: FileUp },
];

const SERIES = [
  38, 42, 40, 47, 44, 52, 49, 55, 51, 58, 54, 50, 57, 62, 59, 66, 61, 57, 64, 60,
  68, 65, 72, 69, 63, 70, 74, 71, 66, 73, 78, 75, 70, 77, 82, 79, 74, 81, 86, 90,
];
const MONTHS = ['אפר', 'מאי', 'יוני'];

function areaPaths(values: number[], w: number, h: number, pad = 6) {
  const max = Math.max(...values) + 6;
  const min = Math.min(...values) - 6;
  const stepX = w / (values.length - 1);
  const y = (v: number) => pad + (h - pad * 2) * (1 - (v - min) / (max - min));
  const pts = values.map((v, i) => [i * stepX, y(v)] as const);
  const line = pts.map(([x, py], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${py.toFixed(1)}`).join(' ');
  const areaFill = `${line} L${w},${h} L0,${h} Z`;
  return { line, areaFill };
}

export default function CashflowShowcase() {
  const { line, areaFill } = areaPaths(SERIES, 900, 210);

  return (
    <div className="relative overflow-hidden rounded-[2rem] border border-border bg-gradient-to-b from-white to-[#eef2f8] p-6 shadow-card md:p-10">
      {/* Header + rendered-3D growth animation */}
      <header className="mb-8 grid items-center gap-6 lg:grid-cols-2">
        <div className="max-w-xl">
          <div className="mb-3 inline-flex items-center gap-1.5 text-xs font-medium text-gold">
            <span className="h-1.5 w-1.5 rounded-full bg-gold" style={{ animation: 'pulse-dot 2s ease-in-out infinite' }} />
            מתעדכן בזמן אמת
          </div>
          <h2
            className="text-4xl font-bold leading-[1.05] tracking-tight text-ink md:text-6xl"
            style={{ fontFamily: "'Space Grotesk','Heebo',sans-serif" }}
          >
            כל התזרים שלך,
            <br />
            <span className="text-gradient">בזמן אמת.</span>
          </h2>
          <p className="mt-4 text-base leading-relaxed text-muted">
            הכנסות, הוצאות ותחזית — נאספים לבד מחשבוניות, סליקה והזמנות מהחנות. בלי חיבור לבנק ובלי גיליון אלקטרוני.
          </p>
        </div>
        <div className="relative hidden overflow-hidden rounded-2xl lg:block">
          <FrameSequence
            base="/art/seq/growth/f_"
            count={61}
            fps={12}
            className="h-[240px] w-full"
            ariaLabel="אנימציית תלת-ממד של עקומת צמיחה"
          />
          {/* soft blend into the card background */}
          <div className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-inset ring-border" />
        </div>
      </header>

      {/* Dashboard-mockup preview card */}
      <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-raised">
        <div className="flex items-center gap-2 border-b border-border px-4 py-2.5 text-muted">
          <PanelsTopLeft className="h-4 w-4" />
          <span className="text-sm font-medium text-ink">תזרים</span>
        </div>

        {/* stat cards */}
        <div className="grid grid-cols-2 gap-3 p-3 md:grid-cols-4">
          {STATS.map((s) => (
            <div key={s.label} className="rounded-xl border border-border bg-surface p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted">{s.label}</span>
                <span className={`flex items-center gap-0.5 text-[11px] font-medium ${s.up ? 'text-success' : 'text-danger'}`}>
                  {s.delta}
                  {s.up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                </span>
              </div>
              <div className="mt-2 text-2xl font-semibold tracking-tight text-ink tabular-nums">{s.value}</div>
              <div className="mt-1 text-[11px] text-faint">{s.note}</div>
            </div>
          ))}
        </div>

        {/* area chart — line draws itself in; area fill is always visible */}
        <div className="p-3 pt-0">
          <div className="rounded-xl border border-border p-4">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-ink">תזרים נטו</div>
                <div className="text-xs text-faint">ב-3 החודשים האחרונים</div>
              </div>
              <div className="flex gap-1 rounded-lg bg-surface-raised p-0.5 text-[11px]">
                <span className="rounded-md bg-surface px-2 py-1 font-medium text-ink shadow-sm">3 חודשים</span>
                <span className="px-2 py-1 text-faint">30 יום</span>
              </div>
            </div>
            <svg viewBox="0 0 900 210" className="h-40 w-full" preserveAspectRatio="none">
              <defs>
                <linearGradient id="cf-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-gold)" stopOpacity="0.26" />
                  <stop offset="100%" stopColor="var(--color-gold)" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path d={areaFill} fill="url(#cf-fill)" />
              <motion.path
                d={line}
                fill="none"
                stroke="var(--color-gold)"
                strokeWidth="2.5"
                strokeLinejoin="round"
                strokeLinecap="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 1.8, ease: 'easeInOut' }}
              />
              {/* live dot travelling the curve forever (SMIL — zero JS, GPU-cheap) */}
              <circle r="7" fill="var(--color-gold)" opacity="0.18">
                <animateMotion dur="7s" repeatCount="indefinite" path={line} />
              </circle>
              <circle r="3.5" fill="var(--color-gold)" stroke="#fff" strokeWidth="1.5">
                <animateMotion dur="7s" repeatCount="indefinite" path={line} />
              </circle>
            </svg>
            <div className="mt-2 flex justify-between px-1 text-[11px] text-faint">
              {MONTHS.map((m) => (
                <span key={m}>{m}</span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Feature cards */}
      <section className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {FEATURES.map((f) => {
          const Icon = f.icon;
          return (
            <motion.div
              key={f.title}
              whileHover={{ y: -3 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              className="rounded-xl border border-border bg-surface p-5 shadow-card hover:shadow-pop"
            >
              <span className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-gold-soft text-gold">
                <Icon className="h-5 w-5" />
              </span>
              <h3 className="mb-1 text-sm font-semibold text-ink">{f.title}</h3>
              <p className="text-xs leading-relaxed text-muted">{f.subtitle}</p>
            </motion.div>
          );
        })}
      </section>

      {/* Financial sources */}
      <div className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-ink">מתחבר למקורות שכבר יש לך</h3>
          <span className="text-xs text-faint">ללא חיבור לבנק</span>
        </div>
        <div className="grid grid-cols-2 gap-1 md:grid-cols-4">
          {SOURCES.map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.name} className="flex items-center gap-3 rounded-xl p-3 transition hover:bg-surface-raised">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface text-gold shadow-card ring-1 ring-border">
                  <Icon className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-ink">{s.name}</div>
                  <div className="truncate text-xs text-muted">{s.subtitle}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* footer */}
      <div className="mt-8 flex items-center justify-center gap-2 border-t border-border pt-6 text-sm text-muted">
        התזרים ייפתח אוטומטית ברגע שתחברו מקור פיננסי אחד
        <ArrowUpRight className="h-4 w-4 text-gold" />
      </div>
    </div>
  );
}
