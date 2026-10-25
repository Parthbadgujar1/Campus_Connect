// Small helpers for building MongoDB queries safely.

/** Escapes a string for use inside a regular expression (so search input is matched literally). */
export const escapeRegex = (q: string) => q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Case-insensitive "contains" match for user input. */
export const contains = (q: string) => ({ $regex: escapeRegex(q.trim()), $options: 'i' });

/** Case-insensitive exact match for user input (tags, skills, subject names). */
export const equalsIgnoringCase = (q: string) => ({ $regex: `^${escapeRegex(q.trim())}$`, $options: 'i' });

type After = { at: string; id: string } | null;

/** Keyset condition for lists sorted by (field desc, _id desc): items after the cursor. */
export const olderThan = (field: string, after: After) =>
  after ? { $or: [{ [field]: { $lt: new Date(after.at) } }, { [field]: new Date(after.at), _id: { $lt: after.id } }] } : {};

/** Keyset condition for lists sorted by (field asc, _id asc). */
export const newerThan = (field: string, after: After) =>
  after ? { $or: [{ [field]: { $gt: new Date(after.at) } }, { [field]: new Date(after.at), _id: { $gt: after.id } }] } : {};

/** Keyset condition for a numeric sort (score desc, _id desc). */
export const lowerThan = (field: string, after: After) =>
  after ? { $or: [{ [field]: { $lt: Number(after.at) } }, { [field]: Number(after.at), _id: { $lt: after.id } }] } : {};
