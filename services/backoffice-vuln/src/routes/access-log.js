import { Router } from 'express';

/** 접속기록 조회 화면. */
export function createVulnAccessLogRouter({ pool }) {
  const r = Router();

  r.get('/access-log', async (req, res, next) => {
    try {
      const { rows } = await pool.query(
        `SELECT actor, action, occurred_at, ip
           FROM vuln.access_log ORDER BY id DESC LIMIT 100`,
      );
      res.render('access_log', { logs: rows });
    } catch (e) {
      next(e);
    }
  });

  return r;
}
