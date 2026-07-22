import { ChevronLeft, Plug, Bot, Users, CreditCard, type LucideIcon } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';

const SECTIONS: { icon: LucideIcon; title: string; desc: string }[] = [
  { icon: Plug, title: 'ערוצים מחוברים', desc: 'וואטסאפ, אינסטגרם, מייל, חנות — חיבור עצמאי בקליק' },
  { icon: Bot, title: 'סוכנים', desc: 'הפעלה, השהיה וכיוונון של סוכני ה-AI של העסק' },
  { icon: Users, title: 'צוות', desc: 'משתמשים, הרשאות והתראות' },
  { icon: CreditCard, title: 'מנוי וחיוב', desc: 'תוכנית, שימוש וחשבוניות' },
];

export default function Settings() {
  return (
    <div className="mx-auto w-full max-w-3xl">
      <PageHeader
        kicker="Control Center"
        title="הגדרות"
        subtitle="חיבור ערוצים, ניהול סוכנים והרשאות צוות — הכול בשירות עצמי, בלי אינטגרטור."
        badge="בקרוב"
      />

      <div className="glass-card overflow-hidden !p-0">
        {SECTIONS.map(({ icon: Icon, title, desc }) => (
          <div
            key={title}
            className="group flex cursor-pointer items-center gap-4 border-b border-border px-5 py-4 transition-colors last:border-b-0 hover:bg-surface-raised/60"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gold-soft text-gold transition-transform group-hover:scale-105">
              <Icon className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-ink">{title}</div>
              <div className="mt-0.5 truncate text-xs text-muted">{desc}</div>
            </div>
            <ChevronLeft
              className="h-4 w-4 text-faint transition-transform group-hover:-translate-x-0.5 group-hover:text-ink"
              aria-hidden="true"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
