import type { FastifyPluginAsync } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { Errors } from '../../core/errors.js';
import { email } from '../../core/validation.js';
import { TERMS_VERSION } from '../auth/auth.service.js';
import { PURPOSES } from '../files/file-policy.js';

// /v1/meta — public, cacheable information the apps need before sign-in: the colleges and their
// departments for the sign-up form, upload limits, legal versions and the operator's
// business details for the legal pages and footer.

export const metaRoutes: FastifyPluginAsync = async (base) => {
  const app = base.withTypeProvider<ZodTypeProvider>();
  const { db, config, cache, flags } = app.deps;

  app.get('/config', { schema: { tags: ['meta'], summary: 'Public app configuration' } }, async (request, reply) => {
    const ctx = request.auth ? { userId: request.auth.userId, role: request.auth.role, collegeId: request.auth.collegeId } : {};
    const settings = await cache.remember('meta:legal', 60, async () => {
      const row = await db.col('app_settings').findOne({ _id: 'legal.versions' });
      return (row?.value ?? {}) as Record<string, string>;
    });
    if (!request.auth) reply.header('cache-control', 'public, max-age=60');
    return {
      registrationOpen: await flags.isEnabled('module.registration', ctx),
      flags: await flags.resolveAll(ctx),
      uploads: {
        maxMb: Math.round(config.storage.maxUploadBytes / 1024 / 1024),
        purposes: Object.fromEntries(
          Object.entries(PURPOSES).map(([k, r]) => [k, { kinds: r.kinds, maxMb: Math.round(r.maxBytes(config.storage.maxUploadBytes) / 1024 / 1024) }]),
        ),
      },
      legal: {
        termsVersion: settings.terms ?? TERMS_VERSION,
        privacyVersion: settings.privacy ?? TERMS_VERSION,
        cookiesVersion: settings.cookies ?? TERMS_VERSION,
        lastUpdated: TERMS_VERSION,
        minimumAge: 18,
      },
      operator: {
        name: config.operator.name,
        address: config.operator.address,
        supportEmail: config.operator.supportEmail,
        privacyEmail: config.operator.privacyEmail,
      },
    };
  });

  app.get('/colleges', { schema: { tags: ['meta'], summary: 'Colleges on CampusConnect (sign-up form)' } }, async (_request, reply) => {
    const items = await cache.remember('meta:colleges', 300, async () => {
      const rows = await db.col('colleges').find({ status: 'active' }, { projection: { name: 1, shortName: 1, slug: 1, city: 1, state: 1 } }).sort({ name: 1 }).limit(500).toArray();
      return rows.map((c) => ({ id: c._id, name: c.name, shortName: c.shortName, slug: c.slug, city: c.city, state: c.state }));
    });
    reply.header('cache-control', 'public, max-age=300');
    return { items };
  });

  app.get(
    '/college-lookup',
    {
      config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
      schema: { tags: ['meta'], summary: 'Which college an email address belongs to (sign-up form)', querystring: z.object({ email }) },
    },
    async (request) => {
      const domain = request.query.email.split('@')[1] ?? '';
      const row = await db.col('colleges').findOne({ 'domains.domain': domain, status: 'active' }, { projection: { name: 1, shortName: 1, slug: 1, domains: 1 } });
      if (!row) return { supported: false, college: null, roles: [] };
      // Which roles may sign up with this address (for example experts use a partner domain).
      const roles = row.domains.find((d) => d.domain === domain)?.allowsRoles ?? [];
      return { supported: true, college: { id: row._id, name: row.name, shortName: row.shortName, slug: row.slug }, roles };
    },
  );

  app.get(
    '/colleges/:slug/departments',
    { schema: { tags: ['meta'], summary: 'Departments of a college', params: z.object({ slug: z.string().regex(/^[a-z0-9-]{2,40}$/) }) } },
    async (request, reply) => {
      const rows = await cache.remember(`meta:departments:${request.params.slug}`, 300, async () => {
        const college = await db.col('colleges').findOne({ slug: request.params.slug, status: 'active' }, { projection: { _id: 1 } });
        if (!college) return [];
        const list = await db.col('departments').find({ collegeId: college._id }).sort({ name: 1 }).toArray();
        return list.map((d) => ({ id: d._id, code: d.code, name: d.name }));
      });
      if (!rows.length) throw Errors.notFound('This college');
      reply.header('cache-control', 'public, max-age=300');
      return { items: rows };
    },
  );
};
