import { PageHeader } from '../components/PageHeader';

const STAT_CARDS = ['הכנסות החודש', 'הוצאות החודש', 'מאזן'];
const BAR_HEIGHTS = ['h-10', 'h-16', 'h-8', 'h-20', 'h-14', 'h-24', 'h-12', 'h-18', 'h-16', 'h-9', 'h-20', 'h-14'];

export default function Cashflow() {
  return (
    <div className="mx-auto w-full max-w-5xl">
      <PageHeader
        title="תזרים"
        subtitle="תמונת מזומנים חיה מחשבוניות, סליקה והזמנות מהחנות — בלי חיבור לבנק ובלי אקסל."
        badge="בקרוב"
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        {STAT_CARDS.map((title) => (
          <div key={title} className="rounded-xl border border-border bg-surface p-5 shadow-card">
            <div className="text-sm text-muted">{title}</div>
            <div className="mt-3 h-7 w-24 rounded bg-surface-raised" />
            <div className="mt-2 h-2.5 w-16 rounded bg-surface-raised/60" />
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-dashed border-border-strong bg-surface/40 p-6">
        <div className="mb-6 flex items-center justify-between">
          <span className="text-sm font-medium text-muted">תזרים חודשי</span>
          <div className="h-2.5 w-20 rounded bg-surface-raised/60" />
        </div>
        <div className="flex h-32 items-end justify-between gap-2">
          {BAR_HEIGHTS.map((h, i) => (
            <div
              key={i}
              className={`w-full rounded-t-md ${h} ${i % 3 === 0 ? 'bg-gold-soft' : 'bg-surface-raised'}`}
            />
          ))}
        </div>
        <div className="mt-3 flex justify-between">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-2 w-8 rounded bg-surface-raised/50" />
          ))}
        </div>
      </div>
    </div>
  );
}
