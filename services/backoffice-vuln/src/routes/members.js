import { Router } from 'express';

/**
 * 진단 대상 백오피스 — 회원 개인정보 화면.
 *
 * 유지되는 시큐어 코딩:
 *   - 모든 쿼리 파라미터 바인딩 → SQL 인젝션 불가 (검색어 포함)
 *   - id는 Number()로 강제 후 유효성 검사 → 타입 혼동 차단
 *   - 뷰는 EJS 기본 이스케이프(<%= %>) → 저장형 XSS 불가
 *   - CSV는 수식 인젝션(=,+,-,@) 방지 처리
 */
export function createVulnMembersRouter({ pool }) {
  const r = Router();

  r.get('/members', async (req, res, next) => {
    try {
      const q = String(req.query.q ?? '').trim();
      // 파라미터 바인딩 — 검색어가 SQL로 해석되지 않는다.
      // LIKE 메타문자(%,_)는 ESCAPE로 무력화해 의도치 않은 전체 매칭을 막는다.
      const { rows } = await pool.query(
        `SELECT id, email, name, phone, birth_date, retention_until, created_at,
                (retention_until < current_date) AS overdue
           FROM vuln.members
          WHERE ($1 = '' OR email LIKE '%' || replace(replace($1, '%', '\\%'), '_', '\\_') || '%' ESCAPE '\\')
          ORDER BY id LIMIT 100`,
        [q],
      );
      await pool.query('INSERT INTO vuln.access_log (actor, action, ip) VALUES ($1, $2, $3)',
        [req.session.vadmin.login_id, 'members.list', req.ip]);
      res.render('members', { q, members: rows });
    } catch (e) {
      next(e);
    }
  });

  r.get('/members/:id', async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id < 1) {
        return res.status(400).render('error', { title: '잘못된 요청', message: '회원 번호가 올바르지 않습니다' });
      }
      const { rows } = await pool.query(
        `SELECT id, email, name, phone, ci_value, birth_date, retention_until, created_at,
                (retention_until < current_date) AS overdue
           FROM vuln.members WHERE id = $1`,
        [id],
      );
      if (!rows.length) return res.status(404).render('error', { title: '없음', message: '회원이 없습니다' });

      const payments = await pool.query(
        'SELECT id, item, amount, card_no, paid_at FROM vuln.payments WHERE member_id = $1 ORDER BY paid_at DESC',
        [id],
      );
      await pool.query('INSERT INTO vuln.access_log (actor, action, ip) VALUES ($1, $2, $3)',
        [req.session.vadmin.login_id, 'members.view', req.ip]);
      res.render('member_detail', { m: rows[0], payments: payments.rows });
    } catch (e) {
      next(e);
    }
  });

  r.post('/members/export', async (req, res, next) => {
    try {
      const { rows } = await pool.query(
        `SELECT id, email, name, phone, ci_value, birth_date, created_at
           FROM vuln.members ORDER BY id`,
      );
      await pool.query('INSERT INTO vuln.access_log (actor, action, ip) VALUES ($1, $2, $3)',
        [req.session.vadmin.login_id, 'members.export', req.ip]);
      const csv = [
        'id,email,name,phone,ci_value,birth_date,created_at',
        ...rows.map((m) => [
          m.id, m.email, m.name, m.phone ?? '', m.ci_value ?? '',
          m.birth_date?.toISOString?.().slice(0, 10) ?? '',
          m.created_at.toISOString(),
        ].map(csvCell).join(',')),
      ].join('\n');
      res.type('text/csv').attachment('members_all_plaintext.csv').send('﻿' + csv);
    } catch (e) {
      next(e);
    }
  });

  return r;
}

/**
 * CSV 셀 이스케이프 + 수식 인젝션 방지.
 * CSV를 연 스프레드시트에서 =cmd 같은 수식이 실행되지 않도록
 * 선행 특수문자를 무력화한다.
 */
function csvCell(value) {
  let s = String(value ?? '');
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  if (/[",\n\r]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}
