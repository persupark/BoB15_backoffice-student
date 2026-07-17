import pg from 'pg';

export function createPool(url = process.env.DATABASE_URL || 'postgres://boblog:boblog@localhost:5432/boblog') {
  return new pg.Pool({ connectionString: url, max: 10 });
}
