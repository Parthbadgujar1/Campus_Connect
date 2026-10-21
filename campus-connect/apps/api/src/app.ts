import { randomUUID } from 'node:crypto';
import multipart from '@fastify/multipart';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import websocket from '@fastify/websocket';
import Fastify, { type FastifyBaseLogger, type FastifyInstance } from 'fastify';
import { jsonSchemaTransform, serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import type { Deps } from './deps.js';
import { modules } from './modules/index.js';
import authPlugin from './plugins/auth.js';
import errorHandler from './plugins/error-handler.js';
import { registerModule } from './plugins/module-guard.js';
import security from './plugins/security.js';
import traffic from './plugins/traffic.js';

// Builds the HTTP application. Order matters:
//   error handling -> security headers/CORS/origin check -> session auth -> load shedding and
//   rate limits -> uploads/websockets/docs -> feature modules (each in its own bulkhead).

const REQUEST_ID = /^[A-Za-z0-9_-]{8,64}$/;

export async function buildApp(deps: Deps): Promise<FastifyInstance> {
  const { config } = deps;
  const app = Fastify({
    loggerInstance: deps.logger as FastifyBaseLogger,
    trustProxy: config.trustProxy,
    bodyLimit: 1_048_576, // 1 MB for JSON; uploads use multipart with their own limit
    connectionTimeout: 30_000,
    requestTimeout: 60_000,
    keepAliveTimeout: 72_000,
    requestIdHeader: 'x-request-id',
    genReqId: (req) => {
      const incoming = req.headers['x-request-id'];
      return typeof incoming === 'string' && REQUEST_ID.test(incoming) ? incoming : randomUUID();
    },
    routerOptions: { ignoreTrailingSlash: true, maxParamLength: 200 },
  });

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  app.decorate('deps', deps);

  app.addHook('onSend', async (request, reply, payload) => {
    reply.header('x-request-id', request.id);
    return payload;
  });

  await app.register(errorHandler);
  await app.register(security);
  await app.register(authPlugin);
  await app.register(traffic);
  await app.register(multipart, {
    limits: { fileSize: config.storage.maxUploadBytes, files: 1, fields: 20, fieldSize: 10_000, parts: 25 },
  });
  await app.register(websocket, { options: { maxPayload: 16 * 1024 } });

  if (config.enableApiDocs) {
    await app.register(swagger, {
      openapi: {
        info: {
          title: 'CampusConnect API',
          version: '1.0.0',
          description:
            'REST API for the CampusConnect apps. Errors use { error: { code, message, details, requestId } }. ' +
            'Web clients authenticate with the session cookie plus the X-CSRF-Token header; mobile clients send Authorization: Bearer.',
        },
        servers: [{ url: config.publicApiUrl }],
        components: {
          securitySchemes: {
            session: { type: 'apiKey', in: 'cookie', name: config.cookies.sessionName },
            bearer: { type: 'http', scheme: 'bearer' },
          },
        },
      },
      transform: jsonSchemaTransform,
    });
    await app.register(swaggerUi, { routePrefix: '/docs', staticCSP: true });
  }

  for (const def of modules) registerModule(app, def);

  return app;
}
