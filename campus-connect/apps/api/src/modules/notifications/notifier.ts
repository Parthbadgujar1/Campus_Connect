import type { Deps } from '../../deps.js';
import { uuidv7 } from '../../infra/db/ids.js';
import type { Notification } from '../../infra/db/models.js';

// Creates in-app notifications and pushes them over the realtime channel.
//
// Notifications are a side effect: they never fail the action that caused them. If writing them
// fails, the error is logged and the like/comment/follow still succeeds. Recipients' preferences
// and blocks are respected, nobody is notified about their own actions, and notifications expire
// after 180 days (TTL index).

export type NotificationKind =
  | 'message' | 'mention' | 'comment' | 'reply' | 'like' | 'follow' | 'event' | 'deadline' | 'opportunity'
  | 'application' | 'space' | 'announcement' | 'moderation' | 'verification' | 'system' | 'security' | 'survey';

export interface NewNotification {
  userId: string;
  kind: NotificationKind;
  title: string;
  body?: string;
  /** In-app path such as /post/<id>. */
  link?: string;
  actorId?: string | null;
  entityType?: string;
  entityId?: string;
}

const LINK = /^\/[A-Za-z0-9/_?=&%.#-]*$/;
const REALTIME_FANOUT_LIMIT = 200;
const BATCH = 1000;

export class Notifier {
  constructor(private readonly deps: Deps) {}

  private toDoc(n: Omit<NewNotification, 'userId'> & { userId: string }): Notification {
    return {
      _id: uuidv7(),
      userId: n.userId,
      kind: n.kind,
      title: n.title.slice(0, 160),
      body: (n.body ?? '').slice(0, 500),
      link: n.link && LINK.test(n.link) ? n.link : null,
      actorId: n.actorId ?? null,
      entityType: n.entityType ?? null,
      entityId: n.entityId ?? null,
      readAt: null,
      createdAt: new Date(),
    };
  }

  private push(docs: Notification[]) {
    if (docs.length > REALTIME_FANOUT_LIMIT) return;
    for (const d of docs) {
      this.deps.realtime.toUser(d.userId, {
        type: 'notification.created',
        notification: { id: d._id, kind: d.kind, title: d.title, body: d.body, link: d.link, createdAt: d.createdAt.toISOString() },
      });
    }
  }

  async send(input: NewNotification | NewNotification[]): Promise<void> {
    const list = (Array.isArray(input) ? input : [input]).filter((n) => n.userId && n.userId !== n.actorId);
    if (!list.length) return;
    try {
      const db = this.deps.db;
      const recipients = await db
        .col('users')
        .find({ _id: { $in: [...new Set(list.map((n) => n.userId))] }, status: 'active' }, { projection: { 'notificationPrefs.inApp': 1 } })
        .toArray();
      const prefs = new Map(recipients.map((r) => [r._id, r.notificationPrefs?.inApp ?? {}]));
      const actors = [...new Set(list.map((n) => n.actorId).filter((x): x is string => Boolean(x)))];
      const blocks = actors.length
        ? await db.col('blocks').find({ $or: [{ blockerId: { $in: [...prefs.keys()] }, blockedId: { $in: actors } }, { blockerId: { $in: actors }, blockedId: { $in: [...prefs.keys()] } }] }, { projection: { _id: 1 } }).toArray()
        : [];
      const blocked = new Set(blocks.map((b) => b._id));
      const docs = list
        .filter((n) => prefs.has(n.userId) && prefs.get(n.userId)![n.kind] !== false)
        .filter((n) => !n.actorId || (!blocked.has(`${n.userId}:${n.actorId}`) && !blocked.has(`${n.actorId}:${n.userId}`)))
        .map((n) => this.toDoc(n));
      if (!docs.length) return;
      await db.col('notifications').insertMany(docs, { ordered: false });
      this.push(docs);
    } catch (err) {
      this.deps.logger.warn({ err: (err as Error).message, count: list.length }, 'notifications could not be created');
    }
  }

  /** One notification to every active member of a college (announcements, surveys). Never throws. */
  async broadcast(collegeId: string, n: Omit<NewNotification, 'userId'>, filter: { departmentId?: string; year?: number; roles?: string[] } = {}): Promise<number> {
    try {
      const cursor = this.deps.db.col('users').find(
        {
          collegeId,
          status: 'active',
          ...(n.actorId ? { _id: { $ne: n.actorId } } : {}),
          ...(filter.departmentId ? { 'profile.departmentId': filter.departmentId } : {}),
          ...(filter.year ? { 'profile.year': filter.year } : {}),
          ...(filter.roles?.length ? { role: { $in: filter.roles as never[] } } : {}),
          [`notificationPrefs.inApp.${n.kind}`]: { $ne: false },
        },
        { projection: { _id: 1 } },
      );
      let total = 0;
      let batch: Notification[] = [];
      for await (const u of cursor) {
        batch.push(this.toDoc({ ...n, userId: u._id }));
        if (batch.length >= BATCH) {
          await this.deps.db.col('notifications').insertMany(batch, { ordered: false });
          total += batch.length;
          batch = [];
        }
      }
      if (batch.length) {
        await this.deps.db.col('notifications').insertMany(batch, { ordered: false });
        total += batch.length;
        this.push(total <= REALTIME_FANOUT_LIMIT ? batch : []);
      }
      return total;
    } catch (err) {
      this.deps.logger.warn({ err: (err as Error).message }, 'broadcast notification failed');
      return 0;
    }
  }
}
