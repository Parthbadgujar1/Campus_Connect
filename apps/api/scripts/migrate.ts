// Applies the MongoDB schema (collections, validators, indexes) from src/infra/db/schema.ts.
// Usage: npm run db:migrate --workspace=api        (MONGODB_DB=... to target another database)

import { MongoClient } from 'mongodb';
import { loadEnvFile, parseConfig } from '../src/config/env.js';
import { applySchema } from '../src/infra/db/migrate.js';

loadEnvFile();
const config = parseConfig();

const client = new MongoClient(config.db.url, { serverSelectionTimeoutMS: 5_000 });
try {
  await client.connect();
  const result = await applySchema(client.db(config.db.name), (m) => console.log(m));
  console.log(`schema ${result.checksum}: ${result.created.length} collections created, ${result.validatorsUpdated.length} validators updated, ${result.indexesCreated} indexes created`);
  if (result.unknownIndexes.length) console.log(`indexes not in schema.ts (left in place): ${result.unknownIndexes.join(', ')}`);
} catch (err) {
  console.error((err as Error).message);
  process.exitCode = 1;
} finally {
  await client.close();
}
