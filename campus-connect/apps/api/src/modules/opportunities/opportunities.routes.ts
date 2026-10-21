import type { FastifyPluginAsync } from 'fastify';
import type { Filter } from 'mongodb';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { audit } from '../../core/audit.js';
import { Errors } from '../../core/errors.js';
import { isStaff, requireAuth } from '../../core/guards.js';
import { decodeCursor, encodeCursor, page, pageQuery } from '../../core/pagination.js';
import { contains, equalsIgnoringCase, newerThan } from '../../core/query.js';
import { boolQuery, cleanText, httpsUrl, idParam, optionalText, text, uuid } from '../../core/validation.js';
import { uuidv7 } from '../../infra/db/ids.js';
import type { Application, Opportunity } from '../../infra/db/models.js';
import { limits } from '../../plugins/traffic.js';
import type { AuthContext } from '../../types/fastify.js';
import { assertOwnFiles } from '../files/files.service.js';
import { loadViewer } from '../feed/feed.service.js';
import { loadPeople, personOf } from '../users/people.js';

// /v1/opportunities, /v1/applications — internships, jobs, hackathons, scholarships...
// Staff and experts post directly; students' submissions wait for review. Eligibility
// (departments, minimum year) is checked when applying. Applicants keep their own stage
// tracker; posters can also move a candidate along, which notifies them.

const KINDS = ['internship', 'job', 'freelance', 'hackathon', 'competition', 'scholarship', 'research', 'workshop', 'certification', 'open_source', 'startup', 'ambassador', 'volunteering', 'part_time'] as const;
const STAGES = ['applied', 'shortlisted', 'interview', 'offer', 'rejected', 'withdrawn'] as const;

const oppBody = z.object({
  orgName: text(2, 120),
  title: text(3, 160),
  kind: z.enum(KINDS),
  mode: z.enum(['remote', 'onsite', 'hybrid']),
  location: text(2, 120),
  payText: optionalText(80),
  deadline: z.coerce.date(),
  eligibleDepartmentIds: z.array(uuid).max(20).default([]),
  minYear: z.number().int().min(1).max(6).default(1),
  skills: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
  description: optionalText(6000),
  applyUrl: httpsUrl.optional(),
});

// Edits: all optional and without defaults, so unsent fields stay unchanged.
const oppPatch = oppBody
  .extend({ eligibleDepartmentIds: z.array(uuid).max(20).optional(), minYear: z.number().int().min(1).max(6).optional(), skills: z.array(z.string().trim().min(1).max(40)).max(20).optional() })
  .partial()
  .extend({ status: z.enum(['published', 'closed']).optional() });

/** Experts (industry mentors) post opportunities without review, like staff. */
const postsDirectly = (auth: AuthContext) => isStaff(auth) || auth.role === 'expert';

export const opportunityRoutes: FastifyPluginAsync = async (base) => {
  const app = base.withTypeProvider<ZodTypeProvider>();
  const { db } = app.deps;
  const opps = () => db.col('opportunities');
  const apps = () => db.col('applications');

  async function load(auth: AuthContext, id: string) {
    const o = await opps().findOne({ _id: id, collegeId: auth.collegeId });
    if (!o) throw Errors.notFound('This opportunity');
    const manage = o.postedBy === auth.userId || isStaff(auth);
    if (o.status !== 'published' && o.status !== 'closed' && !manage) throw Errors.notFound('This opportunity');
    return { o, manage };
  }

  function eligibility(o: Opportunity, viewer: { departmentId: string | null; year: number | null }) {
    const reasons: string[] = [];
    if (o.eligibleDepartmentIds.length && (!viewer.departmentId || !o.eligibleDepartmentIds.includes(viewer.departmentId))) reasons.push('Not open to your department.');
    if (o.minYear > 1 && (viewer.year ?? 0) < o.minYear) reasons.push(`Open from year ${o.minYear}.`);
    return { eligible: reasons.length === 0, reasons };
  }

  async function views(list: Opportunity[], auth: AuthContext, viewer: { departmentId: string | null; year: number | null }) {
    const ids = list.map((o) => o._id);
    const [mine, saved] = await Promise.all([
      apps().find({ opportunityId: { $in: ids }, userId: auth.userId }).toArray(),
      db.col('saved_items').find({ _id: { $in: ids.map((i) => `${auth.userId}:opportunity:${i}`) } }, { projection: { itemId: 1 } }).toArray(),
    ]);
    const appBy = new Map(mine.map((a) => [a.opportunityId, a]));
    const savedSet = new Set(saved.map((s) => s.itemId));
    const now = new Date();
    return list.map((o) => {
      const manage = o.postedBy === auth.userId || isStaff(auth);
      const a = appBy.get(o._id);
      return {
        id: o._id,
        orgName: o.orgName,
        title: o.title,
        kind: o.kind,
        mode: o.mode,
        location: o.location,
        payText: o.payText,
        deadline: o.deadline.toISOString(),
        open: o.status === 'published' && o.deadline > now,
        eligibleDepartmentIds: o.eligibleDepartmentIds,
        minYear: o.minYear,
        skills: o.skills,
        description: o.description,
        applyUrl: o.applyUrl,
        status: o.status,
        applicantsCount: manage ? o.applicantsCount : undefined,
        saved: savedSet.has(o._id),
        myApplication: a ? { id: a._id, stage: a.stage, updatedAt: a.updatedAt.toISOString() } : null,
        eligibility: eligibility(o, viewer),
        canManage: manage,
      };
    });
  }

  app.get(
    '/opportunities',
    {
      schema: {
        tags: ['opportunities'],
        summary: 'Open opportunities, closing soonest first',
        querystring: pageQuery.extend({
          kind: z.enum(KINDS).optional(),
          /** Several kinds at once, comma separated (Jobs = job,part_time,freelance). */
          kinds: z.string().max(200).optional().transform((v) => (v ? v.split(',').filter((k): k is (typeof KINDS)[number] => (KINDS as readonly string[]).includes(k)) : undefined)),
          mode: z.enum(['remote', 'onsite', 'hybrid']).optional(),
          q: z.string().trim().max(60).optional(),
          eligibleOnly: boolQuery,
          include: z.enum(['open', 'closed', 'mine']).default('open'),
        }),
      },
    },
    async (request) => {
      const auth = requireAuth(request);
      const viewer = await loadViewer(app.deps, auth);
      const { cursor, limit, kind, kinds, mode, q, eligibleOnly, include } = request.query;
      const now = new Date();
      const and: Filter<Opportunity>[] = [{ collegeId: auth.collegeId }];
      if (include === 'open') and.push({ status: 'published', deadline: { $gt: now } });
      if (include === 'closed') and.push({ $or: [{ status: 'closed' }, { status: 'published', deadline: { $lte: now } }] });
      if (include === 'mine') and.push({ postedBy: auth.userId });
      if (kind) and.push({ kind });
      else if (kinds?.length) and.push({ kind: { $in: kinds } });
      if (mode) and.push({ mode });
      if (q) and.push({ $or: [{ title: contains(q) }, { orgName: contains(q) }, { skills: equalsIgnoringCase(q) }] });
      if (eligibleOnly) {
        and.push({ $or: [{ eligibleDepartmentIds: { $size: 0 } }, ...(viewer.departmentId ? [{ eligibleDepartmentIds: viewer.departmentId }] : [])] });
        and.push({ minYear: { $lte: viewer.year ?? 6 } });
      }
      and.push(newerThan('deadline', decodeCursor(cursor)) as Filter<Opportunity>);
      const rows = await opps().find({ $and: and }).sort({ deadline: 1, _id: 1 }).limit(limit + 1).toArray();
      const { items, nextCursor } = page(rows, limit, (r) => encodeCursor(r.deadline, r._id));
      return { items: await views(items, auth, viewer), nextCursor };
    },
  );

  app.get('/opportunities/:id', { schema: { tags: ['opportunities'], summary: 'Opportunity details', params: idParam } }, async (request) => {
    const auth = requireAuth(request);
    const [viewer, { o }] = await Promise.all([loadViewer(app.deps, auth), load(auth, request.params.id)]);
    const [v] = await views([o], auth, viewer);
    const people = await loadPeople(app.deps, [o.postedBy]);
    return { ...v, postedBy: o.postedBy ? (people.get(o.postedBy) ?? null) : null };
  });

  app.post('/opportunities', { config: { rateLimit: { max: 10, timeWindow: '1 day' } }, schema: { tags: ['opportunities'], summary: 'Post an opportunity (students: reviewed first)', body: oppBody } }, async (request, reply) => {
    const auth = requireAuth(request);
    const b = request.body;
    if (b.deadline <= new Date()) throw Errors.validation([{ field: 'deadline', message: 'Choose a future deadline.' }]);
    if (b.eligibleDepartmentIds.length) {
      const n = await db.col('departments').countDocuments({ _id: { $in: b.eligibleDepartmentIds }, collegeId: auth.collegeId });
      if (n !== new Set(b.eligibleDepartmentIds).size) throw Errors.validation([{ field: 'eligibleDepartmentIds', message: 'Choose departments from your college.' }]);
    }
    const status = postsDirectly(auth) ? 'published' : 'pending';
    const now = new Date();
    const id = uuidv7();
    await opps().insertOne({
      _id: id,
      collegeId: auth.collegeId,
      postedBy: auth.userId,
      orgName: cleanText(b.orgName),
      title: cleanText(b.title),
      kind: b.kind,
      mode: b.mode,
      location: cleanText(b.location),
      payText: b.payText ?? '',
      deadline: b.deadline,
      eligibleDepartmentIds: [...new Set(b.eligibleDepartmentIds)],
      minYear: b.minYear,
      skills: [...new Set(b.skills.map((s) => cleanText(s)))],
      description: cleanText(b.description ?? ''),
      applyUrl: b.applyUrl ?? null,
      status,
      applicantsCount: 0,
      createdAt: now,
      updatedAt: now,
    });
    return reply.status(201).send({ id, status, message: status === 'pending' ? 'Sent for review. It goes live once a moderator approves it.' : 'Your opportunity is live.' });
  });

  app.patch('/opportunities/:id', { schema: { tags: ['opportunities'], summary: 'Edit or close an opportunity', params: idParam, body: oppPatch } }, async (request) => {
    const auth = requireAuth(request);
    const { o, manage } = await load(auth, request.params.id);
    if (!manage) throw Errors.forbidden();
    const b = request.body;
    // Students cannot publish their own pending submissions by editing them.
    if (b.status === 'published' && o.status === 'pending' && !isStaff(auth)) throw Errors.forbidden('A reviewer publishes submissions.');
    const set: Partial<Opportunity> = { updatedAt: new Date() };
    if (b.orgName) set.orgName = cleanText(b.orgName);
    if (b.title) set.title = cleanText(b.title);
    if (b.kind) set.kind = b.kind;
    if (b.mode) set.mode = b.mode;
    if (b.location) set.location = cleanText(b.location);
    if (b.payText !== undefined) set.payText = b.payText;
    if (b.deadline) set.deadline = b.deadline;
    if (b.eligibleDepartmentIds) set.eligibleDepartmentIds = [...new Set(b.eligibleDepartmentIds)];
    if (b.minYear) set.minYear = b.minYear;
    if (b.skills) set.skills = [...new Set(b.skills.map((s) => cleanText(s)))];
    if (b.description !== undefined) set.description = cleanText(b.description);
    if (b.applyUrl) set.applyUrl = b.applyUrl;
    if (b.status) set.status = b.status;
    await opps().updateOne({ _id: o._id }, { $set: set });
    return { status: 'saved' };
  });

  app.delete('/opportunities/:id', { schema: { tags: ['opportunities'], summary: 'Close and hide an opportunity', params: idParam } }, async (request) => {
    const auth = requireAuth(request);
    const { o, manage } = await load(auth, request.params.id);
    if (!manage) throw Errors.forbidden();
    await opps().updateOne({ _id: o._id }, { $set: { status: 'closed', updatedAt: new Date() } });
    return { status: 'closed' };
  });

  app.post(
    '/opportunities/:id/apply',
    { config: limits.write, schema: { tags: ['opportunities'], summary: 'Apply, or record that I applied externally', params: idParam, body: z.object({ note: optionalText(1000), resumeFileId: uuid.optional() }) } },
    async (request, reply) => {
      const auth = requireAuth(request);
      const [viewer, { o }] = await Promise.all([loadViewer(app.deps, auth), load(auth, request.params.id)]);
      if (o.status !== 'published' || o.deadline <= new Date()) throw Errors.conflict('Applications for this opportunity are closed.');
      if (o.postedBy === auth.userId) throw Errors.badRequest('You posted this opportunity.');
      const elig = eligibility(o, viewer);
      if (!elig.eligible) throw Errors.forbidden(elig.reasons.join(' '));
      if (request.body.resumeFileId) await assertOwnFiles(app.deps, auth.userId, [request.body.resumeFileId], ['other', 'resource', 'verification'], ['document']);
      const now = new Date();
      const existing = await apps().findOne({ opportunityId: o._id, userId: auth.userId });
      let id: string;
      if (existing) {
        if (existing.stage !== 'withdrawn') throw Errors.alreadyExists('You have already applied.');
        id = existing._id;
        await apps().updateOne({ _id: id }, { $set: { stage: 'applied', updatedAt: now, ...(request.body.note ? { note: request.body.note } : {}), ...(request.body.resumeFileId ? { resumeFileId: request.body.resumeFileId } : {}) } });
      } else {
        id = uuidv7();
        await apps().insertOne({ _id: id, opportunityId: o._id, userId: auth.userId, stage: 'applied', note: request.body.note ?? null, resumeFileId: request.body.resumeFileId ?? null, createdAt: now, updatedAt: now });
      }
      await opps().updateOne({ _id: o._id }, { $inc: { applicantsCount: 1 } });
      if (o.postedBy) {
        await app.deps.notifier.send({ userId: o.postedBy, kind: 'application', title: `${auth.displayName} applied to ${o.title}`, link: `/opportunities/${o._id}`, actorId: auth.userId, entityType: 'opportunity', entityId: o._id });
      }
      return reply.status(201).send({ id, stage: 'applied', applyUrl: o.applyUrl });
    },
  );

  app.get('/opportunities/:id/applicants', { schema: { tags: ['opportunities'], summary: 'Applicants (poster and staff)', params: idParam, querystring: pageQuery } }, async (request) => {
    const auth = requireAuth(request);
    const { o, manage } = await load(auth, request.params.id);
    if (!manage) throw Errors.forbidden();
    const rows = await apps()
      .find({ $and: [{ opportunityId: o._id, stage: { $ne: 'withdrawn' } }, newerThan('createdAt', decodeCursor(request.query.cursor)) as Filter<Application>] })
      .sort({ createdAt: 1, _id: 1 })
      .limit(request.query.limit + 1)
      .toArray();
    const { items, nextCursor } = page(rows, request.query.limit, (r) => encodeCursor(r.createdAt, r._id));
    const people = await loadPeople(app.deps, items.map((a) => a.userId));
    return {
      items: items.map((a) => ({ id: a._id, stage: a.stage, note: a.note, appliedAt: a.createdAt.toISOString(), hasResume: Boolean(a.resumeFileId), person: personOf(people, a.userId) })),
      nextCursor,
    };
  });

  app.get('/me/applications', { schema: { tags: ['opportunities'], summary: 'My application tracker' } }, async (request) => {
    const auth = requireAuth(request);
    const rows = await apps().find({ userId: auth.userId }).sort({ updatedAt: -1 }).limit(200).toArray();
    const list = await opps().find({ _id: { $in: rows.map((r) => r.opportunityId) } }, { projection: { title: 1, orgName: 1, kind: 1, deadline: 1 } }).toArray();
    const oppBy = new Map(list.map((o) => [o._id, o]));
    return {
      items: rows
        .filter((r) => oppBy.has(r.opportunityId))
        .map((r) => {
          const o = oppBy.get(r.opportunityId)!;
          return {
            id: r._id,
            stage: r.stage,
            note: r.note,
            appliedAt: r.createdAt.toISOString(),
            updatedAt: r.updatedAt.toISOString(),
            opportunity: { id: o._id, title: o.title, orgName: o.orgName, kind: o.kind, deadline: o.deadline.toISOString() },
          };
        }),
    };
  });

  app.patch(
    '/applications/:id',
    { schema: { tags: ['opportunities'], summary: 'Move an application to another stage', params: idParam, body: z.object({ stage: z.enum(STAGES), note: optionalText(1000) }) } },
    async (request) => {
      const auth = requireAuth(request);
      const a = await apps().findOne({ _id: request.params.id });
      const o = a ? await opps().findOne({ _id: a.opportunityId }, { projection: { postedBy: 1, title: 1, collegeId: 1 } }) : null;
      if (!a || !o || o.collegeId !== auth.collegeId) throw Errors.notFound('This application');
      const applicant = a.userId === auth.userId;
      const poster = o.postedBy === auth.userId || isStaff(auth);
      if (!applicant && !poster) throw Errors.notFound('This application');
      if (applicant && !poster && !['withdrawn', 'applied', 'offer', 'rejected', 'interview', 'shortlisted'].includes(request.body.stage)) throw Errors.forbidden();
      await db.tx(async (session) => {
        await apps().updateOne({ _id: a._id }, { $set: { stage: request.body.stage, updatedAt: new Date(), ...(applicant && request.body.note !== undefined ? { note: request.body.note } : {}) } }, { session });
        // Withdrawing frees the slot in the applicant count; re-applying adds it back.
        if (request.body.stage === 'withdrawn' && a.stage !== 'withdrawn') await opps().updateOne({ _id: o._id, applicantsCount: { $gt: 0 } }, { $inc: { applicantsCount: -1 } }, { session });
        if (!applicant) await audit(db, { action: 'application.stage', actorId: auth.userId, collegeId: auth.collegeId, entityType: 'application', entityId: a._id, requestId: request.id, meta: { stage: request.body.stage } }, session);
      });
      if (!applicant) {
        const words: Record<string, string> = { shortlisted: 'You were shortlisted', interview: 'Interview stage', offer: 'You received an offer', rejected: 'Application update' };
        await app.deps.notifier.send({ userId: a.userId, kind: 'application', title: `${words[request.body.stage] ?? 'Application update'}: ${o.title}`, link: `/opportunities/${o._id}`, actorId: auth.userId, entityType: 'opportunity', entityId: o._id });
      }
      return { stage: request.body.stage };
    },
  );
};
