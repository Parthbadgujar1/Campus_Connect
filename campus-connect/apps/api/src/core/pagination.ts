import { z } from 'zod';
import { Errors } from './errors.js';

// Keyset ("cursor") pagination. Unlike OFFSET, it stays fast on page 1,000 and never skips or
// repeats rows when new items arrive while someone is scrolling.

export interface Cursor {
  at: string; // ISO timestamp (or a numeric sort key rendered as a string)
  id: string;
}

export function encodeCursor(at: Date | string | number, id: string): string {
  const value = at instanceof Date ? at.toISOString() : String(at);
  return Buffer.from(JSON.stringify([value, id])).toString('base64url');
}

export function decodeCursor(cursor: string | undefined): Cursor | null {
  if (!cursor) return null;
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    if (Array.isArray(parsed) && typeof parsed[0] === 'string' && typeof parsed[1] === 'string' && /^[0-9a-f-]{36}$/.test(parsed[1])) {
      return { at: parsed[0], id: parsed[1] };
    }
  } catch {
    // fall through
  }
  throw Errors.badRequest('The page cursor is not valid. Reload the list.');
}

export const pageQuery = z.object({
  cursor: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

/** Fetch limit + 1 rows, then call this to split off the extra row into a next cursor. */
export function page<T>(rows: T[], limit: number, cursorOf: (row: T) => string) {
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const last = items[items.length - 1];
  return { items, nextCursor: hasMore && last ? cursorOf(last) : null };
}
