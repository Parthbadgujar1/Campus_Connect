import { randomBytes } from 'node:crypto';
import { type Algorithm, hash, verify } from '@node-rs/argon2';

// Password hashing with Argon2id using the OWASP-recommended baseline (19 MiB, 2 passes,
// 1 lane). Policy follows NIST SP 800-63B: length matters, composition rules do not, and
// known-breached or obvious passwords are refused.

// Algorithm is a const enum (Argon2d = 0, Argon2i = 1, Argon2id = 2), which cannot be read at
// runtime under verbatimModuleSyntax, so the value is written out.
const ARGON2ID = 2 as Algorithm;
const OPTIONS = { algorithm: ARGON2ID, memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const;

export function hashPassword(password: string): Promise<string> {
  return hash(password, OPTIONS);
}

export async function verifyPassword(passwordHash: string | null, password: string): Promise<boolean> {
  if (!passwordHash) {
    // Spend the same time as a real check so response timing does not reveal unknown accounts.
    await verify(await dummyHash(), password).catch(() => false);
    return false;
  }
  try {
    return await verify(passwordHash, password);
  } catch {
    return false;
  }
}

// A real Argon2id hash of random bytes (computed once), used for constant-time "unknown account"
// checks: verifying against it costs exactly as much as verifying a real password.
let dummy: Promise<string> | undefined;
function dummyHash(): Promise<string> {
  dummy ??= hash(randomBytes(24).toString('base64url'), OPTIONS);
  return dummy;
}

const COMMON = new Set(
  `password password1 password12 password123 passw0rd p@ssword p@ssw0rd 123456 1234567 12345678 123456789
   1234567890 12345678910 qwerty qwerty123 qwertyuiop asdfghjkl zxcvbnm 111111 1111111111 000000 0000000000
   123123 123321 654321 666666 777777 888888 999999 abc123 abcd1234 iloveyou letmein welcome welcome1
   welcome123 admin admin123 administrator root toor monkey dragon master sunshine princess football baseball
   shadow superman batman trustno1 starwars whatever freedom hello123 login changeme secret secret123
   india123 india@123 bharat123 mumbai123 pune1234 delhi123 student student123 college college123
   campus campus123 campusconnect campusconnect123 engineering engineer123 csmss csmss123 test1234 testtest
   qazwsxedc 1q2w3e4r 1q2w3e4r5t zaq12wsx googledummy computer internet samsung iphone android
   mypassword mypass123 newpassword password@123 pass@123 pass1234 india@1234 krishna123 ganesh123`.split(/\s+/),
);

export function passwordProblems(password: string, context: { email?: string; name?: string } = {}): string[] {
  const problems: string[] = [];
  const lower = password.toLowerCase();
  if (password.length < 10) problems.push('Use at least 10 characters.');
  if (password.length > 128) problems.push('Use at most 128 characters.');
  if (COMMON.has(lower) || COMMON.has(lower.replace(/[!@#$%^&*.]+$/, ''))) problems.push('This password is too common.');
  if (/^(.)\1+$/.test(password)) problems.push('Do not repeat a single character.');
  if (/^\d+$/.test(password)) problems.push('Do not use only numbers.');
  const local = context.email?.split('@')[0]?.toLowerCase();
  if (local && local.length >= 4 && lower.includes(local)) problems.push('Do not include your email address.');
  const first = context.name?.split(/\s+/)[0]?.toLowerCase();
  if (first && first.length >= 4 && lower.includes(first) && password.length < 16) problems.push('Do not build it around your name.');
  return problems;
}
