/**
 * 로그인 실패 잠금 (제6조): N회 실패 시 M분 잠금.
 * table 파라미터는 화이트리스트로 제한 — SQL 인젝션 방지.
 */
const TABLES = new Set(['app.members']);

export function isLocked(row) {
  return Boolean(row.locked_until && new Date(row.locked_until) > new Date());
}

export async function recordLoginFailure(pool, table, id, { maxFails = 5, lockMinutes = 30 } = {}) {
  assertTable(table);
  const { rows } = await pool.query(
    `UPDATE ${table}
       SET failed_count = failed_count + 1,
           locked_until = CASE WHEN failed_count + 1 >= $2
                               THEN now() + ($3 || ' minutes')::interval
                               ELSE locked_until END
     WHERE id = $1
     RETURNING failed_count, locked_until`,
    [id, maxFails, String(lockMinutes)],
  );
  return rows[0];
}

export async function resetLoginFailures(pool, table, id) {
  assertTable(table);
  await pool.query(`UPDATE ${table} SET failed_count = 0, locked_until = NULL WHERE id = $1`, [id]);
}

function assertTable(table) {
  if (!TABLES.has(table)) throw new Error(`lockout: unknown table ${table}`);
}
