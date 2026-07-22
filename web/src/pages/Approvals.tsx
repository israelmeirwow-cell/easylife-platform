import { Hand, Smartphone } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';

function GhostApprovalCard() {
  return (
    <article className="glass-card p-5">
      <div className="flex items-start gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-warning-soft text-warning">
          <Hand className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="flex-1 space-y-2.5 pt-1">
          <div className="h-3 w-1/3 rounded bg-surface-raised" />
          <div className="h-2.5 w-4/5 rounded bg-surface-raised/70" />
          <div className="h-2.5 w-3/5 rounded bg-surface-raised/70" />
        </div>
      </div>
      <div className="mt-5 flex gap-3">
        <button
          type="button"
          disabled
          className="cursor-not-allowed rounded-xl bg-gold/20 px-5 py-2 text-sm font-semibold text-gold-strong/50"
        >
          אישור
        </button>
        <button
          type="button"
          disabled
          className="cursor-not-allowed rounded-xl border border-danger/30 px-5 py-2 text-sm font-medium text-danger/50"
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
        kicker="Human in the Loop"
        title="אישורים"
        subtitle="כשסוכן רוצה לבצע פעולה רגישה — שליחת הצעת מחיר, זיכוי, הודעה ללקוח כועס — הוא עוצר ומבקש אישור. כאן מאשרים בלחיצה."
        badge="בקרוב"
      />

      <div className="space-y-4">
        <GhostApprovalCard />
        <GhostApprovalCard />
      </div>

      <p className="mt-6 flex items-center justify-center gap-1.5 text-center text-xs text-faint">
        <Smartphone className="h-3.5 w-3.5" aria-hidden="true" />
        אפשר יהיה לאשר גם מהנייד — בהתראת פוש או בתשובת וואטסאפ "1"/"2".
      </p>
    </div>
  );
}
