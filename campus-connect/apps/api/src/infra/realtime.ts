import { randomUUID } from 'node:crypto';
import { Redis } from 'ioredis';
import type { Logger } from 'pino';
import type { WebSocket } from 'ws';

// Realtime hub for chat and live notifications over WebSockets.
//   * clients subscribe to the chats they open; membership is checked on every subscribe
//   * events are fanned out through Redis pub/sub when available, so any number of API processes
//     can share one channel space; without Redis, delivery is per process and clients recover
//     missed events through the REST "since" endpoints after reconnecting
//   * heartbeats close dead connections; a slow client whose send buffer grows is disconnected
//     instead of letting its backlog eat server memory
// The database is always written first; realtime is only the delivery path.

export type RealtimeEvent =
  | { type: 'message.created'; chatId: string; message: unknown }
  | { type: 'message.deleted'; chatId: string; messageId: string }
  | { type: 'message.reactions'; chatId: string; messageId: string; reactions: unknown }
  | { type: 'message.response'; chatId: string; messageId: string; responses: unknown }
  | { type: 'chat.read'; chatId: string; userId: string; at: string }
  | { type: 'chat.updated'; chatId: string }
  | { type: 'typing'; chatId: string; userId: string; name: string }
  | { type: 'notification.created'; notification: unknown }
  | { type: 'flags.changed' };

interface Client {
  id: string;
  userId: string;
  name: string;
  socket: WebSocket;
  chats: Set<string>;
  alive: boolean;
  lastTypingAt: number;
}

interface Envelope {
  origin: string;
  scope: 'chat' | 'user' | 'all';
  target: string;
  event: RealtimeEvent;
  exceptUserId?: string;
}

const CHANNEL = 'cc:realtime';
const MAX_SOCKETS_PER_USER = 8;
const MAX_BUFFERED_BYTES = 1_000_000;

export type MembershipCheck = (userId: string, chatId: string) => Promise<boolean>;

export class RealtimeHub {
  private readonly instanceId = randomUUID();
  private readonly clients = new Map<string, Client>();
  private readonly byUser = new Map<string, Set<Client>>();
  private readonly byChat = new Map<string, Set<Client>>();
  private readonly pub?: Redis;
  private readonly sub?: Redis;
  private heartbeat?: NodeJS.Timeout;
  private membershipCheck: MembershipCheck = async () => false;

  constructor(redisUrl: string | undefined, private readonly logger: Logger) {
    if (redisUrl) {
      const opts = { lazyConnect: true, enableOfflineQueue: false, maxRetriesPerRequest: 1, connectTimeout: 2_000, retryStrategy: (t: number) => Math.min(t * 500, 10_000) };
      this.pub = new Redis(redisUrl, opts);
      this.sub = new Redis(redisUrl, { ...opts, enableOfflineQueue: true });
      this.pub.on('error', () => undefined);
      this.sub.on('error', () => undefined);
      this.sub.on('ready', () => {
        this.sub!.subscribe(CHANNEL).catch((err) => this.logger.warn({ err }, 'realtime subscribe failed'));
      });
      this.sub.on('message', (_channel, raw) => {
        try {
          this.deliverLocal(JSON.parse(raw) as Envelope);
        } catch (err) {
          this.logger.warn({ err }, 'bad realtime envelope');
        }
      });
      this.pub.connect().catch(() => undefined);
      this.sub.connect().catch(() => undefined);
    }
    this.heartbeat = setInterval(() => this.beat(), 25_000);
    this.heartbeat.unref();
  }

  setMembershipCheck(fn: MembershipCheck): void {
    this.membershipCheck = fn;
  }

  get distributed(): boolean {
    return this.pub?.status === 'ready' && this.sub?.status === 'ready';
  }

  attach(socket: WebSocket, user: { id: string; name: string }): void {
    const client: Client = { id: randomUUID(), userId: user.id, name: user.name, socket, chats: new Set(), alive: true, lastTypingAt: 0 };

    // Cap connections per person (many tabs or a reconnect loop): drop the oldest.
    const existing = this.byUser.get(user.id);
    if (existing && existing.size >= MAX_SOCKETS_PER_USER) {
      const oldest = existing.values().next().value;
      oldest?.socket.close(4008, 'too many connections');
    }

    this.clients.set(client.id, client);
    if (!this.byUser.has(user.id)) this.byUser.set(user.id, new Set());
    this.byUser.get(user.id)!.add(client);

    socket.on('pong', () => {
      client.alive = true;
    });
    socket.on('message', (raw) => {
      void this.onMessage(client, raw.toString()).catch((err) => this.logger.warn({ err }, 'realtime message error'));
    });
    socket.on('close', () => this.detach(client));
    socket.on('error', () => this.detach(client));
    this.send(client, { type: 'ready', connectionId: client.id, distributed: this.distributed });
  }

  private detach(client: Client): void {
    if (!this.clients.delete(client.id)) return;
    this.byUser.get(client.userId)?.delete(client);
    if (this.byUser.get(client.userId)?.size === 0) this.byUser.delete(client.userId);
    for (const chatId of client.chats) {
      this.byChat.get(chatId)?.delete(client);
      if (this.byChat.get(chatId)?.size === 0) this.byChat.delete(chatId);
    }
  }

  private async onMessage(client: Client, raw: string): Promise<void> {
    if (raw.length > 2_000) return;
    let msg: { type?: string; chatId?: string };
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    const chatId = typeof msg.chatId === 'string' && /^[0-9a-f-]{36}$/.test(msg.chatId) ? msg.chatId : undefined;
    switch (msg.type) {
      case 'ping':
        this.send(client, { type: 'pong', at: new Date().toISOString() });
        return;
      case 'subscribe':
        if (!chatId || client.chats.size >= 50) return;
        if (!(await this.membershipCheck(client.userId, chatId))) {
          this.send(client, { type: 'error', code: 'FORBIDDEN', chatId });
          return;
        }
        client.chats.add(chatId);
        if (!this.byChat.has(chatId)) this.byChat.set(chatId, new Set());
        this.byChat.get(chatId)!.add(client);
        this.send(client, { type: 'subscribed', chatId });
        return;
      case 'unsubscribe':
        if (!chatId) return;
        client.chats.delete(chatId);
        this.byChat.get(chatId)?.delete(client);
        return;
      case 'typing':
        if (!chatId || !client.chats.has(chatId)) return;
        if (Date.now() - client.lastTypingAt < 2_000) return; // throttle
        client.lastTypingAt = Date.now();
        this.toChat(chatId, { type: 'typing', chatId, userId: client.userId, name: client.name }, client.userId);
        return;
      default:
        return;
    }
  }

  toChat(chatId: string, event: RealtimeEvent, exceptUserId?: string): void {
    this.publish({ origin: this.instanceId, scope: 'chat', target: chatId, event, exceptUserId });
  }

  toUser(userId: string, event: RealtimeEvent): void {
    this.publish({ origin: this.instanceId, scope: 'user', target: userId, event });
  }

  toAll(event: RealtimeEvent): void {
    this.publish({ origin: this.instanceId, scope: 'all', target: '*', event });
  }

  private publish(envelope: Envelope): void {
    if (this.distributed) {
      this.pub!.publish(CHANNEL, JSON.stringify(envelope)).catch(() => this.deliverLocal(envelope));
      return;
    }
    this.deliverLocal(envelope);
  }

  private deliverLocal(envelope: Envelope): void {
    let targets: Iterable<Client>;
    if (envelope.scope === 'chat') targets = this.byChat.get(envelope.target) ?? [];
    else if (envelope.scope === 'user') targets = this.byUser.get(envelope.target) ?? [];
    else targets = this.clients.values();
    for (const client of targets) {
      if (envelope.exceptUserId && client.userId === envelope.exceptUserId) continue;
      this.send(client, envelope.event);
    }
  }

  private send(client: Client, payload: unknown): void {
    const socket = client.socket;
    if (socket.readyState !== socket.OPEN) return;
    if (socket.bufferedAmount > MAX_BUFFERED_BYTES) {
      socket.close(1013, 'client too slow');
      return;
    }
    socket.send(JSON.stringify(payload));
  }

  private beat(): void {
    for (const client of this.clients.values()) {
      if (!client.alive) {
        client.socket.terminate();
        this.detach(client);
        continue;
      }
      client.alive = false;
      try {
        client.socket.ping();
      } catch {
        this.detach(client);
      }
    }
  }

  stats() {
    return {
      connections: this.clients.size,
      users: this.byUser.size,
      chats: this.byChat.size,
      distributed: this.distributed,
      redisConfigured: Boolean(this.pub),
    };
  }

  async close(): Promise<void> {
    if (this.heartbeat) clearInterval(this.heartbeat);
    for (const client of this.clients.values()) client.socket.close(1012, 'server restarting');
    await Promise.allSettled([this.pub?.quit(), this.sub?.quit()]);
  }
}
