import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/** URL-safe random token with a recognisable prefix (helps secret scanners spot leaks). */
export function randomToken(prefix: string, bytes = 32): string {
  return `${prefix}_${randomBytes(bytes).toString('base64url')}`;
}

export function randomId(bytes = 16): string {
  return randomBytes(bytes).toString('base64url');
}

export function sha256(value: string | Buffer): Buffer {
  return createHash('sha256').update(value).digest();
}

export function sha256Hex(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

export function hmac(secret: string, value: string): string {
  return createHmac('sha256', secret).update(value).digest('base64url');
}

/** Constant-time string comparison (avoids leaking how many characters matched). */
export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/**
 * Keyed hash of an IP address. Used for rate limiting and audit trails without storing the
 * raw address (data minimisation): it can be matched, but not reversed without the secret.
 */
export function hashIp(secret: string, ip: string | undefined): string | null {
  if (!ip) return null;
  return createHmac('sha256', secret).update(ip).digest('base64url').slice(0, 32);
}
