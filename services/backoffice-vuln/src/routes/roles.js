import { Router } from 'express';
import { publishAuditEvent } from '../audit.js';

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
      await publishAuditEvent({ actor: req.session.vadmin.login_id, action: 'accounts.list', ip: req.ip });
      res.render('roles', { admins: rows });
    } catch (e) {
      next(e);
    }
  });

  return r;
}
