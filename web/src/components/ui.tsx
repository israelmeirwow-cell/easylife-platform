import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';
import { initials } from '../lib/format';

/* --------------------------------- Badge --------------------------------- */

export function Badge({
  children,
  tone = 'bg-surface-raised text-muted',
  className = '',
}: {
  children: ReactNode;
  tone?: string;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium leading-4 ${tone} ${className}`}
    >
      {children}
    </span>
  );
}

/* -------------------------------- Avatar --------------------------------- */

const AVATAR_TONES = [
  'bg-info-soft text-info',
  'bg-gold-soft text-gold-strong',
  'bg-success-soft text-success',
  'bg-warning-soft text-warning',
  'bg-danger-soft text-danger',
];

function hashTone(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return AVATAR_TONES[Math.abs(h) % AVATAR_TONES.length];
}

export function Avatar({
  name,
  size = 'md',
}: {
  name: string | null | undefined;
  size?: 'sm' | 'md' | 'lg';
}) {
  const dims =
    size === 'sm'
      ? 'h-7 w-7 text-[11px]'
      : size === 'lg'
        ? 'h-14 w-14 text-lg'
        : 'h-9 w-9 text-xs';
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold uppercase ${dims} ${hashTone(
        name ?? '?',
      )}`}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  );
}

/* --------------------------------- Card ---------------------------------- */

export function Card({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-border bg-surface shadow-card ${className}`}
    >
      {children}
    </div>
  );
}

/* -------------------------------- Button --------------------------------- */

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-gold text-white hover:bg-gold-hover disabled:opacity-50 shadow-card',
  secondary:
    'border border-border-strong bg-surface text-ink hover:bg-surface-raised disabled:opacity-50',
  ghost: 'text-muted hover:bg-surface-raised hover:text-ink disabled:opacity-50',
  danger:
    'border border-danger/40 bg-danger-soft text-danger hover:bg-danger/15 disabled:opacity-50',
};

export function Button({
  variant = 'primary',
  className = '',
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition ${BUTTON_VARIANTS[variant]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

/* --------------------------- Form field wrappers ------------------------- */

export function Field({
  label,
  children,
  className = '',
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-xs font-medium text-muted">{label}</span>
      {children}
    </label>
  );
}

const INPUT_BASE =
  'w-full rounded-xl border border-border-strong bg-surface px-3.5 py-2.5 text-sm text-ink placeholder:text-faint transition focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/20';

export function Input({ className = '', ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${INPUT_BASE} ${className}`} {...rest} />;
}

export function Textarea({
  className = '',
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea className={`${INPUT_BASE} resize-y ${className}`} rows={3} {...rest} />
  );
}

export function Select({
  className = '',
  children,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={`${INPUT_BASE} ${className}`} {...rest}>
      {children}
    </select>
  );
}

/* ------------------------------ Search box ------------------------------- */

export function SearchBox({
  value,
  onChange,
  placeholder = 'חיפוש…',
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="relative w-full max-w-xs">
      <span className="pointer-events-none absolute inset-y-0 start-3 flex items-center text-faint">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          className="h-4 w-4"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="m21 21-4.34-4.34M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z"
          />
        </svg>
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-border-strong bg-surface py-2 pe-3 ps-9 text-sm text-ink placeholder:text-faint transition focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/20"
      />
    </div>
  );
}

/* ------------------------------ Empty state ------------------------------ */

export function EmptyState({
  icon = '📭',
  title,
  hint,
  action,
}: {
  icon?: string;
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border-strong bg-surface/60 px-6 py-16 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-surface-raised text-2xl">
        {icon}
      </span>
      <p className="text-base font-medium text-ink">{title}</p>
      {hint && <p className="max-w-sm text-sm leading-relaxed text-muted">{hint}</p>}
      {action}
    </div>
  );
}

/* -------------------------------- Spinner -------------------------------- */

export function Spinner({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg
      className={`animate-spin text-gold ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-90"
        fill="currentColor"
        d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

/* --------------------------------- Modal --------------------------------- */

export function Modal({
  open,
  onClose,
  title,
  children,
  width = 'max-w-lg',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  width?: string;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/30 px-4 py-10 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className={`w-full ${width} animate-feed-in rounded-2xl border border-border bg-surface shadow-pop`}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-base font-semibold text-ink">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-faint transition hover:bg-surface-raised hover:text-ink"
            aria-label="סגירה"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              className="h-4.5 w-4.5"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </header>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

/* ------------------------------ Skeleton bar ----------------------------- */

export function SkeletonRow({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-surface-raised ${className}`} />;
}
