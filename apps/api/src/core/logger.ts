import pino, { type Logger } from 'pino';
import type { Config } from '../config/env.js';

// Structured JSON logs (pretty-printed locally). Secrets and personal data are redacted at the
// logger, so a careless log line cannot leak a password, token or cookie.

export function createLogger(config: Pick<Config, 'logLevel' | 'logPretty' | 'env'>): Logger {
  return pino({
    level: config.logLevel,
    base: { service: 'campusconnect-api', env: config.env },
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        'req.headers["x-csrf-token"]',
        'res.headers["set-cookie"]',
        '*.password',
        '*.currentPassword',
        '*.newPassword',
        '*.token',
        '*.password_hash',
        '*.token_hash',
      ],
      censor: '[redacted]',
    },
    transport: config.logPretty
      ? { target: 'pino-pretty', options: { translateTime: 'SYS:HH:MM:ss', ignore: 'pid,hostname,service,env', singleLine: true } }
      : undefined,
  });
}
