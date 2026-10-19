// All dates are shown in India Standard Time. The "now" used for the prototype
// is fixed so server and browser render the same text (no hydration drift).

export const NOW = new Date('2026-10-14T10:00:00+05:30');

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const IST_OFFSET = 5.5 * HOUR;
const TZ = 'Asia/Kolkata';

/** ISO timestamp at a given IST wall-clock time, `dayOffset` days from NOW. */
export function istAt(dayOffset: number, hour = 10, minute = 0): string {
  const midnightUtc = Date.UTC(2026, 9, 14) - IST_OFFSET;
  const ms = midnightUtc + dayOffset * DAY + (hour * 60 + minute) * MINUTE;
  return new Date(ms).toISOString();
}

export function hoursAgo(hours: number): string {
  return new Date(NOW.getTime() - hours * HOUR).toISOString();
}

export function daysAgo(days: number): string {
  return new Date(NOW.getTime() - days * DAY).toISOString();
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: TZ,
  });
}

export function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: TZ,
  });
}

export function formatLongDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: TZ,
  });
}

export function formatRange(startIso: string, endIso: string): string {
  const endPart =
    dayKey(startIso) === dayKey(endIso)
      ? formatTime(endIso)
      : `${formatDay(endIso)}, ${formatTime(endIso)}`;
  return `${formatDay(startIso)} · ${formatTime(startIso)} – ${endPart}`;
}

export function dayKey(iso: string): string {
  return new Date(iso).toLocaleDateString('en-CA', { timeZone: TZ });
}

/** "Just now", "42m", "3h", "2d", or a short date for anything older. */
export function relativeTime(iso: string): string {
  const diff = NOW.getTime() - new Date(iso).getTime();
  if (diff < MINUTE) return 'Just now';
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)}m`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)}h`;
  if (diff < 7 * DAY) return `${Math.floor(diff / DAY)}d`;
  return formatDay(iso);
}

/** Whole days from NOW until `iso` (negative when in the past). */
export function daysUntil(iso: string): number {
  return Math.ceil((new Date(iso).getTime() - NOW.getTime()) / DAY);
}

export function deadlineLabel(iso: string): string {
  const days = daysUntil(iso);
  if (days < 0) return 'Closed';
  if (days === 0) return 'Due today';
  if (days === 1) return 'Due tomorrow';
  return `${days} days left`;
}

/** Friendly label for a calendar day relative to NOW: Today, Tomorrow, or a date. */
export function dayHeading(iso: string): string {
  const key = dayKey(iso);
  if (key === dayKey(NOW.toISOString())) return 'Today';
  if (key === dayKey(new Date(NOW.getTime() + DAY).toISOString())) return 'Tomorrow';
  return formatDay(iso);
}
