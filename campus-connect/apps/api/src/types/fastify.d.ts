import 'fastify';
import type { Deps } from '../deps.js';

export type Role = 'student' | 'faculty' | 'expert' | 'moderator' | 'admin';

export interface AuthContext {
  userId: string;
  collegeId: string;
  role: Role;
  status: 'active' | 'pending' | 'suspended' | 'deleted';
  sessionId: string;
  sessionKind: 'web' | 'mobile';
  via: 'cookie' | 'bearer';
  displayName: string;
  username: string;
}

declare module 'fastify' {
  interface FastifyInstance {
    deps: Deps;
  }
  interface FastifyRequest {
    auth: AuthContext | null;
    ipHash: string | null;
  }
}
