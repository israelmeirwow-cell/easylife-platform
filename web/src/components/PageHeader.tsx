interface PageHeaderProps {
  title: string;
  subtitle?: string;
  badge?: string;
}

export function PageHeader({ title, subtitle, badge }: PageHeaderProps) {
  return (
    <header className="mb-8">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-ivory">{title}</h1>
        {badge && (
          <span className="rounded-full border border-gold/30 bg-gold-soft px-3 py-0.5 text-xs font-medium text-gold">
            {badge}
          </span>
        )}
      </div>
      {subtitle && <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">{subtitle}</p>}
    </header>
  );
}
