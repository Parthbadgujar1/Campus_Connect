import type { FastifyPluginAsync } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { Errors } from '../../core/errors.js';
import { requireAuth } from '../../core/guards.js';
import { decodeCursor, encodeCursor, page, pageQuery } from '../../core/pagination.js';
import { boolQuery, idParam, uuid } from '../../core/validation.js';
import { loadPeople } from '../users/people.js';
import { olderThan } from '../../core/query.js';

// /v1/notifications — the bell: list, unread badge, mark read, dismiss.

export const notificationRoutes: FastifyPluginAsync = async (base) => {
  const app = base.withTypeProvider<ZodTypeProvider>();
  const { db } = app.deps;
  const notifications = () => db.col('notifications');

  app.get('/', { schema: { tags: ['notifications'], summary: 'My notifications, newest first', querystring: pageQuery.extend({ unread: boolQuery }) } }, async (request) => {
    const auth = requireAuth(request);
    const { cursor, limit, unread } = request.query;
    const rows = await notifications()
      .find({ userId: auth.userId, ...(unread ? { readAt: null } : {}), ...olderThan('createdAt', decodeCursor(cursor)) })
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit + 1)
      .toArray();
    const { items, nextCursor } = page(rows, limit, (r) => encodeCursor(r.createdAt, r._id));
    const people = await loadPeople(app.deps, items.map((r) => r.actorId));
    return {
      items: items.map((r) => ({
        id: r._id,
        kind: r.kind,
        title: r.title,
        body: r.body,
        link: r.link,
        entity: r.entityType ? { type: r.entityType, id: r.entityId } : null,
        actor: r.actorId ? (people.get(r.actorId) ?? null) : null,
        read: Boolean(r.readAt),
        createdAt: r.createdAt.toISOString(),
      })),
      nextCursor,
    };
  });

  app.get('/unread-count', { schema: { tags: ['notifications'], summary: 'Number for the bell badge' } }, async (request) => {
    const auth = requireAuth(request);
    return { count: await notifications().countDocuments({ userId: auth.userId, readAt: null }) };
  });

  app.post(
    '/read',
    {
      schema: {
        tags: ['notifications'],
        summary: 'Mark some or all notifications as read',
        body: z.object({ ids: z.array(uuid).max(100).optional(), all: z.boolean().optional() }).refine((b) => b.all || b.ids?.length, { message: 'Send ids or all: true.' }),
      },
    },
    async (request) => {
      const auth = requireAuth(request);
      const res = await notifications().updateMany({ userId: auth.userId, readAt: null, ...(request.body.all ? {} : { _id: { $in: request.body.ids ?? [] } }) }, { $set: { readAt: new Date() } });
      return { updated: res.modifiedCount };
    },
  );

  app.delete('/:id', { schema: { tags: ['notifications'], summary: 'Dismiss a notification', params: idParam } }, async (request) => {
    const auth = requireAuth(request);
    const res = await notifications().deleteOne({ _id: request.params.id, userId: auth.userId });
    if (!res.deletedCount) throw Errors.notFound('That notification');
    return { status: 'deleted' };
  });
};
