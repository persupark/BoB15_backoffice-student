import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { LocalAuthProvider } from '@boblog/shared';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

export const TEST_MASTER_KEY = 'Ym9ibG9nLWRlbW8ta2V5IWJvYmxvZy1kZW1vLWtleSE=';
export const TEST_DB_URL = process.env.TEST_DATABASE_URL || 'postgres://boblog:boblog@localhost:5432/boblog_test';
export const TEST_REDIS_URL = process.env.TEST_REDIS_URL || 'redis://localhost:6379';

export const baseConfig = {
  masterKeyB64: TEST_MASTER_KEY,
  sessionSecret: 'test-secret',
  idleMinutes: 30,
  serviceToken: 'test-service-token',
  photoBaseUrl: 'http://127.0.0.1:1', // 기본값: 연결 불가(필요한 테스트에서 실제 포트로 교체)
  exportMaxRows: 500,
  lockout: { maxFails: 5, lockMinutes: 30 },
};

/** 테스트 DB 초기화: 스키마 드롭 후 001_init.sql 재적용 */
export async function freshPool() {
  const pool = new pg.Pool({ connectionString: TEST_DB_URL, max: 5 });
  await pool.query('DROP SCHEMA IF EXISTS app CASCADE');
  await pool.query('DROP TABLE IF EXISTS schema_migrations');
  const sql = await readFile(path.join(ROOT, 'migrations/001_init.sql'), 'utf8');
  await pool.query(sql);
  return pool;
}

/** 진단 대상(취약 백오피스)용 테스트 DB 초기화: vuln 스키마 관련 마이그레이션 재적용 */
export async function freshVulnPool() {
  const pool = new pg.Pool({ connectionString: TEST_DB_URL, max: 5 });
  await pool.query('DROP SCHEMA IF EXISTS vuln CASCADE');
  for (const f of ['migrations/002_vuln.sql', 'migrations/003_vuln_http_log.sql', 'migrations/004_vuln_access_log_ip.sql']) {
    await pool.query(await readFile(path.join(ROOT, f), 'utf8'));
  }
  return pool;
}

export async function createMember(pool, cryptoProvider, {
  email, name = '홍길동', phone = '010-1234-5678', ci = 'TEST-CI', password = 'Passw0rd!',
  retentionUntil = null,
}) {
  const dek = cryptoProvider.generateDek();
  const hash = await LocalAuthProvider.hashPassword(password);
  const { rows } = await pool.query(
    `INSERT INTO app.members (email, password_hash, name, phone_enc, ci_enc, dek_wrapped, retention_until)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
    [
      email, hash, name,
      cryptoProvider.encryptField(dek, phone),
      cryptoProvider.encryptField(dek, ci),
      cryptoProvider.wrapDek(dek),
      retentionUntil,
    ]);
  return rows[0].id;
}
