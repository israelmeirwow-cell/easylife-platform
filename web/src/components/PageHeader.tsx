import type { ReactNode } from 'react';

/* Quiet SaaS page header: compact title, muted subtitle, plain hairline.
   `kicker` is accepted for compatibility but intentionally not rendered —
   the language keeps chrome minimal. */

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  badge?: string;
  kicker?: string;
  actions?: ReactNode;
}

export function PageHeader({ title, subtitle, badge, actions }: PageHeaderProps) {
  return (
    <header className="mb-6 border-b border-border pb-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-xl font-semibold tracking-tight text-ink">{title}</h1>
            {badge && (
              <span className="rounded-full border border-gold/40 bg-gold-soft px-2.5 py-0.5 text-[11px] font-medium text-gold-strong">
                {badge}
              </span>
            )}
          </div>
          {subtitle && (
            <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted">{subtitle}</p>
          )}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}
