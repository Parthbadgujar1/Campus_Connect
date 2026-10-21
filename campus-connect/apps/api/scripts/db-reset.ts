// Drops and recreates the local development database, applies the schema and seeds it.
// Refuses to run in production, and only touches the campus_connect databases (never another
// project's database on the same server).
// Usage: npm run db:reset --workspace=api   (add -- --no-seed to skip the seed)

import { MongoClient } from 'mongodb';
import { loadEnvFile, parseConfig } from '../src/config/env.js';
import { applySchema } from '../src/infra/db/migrate.js';

loadEnvFile();
const config = parseConfig();

async function main() {
  if (config.isProd) throw new Error('db:reset is disabled in production');
  if (!/^campus_connect(_test)?$/.test(config.db.name)) throw new Error(`Refusing to reset "${config.db.name}": only campus_connect and campus_connect_test can be reset.`);
  const client = new MongoClient(config.db.url, { serverSelectionTimeoutMS: 5_000 });
  await client.connect();
  try {
    const db = client.db(config.db.name);
    await db.dropDatabase();
    const result = await applySchema(db);
    console.log(`database ${config.db.name} reset: ${result.created.length} collections, ${result.indexesCreated} indexes`);
  } finally {
    await client.close();
  }
  if (!process.argv.includes('--no-seed')) {
    const { seed } = await import('./seed.js');
    await seed(config);
  }
}

main().catch((err) => {
  console.error((err as Error).message ?? err);
  process.exit(1);
});
