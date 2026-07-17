import { Router } from 'express';

/** 구매기록 화면. */
export function createVulnPaymentsRouter({ pool }) {
  const r = Router();

  r.get('/payments', async (req, res, next) => {
    try {
      const { rows } = await pool.query(
        `SELECT p.id, p.item, p.amount, p.card_no, p.paid_at, m.email, m.name
           FROM vuln.payments p JOIN vuln.members m ON m.id = p.member_id
          ORDER BY p.paid_at DESC LIMIT 200`,
      );
      await pool.query('INSERT INTO vuln.access_log (actor, action, ip) VALUES ($1, $2, $3)',
        [req.session.vadmin.login_id, 'payments.list', req.ip]);
      res.render('payments', { payments: rows });
    } catch (e) {
      next(e);
    }
  });

  return r;
}
