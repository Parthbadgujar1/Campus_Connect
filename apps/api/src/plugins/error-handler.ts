import type { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import { hasZodFastifySchemaValidationErrors } from 'fastify-type-provider-zod';
import { AppError, Errors, isAppError } from '../core/errors.js';
import { Mongo } from '../infra/db/mongo.js';

// Central error handling. Turns every error (our own, validation, Fastify, MongoDB) into the
// standard envelope with the right status, logs it once with the request id, and never leaks
// stack traces, queries or internal messages to the client.

interface MongoErrorLike {
  name?: string;
  code?: number;
  codeName?: string;
  keyPattern?: Record<string, unknown>;
}

function fromMongo(err: MongoErrorLike): AppError | null {
  const unavailable = Mongo.toAppError(err);
  if (unavailable) return unavailable;
  if (!err.name || !/^Mongo/.test(err.name)) return null;
  switch (err.code) {
    case 11000: // duplicate key: a unique rule (one vote, one RSVP, taken username...) said no
      return Errors.alreadyExists('This already exists.');
    case 121: // document failed validation (schema.ts)
      return Errors.unprocessable('One of the values is not allowed.');
    case 50: // MaxTimeMSExpired
    case 262: // ExceededTimeLimit
      return Errors.unavailable('database (took too long)', 5);
    case 112: // WriteConflict: two writes raced; safe to retry
      return Errors.unavailable('database (busy, please retry)', 1);
    case 2:
    case 9:
      return Errors.badRequest('One of the values has the wrong format.');
    default:
      return null;
  }
}

function fromFastify(err: FastifyError): AppError | null {
  switch (err.code) {
    case 'FST_ERR_CTP_BODY_TOO_LARGE':
    case 'FST_REQ_FILE_TOO_LARGE':
    case 'FST_FILES_LIMIT':
    case 'FST_PARTS_LIMIT':
      return Errors.tooLarge('The request or file is too large.');
    case 'FST_ERR_CTP_INVALID_MEDIA_TYPE':
    case 'FST_INVALID_MULTIPART_CONTENT_TYPE':
      return Errors.unsupportedMedia('This content type is not supported here.');
    case 'FST_ERR_CTP_EMPTY_JSON_BODY':
    case 'FST_ERR_CTP_INVALID_JSON_BODY':
      return Errors.badRequest('The request body is not valid JSON.');
    case 'FST_ERR_VALIDATION':
      return Errors.validation([{ field: '', message: err.message }]);
    default:
      if (err.statusCode === 429) return Errors.tooMany();
      if (err.statusCode && err.statusCode >= 400 && err.statusCode < 500) {
        return new AppError(err.statusCode, err.statusCode === 404 ? 'NOT_FOUND' : 'BAD_REQUEST', 'The request could not be processed.');
      }
      return null;
  }
}

export function toAppError(error: unknown): AppError {
  if (isAppError(error)) return error;
  if (hasZodFastifySchemaValidationErrors(error)) {
    const where = (error as FastifyError).validationContext;
    const details = error.validation.map((v) => ({
      field: v.instancePath.replace(/^\//, '').replace(/\//g, '.') || where || '',
      message: v.message ?? 'Invalid value',
    }));
    return Errors.validation(details);
  }
  const fromDb = fromMongo(error as MongoErrorLike);
  if (fromDb) return fromDb;
  const fastify = fromFastify(error as FastifyError);
  if (fastify) return fastify;
  return Errors.internal(error);
}

export function sendError(request: FastifyRequest, reply: FastifyReply, appError: AppError) {
  if (appError.retryAfterSeconds) reply.header('retry-after', String(appError.retryAfterSeconds));
  return reply.status(appError.status).send({
    error: {
      code: appError.code,
      message: appError.message,
      ...(appError.details !== undefined ? { details: appError.details } : {}),
      requestId: request.id,
    },
  });
}

export default fp(
  async function errorHandler(app: FastifyInstance) {
    app.setErrorHandler((error, request, reply) => {
      const appError = toAppError(error);
      if (appError.status >= 500) {
        // Log the original error (with stack) for operators; the client sees the safe message.
        request.log.error({ err: appError.code === 'INTERNAL' ? error : appError, code: appError.code }, 'request failed');
      } else if (appError.status !== 401 && appError.status !== 404) {
        request.log.info({ code: appError.code, status: appError.status }, appError.message);
      }
      return sendError(request, reply, appError);
    });

    app.setNotFoundHandler((request, reply) =>
      sendError(request, reply, new AppError(404, 'NOT_FOUND', `There is no API route for ${request.method} ${request.url.split('?')[0]}.`)),
    );
  },
  { name: 'error-handler' },
);
