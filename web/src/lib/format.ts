/** Money is always stored as integer agorot (₪1 = 100 agorot). */

const ilsFmt = new Intl.NumberFormat('he-IL', {
  style: 'currency',
  currency: 'ILS',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const ilsFmtCents = new Intl.NumberFormat('he-IL', {
  style: 'currency',
  currency: 'ILS',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const numFmt = new Intl.NumberFormat('he-IL');

/** Format agorot → "₪ 12,500" (rounded to whole shekels). */
export function formatAgorot(agorot: number | null | undefined): string {
  if (agorot == null) return ilsFmt.format(0);
  return ilsFmt.format(Math.round(agorot / 100));
}

/** Format agorot → "₪ 12,500.00" (shows agorot). */
export function formatAgorotPrecise(agorot: number | null | undefined): string {
  if (agorot == null) return ilsFmtCents.format(0);
  return ilsFmtCents.format(agorot / 100);
}

/** Compact large sums for KPI cards: 1,250,000 agorot → "₪ 12.5K". */
export function formatAgorotCompact(agorot: number | null | undefined): string {
  const shekels = Math.round((agorot ?? 0) / 100);
  if (Math.abs(shekels) >= 1_000_000) {
    return `₪ ${(shekels / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  }
  if (Math.abs(shekels) >= 1_000) {
    return `₪ ${(shekels / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  }
  return ilsFmt.format(shekels);
}

export function formatNumber(n: number | null | undefined): string {
  return numFmt.format(n ?? 0);
}

const dateFmt = new Intl.DateTimeFormat('he-IL', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: 'Asia/Jerusalem',
});

const dateTimeFmt = new Intl.DateTimeFormat('he-IL', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Asia/Jerusalem',
});

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return dateFmt.format(d);
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return dateTimeFmt.format(d);
}

/** For <input type="date"> value — yyyy-mm-dd. */
export function toDateInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

/** Two-letter (or one for single word) initials for avatars. */
export function initials(name: string | null | undefined): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2);
  return (parts[0][0] ?? '') + (parts[parts.length - 1][0] ?? '');
}
