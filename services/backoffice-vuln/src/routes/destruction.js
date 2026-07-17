import { Router } from 'express';

/** 파기 화면. */
export function createVulnDestructionRouter({ pool }) {
  const r = Router();

  r.get('/destruction', async (req, res, next) => {
    try {
      const { rows } = await pool.query(
        `SELECT id, email, name, retention_until FROM vuln.members
          WHERE retention_until < current_date ORDER BY retention_until LIMIT 100`,
      );
      res.render('destruction', { candidates: rows });
    } catch (e) {
      next(e);
    }
  });

  r.post('/destruction/:id', async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id < 1) {
        return res.status(400).render('error', { title: '잘못된 요청', message: '회원 번호가 올바르지 않습니다' });
      }
      await pool.query('INSERT INTO vuln.access_log (actor, action, ip) VALUES ($1, $2, $3)',
        [req.session.vadmin.login_id, 'members.destroy', req.ip]);
      res.redirect('/destruction');
    } catch (e) {
      next(e);
    }
  });

  return r;
}
