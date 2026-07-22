import type { ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

/* Editorial header — the design language's anchor: uppercase kicker, display
   title (Space Grotesk), subtitle, and a gradient hairline underneath.
   Motion is transform-only (never opacity-gated) so content is always visible. */

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  badge?: string;
  kicker?: string;
  actions?: ReactNode;
}

export function PageHeader({ title, subtitle, badge, kicker, actions }: PageHeaderProps) {
  const reduce = useReducedMotion();
  const slide = (delay: number) =>
    reduce
      ? {}
      : {
          initial: { y: 12 },
          animate: { y: 0 },
          transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] as const, delay },
        };

  return (
    <header className="mb-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          {kicker && (
            <motion.div
              {...slide(0)}
              className="mb-2 text-[10px] font-medium uppercase tracking-[0.3em] text-faint"
            >
              {kicker}
            </motion.div>
          )}
          <motion.div {...slide(0.05)} className="flex flex-wrap items-center gap-3">
            <h1
              className="text-3xl font-bold tracking-tight text-ink md:text-4xl"
              style={{ fontFamily: "'Space Grotesk','Heebo',sans-serif" }}
            >
              {title}
            </h1>
            {badge && (
              <span className="rounded-full border border-gold/40 bg-gold-soft px-3 py-0.5 text-xs font-medium text-gold-strong">
                {badge}
              </span>
            )}
          </motion.div>
          {subtitle && (
            <motion.p {...slide(0.1)} className="mt-2.5 max-w-2xl text-sm leading-relaxed text-muted">
              {subtitle}
            </motion.p>
          )}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
      {/* gradient hairline — the language's signature divider */}
      <div
        className="mt-5 h-px w-full"
        style={{
          background:
            'linear-gradient(to left, var(--color-gold) 0%, rgba(14,139,160,0.25) 30%, rgba(15,23,42,0.06) 100%)',
        }}
      />
    </header>
  );
}
