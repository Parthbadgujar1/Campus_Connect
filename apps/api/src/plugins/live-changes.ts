// Live updates for every screen. After any successful change (POST, PUT, PATCH, DELETE), the
// area it touched ("feed", "events", "spaces"...) is announced over the realtime connection as
// { type: 'changed', collegeId, topics }. Screens showing that area fetch it again, so lists stay
// current without a refresh. Only the area's name is sent, never any content, so nobody learns
// anything they could not already see. Bursts are combined: at most one signal per college per
// second. Chats are left out: they have their own, finer-grained live events.

import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';

export type LiveTopic = 'feed' | 'events' | 'spaces' | 'hush' | 'market' | 'lostFound' | 'opportunities' | 'shelf' | 'news' | 'lectures' | 'surveys' | 'people' | 'status' | 'admin';

const ROUTES: Array<[RegExp, LiveTopic[]]> = [
  [/^\/v1\/(posts|comments)\b/, ['feed']],
  [/^\/v1\/events\b/, ['events']],
  [/^\/v1\/(spaces|discussions|discussion-replies)\b/, ['spaces']],
  [/^\/v1\/hush\b/, ['hush']],
  [/^\/v1\/listings\b/, ['market']],
  [/^\/v1\/lost-found\b/, ['lostFound']],
  [/^\/v1\/(opportunities|applications|teams)\b/, ['opportunities']],
  [/^\/v1\/(resources|subjects)\b/, ['shelf']],
  [/^\/v1\/announcements\b/, ['news']],
  [/^\/v1\/lectures\b/, ['lectures']],
  [/^\/v1\/(admin\/)?surveys\b/, ['surveys', 'admin']],
  [/^\/v1\/users\/[^/]+\/follow\b/, ['people']],
  [/^\/v1\/me\/profile\b/, ['people']],
  [/^\/v1\/status\b/, ['status']],
  [/^\/v1\/(feedback|reports|contact)\b/, ['admin']],
  [/^\/v1\/admin\b/, ['admin']],
];

// Approving or rejecting something in the admin queue changes that area too.
const QUEUE_TOPIC: Record<string, LiveTopic> = { space: 'spaces', event: 'events', opportunity: 'opportunities', resource: 'shelf', lecture: 'lectures' };
// Acting on a report can hide content anywhere.
const CONTENT: LiveTopic[] = ['feed', 'spaces', 'hush', 'market', 'lostFound', 'events', 'shelf', 'lectures'];

function topicsFor(request: FastifyRequest): LiveTopic[] {
  const url = request.routeOptions.url ?? '';
  const topics = new Set<LiveTopic>();
  for (const [pattern, list] of ROUTES) if (pattern.test(url)) list.forEach((t) => topics.add(t));
  if (url.startsWith('/v1/admin/queue/')) {
    const type = (request.params as { type?: string } | undefined)?.type;
    if (type && QUEUE_TOPIC[type]) topics.add(QUEUE_TOPIC[type]);
  }
  if (url.startsWith('/v1/admin/reports/action')) CONTENT.forEach((t) => topics.add(t));
  return [...topics];
}

const WRITE = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
// A change is announced within a tenth of a second; changes arriving in that moment share one signal.
const FLUSH_MS = 120;
// Live conversations (Hush, statuses) go out even sooner.
const FAST_TOPICS = new Set<LiveTopic>(['hush', 'status']);
const FAST_MS = 60;

const liveChanges: FastifyPluginAsync = async (app) => {
  const pending = new Map<string, Set<LiveTopic>>();
  let timer: NodeJS.Timeout | undefined;
  let timerDue = 0;

  const flush = () => {
    timer = undefined;
    timerDue = 0;
    for (const [collegeId, topics] of pending) app.deps.realtime.toAll({ type: 'changed', collegeId, topics: [...topics] });
    pending.clear();
  };

  app.addHook('onResponse', async (request, reply) => {
    if (!WRITE.has(request.method) || reply.statusCode >= 400) return;
    const collegeId = request.auth?.collegeId;
    if (!collegeId) return;
    const topics = topicsFor(request);
    if (!topics.length) return;
    const set = pending.get(collegeId) ?? new Set<LiveTopic>();
    topics.forEach((t) => set.add(t));
    pending.set(collegeId, set);
    const wait = topics.some((t) => FAST_TOPICS.has(t)) ? FAST_MS : FLUSH_MS;
    const due = Date.now() + wait;
    if (!timer || due < timerDue) {
      if (timer) clearTimeout(timer);
      timerDue = due;
      timer = setTimeout(flush, wait);
    }
  });

  app.addHook('onClose', async () => {
    if (timer) clearTimeout(timer);
  });
};

export default fp(liveChanges, { name: 'live-changes' });
