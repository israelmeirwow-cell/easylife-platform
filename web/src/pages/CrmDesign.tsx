import { useMemo, useState } from 'react';

/* "CRM" — ported 1:1 from the Claude Design handoff (CRM.dc.html).
   Header + search + "+ חדש", underline tabs with per-tab counts, and a
   glass-card table whose rows carry a hashed-tint initials avatar and a
   tinted status/stage pill. Live client-side search filters the ACTIVE tab.
   Mock data, tint palette, hashing and filter logic are lifted verbatim from
   the DCLogic. Colors are the design's literal values (they equal our tokens). */

/* ---------- inline heroicon (exact path from the design) ---------- */
function SearchIco({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} width={size} height={size}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.34-4.34M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z" />
    </svg>
  );
}

/* ---------- hashed tint + initials (verbatim from DCLogic) ---------- */
const TINTS = ['#0e8ba0', '#1666a8', '#12805c', '#b26a00', '#7c6cf0', '#0e7490'];
function tintOf(s: string): string {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0;
  return TINTS[Math.abs(h) % TINTS.length];
}
function initialsOf(s: string): string {
  return s
    .replace(/[״׳]/g, '')
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('');
}

/* ---------- mock data (verbatim from the design's DCLogic) ---------- */
interface Account { name: string; kind: string; industry: string; phone: string; created: string }
interface Contact { name: string; role: string; account: string; phone: string; last: string }
interface Deal { name: string; stage: string; account: string; value: string; close: string }

const ACCOUNTS: Account[] = [
  { name: 'קליניקת נועה', kind: 'עסק', industry: 'בריאות', phone: '050-123-4567', created: '22.7.2026' },
  { name: 'מוסך דהן ובניו', kind: 'עסק', industry: 'רכב', phone: '052-998-7766', created: '19.7.2026' },
  { name: 'סטודיו מיכל', kind: 'עסק', industry: 'עיצוב', phone: '054-321-9988', created: '15.7.2026' },
  { name: 'רשת אופנה URBAN', kind: 'עסק', industry: 'קמעונאות', phone: '03-555-1234', created: '11.7.2026' },
  { name: 'בית קפה עלית', kind: 'עסק', industry: 'מסעדנות', phone: '050-777-2211', created: '8.7.2026' },
  { name: 'יוסי אברהם', kind: 'אדם פרטי', industry: '—', phone: '058-444-5566', created: '3.7.2026' },
];

const CONTACTS: Contact[] = [
  { name: 'נועה לוי', role: 'מנהלת', account: 'קליניקת נועה', phone: '050-123-4567', last: 'לפני יום' },
  { name: 'יוסי דהן', role: 'בעלים', account: 'מוסך דהן ובניו', phone: '052-998-7766', last: 'לפני 3 ימים' },
  { name: 'מיכל ברק', role: 'מעצבת ראשית', account: 'סטודיו מיכל', phone: '054-321-9988', last: 'לפני שבוע' },
  { name: 'דנה כהן', role: 'רכש', account: 'רשת אופנה URBAN', phone: '03-555-1234', last: 'לפני יומיים' },
  { name: 'אבי מזרחי', role: 'מנהל', account: 'בית קפה עלית', phone: '050-777-2211', last: 'היום' },
];

const DEALS: Deal[] = [
  { name: 'חבילת סוכנים שנתית', stage: 'משא ומתן', account: 'קליניקת נועה', value: '₪ 42K', close: '31.7.2026' },
  { name: 'אוטומציית וואטסאפ', stage: 'הצעה', account: 'רשת אופנה URBAN', value: '₪ 64K', close: '5.8.2026' },
  { name: 'חבילת פרו + API', stage: 'משא ומתן', account: 'חברת שיפוצים', value: '₪ 84K', close: '2.8.2026' },
  { name: 'ניהול סושיאל', stage: 'מוכשר', account: 'בית קפה עלית', value: '₪ 12K', close: '12.8.2026' },
  { name: 'שדרוג אתר תדמית', stage: 'ליד', account: 'סטודיו מיכל', value: '₪ 18K', close: '—' },
];

/* ---------- tinted pill styles (verbatim from DCLogic) ---------- */
function badge(bg: string, fg: string): React.CSSProperties {
  return { borderRadius: 999, padding: '2px 10px', fontSize: 11, fontWeight: 600, background: bg, color: fg };
}
const STAGE_BADGE: Record<string, React.CSSProperties> = {
  ליד: badge('rgba(14,116,144,.1)', '#0e7490'),
  מוכשר: badge('rgba(14,139,160,.1)', '#0b7688'),
  הצעה: badge('rgba(178,106,0,.1)', '#b26a00'),
  'משא ומתן': badge('rgba(15,23,42,.06)', '#0f172a'),
  זכייה: badge('rgba(18,128,92,.1)', '#12805c'),
};
const KIND_BADGE: Record<string, React.CSSProperties> = {
  עסק: badge('rgba(14,116,144,.1)', '#0e7490'),
  'אדם פרטי': badge('#f1f5f9', '#55627a'),
};
const NEUTRAL_BADGE = badge('#f1f5f9', '#55627a');

type TabKey = 'accounts' | 'contacts' | 'deals';

interface RowVals {
  name: string;
  initials: string;
  tint: string;
  badgeText: string;
  badgeStyle: React.CSSProperties;
  c3: string;
  c4: string;
  c5: string;
}

export default function CrmDesign() {
  const [tab, setTab] = useState<TabKey>('accounts');
  const [search, setSearch] = useState('');

  const { columns, rows, tabTitle, tabSub } = useMemo(() => {
    const q = search.trim();
    function filt<T>(arr: T[], keys: (keyof T)[]): T[] {
      return q ? arr.filter((o) => keys.some((k) => String(o[k] ?? '').includes(q))) : arr;
    }

    let columns: string[];
    let rows: RowVals[];
    let tabTitle: string;
    let tabSub: string;

    if (tab === 'accounts') {
      tabTitle = 'חשבונות';
      tabSub = 'הארגונים והלקוחות של העסק — כל חשבון מרכז אנשי קשר, עסקאות ופעילות תחת גג אחד.';
      columns = ['שם', 'סוג', 'תחום', 'טלפון', 'נוצר'];
      rows = filt(ACCOUNTS, ['name', 'industry']).map((a) => ({
        name: a.name,
        initials: initialsOf(a.name),
        tint: tintOf(a.name),
        badgeText: a.kind,
        badgeStyle: KIND_BADGE[a.kind] ?? NEUTRAL_BADGE,
        c3: a.industry,
        c4: a.phone,
        c5: a.created,
      }));
    } else if (tab === 'contacts') {
      tabTitle = 'אנשי קשר';
      tabSub = 'האנשים שמאחורי החשבונות — כל מי שאתם בקשר איתו, עם היסטוריה מלאה.';
      columns = ['שם', 'תפקיד', 'חשבון', 'טלפון', 'קשר אחרון'];
      rows = filt(CONTACTS, ['name', 'account', 'role']).map((c) => ({
        name: c.name,
        initials: initialsOf(c.name),
        tint: tintOf(c.name),
        badgeText: c.role,
        badgeStyle: NEUTRAL_BADGE,
        c3: c.account,
        c4: c.phone,
        c5: c.last,
      }));
    } else {
      tabTitle = 'עסקאות';
      tabSub = 'צינור המכירות ברמת השורה — שווי, שלב ותאריך סגירה צפוי לכל עסקה.';
      columns = ['עסקה', 'שלב', 'חשבון', 'שווי', 'סגירה צפויה'];
      rows = filt(DEALS, ['name', 'account']).map((x) => ({
        name: x.name,
        initials: initialsOf(x.account),
        tint: tintOf(x.account),
        badgeText: x.stage,
        badgeStyle: STAGE_BADGE[x.stage] ?? NEUTRAL_BADGE,
        c3: x.account,
        c4: x.value,
        c5: x.close,
      }));
    }
    return { columns, rows, tabTitle, tabSub };
  }, [tab, search]);

  const tabDef: { key: TabKey; label: string; count: number }[] = [
    { key: 'accounts', label: 'חשבונות', count: ACCOUNTS.length },
    { key: 'contacts', label: 'אנשי קשר', count: CONTACTS.length },
    { key: 'deals', label: 'עסקאות', count: DEALS.length },
  ];

  const isEmpty = rows.length === 0;

  return (
    <div className="mx-auto max-w-[1200px]">
      {/* header */}
      <div className="mb-[18px] flex flex-wrap items-end justify-between gap-3.5">
        <div>
          <h1
            className="m-0 text-[26px] font-semibold tracking-[-.01em] text-ink"
            style={{ fontFamily: "'Space Grotesk','Heebo',sans-serif" }}
          >
            {tabTitle}
          </h1>
          <p className="mt-[7px] max-w-[44em] text-sm leading-relaxed text-muted">{tabSub}</p>
        </div>
        <div className="flex w-full items-center gap-2.5 lg:w-auto">
          <div className="relative flex-1 lg:flex-none">
            <span
              className="pointer-events-none absolute top-1/2 -translate-y-1/2 text-faint"
              style={{ insetInlineStart: 12 }}
            >
              <SearchIco size={16} />
            </span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="חיפוש…"
              className="w-full min-h-11 rounded-xl border border-border-strong bg-surface text-[13.5px] text-ink outline-none focus:border-gold lg:min-h-0 lg:w-[220px]"
              style={{ padding: '9px 12px 9px 34px' }}
            />
          </div>
          <button
            type="button"
            className="inline-flex min-h-11 flex-none cursor-pointer items-center gap-1.5 rounded-xl border-none bg-gold px-4 py-[9px] text-sm font-semibold text-white lg:min-h-0"
          >
            <span className="text-base leading-none">+</span> חדש
          </button>
        </div>
      </div>

      {/* tabs */}
      <div className="scrollbar-hide mb-4 flex gap-1 overflow-x-auto border-b border-border">
        {tabDef.map((t) => {
          const on = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className="relative min-h-11 flex-none cursor-pointer whitespace-nowrap border-none bg-transparent px-4 py-[11px] text-sm lg:min-h-0"
              style={{
                fontWeight: on ? 600 : 500,
                color: on ? '#0f172a' : '#55627a',
                boxShadow: on ? 'inset 0 -2px 0 #0e8ba0' : undefined,
              }}
            >
              {t.label}
              <span className="ms-1.5 text-[11px] tabular-nums text-faint">{t.count}</span>
            </button>
          );
        })}
      </div>

      {/* table */}
      <div className="glass-card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table
            className="w-full min-w-[680px] border-collapse text-sm"
            style={{ textAlign: 'start' }}
          >
            <thead>
              <tr className="border-b border-border" style={{ background: 'rgba(241,245,249,.5)' }}>
                {columns.map((col) => (
                  <th
                    key={col}
                    className="text-start text-[12px] font-semibold text-muted"
                    style={{ padding: '12px 16px' }}
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr
                  key={i}
                  className="cursor-pointer transition-colors hover:bg-[rgba(241,245,249,.6)]"
                  style={{ borderBottom: '1px solid rgba(15,23,42,.06)' }}
                >
                  <td style={{ padding: '13px 16px' }}>
                    <div className="flex items-center gap-2.5">
                      <span
                        className="flex h-[30px] w-[30px] flex-none items-center justify-center rounded-full text-[11px] font-bold text-white"
                        style={{ background: r.tint }}
                      >
                        {r.initials}
                      </span>
                      <span className="font-semibold text-ink">{r.name}</span>
                    </div>
                  </td>
                  <td style={{ padding: '13px 16px' }}>
                    <span style={r.badgeStyle}>{r.badgeText}</span>
                  </td>
                  <td className="text-muted" style={{ padding: '13px 16px' }}>
                    {r.c3}
                  </td>
                  <td className="text-muted" style={{ padding: '13px 16px' }} dir="ltr">
                    <span className="block text-end">{r.c4}</span>
                  </td>
                  <td className="text-muted" style={{ padding: '13px 16px' }}>
                    {r.c5}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {isEmpty && (
          <div className="flex flex-col items-center gap-2.5 text-center" style={{ padding: '56px 24px' }}>
            <span
              className="flex h-[52px] w-[52px] items-center justify-center rounded-full text-2xl"
              style={{ background: '#f1f5f9' }}
            >
              🏢
            </span>
            <p className="m-0 text-[15px] font-semibold text-ink">לא נמצאו תוצאות</p>
            <p className="m-0 text-[13px] text-muted">נסו מונח חיפוש אחר.</p>
          </div>
        )}
      </div>
    </div>
  );
}
