import { PageHeader } from '../components/PageHeader';

function GhostApprovalCard() {
  return (
    <article className="rounded-xl border border-dashed border-border-strong bg-surface/40 p-5">
      <div className="flex items-start gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gold-soft text-lg">
          ✋
        </div>
        <div className="flex-1 space-y-2.5">
          <div className="h-3 w-1/3 rounded bg-surface-raised" />
          <div className="h-2.5 w-4/5 rounded bg-surface-raised/70" />
          <div className="h-2.5 w-3/5 rounded bg-surface-raised/70" />
        </div>
      </div>
      <div className="mt-5 flex gap-3">
        <button
          type="button"
          disabled
          className="cursor-not-allowed rounded-xl border border-gold/40 px-5 py-2 text-sm font-medium text-gold/50"
        >
          אישור
        </button>
        <button
          type="button"
          disabled
          className="cursor-not-allowed rounded-xl border border-danger/40 px-5 py-2 text-sm font-medium text-danger/50"
        >
          דחייה
        </button>
      </div>
    </article>
  );
}

export default function Approvals() {
  return (
    <div className="mx-auto w-full max-w-3xl">
      <PageHeader
        title="אישורים"
        subtitle="כשסוכן רוצה לבצע פעולה רגישה — שליחת הצעת מחיר, זיכוי, הודעה ללקוח כועס — הוא עוצר ומבקש אישור. כאן מאשרים בלחיצה."
        badge="בקרוב"
      />

      <div className="space-y-4">
        <GhostApprovalCard />
        <GhostApprovalCard />
      </div>

      <p className="mt-6 text-center text-xs text-faint">
        אפשר יהיה לאשר גם מהנייד — בהתראת פוש או בתשובת וואטסאפ "1"/"2".
      </p>
    </div>
  );
}
