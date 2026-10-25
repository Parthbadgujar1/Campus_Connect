import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { Errors } from '../core/errors.js';

// Bulkheads between modules, so one broken or misbehaving area cannot take the rest down:
//
//   1. Registration isolation: if a module throws while registering (a bad deploy, a missing
//      config value), the server still starts; that module's routes answer 503
//      MODULE_UNAVAILABLE and everything else works.
//   2. Kill switch: each module checks its `module.<name>` feature flag. Admins can switch a
//      module off at runtime (incident, or a new module not ready yet) without a deploy.
//   3. Error-rate breaker: if a module starts failing (many 5xx in a short window), it is
//      paused for 30 seconds and answers 503 quickly instead of burning database connections
//      that the healthy modules need. It recovers automatically.

interface ModuleState {
  name: string;
  registered: boolean;
  registrationError?: string;
  windowStart: number;
  requests: number;
  failures: number;
  pausedUntil: number;
  lastPausedAt?: string;
}

const WINDOW_MS = 60_000;
const MIN_FAILURES = 20;
const FAILURE_RATIO = 0.5;
const PAUSE_MS = 30_000;

export const moduleStates = new Map<string, ModuleState>();

export interface ModuleDefinition {
  name: string;
  prefix: string;
  plugin: FastifyPluginAsync;
  /** Feature flag key; defaults to module.<name>. Pass null for always-on modules (health). */
  flag?: string | null;
}

export function registerModule(app: FastifyInstance, def: ModuleDefinition): void {
  const state: ModuleState = { name: def.name, registered: false, windowStart: Date.now(), requests: 0, failures: 0, pausedUntil: 0 };
  moduleStates.set(def.name, state);
  const flagKey = def.flag === undefined ? `module.${def.name}` : def.flag;

  app.register(
    async (scope) => {
      // These hooks are added before the module's routes, so they cover every route in it.
      scope.addHook('onRequest', async (request) => {
        if (!state.registered) throw Errors.moduleUnavailable(def.name);
        if (state.pausedUntil > Date.now()) throw Errors.moduleUnavailable(def.name);
        if (flagKey) {
          const enabled = await app.deps.flags.isEnabled(flagKey, {
            userId: request.auth?.userId,
            role: request.auth?.role,
            collegeId: request.auth?.collegeId,
          });
          // Admins can still reach a switched-off module to test it before re-enabling.
          if (!enabled && request.auth?.role !== 'admin') throw Errors.featureDisabled(flagKey);
        }
      });

      scope.addHook('onResponse', async (_request, reply) => {
        const now = Date.now();
        if (now - state.windowStart > WINDOW_MS) {
          state.windowStart = now;
          state.requests = 0;
          state.failures = 0;
        }
        state.requests += 1;
        // 503s are our own fast refusals (paused, disabled, dependency down): not module bugs.
        if (reply.statusCode >= 500 && reply.statusCode !== 503) state.failures += 1;
        if (state.failures >= MIN_FAILURES && state.failures / state.requests >= FAILURE_RATIO) {
          state.pausedUntil = now + PAUSE_MS;
          state.lastPausedAt = new Date(now).toISOString();
          state.windowStart = now;
          state.requests = 0;
          state.failures = 0;
          app.log.error({ module: def.name }, 'module paused after repeated failures');
        }
      });

      // The module's setup function is called directly inside this scope (not via register),
      // so an exception stays here instead of failing Fastify's whole boot sequence. Modules
      // therefore only add routes and hooks; they do not register nested plugins.
      try {
        await def.plugin(scope, {});
        state.registered = true;
      } catch (err) {
        state.registrationError = (err as Error).message;
        app.log.error({ err, module: def.name }, 'module failed to register; serving 503 for it');
      }
    },
    { prefix: def.prefix },
  );
}

export function moduleHealth() {
  const now = Date.now();
  return [...moduleStates.values()].map((s) => ({
    name: s.name,
    status: !s.registered ? 'failed' : s.pausedUntil > now ? 'paused' : 'ok',
    registrationError: s.registrationError,
    lastPausedAt: s.lastPausedAt,
  }));
}
