// Time formatting for live data from the API (always relative to the real current time, shown in
// India Standard Time). The prototype's lib/time.ts keeps a fixed "now" for its sample data.

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const TZ = 'Asia/Kolkata';

export function ago(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < MINUTE) return 'Just now';
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)}m`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)}h`;
  if (diff < 7 * DAY) return `${Math.floor(diff / DAY)}d`;
  return day(iso);
}

export function day(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: TZ });
}

export function longDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: TZ });
}

export function time(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', timeZone: TZ });
}

export function dateTime(iso: string): string {
  return `${day(iso)}, ${time(iso)}`;
}

export function daysLeft(iso: string): number {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / DAY);
}

export function deadline(iso: string): string {
  const d = daysLeft(iso);
  if (d < 0) return 'Closed';
  if (d === 0) return 'Due today';
  if (d === 1) return 'Due tomorrow';
  return `${d} days left`;
}

export function monthDay(iso: string): { month: string; day: string } {
  const date = new Date(iso);
  return {
    month: date.toLocaleDateString('en-IN', { month: 'short', timeZone: TZ }),
    day: date.toLocaleDateString('en-IN', { day: 'numeric', timeZone: TZ }),
  };
}

/** For <input type="datetime-local"> (local time, no seconds). */
export function toLocalInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function rupees(paise: number | null): string {
  if (paise === null || paise === 0) return 'Free';
  return (paise / 100).toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: paise % 100 ? 2 : 0 });
}
