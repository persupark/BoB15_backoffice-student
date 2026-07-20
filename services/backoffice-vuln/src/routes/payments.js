import { Router } from 'express';
import { publishAuditEvent } from '../audit.js';

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
      await publishAuditEvent({ actor: req.session.vadmin.login_id, action: 'payments.list', ip: req.ip });
      res.render('payments', { payments: rows });
    } catch (e) {
      next(e);
    }
  });

  return r;
}
