import { z } from 'zod';

// Shared field schemas. Every request body, query and route parameter is validated with zod
// before it reaches business logic; anything not described here is rejected or stripped.

export const uuid = z.uuid({ message: 'Must be a valid id.' });

export const idParam = z.object({ id: uuid });

/** Trimmed text with length limits; rejects strings that are only whitespace. */
export const text = (min: number, max: number) =>
  z
    .string()
    .trim()
    .min(min, { message: min <= 1 ? 'This field is required.' : `Use at least ${min} characters.` })
    .max(max, { message: `Use at most ${max} characters.` });

export const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, { message: `Use at most ${max} characters.` })
    .optional()
    .transform((v) => (v ? v : undefined));

export const email = z
  .string()
  .trim()
  .toLowerCase()
  .max(254)
  .pipe(z.email({ message: 'Enter a valid email address.' }));

const tag = z.string().trim().toLowerCase().regex(/^[a-z0-9][a-z0-9-]{0,29}$/, 'Tags use letters, numbers and dashes.');

/** Tags for creating something: missing means none. */
export const tags = z
  .array(tag)
  .max(10)
  .default([])
  .transform((list) => [...new Set(list)]);

/**
 * Tags for editing: missing means "leave unchanged". Edit (PATCH) schemas must never carry
 * defaults: in Zod 4 a default still fills in an optional/partial field, which would silently
 * reset values the client did not send.
 */
export const tagsPatch = z
  .array(tag)
  .max(10)
  .transform((list) => [...new Set(list)])
  .optional();

export const httpsUrl = z
  .string()
  .trim()
  .max(500)
  .refine((v) => /^https:\/\/[^\s]+$/.test(v), { message: 'Use a full link that starts with https://' });

export const boolQuery = z
  .enum(['true', 'false', '1', '0'])
  .optional()
  .transform((v) => v === 'true' || v === '1');

/** Strips control characters (except newline and tab) that can break rendering or logs. */
export function cleanText(value: string): string {
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
}
