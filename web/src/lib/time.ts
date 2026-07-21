const absoluteFmt = new Intl.DateTimeFormat('he-IL', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: 'Asia/Jerusalem',
});

/** Hebrew relative time: "לפני רגע", "לפני 5 דקות", "לפני שעתיים", "אתמול"... */
export function relativeTimeHe(iso: string, now: number = Date.now()): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const sec = Math.max(0, Math.floor((now - then) / 1000));
  if (sec < 45) return 'לפני רגע';
  const min = Math.floor(sec / 60);
  if (min <= 1) return 'לפני דקה';
  if (min < 60) return `לפני ${min} דקות`;
  const hr = Math.floor(min / 60);
  if (hr === 1) return 'לפני שעה';
  if (hr === 2) return 'לפני שעתיים';
  if (hr < 24) return `לפני ${hr} שעות`;
  const day = Math.floor(hr / 24);
  if (day === 1) return 'אתמול';
  if (day === 2) return 'שלשום';
  if (day < 7) return `לפני ${day} ימים`;
  return absoluteFmt.format(then);
}
