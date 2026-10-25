import type { Logger } from 'pino';
import type { Mongo } from './mongo.js';

// CampusConnect is one shared community: everyone sees everyone, in every section. Internally each
// account still belongs to a "community" record (it is what scopes feeds, chats and spaces), so the
// simplest way to make everything visible to everyone is for every account to share the same one.
// On start-up this folds any extra colleges left over from earlier versions into the first one, gives
// it the platform's name, and opens up posts that were limited to a department, year or class.

const KEEP = new Set(['colleges', 'audit_logs']);

export async function ensureSharedCommunity(db: Mongo, logger: Logger): Promise<void> {
  const colleges = db.col('colleges');
  const all = await colleges.find({}).sort({ createdAt: 1 }).toArray();
  if (!all.length) return; // created by the first sign-up
  const main = all.find((c) => c.status === 'active') ?? all[0]!;
  const now = new Date();

  await colleges.updateOne({ _id: main._id }, { $set: { name: 'CampusConnect', shortName: 'CampusConnect', city: '', state: '', status: 'active', updatedAt: now } });

  const others = all.filter((c) => c._id !== main._id);
  if (others.length) {
    const names = (await db.db.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name).filter((n) => !n.startsWith('system.') && !KEEP.has(n));
    for (const other of others) {
      let moved = 0;
      for (const name of names) {
        const col = db.raw(name);
        try {
          moved += (await col.updateMany({ collegeId: other._id }, { $set: { collegeId: main._id } })).modifiedCount;
        } catch (err) {
          if ((err as { code?: number }).code !== 11000) throw err;
          // A few records would clash with ones already in the shared community (same short code or
          // address): move what can move, and drop the exact duplicates.
          for (const doc of await col.find({ collegeId: other._id }).toArray()) {
            try {
              await col.updateOne({ _id: doc._id }, { $set: { collegeId: main._id } });
              moved++;
            } catch (e) {
              if ((e as { code?: number }).code !== 11000) throw e;
              if (name === 'departments' || name === 'subjects') await col.deleteOne({ _id: doc._id });
              else logger.warn({ collection: name, id: String(doc._id) }, 'left a record in its old college (it clashes with one in the shared community)');
            }
          }
        }
      }
      const people = await db.col('users').countDocuments({ collegeId: other._id });
      if (people) await colleges.updateOne({ _id: other._id }, { $set: { status: 'suspended', updatedAt: now } });
      else await colleges.deleteOne({ _id: other._id });
      logger.info({ from: other.name, records: moved }, 'merged a college into the shared community');
    }
  }

  // Posts limited to a department, year or division are visible to everyone now.
  const opened = await db.raw('posts').updateMany({ 'audience.type': { $in: ['department', 'year', 'division'] } }, { $set: { 'audience.type': 'college' } });
  if (opened.modifiedCount) logger.info({ count: opened.modifiedCount }, 'opened posts that were limited to a department, year or class');
}
