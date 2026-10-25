import type { FastifyRequest } from 'fastify';
import type { AuthContext, Role } from '../types/fastify.js';
import { Errors } from './errors.js';

// Authorisation helpers, called at the top of handlers. They return a non-null, typed auth
// context so business code cannot accidentally run without one.

/** A signed-in, active account. */
export function requireAuth(request: FastifyRequest): AuthContext {
  const auth = request.auth;
  if (!auth) throw Errors.unauthenticated();
  if (auth.status === 'pending') throw Errors.emailNotVerified();
  if (auth.status !== 'active') throw Errors.suspended();
  return auth;
}

export function requireRole(request: FastifyRequest, ...roles: Role[]): AuthContext {
  const auth = requireAuth(request);
  if (!roles.includes(auth.role)) throw Errors.forbidden();
  return auth;
}

export const STAFF_ROLES: Role[] = ['faculty', 'moderator', 'admin'];
export const MODERATION_ROLES: Role[] = ['moderator', 'admin'];

export function isStaff(auth: AuthContext): boolean {
  return STAFF_ROLES.includes(auth.role);
}

export function canModerate(auth: AuthContext): boolean {
  return MODERATION_ROLES.includes(auth.role);
}
