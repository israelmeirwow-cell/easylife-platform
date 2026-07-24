import { useMemo, useRef, useState } from 'react';

/* "CRM" — rebuilt 1:1 from the upgraded Claude Design handoff (v2/CRM.dc.html).
   3 summary KPI cards, tabs + toolbar (search, filter select, table/cards/kanban
   view toggle, CSV export, "+ new"), a SORTABLE table (.crm-th), a CARDS grid
   (.crm-card), a KANBAN board (.kcol drop columns + .kcard HTML5 drag-and-drop),
   bulk-select bar, pagination, and slide-in ADD + RECORD drawers with a scrim
   and toasts. Mock data, tint palette, hashing, badge styles and every handler
   are lifted verbatim from the DCLogic. Colors are the design's literal values.
   The app <Layout> renders the top nav/header chrome, so this renders only the
   page's <main> root. */

/* ---------- inline heroicon helper (exact paths from the design) ---------- */
function Ico({ d, size = 16, color = 'currentColor', sw = 1.7 }: { d: string; size?: number; color?: string; sw?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={sw} width={size} height={size}>
      <path strokeLinecap="round" strokeLinejoin="round" d={d} />
    </svg>
  );
}

const P = {
  users:
    'M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z',
  trend:
    'M2.25 18 9 11.25l4.306 4.307a11.95 11.95 0 0 1 5.814-5.518l2.74-1.22m0 0-5.94-2.28m5.94 2.28-2.28 5.941',
  personAdd:
    'M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Z',
  search: 'm21 21-4.34-4.34M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z',
  csv: 'M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5',
  rows: 'M3.75 6h16.5M3.75 12h16.5m-16.5 6h16.5',
  grid:
    'M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25h-2.25a2.25 2.25 0 0 1-2.25-2.25v-2.25Z',
  board:
    'M3.75 3v11.25A2.25 2.25 0 0 0 6 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0 1 18 16.5h-2.25m-7.5 0h7.5m-7.5 0-1 3m8.5-3 1 3m0 0 .5 1.5m-.5-1.5h-9.5m0 0-.5 1.5',
  check: 'm4.5 12.75 6 6 9-13.5',
  chevRight: 'm8.25 4.5 7.5 7.5-7.5 7.5',
  chevLeft: 'M15.75 19.5 8.25 12l7.5-7.5',
  close: 'M6 18 18 6M6 6l12 12',
  msg: 'M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5',
  cal: 'M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75',
  edit: 'm16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z',
};

/* ---------- hashed tint + initials (verbatim from DCLogic) ---------- */
const TINTS = ['#0e8ba0', '#1666a8', '#12805c', '#b26a00', '#7c6cf0', '#0e7490'];
function tintOf(s: string): string {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0;
  return TINTS[Math.abs(h) % TINTS.length];
}
function initialsOf(s: string): string {
  return s
    .replace(/[״׳"]/g, '')
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('');
}

/* ---------- mock data (verbatim from the design's DCLogic) ---------- */
interface Account { id: number; name: string; kind: string; industry: string; phone: string; email: string; created: string }
interface Contact { id: number; name: string; role: string; account: string; phone: string; email: string; last: string }
interface Deal { id: number; name: string; stage: string; account: string; value: number; owner: string; close: string }

function seedAccounts(): Account[] {
  return [
    { id: 1, name: 'קליניקת נועה', kind: 'עסק', industry: 'בריאות', phone: '050-123-4567', email: 'noa@clinic.co.il', created: '22.7.2026' },
    { id: 2, name: 'מוסך דהן ובניו', kind: 'עסק', industry: 'רכב', phone: '052-998-7766', email: 'yossi@dahan.co.il', created: '19.7.2026' },
    { id: 3, name: 'סטודיו מיכל', kind: 'עסק', industry: 'עיצוב', phone: '054-321-9988', email: 'michal@studio.co.il', created: '15.7.2026' },
    { id: 4, name: 'רשת אופנה URBAN', kind: 'עסק', industry: 'קמעונאות', phone: '03-555-1234', email: 'dana@urban.co.il', created: '11.7.2026' },
    { id: 5, name: 'בית קפה עלית', kind: 'עסק', industry: 'מסעדנות', phone: '050-777-2211', email: 'avi@elite.co.il', created: '8.7.2026' },
    { id: 6, name: 'חברת שיפוצים', kind: 'עסק', industry: 'בנייה', phone: '050-444-1212', email: 'ron@shipputzim.co.il', created: '5.7.2026' },
    { id: 7, name: 'סוכנות נדל״ן', kind: 'עסק', industry: 'נדל״ן', phone: '052-321-4455', email: 'shira@realestate.co.il', created: '2.7.2026' },
    { id: 8, name: 'יוסי אברהם', kind: 'אדם פרטי', industry: '—', phone: '058-444-5566', email: 'yossi.a@gmail.com', created: '1.7.2026' },
    { id: 9, name: 'מאפיית הבוקר', kind: 'עסק', industry: 'מסעדנות', phone: '09-777-8899', email: 'boker@bakery.co.il', created: '28.6.2026' },
    { id: 10, name: 'ד״ר לוינשטיין', kind: 'עסק', industry: 'בריאות', phone: '03-611-2233', email: 'clinic@dr.co.il', created: '24.6.2026' },
  ];
}
function seedContacts(): Contact[] {
  return [
    { id: 1, name: 'נועה לוי', role: 'מנהלת', account: 'קליניקת נועה', phone: '050-123-4567', email: 'noa@clinic.co.il', last: 'לפני יום' },
    { id: 2, name: 'יוסי דהן', role: 'בעלים', account: 'מוסך דהן ובניו', phone: '052-998-7766', email: 'yossi@dahan.co.il', last: 'לפני 3 ימים' },
    { id: 3, name: 'מיכל ברק', role: 'מעצבת ראשית', account: 'סטודיו מיכל', phone: '054-321-9988', email: 'michal@studio.co.il', last: 'לפני שבוע' },
    { id: 4, name: 'דנה כהן', role: 'רכש', account: 'רשת אופנה URBAN', phone: '03-555-1234', email: 'dana@urban.co.il', last: 'לפני יומיים' },
    { id: 5, name: 'אבי מזרחי', role: 'מנהל', account: 'בית קפה עלית', phone: '050-777-2211', email: 'avi@elite.co.il', last: 'היום' },
    { id: 6, name: 'רון אבני', role: 'מנכ״ל', account: 'חברת שיפוצים', phone: '050-444-1212', email: 'ron@shipputzim.co.il', last: 'אתמול' },
    { id: 7, name: 'שירה גל', role: 'שותפה', account: 'סוכנות נדל״ן', phone: '052-321-4455', email: 'shira@realestate.co.il', last: 'לפני 4 ימים' },
  ];
}
function seedDeals(): Deal[] {
  return [
    { id: 1, name: 'שדרוג אתר תדמית', stage: 'ליד', account: 'סטודיו מיכל', value: 18000, owner: 'עד', close: '—' },
    { id: 2, name: 'קמפיין לידים', stage: 'ליד', account: 'מוסך דהן ובניו', value: 9000, owner: 'רכ', close: '—' },
    { id: 3, name: 'חבילת סוכנים שנתית', stage: 'מוכשר', account: 'קליניקת נועה', value: 42000, owner: 'נל', close: '31.7.2026' },
    { id: 4, name: 'ניהול סושיאל', stage: 'מוכשר', account: 'בית קפה עלית', value: 12000, owner: 'עד', close: '12.8.2026' },
    { id: 5, name: 'אוטומציית וואטסאפ', stage: 'הצעה', account: 'רשת אופנה URBAN', value: 64000, owner: 'רכ', close: '5.8.2026' },
    { id: 6, name: 'חבילת פרו + API', stage: 'משא ומתן', account: 'חברת שיפוצים', value: 84000, owner: 'עד', close: '2.8.2026' },
    { id: 7, name: 'סוכן לידים + דוחות', stage: 'משא ומתן', account: 'סוכנות נדל״ן', value: 38000, owner: 'נל', close: '9.8.2026' },
  ];
}

/* ---------- tinted pill styles (verbatim from DCLogic) ---------- */
function badge(bg: string, fg: string): React.CSSProperties {
  return { borderRadius: 999, padding: '2px 10px', fontSize: 11, fontWeight: 600, background: bg, color: fg, display: 'inline-block' };
}
const STAGE_META: [string, string][] = [
  ['ליד', '#0e8ba0'],
  ['מוכשר', '#1666a8'],
  ['הצעה', '#b26a00'],
  ['משא ומתן', '#0f172a'],
];
const STAGE_BADGE: Record<string, React.CSSProperties> = {
  ליד: badge('rgba(14,116,144,.1)', '#0e7490'),
  מוכשר: badge('rgba(14,139,160,.1)', '#0b7688'),
  הצעה: badge('rgba(178,106,0,.1)', '#b26a00'),
  'משא ומתן': badge('rgba(15,23,42,.06)', '#0f172a'),
  זכייה: badge('rgba(18,128,92,.1)', '#12805c'),
};
const KIND_BADGE = badge('rgba(14,116,144,.1)', '#0e7490');
const NEUTRAL_BADGE = badge('#f1f5f9', '#55627a');

const money = (n: number) => '₪ ' + n.toLocaleString('he-IL');
const moneyK = (n: number) => '₪ ' + Math.round(n / 1000) + 'K';

type TabKey = 'accounts' | 'contacts' | 'deals';
type ViewKey = 'table' | 'cards' | 'board';

interface RowVals {
  id: number;
  rec: Account | Contact | Deal;
  name: string;
  initials: string;
  tint: string;
  badgeText: string;
  badgeStyle: React.CSSProperties;
  c3: string; l3: string;
  c4: string; l4: string;
  c5: string; l5: string;
  sortVals: Record<string, string | number>;
}

const PAGE = 8;

const RESPONSIVE_CSS = `
@media (max-width:960px){ .r-main{padding-inline:18px !important;} .r-3{grid-template-columns:1fr !important;} }
@media (max-width:760px){ .r-main{padding-inline:14px !important;} .r-cards{grid-template-columns:1fr !important;} .r-kanban{grid-template-columns:repeat(2,minmax(200px,1fr)) !important;} }
@media (max-width:520px){ .r-kanban{grid-template-columns:1fr !important;} }
.crm-row:hover { background:rgba(241,245,249,.6); }
.crm-th { cursor:pointer; user-select:none; } .crm-th:hover { color:#0f172a; }
.crm-card:hover { box-shadow:0 6px 16px rgba(15,23,42,.1); transform:translateY(-2px); }
.crm-card { transition:transform .12s ease, box-shadow .12s ease; }
.kcard { cursor:grab; transition:transform .12s ease, box-shadow .12s ease; }
.kcard:hover { transform:translateY(-2px); box-shadow:0 6px 16px rgba(15,23,42,.12); }
.kcol.drag-over { background:rgba(14,139,160,.08); outline:2px dashed rgba(14,139,160,.4); }
@keyframes dash-drawer-in { from { transform:translateX(-100%); } to { transform:translateX(0); } }
@keyframes dash-fade { from { opacity:0; } to { opacity:1; } }
`;

export default function CrmDesign() {
  const [tab, setTab] = useState<TabKey>('accounts');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [view, setView] = useState<ViewKey>('table');
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState(1);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string[]>([]);
  const [toast, setToast] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState<Record<string, string>>({});
  const [recId, setRecId] = useState<number | null>(null);

  const [accounts, setAccounts] = useState<Account[]>(seedAccounts);
  const [contacts, setContacts] = useState<Contact[]>(seedContacts);
  const [deals, setDeals] = useState<Deal[]>(seedDeals);

  const toastTimer = useRef<ReturnType<typeof setTimeout>>();
  const dragId = useRef<number | null>(null);
  const colEls = useRef<Record<string, HTMLDivElement | null>>({});

  function showToast(m: string) {
    setToast(m);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 2600);
  }

  /* ---- switch tab: reset paging/selection/sort; leave board only for deals ---- */
  function selectTab(k: TabKey) {
    setTab(k);
    setPage(1);
    setSelected([]);
    setSortKey(null);
    setFilter('all');
    if (view === 'board' && k !== 'deals') setView('table');
  }

  const q = search.trim();

  /* ---------- summary KPIs ---------- */
  const summary = useMemo(() => {
    const pipeSum = deals.reduce((a, d) => a + d.value, 0);
    return [
      { label: 'סה״כ לקוחות', value: String(accounts.length), color: '#0e8ba0', tint: 'rgba(14,139,160,.1)', icon: P.users },
      { label: 'שווי צינור', value: moneyK(pipeSum), color: '#b26a00', tint: 'rgba(178,106,0,.1)', icon: P.trend },
      { label: 'לידים חדשים החודש', value: '94', color: '#12805c', tint: 'rgba(18,128,92,.1)', icon: P.personAdd },
    ];
  }, [accounts, deals]);

  /* ---------- tabs ---------- */
  const tabDef: [TabKey, string, number][] = [
    ['accounts', 'חשבונות', accounts.length],
    ['contacts', 'אנשי קשר', contacts.length],
    ['deals', 'עסקאות', deals.length],
  ];

  /* ---------- filter options per tab ---------- */
  const filterOptions = useMemo(() => {
    if (tab === 'accounts') {
      const inds = [...new Set(accounts.map((a) => a.industry))];
      return [{ val: 'all', label: 'כל התחומים' }, ...inds.map((i) => ({ val: i, label: i }))];
    }
    if (tab === 'contacts') {
      const accs = [...new Set(contacts.map((c) => c.account))];
      return [{ val: 'all', label: 'כל החשבונות' }, ...accs.map((a) => ({ val: a, label: a }))];
    }
    return [{ val: 'all', label: 'כל השלבים' }, ...STAGE_META.map(([s]) => ({ val: s, label: s }))];
  }, [tab, accounts, contacts]);

  /* ---------- base rows per tab (filter + search + sort) ---------- */
  const { baseRows, columns } = useMemo(() => {
    let base: RowVals[] = [];
    if (tab === 'accounts') {
      base = accounts
        .filter((a) => filter === 'all' || a.industry === filter)
        .map((a) => ({
          id: a.id, rec: a, name: a.name, initials: initialsOf(a.name), tint: tintOf(a.name),
          badgeText: a.kind, badgeStyle: KIND_BADGE,
          c3: a.industry, l3: 'תחום', c4: a.phone, l4: 'טלפון', c5: a.created, l5: 'נוצר',
          sortVals: { name: a.name, badge: a.kind, c3: a.industry, c4: a.phone, c5: a.created },
        }));
    } else if (tab === 'contacts') {
      base = contacts
        .filter((c) => filter === 'all' || c.account === filter)
        .map((c) => ({
          id: c.id, rec: c, name: c.name, initials: initialsOf(c.name), tint: tintOf(c.name),
          badgeText: c.role, badgeStyle: NEUTRAL_BADGE,
          c3: c.account, l3: 'חשבון', c4: c.phone, l4: 'טלפון', c5: c.last, l5: 'קשר אחרון',
          sortVals: { name: c.name, badge: c.role, c3: c.account, c4: c.phone, c5: c.last },
        }));
    } else {
      base = deals
        .filter((d) => filter === 'all' || d.stage === filter)
        .map((d) => ({
          id: d.id, rec: d, name: d.name, initials: initialsOf(d.account), tint: tintOf(d.account),
          badgeText: d.stage, badgeStyle: STAGE_BADGE[d.stage] ?? NEUTRAL_BADGE,
          c3: d.account, l3: 'חשבון', c4: money(d.value), l4: 'שווי', c5: d.close, l5: 'סגירה',
          sortVals: { name: d.name, badge: d.stage, c3: d.account, c4: d.value, c5: d.close },
        }));
    }
    if (q) base = base.filter((r) => [r.name, r.badgeText, r.c3, String(r.c4), r.c5].some((v) => (v || '').toString().includes(q)));
    if (sortKey) {
      const sk = sortKey;
      base = [...base].sort((a, b) => {
        const x = a.sortVals[sk];
        const y = b.sortVals[sk];
        if (typeof x === 'number' && typeof y === 'number') return (x - y) * sortDir;
        return String(x).localeCompare(String(y), 'he') * sortDir;
      });
    }

    const colDefs: [string, string][] =
      tab === 'accounts'
        ? [['name', 'שם'], ['badge', 'סוג'], ['c3', 'תחום'], ['c4', 'טלפון'], ['c5', 'נוצר']]
        : tab === 'contacts'
          ? [['name', 'שם'], ['badge', 'תפקיד'], ['c3', 'חשבון'], ['c4', 'טלפון'], ['c5', 'קשר אחרון']]
          : [['name', 'עסקה'], ['badge', 'שלב'], ['c3', 'חשבון'], ['c4', 'שווי'], ['c5', 'סגירה']];
    const cols = colDefs.map(([key, label]) => ({
      key,
      label,
      arrow: sortKey === key ? (sortDir > 0 ? '↑' : '↓') : '',
    }));
    return { baseRows: base, columns: cols };
  }, [tab, filter, q, sortKey, sortDir, accounts, contacts, deals]);

  function onSort(key: string) {
    if (sortKey === key) setSortDir((d) => -d);
    else {
      setSortKey(key);
      setSortDir(1);
    }
  }

  /* ---------- view state ---------- */
  const isBoard = tab === 'deals' && view === 'board';
  const isCards = view === 'cards' && !isBoard;
  const isTable = view === 'table' && !isBoard;

  const totalRows = baseRows.length;
  let pageCount = 1;
  let pageNum = page;
  let pageRows = baseRows;
  if (!isBoard) {
    pageCount = Math.max(1, Math.ceil(totalRows / PAGE));
    pageNum = Math.min(page, pageCount);
    pageRows = baseRows.slice((pageNum - 1) * PAGE, pageNum * PAGE);
  }
  const pageIds = baseRows.slice((pageNum - 1) * PAGE, pageNum * PAGE).map((r) => tab + r.id);
  const allSelected = pageIds.length > 0 && pageIds.every((id) => selected.includes(id));

  function toggleSel(id: string) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }
  function selectAllPage() {
    setSelected((s) => {
      const all = pageIds.every((id) => s.includes(id));
      return all ? s.filter((x) => !pageIds.includes(x)) : [...new Set([...s, ...pageIds])];
    });
  }

  const selBox = (on: boolean): React.CSSProperties => ({
    cursor: 'pointer', flex: 'none', width: 18, height: 18, borderRadius: 5,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    ...(on ? { background: '#0e8ba0', border: '1px solid #0e8ba0' } : { background: '#fff', border: '1.5px solid rgba(15,23,42,.2)' }),
  });

  /* ---------- kanban board ---------- */
  const board = useMemo(() => {
    if (!isBoard) return [];
    return STAGE_META.map(([label, tint]) => {
      const list = deals.filter((d) => d.stage === label);
      const sum = list.reduce((a, d) => a + d.value, 0);
      return { label, tint, count: list.length, sumLabel: sum ? moneyK(sum) : '₪0', deals: list };
    });
  }, [isBoard, deals]);

  function moveDeal(id: number | null, stage: string) {
    if (id == null) return;
    setDeals((arr) => arr.map((d) => (d.id === id ? { ...d, stage } : d)));
  }

  /* ---------- CSV export ---------- */
  function exportCSV(rowsToExport: RowVals[], cols: { label: string }[]) {
    try {
      const head = cols.map((c) => c.label);
      const lines = [head.join(',')];
      rowsToExport.forEach((r) => {
        lines.push([r.name, r.badgeText, r.c3, r.c4, r.c5].map((v) => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"').join(','));
      });
      const csv = '﻿' + lines.join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'easylife-crm.csv';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      showToast('יוצאו ' + rowsToExport.length + ' רשומות ל‑CSV');
    } catch {
      showToast('הייצוא נכשל בסביבה הזו');
    }
  }

  /* ---------- bulk delete ---------- */
  function bulkDelete() {
    const sel = selected;
    if (tab === 'accounts') setAccounts((cur) => cur.filter((r) => !sel.includes(tab + r.id)));
    else if (tab === 'contacts') setContacts((cur) => cur.filter((r) => !sel.includes(tab + r.id)));
    else setDeals((cur) => cur.filter((r) => !sel.includes(tab + r.id)));
    setSelected([]);
    showToast(sel.length + ' רשומות נמחקו');
  }

  /* ---------- add drawer ---------- */
  const addLabel = tab === 'accounts' ? 'לקוח' : tab === 'contacts' ? 'איש קשר' : 'עסקה';
  const addTitle = tab === 'accounts' ? 'לקוח חדש' : tab === 'contacts' ? 'איש קשר חדש' : 'עסקה חדשה';
  const addFieldsDef: [string, string, boolean, string[]][] =
    tab === 'accounts'
      ? [['name', 'שם הלקוח', false, []], ['kind', 'סוג', true, ['עסק', 'אדם פרטי']], ['industry', 'תחום', false, []], ['phone', 'טלפון', false, []], ['email', 'אימייל', false, []]]
      : tab === 'contacts'
        ? [['name', 'שם', false, []], ['role', 'תפקיד', false, []], ['account', 'חשבון', false, []], ['phone', 'טלפון', false, []], ['email', 'אימייל', false, []]]
        : [['name', 'שם העסקה', false, []], ['account', 'חשבון', false, []], ['value', 'שווי (₪)', false, []], ['stage', 'שלב', true, ['ליד', 'מוכשר', 'הצעה', 'משא ומתן']]];
  const setF = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setAddForm((s) => ({ ...s, [k]: e.target.value }));

  function addRecord() {
    const f = addForm;
    const nid = Date.now() % 100000;
    if (tab === 'accounts') {
      setAccounts((cur) => [{ id: nid, name: f.name || 'ללא שם', kind: f.kind || 'עסק', industry: f.industry || '—', phone: f.phone || '—', email: f.email || '—', created: 'היום' }, ...cur]);
    } else if (tab === 'contacts') {
      setContacts((cur) => [{ id: nid, name: f.name || 'ללא שם', role: f.role || '—', account: f.account || '—', phone: f.phone || '—', email: f.email || '—', last: 'עכשיו' }, ...cur]);
    } else {
      setDeals((cur) => [{ id: nid, name: f.name || 'עסקה חדשה', account: f.account || '—', value: parseInt(f.value) || 0, stage: f.stage || 'ליד', owner: 'עד', close: '—' }, ...cur]);
    }
    setAddOpen(false);
    showToast('הרשומה נוספה בהצלחה');
  }

  /* ---------- record drawer ---------- */
  const recOpen = recId != null;
  const rec = useMemo(() => {
    if (!recOpen) return null;
    const rObj = baseRows.find((r) => r.id === recId) || baseRows[0];
    if (!rObj) return null;
    const d = rObj.rec;
    const acts = [
      { label: 'הודעה', icon: P.msg, onClick: () => showToast('נפתחה שיחה') },
      { label: 'פגישה', icon: P.cal, onClick: () => showToast('פגישה נוספה ליומן') },
      { label: 'עריכה', icon: P.edit, onClick: () => showToast('מצב עריכה') },
    ];
    let name = '', sub = '', fields: { label: string; value: string; dir: string }[] = [];
    if (tab === 'accounts') {
      const a = d as Account;
      name = a.name; sub = a.industry + ' · ' + a.kind;
      fields = [{ label: 'תחום', value: a.industry, dir: 'rtl' }, { label: 'טלפון', value: a.phone, dir: 'ltr' }, { label: 'אימייל', value: a.email, dir: 'ltr' }, { label: 'נוצר', value: a.created, dir: 'rtl' }];
    } else if (tab === 'contacts') {
      const c = d as Contact;
      name = c.name; sub = c.role + ' · ' + c.account;
      fields = [{ label: 'תפקיד', value: c.role, dir: 'rtl' }, { label: 'חשבון', value: c.account, dir: 'rtl' }, { label: 'טלפון', value: c.phone, dir: 'ltr' }, { label: 'אימייל', value: c.email, dir: 'ltr' }];
    } else {
      const dl = d as Deal;
      name = dl.name; sub = dl.account + ' · ' + dl.stage;
      fields = [{ label: 'חשבון', value: dl.account, dir: 'rtl' }, { label: 'שווי', value: money(dl.value), dir: 'rtl' }, { label: 'שלב', value: dl.stage, dir: 'rtl' }, { label: 'סגירה צפויה', value: dl.close, dir: 'rtl' }];
    }
    const tlBase = [
      { icon: '🎯', title: 'נוצר במערכת', text: 'הרשומה נוספה ל‑CRM', time: 'לפני שבועיים' },
      { icon: '💬', title: 'סוכן וואטסאפ יצר קשר', text: 'שלח הודעת פתיחה', time: 'לפני שבוע' },
      { icon: '📞', title: 'שיחת מעקב', text: 'תיאום צרכים', time: 'לפני 3 ימים' },
      { icon: '📄', title: 'עדכון אחרון', text: 'הפעילות האחרונה נרשמה', time: 'היום' },
    ];
    return {
      name, sub, initials: rObj.initials, tint: rObj.tint, actions: acts, fields,
      timeline: tlBase.map((t, i) => ({ ...t, line: i < tlBase.length - 1 })),
    };
  }, [recOpen, recId, baseRows, tab]);

  const isEmpty = totalRows === 0;
  const showPager = !isBoard && totalRows > PAGE;
  const pageFrom = totalRows ? (pageNum - 1) * PAGE + 1 : 0;
  const pageTo = Math.min(pageNum * PAGE, totalRows);

  const vBtn = (on: boolean): React.CSSProperties => ({
    cursor: 'pointer', fontFamily: 'inherit', border: 'none', borderRadius: 8, padding: '6px 9px', display: 'flex', alignItems: 'center',
    ...(on ? { background: '#fff', color: '#0f172a', boxShadow: '0 1px 2px rgba(15,23,42,.08)' } : { background: 'transparent', color: '#94a3b8' }),
  });
  const viewToggle: { title: string; icon: string; on: boolean; onClick: () => void }[] = [
    { title: 'טבלה', icon: P.rows, on: isTable, onClick: () => setView('table') },
    { title: 'כרטיסים', icon: P.grid, on: isCards, onClick: () => setView('cards') },
  ];
  if (tab === 'deals') viewToggle.push({ title: 'לוח', icon: P.board, on: isBoard, onClick: () => setView('board') });

  const emptyBlock = (
    <div className="flex flex-col items-center gap-2.5 text-center" style={{ padding: '56px 24px' }}>
      <span className="flex items-center justify-center rounded-full" style={{ width: 52, height: 52, background: '#f1f5f9', fontSize: 24 }}>🏢</span>
      <p className="m-0" style={{ fontSize: 15, fontWeight: 600 }}>לא נמצאו תוצאות</p>
      <p className="m-0" style={{ fontSize: 13, color: '#55627a' }}>נסו מונח חיפוש או סינון אחר.</p>
    </div>
  );

  return (
    <div dir="rtl">
      <style dangerouslySetInnerHTML={{ __html: RESPONSIVE_CSS }} />
      <main className="r-main" style={{ maxWidth: 1240, margin: '0 auto', paddingInline: 0 }}>
        <div style={{ marginBottom: 18 }}>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 600, letterSpacing: '-.01em', fontFamily: "'Space Grotesk','Heebo',sans-serif" }}>CRM</h1>
          <p style={{ margin: '7px 0 0', fontSize: 14, color: '#55627a' }}>
            כל הלקוחות, אנשי הקשר והעסקאות במקום אחד — מתמלא לבד מפעילות הסוכנים.
          </p>
        </div>

        {/* summary cards */}
        <div className="r-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 22 }}>
          {summary.map((s) => (
            <div key={s.label} className="glass-card" style={{ padding: 18, display: 'flex', alignItems: 'center', gap: 14 }}>
              <span style={{ flex: 'none', width: 44, height: 44, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', background: s.tint, color: s.color }}>
                <Ico d={s.icon} size={20} />
              </span>
              <div>
                <div style={{ fontSize: 12.5, color: '#55627a' }}>{s.label}</div>
                <div className="tabular-nums" style={{ fontSize: 26, fontWeight: 600, letterSpacing: '-.01em', marginTop: 2 }}>{s.value}</div>
              </div>
            </div>
          ))}
        </div>

        {/* tabs + toolbar */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderBottom: '1px solid rgba(15,23,42,.08)', marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 4 }}>
            {tabDef.map(([k, l, c]) => {
              const on = tab === k;
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => selectTab(k)}
                  style={{
                    cursor: 'pointer', fontFamily: 'inherit', position: 'relative', border: 'none', background: 'none',
                    padding: '11px 16px', fontSize: 14, fontWeight: on ? 600 : 500, color: on ? '#0f172a' : '#55627a',
                    boxShadow: on ? 'inset 0 -2px 0 #0e8ba0' : undefined,
                  }}
                >
                  {l}
                  <span className="tabular-nums" style={{ marginInlineStart: 6, fontSize: 11, color: '#94a3b8' }}>{c}</span>
                </button>
              );
            })}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 8, flexWrap: 'wrap' }}>
            <div style={{ position: 'relative' }}>
              <span style={{ pointerEvents: 'none', position: 'absolute', insetInlineStart: 11, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}>
                <Ico d={P.search} size={15} sw={1.8} />
              </span>
              <input
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                placeholder="חיפוש…"
                style={{ border: '1px solid rgba(15,23,42,.16)', background: '#fff', borderRadius: 11, padding: '8px 11px 8px 32px', fontFamily: 'inherit', fontSize: 13, outline: 'none', width: 180 }}
              />
            </div>
            <select
              value={filter}
              onChange={(e) => { setFilter(e.target.value); setPage(1); setSelected([]); }}
              style={{ border: '1px solid rgba(15,23,42,.16)', background: '#fff', borderRadius: 11, padding: '8px 11px', fontFamily: 'inherit', fontSize: 13, color: '#0f172a', outline: 'none' }}
            >
              {filterOptions.map((o) => (
                <option key={o.val} value={o.val}>{o.label}</option>
              ))}
            </select>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 2, background: '#eef2f7', borderRadius: 10, padding: 3 }}>
              {viewToggle.map((v) => (
                <button key={v.title} type="button" onClick={v.onClick} title={v.title} style={vBtn(v.on)}>
                  <Ico d={v.icon} size={14} />
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => exportCSV(baseRows, columns)}
              title="ייצוא CSV"
              style={{ cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 6, border: '1px solid rgba(15,23,42,.16)', background: '#fff', borderRadius: 11, padding: '8px 12px', fontSize: 13, fontWeight: 600, color: '#0f172a' }}
            >
              <Ico d={P.csv} size={15} />CSV
            </button>
            <button
              type="button"
              onClick={() => { setAddOpen(true); setAddForm({}); }}
              style={{ cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 6, border: 'none', borderRadius: 11, background: '#0e8ba0', color: '#fff', padding: '8px 15px', fontSize: 14, fontWeight: 600 }}
            >
              <span style={{ fontSize: 16, lineHeight: 1 }}>+</span> {addLabel}
            </button>
          </div>
        </div>

        {/* bulk bar */}
        {selected.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'rgba(14,139,160,.08)', border: '1px solid rgba(14,139,160,.25)', borderRadius: 12, padding: '10px 16px', marginBottom: 14, animation: 'dash-fade .2s ease both' }}>
            <span style={{ fontSize: 13.5, fontWeight: 600, color: '#0b7688' }}>{selected.length} נבחרו</span>
            <div style={{ display: 'flex', gap: 8, marginInlineStart: 'auto' }}>
              <button type="button" onClick={() => exportCSV(baseRows.filter((r) => selected.includes(tab + r.id)), columns)} style={{ cursor: 'pointer', fontFamily: 'inherit', border: '1px solid rgba(15,23,42,.16)', background: '#fff', borderRadius: 9, padding: '6px 12px', fontSize: 12.5, fontWeight: 600, color: '#0f172a' }}>ייצוא</button>
              <button type="button" onClick={() => showToast(selected.length + ' רשומות תויגו')} style={{ cursor: 'pointer', fontFamily: 'inherit', border: '1px solid rgba(15,23,42,.16)', background: '#fff', borderRadius: 9, padding: '6px 12px', fontSize: 12.5, fontWeight: 600, color: '#0f172a' }}>תיוג</button>
              <button type="button" onClick={bulkDelete} style={{ cursor: 'pointer', fontFamily: 'inherit', border: '1px solid rgba(209,69,59,.3)', background: 'rgba(209,69,59,.09)', borderRadius: 9, padding: '6px 12px', fontSize: 12.5, fontWeight: 600, color: '#d1453b' }}>מחיקה</button>
              <button type="button" onClick={() => setSelected([])} style={{ cursor: 'pointer', fontFamily: 'inherit', border: 'none', background: 'none', padding: '6px 8px', fontSize: 12.5, color: '#55627a' }}>ביטול</button>
            </div>
          </div>
        )}

        {/* BOARD (deals kanban) */}
        {isBoard && (
          <div className="r-kanban" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, alignItems: 'start' }}>
            {board.map((col) => (
              <div
                key={col.label}
                className="kcol"
                ref={(el) => { colEls.current[col.label] = el; }}
                onDragOver={(e) => { e.preventDefault(); colEls.current[col.label]?.classList.add('drag-over'); }}
                onDragLeave={() => colEls.current[col.label]?.classList.remove('drag-over')}
                onDrop={(e) => { e.preventDefault(); colEls.current[col.label]?.classList.remove('drag-over'); moveDeal(dragId.current, col.label); }}
                style={{ borderRadius: 14, background: '#f8fafc', border: '1px solid rgba(15,23,42,.06)', padding: 12, minHeight: 120, transition: 'background .15s ease' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, padding: '0 2px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <span style={{ width: 8, height: 8, borderRadius: 999, background: col.tint }} />
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{col.label}</span>
                  </div>
                  <span className="tabular-nums" style={{ fontSize: 11, color: '#94a3b8' }}>{col.count} · {col.sumLabel}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {col.deals.map((d) => (
                    <div
                      key={d.id}
                      className="kcard"
                      draggable
                      onDragStart={() => { dragId.current = d.id; }}
                      onDragEnd={() => { dragId.current = null; }}
                      onClick={() => setRecId(d.id)}
                      style={{ background: '#fff', border: '1px solid rgba(15,23,42,.08)', borderTop: `2px solid ${col.tint}`, borderRadius: 11, padding: 12 }}
                    >
                      <div style={{ fontSize: 9.5, letterSpacing: '.12em', textTransform: 'uppercase', color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.account}</div>
                      <div style={{ marginTop: 3, fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</div>
                      <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span className="tabular-nums" style={{ fontSize: 13, fontWeight: 600, color: '#0b7688' }}>{moneyK(d.value)}</span>
                        <span style={{ width: 24, height: 24, borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 600, color: '#fff', background: `linear-gradient(135deg, ${col.tint}, #22b8cf)` }}>{d.owner}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* TABLE */}
        {isTable && (
          <div className="glass-card" style={{ overflow: 'hidden', padding: 0 }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', minWidth: 720, borderCollapse: 'collapse', fontSize: 14, textAlign: 'start' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(15,23,42,.08)', background: 'rgba(241,245,249,.5)' }}>
                    <th style={{ padding: '12px 16px', width: 20 }}>
                      <button type="button" onClick={selectAllPage} aria-label="בחר הכל" style={selBox(allSelected)}>
                        {allSelected && <Ico d={P.check} size={11} color="#fff" sw={3} />}
                      </button>
                    </th>
                    {columns.map((col) => (
                      <th key={col.key} className="crm-th" onClick={() => onSort(col.key)} style={{ padding: '12px 16px', textAlign: 'start', fontSize: 12, fontWeight: 600, color: '#55627a', whiteSpace: 'nowrap' }}>
                        {col.label}<span style={{ marginInlineStart: 4, color: '#0e8ba0' }}>{col.arrow}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((r) => {
                    const on = selected.includes(tab + r.id);
                    return (
                      <tr key={r.id} className="crm-row" style={{ borderBottom: '1px solid rgba(15,23,42,.06)', transition: 'background .15s ease', ...(on ? { background: 'rgba(14,139,160,.05)' } : {}) }}>
                        <td style={{ padding: '13px 16px' }}>
                          <button type="button" onClick={() => toggleSel(tab + r.id)} aria-label="בחר" style={selBox(on)}>
                            {on && <Ico d={P.check} size={11} color="#fff" sw={3} />}
                          </button>
                        </td>
                        <td onClick={() => setRecId(r.id)} style={{ padding: '13px 16px', cursor: 'pointer' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span style={{ flex: 'none', width: 30, height: 30, borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff', background: r.tint }}>{r.initials}</span>
                            <span style={{ fontWeight: 600, color: '#0f172a' }}>{r.name}</span>
                          </div>
                        </td>
                        <td onClick={() => setRecId(r.id)} style={{ padding: '13px 16px', cursor: 'pointer' }}><span style={r.badgeStyle}>{r.badgeText}</span></td>
                        <td onClick={() => setRecId(r.id)} style={{ padding: '13px 16px', color: '#55627a', cursor: 'pointer' }}>{r.c3}</td>
                        <td onClick={() => setRecId(r.id)} style={{ padding: '13px 16px', color: '#55627a', cursor: 'pointer' }} dir="ltr"><span style={{ display: 'block', textAlign: 'end' }}>{r.c4}</span></td>
                        <td onClick={() => setRecId(r.id)} style={{ padding: '13px 16px', color: '#55627a', cursor: 'pointer' }}>{r.c5}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {isEmpty && emptyBlock}
          </div>
        )}

        {/* CARDS */}
        {isCards && (
          <>
            <div className="r-cards" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14 }}>
              {pageRows.map((r) => (
                <div key={r.id} className="glass-card crm-card" onClick={() => setRecId(r.id)} style={{ padding: 18, cursor: 'pointer' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ flex: 'none', width: 42, height: 42, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: '#fff', background: r.tint }}>{r.initials}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 15, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</div>
                      <span style={r.badgeStyle}>{r.badgeText}</span>
                    </div>
                  </div>
                  <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 7, fontSize: 13, color: '#55627a' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#94a3b8' }}>{r.l3}</span><span>{r.c3}</span></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#94a3b8' }}>{r.l4}</span><span dir="ltr">{r.c4}</span></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#94a3b8' }}>{r.l5}</span><span>{r.c5}</span></div>
                  </div>
                </div>
              ))}
            </div>
            {isEmpty && (
              <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '56px 24px', textAlign: 'center' }}>
                <span className="flex items-center justify-center rounded-full" style={{ width: 52, height: 52, background: '#f1f5f9', fontSize: 24 }}>🏢</span>
                <p className="m-0" style={{ fontSize: 15, fontWeight: 600 }}>לא נמצאו תוצאות</p>
              </div>
            )}
          </>
        )}

        {/* pagination */}
        {showPager && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 16, fontSize: 13, color: '#55627a' }}>
            <span>מציג {pageFrom}–{pageTo} מתוך {totalRows}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} style={{ cursor: 'pointer', border: '1px solid rgba(15,23,42,.16)', background: '#fff', borderRadius: 9, padding: 6, display: 'flex', color: pageNum <= 1 ? '#cbd5e1' : '#0f172a' }}>
                <Ico d={P.chevRight} size={15} sw={2} />
              </button>
              <span className="tabular-nums" style={{ fontWeight: 600, color: '#0f172a' }}>{pageNum} / {pageCount}</span>
              <button type="button" onClick={() => setPage((p) => Math.min(pageCount, p + 1))} style={{ cursor: 'pointer', border: '1px solid rgba(15,23,42,.16)', background: '#fff', borderRadius: 9, padding: 6, display: 'flex', color: pageNum >= pageCount ? '#cbd5e1' : '#0f172a' }}>
                <Ico d={P.chevLeft} size={15} sw={2} />
              </button>
            </div>
          </div>
        )}
      </main>

      {/* ADD DRAWER */}
      {addOpen && (
        <>
          <div onClick={() => setAddOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(15,23,42,.28)', animation: 'dash-fade .2s ease both' }} />
          <aside dir="rtl" style={{ position: 'fixed', top: 0, insetInlineStart: 0, zIndex: 61, width: 'min(440px,94vw)', height: '100vh', background: '#fff', boxShadow: '0 12px 40px rgba(15,23,42,.2)', display: 'flex', flexDirection: 'column', animation: 'dash-drawer-in .28s cubic-bezier(.22,1,.36,1) both' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 22px', borderBottom: '1px solid rgba(15,23,42,.08)' }}>
              <div style={{ fontSize: 17, fontWeight: 600 }}>{addTitle}</div>
              <button type="button" onClick={() => setAddOpen(false)} aria-label="סגור" style={{ cursor: 'pointer', border: 'none', background: 'none', color: '#94a3b8' }}>
                <Ico d={P.close} size={20} sw={1.8} />
              </button>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); addRecord(); }} className="scrollbar-hide" style={{ flex: 1, overflowY: 'auto', padding: 22, display: 'flex', flexDirection: 'column', gap: 16 }}>
              {addFieldsDef.map(([k, label, isSel, opts]) => (
                <label key={k} style={{ display: 'block' }}>
                  <span style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: '#55627a', marginBottom: 6 }}>{label}</span>
                  {isSel ? (
                    <select value={addForm[k] || opts[0]} onChange={setF(k)} style={{ width: '100%', border: '1px solid rgba(15,23,42,.16)', borderRadius: 11, padding: '10px 12px', fontFamily: 'inherit', fontSize: 14, color: '#0f172a', background: '#fff', outline: 'none', boxSizing: 'border-box' }}>
                      {opts.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : (
                    <input value={addForm[k] || ''} onChange={setF(k)} placeholder={label} style={{ width: '100%', border: '1px solid rgba(15,23,42,.16)', borderRadius: 11, padding: '10px 12px', fontFamily: 'inherit', fontSize: 14, color: '#0f172a', outline: 'none', boxSizing: 'border-box' }} />
                  )}
                </label>
              ))}
              <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                <button type="submit" style={{ cursor: 'pointer', fontFamily: 'inherit', flex: 1, border: 'none', borderRadius: 12, background: '#0e8ba0', color: '#fff', padding: 12, fontSize: 14, fontWeight: 600 }}>הוספה</button>
                <button type="button" onClick={() => setAddOpen(false)} style={{ cursor: 'pointer', fontFamily: 'inherit', border: '1px solid rgba(15,23,42,.16)', borderRadius: 12, background: '#fff', color: '#0f172a', padding: '12px 18px', fontSize: 14, fontWeight: 600 }}>ביטול</button>
              </div>
            </form>
          </aside>
        </>
      )}

      {/* RECORD DRAWER */}
      {recOpen && rec && (
        <>
          <div onClick={() => setRecId(null)} style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(15,23,42,.28)', animation: 'dash-fade .2s ease both' }} />
          <aside dir="rtl" style={{ position: 'fixed', top: 0, insetInlineStart: 0, zIndex: 61, width: 'min(460px,94vw)', height: '100vh', background: '#fff', boxShadow: '0 12px 40px rgba(15,23,42,.2)', display: 'flex', flexDirection: 'column', animation: 'dash-drawer-in .28s cubic-bezier(.22,1,.36,1) both' }}>
            <div style={{ padding: 22, borderBottom: '1px solid rgba(15,23,42,.08)' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ flex: 'none', width: 46, height: 46, borderRadius: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 700, color: '#fff', background: rec.tint }}>{rec.initials}</span>
                  <div>
                    <div style={{ fontSize: 17, fontWeight: 600 }}>{rec.name}</div>
                    <div style={{ fontSize: 13, color: '#94a3b8' }}>{rec.sub}</div>
                  </div>
                </div>
                <button type="button" onClick={() => setRecId(null)} aria-label="סגור" style={{ cursor: 'pointer', border: 'none', background: 'none', color: '#94a3b8' }}>
                  <Ico d={P.close} size={20} sw={1.8} />
                </button>
              </div>
              <div style={{ marginTop: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {rec.actions.map((a) => (
                  <button key={a.label} type="button" onClick={a.onClick} style={{ cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 6, border: '1px solid rgba(15,23,42,.14)', background: '#fff', borderRadius: 10, padding: '8px 12px', fontSize: 12.5, fontWeight: 600, color: '#0f172a' }}>
                    <span style={{ color: '#0e8ba0' }}><Ico d={a.icon} size={15} /></span>{a.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="scrollbar-hide" style={{ flex: 1, overflowY: 'auto', padding: 22 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: '#94a3b8', marginBottom: 10 }}>פרטים</div>
              <div style={{ border: '1px solid rgba(15,23,42,.08)', borderRadius: 12, padding: 14, marginBottom: 22, display: 'flex', flexDirection: 'column', gap: 9 }}>
                {rec.fields.map((f) => (
                  <div key={f.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5 }}>
                    <span style={{ color: '#94a3b8' }}>{f.label}</span>
                    <span style={{ color: '#0f172a', fontWeight: 500 }} dir={f.dir}>{f.value}</span>
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: '#94a3b8', marginBottom: 10 }}>היסטוריה</div>
              <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column' }}>
                {rec.timeline.map((t, i) => (
                  <li key={i} style={{ display: 'flex', gap: 12 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <span style={{ flex: 'none', width: 28, height: 28, borderRadius: 999, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>{t.icon}</span>
                      {t.line && <span style={{ flex: 1, width: 2, background: 'rgba(15,23,42,.08)', minHeight: 14 }} />}
                    </div>
                    <div style={{ paddingBottom: 16 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>{t.title}</div>
                      <div style={{ fontSize: 12, color: '#55627a', marginTop: 1 }}>{t.text}</div>
                      <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 3 }}>{t.time}</div>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </aside>
        </>
      )}

      {/* toast */}
      {toast && (
        <div style={{ position: 'fixed', bottom: 28, insetInlineStart: '50%', transform: 'translateX(50%)', zIndex: 80, background: '#0f172a', color: '#fff', borderRadius: 12, padding: '12px 20px', fontSize: 14, boxShadow: '0 12px 32px rgba(15,23,42,.28)', animation: 'dash-fade .25s ease both' }}>
          {toast}
        </div>
      )}
    </div>
  );
}
