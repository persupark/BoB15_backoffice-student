/**
 * 실습 관찰용 HTTP 액세스 로그 미들웨어.
 *
 * 기록 대상: 메서드·경로·쿼리·상태·소요시간·IP·UA·응답크기·세션 actor
 * 기록 금지: 요청 바디(비밀번호 포함), 응답 본문(개인정보 포함 가능)
 */

const MAX = { path: 512, query: 512, ua: 256 };
const clip = (v, n) => (v == null ? null : String(v).slice(0, n));

export function createHttpLogger({ pool, stdout = true }) {
  return function httpLogger(req, res, next) {
    const startedAt = process.hrtime.bigint();

    res.on('finish', () => {
      const durationMs = Number((process.hrtime.bigint() - startedAt) / 1_000_000n);
      // actor는 응답 시점에 읽는다 — 이 미들웨어는 세션 파싱보다 앞에 있지만,
      // finish 시점에는 req.session이 채워져 있다.
      const actor = req.session?.vadmin?.login_id ?? null;
      const qs = req.originalUrl.includes('?') ? req.originalUrl.split('?').slice(1).join('?') : null;
      const bytes = Number(res.getHeader('content-length')) || null;

      if (stdout) {
        console.log(JSON.stringify({
          t: new Date().toISOString(),
          actor, method: req.method, path: req.path, query: qs,
          status: res.statusCode, ms: durationMs, ip: req.ip, bytes,
        }));
      }

      // 응답은 이미 나갔으므로 DB 기록 실패가 사용자 요청에 영향을 주지 않는다.
      pool.query(
        `INSERT INTO vuln.http_log (actor, method, path, query, status, duration_ms, ip, user_agent, bytes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
          actor, req.method, clip(req.path, MAX.path), clip(qs, MAX.query),
          res.statusCode, durationMs, req.ip, clip(req.get('user-agent'), MAX.ua), bytes,
        ],
      ).catch((e) => console.error('http_log 기록 실패:', e.message));
    });

    next();
  };
}
