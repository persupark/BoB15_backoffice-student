import express from 'express';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createSessionMiddleware } from '@boblog/shared';
import { createHttpLogger } from './http-log.js';
import { createVulnAuthRouter } from './routes/auth.js';
import { createVulnMembersRouter } from './routes/members.js';
import { createVulnAccessLogRouter } from './routes/access-log.js';
import { createVulnRolesRouter } from './routes/roles.js';
import { createVulnDestructionRouter } from './routes/destruction.js';
import { createVulnPaymentsRouter } from './routes/payments.js';

const VIEWS = path.join(path.dirname(fileURLToPath(import.meta.url)), '../views');

/**
 * backoffice-vuln — 진단 실습 대상 개인정보처리시스템.
 *
 * 유지되는 시큐어 코딩:
 *   - 모든 쿼리 파라미터 바인딩($1) → SQL 인젝션 불가
 *   - EJS 기본 이스케이프(<%= %>)만 사용 → XSS 불가 (<%- %> 금지)
 *   - 세션 쿠키 httpOnly + sameSite=lax → 세션 탈취·CSRF 완화
 *   - 에러 핸들러가 스택/쿼리를 노출하지 않음
 */
export function createVulnApp({ pool, redisClient, config }) {
  const app = express();
  const ctx = { pool, config };

  app.set('view engine', 'ejs');
  app.set('views', VIEWS);
  app.set('trust proxy', true);

  // 실습 관찰용 HTTP 액세스 로그. 모든 요청을 남기기 위해 라우팅/세션보다
  // 앞에 둔다(actor는 finish 시점에 읽음).
  if (config.httpLog !== false) {
    app.use(createHttpLogger({ pool, stdout: config.httpLogStdout !== false }));
  }

  app.use(express.urlencoded({ extended: false }));

  app.use(createSessionMiddleware({
    redisClient,
    name: 'boblog.vuln',
    secret: config.sessionSecret,
    idleMinutes: 60 * 12,
  }));

  app.use((req, res, next) => {
    res.locals.admin = req.session.vadmin ?? null;
    next();
  });

  app.use(createVulnAuthRouter(ctx));

  app.use((req, res, next) => {
    if (!req.session.vadmin) return res.redirect('/login');
    next();
  });

  app.get('/', async (req, res, next) => {
    try {
      const [members, expired] = await Promise.all([
        pool.query('SELECT count(*)::int AS c FROM vuln.members'),
        pool.query('SELECT count(*)::int AS c FROM vuln.members WHERE retention_until < current_date'),
      ]);
      res.render('dashboard', {
        stats: { members: members.rows[0].c, expired: expired.rows[0].c },
      });
    } catch (e) {
      next(e);
    }
  });

  app.use(createVulnMembersRouter(ctx));
  app.use(createVulnPaymentsRouter(ctx));
  app.use(createVulnRolesRouter(ctx));
  app.use(createVulnDestructionRouter(ctx));
  app.use(createVulnAccessLogRouter(ctx));

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    console.error('backoffice-vuln:', err); // 서버 로그에만 — 응답에는 내부 정보 미노출
    res.status(500).render('error', { title: '오류', message: '일시적인 오류가 발생했습니다' });
  });

  return app;
}

/** 데모 재현 전용 해시 함수 — 정상 코드에서 사용 금지. */
export const md5 = (s) => crypto.createHash('md5').update(String(s)).digest('hex');
