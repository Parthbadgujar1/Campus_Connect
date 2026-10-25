import type { FastifyPluginAsync } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { Errors } from '../../core/errors.js';
import { canModerate, requireAuth } from '../../core/guards.js';
import { idParam } from '../../core/validation.js';
import { limits } from '../../plugins/traffic.js';
import { isInlineSafe, PURPOSES, type Purpose } from './file-policy.js';
import { fileView, storeUpload } from './files.service.js';

// Two modules, so switching uploads off (module.uploads) never breaks viewing existing files:
//   uploadRoutes  /v1/files          POST upload, GET metadata, DELETE
//   contentRoutes /v1/files/:id/content   streams bytes for a valid signed link

const purposeEnum = z.enum(Object.keys(PURPOSES) as [Purpose, ...Purpose[]]);

export const uploadRoutes: FastifyPluginAsync = async (base) => {
  const app = base.withTypeProvider<ZodTypeProvider>();
  const { db } = app.deps;

  app.post(
    '/',
    {
      config: limits.upload,
      schema: {
        tags: ['files'],
        summary: 'Upload one file (multipart/form-data, field "file")',
        querystring: z.object({ purpose: purposeEnum }),
        consumes: ['multipart/form-data'],
      },
    },
    async (request, reply) => {
      const auth = requireAuth(request);
      if (!request.isMultipart()) throw Errors.unsupportedMedia('Send the file as multipart/form-data in a field named "file".');
      const purpose = request.query.purpose;
      const max = PURPOSES[purpose].maxBytes(app.deps.config.storage.maxUploadBytes);
      const part = await request.file({ limits: { fileSize: max, files: 1 } });
      if (!part || part.fieldname !== 'file') throw Errors.badRequest('Attach the file in a field named "file".');
      let buffer: Buffer;
      try {
        buffer = await part.toBuffer();
      } catch (err) {
        if ((err as { code?: string }).code === 'FST_REQ_FILE_TOO_LARGE') {
          throw Errors.tooLarge(`This file is too large. The limit here is ${Math.round(max / 1024 / 1024)} MB.`);
        }
        throw err;
      }
      const file = await storeUpload(app.deps, { auth, purpose, filename: part.filename || 'file', buffer, requestId: request.id, ipHash: request.ipHash });
      return reply.status(201).send(file);
    },
  );

  app.get('/:id', { schema: { tags: ['files'], summary: 'File details and a fresh link', params: idParam } }, async (request) => {
    const auth = requireAuth(request);
    const f = await db.col('files').findOne({ _id: request.params.id, deletedAt: null, status: { $ne: 'deleted' } });
    // Private files (chat attachments, ID documents) are reachable only through the feature that
    // owns them; this endpoint serves them to their owner and moderators.
    const allowed = f && (f.ownerId === auth.userId || canModerate(auth) || (f.collegeId === auth.collegeId && f.visibility !== 'private'));
    if (!f || !allowed) throw Errors.notFound('This file');
    return fileView(app.deps, f);
  });

  app.delete('/:id', { schema: { tags: ['files'], summary: 'Delete my upload', params: idParam } }, async (request) => {
    const auth = requireAuth(request);
    const f = await db.col('files').findOneAndUpdate(
      { _id: request.params.id, ownerId: auth.userId, deletedAt: null },
      { $set: { status: 'deleted', deletedAt: new Date() } },
      { projection: { storageKey: 1, hasThumbnail: 1 } },
    );
    if (!f) throw Errors.notFound('This file');
    // Removing the bytes is best effort; the cleanup job retries anything left behind.
    await app.deps.storage.delete(f.storageKey).catch(() => undefined);
    if (f.hasThumbnail) await app.deps.storage.delete(`${f.storageKey}.thumb.webp`).catch(() => undefined);
    return { status: 'deleted' };
  });
};

export const contentRoutes: FastifyPluginAsync = async (base) => {
  const app = base.withTypeProvider<ZodTypeProvider>();
  const { db, storage } = app.deps;

  app.get(
    '/:id/content',
    {
      config: { rateLimit: { max: 600, timeWindow: '1 minute' } },
      schema: {
        tags: ['files'],
        summary: 'File bytes for a signed link (local storage driver)',
        params: idParam,
        querystring: z.object({ v: z.enum(['original', 'thumb']).default('original'), exp: z.coerce.number().int(), sig: z.string().min(20).max(100) }),
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const { v, exp, sig } = request.query;
      if (!storage.verifySignature(id, v, exp, sig)) throw Errors.gone('This link has expired. Reload the page to get a fresh one.');
      const f = await db.col('files').findOne({ _id: id, status: 'ready', deletedAt: null }, { projection: { storageKey: 1, originalName: 1, mimeType: 1, hasThumbnail: 1 } });
      if (!f || (v === 'thumb' && !f.hasThumbnail)) throw Errors.notFound('This file');
      const key = v === 'thumb' ? `${f.storageKey}.thumb.webp` : f.storageKey;
      const mime = v === 'thumb' ? 'image/webp' : f.mimeType;
      const total = await storage.size(key);

      reply.header('content-type', mime);
      reply.header('x-content-type-options', 'nosniff');
      reply.header('accept-ranges', 'bytes');
      reply.header('cache-control', `private, max-age=${Math.max(0, exp - Math.floor(Date.now() / 1000))}`);
      const encoded = encodeURIComponent(f.originalName);
      reply.header('content-disposition', `${isInlineSafe(mime) ? 'inline' : 'attachment'}; filename*=UTF-8''${encoded}`);

      // Single byte ranges, so video and audio can seek without downloading the whole file.
      const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.range ?? '');
      if (range && total > 0) {
        let start = range[1] ? Number(range[1]) : NaN;
        let end = range[2] ? Number(range[2]) : NaN;
        if (Number.isNaN(start)) {
          start = Math.max(0, total - end);
          end = total - 1;
        } else if (Number.isNaN(end) || end >= total) {
          end = total - 1;
        }
        if (start > end || start >= total) {
          reply.header('content-range', `bytes */${total}`);
          return reply.status(416).send();
        }
        const obj = await storage.get(key, { start, end });
        reply.header('content-range', `bytes ${start}-${end}/${total}`);
        reply.header('content-length', end - start + 1);
        return reply.status(206).send(obj.stream);
      }
      const obj = await storage.get(key);
      reply.header('content-length', total);
      return reply.send(obj.stream);
    },
  );
};
