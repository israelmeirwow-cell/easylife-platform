import { useQuery } from '@tanstack/react-query';
import { listLeads } from '../../lib/crm';
import type { Lead, LeadStage } from '../../lib/types';
import { LEAD_STAGE_LABEL, LEAD_STAGE_TONE } from '../../lib/crmMeta';
import { formatAgorot, formatDate } from '../../lib/format';
import { PageHeader } from '../../components/PageHeader';
import { Avatar, Badge, EmptyState, SkeletonRow } from '../../components/ui';

const STAGE_ORDER: LeadStage[] = ['new', 'contacted', 'qualified', 'won', 'lost'];

export default function LeadsPage() {
  const { data: leads = [], isLoading } = useQuery({
    queryKey: ['leads'],
    queryFn: () => listLeads(),
  });

  const grouped = STAGE_ORDER.map((stage) => ({
    stage,
    items: leads.filter((l) => l.stage === stage),
  }));

  return (
    <div>
      <PageHeader
        title="לידים"
        subtitle="כל ליד שנכנס לעסק — ממוין לפי שלב, כדי שתדעו במי לטפל עכשיו."
      />

      {isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <SkeletonRow key={i} className="h-16 w-full rounded-2xl" />
          ))}
        </div>
      ) : leads.length === 0 ? (
        <EmptyState
          icon="🎯"
          title="עדיין אין לידים"
          hint="כשסוכן יזהה פנייה חמה, הליד יופיע כאן עם השלב והשווי המשוער."
        />
      ) : (
        <div className="space-y-6">
          {grouped.map(({ stage, items }) => {
            if (items.length === 0) return null;
            return (
              <section key={stage}>
                <div className="mb-2 flex items-center gap-2 px-1">
                  <Badge tone={LEAD_STAGE_TONE[stage]}>{LEAD_STAGE_LABEL[stage]}</Badge>
                  <span className="rounded-full bg-surface-raised px-2 py-0.5 text-xs text-muted">
                    {items.length}
                  </span>
                </div>
                <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-card">
                  {items.map((l: Lead) => (
                    <div
                      key={l.id}
                      className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-0"
                    >
                      <Avatar name={l.contact_name ?? l.contact_id} size="sm" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-ink">
                          {l.contact_name ?? 'ליד'}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-2 text-xs text-muted">
                          {l.source_channel && <span>{l.source_channel}</span>}
                          <span>· {formatDate(l.created_at)}</span>
                        </div>
                      </div>
                      {l.value_agorot != null && (
                        <span className="shrink-0 text-sm font-semibold text-gold-strong">
                          {formatAgorot(l.value_agorot)}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
