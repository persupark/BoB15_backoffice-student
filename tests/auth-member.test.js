import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createRedisClient } from '@boblog/shared';
import { createAuthApp } from '../services/auth-member/src/app.js';
import { createPhotoApp } from '../services/photo/src/app.js';
import { freshPool, baseConfig, TEST_REDIS_URL } from './helpers.js';

// 1x1 투명 PNG
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

describe('boblog 서비스(auth-member + photo BFF)', () => {
  let pool;
  let redisClient;
  let app;
  let photoServer;

  beforeAll(async () => {
    pool = await freshPool();
    redisClient = await createRedisClient(TEST_REDIS_URL);
    const photoApp = createPhotoApp({
      pool,
      config: {
        masterKeyB64: baseConfig.masterKeyB64,
        serviceToken: baseConfig.serviceToken,
        uploadDir: './data/test-uploads',
      },
    });
    photoServer = photoApp.listen(0);
    const photoPort = photoServer.address().port;
    app = createAuthApp({
      pool, redisClient,
      config: { ...baseConfig, photoBaseUrl: `http://127.0.0.1:${photoPort}` },
    });
  });

  afterAll(async () => {
    photoServer.close();
    await pool.end();
    await redisClient.quit();
  });

  const signup = (agent, email) => agent.post('/signup').type('form').send({
    email, password: 'Passw0rd!', name: '테스트회원', phone: '010-1111-2222',
  });

  it('가입 시 전화·CI는 암호문으로만 저장 — DB에 평문 부재 (제7조)', async () => {
    const agent = request.agent(app);
    const res = await signup(agent, 'member1@test.dev');
    expect(res.status).toBe(302);
    const { rows } = await pool.query(`SELECT phone_enc, ci_enc, dek_wrapped, password_hash FROM app.members WHERE email = 'member1@test.dev'`);
    expect(rows[0].phone_enc).toMatch(/^enc:v1:/);
    expect(rows[0].phone_enc).not.toContain('1111');
    expect(rows[0].ci_enc).toMatch(/^enc:v1:/);
    expect(rows[0].dek_wrapped).toMatch(/^wdek:v1:/);
    expect(rows[0].password_hash).toMatch(/^\$2/); // bcrypt
  });

  it('로그인 → 피드 접근, 미로그인은 리다이렉트 (제6조)', async () => {
    const anon = await request(app).get('/feed');
    expect(anon.status).toBe(302);

    const agent = request.agent(app);
    await signup(agent, 'member2@test.dev');
    const login = await agent.post('/login').type('form').send({ email: 'member2@test.dev', password: 'Passw0rd!' });
    expect(login.headers.location).toBe('/feed');
    const feed = await agent.get('/feed');
    expect(feed.status).toBe(200);
  });

  it('사진 업로드 e2e: BFF → photo 서비스 → 피드 노출', async () => {
    const agent = request.agent(app);
    await signup(agent, 'member3@test.dev');
    await agent.post('/login').type('form').send({ email: 'member3@test.dev', password: 'Passw0rd!' });

    const up = await agent.post('/photos')
      .field('caption', '지금 이 순간!')
      .field('lat', '37.5665').field('lng', '126.9780')
      .attach('photo', PNG, 'moment.png');
    expect(up.headers.location).toBe('/feed?uploaded=1');

    const feed = await agent.get('/feed');
    expect(feed.text).toContain('지금 이 순간!');
    expect(feed.text).toContain('위치 기록됨');

    const { rows } = await pool.query(`
      SELECT p.loc_enc FROM app.photos p
      JOIN app.members m ON m.id = p.member_id WHERE m.email = 'member3@test.dev'`);
    expect(rows[0].loc_enc).toMatch(/^enc:v1:/); // 위치도 암호화 저장
  });

  it('photo 내부 API는 서비스 토큰 없이는 401', async () => {
    const port = photoServer.address().port;
    const r = await fetch(`http://127.0.0.1:${port}/internal/photos?member_id=1`);
    expect(r.status).toBe(401);
  });

  it('로그인 5회 실패 → 잠금 (제6조)', async () => {
    const agent = request.agent(app);
    await signup(agent, 'locked@test.dev');
    for (let i = 0; i < 5; i++) {
      await request(app).post('/login').type('form').send({ email: 'locked@test.dev', password: 'nope!' });
    }
    const res = await request(app).post('/login').type('form')
      .send({ email: 'locked@test.dev', password: 'Passw0rd!' });
    expect(res.status).toBe(401);
    expect(res.text).toContain('잠');
  });
});
