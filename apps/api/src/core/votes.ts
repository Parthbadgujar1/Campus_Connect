import type { Mongo } from '../infra/db/mongo.js';
import type { VoteTarget } from '../infra/db/models.js';

// One vote per person per item (the vote document's _id is user:type:item), with -1 / +1 values
// and 0 meaning "remove my vote". The previous vote is read and replaced in one atomic operation,
// so the item's score changes by exactly the difference, even when someone taps twice quickly.

const TARGET: Record<VoteTarget, { collection: 'discussions' | 'discussion_replies' | 'hush_questions' | 'hush_answers'; field: 'score' | 'votesCount' }> = {
  discussion: { collection: 'discussions', field: 'score' },
  discussion_reply: { collection: 'discussion_replies', field: 'score' },
  hush_question: { collection: 'hush_questions', field: 'votesCount' },
  hush_answer: { collection: 'hush_answers', field: 'votesCount' },
};

/** Applies a vote and returns the item's new score. */
export async function applyVote(db: Mongo, userId: string, targetType: VoteTarget, targetId: string, value: -1 | 0 | 1): Promise<number> {
  const target = TARGET[targetType];
  return db.tx(async (session) => {
    const votes = db.col('votes');
    const id = `${userId}:${targetType}:${targetId}`;
    let previous = 0;
    if (value === 0) {
      const removed = await votes.findOneAndDelete({ _id: id }, { session });
      previous = removed?.value ?? 0;
    } else {
      const before = await votes.findOneAndUpdate(
        { _id: id },
        { $set: { value }, $setOnInsert: { userId, targetType, targetId, createdAt: new Date() } },
        { upsert: true, returnDocument: 'before', session },
      );
      previous = before?.value ?? 0;
    }
    const delta = value - previous;
    const col = db.raw<{ _id: string; score?: number; votesCount?: number }>(target.collection);
    if (delta !== 0) await col.updateOne({ _id: targetId }, { $inc: { [target.field]: delta } }, { session });
    const row = await col.findOne({ _id: targetId }, { projection: { [target.field]: 1 }, session });
    return Number(row?.[target.field] ?? 0);
  });
}

/** My votes on a set of items, as id -> -1 | 1. */
export async function myVotes(db: Mongo, userId: string, targetType: VoteTarget, ids: string[]): Promise<Map<string, number>> {
  if (!ids.length) return new Map();
  const rows = await db.col('votes').find({ _id: { $in: ids.map((i) => `${userId}:${targetType}:${i}`) } }, { projection: { targetId: 1, value: 1 } }).toArray();
  return new Map(rows.map((r) => [r.targetId, r.value]));
}
