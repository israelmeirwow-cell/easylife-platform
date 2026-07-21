import type { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  badge?: string;
  actions?: ReactNode;
}

export function PageHeader({ title, subtitle, badge, actions }: PageHeaderProps) {
  return (
    <header className="mb-7 flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>
          {badge && (
            <span className="rounded-full border border-gold/40 bg-gold-soft px-3 py-0.5 text-xs font-medium text-gold-strong">
              {badge}
            </span>
          )}
        </div>
        {subtitle && (
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">{subtitle}</p>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}
