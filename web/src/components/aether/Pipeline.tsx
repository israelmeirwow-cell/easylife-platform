import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import type { Deal, DealStage } from '@/lib/types';
import { DEAL_STAGES } from '@/lib/crmMeta';
import { formatAgorotCompact, initials } from '@/lib/format';

const STAGE_TINT: Record<DealStage, string> = {
  lead: '#0e8ba0',
  qualified: '#1666a8',
  proposal: '#6d8bf0',
  negotiation: '#b26a00',
  won: '#12805c',
  lost: '#d1453b',
};

/** dealName resolves a client-side friendly title — never a raw UUID. */
function dealSubtitle(deal: Deal): string {
  return deal.account_name || deal.contact_name || 'ללא שיוך';
}

export function Pipeline({ deals, loading }: { deals: Deal[]; loading?: boolean }) {
  const byStage: Record<DealStage, Deal[]> = {
    lead: [],
    qualified: [],
    proposal: [],
    negotiation: [],
    won: [],
    lost: [],
  };
  for (const d of deals) (byStage[d.stage] ?? byStage.lead).push(d);

  const totalAgorot = deals
    .filter((d) => d.stage !== 'lost')
    .reduce((sum, d) => sum + (d.value_agorot ?? 0), 0);

  // Show the 4 most active stages on the compact hero board.
  const boardStages = DEAL_STAGES.filter((s) => s.key !== 'lost');

  return (
    <div className="p-6" style={{ perspective: '1400px' }}>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-[0.25em] text-faint">צינור מכירות</div>
          <div className="mt-1 text-lg font-semibold text-ink" style={{ fontFamily: "'Space Grotesk',sans-serif" }}>
            זרימת עסקאות · <span className="text-gradient">{formatAgorotCompact(totalAgorot)}</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-faint">
          <Link to="/crm/deals" className="rounded-full border border-border px-2 py-0.5 transition hover:text-ink">
            לוח מלא
          </Link>
          <span className="rounded-full border border-border-strong bg-gold-soft px-2 py-0.5 text-gold-strong">חי</span>
        </div>
      </div>

      <div
        className="grid grid-cols-2 gap-4 lg:grid-cols-4"
        style={{ transform: 'rotateX(6deg) rotateZ(-1deg)', transformStyle: 'preserve-3d' }}
      >
        {boardStages.map((s, i) => {
          const stageDeals = byStage[s.key];
          const tint = STAGE_TINT[s.key];
          return (
            <div key={s.key} className="flex flex-col gap-2.5" style={{ transform: `translateZ(${i * 8}px)` }}>
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: tint, boxShadow: `0 0 10px ${tint}` }} />
                  <span className="text-xs font-medium text-ink">{s.label}</span>
                </div>
                <span className="text-[10px] text-faint">{loading ? '·' : stageDeals.length}</span>
              </div>
              <div className="flex flex-col gap-2.5">
                {loading &&
                  Array.from({ length: 2 }).map((_, j) => (
                    <div key={j} className="h-20 animate-pulse rounded-2xl border border-border bg-surface-raised" />
                  ))}
                {!loading && stageDeals.length === 0 && (
                  <div className="flex h-16 items-center justify-center rounded-2xl border border-dashed border-border text-[10px] text-faint">
                    אין עסקאות
                  </div>
                )}
                {!loading &&
                  stageDeals.slice(0, 3).map((d) => (
                    <motion.div
                      key={d.id}
                      layout
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="glass-card p-3.5"
                      style={{ boxShadow: `inset 0 1px 0 rgba(255,255,255,0.7), 0 10px 30px -18px ${tint}66` }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate text-[10px] uppercase tracking-widest text-faint">
                            {dealSubtitle(d)}
                          </div>
                          <div className="mt-0.5 truncate text-sm font-medium text-ink">{d.title}</div>
                        </div>
                      </div>
                      <div className="mt-3 flex items-center justify-between">
                        <div className="text-sm font-semibold text-gold-strong tabular-nums">
                          {formatAgorotCompact(d.value_agorot)}
                        </div>
                        {d.owner_user_id && (
                          <div
                            className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold"
                            style={{ background: `linear-gradient(135deg, ${tint}, #22b8cf)`, color: '#ffffff' }}
                          >
                            {initials(d.owner_user_id)}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  ))}
                {!loading && stageDeals.length > 3 && (
                  <div className="text-center text-[10px] text-faint">+{stageDeals.length - 3} נוספות</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
