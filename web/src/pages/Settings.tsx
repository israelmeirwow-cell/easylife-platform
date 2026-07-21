import { PageHeader } from '../components/PageHeader';

const SECTIONS = [
  { icon: '🔌', title: 'ערוצים מחוברים', desc: 'וואטסאפ, אינסטגרם, מייל, חנות — חיבור עצמאי בקליק' },
  { icon: '🤖', title: 'סוכנים', desc: 'הפעלה, השהיה וכיוונון של סוכני ה-AI של העסק' },
  { icon: '👥', title: 'צוות', desc: 'משתמשים, הרשאות והתראות' },
  { icon: '💳', title: 'מנוי וחיוב', desc: 'תוכנית, שימוש וחשבוניות' },
];

export default function Settings() {
  return (
    <div className="mx-auto w-full max-w-3xl">
      <PageHeader
        title="הגדרות"
        subtitle="חיבור ערוצים, ניהול סוכנים והרשאות צוות — הכול בשירות עצמי, בלי אינטגרטור."
        badge="בקרוב"
      />

      <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-card">
        {SECTIONS.map(({ icon, title, desc }) => (
          <div
            key={title}
            className="flex items-center gap-4 border-b border-border px-5 py-4 opacity-70 last:border-b-0"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-raised text-lg">
              {icon}
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-ivory">{title}</div>
              <div className="mt-0.5 truncate text-xs text-muted">{desc}</div>
            </div>
            <span className="text-faint" aria-hidden="true">
              ‹
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
