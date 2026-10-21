import { hmac, safeEqual } from './crypto.js';

// Signed, stateless unsubscribe links: the link carries the address and scope plus an HMAC, so
// one click unsubscribes without signing in, and nobody can unsubscribe someone else.

export type UnsubscribeScope = 'marketing' | 'notification' | 'all';

export function unsubscribeToken(secret: string, email: string, scope: UnsubscribeScope): string {
  return hmac(secret, `unsubscribe:${email.toLowerCase()}:${scope}`);
}

export function unsubscribeUrl(webUrl: string, secret: string, email: string, scope: UnsubscribeScope): string {
  const e = Buffer.from(email.toLowerCase()).toString('base64url');
  return `${webUrl}/unsubscribe?e=${e}&s=${scope}&t=${unsubscribeToken(secret, email, scope)}`;
}

export function verifyUnsubscribe(secret: string, encodedEmail: string, scope: string, token: string): string | null {
  if (!['marketing', 'notification', 'all'].includes(scope)) return null;
  let email: string;
  try {
    email = Buffer.from(encodedEmail, 'base64url').toString('utf8');
  } catch {
    return null;
  }
  if (!/^[^\s@]+@[^\s@]+$/.test(email)) return null;
  return safeEqual(token, unsubscribeToken(secret, email, scope as UnsubscribeScope)) ? email.toLowerCase() : null;
}
