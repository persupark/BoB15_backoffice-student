import { Router } from 'express';
import { md5 } from '../app.js';

/**
 * 진단 대상 백오피스 인증.
 *
 * 유지되는 시큐어 코딩: 파라미터 바인딩, 계정 존재 여부를 드러내지 않는 동일 오류 메시지
 */
export function createVulnAuthRouter({ pool }) {
  const r = Router();

  r.get('/login', (req, res) => res.render('login', { error: null }));

  r.post('/login', async (req, res, next) => {
    try {
      const loginId = String(req.body.login_id ?? '').trim();
      const password = String(req.body.password ?? '');

      // 파라미터 바인딩 — SQL 인젝션 불가 (' OR 1=1 -- 를 넣어도 문자열로만 취급)
      const { rows } = await pool.query(
        'SELECT id, login_id, name, password_md5 FROM vuln.admin_users WHERE login_id = $1',
        [loginId],
      );
      const admin = rows[0];

      if (!admin || admin.password_md5 !== md5(password)) {
        return res.status(401).render('login', { error: '아이디 또는 비밀번호가 올바르지 않습니다' });
      }

      req.session.vadmin = { id: admin.id, login_id: admin.login_id, name: admin.name };

      await pool.query('INSERT INTO vuln.access_log (actor, action, ip) VALUES ($1, $2, $3)',
        [admin.login_id, 'login.success', req.ip]);

      res.redirect('/');
    } catch (e) {
      next(e);
    }
  });

  r.post('/logout', async (req, res) => {
    const actor = req.session.vadmin?.login_id;
    if (actor) {
      try {
        await pool.query('INSERT INTO vuln.access_log (actor, action, ip) VALUES ($1, $2, $3)',
          [actor, 'logout', req.ip]);
      } catch { /* 로그 기록 실패는 무시 */ }
    }
    req.session.destroy(() => res.redirect('/login'));
  });

  return r;
}
