import { createHash } from 'node:crypto';
import type { Db } from 'mongodb';
import { SCHEMA } from './schema.js';

// Applies schema.ts to a database. Safe to run any number of times, from any number of API
// processes (each step is idempotent):
//   1. creates missing collections with their validator
//   2. updates the validator of existing collections (collMod) when it changed
//   3. creates missing indexes (MongoDB builds them without blocking reads and writes)
//   4. lists indexes that exist in the database but not in schema.ts, without dropping them
//      (dropping an index is a deliberate operation: do it by hand after checking)
// The applied version (a checksum of schema.ts) is recorded in schema_versions.

export interface MigrateResult {
  created: string[];
  validatorsUpdated: string[];
  indexesCreated: number;
  unknownIndexes: string[];
  checksum: string;
}

const canonical = (v: unknown): string => JSON.stringify(v, (_k, val) => (val && typeof val === 'object' && !Array.isArray(val) ? Object.fromEntries(Object.entries(val).sort(([a], [b]) => a.localeCompare(b))) : val));

export function schemaChecksum(): string {
  return createHash('sha256').update(canonical(SCHEMA)).digest('hex').slice(0, 16);
}

export async function applySchema(db: Db, log: (m: string) => void = () => undefined): Promise<MigrateResult> {
  const result: MigrateResult = { created: [], validatorsUpdated: [], indexesCreated: 0, unknownIndexes: [], checksum: schemaChecksum() };
  const existing = new Map((await db.listCollections({}, { nameOnly: false }).toArray()).map((c) => [c.name, c as { name: string; options?: { validator?: unknown } }]));

  for (const spec of SCHEMA) {
    const validatorOptions = spec.validator ? { validator: spec.validator, validationLevel: 'strict' as const, validationAction: 'error' as const } : {};
    const current = existing.get(spec.name);
    if (!current) {
      await db.createCollection(spec.name, validatorOptions);
      result.created.push(spec.name);
      log(`created ${spec.name}`);
    } else if (spec.validator && canonical(current.options?.validator) !== canonical(spec.validator)) {
      await db.command({ collMod: spec.name, ...validatorOptions });
      result.validatorsUpdated.push(spec.name);
      log(`updated validator ${spec.name}`);
    }

    const col = db.collection(spec.name);
    const have = await col.indexes();
    // Named indexes (all text indexes) are matched by name: MongoDB stores a text index's key in
    // an internal form ({ _fts: 'text', _ftsx: 1 }), not as written in the spec.
    const haveKeys = new Set(have.map((i) => canonical(i.key)));
    const haveNames = new Set(have.map((i) => i.name));
    const exists = (idx: (typeof spec.indexes)[number]) => (idx.options?.name ? haveNames.has(idx.options.name) : haveKeys.has(canonical(idx.key)));
    for (const idx of spec.indexes) {
      if (exists(idx)) continue;
      // A named index replacing an older one on the same fields (for example to make it
      // partial): drop the old one first, since MongoDB keeps one index per field list.
      if (idx.options?.name) {
        const old = have.find((i) => i.name !== '_id_' && i.name !== idx.options!.name && canonical(i.key) === canonical(idx.key));
        if (old?.name) {
          await col.dropIndex(old.name);
          log(`replaced index ${spec.name}.${old.name}`);
        }
      }
      await col.createIndex(idx.key, idx.options ?? {});
      result.indexesCreated += 1;
      log(`index ${spec.name} ${JSON.stringify(idx.key)}`);
    }
    const wantedKeys = new Set(spec.indexes.map((i) => canonical(i.key)));
    const wantedNames = new Set(spec.indexes.map((i) => i.options?.name).filter(Boolean));
    for (const i of have) {
      if (i.name === '_id_') continue;
      if (!wantedKeys.has(canonical(i.key)) && !wantedNames.has(i.name)) result.unknownIndexes.push(`${spec.name}.${i.name}`);
    }
  }

  await db.collection<{ _id: string; checksum: string; appliedAt: Date }>('schema_versions').updateOne(
    { _id: 'schema' },
    { $set: { checksum: result.checksum, appliedAt: new Date() } },
    { upsert: true },
  );
  return result;
}

/** True when the database already has this exact schema version (fast startup check). */
export async function schemaIsCurrent(db: Db): Promise<boolean> {
  const row = await db.collection<{ _id: string; checksum: string }>('schema_versions').findOne({ _id: 'schema' });
  return row?.checksum === schemaChecksum();
}
