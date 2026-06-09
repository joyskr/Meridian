import { Pool } from 'pg';
import type { RuntimeConfig } from '../config/env.js';

export function createPool(config: RuntimeConfig) {
  return new Pool({
    connectionString: config.databaseUrl
  });
}
