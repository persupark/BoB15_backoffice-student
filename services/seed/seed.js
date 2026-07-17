// 가명·합성 데이터 시드 — 실개인정보를 절대 사용하지 않는다.
import { fakerKO as faker } from '@faker-js/faker';
import { createPool, LocalAesGcmProvider, LocalAuthProvider, masking } from '@boblog/shared';

const MEMBER_COUNT = Number(process.env.SEED_MEMBERS || 200);
const EXPIRED_COUNT = 5; // 보유기간 경과(파기 배치 데모용)
const PASSWORD = 'Passw0rd!';

const pool = createPool();
const crypto = new LocalAesGcmProvider(process.env.MASTER_KEY_B64 || 'Ym9ibG9nLWRlbW8ta2V5IWJvYmxvZy1kZW1vLWtleSE=');

const existing = await pool.query('SELECT count(*)::int AS c FROM app.members');
if (existing.rows[0].c > 0) {
  console.log(`이미 회원 ${existing.rows[0].c}명이 있습니다. 시드를 건너뜁니다. (초기화: make reset-db)`);
  process.exit(0);
}

const passwordHash = await LocalAuthProvider.hashPassword(PASSWORD);
console.log(`시드 시작: 회원 ${MEMBER_COUNT}명 (만료 ${EXPIRED_COUNT}명 포함)…`);

const memberIds = [];
for (let i = 0; i < MEMBER_COUNT; i++) {
  const dek = crypto.generateDek();
  const name = faker.person.fullName();
  const email = `user${i + 1}@${faker.internet.domainName()}`;
  const phone = `010-${faker.string.numeric(4)}-${faker.string.numeric(4)}`;
  const ci = faker.string.alphanumeric(44);
  const expired = i < EXPIRED_COUNT;
  const { rows } = await pool.query(
    `INSERT INTO app.members
       (email, password_hash, name, phone_enc, ci_enc, birth_date, dek_wrapped, retention_until)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
    [
      email, passwordHash, name,
      crypto.encryptField(dek, phone),
      crypto.encryptField(dek, ci),
      faker.date.birthdate({ min: 18, max: 45, mode: 'age' }),
      crypto.wrapDek(dek),
      expired
        ? faker.date.past({ years: 1 }).toISOString().slice(0, 10)
        : faker.date.future({ years: 1 }).toISOString().slice(0, 10),
    ],
  );
  const id = rows[0].id;
  memberIds.push(id);

  // 사진 메타데이터(파일은 공용 placeholder)
  const photoCount = faker.number.int({ min: 0, max: 4 });
  const dekForLoc = dek;
  for (let p = 0; p < photoCount; p++) {
    const withLoc = Math.random() < 0.5;
    await pool.query(
      `INSERT INTO app.photos (member_id, file_path, caption, loc_enc, taken_at)
       VALUES ($1,$2,$3,$4,$5)`,
      [
        id, 'placeholder.png',
        faker.lorem.sentence({ min: 2, max: 5 }),
        withLoc ? crypto.encryptField(dekForLoc, `${faker.location.latitude()},${faker.location.longitude()}`) : null,
        faker.date.recent({ days: 30 }),
      ],
    );
  }

  // 결제(모의 카드)
  if (Math.random() < 0.4) {
    const card = `4${faker.string.numeric(15)}`;
    await pool.query(
      `INSERT INTO app.payments (member_id, item, amount, card_enc, card_last4, paid_at)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [
        id,
        faker.helpers.arrayElement(['프리미엄 필터', '스티커팩', 'boblog 플러스 1개월', '프로필 뱃지']),
        faker.number.int({ min: 1000, max: 15000 }),
        crypto.encryptField(dek, card),
        card.slice(-4),
        faker.date.recent({ days: 60 }),
      ],
    );
  }
}

// 친구 관계
for (let i = 0; i < MEMBER_COUNT; i++) {
  const a = memberIds[i];
  const b = faker.helpers.arrayElement(memberIds);
  if (a !== b) {
    await pool.query(
      `INSERT INTO app.friends (member_id, friend_id, invited_phone_masked)
       VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
      [a, b, masking.maskPhone(`010-${faker.string.numeric(4)}-${faker.string.numeric(4)}`)],
    );
  }
}

// 데모 회원 (로그인 실습용)
{
  const dek = crypto.generateDek();
  await pool.query(
    `INSERT INTO app.members (email, password_hash, name, phone_enc, ci_enc, birth_date, dek_wrapped, retention_until)
     VALUES ('demo@boblog.dev', $1, '데모회원', $2, $3, '1995-05-05', $4, (now() + interval '1 year')::date)
     ON CONFLICT (email) DO NOTHING`,
    [passwordHash, crypto.encryptField(dek, '010-1234-5678'), crypto.encryptField(dek, 'DEMO-CI-VALUE'), crypto.wrapDek(dek)]);
}

const counts = await pool.query(`
  SELECT (SELECT count(*) FROM app.members)  AS members,
         (SELECT count(*) FROM app.photos)   AS photos,
         (SELECT count(*) FROM app.payments) AS payments,
         (SELECT count(*) FROM app.friends)  AS friends`);
console.log('시드 완료:', counts.rows[0]);
console.log(`
── 데모 계정 (비밀번호 공통: ${PASSWORD}) ─────────────────
  서비스(3001): demo@boblog.dev
  ※ 보유기간 경과 회원 ${EXPIRED_COUNT}명 포함
`);
await pool.end();
