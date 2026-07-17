// 진단 실습 대상 백오피스용 시드 데이터.
// 데이터는 전부 가명·합성(faker). 실개인정보 절대 사용 금지.
import crypto from 'node:crypto';
import { fakerKO as faker } from '@faker-js/faker';
import { createPool } from '@boblog/shared';

const MEMBER_COUNT = Number(process.env.SEED_VULN_MEMBERS || 50);
const EXPIRED_COUNT = 8;
const PASSWORD = 'Passw0rd!';

/** 데모 재현 전용 해시 함수 — 정상 코드에서 절대 사용 금지. */
const md5 = (s) => crypto.createHash('md5').update(s).digest('hex');

const pool = createPool();

const existing = await pool.query('SELECT count(*)::int AS c FROM vuln.members');
if (existing.rows[0].c > 0) {
  console.log(`vuln: 이미 회원 ${existing.rows[0].c}명이 있습니다. 건너뜁니다. (초기화: make reset-db)`);
  await pool.end();
  process.exit(0);
}

console.log(`vuln 시드 시작: 회원 ${MEMBER_COUNT}명…`);

const pwMd5 = md5(PASSWORD);
for (let i = 0; i < MEMBER_COUNT; i++) {
  const expired = i < EXPIRED_COUNT;
  const { rows } = await pool.query(
    `INSERT INTO vuln.members (email, password_md5, name, phone, ci_value, birth_date, retention_until)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
    [
      `user${i + 1}@${faker.internet.domainName()}`,
      pwMd5,
      faker.person.fullName(),
      `010-${faker.string.numeric(4)}-${faker.string.numeric(4)}`, // 평문
      faker.string.alphanumeric(44),                                // 평문 CI
      faker.date.birthdate({ min: 18, max: 45, mode: 'age' }),
      (expired ? faker.date.past({ years: 1 }) : faker.date.future({ years: 1 })).toISOString().slice(0, 10),
    ],
  );

  if (Math.random() < 0.5) {
    await pool.query(
      `INSERT INTO vuln.payments (member_id, item, amount, card_no, paid_at) VALUES ($1,$2,$3,$4,$5)`,
      [
        rows[0].id,
        faker.helpers.arrayElement(['프리미엄 필터', '스티커팩', 'boblog 플러스 1개월', '프로필 뱃지']),
        faker.number.int({ min: 1000, max: 15000 }),
        `4${faker.string.numeric(15)}`, // 평문 카드번호 전체
        faker.date.recent({ days: 60 }),
      ],
    );
  }
}

const DEMO_ADMINS = [
  { loginId: 'vadmin',  name: '정운영',    createdDaysAgo: 0,   lastLoginDaysAgo: 1 },
  { loginId: 'vstaff',  name: '한직원',    createdDaysAgo: 0,   lastLoginDaysAgo: 4 },
  { loginId: 'vpart',   name: '외주업체',  createdDaysAgo: 0,   lastLoginDaysAgo: 15 },
  { loginId: 'vstaff2', name: '김전직원',  createdDaysAgo: 400, lastLoginDaysAgo: 380 },
  { loginId: 'vstaff3', name: '이휴면',    createdDaysAgo: 200, lastLoginDaysAgo: null },
  { loginId: 'vpart2',  name: '외주업체2', createdDaysAgo: 300, lastLoginDaysAgo: 290 },
  { loginId: 'vpart3',  name: '외주업체3', createdDaysAgo: 20,  lastLoginDaysAgo: 5 },
];
for (const a of DEMO_ADMINS) {
  await pool.query(
    `INSERT INTO vuln.admin_users (login_id, password_md5, name, created_at)
     VALUES ($1, $2, $3, now() - make_interval(days => $4))
     ON CONFLICT (login_id) DO NOTHING`,
    [a.loginId, pwMd5, a.name, a.createdDaysAgo]);
  if (a.lastLoginDaysAgo != null) {
    await pool.query(
      `INSERT INTO vuln.access_log (actor, action, occurred_at, ip)
       VALUES ($1, 'login.success', now() - make_interval(days => $2), '203.0.113.10')`,
      [a.loginId, a.lastLoginDaysAgo]);
  }
}

const c = await pool.query(`
  SELECT (SELECT count(*) FROM vuln.members)  AS members,
         (SELECT count(*) FROM vuln.payments) AS payments`);
console.log('vuln 시드 완료:', c.rows[0]);
console.log(`
── 진단 대상 백오피스(3200) 데모 계정 — 비밀번호 공통: ${PASSWORD} ──────────
  ${DEMO_ADMINS.map((a) => a.loginId).join(' / ')}
`);
await pool.end();
