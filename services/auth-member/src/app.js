import express from 'express';
import multer from 'multer';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import {
  LocalAesGcmProvider, LocalAuthProvider, masking,
  createSessionMiddleware, isLocked, recordLoginFailure, resetLoginFailures,
} from '@boblog/shared';

const VIEWS = path.join(path.dirname(fileURLToPath(import.meta.url)), '../views');

/**
 * auth-member — 회원 서비스이자 boblog 미니 웹사이트(BFF).
 * 브라우저는 이 서비스만 바라보고, 사진은 서버측에서 photo 서비스 내부 API로 위임한다.
 */
export function createAuthApp({ pool, redisClient, config }) {
  const app = express();
  const cryptoProvider = new LocalAesGcmProvider(config.masterKeyB64);
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

  app.set('view engine', 'ejs');
  app.set('views', VIEWS);
  app.use(express.urlencoded({ extended: false }));
  app.use(createSessionMiddleware({
    redisClient,
    name: 'boblog.member',
    secret: config.sessionSecret,
    idleMinutes: config.idleMinutes,
  }));

  const requireMember = (req, res, next) => {
    if (!req.session.member) return res.redirect('/login');
    next();
  };

  // ── 공개 페이지 ──────────────────────────────────────────────
  app.get('/', (req, res) => res.render('landing', { member: req.session.member }));

  app.get('/signup', (req, res) => res.render('signup', { error: null }));

  app.post('/signup', async (req, res, next) => {
    try {
      const { email, password, name, phone, birth } = req.body;
      if (!email?.includes('@') || !password || password.length < 8 || !name || !phone) {
        return res.status(400).render('signup', { error: '입력값을 확인하세요 (비밀번호 8자 이상, 전화번호 필수)' });
      }
      // 봉투암호화(제7조): 회원별 DEK 생성 → 전화·CI 암호화, DEK는 마스터키로 래핑 저장
      const dek = cryptoProvider.generateDek();
      const ci = crypto.randomBytes(32).toString('base64'); // 모의 본인확인값(CI)
      const passwordHash = await LocalAuthProvider.hashPassword(password);
      await pool.query(
        `INSERT INTO app.members (email, password_hash, name, phone_enc, ci_enc, birth_date, dek_wrapped, retention_until)
         VALUES ($1,$2,$3,$4,$5,$6,$7, (now() + interval '1 year')::date)`,
        [
          email.toLowerCase(), passwordHash, name,
          cryptoProvider.encryptField(dek, phone),
          cryptoProvider.encryptField(dek, ci),
          birth || null,
          cryptoProvider.wrapDek(dek),
        ],
      );
      res.redirect('/login?joined=1');
    } catch (e) {
      if (e.code === '23505') return res.status(409).render('signup', { error: '이미 가입된 이메일입니다' });
      next(e);
    }
  });

  app.get('/login', (req, res) => res.render('login', { error: null, joined: req.query.joined }));

  app.post('/login', async (req, res, next) => {
    try {
      const { email, password } = req.body;
      const { rows } = await pool.query(
        `SELECT id, name, password_hash, mfa_secret, failed_count, locked_until
           FROM app.members WHERE email = $1 AND status = 'active'`,
        [String(email ?? '').toLowerCase()],
      );
      const member = rows[0];
      const fail = (msg) => res.status(401).render('login', { error: msg, joined: null });

      if (!member) return fail('이메일 또는 비밀번호가 올바르지 않습니다');
      if (isLocked(member)) return fail('로그인 실패 초과로 계정이 잠겼습니다. 잠시 후 다시 시도하세요');

      if (!(await LocalAuthProvider.verifyPassword(password ?? '', member.password_hash))) {
        const r = await recordLoginFailure(pool, 'app.members', member.id, config.lockout);
        return fail(isLocked(r ?? {})
          ? `로그인 ${config.lockout.maxFails}회 실패 — 계정이 ${config.lockout.lockMinutes}분간 잠겼습니다`
          : '이메일 또는 비밀번호가 올바르지 않습니다');
      }

      await resetLoginFailures(pool, 'app.members', member.id);
      if (member.mfa_secret) {
        req.session.pendingMfa = { id: member.id, name: member.name };
        return res.redirect('/login/totp');
      }
      req.session.member = { id: member.id, name: member.name };
      res.redirect('/feed');
    } catch (e) {
      next(e);
    }
  });

  app.get('/login/totp', (req, res) => {
    if (!req.session.pendingMfa) return res.redirect('/login');
    res.render('totp', { error: null });
  });

  app.post('/login/totp', async (req, res, next) => {
    try {
      const pending = req.session.pendingMfa;
      if (!pending) return res.redirect('/login');
      const { rows } = await pool.query('SELECT mfa_secret FROM app.members WHERE id = $1', [pending.id]);
      if (!LocalAuthProvider.verifyTotp(req.body.token, rows[0]?.mfa_secret)) {
        return res.status(401).render('totp', { error: '인증 코드가 올바르지 않습니다' });
      }
      delete req.session.pendingMfa;
      req.session.member = { id: pending.id, name: pending.name };
      res.redirect('/feed');
    } catch (e) {
      next(e);
    }
  });

  app.get('/logout', (req, res) => req.session.destroy(() => res.redirect('/')));

  // ── 회원 전용 ────────────────────────────────────────────────
  app.get('/feed', requireMember, async (req, res, next) => {
    try {
      const photos = await photoApi(config, `/internal/photos?member_id=${req.session.member.id}`);
      res.render('feed', { member: req.session.member, photos, uploaded: req.query.uploaded, error: req.query.error });
    } catch (e) {
      next(e);
    }
  });

  app.post('/photos', requireMember, upload.single('photo'), async (req, res, next) => {
    try {
      if (!req.file) return res.redirect('/feed?error=file');
      const form = new FormData();
      form.set('member_id', String(req.session.member.id));
      form.set('caption', req.body.caption ?? '');
      if (req.body.lat && req.body.lng) {
        form.set('lat', req.body.lat);
        form.set('lng', req.body.lng);
      }
      form.set('photo', new Blob([req.file.buffer], { type: req.file.mimetype }), req.file.originalname);
      const r = await fetch(`${config.photoBaseUrl}/internal/photos`, {
        method: 'POST',
        headers: { 'x-service-token': config.serviceToken },
        body: form,
      });
      res.redirect(r.ok ? '/feed?uploaded=1' : '/feed?error=upload');
    } catch (e) {
      next(e);
    }
  });

  app.get('/photos/:id/file', requireMember, async (req, res, next) => {
    try {
      const r = await fetch(
        `${config.photoBaseUrl}/internal/photos/${encodeURIComponent(req.params.id)}/file?member_id=${req.session.member.id}`,
        { headers: { 'x-service-token': config.serviceToken } },
      );
      if (!r.ok) return res.status(r.status).send('not found');
      res.type(r.headers.get('content-type') ?? 'image/jpeg');
      res.send(Buffer.from(await r.arrayBuffer()));
    } catch (e) {
      next(e);
    }
  });

  app.get('/profile', requireMember, async (req, res, next) => {
    try {
      const { rows } = await pool.query(
        `SELECT email, name, phone_enc, birth_date, dek_wrapped, mfa_secret IS NOT NULL AS mfa_enrolled
           FROM app.members WHERE id = $1`, [req.session.member.id]);
      const m = rows[0];
      // 본인 화면에서도 기본은 마스킹 표시(표시제한 원칙)
      const dek = cryptoProvider.unwrapDek(m.dek_wrapped);
      const phone = cryptoProvider.decryptField(dek, m.phone_enc);
      res.render('profile', {
        member: req.session.member,
        email: masking.maskEmail(m.email),
        name: m.name,
        phone: masking.maskPhone(phone),
        birth: masking.maskBirth(m.birth_date),
        mfaEnrolled: m.mfa_enrolled,
      });
    } catch (e) {
      next(e);
    }
  });

  app.get('/mfa/setup', requireMember, (req, res) => {
    const secret = LocalAuthProvider.generateTotpSecret();
    req.session.mfaSetupSecret = secret;
    res.render('mfa_setup', {
      member: req.session.member,
      secret,
      uri: LocalAuthProvider.totpKeyUri(`member-${req.session.member.id}`, secret),
      error: null,
    });
  });

  app.post('/mfa/setup', requireMember, async (req, res, next) => {
    try {
      const secret = req.session.mfaSetupSecret;
      if (!secret || !LocalAuthProvider.verifyTotp(req.body.token, secret)) {
        return res.status(400).render('mfa_setup', {
          member: req.session.member,
          secret,
          uri: secret ? LocalAuthProvider.totpKeyUri(`member-${req.session.member.id}`, secret) : '',
          error: '코드가 올바르지 않습니다. 다시 시도하세요.',
        });
      }
      await pool.query('UPDATE app.members SET mfa_secret = $1 WHERE id = $2', [secret, req.session.member.id]);
      delete req.session.mfaSetupSecret;
      res.redirect('/profile');
    } catch (e) {
      next(e);
    }
  });

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    console.error('auth-member:', err);
    res.status(500).render('error', { message: '일시적인 오류가 발생했습니다', member: req.session?.member });
  });

  return app;
}

async function photoApi(config, pathname) {
  const r = await fetch(`${config.photoBaseUrl}${pathname}`, {
    headers: { 'x-service-token': config.serviceToken },
  });
  if (!r.ok) throw new Error(`photo service ${r.status}`);
  return r.json();
}
