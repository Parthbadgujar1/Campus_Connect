import type { FastifyPluginAsync } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { audit } from '../../core/audit.js';
import { Errors } from '../../core/errors.js';
import { requireAuth } from '../../core/guards.js';
import { optionalText, uuid } from '../../core/validation.js';
import { uuidv7 } from '../../infra/db/ids.js';
import { limits } from '../../plugins/traffic.js';
import { applyTarget, lookupTarget, TARGET_TYPES } from './targets.js';

// /v1/reports — anyone can report content or a person.
// Serious reasons are prioritised for moderators. As a safety net, an item reported by three
// different people is hidden right away until a moderator reviews it (the author is told it is
// under review). Reporters are never revealed to the person they reported.

const REASONS = ['spam', 'harassment', 'hate', 'sexual', 'violence', 'self_harm', 'scam', 'misinformation', 'copyright', 'privacy', 'other'] as const;
const PRIORITY: Record<(typeof REASONS)[number], number> = {
  self_harm: 1, violence: 1, sexual: 1, harassment: 2, hate: 2, privacy: 2, scam: 2, misinformation: 3, copyright: 3, spam: 4, other: 4,
};
const AUTO_HIDE_REPORTERS = 3;

export const reportRoutes: FastifyPluginAsync = async (base) => {
  const app = base.withTypeProvider<ZodTypeProvider>();
  const { db } = app.deps;
  const reports = () => db.col('reports');

  app.post(
    '/',
    {
      config: limits.report,
      schema: {
        tags: ['reports'],
        summary: 'Report something or someone',
        body: z.object({ targetType: z.enum(TARGET_TYPES), targetId: uuid, reason: z.enum(REASONS), details: optionalText(1000) }),
      },
    },
    async (request, reply) => {
      const auth = requireAuth(request);
      const b = request.body;
      const target = await lookupTarget(db, b.targetType, b.targetId);
      if (!target || target.collegeId !== auth.collegeId) throw Errors.notFound('That item');
      if (target.ownerId === auth.userId) throw Errors.badRequest('You cannot report your own content.');
      const now = new Date();
      const id = uuidv7();
      try {
        // One open report per person per item (a unique index on open reports enforces it).
        await reports().insertOne({
          _id: id,
          collegeId: auth.collegeId,
          reporterId: auth.userId,
          targetType: b.targetType,
          targetId: b.targetId,
          reason: b.reason,
          details: b.details ?? null,
          status: 'open',
          isOpen: true,
          priority: PRIORITY[b.reason],
          resolutionNote: null,
          resolvedBy: null,
          resolvedAt: null,
          createdAt: now,
          updatedAt: now,
        });
      } catch (err) {
        if ((err as { code?: number }).code === 11000) throw Errors.alreadyExists('You already reported this. Our moderators will review it.');
        throw err;
      }
      const reporters = await reports().distinct('reporterId', { targetType: b.targetType, targetId: b.targetId, isOpen: true });
      let hidden = false;
      if (reporters.length >= AUTO_HIDE_REPORTERS) {
        hidden = await db.tx(async (session) => {
          const changed = await applyTarget(db, b.targetType, b.targetId, 'hide', session);
          if (changed) {
            await db.col('moderation_actions').insertOne({ _id: uuidv7(), collegeId: auth.collegeId, actorId: null, targetType: b.targetType, targetId: b.targetId, action: 'hide', reason: 'Hidden automatically after several reports', reportId: id, createdAt: now }, { session });
            await audit(db, { action: 'moderation.auto_hide', collegeId: auth.collegeId, entityType: b.targetType, entityId: b.targetId, meta: { reports: reporters.length } }, session);
          }
          return changed;
        });
      }
      if (hidden && target.ownerId) {
        await app.deps.notifier.send({ userId: target.ownerId, kind: 'moderation', title: 'Something you shared is under review', body: 'It was reported by several people and is hidden until a moderator checks it.' });
      }
      return reply.status(201).send({ id, status: 'open', message: 'Thank you. A moderator will review this. If someone is in danger, contact campus security or call 112.' });
    },
  );

  app.get('/mine', { schema: { tags: ['reports'], summary: 'Reports I made and what happened' } }, async (request) => {
    const auth = requireAuth(request);
    const rows = await reports().find({ reporterId: auth.userId }).sort({ createdAt: -1 }).limit(100).toArray();
    return {
      items: rows.map((r) => ({
        id: r._id,
        targetType: r.targetType,
        targetId: r.targetId,
        reason: r.reason,
        status: r.status,
        outcome: r.status === 'actioned' ? 'Action was taken.' : r.status === 'dismissed' ? 'Reviewed: it did not break the rules.' : 'Waiting for review.',
        createdAt: r.createdAt.toISOString(),
        resolvedAt: r.resolvedAt?.toISOString() ?? null,
      })),
    };
  });
};
