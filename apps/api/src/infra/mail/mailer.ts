import nodemailer, { type Transporter } from 'nodemailer';
import type { ClientSession } from 'mongodb';
import type { Logger } from 'pino';
import type { Config } from '../../config/env.js';
import { CircuitBreaker, CircuitOpenError } from '../../core/circuit-breaker.js';
import { unsubscribeUrl, type UnsubscribeScope } from '../../core/unsubscribe.js';
import { uuidv7 } from '../db/ids.js';
import type { EmailOutbox } from '../db/models.js';
import type { Mongo } from '../db/mongo.js';
import { renderTemplate, type TemplateName } from './templates.js';

// Email delivery through a transactional outbox.
//   enqueue()    - inserts a document; cheap, and part of the caller's transaction when there is
//                  one, so an email is sent if and only if the change it announces was saved
//   processDue() - background worker: claims due emails one at a time with an atomic
//                  findOneAndUpdate (safe with many API processes), renders, sends, and retries
//                  with exponential backoff
// If the provider is down, emails wait and retry; sign-ups, password resets etc. still succeed
// and the email arrives when the provider recovers. MAIL_TRANSPORT=dev stores the rendered email
// instead of sending it (the admin "Dev mailbox"), so every flow can be tested locally.

export type EmailCategory = 'transactional' | 'security' | 'notification' | 'marketing';

export interface OutgoingEmail {
  to: string;
  template: TemplateName;
  category?: EmailCategory;
  payload?: Record<string, unknown>;
  userId?: string | null;
  dedupeKey?: string;
}

const SUPPRESSION_SCOPE: Record<EmailCategory, UnsubscribeScope | null> = {
  transactional: null, // cannot be unsubscribed from (verification, resets, receipts)
  security: null,
  notification: 'notification',
  marketing: 'marketing',
};

export class Mailer {
  readonly breaker = new CircuitBreaker('email', { failureThreshold: 3, cooldownMs: 60_000 });
  private readonly transport?: Transporter;

  constructor(
    private readonly config: Config,
    private readonly db: Mongo,
    private readonly logger: Logger,
  ) {
    if (config.mail.transport === 'smtp' && config.mail.smtp.host) {
      this.transport = nodemailer.createTransport({
        host: config.mail.smtp.host,
        port: config.mail.smtp.port,
        secure: config.mail.smtp.secure,
        auth: config.mail.smtp.user ? { user: config.mail.smtp.user, pass: config.mail.smtp.pass } : undefined,
        connectionTimeout: 10_000,
        greetingTimeout: 10_000,
        socketTimeout: 20_000,
        pool: true,
        maxConnections: 3,
      });
    }
  }

  get mode(): 'dev' | 'smtp' {
    return this.transport ? 'smtp' : 'dev';
  }

  /** Queues an email. Pass the transaction session so it commits together with the change. */
  async enqueue(email: OutgoingEmail, session?: ClientSession): Promise<void> {
    const doc: EmailOutbox = {
      _id: uuidv7(),
      toEmail: email.to.toLowerCase(),
      userId: email.userId ?? null,
      template: email.template,
      category: email.category ?? 'transactional',
      payload: email.payload ?? {},
      status: 'queued',
      attempts: 0,
      maxAttempts: 6,
      nextAttemptAt: new Date(),
      lockedAt: null,
      lastError: null,
      providerMessageId: null,
      renderedSubject: null,
      renderedHtml: null,
      renderedText: null,
      dedupeKey: email.dedupeKey ?? null,
      createdAt: new Date(),
      sentAt: null,
    };
    try {
      await this.db.col('email_outbox').insertOne(doc, { session });
    } catch (err) {
      // Duplicate dedupe key: this exact email was already queued (for example a retried request).
      if ((err as { code?: number }).code === 11000 && email.dedupeKey) return;
      throw err;
    }
  }

  /** Delivers due emails. Returns how many were processed. Never throws. */
  async processDue(limit = 20): Promise<number> {
    const outbox = this.db.col('email_outbox');
    try {
      // Emails left "sending" by a crashed worker are released after 5 minutes.
      await outbox.updateMany(
        { status: 'sending', lockedAt: { $lt: new Date(Date.now() - 5 * 60_000) } },
        { $set: { status: 'failed', lockedAt: null, lastError: 'worker interrupted' } },
      );
      if (this.transport && !this.breaker.canAttempt()) return 0;
    } catch (err) {
      this.logger.warn({ err: (err as Error).message }, 'email outbox unavailable');
      return 0;
    }

    let processed = 0;
    for (; processed < limit; processed++) {
      let row: EmailOutbox | null;
      try {
        row = await outbox.findOneAndUpdate(
          { status: { $in: ['queued', 'failed'] }, nextAttemptAt: { $lte: new Date() } },
          { $set: { status: 'sending', lockedAt: new Date() }, $inc: { attempts: 1 } },
          { sort: { nextAttemptAt: 1 }, returnDocument: 'after' },
        );
      } catch (err) {
        this.logger.warn({ err: (err as Error).message }, 'email outbox unavailable');
        break;
      }
      if (!row) break;
      await this.deliver(row);
    }
    return processed;
  }

  private async deliver(row: EmailOutbox): Promise<void> {
    const outbox = this.db.col('email_outbox');
    try {
      const scope = SUPPRESSION_SCOPE[row.category];
      if (scope) {
        const suppressed = await this.db.col('email_suppressions').findOne({ email: row.toEmail, scope: { $in: ['all', scope] } });
        if (suppressed) {
          await outbox.updateOne({ _id: row._id }, { $set: { status: 'suppressed', lockedAt: null } });
          return;
        }
      }

      const unsubscribe = scope ? unsubscribeUrl(this.config.webUrl, this.config.secrets.session, row.toEmail, scope) : undefined;
      const rendered = renderTemplate(row.template as TemplateName, row.payload, {
        appName: 'CampusConnect',
        webUrl: this.config.webUrl,
        supportEmail: this.config.operator.supportEmail,
        operatorLine: `${this.config.operator.name}, ${this.config.operator.address}`,
        unsubscribeUrl: unsubscribe,
        preferencesUrl: `${this.config.webUrl}/settings/notifications`,
      });

      let providerId: string;
      if (this.transport) {
        const info = await this.breaker.exec(() =>
          this.transport!.sendMail({
            from: this.config.mail.from,
            to: row.toEmail,
            subject: rendered.subject,
            html: rendered.html,
            text: rendered.text,
            headers: unsubscribe ? { 'List-Unsubscribe': `<${unsubscribe}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' } : undefined,
          }),
        );
        providerId = String(info.messageId ?? '');
      } else {
        providerId = `dev-mailbox:${row._id}`;
        this.logger.info({ to: row.toEmail, subject: rendered.subject }, 'email stored in dev mailbox');
      }

      await outbox.updateOne(
        { _id: row._id },
        { $set: { status: 'sent', sentAt: new Date(), lockedAt: null, providerMessageId: providerId, renderedSubject: rendered.subject, renderedHtml: rendered.html, renderedText: rendered.text, lastError: null } },
      );
    } catch (err) {
      const message = err instanceof CircuitOpenError ? 'email provider unavailable (circuit open)' : (err as Error).message;
      const dead = row.attempts >= row.maxAttempts;
      // 30 s, 1 min, 2 min, 4 min ... capped at 1 hour.
      const backoffSeconds = Math.min(30 * 2 ** (row.attempts - 1), 3600);
      this.logger.warn({ id: row._id, attempts: row.attempts, dead, err: message }, 'email delivery failed');
      await outbox
        .updateOne({ _id: row._id }, { $set: { status: dead ? 'dead' : 'failed', lockedAt: null, lastError: message.slice(0, 1000), nextAttemptAt: new Date(Date.now() + backoffSeconds * 1000) } })
        .catch((e) => this.logger.error({ err: e }, 'could not record email failure'));
    }
  }

  async ping(): Promise<{ ok: boolean; mode: 'dev' | 'smtp'; error?: string }> {
    if (!this.transport) return { ok: true, mode: 'dev' };
    try {
      await this.transport.verify();
      this.breaker.onSuccess();
      return { ok: true, mode: 'smtp' };
    } catch (err) {
      this.breaker.onFailure(err);
      return { ok: false, mode: 'smtp', error: (err as Error).message };
    }
  }

  close(): void {
    this.transport?.close();
  }
}
