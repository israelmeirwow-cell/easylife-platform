import { Inbox as InboxIcon } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';

function ConversationRow({ w1, w2 }: { w1: string; w2: string }) {
  return (
    <div className="flex items-center gap-3 border-b border-border px-4 py-3.5 transition-colors last:border-b-0 hover:bg-surface-raised/50">
      <div className="h-10 w-10 shrink-0 rounded-full bg-surface-raised" />
      <div className="flex-1 space-y-2">
        <div className={`h-3 rounded bg-surface-raised ${w1}`} />
        <div className={`h-2.5 rounded bg-surface-raised/70 ${w2}`} />
      </div>
      <div className="h-2.5 w-8 rounded bg-surface-raised/50" />
    </div>
  );
}

export default function Inbox() {
  return (
    <div className="mx-auto w-full max-w-5xl">
      <PageHeader
        kicker="Unified Inbox"
        title="אינבוקס"
        subtitle="כל השיחות מכל הערוצים — וואטסאפ, אינסטגרם, פייסבוק ומייל — במקום אחד, עם חלוקה בין הסוכן לבין הצוות."
        badge="בקרוב"
      />

      <div className="grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        {/* conversation list */}
        <div className="glass-card overflow-hidden !p-0">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <span className="flex items-center gap-2 text-sm font-semibold text-ink">
              <InboxIcon className="h-4 w-4 text-gold" aria-hidden="true" />
              שיחות פתוחות
            </span>
            <span className="rounded-full bg-surface-raised px-2 py-0.5 text-xs text-faint tabular-nums">0</span>
          </div>
          <ConversationRow w1="w-24" w2="w-36" />
          <ConversationRow w1="w-32" w2="w-28" />
          <ConversationRow w1="w-20" w2="w-40" />
        </div>

        {/* message pane */}
        <div className="hidden flex-col rounded-2xl border border-dashed border-border-strong bg-surface/40 md:flex">
          <div className="flex flex-1 flex-col justify-end gap-3 p-6">
            <div className="h-9 w-1/2 self-start rounded-2xl rounded-es-md bg-surface-raised/70" />
            <div className="h-9 w-2/5 self-end rounded-2xl rounded-ee-md bg-gold-soft" />
            <div className="h-9 w-3/5 self-start rounded-2xl rounded-es-md bg-surface-raised/70" />
          </div>
          <div className="border-t border-border p-4">
            <div className="h-11 rounded-xl border border-border bg-background/60" />
          </div>
        </div>
      </div>
    </div>
  );
}
