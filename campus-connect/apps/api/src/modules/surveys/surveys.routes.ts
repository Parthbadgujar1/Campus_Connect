import type { FastifyPluginAsync, FastifyReply } from 'fastify';
import type { Filter } from 'mongodb';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { audit } from '../../core/audit.js';
import { Errors } from '../../core/errors.js';
import { requireAuth, requireRole } from '../../core/guards.js';
import { renderReport, REPORT_TYPES, type Report, type ReportFormat } from '../../core/exports/report.js';
import { cleanText, idParam, optionalText, text } from '../../core/validation.js';
import { uuidv7 } from '../../infra/db/ids.js';
import type { Role, Survey, SurveyQuestion, SurveyResponse } from '../../infra/db/models.js';
import { limits } from '../../plugins/traffic.js';
import type { AuthContext } from '../../types/fastify.js';
import { loadPeople } from '../users/people.js';

// /v1/surveys (everyone) and /v1/admin/surveys (admins) — surveys from the college.
//
// Admins write the questions (about the app or anything else), choose who sees the survey and
// whether it is compulsory, then publish. Published surveys appear at once for their audience
// (and a notification is sent). A compulsory survey has to be answered before the app can be
// used: the web and mobile apps ask for it on sign-in and cannot dismiss it, and
// GET /surveys/pending lists what is due. Each person answers once. Anonymous surveys never
// reveal who answered, not even in exports.

const ROLES = ['student', 'faculty', 'expert', 'moderator', 'admin'] as const;
const CATEGORIES = ['app', 'campus', 'academics', 'events', 'other'] as const;
const MAX_EXPORT_ROWS = 5000;

const question = z
  .object({
    id: z.string().regex(/^[A-Za-z0-9_-]{1,40}$/).optional(),
    type: z.enum(['single', 'multiple', 'text', 'rating', 'scale']),
    prompt: text(3, 300),
    options: z.array(text(1, 120)).max(12).default([]),
    required: z.boolean().default(true),
  })
  .refine((q) => (q.type === 'single' || q.type === 'multiple' ? q.options.length >= 2 : true), { message: 'Choice questions need at least two options.', path: ['options'] })
  .refine((q) => new Set(q.options.map((o) => o.toLowerCase())).size === q.options.length, { message: 'Options must be different from each other.', path: ['options'] });

const surveyBody = z.object({
  title: text(3, 160),
  description: optionalText(1000),
  category: z.enum(CATEGORIES).default('app'),
  compulsory: z.boolean().default(false),
  anonymous: z.boolean().default(true),
  audienceRoles: z.array(z.enum(ROLES)).max(5).default([]),
  closesAt: z.coerce.date().optional(),
  questions: z.array(question).min(1).max(30),
  publish: z.boolean().default(false),
});

// Edits: everything optional and without defaults.
const surveyPatch = z.object({
  title: text(3, 160).optional(),
  description: optionalText(1000),
  category: z.enum(CATEGORIES).optional(),
  compulsory: z.boolean().optional(),
  anonymous: z.boolean().optional(),
  audienceRoles: z.array(z.enum(ROLES)).max(5).optional(),
  closesAt: z.coerce.date().nullable().optional(),
  questions: z.array(question).min(1).max(30).optional(),
  status: z.enum(['draft', 'published', 'closed']).optional(),
});

const answerValue = z.union([z.string().max(2000), z.array(z.string().max(120)).max(12), z.number()]);

function normaliseQuestions(list: z.infer<typeof question>[]): SurveyQuestion[] {
  const used = new Set<string>();
  return list.map((q, i) => {
    let id = q.id ?? `q${i + 1}`;
    while (used.has(id)) id = `${id}_${i + 1}`;
    used.add(id);
    return { id, type: q.type, prompt: cleanText(q.prompt), options: q.type === 'single' || q.type === 'multiple' ? q.options.map((o) => cleanText(o)) : [], required: q.required };
  });
}

/** Checks one person's answers against the questions. Returns cleaned answers. */
function validateAnswers(questions: SurveyQuestion[], raw: Record<string, unknown>): SurveyResponse['answers'] {
  const problems: Array<{ field: string; message: string }> = [];
  const answers: SurveyResponse['answers'] = [];
  for (const q of questions) {
    const v = raw[q.id];
    const empty = v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);
    if (empty) {
      if (q.required) problems.push({ field: q.id, message: 'Please answer this question.' });
      continue;
    }
    const field = q.id;
    switch (q.type) {
      case 'single':
        if (typeof v !== 'string' || !q.options.includes(v)) problems.push({ field, message: 'Choose one of the options.' });
        else answers.push({ questionId: q.id, value: v });
        break;
      case 'multiple':
        if (!Array.isArray(v) || v.some((x) => typeof x !== 'string' || !q.options.includes(x))) problems.push({ field, message: 'Choose from the options.' });
        else answers.push({ questionId: q.id, value: [...new Set(v as string[])] });
        break;
      case 'text':
        if (typeof v !== 'string' || v.trim().length > 2000) problems.push({ field, message: 'Write up to 2000 characters.' });
        else answers.push({ questionId: q.id, value: cleanText(v).trim() });
        break;
      case 'rating':
        if (typeof v !== 'number' || !Number.isInteger(v) || v < 1 || v > 5) problems.push({ field, message: 'Give 1 to 5 stars.' });
        else answers.push({ questionId: q.id, value: v });
        break;
      case 'scale':
        if (typeof v !== 'number' || !Number.isInteger(v) || v < 0 || v > 10) problems.push({ field, message: 'Choose a number from 0 to 10.' });
        else answers.push({ questionId: q.id, value: v });
        break;
    }
  }
  if (problems.length) throw Errors.validation(problems, 'Some answers need attention.');
  return answers;
}

function audienceMatches(s: Pick<Survey, 'audienceRoles'>, role: Role): boolean {
  return !s.audienceRoles.length || s.audienceRoles.includes(role);
}

/** Surveys the person can see now: published, open, for their role. */
function liveFilter(auth: AuthContext): Filter<Survey> {
  const now = new Date();
  return { collegeId: auth.collegeId, status: 'published', $and: [{ $or: [{ closesAt: null }, { closesAt: { $gt: now } }] }, { $or: [{ audienceRoles: { $size: 0 } }, { audienceRoles: auth.role }] }] };
}

function publicView(s: Survey, answered: boolean) {
  return {
    id: s._id,
    title: s.title,
    description: s.description,
    category: s.category,
    compulsory: s.compulsory,
    anonymous: s.anonymous,
    questions: s.questions,
    publishedAt: s.publishedAt?.toISOString() ?? null,
    closesAt: s.closesAt?.toISOString() ?? null,
    answered,
  };
}

export const surveyRoutes: FastifyPluginAsync = async (base) => {
  const app = base.withTypeProvider<ZodTypeProvider>();
  const { db } = app.deps;
  const surveys = () => db.col('surveys');
  const responses = () => db.col('survey_responses');

  async function answeredSet(userId: string, ids: string[]): Promise<Set<string>> {
    if (!ids.length) return new Set();
    const rows = await responses().find({ _id: { $in: ids.map((i) => `${i}:${userId}`) } }, { projection: { surveyId: 1 } }).toArray();
    return new Set(rows.map((r) => r.surveyId));
  }

  // ---------------------------------------------------------------- for everyone
  app.get('/surveys', { schema: { tags: ['surveys'], summary: 'Surveys open to me, newest first' } }, async (request) => {
    const auth = requireAuth(request);
    const rows = await surveys().find(liveFilter(auth)).sort({ compulsory: -1, publishedAt: -1 }).limit(100).toArray();
    const answered = await answeredSet(auth.userId, rows.map((s) => s._id));
    return { items: rows.map((s) => ({ ...publicView(s, answered.has(s._id)), questions: undefined, questionsCount: s.questions.length })) };
  });

  app.get('/surveys/pending', { schema: { tags: ['surveys'], summary: 'Surveys I still have to answer (compulsory ones first)' } }, async (request) => {
    const auth = requireAuth(request);
    const rows = await surveys().find(liveFilter(auth)).sort({ compulsory: -1, publishedAt: 1 }).limit(50).toArray();
    const answered = await answeredSet(auth.userId, rows.map((s) => s._id));
    const open = rows.filter((s) => !answered.has(s._id));
    return {
      compulsory: open.filter((s) => s.compulsory).map((s) => publicView(s, false)),
      optional: open.filter((s) => !s.compulsory).map((s) => ({ ...publicView(s, false), questions: undefined, questionsCount: s.questions.length })),
    };
  });

  app.get('/surveys/:id', { schema: { tags: ['surveys'], summary: 'A survey to answer', params: idParam } }, async (request) => {
    const auth = requireAuth(request);
    const s = await surveys().findOne({ $and: [{ _id: request.params.id }, liveFilter(auth)] });
    if (!s) throw Errors.notFound('This survey');
    const mine = await responses().findOne({ _id: `${s._id}:${auth.userId}` });
    return { ...publicView(s, Boolean(mine)), myAnswers: mine ? Object.fromEntries(mine.answers.map((a) => [a.questionId, a.value])) : null };
  });

  app.post(
    '/surveys/:id/responses',
    { config: limits.write, schema: { tags: ['surveys'], summary: 'Submit my answers (once)', params: idParam, body: z.object({ answers: z.record(z.string().max(40), answerValue) }) } },
    async (request, reply) => {
      const auth = requireAuth(request);
      const s = await surveys().findOne({ $and: [{ _id: request.params.id }, liveFilter(auth)] });
      if (!s) throw Errors.notFound('This survey');
      const answers = validateAnswers(s.questions, request.body.answers);
      const id = `${s._id}:${auth.userId}`;
      try {
        await responses().insertOne({ _id: id, surveyId: s._id, collegeId: auth.collegeId, userId: auth.userId, answers, submittedAt: new Date() });
      } catch (err) {
        if ((err as { code?: number }).code === 11000) throw Errors.alreadyExists('You have already answered this survey. Thank you!');
        throw err;
      }
      await surveys().updateOne({ _id: s._id }, { $inc: { responsesCount: 1 } });
      return reply.status(201).send({ status: 'submitted', message: 'Thank you! Your answers were saved.' });
    },
  );

  // ---------------------------------------------------------------- admin
  app.get(
    '/admin/surveys',
    { schema: { tags: ['admin'], summary: 'All surveys (drafts, live and closed)', querystring: z.object({ status: z.enum(['draft', 'published', 'closed']).optional(), q: z.string().trim().max(80).optional() }) } },
    async (request) => {
      const auth = requireRole(request, 'admin');
      const filter: Filter<Survey> = { collegeId: auth.collegeId, ...(request.query.status ? { status: request.query.status } : {}) };
      if (request.query.q) filter.title = { $regex: request.query.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
      const rows = await surveys().find(filter).sort({ createdAt: -1 }).limit(200).toArray();
      // How many people each survey is for, to show a response rate.
      const audience = async (roles: Role[]) => db.col('users').countDocuments({ collegeId: auth.collegeId, status: 'active', ...(roles.length ? { role: { $in: roles } } : {}) });
      const sizes = new Map<string, number>();
      for (const key of new Set(rows.map((s) => [...s.audienceRoles].sort().join(',')))) sizes.set(key, await audience(key ? (key.split(',') as Role[]) : []));
      return {
        items: rows.map((s) => {
          const size = sizes.get([...s.audienceRoles].sort().join(',')) ?? 0;
          return {
            id: s._id,
            title: s.title,
            description: s.description,
            category: s.category,
            compulsory: s.compulsory,
            anonymous: s.anonymous,
            audienceRoles: s.audienceRoles,
            status: s.status,
            questionsCount: s.questions.length,
            responsesCount: s.responsesCount,
            audienceSize: size,
            responseRate: size ? Math.round((s.responsesCount / size) * 100) : 0,
            publishedAt: s.publishedAt?.toISOString() ?? null,
            closesAt: s.closesAt?.toISOString() ?? null,
            createdAt: s.createdAt.toISOString(),
          };
        }),
      };
    },
  );

  app.get('/admin/surveys/:id', { schema: { tags: ['admin'], summary: 'A survey with its questions (for editing)', params: idParam } }, async (request) => {
    const auth = requireRole(request, 'admin');
    const s = await surveys().findOne({ _id: request.params.id, collegeId: auth.collegeId });
    if (!s) throw Errors.notFound('This survey');
    return { ...publicView(s, false), status: s.status, audienceRoles: s.audienceRoles, responsesCount: s.responsesCount, createdAt: s.createdAt.toISOString() };
  });

  async function announce(auth: AuthContext, s: Survey) {
    return app.deps.notifier.broadcast(
      auth.collegeId,
      {
        kind: 'survey',
        title: s.compulsory ? `Please answer: ${s.title}` : `New survey: ${s.title}`,
        body: s.description.slice(0, 200) || `${s.questions.length} question${s.questions.length === 1 ? '' : 's'}`,
        link: `/surveys/${s._id}`,
        actorId: auth.userId,
        entityType: 'survey',
        entityId: s._id,
      },
      { roles: s.audienceRoles.length ? s.audienceRoles : undefined },
    );
  }

  app.post('/admin/surveys', { schema: { tags: ['admin'], summary: 'Create a survey (draft, or publish now)', body: surveyBody } }, async (request, reply) => {
    const auth = requireRole(request, 'admin');
    const b = request.body;
    if (b.closesAt && b.closesAt <= new Date()) throw Errors.validation([{ field: 'closesAt', message: 'Choose a future closing date.' }]);
    const now = new Date();
    const s: Survey = {
      _id: uuidv7(),
      collegeId: auth.collegeId,
      title: cleanText(b.title),
      description: cleanText(b.description ?? ''),
      category: b.category,
      compulsory: b.compulsory,
      anonymous: b.anonymous,
      audienceRoles: [...new Set(b.audienceRoles)],
      questions: normaliseQuestions(b.questions),
      status: b.publish ? 'published' : 'draft',
      publishedAt: b.publish ? now : null,
      closesAt: b.closesAt ?? null,
      createdBy: auth.userId,
      responsesCount: 0,
      createdAt: now,
      updatedAt: now,
    };
    await db.tx(async (session) => {
      await surveys().insertOne(s, { session });
      await audit(db, { action: b.publish ? 'survey.publish' : 'survey.create', actorId: auth.userId, actorRole: auth.role, collegeId: auth.collegeId, entityType: 'survey', entityId: s._id, requestId: request.id, meta: { compulsory: s.compulsory } }, session);
    });
    const notified = b.publish ? await announce(auth, s) : 0;
    return reply.status(201).send({ id: s._id, status: s.status, notified });
  });

  app.patch('/admin/surveys/:id', { schema: { tags: ['admin'], summary: 'Edit, publish or close a survey', params: idParam, body: surveyPatch } }, async (request) => {
    const auth = requireRole(request, 'admin');
    const s = await surveys().findOne({ _id: request.params.id, collegeId: auth.collegeId });
    if (!s) throw Errors.notFound('This survey');
    const b = request.body;
    // Questions are fixed once people have answered, so results stay comparable.
    if (b.questions && s.responsesCount > 0) throw Errors.conflict('People have already answered. Close this survey and create a new one to change the questions.');
    if (b.status === 'draft' && s.status !== 'draft') throw Errors.conflict('A published survey cannot go back to draft. Close it instead.');
    const set: Partial<Survey> = { updatedAt: new Date() };
    if (b.title) set.title = cleanText(b.title);
    if (b.description !== undefined) set.description = cleanText(b.description);
    if (b.category) set.category = b.category;
    if (b.compulsory !== undefined) set.compulsory = b.compulsory;
    // A survey promised as anonymous stays anonymous once answers exist.
    if (b.anonymous !== undefined) {
      if (s.anonymous && !b.anonymous && s.responsesCount > 0) throw Errors.conflict('People answered this survey anonymously; it cannot be made named now.');
      set.anonymous = b.anonymous;
    }
    if (b.audienceRoles) set.audienceRoles = [...new Set(b.audienceRoles)];
    if (b.closesAt !== undefined) set.closesAt = b.closesAt;
    if (b.questions) set.questions = normaliseQuestions(b.questions);
    const publishing = b.status === 'published' && s.status !== 'published';
    if (b.status) set.status = b.status;
    if (publishing && !s.publishedAt) set.publishedAt = new Date();
    const updated = await surveys().findOneAndUpdate({ _id: s._id }, { $set: set }, { returnDocument: 'after' });
    await audit(db, { action: `survey.${b.status === 'closed' ? 'close' : publishing ? 'publish' : 'update'}`, actorId: auth.userId, actorRole: auth.role, collegeId: auth.collegeId, entityType: 'survey', entityId: s._id, requestId: request.id });
    const notified = publishing && updated ? await announce(auth, updated) : 0;
    return { status: 'saved', surveyStatus: updated?.status ?? s.status, notified };
  });

  app.delete('/admin/surveys/:id', { schema: { tags: ['admin'], summary: 'Delete a survey and its answers', params: idParam } }, async (request) => {
    const auth = requireRole(request, 'admin');
    const s = await surveys().findOne({ _id: request.params.id, collegeId: auth.collegeId }, { projection: { _id: 1, title: 1 } });
    if (!s) throw Errors.notFound('This survey');
    await db.tx(async (session) => {
      await responses().deleteMany({ surveyId: s._id }, { session });
      await surveys().deleteOne({ _id: s._id }, { session });
      await audit(db, { action: 'survey.delete', actorId: auth.userId, actorRole: auth.role, collegeId: auth.collegeId, entityType: 'survey', entityId: s._id, requestId: request.id, meta: { title: s.title } }, session);
    });
    return { status: 'deleted' };
  });

  /** Per-question summaries plus the individual answers (named unless the survey is anonymous). */
  async function results(auth: AuthContext, surveyId: string) {
    const s = await surveys().findOne({ _id: surveyId, collegeId: auth.collegeId });
    if (!s) throw Errors.notFound('This survey');
    const rows = await responses().find({ surveyId: s._id }).sort({ submittedAt: -1 }).limit(MAX_EXPORT_ROWS).toArray();
    const people = s.anonymous ? new Map() : await loadPeople(app.deps, rows.map((r) => r.userId));
    const summary = s.questions.map((q) => {
      const values = rows.map((r) => r.answers.find((a) => a.questionId === q.id)?.value).filter((v) => v !== undefined);
      const base = { questionId: q.id, prompt: q.prompt, type: q.type, answered: values.length };
      if (q.type === 'single' || q.type === 'multiple') {
        const counts = Object.fromEntries(q.options.map((o) => [o, 0]));
        for (const v of values) for (const o of Array.isArray(v) ? v : [v]) if (typeof o === 'string' && o in counts) counts[o]! += 1;
        return { ...base, options: q.options.map((o) => ({ option: o, count: counts[o]!, percent: values.length ? Math.round((counts[o]! / values.length) * 100) : 0 })) };
      }
      if (q.type === 'rating' || q.type === 'scale') {
        const nums = values.filter((v): v is number => typeof v === 'number');
        const max = q.type === 'rating' ? 5 : 10;
        const min = q.type === 'rating' ? 1 : 0;
        const distribution = Array.from({ length: max - min + 1 }, (_, i) => ({ value: min + i, count: nums.filter((n) => n === min + i).length }));
        const average = nums.length ? Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10 : null;
        // For 0-10 scales, the usual promoter score: % 9-10 minus % 0-6.
        const nps = q.type === 'scale' && nums.length ? Math.round(((nums.filter((n) => n >= 9).length - nums.filter((n) => n <= 6).length) / nums.length) * 100) : null;
        return { ...base, average, distribution, nps };
      }
      return { ...base, latest: values.slice(0, 50).map((v) => String(v)) };
    });
    const individual = rows.map((r) => ({
      id: r._id,
      submittedAt: r.submittedAt.toISOString(),
      respondent: s.anonymous ? null : (people.get(r.userId) ?? null),
      answers: Object.fromEntries(r.answers.map((a) => [a.questionId, a.value])),
    }));
    return { survey: s, summary, individual };
  }

  app.get('/admin/surveys/:id/results', { schema: { tags: ['admin'], summary: 'Results: per-question summaries and individual answers', params: idParam } }, async (request) => {
    const auth = requireRole(request, 'admin');
    const r = await results(auth, request.params.id);
    return {
      survey: { id: r.survey._id, title: r.survey.title, anonymous: r.survey.anonymous, compulsory: r.survey.compulsory, status: r.survey.status, responsesCount: r.survey.responsesCount, questions: r.survey.questions },
      summary: r.summary,
      responses: r.individual.slice(0, 500),
    };
  });

  app.get(
    '/admin/surveys/:id/export',
    { config: { rateLimit: { max: 30, timeWindow: '1 hour' } }, schema: { tags: ['admin'], summary: 'Download results as Excel, Word, PDF or CSV', params: idParam, querystring: z.object({ format: z.enum(['xlsx', 'docx', 'pdf', 'csv']).default('xlsx') }) } },
    async (request, reply) => {
      const auth = requireRole(request, 'admin');
      const r = await results(auth, request.params.id);
      const s = r.survey;
      const fmt = (v: unknown) => (Array.isArray(v) ? v.join('; ') : v === undefined ? '' : String(v));
      const report: Report = {
        title: s.title,
        subtitle: `${s.responsesCount} response${s.responsesCount === 1 ? '' : 's'} · ${s.anonymous ? 'anonymous' : 'named'} · exported ${new Date().toUTCString()}`,
        sections: [
          {
            heading: 'Summary',
            columns: ['Question', 'Answered', 'Result'],
            rows: r.summary.map((q) => [
              q.prompt,
              q.answered,
              'options' in q && q.options
                ? q.options.map((o) => `${o.option}: ${o.count} (${o.percent}%)`).join(' | ')
                : 'average' in q
                  ? `Average ${q.average ?? '-'}${q.nps !== null && q.nps !== undefined ? `, promoter score ${q.nps}` : ''}`
                  : `${q.answered} written answers`,
            ]),
          },
          {
            heading: 'Responses',
            columns: ['Submitted', ...(s.anonymous ? [] : ['Name', 'Username']), ...s.questions.map((q) => q.prompt)],
            rows: r.individual.map((row) => [
              row.submittedAt.replace('T', ' ').slice(0, 16),
              ...(s.anonymous ? [] : [row.respondent?.displayName ?? 'Deleted user', row.respondent ? `@${row.respondent.username}` : '']),
              ...s.questions.map((q) => fmt(row.answers[q.id])),
            ]),
          },
        ],
      };
      await audit(db, { action: 'survey.export', actorId: auth.userId, actorRole: auth.role, collegeId: auth.collegeId, entityType: 'survey', entityId: s._id, requestId: request.id, meta: { format: request.query.format } });
      return sendReport(reply, report, request.query.format, `survey-${s.title}`);
    },
  );
};

/** Sends a generated report as a file download. */
export function sendReport(reply: FastifyReply, report: Report, format: ReportFormat, baseName: string) {
  const name = `${baseName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'report'}-${new Date().toISOString().slice(0, 10)}.${format}`;
  reply.header('content-type', REPORT_TYPES[format]);
  reply.header('content-disposition', `attachment; filename="${name}"`);
  reply.header('cache-control', 'no-store');
  return reply.send(renderReport(report, format));
}
