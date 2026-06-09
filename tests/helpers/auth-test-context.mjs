import { newDb } from 'pg-mem';
import { randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { createRuntime } from '../../apps/api/dist/app-runtime.js';
import { createApp } from '../../apps/api/dist/platform/http/create-app.js';

export async function createAuthTestContext(configOverrides = {}) {
  const database = newDb({
    autoCreateForeignKeyIndices: true
  });
  const adapter = database.adapters.createPg();
  const pool = new adapter.Pool();
  const migrationDirectory = path.join(process.cwd(), 'apps', 'api', 'migrations');
  const migrationFiles = readdirSync(migrationDirectory)
    .filter((fileName) => fileName.endsWith('.sql'))
    .sort();

  for (const migrationFile of migrationFiles) {
    await pool.query(readFileSync(path.join(migrationDirectory, migrationFile), 'utf8'));
  }

  const runtime = await createRuntime({
    pool,
    skipMigrations: true,
    configOverrides: {
      NODE_ENV: 'test',
      SESSION_SECRET: 'test-session-secret-1234',
      ...configOverrides
    }
  });

  return {
    app: createApp(runtime),
    pool,
    runtime,
    async close() {
      await runtime.close();
    }
  };
}

export async function findUserByEmail(pool, email) {
  const result = await pool.query('SELECT id, email FROM users WHERE email = $1 LIMIT 1', [email]);
  return result.rows[0] ?? null;
}

export async function createMembershipSeed(
  pool,
  {
    organizationId,
    userId,
    role,
    status = 'active',
    managerMembershipId = null
  }
) {
  const membershipId = createSeedId('mem');

  await pool.query(
    `INSERT INTO memberships (id, organization_id, user_id, role, status, manager_membership_id)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [membershipId, organizationId, userId, role, status, managerMembershipId]
  );

  return membershipId;
}

function createSeedId(prefix) {
  return `${prefix}_${randomUUID().replace(/-/g, '')}`;
}
