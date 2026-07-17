// 단순 SQL 마이그레이션 러너: migrations/*.sql을 순서대로 1회씩 실행
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import pg from 'pg';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const url = process.env.DATABASE_URL || 'postgres://boblog:boblog@localhost:5432/boblog';

const pool = new pg.Pool({ connectionString: url });
await pool.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
  name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
)`);

const files = (await readdir(path.join(root, 'migrations'))).filter((f) => f.endsWith('.sql')).sort();
for (const f of files) {
  const { rows } = await pool.query('SELECT 1 FROM schema_migrations WHERE name = $1', [f]);
  if (rows.length) continue;
  const sql = await readFile(path.join(root, 'migrations', f), 'utf8');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [f]);
    await client.query('COMMIT');
    console.log(`applied: ${f}`);
  } catch (e) {
    await client.query('ROLLBACK');
    console.error(`failed: ${f}`);
    throw e;
  } finally {
    client.release();
  }
}
await pool.end();
console.log('migrations complete');
