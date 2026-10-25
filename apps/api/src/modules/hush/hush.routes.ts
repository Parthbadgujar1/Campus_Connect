import type { FastifyPluginAsync } from 'fastify';
import type { Filter } from 'mongodb';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { audit } from '../../core/audit.js';
import { Errors } from '../../core/errors.js';
import { canModerate, requireAuth } from '../../core/guards.js';
import { decodeCursor, encodeCursor, page, pageQuery } from '../../core/pagination.js';
import { contains, lowerThan, olderThan } from '../../core/query.js';
import { cleanText, idParam, text, uuid } from '../../core/validation.js';
import { applyVote, myVotes } from '../../core/votes.js';
import { uuidv7 } from '../../infra/db/ids.js';
import type { HushAnswer, HushQuestion } from '../../infra/db/models.js';
import { limits } from '../../plugins/traffic.js';
import type { AuthContext } from '../../types/fastify.js';
import { blockedIds, loadPeople, type PersonSummary } from '../users/people.js';

// /v1/hush — anonymous questions and answers.
//
// Anonymous documents store authorId = null. The real author is written only to the
// anonymous_authors vault, which this module reads for three things: "is this mine?", telling
// the asker about new answers, and letting authors delete or accept. Responses never contain
// the author for anonymous content, not even to moderators (identity reveal is a separate,
// two-admin, audited workflow).

const TOPICS = ['academics', 'placements', 'hostel', 'mental_health', 'relationships', 'faculty', 'campus', 'career', 'other'] as const;
const voteBody = z.object({ value: z.union([z.literal(-1), z.literal(0), z.literal(1)]) });
type HushType = 'hush_question' | 'hush_answer';

export const hushRoutes: FastifyPluginAsync = async (base) => {
  const app = base.withTypeProvider<ZodTypeProvider>();
  const { db } = app.deps;
  const questions = () => db.col('hush_questions');
  const answers = () => db.col('hush_answers');

  async function ownerOf(type: HushType, id: string): Promise<string | null> {
    const row = type === 'hush_question' ? await questions().findOne({ _id: id }, { projection: { authorId: 1 } }) : await answers().findOne({ _id: id }, { projection: { authorId: 1 } });
    if (!row) return null;
    if (row.authorId) return row.authorId;
    return (await db.col('anonymous_authors').findOne({ _id: `${type}:${id}` }, { projection: { userId: 1 } }))?.userId ?? null;
  }

  async function mineSet(auth: AuthContext, type: HushType, ids: string[]): Promise<Set<string>> {
    if (!ids.length) return new Set();
    const rows = await db.col('anonymous_authors').find({ _id: { $in: ids.map((i) => `${type}:${i}`) }, userId: auth.userId }, { projection: { contentId: 1 } }).toArray();
    return new Set(rows.map((r) => r.contentId));
  }

  function questionView(h: HushQuestion, auth: AuthContext, people: Map<string, PersonSummary>, votes: Map<string, number>, mine: Set<string>) {
    return {
      id: h._id,
      topic: h.topic,
      body: h.body,
      anonymous: h.isAnonymous,
      author: h.isAnonymous ? null : (people.get(h.authorId ?? '') ?? null),
      votesCount: h.votesCount,
      myVote: votes.get(h._id) ?? 0,
      answersCount: h.answersCount,
      acceptedAnswerId: h.acceptedAnswerId,
      isMine: mine.has(h._id) || h.authorId === auth.userId,
      createdAt: h.createdAt.toISOString(),
    };
  }

  app.get(
    '/',
    { schema: { tags: ['hush'], summary: 'Questions', querystring: pageQuery.extend({ topic: z.enum(TOPICS).optional(), sort: z.enum(['new', 'top', 'unanswered']).default('new'), q: z.string().trim().max(80).optional(), mine: z.enum(['true', 'false']).optional() }) } },
    async (request) => {
      const auth = requireAuth(request);
      const { cursor, limit, topic, sort, q, mine: onlyMine } = request.query;
      const blocked = await blockedIds(db, auth.userId);
      const after = decodeCursor(cursor);
      const and: Filter<HushQuestion>[] = [{ collegeId: auth.collegeId, status: 'published', deletedAt: null }];
      if (topic) and.push({ topic });
      if (sort === 'unanswered') and.push({ answersCount: 0 });
      if (q) and.push({ body: contains(q) });
      if (onlyMine === 'true') {
        // My questions, including anonymous ones (found through the vault).
        const vault = await db.col('anonymous_authors').find({ userId: auth.userId, contentType: 'hush_question' }, { projection: { contentId: 1 } }).limit(500).toArray();
        and.push({ $or: [{ authorId: auth.userId }, { _id: { $in: vault.map((v) => v.contentId) } }] });
      }
      if (blocked.length) and.push({ authorId: { $nin: blocked } });
      and.push((sort === 'top' ? lowerThan('votesCount', after) : olderThan('createdAt', after)) as Filter<HushQuestion>);
      const rows = await questions()
        .find({ $and: and })
        .sort(sort === 'top' ? { votesCount: -1, _id: -1 } : { createdAt: -1, _id: -1 })
        .limit(limit + 1)
        .toArray();
      const { items, nextCursor } = page(rows, limit, (r) => encodeCursor(sort === 'top' ? r.votesCount : r.createdAt, r._id));
      const ids = items.map((r) => r._id);
      const [votes, mine, people] = await Promise.all([myVotes(db, auth.userId, 'hush_question', ids), mineSet(auth, 'hush_question', ids), loadPeople(app.deps, items.map((r) => r.authorId))]);
      return { items: items.map((r) => questionView(r, auth, people, votes, mine)), nextCursor };
    },
  );

  app.post(
    '/',
    { config: { rateLimit: { max: 10, timeWindow: '1 hour' } }, schema: { tags: ['hush'], summary: 'Ask a question', body: z.object({ topic: z.enum(TOPICS), body: text(12, 2000), anonymous: z.boolean().default(true) }) } },
    async (request, reply) => {
      const auth = requireAuth(request);
      const b = request.body;
      const now = new Date();
      const id = uuidv7();
      await db.tx(async (session) => {
        if (b.anonymous) await db.col('anonymous_authors').insertOne({ _id: `hush_question:${id}`, contentType: 'hush_question', contentId: id, userId: auth.userId, createdAt: now }, { session });
        await questions().insertOne(
          { _id: id, collegeId: auth.collegeId, authorId: b.anonymous ? null : auth.userId, isAnonymous: b.anonymous, topic: b.topic, body: cleanText(b.body), votesCount: 0, answersCount: 0, acceptedAnswerId: null, status: 'published', createdAt: now, updatedAt: now, deletedAt: null },
          { session },
        );
      });
      return reply.status(201).send({ id });
    },
  );

  app.get('/:id', { schema: { tags: ['hush'], summary: 'A question with its answers', params: idParam } }, async (request) => {
    const auth = requireAuth(request);
    const h = await questions().findOne({ _id: request.params.id, collegeId: auth.collegeId, status: 'published', deletedAt: null });
    if (!h) throw Errors.notFound('This question');
    const blocked = await blockedIds(db, auth.userId);
    const list = await answers()
      .find({ questionId: h._id, status: 'published', deletedAt: null, ...(blocked.length ? { authorId: { $nin: blocked } } : {}) })
      .sort({ isAccepted: -1, votesCount: -1, createdAt: 1 })
      .limit(200)
      .toArray();
    const answerIds = list.map((a) => a._id);
    const [qVotes, qMine, aVotes, aMine, people] = await Promise.all([
      myVotes(db, auth.userId, 'hush_question', [h._id]),
      mineSet(auth, 'hush_question', [h._id]),
      myVotes(db, auth.userId, 'hush_answer', answerIds),
      mineSet(auth, 'hush_answer', answerIds),
      loadPeople(app.deps, [h.authorId, ...list.map((a) => a.authorId)]),
    ]);
    return {
      ...questionView(h, auth, people, qVotes, qMine),
      answers: list.map((a) => ({
        id: a._id,
        body: a.body,
        anonymous: a.isAnonymous,
        author: a.isAnonymous ? null : (people.get(a.authorId ?? '') ?? null),
        votesCount: a.votesCount,
        myVote: aVotes.get(a._id) ?? 0,
        accepted: a.isAccepted,
        isMine: aMine.has(a._id) || a.authorId === auth.userId,
        createdAt: a.createdAt.toISOString(),
      })),
    };
  });

  app.post(
    '/:id/answers',
    { config: { rateLimit: { max: 30, timeWindow: '1 hour' } }, schema: { tags: ['hush'], summary: 'Answer a question', params: idParam, body: z.object({ body: text(10, 5000), anonymous: z.boolean().default(true) }) } },
    async (request, reply) => {
      const auth = requireAuth(request);
      const h = await questions().findOne({ _id: request.params.id, collegeId: auth.collegeId, status: 'published', deletedAt: null }, { projection: { body: 1 } });
      if (!h) throw Errors.notFound('This question');
      const b = request.body;
      const now = new Date();
      const answer: HushAnswer = { _id: uuidv7(), questionId: h._id, collegeId: auth.collegeId, authorId: b.anonymous ? null : auth.userId, isAnonymous: b.anonymous, body: cleanText(b.body), votesCount: 0, isAccepted: false, status: 'published', createdAt: now, updatedAt: now, deletedAt: null };
      await db.tx(async (session) => {
        if (b.anonymous) await db.col('anonymous_authors').insertOne({ _id: `hush_answer:${answer._id}`, contentType: 'hush_answer', contentId: answer._id, userId: auth.userId, createdAt: now }, { session });
        await answers().insertOne(answer, { session });
        await questions().updateOne({ _id: h._id }, { $inc: { answersCount: 1 } }, { session });
      });
      const asker = await ownerOf('hush_question', h._id);
      if (asker && asker !== auth.userId) {
        await app.deps.notifier.send({
          userId: asker,
          kind: 'reply',
          title: 'Someone answered your Hush question',
          body: h.body.slice(0, 120),
          link: `/hush/${h._id}`,
          // Never attach the actor for anonymous answers.
          actorId: b.anonymous ? null : auth.userId,
          entityType: 'hush_question',
          entityId: h._id,
        });
      }
      return reply.status(201).send({ id: answer._id });
    },
  );

  app.put('/:id/vote', { config: limits.write, schema: { tags: ['hush'], summary: 'Vote on a question', params: idParam, body: voteBody } }, async (request) => {
    const auth = requireAuth(request);
    const h = await questions().findOne({ _id: request.params.id, collegeId: auth.collegeId, deletedAt: null }, { projection: { _id: 1 } });
    if (!h) throw Errors.notFound('This question');
    const votesCount = await applyVote(db, auth.userId, 'hush_question', h._id, request.body.value);
    return { votesCount, myVote: request.body.value };
  });

  app.put('/answers/:id/vote', { config: limits.write, schema: { tags: ['hush'], summary: 'Vote on an answer', params: idParam, body: voteBody } }, async (request) => {
    const auth = requireAuth(request);
    const a = await answers().findOne({ _id: request.params.id, collegeId: auth.collegeId, deletedAt: null }, { projection: { _id: 1 } });
    if (!a) throw Errors.notFound('This answer');
    const votesCount = await applyVote(db, auth.userId, 'hush_answer', a._id, request.body.value);
    return { votesCount, myVote: request.body.value };
  });

  app.post('/:id/accept', { schema: { tags: ['hush'], summary: 'Mark the answer that helped (asker only)', params: idParam, body: z.object({ answerId: uuid.nullable() }) } }, async (request) => {
    const auth = requireAuth(request);
    if ((await ownerOf('hush_question', request.params.id)) !== auth.userId) throw Errors.forbidden('Only the person who asked can do this.');
    const answerId = request.body.answerId;
    if (answerId) {
      const exists = await answers().findOne({ _id: answerId, questionId: request.params.id, deletedAt: null }, { projection: { _id: 1 } });
      if (!exists) throw Errors.notFound('That answer');
    }
    await db.tx(async (session) => {
      // Clear the previous choice first: a unique index allows one accepted answer per question.
      await answers().updateMany({ questionId: request.params.id, isAccepted: true }, { $set: { isAccepted: false } }, { session });
      if (answerId) await answers().updateOne({ _id: answerId }, { $set: { isAccepted: true } }, { session });
      await questions().updateOne({ _id: request.params.id }, { $set: { acceptedAnswerId: answerId, updatedAt: new Date() } }, { session });
    });
    return { acceptedAnswerId: answerId };
  });

  for (const [path, type] of [
    ['/:id', 'hush_question'],
    ['/answers/:id', 'hush_answer'],
  ] as const) {
    app.delete(path, { schema: { tags: ['hush'], summary: type === 'hush_question' ? 'Delete a question' : 'Delete an answer', params: idParam } }, async (request) => {
      const auth = requireAuth(request);
      const owner = await ownerOf(type, request.params.id);
      const moderating = owner !== auth.userId && canModerate(auth);
      if (owner !== auth.userId && !moderating) throw Errors.notFound('This post');
      await db.tx(async (session) => {
        const stamp = { $set: { deletedAt: new Date(), updatedAt: new Date() } };
        if (type === 'hush_question') {
          const r = await questions().updateOne({ _id: request.params.id, collegeId: auth.collegeId, deletedAt: null }, stamp, { session });
          if (!r.modifiedCount) throw Errors.notFound('This post');
        } else {
          const a = await answers().findOneAndUpdate({ _id: request.params.id, collegeId: auth.collegeId, deletedAt: null }, stamp, { session, projection: { questionId: 1, isAccepted: 1 } });
          if (!a) throw Errors.notFound('This post');
          await questions().updateOne(
            { _id: a.questionId, answersCount: { $gt: 0 } },
            { $inc: { answersCount: -1 }, ...(a.isAccepted ? { $set: { acceptedAnswerId: null } } : {}) },
            { session },
          );
        }
        if (moderating) {
          await db.col('moderation_actions').insertOne({ _id: uuidv7(), collegeId: auth.collegeId, actorId: auth.userId, targetType: type, targetId: request.params.id, action: 'remove', reason: null, reportId: null, createdAt: new Date() }, { session });
          await audit(db, { action: `moderation.${type}_delete`, actorId: auth.userId, actorRole: auth.role, collegeId: auth.collegeId, entityType: type, entityId: request.params.id, requestId: request.id }, session);
        }
      });
      return { status: 'deleted' };
    });
  }
};
