import { fileURLToPath } from 'node:url';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import type { Database } from './database.js';

export async function runMigrations(database: Database) {
  const migrationDirectory = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../../../migrations'
  );
  const migrationFiles = readdirSync(migrationDirectory)
    .filter((fileName) => fileName.endsWith('.sql'))
    .sort();

  await database.query(
    'CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())'
  );

  const applied = await database.query<{ name: string }>('SELECT name FROM schema_migrations');
  const appliedNames = new Set(applied.rows.map((row) => row.name));

  for (const migrationFile of migrationFiles) {
    if (appliedNames.has(migrationFile)) {
      continue;
    }

    const migrationSql = readFileSync(path.join(migrationDirectory, migrationFile), 'utf8');

    await database.withTransaction(async (client) => {
      await client.query(migrationSql);
      await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [migrationFile]);
    });
  }
}
