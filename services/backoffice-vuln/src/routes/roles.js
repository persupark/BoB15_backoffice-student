import { Router } from 'express';

/** 권한관리 화면. */
export function createVulnRolesRouter({ pool }) {
  const r = Router();

  r.get('/roles', async (req, res, next) => {
    try {
      const { rows } = await pool.query(
        `SELECT a.id, a.login_id, a.name, a.created_at,
                (SELECT max(l.occurred_at) FROM vuln.access_log l
                  WHERE l.actor = a.login_id AND l.action = 'login.success') AS last_login
           FROM vuln.admin_users a ORDER BY a.id`,
      );
      await pool.query('INSERT INTO vuln.access_log (actor, action, ip) VALUES ($1, $2, $3)',
        [req.session.vadmin.login_id, 'accounts.list', req.ip]);
      res.render('roles', { admins: rows });
    } catch (e) {
      next(e);
    }
  });

  return r;
}
