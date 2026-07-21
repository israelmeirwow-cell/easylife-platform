import { PageHeader } from '../components/PageHeader';

const STAGES = ['חדש', 'נוצר קשר', 'מוכשר', 'נסגר'];

function GhostCard() {
  return (
    <div className="space-y-2 rounded-xl border border-dashed border-border-strong bg-surface/40 p-3">
      <div className="h-3 w-2/3 rounded bg-surface-raised" />
      <div className="h-2.5 w-1/3 rounded bg-surface-raised/70" />
    </div>
  );
}

export default function Crm() {
  return (
    <div className="mx-auto w-full max-w-6xl">
      <PageHeader
        title="לקוחות"
        subtitle="כרטיס לקוח מלא לכל מי שאי פעם דיבר עם העסק — ציר זמן, תגיות ולידים בלוח קנבן שהסוכנים מעדכנים לבד."
        badge="בקרוב"
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {STAGES.map((stage, i) => (
          <section key={stage} className="rounded-xl border border-border bg-surface/60 p-3 shadow-card">
            <header className="mb-3 flex items-center justify-between px-1">
              <h2 className="text-sm font-medium text-ivory">{stage}</h2>
              <span className="rounded-full bg-surface-raised px-2 py-0.5 text-xs text-faint">0</span>
            </header>
            <div className="space-y-2">
              <GhostCard />
              {i % 2 === 0 && <GhostCard />}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
