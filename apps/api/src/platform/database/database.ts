import type { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';

export type Queryable = {
  query<Result extends QueryResultRow = QueryResultRow>(
    queryText: string,
    values?: unknown[]
  ): Promise<QueryResult<Result>>;
};

export type Database = Queryable & {
  withTransaction<Result>(callback: (client: Queryable) => Promise<Result>): Promise<Result>;
  close(): Promise<void>;
};

export function createDatabase(pool: Pool): Database {
  return {
    query(queryText, values) {
      if (values) {
        return pool.query(queryText, values);
      }

      return pool.query(queryText);
    },
    async withTransaction(callback) {
      const client = await pool.connect();

      try {
        await client.query('BEGIN');
        const result = await callback(wrapClient(client));
        await client.query('COMMIT');
        return result;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },
    async close() {
      await pool.end();
    }
  };
}

function wrapClient(client: PoolClient): Queryable {
  return {
    query(queryText, values) {
      if (values) {
        return client.query(queryText, values);
      }

      return client.query(queryText);
    }
  };
}
