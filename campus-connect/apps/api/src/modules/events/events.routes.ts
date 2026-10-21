import { createHmac, randomBytes } from 'node:crypto';
import type { FastifyPluginAsync } from 'fastify';
import type { Filter } from 'mongodb';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { audit } from '../../core/audit.js';
import { safeEqual } from '../../core/crypto.js';
import { Errors } from '../../core/errors.js';
import { isStaff, requireAuth } from '../../core/guards.js';
import { decodeCursor, encodeCursor, page, pageQuery } from '../../core/pagination.js';
import { contains, newerThan, olderThan } from '../../core/query.js';
import { cleanText, httpsUrl, idParam, optionalText, tags, tagsPatch, text, uuid } from '../../core/validation.js';
import { uuidv7 } from '../../infra/db/ids.js';
import type { CampusEvent, EventRsvp } from '../../infra/db/models.js';
import { limits } from '../../plugins/traffic.js';
import type { AuthContext } from '../../types/fastify.js';
import { assertOwnFiles, loadFileViews, type FileView } from '../files/files.service.js';
import { loadPeople } from '../users/people.js';

// /v1/events — campus events, RSVPs and check-in.
//
// Capacity is enforced by the database: a seat is taken with one conditional update
// (goingCount < capacity), and the collection validator refuses goingCount > capacity, so two
// people taking the last seat at the same moment cannot both get it: the second gets
// EVENT_FULL. Events created by students wait for staff approval.
// Check-in uses a code that changes every 30 seconds (HMAC of a per-event secret), so a
// screenshot of someone's QR code stops working almost immediately.

const CATEGORIES = ['hackathon', 'workshop', 'seminar', 'webinar', 'competition', 'cultural', 'sports', 'club', 'meetup', 'fest', 'placement', 'academic'] as const;
const CODE_WINDOW_SECONDS = 30;

const eventBody = z.object({
  title: text(3, 160),
  description: optionalText(5000),
  category: z.enum(CATEGORIES),
  organizerName: text(2, 120).optional(),
  spaceId: uuid.optional(),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date(),
  venue: text(2, 160),
  isOnline: z.boolean().default(false),
  onlineUrl: httpsUrl.optional(),
  capacity: z.number().int().min(1).max(100000),
  registrationDeadline: z.coerce.date().optional(),
  feeText: optionalText(60),
  hasCertificate: z.boolean().default(false),
  coverFileId: uuid.optional(),
  tags,
});

// Edits: same fields, all optional and without defaults (see tagsPatch in core/validation).
const eventPatch = eventBody.extend({ isOnline: z.boolean().optional(), hasCertificate: z.boolean().optional(), tags: tagsPatch }).partial();

function checkInCode(secret: string, userId: string, window: number): string {
  return createHmac('sha256', Buffer.from(secret, 'base64url')).update(`${userId}:${window}`).digest('base64url').slice(0, 10);
}

function icsEscape(s: string): string {
  return s.replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\r?\n/g, '\\n');
}
const icsDate = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

const rsvpId = (eventId: string, userId: string) => `${eventId}:${userId}`;

export const eventRoutes: FastifyPluginAsync = async (base) => {
  const app = base.withTypeProvider<ZodTypeProvider>();
  const { db } = app.deps;
  const events = () => db.col('events');
  const rsvps = () => db.col('event_rsvps');

  async function isSpaceManager(spaceId: string | null, userId: string): Promise<boolean> {
    if (!spaceId) return false;
    const m = await db.col('space_members').findOne({ _id: `${spaceId}:${userId}`, status: 'active', role: { $in: ['owner', 'moderator'] } }, { projection: { _id: 1 } });
    return Boolean(m);
  }

  async function loadEvent(auth: AuthContext, id: string) {
    const e = await events().findOne({ _id: id, collegeId: auth.collegeId });
    if (!e) throw Errors.notFound('This event');
    const manage = e.createdBy === auth.userId || isStaff(auth) || (await isSpaceManager(e.spaceId, auth.userId));
    if (e.status !== 'published' && e.status !== 'cancelled' && !manage) throw Errors.notFound('This event');
    const rsvp = await rsvps().findOne({ _id: rsvpId(e._id, auth.userId) });
    return { e, manage, rsvp };
  }

  /** Spaces and cover images for a set of events, in two queries. */
  async function extras(list: CampusEvent[]) {
    const [spaceRows, covers] = await Promise.all([
      db.col('spaces').find({ _id: { $in: list.map((e) => e.spaceId).filter((x): x is string => Boolean(x)) } }, { projection: { name: 1, slug: 1 } }).toArray(),
      loadFileViews(app.deps, list.map((e) => e.coverFileId)),
    ]);
    return { spaces: new Map(spaceRows.map((s) => [s._id, s])), covers };
  }

  function view(e: CampusEvent, manage: boolean, rsvp: EventRsvp | null | undefined, x: Awaited<ReturnType<typeof extras>>) {
    const space = e.spaceId ? x.spaces.get(e.spaceId) : undefined;
    const now = new Date();
    return {
      id: e._id,
      title: e.title,
      description: e.description,
      category: e.category,
      organizerName: e.organizerName,
      space: space ? { id: space._id, name: space.name, slug: space.slug } : null,
      cover: (e.coverFileId ? x.covers.get(e.coverFileId) : null) ?? (null as FileView | null),
      startsAt: e.startsAt.toISOString(),
      endsAt: e.endsAt.toISOString(),
      venue: e.venue,
      isOnline: e.isOnline,
      onlineUrl: rsvp?.status === 'going' || manage ? e.onlineUrl : null,
      capacity: e.capacity,
      goingCount: e.goingCount,
      interestedCount: e.interestedCount,
      spotsLeft: Math.max(0, e.capacity - e.goingCount),
      registrationDeadline: e.registrationDeadline?.toISOString() ?? null,
      registrationOpen: e.status === 'published' && (!e.registrationDeadline || e.registrationDeadline > now) && e.endsAt > now,
      feeText: e.feeText,
      hasCertificate: e.hasCertificate,
      tags: e.tags,
      status: e.status,
      myRsvp: rsvp?.status ?? null,
      checkedIn: Boolean(rsvp?.checkedInAt),
      canManage: manage,
    };
  }

  app.get(
    '/',
    {
      schema: {
        tags: ['events'],
        summary: 'Events at my college',
        querystring: pageQuery.extend({
          when: z.enum(['upcoming', 'past', 'mine', 'organizing']).default('upcoming'),
          category: z.enum(CATEGORIES).optional(),
          spaceId: uuid.optional(),
          q: z.string().trim().max(60).optional(),
        }),
      },
    },
    async (request) => {
      const auth = requireAuth(request);
      const { cursor, limit, when, category, spaceId, q } = request.query;
      const now = new Date();
      const asc = when === 'upcoming' || when === 'mine';
      const and: Filter<CampusEvent>[] = [{ collegeId: auth.collegeId }];
      if (when === 'upcoming') and.push({ status: { $in: ['published', 'cancelled'] }, endsAt: { $gt: now } });
      if (when === 'past') and.push({ status: 'published', endsAt: { $lte: now } });
      if (when === 'mine') {
        const mine = await rsvps().find({ userId: auth.userId }, { projection: { eventId: 1 } }).sort({ createdAt: -1 }).limit(500).toArray();
        and.push({ _id: { $in: mine.map((r) => r.eventId) }, endsAt: { $gt: new Date(now.getTime() - 30 * 86_400_000) } });
      }
      if (when === 'organizing') and.push({ createdBy: auth.userId });
      if (category) and.push({ category });
      if (spaceId) and.push({ spaceId });
      if (q) and.push({ $or: [{ title: contains(q) }, { tags: q.toLowerCase() }, { venue: contains(q) }] });
      const after = decodeCursor(cursor);
      and.push((asc ? newerThan('startsAt', after) : olderThan('startsAt', after)) as Filter<CampusEvent>);
      const rows = await events()
        .find({ $and: and })
        .sort(asc ? { startsAt: 1, _id: 1 } : { startsAt: -1, _id: -1 })
        .limit(limit + 1)
        .toArray();
      const { items, nextCursor } = page(rows, limit, (r) => encodeCursor(r.startsAt, r._id));
      const [mine, x] = await Promise.all([rsvps().find({ _id: { $in: items.map((e) => rsvpId(e._id, auth.userId)) } }).toArray(), extras(items)]);
      const rsvpBy = new Map(mine.map((r) => [r.eventId, r]));
      return { items: items.map((e) => view(e, e.createdBy === auth.userId || isStaff(auth), rsvpBy.get(e._id), x)), nextCursor };
    },
  );

  app.get('/:id', { schema: { tags: ['events'], summary: 'Event details', params: idParam } }, async (request) => {
    const auth = requireAuth(request);
    const { e, manage, rsvp } = await loadEvent(auth, request.params.id);
    // People I follow who are going.
    const follows = await db.col('follows').find({ followerId: auth.userId }, { projection: { followeeId: 1 } }).limit(2000).toArray();
    const friends = follows.length
      ? await rsvps().find({ eventId: e._id, status: 'going', userId: { $in: follows.map((f) => f.followeeId) } }, { projection: { userId: 1 } }).limit(5).toArray()
      : [];
    const [people, x] = await Promise.all([loadPeople(app.deps, [e.createdBy, ...friends.map((f) => f.userId)]), extras([e])]);
    return {
      ...view(e, manage, rsvp, x),
      createdBy: e.createdBy ? (people.get(e.createdBy) ?? null) : null,
      friendsGoing: friends.map((f) => people.get(f.userId)).filter(Boolean),
    };
  });

  app.post(
    '/',
    { config: { rateLimit: { max: 10, timeWindow: '1 day' } }, schema: { tags: ['events'], summary: 'Create an event (students: sent for approval)', body: eventBody } },
    async (request, reply) => {
      const auth = requireAuth(request);
      const b = request.body;
      if (b.endsAt <= b.startsAt) throw Errors.validation([{ field: 'endsAt', message: 'The end must be after the start.' }]);
      if (b.startsAt < new Date(Date.now() - 3600_000)) throw Errors.validation([{ field: 'startsAt', message: 'The start must be in the future.' }]);
      if (b.registrationDeadline && b.registrationDeadline > b.endsAt) throw Errors.validation([{ field: 'registrationDeadline', message: 'Registration must close before the event ends.' }]);
      if (b.isOnline && !b.onlineUrl) throw Errors.validation([{ field: 'onlineUrl', message: 'Add the meeting link for an online event.' }]);
      let organizer = b.organizerName ?? auth.displayName;
      if (b.spaceId) {
        const s = await db.col('spaces').findOne({ _id: b.spaceId, collegeId: auth.collegeId, status: 'active' }, { projection: { name: 1 } });
        if (!s || (!(await isSpaceManager(s._id, auth.userId)) && !isStaff(auth))) throw Errors.forbidden('Only the space owner or moderators can create its events.');
        organizer = b.organizerName ?? s.name;
      }
      if (b.coverFileId) await assertOwnFiles(app.deps, auth.userId, [b.coverFileId], ['event', 'post', 'other'], ['image']);
      const status = isStaff(auth) ? 'published' : 'pending';
      const now = new Date();
      const id = uuidv7();
      await events().insertOne({
        _id: id,
        collegeId: auth.collegeId,
        spaceId: b.spaceId ?? null,
        createdBy: auth.userId,
        organizerName: cleanText(organizer),
        title: cleanText(b.title),
        description: cleanText(b.description ?? ''),
        category: b.category,
        startsAt: b.startsAt,
        endsAt: b.endsAt,
        venue: cleanText(b.venue),
        isOnline: b.isOnline,
        onlineUrl: b.onlineUrl ?? null,
        capacity: b.capacity,
        goingCount: 0,
        interestedCount: 0,
        registrationDeadline: b.registrationDeadline ?? null,
        feeText: b.feeText ?? null,
        hasCertificate: b.hasCertificate,
        coverFileId: b.coverFileId ?? null,
        tags: b.tags,
        checkInSecret: randomBytes(32).toString('base64url'),
        status,
        createdAt: now,
        updatedAt: now,
      });
      if (status === 'pending') {
        await audit(db, { action: 'event.submit', actorId: auth.userId, collegeId: auth.collegeId, entityType: 'event', entityId: id, requestId: request.id });
      }
      return reply.status(201).send({ id, status, message: status === 'pending' ? 'Sent for approval. We will notify you when it is published.' : 'Your event is live.' });
    },
  );

  app.patch('/:id', { schema: { tags: ['events'], summary: 'Edit an event (organizers)', params: idParam, body: eventPatch } }, async (request) => {
    const auth = requireAuth(request);
    const { e, manage } = await loadEvent(auth, request.params.id);
    if (!manage) throw Errors.forbidden();
    const b = request.body;
    const startsAt = b.startsAt ?? e.startsAt;
    const endsAt = b.endsAt ?? e.endsAt;
    if (endsAt <= startsAt) throw Errors.validation([{ field: 'endsAt', message: 'The end must be after the start.' }]);
    if (b.capacity !== undefined && b.capacity < e.goingCount) {
      throw Errors.validation([{ field: 'capacity', message: `${e.goingCount} people are already going; capacity cannot be lower.` }]);
    }
    if (b.coverFileId) await assertOwnFiles(app.deps, auth.userId, [b.coverFileId], ['event', 'post', 'other'], ['image']);
    const set: Partial<CampusEvent> = { startsAt, endsAt, updatedAt: new Date() };
    if (b.title) set.title = cleanText(b.title);
    if (b.description !== undefined) set.description = cleanText(b.description);
    if (b.category) set.category = b.category;
    if (b.venue) set.venue = cleanText(b.venue);
    if (b.isOnline !== undefined) set.isOnline = b.isOnline;
    if (b.onlineUrl) set.onlineUrl = b.onlineUrl;
    if (b.capacity !== undefined) set.capacity = b.capacity;
    if (b.registrationDeadline) set.registrationDeadline = b.registrationDeadline;
    if (b.feeText !== undefined) set.feeText = b.feeText;
    if (b.hasCertificate !== undefined) set.hasCertificate = b.hasCertificate;
    if (b.tags) set.tags = b.tags;
    if (b.organizerName) set.organizerName = cleanText(b.organizerName);
    if (b.coverFileId) set.coverFileId = b.coverFileId;
    // The capacity check is repeated in the update itself, in case seats were taken meanwhile.
    const res = await events().updateOne({ _id: e._id, ...(b.capacity !== undefined ? { goingCount: { $lte: b.capacity } } : {}) }, { $set: set });
    if (!res.matchedCount) throw Errors.conflict('More people signed up while you were editing. Reload and try again.');
    if (b.startsAt || b.venue) {
      const going = await rsvps().find({ eventId: e._id }, { projection: { userId: 1 } }).toArray();
      await app.deps.notifier.send(going.map((g) => ({ userId: g.userId, kind: 'event' as const, title: `${e.title} was updated`, body: 'Check the new time and venue.', link: `/events/${e._id}`, actorId: auth.userId, entityType: 'event', entityId: e._id })));
    }
    return { status: 'saved' };
  });

  app.post('/:id/cancel', { schema: { tags: ['events'], summary: 'Cancel an event and tell everyone who signed up', params: idParam, body: z.object({ reason: optionalText(300) }) } }, async (request) => {
    const auth = requireAuth(request);
    const { e, manage } = await loadEvent(auth, request.params.id);
    if (!manage) throw Errors.forbidden();
    await db.tx(async (session) => {
      await events().updateOne({ _id: e._id }, { $set: { status: 'cancelled', updatedAt: new Date() } }, { session });
      await audit(db, { action: 'event.cancel', actorId: auth.userId, collegeId: auth.collegeId, entityType: 'event', entityId: e._id, requestId: request.id, meta: { reason: request.body.reason ?? null } }, session);
    });
    const people = await rsvps().find({ eventId: e._id }, { projection: { userId: 1 } }).toArray();
    await app.deps.notifier.send(people.map((p) => ({ userId: p.userId, kind: 'event' as const, title: `${e.title} was cancelled`, body: request.body.reason ?? '', link: `/events/${e._id}`, actorId: auth.userId, entityType: 'event', entityId: e._id })));
    return { status: 'cancelled' };
  });

  app.put(
    '/:id/rsvp',
    { config: limits.write, schema: { tags: ['events'], summary: 'RSVP: going or interested', params: idParam, body: z.object({ status: z.enum(['going', 'interested']) }) } },
    async (request) => {
      const auth = requireAuth(request);
      const { e, rsvp } = await loadEvent(auth, request.params.id);
      const status = request.body.status;
      if (e.status !== 'published') throw Errors.conflict('This event is not taking RSVPs.');
      if (e.endsAt <= new Date()) throw Errors.conflict('This event has ended.');
      if (status === 'going' && e.registrationDeadline && e.registrationDeadline < new Date()) throw Errors.conflict('Registration for this event has closed.');
      if (rsvp?.status !== status) {
        await db.tx(async (session) => {
          if (status === 'going') {
            // Take a seat only if one is left; this single update is what prevents over-booking.
            const seat = await events().updateOne(
              { _id: e._id, $expr: { $lt: ['$goingCount', '$capacity'] } },
              { $inc: { goingCount: 1, ...(rsvp?.status === 'interested' ? { interestedCount: -1 } : {}) } },
              { session },
            );
            if (!seat.modifiedCount) throw Errors.eventFull();
          } else {
            await events().updateOne({ _id: e._id }, { $inc: { interestedCount: 1, ...(rsvp?.status === 'going' ? { goingCount: -1 } : {}) } }, { session });
          }
          const now = new Date();
          await rsvps().updateOne(
            { _id: rsvpId(e._id, auth.userId) },
            { $set: { status, updatedAt: now }, $setOnInsert: { eventId: e._id, userId: auth.userId, checkedInAt: null, createdAt: now } },
            { upsert: true, session },
          );
        });
      }
      const c = await events().findOne({ _id: e._id }, { projection: { goingCount: 1, interestedCount: 1, capacity: 1 } });
      return { myRsvp: status, goingCount: c?.goingCount ?? 0, interestedCount: c?.interestedCount ?? 0, spotsLeft: Math.max(0, (c?.capacity ?? 0) - (c?.goingCount ?? 0)) };
    },
  );

  app.delete('/:id/rsvp', { config: limits.write, schema: { tags: ['events'], summary: 'Remove my RSVP', params: idParam } }, async (request) => {
    const auth = requireAuth(request);
    const e = await events().findOne({ _id: request.params.id, collegeId: auth.collegeId }, { projection: { _id: 1 } });
    if (!e) throw Errors.notFound('This event');
    // People who already checked in keep their record (it is their attendance).
    const removed = await rsvps().findOneAndDelete({ _id: rsvpId(e._id, auth.userId), checkedInAt: null });
    if (removed) await events().updateOne({ _id: e._id }, { $inc: removed.status === 'going' ? { goingCount: -1 } : { interestedCount: -1 } });
    const c = await events().findOne({ _id: e._id }, { projection: { goingCount: 1, capacity: 1 } });
    return { myRsvp: null, goingCount: c?.goingCount ?? 0, spotsLeft: Math.max(0, (c?.capacity ?? 0) - (c?.goingCount ?? 0)) };
  });

  app.get(
    '/:id/attendees',
    { schema: { tags: ['events'], summary: 'Who signed up (organizers)', params: idParam, querystring: pageQuery.extend({ status: z.enum(['going', 'interested']).default('going') }) } },
    async (request) => {
      const auth = requireAuth(request);
      const { e, manage } = await loadEvent(auth, request.params.id);
      if (!manage) throw Errors.forbidden();
      const after = decodeCursor(request.query.cursor);
      const rows = await rsvps()
        .find({
          eventId: e._id,
          status: request.query.status,
          ...(after ? { $or: [{ createdAt: { $gt: new Date(after.at) } }, { createdAt: new Date(after.at), userId: { $gt: after.id } }] } : {}),
        })
        .sort({ createdAt: 1, userId: 1 })
        .limit(request.query.limit + 1)
        .toArray();
      const { items, nextCursor } = page(rows, request.query.limit, (r) => encodeCursor(r.createdAt, r.userId));
      const people = await loadPeople(app.deps, items.map((r) => r.userId));
      return {
        items: items.filter((r) => people.has(r.userId)).map((r) => ({ ...people.get(r.userId)!, checkedInAt: r.checkedInAt?.toISOString() ?? null })),
        nextCursor,
      };
    },
  );

  app.get('/:id/check-in-code', { schema: { tags: ['events'], summary: 'My rotating check-in QR code', params: idParam } }, async (request) => {
    const auth = requireAuth(request);
    const { e, rsvp } = await loadEvent(auth, request.params.id);
    if (rsvp?.status !== 'going') throw Errors.forbidden('RSVP as going to get a check-in code.');
    const window = Math.floor(Date.now() / 1000 / CODE_WINDOW_SECONDS);
    const code = checkInCode(e.checkInSecret, auth.userId, window);
    return {
      qr: `cc-checkin:${e._id}:${auth.userId}:${code}`,
      code,
      expiresAt: new Date((window + 1) * CODE_WINDOW_SECONDS * 1000).toISOString(),
      checkedIn: Boolean(rsvp.checkedInAt),
    };
  });

  app.post(
    '/:id/check-in',
    { config: { rateLimit: { max: 120, timeWindow: '1 minute' } }, schema: { tags: ['events'], summary: 'Check someone in by scanning their code (organizers)', params: idParam, body: z.object({ qr: z.string().max(200) }) } },
    async (request) => {
      const auth = requireAuth(request);
      const { e, manage } = await loadEvent(auth, request.params.id);
      if (!manage) throw Errors.forbidden();
      const m = /^cc-checkin:([0-9a-f-]{36}):([0-9a-f-]{36}):([A-Za-z0-9_-]{10})$/.exec(request.body.qr);
      if (!m || m[1] !== e._id) throw Errors.validation([{ field: 'qr', message: 'This code is not for this event.' }]);
      const [, , userId, code] = m;
      const window = Math.floor(Date.now() / 1000 / CODE_WINDOW_SECONDS);
      // Accept the current and the previous window, for clock drift and slow scanners.
      const valid = [window, window - 1].some((w) => safeEqual(code!, checkInCode(e.checkInSecret, userId!, w)));
      if (!valid) throw Errors.gone('This code has expired. Ask them to refresh it.');
      const id = rsvpId(e._id, userId!);
      await rsvps().updateOne({ _id: id, status: 'going', checkedInAt: null }, { $set: { checkedInAt: new Date(), updatedAt: new Date() } });
      const row = await rsvps().findOne({ _id: id, status: 'going' });
      if (!row?.checkedInAt) throw Errors.notFound('This person has not RSVPed as going');
      const people = await loadPeople(app.deps, [userId]);
      return { person: people.get(userId!) ?? null, checkedInAt: row.checkedInAt.toISOString() };
    },
  );

  app.get('/:id/calendar.ics', { schema: { tags: ['events'], summary: 'Add to calendar (iCalendar file)', params: idParam } }, async (request, reply) => {
    const auth = requireAuth(request);
    const { e } = await loadEvent(auth, request.params.id);
    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//CampusConnect//Events//EN',
      'BEGIN:VEVENT',
      `UID:${e._id}@campusconnect`,
      `DTSTAMP:${icsDate(new Date())}`,
      `DTSTART:${icsDate(e.startsAt)}`,
      `DTEND:${icsDate(e.endsAt)}`,
      `SUMMARY:${icsEscape(e.title)}`,
      `LOCATION:${icsEscape(e.venue)}`,
      `DESCRIPTION:${icsEscape(e.description.slice(0, 1000))}`,
      `URL:${app.deps.config.webUrl}/events/${e._id}`,
      e.status === 'cancelled' ? 'STATUS:CANCELLED' : 'STATUS:CONFIRMED',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');
    reply.header('content-type', 'text/calendar; charset=utf-8');
    reply.header('content-disposition', `attachment; filename="event-${e._id}.ics"`);
    return ics;
  });
};
