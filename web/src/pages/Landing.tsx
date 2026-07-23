import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { useReducedMotion } from 'framer-motion';

/* Landing — the marketing page, ported 1:1 from the Claude Design handoff
   (design_files/Landing.dc.html). Standalone full page: its own top nav,
   hero, sections and footer — it does NOT use the app <Layout>.
   Layout, copy (Hebrew/RTL), mock data, tint colors and animations are
   verbatim from the design. Colors are the design's literal values (they
   equal our tokens). CTA links point to /dashboard. */

/* ---------- inline heroicons (exact paths from the design) ---------- */
function Ico({
  inner,
  size = 16,
  stroke = 'currentColor',
  strokeWidth = 1.6,
  className,
  style,
}: {
  inner: string;
  size?: number;
  stroke?: string;
  strokeWidth?: number;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke={stroke}
      strokeWidth={strokeWidth}
      width={size}
      height={size}
      className={className}
      style={style}
      dangerouslySetInnerHTML={{ __html: inner }}
    />
  );
}

const SPARKLES =
  '<path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456Z"/>';
const SPARKLES_SM =
  '<path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z"/>';
const TREND =
  '<path stroke-linecap="round" stroke-linejoin="round" d="M2.25 18 9 11.25l4.306 4.307a11.95 11.95 0 0 1 5.814-5.518l2.74-1.22m0 0-5.94-2.28m5.94 2.28-2.28 5.941"/>';
const CHECK = '<path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5"/>';

/* ---------- mock data (verbatim from the design's DCLogic) ---------- */
const iconSvg = (p: string) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" width="26" height="26">${p}</svg>`;

interface Agent {
  title: string;
  desc: string;
  status: string;
  icon: string;
}
const AGENTS: Agent[] = [
  {
    title: 'סוכן וידאו',
    desc: 'יוצר סרטוני מוצר ופרסום מוכנים לפרסום — מהתסריט ועד העריכה.',
    status: 'פעיל · מייצר כעת',
    icon: iconSvg(
      '<path stroke-linecap="round" stroke-linejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h8.25a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25H4.5A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z"/>',
    ),
  },
  {
    title: 'סוכן וואטסאפ',
    desc: 'שירות לקוחות 24/7 — עונה, מזמין תורים ומעביר לידים חמים אליכם.',
    status: 'פעיל · 24/7',
    icon: iconSvg(
      '<path stroke-linecap="round" stroke-linejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 0 1-.825-.242m9.345-8.334a2.126 2.126 0 0 0-.476-.095 48.64 48.64 0 0 0-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0 0 11.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155"/>',
    ),
  },
  {
    title: 'סוכן אינסטגרם',
    desc: 'מפרסם פוסטים וסטוריז, מגיב לתגובות ולהודעות — בקול של המותג שלכם.',
    status: 'פעיל · מתזמן',
    icon: iconSvg(
      '<path stroke-linecap="round" stroke-linejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z"/><path stroke-linecap="round" stroke-linejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0Z"/>',
    ),
  },
  {
    title: 'סוכן לידים',
    desc: 'לוכד כל פנייה מכל ערוץ, מסנן ומדרג — ומכניס אוטומטית לצינור המכירות.',
    status: 'פעיל · 12 לידים חדשים',
    icon: iconSvg(
      '<path stroke-linecap="round" stroke-linejoin="round" d="M15.59 14.37a6 6 0 0 1-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 0 0 6.16-12.12A14.98 14.98 0 0 0 9.631 8.41m5.96 5.96a14.926 14.926 0 0 1-5.841 2.58m-.119-8.54a6 6 0 0 0-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 0 0-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 0 1-2.448-2.448 14.9 14.9 0 0 1 .06-.312m-2.24 2.39a4.493 4.493 0 0 0-1.757 4.306 4.493 4.493 0 0 0 4.306-1.758M16.5 9a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Z"/>',
    ),
  },
  {
    title: 'סוכן תוכן',
    desc: 'כותב פוסטים, מיילים וניוזלטרים — לפי הטון והקמפיינים שלכם.',
    status: 'פעיל · טיוטה מוכנה',
    icon: iconSvg(
      '<path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125"/>',
    ),
  },
  {
    title: 'סוכן דוחות',
    desc: 'סיכום שבועי של מה שקרה בעסק, עם תובנות והמלצות — ישר לוואטסאפ.',
    status: 'פעיל · דוח יום א׳',
    icon: iconSvg(
      '<path stroke-linecap="round" stroke-linejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z"/>',
    ),
  },
];

const featIconSvg = (p: string) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" width="24" height="24">${p}</svg>`;
interface Feature {
  title: string;
  desc: string;
  icon: string;
}
const FEATURES: Feature[] = [
  {
    title: 'סקירה חכמה',
    desc: 'KPI חיים, שווי צינור והכנסות במבט אחד.',
    icon: featIconSvg(
      '<path stroke-linecap="round" stroke-linejoin="round" d="M2.25 13.5h3.86a2.25 2.25 0 0 1 2.012 1.244l.256.512a2.25 2.25 0 0 0 2.013 1.244h3.218a2.25 2.25 0 0 0 2.013-1.244l.256-.512a2.25 2.25 0 0 1 2.013-1.244h3.859m-19.5.338V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18v-4.162c0-.224-.034-.447-.1-.661L19.24 5.338a2.25 2.25 0 0 0-2.15-1.588H6.911a2.25 2.25 0 0 0-2.15 1.588L2.35 13.177a2.25 2.25 0 0 0-.1.661Z"/>',
    ),
  },
  {
    title: 'צינור בגרירה',
    desc: 'לוח עסקאות שמתעדכן בזמן אמת עם הסוכנים.',
    icon: featIconSvg(
      '<path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6Z"/>',
    ),
  },
  {
    title: 'פיד חי',
    desc: 'כל אירוע בעסק — הודעה, ליד, מכירה — כשהוא קורה.',
    icon: featIconSvg(
      '<path stroke-linecap="round" stroke-linejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z"/>',
    ),
  },
  {
    title: 'עוזר AI',
    desc: 'שואלים בשפה חופשית — הוא יודע הכל על העסק.',
    icon: featIconSvg(
      '<path stroke-linecap="round" stroke-linejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z"/>',
    ),
  },
];

interface BrainPoint {
  title: string;
  desc: string;
}
const BRAIN_POINTS: BrainPoint[] = [
  { title: 'CRM שממלא את עצמו', desc: 'כל שיחה, ליד ומכירה נרשמים אוטומטית — בלי הזנה ידנית.' },
  { title: 'רשומת אירועים אחת', desc: 'היסטוריה מלאה של כל מה שקרה, נגישה לכל סוכן ולכל אדם בצוות.' },
  { title: 'סוכנים שמדברים ביניהם', desc: 'סוכן הלידים מעדכן את סוכן הוואטסאפ — הכל מסונכרן מהמוח.' },
];

interface Step {
  num: string;
  title: string;
  desc: string;
}
const STEPS: Step[] = [
  { num: 'שלב 01', title: 'מחברים ערוצים', desc: 'וואטסאפ, אינסטגרם, מייל והחנות — בלחיצה אחת, בלי מפתחים.' },
  { num: 'שלב 02', title: 'מפעילים סוכנים', desc: 'בוחרים מהספרייה את הסוכנים שאתם צריכים והם מתחילים לעבוד.' },
  { num: 'שלב 03', title: 'רואים את המוח עובד', desc: 'ה‑CRM מתמלא לבד, הפיד זורם, ואתם מתמקדים בעסק.' },
];

const planBtn = (primary: boolean): CSSProperties =>
  primary
    ? {
        display: 'block',
        textAlign: 'center',
        marginTop: 22,
        fontWeight: 700,
        fontSize: 15,
        color: '#fff',
        background: '#0e8ba0',
        padding: 13,
        borderRadius: 12,
      }
    : {
        display: 'block',
        textAlign: 'center',
        marginTop: 22,
        fontWeight: 600,
        fontSize: 15,
        color: '#0f172a',
        background: '#fff',
        border: '1px solid rgba(15,23,42,.16)',
        padding: 13,
        borderRadius: 12,
      };

interface Plan {
  name: string;
  price: string;
  tagline: string;
  featured: boolean;
  features: string[];
  cardStyle: CSSProperties;
  nameColor: string;
  priceColor: string;
  mutedColor: string;
  featColor: string;
  checkColor: string;
  btnStyle: CSSProperties;
}
const PLANS: Plan[] = [
  {
    name: 'בסיס',
    price: '149',
    tagline: 'לעסק שרק מתחיל להאיץ',
    featured: false,
    features: ['3 סוכנים לבחירה', 'מוח מרכזי + CRM', 'עד 1,000 אירועים בחודש', 'תמיכה בצ׳אט'],
    cardStyle: {
      position: 'relative',
      padding: '32px 28px',
      borderRadius: 18,
      background: '#fff',
      border: '1px solid rgba(15,23,42,.08)',
      boxShadow: '0 1px 2px rgba(15,23,42,.04)',
    },
    nameColor: '#0f172a',
    priceColor: '#0f172a',
    mutedColor: '#55627a',
    featColor: '#0f172a',
    checkColor: '#0e8ba0',
    btnStyle: planBtn(false),
  },
  {
    name: 'עסקי',
    price: '349',
    tagline: 'הבחירה של רוב העסקים',
    featured: true,
    features: ['כל הסוכנים בספרייה', 'פיד אירועים חי + אישורים', 'עד 10,000 אירועים בחודש', 'עוזר AI מלא', 'תמיכה מועדפת'],
    cardStyle: {
      position: 'relative',
      padding: '36px 30px',
      borderRadius: 20,
      background: '#fff',
      border: '2px solid #0e8ba0',
      boxShadow: '0 24px 50px -24px rgba(14,139,160,.5)',
      transform: 'translateY(-8px)',
    },
    nameColor: '#0b7688',
    priceColor: '#0f172a',
    mutedColor: '#55627a',
    featColor: '#0f172a',
    checkColor: '#0e8ba0',
    btnStyle: planBtn(true),
  },
  {
    name: 'פרו',
    price: '699',
    tagline: 'לעסק שרץ במלוא הקצב',
    featured: false,
    features: ['אירועים ללא הגבלה', 'ניתוח מתקדם ותחזיות', 'משתמשים ללא הגבלה', 'מנהל לקוח ייעודי', 'API ואינטגרציות'],
    cardStyle: {
      position: 'relative',
      padding: '32px 28px',
      borderRadius: 18,
      background: '#0e1a2b',
      border: '1px solid rgba(34,184,207,.2)',
      boxShadow: '0 1px 2px rgba(15,23,42,.1)',
    },
    nameColor: '#22b8cf',
    priceColor: '#fff',
    mutedColor: '#9fb2c8',
    featColor: '#eef4fb',
    checkColor: '#22b8cf',
    btnStyle: {
      display: 'block',
      textAlign: 'center',
      marginTop: 22,
      fontWeight: 700,
      fontSize: 15,
      color: '#0e1a2b',
      background: '#22b8cf',
      padding: 13,
      borderRadius: 12,
    },
  },
];

interface Testimonial {
  quote: string;
  name: string;
  role: string;
  initials: string;
  tint: string;
}
const TESTIMONIALS: Testimonial[] = [
  {
    quote: 'תוך שבוע ה‑CRM התמלא לבד. הפסקתי לרדוף אחרי לידים — הם פשוט מופיעים מסודרים.',
    name: 'מיכל ברק',
    role: 'סטודיו לעיצוב פנים',
    initials: 'מב',
    tint: '#0e8ba0',
  },
  {
    quote: 'סוכן הוואטסאפ עונה ללקוחות בלילה במקומי. חסך לי עובד שלם.',
    name: 'יוסי דהן',
    role: 'מוסך דהן ובניו',
    initials: 'יד',
    tint: '#1666a8',
  },
  {
    quote: 'סוף סוף מערכת שמרגישה מקצועית ולא מסובכת. הכל בעברית, הכל במקום אחד.',
    name: 'נועה לוי',
    role: 'קליניקה פרטית',
    initials: 'נל',
    tint: '#12805c',
  },
];

interface Faq {
  question: string;
  answer: string;
}
const FAQ_DATA: Faq[] = [
  {
    question: 'צריך ידע טכני כדי להתחיל?',
    answer: 'ממש לא. מחברים את הערוצים בלחיצה, בוחרים סוכנים מהספרייה — והם מתחילים לעבוד. הכל בעברית ובלי קוד.',
  },
  {
    question: 'המידע שלי בטוח?',
    answer: 'כל הנתונים נשמרים במוח מרכזי מאובטח, מוצפנים, ובשרתים בישראל. רק אתם והצוות שלכם רואים אותם.',
  },
  {
    question: 'אפשר לבטל בכל רגע?',
    answer: 'כן. המנוי חודשי, ללא התחייבות. מבטלים בלחיצה ומפסיקים לשלם מהחודש הבא.',
  },
  {
    question: 'מה ההבדל מ‑CRM רגיל?',
    answer:
      'ב‑CRM רגיל אתם ממלאים הכל ידנית. אצלנו הסוכנים ממלאים את המערכת לבד — היא נבנתה סביב ה‑AI, לא הודבקה אליו.',
  },
];

const TRUST = ['WhatsApp', 'Instagram', 'Facebook', 'Email', 'החנות שלך', 'Google'];

/* ---------- count-up (respects reduced motion), fires on view ---------- */
function CountUp({
  to,
  prefix = '',
  suffix = '',
  style,
  className,
}: {
  to: number;
  prefix?: string;
  suffix?: string;
  style?: CSSProperties;
  className?: string;
}) {
  const [val, setVal] = useState(0);
  const [shown, setShown] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (ents) => {
        ents.forEach((en) => {
          if (en.isIntersecting) {
            setShown(true);
            io.unobserve(en.target);
          }
        });
      },
      { threshold: 0.5 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!shown) return;
    if (reduce) {
      setVal(to);
      return;
    }
    const start = performance.now();
    const dur = 1300;
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / dur);
      const e = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(to * e));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [shown, to, reduce]);

  return (
    <div ref={ref} style={style} className={className}>
      {prefix}
      {val.toLocaleString('he-IL')}
      {suffix}
    </div>
  );
}

/* ---------- interactive tilt (ported from onTilt/offTilt) ---------- */
function onTilt(e: React.MouseEvent<HTMLElement>) {
  const t = e.currentTarget;
  const r = t.getBoundingClientRect();
  const px = (e.clientX - r.left) / r.width - 0.5;
  const py = (e.clientY - r.top) / r.height - 0.5;
  t.style.transform = `perspective(1000px) rotateX(${(-py * 9).toFixed(2)}deg) rotateY(${(px * 9).toFixed(
    2,
  )}deg) translateY(-6px)`;
  t.style.boxShadow = '0 26px 60px -30px rgba(14,139,160,.5)';
}
function offTilt(e: React.MouseEvent<HTMLElement>) {
  e.currentTarget.style.transform = '';
  e.currentTarget.style.boxShadow = '';
}

const LANDING_CSS = `
.el-underline { position: relative; }
.el-underline::after { content:""; position:absolute; inset-inline-start:0; bottom:-2px; height:2px; width:0; background:#0e8ba0; transition:width .25s ease; }
.el-underline:hover::after { width:100%; }
.el-tilt { transition: transform .5s cubic-bezier(.22,1,.36,1), box-shadow .3s ease; will-change: transform; }
@keyframes el-float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
@keyframes el-float-slow { 0%,100% { transform: translateY(0); } 50% { transform: translateY(14px); } }
@keyframes el-rise { from { opacity:0; transform: translateY(18px); } to { opacity:1; transform:none; } }
.el-rise { animation: el-rise .7s cubic-bezier(.16,1,.3,1) both; }
.el-float { animation: el-float 6s ease-in-out infinite; }
.el-float-slow { animation: el-float-slow 7s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce) {
  .el-rise, .el-float, .el-float-slow { animation: none !important; }
}
`;

export default function Landing() {
  const [faqOpen, setFaqOpen] = useState<boolean[]>([true, false, false, false]);
  const toggleFaq = (i: number) =>
    setFaqOpen((s) => {
      const a = [...s];
      a[i] = !a[i];
      return a;
    });

  return (
    <div dir="rtl" lang="he" style={{ minHeight: '100vh', background: '#f5f7fb', color: '#0f172a', overflowX: 'hidden' }}>
      <style dangerouslySetInnerHTML={{ __html: LANDING_CSS }} />

      {/* ============ TOP NAV ============ */}
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 50,
          backdropFilter: 'saturate(180%) blur(12px)',
          background: 'rgba(245,247,251,.82)',
          borderBottom: '1px solid rgba(15,23,42,.08)',
        }}
      >
        <nav
          className="px-4 py-3 md:px-8 md:py-[14px]"
          style={{
            maxWidth: 1280,
            margin: '0 auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 24,
          }}
        >
          <a href="#top" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span
              style={{
                width: 34,
                height: 34,
                borderRadius: 10,
                background: '#0e8ba0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(14,139,160,.35)',
              }}
            >
              <Ico inner={SPARKLES} size={18} stroke="#fff" strokeWidth={1.7} />
            </span>
            <span className="whitespace-nowrap" style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 600, fontSize: 19, letterSpacing: '-.01em' }}>
              Easy<span style={{ color: '#0e8ba0' }}> Life</span>
            </span>
          </a>
          <div style={{ alignItems: 'center', gap: 28, fontSize: 14, color: '#55627a' }} className="el-navlinks hidden md:flex">
            <a href="#agents" className="el-underline" style={{ color: '#55627a' }}>
              הסוכנים
            </a>
            <a href="#brain" className="el-underline" style={{ color: '#55627a' }}>
              מוח אחד
            </a>
            <a href="#how" className="el-underline" style={{ color: '#55627a' }}>
              איך זה עובד
            </a>
            <a href="#product" className="el-underline" style={{ color: '#55627a' }}>
              המערכת
            </a>
            <a href="#pricing" className="el-underline" style={{ color: '#55627a' }}>
              תמחור
            </a>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Link
              to="/dashboard"
              className="inline-flex items-center whitespace-nowrap min-h-11 lg:min-h-0"
              style={{ fontSize: 14, fontWeight: 600, color: '#0f172a', padding: '9px 14px', borderRadius: 12 }}
            >
              התחברות
            </Link>
            <Link
              to="/dashboard"
              className="inline-flex items-center whitespace-nowrap min-h-11 lg:min-h-0"
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: '#fff',
                background: '#0e8ba0',
                padding: '9px 18px',
                borderRadius: 12,
                boxShadow: '0 4px 12px rgba(14,139,160,.28)',
                transition: 'background .18s ease',
              }}
              onMouseOver={(e) => (e.currentTarget.style.background = '#0b7688')}
              onMouseOut={(e) => (e.currentTarget.style.background = '#0e8ba0')}
            >
              התחלה חינם
            </Link>
          </div>
        </nav>
      </header>

      {/* ============ HERO ============ */}
      <section
        id="top"
        className="grid grid-cols-1 lg:grid-cols-[1.05fr_1fr] gap-10 lg:gap-14 px-4 pt-10 pb-8 lg:px-8 lg:pt-[72px] lg:pb-10"
        style={{
          maxWidth: 1280,
          margin: '0 auto',
          alignItems: 'center',
        }}
      >
        <div className="el-rise">
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 12,
              letterSpacing: '.16em',
              color: '#0b7688',
              background: 'rgba(14,139,160,.1)',
              padding: '6px 12px',
              borderRadius: 999,
              fontWeight: 600,
            }}
          >
            <span className="animate-pulse-dot" style={{ width: 7, height: 7, borderRadius: 999, background: '#12805c' }} />
            CRM שממלא את עצמו · מבוסס סוכני AI
          </span>
          <h1
            className="text-4xl sm:text-5xl lg:text-[60px]"
            style={{
              margin: '22px 0 0',
              fontFamily: "'Space Grotesk','Heebo',sans-serif",
              fontWeight: 600,
              lineHeight: 1.08,
              letterSpacing: '-.02em',
            }}
          >
            העסק שלך,
            <br />
            <span className="text-gradient">על אוטומט.</span>
          </h1>
          <p style={{ margin: '22px 0 0', fontSize: 19, lineHeight: 1.6, color: '#55627a', maxWidth: '30em' }}>
            ספרייה של סוכני AI מוכנים מראש — וידאו, וואטסאפ, אינסטגרם, לידים — שמתחברים בלחיצה אחת למוח מרכזי אחד. כל מה שקורה בעסק זורם
            ל‑CRM שממלא את עצמו.
          </p>
          <div style={{ marginTop: 30, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <Link
              to="/dashboard"
              style={{
                fontSize: 16,
                fontWeight: 700,
                color: '#fff',
                background: '#0e8ba0',
                padding: '15px 28px',
                borderRadius: 14,
                boxShadow: '0 8px 22px rgba(14,139,160,.32)',
                transition: 'transform .15s ease, background .18s ease',
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.background = '#0b7688';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.background = '#0e8ba0';
                e.currentTarget.style.transform = 'none';
              }}
            >
              כניסה למערכת ←
            </Link>
            <a
              href="#how"
              style={{
                fontSize: 16,
                fontWeight: 600,
                color: '#0f172a',
                padding: '15px 24px',
                borderRadius: 14,
                border: '1px solid rgba(15,23,42,.16)',
                background: '#fff',
                transition: 'background .18s ease',
              }}
              onMouseOver={(e) => (e.currentTarget.style.background = '#f1f5f9')}
              onMouseOut={(e) => (e.currentTarget.style.background = '#fff')}
            >
              איך זה עובד
            </a>
          </div>
          <div style={{ marginTop: 36, display: 'flex', alignItems: 'center', gap: 28, flexWrap: 'wrap' }}>
            <div>
              <CountUp
                to={2400}
                suffix="+"
                className="tabular-nums"
                style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 30, fontWeight: 600, color: '#0f172a' }}
              />
              <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 2 }}>עסקים על אוטומט</div>
            </div>
            <div style={{ width: 1, height: 38, background: 'rgba(15,23,42,.1)' }} />
            <div>
              <CountUp
                to={14}
                suffix=" שע׳"
                className="tabular-nums"
                style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 30, fontWeight: 600, color: '#0f172a' }}
              />
              <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 2 }}>נחסכות בשבוע</div>
            </div>
            <div style={{ width: 1, height: 38, background: 'rgba(15,23,42,.1)' }} />
            <div>
              <CountUp
                to={1}
                prefix="לחיצה "
                className="tabular-nums"
                style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 30, fontWeight: 600, color: '#0f172a' }}
              />
              <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 2 }}>לחיבור סוכן</div>
            </div>
          </div>
        </div>

        {/* 3D glass hero */}
        <div style={{ position: 'relative' }}>
          <div
            className="el-tilt"
            onMouseMove={onTilt}
            onMouseLeave={offTilt}
            style={{
              position: 'relative',
              borderRadius: 26,
              overflow: 'hidden',
              border: '1px solid rgba(15,23,42,.08)',
              boxShadow: '0 30px 80px -30px rgba(14,139,160,.45), 0 1px 2px rgba(15,23,42,.06)',
              aspectRatio: '16 / 11',
              background: '#eef3f6',
            }}
          >
            <img
              src="/art/hero/f_54.jpg"
              alt="דשבורד Easy Life"
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
            />
            {/* floating KPI chip */}
            <div
              className="el-float hidden sm:block"
              style={{
                position: 'absolute',
                top: 20,
                insetInlineStart: 20,
                background: 'rgba(255,255,255,.82)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(15,23,42,.06)',
                borderRadius: 14,
                padding: '12px 14px',
                boxShadow: '0 12px 32px rgba(15,23,42,.14)',
              }}
            >
              <div style={{ fontSize: 11, color: '#55627a', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Ico inner={TREND} size={14} stroke="#0e8ba0" strokeWidth={1.7} />
                נסגר החודש
              </div>
              <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 22, fontWeight: 600, marginTop: 3 }} className="tabular-nums">
                ₪ 128K
              </div>
            </div>
            {/* floating live chip */}
            <div
              className="el-float-slow hidden sm:flex"
              style={{
                position: 'absolute',
                bottom: 22,
                insetInlineEnd: 20,
                background: 'rgba(255,255,255,.82)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(15,23,42,.06)',
                borderRadius: 14,
                padding: '11px 14px',
                boxShadow: '0 12px 32px rgba(15,23,42,.14)',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <span
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  background: 'rgba(14,139,160,.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 16,
                }}
              >
                💬
              </span>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600 }}>סוכן וואטסאפ ענה ללקוח</div>
                <div style={{ fontSize: 11, color: '#94a3b8' }}>לפני 3 דק׳ · אוטומטי</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ TRUST STRIP ============ */}
      <section className="px-4 pt-5 pb-6 lg:px-8" style={{ maxWidth: 1280, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', fontSize: 12, letterSpacing: '.14em', color: '#94a3b8', marginBottom: 18 }}>
          מחובר לכל הערוצים שכבר יש לך
        </div>
        <div
          className="gap-6 lg:gap-11"
          style={{
            display: 'flex',
            justifyContent: 'center',
            flexWrap: 'wrap',
            color: '#55627a',
            fontWeight: 600,
            fontSize: 15,
            opacity: 0.85,
          }}
        >
          {TRUST.map((t) => (
            <span key={t}>{t}</span>
          ))}
        </div>
      </section>

      {/* ============ AGENTS ============ */}
      <section id="agents" className="px-4 py-12 lg:px-8 lg:py-[72px]" style={{ maxWidth: 1280, margin: '0 auto' }}>
        <div style={{ maxWidth: '38em' }}>
          <span style={{ fontSize: 12, letterSpacing: '.16em', color: '#0b7688', fontWeight: 600 }}>הסוכנים</span>
          <h2
            className="text-3xl lg:text-[40px]"
            style={{
              margin: '12px 0 0',
              fontFamily: "'Space Grotesk','Heebo',sans-serif",
              fontWeight: 600,
              letterSpacing: '-.02em',
              lineHeight: 1.15,
            }}
          >
            צוות עובדים דיגיטלי, מוכן מהיום הראשון
          </h2>
          <p style={{ margin: '14px 0 0', fontSize: 17, color: '#55627a', lineHeight: 1.6 }}>
            מפעילים סוכן בלחיצה, והוא מתחיל לעבוד. כל סוכן מחובר לאותו מוח — אז הם יודעים מה קורה, ומעדכנים אחד את השני.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5" style={{ marginTop: 40 }}>
          {AGENTS.map((a) => (
            <div
              key={a.title}
              className="glass-card el-tilt p-5 lg:p-[26px]"
              onMouseMove={onTilt}
              onMouseLeave={offTilt}
              style={{ borderRadius: 16, cursor: 'default' }}
            >
              <span
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 13,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'rgba(14,139,160,.1)',
                }}
              >
                <span style={{ color: '#0e8ba0' }} dangerouslySetInnerHTML={{ __html: a.icon }} />
              </span>
              <h3 style={{ margin: '18px 0 0', fontSize: 19, fontWeight: 600 }}>{a.title}</h3>
              <p style={{ margin: '8px 0 0', fontSize: 14.5, color: '#55627a', lineHeight: 1.6 }}>{a.desc}</p>
              <div
                style={{
                  marginTop: 16,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 12.5,
                  fontWeight: 600,
                  color: '#0b7688',
                }}
              >
                <span style={{ width: 6, height: 6, borderRadius: 999, background: '#12805c' }} />
                {a.status}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ============ ONE BRAIN ============ */}
      <section id="brain" style={{ background: '#fff', borderBlock: '1px solid rgba(15,23,42,.08)' }}>
        <div
          style={{
            maxWidth: 1280,
            margin: '0 auto',
            alignItems: 'center',
          }}
          className="grid grid-cols-1 gap-10 px-4 py-12 lg:grid-cols-[1fr_1.1fr] lg:gap-14 lg:px-8 lg:py-20"
        >
          <div style={{ position: 'relative' }}>
            <div
              className="el-tilt"
              onMouseMove={onTilt}
              onMouseLeave={offTilt}
              style={{
                position: 'relative',
                borderRadius: 24,
                overflow: 'hidden',
                border: '1px solid rgba(15,23,42,.08)',
                boxShadow: '0 24px 60px -28px rgba(14,139,160,.4)',
                aspectRatio: '1 / 1',
                background: '#eef3f6',
              }}
            >
              <img
                src="/art/hero/f_44.jpg"
                alt="המוח המרכזי של Easy Life"
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
              />
            </div>
          </div>
          <div>
            <span style={{ fontSize: 12, letterSpacing: '.16em', color: '#0b7688', fontWeight: 600 }}>מוח אחד</span>
            <h2
              className="text-3xl lg:text-[40px]"
              style={{
                margin: '12px 0 0',
                fontFamily: "'Space Grotesk','Heebo',sans-serif",
                fontWeight: 600,
                letterSpacing: '-.02em',
                lineHeight: 1.15,
              }}
            >
              עסק אחד. מוח אחד.
              <br />
              שקט בראש.
            </h2>
            <p style={{ margin: '16px 0 0', fontSize: 17, color: '#55627a', lineHeight: 1.65 }}>
              כל הסוכנים והאנשים בעסק שלך חולקים מצב אחד ורשומת אירועים אחת. אין העתקות, אין "שכחתי לעדכן" — ה‑CRM מתמלא לבד מכל שיחה, ליד
              ומכירה.
            </p>
            <div style={{ marginTop: 28, display: 'flex', flexDirection: 'column', gap: 16 }}>
              {BRAIN_POINTS.map((p) => (
                <div key={p.title} style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                  <span
                    style={{
                      flex: 'none',
                      width: 28,
                      height: 28,
                      borderRadius: 9,
                      background: 'rgba(18,128,92,.1)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Ico inner={CHECK} size={15} stroke="#12805c" strokeWidth={2} />
                  </span>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 15.5 }}>{p.title}</div>
                    <div style={{ fontSize: 14, color: '#55627a', marginTop: 2, lineHeight: 1.55 }}>{p.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ============ HOW IT WORKS ============ */}
      <section id="how" style={{ maxWidth: 1280, margin: '0 auto', padding: '80px 32px' }}>
        <div style={{ textAlign: 'center', maxWidth: '34em', margin: '0 auto' }}>
          <span style={{ fontSize: 12, letterSpacing: '.16em', color: '#0b7688', fontWeight: 600 }}>איך זה עובד</span>
          <h2
            className="text-3xl lg:text-[40px]"
            style={{
              margin: '12px 0 0',
              fontFamily: "'Space Grotesk','Heebo',sans-serif",
              fontWeight: 600,
              letterSpacing: '-.02em',
            }}
          >
            שלושה צעדים לעסק על אוטומט
          </h2>
        </div>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3" style={{ marginTop: 48 }}>
          {STEPS.map((s) => (
            <div
              key={s.num}
              style={{
                position: 'relative',
                padding: '32px 28px',
                borderRadius: 18,
                background: '#fff',
                border: '1px solid rgba(15,23,42,.08)',
                boxShadow: '0 1px 2px rgba(15,23,42,.04)',
              }}
            >
              <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 15, fontWeight: 600, color: '#0e8ba0' }}>{s.num}</div>
              <h3 style={{ margin: '14px 0 0', fontSize: 20, fontWeight: 600 }}>{s.title}</h3>
              <p style={{ margin: '10px 0 0', fontSize: 15, color: '#55627a', lineHeight: 1.6 }}>{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ============ PRODUCT SHOWCASE ============ */}
      <section id="product" style={{ background: '#0e1a2b', color: '#eef4fb' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '84px 32px' }}>
          <div style={{ textAlign: 'center', maxWidth: '40em', margin: '0 auto' }}>
            <span style={{ fontSize: 12, letterSpacing: '.16em', color: '#22b8cf', fontWeight: 600 }}>המערכת</span>
            <h2
              className="text-3xl lg:text-[40px]"
              style={{
                margin: '12px 0 0',
                fontFamily: "'Space Grotesk','Heebo',sans-serif",
                fontWeight: 600,
                letterSpacing: '-.02em',
                color: '#fff',
              }}
            >
              CRM שנראה ומרגיש מקצועי
            </h2>
            <p style={{ margin: '14px 0 0', fontSize: 17, color: '#9fb2c8', lineHeight: 1.6 }}>
              סקירה חיה, צינור מכירות בגרירה, פיד אירועים בזמן אמת, ועוזר AI שמכיר את כל העסק — הכל במקום אחד.
            </p>
          </div>
          <div style={{ marginTop: 44, perspective: '1600px' }}>
            <div
              className="el-tilt"
              style={{
                borderRadius: 20,
                overflow: 'hidden',
                border: '1px solid rgba(34,184,207,.2)',
                boxShadow: '0 40px 90px -30px rgba(0,0,0,.6)',
                transform: 'rotateX(6deg)',
                transformOrigin: 'center bottom',
              }}
            >
              <img
                src="/art/dashboard-shot.png"
                alt="דשבורד Easy Life"
                style={{ width: '100%', display: 'block', background: '#f5f7fb' }}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-5 lg:grid-cols-4" style={{ marginTop: 44 }}>
            {FEATURES.map((f) => (
              <div key={f.title} style={{ padding: 4 }}>
                <div style={{ color: '#22b8cf', marginBottom: 10 }} dangerouslySetInnerHTML={{ __html: f.icon }} />
                <div style={{ fontWeight: 600, fontSize: 16, color: '#fff' }}>{f.title}</div>
                <div style={{ fontSize: 14, color: '#9fb2c8', marginTop: 6, lineHeight: 1.55 }}>{f.desc}</div>
              </div>
            ))}
          </div>
          <div style={{ textAlign: 'center', marginTop: 44 }}>
            <Link
              to="/dashboard"
              style={{
                display: 'inline-block',
                fontSize: 16,
                fontWeight: 700,
                color: '#0e1a2b',
                background: '#22b8cf',
                padding: '15px 30px',
                borderRadius: 14,
                transition: 'transform .15s ease',
              }}
              onMouseOver={(e) => (e.currentTarget.style.transform = 'translateY(-2px)')}
              onMouseOut={(e) => (e.currentTarget.style.transform = 'none')}
            >
              כניסה לדשבורד החי ←
            </Link>
          </div>
        </div>
      </section>

      {/* ============ PRICING ============ */}
      <section id="pricing" style={{ maxWidth: 1280, margin: '0 auto', padding: '84px 32px' }}>
        <div style={{ textAlign: 'center', maxWidth: '34em', margin: '0 auto' }}>
          <span style={{ fontSize: 12, letterSpacing: '.16em', color: '#0b7688', fontWeight: 600 }}>תמחור</span>
          <h2
            className="text-3xl lg:text-[40px]"
            style={{
              margin: '12px 0 0',
              fontFamily: "'Space Grotesk','Heebo',sans-serif",
              fontWeight: 600,
              letterSpacing: '-.02em',
            }}
          >
            מחיר אחד קבוע. בלי הפתעות.
          </h2>
          <p style={{ margin: '14px 0 0', fontSize: 17, color: '#55627a' }}>
            במקום אלפי שקלים לחברת אוטומציה — מנוי חודשי שאפשר לבטל בכל רגע.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3" style={{ marginTop: 44, alignItems: "start" }}>
          {PLANS.map((p) => (
            <div key={p.name} style={p.cardStyle}>
              {p.featured && (
                <div
                  style={{
                    position: 'absolute',
                    top: 16,
                    insetInlineEnd: 16,
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: '.08em',
                    color: '#fff',
                    background: '#0e8ba0',
                    padding: '5px 10px',
                    borderRadius: 999,
                  }}
                >
                  הכי פופולרי
                </div>
              )}
              <div style={{ fontSize: 15, fontWeight: 600, color: p.nameColor }}>{p.name}</div>
              <div style={{ marginTop: 14, display: 'flex', alignItems: 'flex-end', gap: 4 }}>
                <span
                  className="tabular-nums"
                  style={{
                    fontFamily: "'Space Grotesk',sans-serif",
                    fontSize: 46,
                    fontWeight: 600,
                    letterSpacing: '-.02em',
                    color: p.priceColor,
                  }}
                >
                  {p.price}
                </span>
                <span style={{ fontSize: 15, color: p.mutedColor, marginBottom: 10 }}>₪ / חודש</span>
              </div>
              <p style={{ margin: '6px 0 0', fontSize: 14, color: p.mutedColor }}>{p.tagline}</p>
              <Link to="/dashboard" style={p.btnStyle}>
                התחלה
              </Link>
              <div style={{ marginTop: 22, display: 'flex', flexDirection: 'column', gap: 12 }}>
                {p.features.map((ft) => (
                  <div key={ft} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 14, color: p.featColor }}>
                    <Ico inner={CHECK} size={16} stroke={p.checkColor} strokeWidth={2.2} style={{ flex: 'none', marginTop: 2 }} />
                    <span>{ft}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ============ TESTIMONIALS ============ */}
      <section style={{ background: '#fff', borderBlock: '1px solid rgba(15,23,42,.08)' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '80px 32px' }}>
          <div style={{ textAlign: 'center', maxWidth: '32em', margin: '0 auto 44px' }}>
            <span style={{ fontSize: 12, letterSpacing: '.16em', color: '#0b7688', fontWeight: 600 }}>לקוחות</span>
            <h2
              className="text-3xl lg:text-[40px]"
              style={{
                margin: '12px 0 0',
                fontFamily: "'Space Grotesk','Heebo',sans-serif",
                fontSize: 38,
                fontWeight: 600,
                letterSpacing: '-.02em',
              }}
            >
              בעלי עסקים שכבר ישנים טוב בלילה
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            {TESTIMONIALS.map((t) => (
              <div
                key={t.name}
                className="glass-card"
                style={{ padding: 28, borderRadius: 16, display: 'flex', flexDirection: 'column', gap: 16 }}
              >
                <p style={{ fontSize: 16, lineHeight: 1.65, color: '#0f172a', margin: 0 }}>״{t.quote}״</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 'auto' }}>
                  <span
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 999,
                      background: t.tint,
                      color: '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 700,
                      fontSize: 14,
                    }}
                  >
                    {t.initials}
                  </span>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{t.name}</div>
                    <div style={{ fontSize: 12.5, color: '#94a3b8' }}>{t.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ FAQ ============ */}
      <section style={{ maxWidth: 820, margin: '0 auto', padding: '80px 32px' }}>
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <span style={{ fontSize: 12, letterSpacing: '.16em', color: '#0b7688', fontWeight: 600 }}>שאלות נפוצות</span>
          <h2
            className="text-3xl lg:text-[40px]"
            style={{
              margin: '12px 0 0',
              fontFamily: "'Space Grotesk','Heebo',sans-serif",
              fontSize: 36,
              fontWeight: 600,
              letterSpacing: '-.02em',
            }}
          >
            כל מה שרצית לדעת
          </h2>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {FAQ_DATA.map((q, i) => (
            <div
              key={q.question}
              style={{ border: '1px solid rgba(15,23,42,.08)', borderRadius: 14, background: '#fff', overflow: 'hidden' }}
            >
              <button
                onClick={() => toggleFaq(i)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 16,
                  padding: '18px 22px',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'start',
                  fontFamily: 'inherit',
                  fontSize: 16.5,
                  fontWeight: 600,
                  color: '#0f172a',
                }}
              >
                <span>{q.question}</span>
                <span
                  style={{
                    flex: 'none',
                    color: '#0e8ba0',
                    fontSize: 22,
                    transition: 'transform .2s ease',
                    transform: faqOpen[i] ? 'rotate(45deg)' : 'rotate(0deg)',
                  }}
                >
                  +
                </span>
              </button>
              {faqOpen[i] && (
                <div style={{ padding: '0 22px 20px', fontSize: 15, color: '#55627a', lineHeight: 1.65 }}>{q.answer}</div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ============ CTA BAND ============ */}
      <section style={{ maxWidth: 1280, margin: '0 auto', padding: '0 32px 84px' }}>
        <div
          style={{
            position: 'relative',
            overflow: 'hidden',
            borderRadius: 26,
            background: '#0e8ba0',
            padding: '64px 48px',
            textAlign: 'center',
            color: '#fff',
            boxShadow: '0 30px 70px -30px rgba(14,139,160,.6)',
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: 0,
              zIndex: 0,
              opacity: 0.28,
              background:
                'radial-gradient(circle at 20% 20%, #22b8cf, transparent 45%), radial-gradient(circle at 85% 80%, #6d8bf0, transparent 45%)',
            }}
          />
          <div style={{ position: 'relative', zIndex: 1 }}>
            <h2
              className="text-3xl lg:text-[40px]"
              style={{
                fontFamily: "'Space Grotesk','Heebo',sans-serif",
                fontWeight: 600,
                letterSpacing: '-.02em',
                margin: 0,
              }}
            >
              מוכנים לשקט בראש?
            </h2>
            <p style={{ margin: '14px auto 0', fontSize: 18, color: 'rgba(255,255,255,.9)', maxWidth: '34em' }}>
              חברו את הערוצים שלכם, הפעילו סוכן, ותראו את ה‑CRM מתמלא לבד. ניסיון חינם, בלי כרטיס אשראי.
            </p>
            <Link
              to="/dashboard"
              style={{
                display: 'inline-block',
                marginTop: 28,
                fontSize: 17,
                fontWeight: 700,
                color: '#0e8ba0',
                background: '#fff',
                padding: '16px 34px',
                borderRadius: 14,
                transition: 'transform .15s ease',
              }}
              onMouseOver={(e) => (e.currentTarget.style.transform = 'translateY(-2px)')}
              onMouseOut={(e) => (e.currentTarget.style.transform = 'none')}
            >
              התחלה חינם ←
            </Link>
          </div>
        </div>
      </section>

      {/* ============ FOOTER ============ */}
      <footer style={{ borderTop: '1px solid rgba(15,23,42,.08)', background: '#fff' }}>
        <div
          className="grid grid-cols-2 gap-8 px-4 py-10 lg:grid-cols-[1.4fr_1fr_1fr_1fr] lg:px-8 lg:py-12"
          style={{
            maxWidth: 1280,
            margin: '0 auto',
          }}
        >
          <div>
            <a href="#top" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 9,
                  background: '#0e8ba0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ico inner={SPARKLES_SM} size={16} stroke="#fff" strokeWidth={1.7} />
              </span>
              <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 600, fontSize: 17 }}>
                Easy<span style={{ color: '#0e8ba0' }}> Life</span>
              </span>
            </a>
            <p style={{ margin: '14px 0 0', fontSize: 14, color: '#55627a', maxWidth: '24em', lineHeight: 1.6 }}>
              עסק אחד. מוח אחד. שקט בראש. פלטפורמת סוכני AI לעסקים קטנים בישראל.
            </p>
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 14 }}>מוצר</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 14 }}>
              <a href="#agents" style={{ color: '#55627a' }}>
                הסוכנים
              </a>
              <a href="#product" style={{ color: '#55627a' }}>
                המערכת
              </a>
              <a href="#pricing" style={{ color: '#55627a' }}>
                תמחור
              </a>
              <Link to="/dashboard" style={{ color: '#55627a' }}>
                דשבורד
              </Link>
            </div>
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 14 }}>חברה</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 14 }}>
              <a href="#brain" style={{ color: '#55627a' }}>
                אודות
              </a>
              <a href="#how" style={{ color: '#55627a' }}>
                איך זה עובד
              </a>
              <a href="#" style={{ color: '#55627a' }}>
                בלוג
              </a>
              <a href="#" style={{ color: '#55627a' }}>
                קריירה
              </a>
            </div>
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 14 }}>יצירת קשר</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 14 }}>
              <a href="mailto:hi@easylife.co.il" style={{ color: '#55627a' }}>
                hi@easylife.co.il
              </a>
              <a href="#" style={{ color: '#55627a' }}>
                וואטסאפ
              </a>
              <a href="#" style={{ color: '#55627a' }}>
                תמיכה
              </a>
            </div>
          </div>
        </div>
        <div style={{ borderTop: '1px solid rgba(15,23,42,.06)' }}>
          <div
            style={{
              maxWidth: 1280,
              margin: '0 auto',
              padding: '20px 32px',
              display: 'flex',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 12,
              fontSize: 13,
              color: '#94a3b8',
            }}
          >
            <span>© 2026 Easy Life · חיים קלים בע״מ</span>
            <span style={{ display: 'flex', gap: 20 }}>
              <a href="#" style={{ color: '#94a3b8' }}>
                פרטיות
              </a>
              <a href="#" style={{ color: '#94a3b8' }}>
                תנאי שימוש
              </a>
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
