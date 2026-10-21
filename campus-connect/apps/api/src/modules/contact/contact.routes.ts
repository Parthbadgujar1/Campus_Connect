import type { FastifyPluginAsync } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { email, text } from '../../core/validation.js';
import { uuidv7 } from '../../infra/db/ids.js';
import { limits } from '../../plugins/traffic.js';
import { TERMS_VERSION } from '../auth/auth.service.js';

// /v1/contact — the public contact form.
// Collects only what is needed to answer: name, email, topic and the message. Campaign (UTM)
// parameters are stored only when the visitor allowed analytics cookies, and the form requires
// explicit consent to process the message.

const utmValue = z.string().trim().max(100).regex(/^[A-Za-z0-9 _.\-+%]*$/);

export const contactRoutes: FastifyPluginAsync = async (base) => {
  const app = base.withTypeProvider<ZodTypeProvider>();
  const { db } = app.deps;

  app.post(
    '/',
    {
      config: limits.contact,
      schema: {
        tags: ['contact'],
        summary: 'Send a message to the CampusConnect team',
        body: z.object({
          name: text(2, 80),
          email,
          topic: z.enum(['general', 'support', 'privacy', 'safety', 'partnership', 'press']),
          subject: text(3, 140),
          message: text(10, 4000),
          consent: z.literal(true, { message: 'Please agree so we can use your details to reply.' }),
          analyticsConsent: z.boolean().default(false),
          utm: z.object({ source: utmValue.optional(), medium: utmValue.optional(), campaign: utmValue.optional(), term: utmValue.optional(), content: utmValue.optional() }).optional(),
          anonymousId: z.string().regex(/^[A-Za-z0-9_-]{8,64}$/).optional(),
          // Honeypot: real people never see or fill this field.
          website: z.string().max(200).optional(),
        }),
      },
    },
    async (request, reply) => {
      const b = request.body;
      if (b.website) return reply.status(202).send({ status: 'received' }); // quietly drop bots
      const utm = b.analyticsConsent && b.utm && Object.values(b.utm).some(Boolean) ? (Object.fromEntries(Object.entries(b.utm).filter(([, v]) => v)) as Record<string, string>) : null;
      const now = new Date();
      const id = uuidv7();
      await db.tx(async (session) => {
        await db.col('contact_messages').insertOne(
          { _id: id, userId: request.auth?.userId ?? null, name: b.name, email: b.email, topic: b.topic, subject: b.subject, message: b.message, consentProcessing: true, utm, ipHash: request.ipHash, status: 'new', createdAt: now, updatedAt: now },
          { session },
        );
        if (request.auth || b.anonymousId) {
          await db.col('consents').insertOne(
            { _id: uuidv7(), userId: request.auth?.userId ?? null, anonymousId: request.auth ? null : (b.anonymousId ?? null), purpose: 'contact', granted: true, policyVersion: TERMS_VERSION, source: 'contact', ipHash: request.ipHash, createdAt: now },
            { session },
          );
        }
        await app.deps.mailer.enqueue({ to: b.email, template: 'contact_received', payload: { name: b.name.split(' ')[0], subject: b.subject }, dedupeKey: `contact:${id}` }, session);
      });
      return reply.status(202).send({ status: 'received', message: 'Thanks! We have emailed you a copy and will reply within two working days.' });
    },
  );
};
