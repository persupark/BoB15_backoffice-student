// 수강생 개인 계정 시드 — 1인 1계정.
//
// 왜 개인 계정인가: 공용 계정을 쓰면 vuln.http_log의 actor가 전부 같아져
// "누가 무엇을 했는지" 추적이 불가능해진다.
//
// 생성 대상: vuln.admin_users (:3200 진단 실습 대상).
// 계정 정보는 data/students-credentials.csv 로 저장된다(.gitignore 대상).
import crypto from 'node:crypto';
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fakerKO as faker } from '@faker-js/faker';
import { createPool } from '@boblog/shared';

const ROOT = path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))));
const COUNT = Number(process.env.SEED_STUDENTS || 21);
const FORCE = process.env.SEED_STUDENTS_FORCE === '1';

/** 데모 재현 전용 해시 함수 — 정상 코드에서 사용 금지 */
const md5 = (s) => crypto.createHash('md5').update(String(s)).digest('hex');

/** 혼동되는 문자(0/O/1/I/l) 제외 — 강사가 구두로 불러줘도 오타가 안 나게 */
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
function randomPassword() {
  const pick = (n) => Array.from(crypto.randomBytes(n))
    .map((b) => ALPHABET[b % ALPHABET.length]).join('');
  return `boblog-${pick(4)}-${pick(4)}`;
}

const pool = createPool();

const existing = await pool.query(
  `SELECT count(*)::int AS c FROM vuln.admin_users WHERE login_id LIKE 'student%'`);
if (existing.rows[0].c > 0 && !FORCE) {
  console.log(
    `이미 수강생 계정 ${existing.rows[0].c}개가 있습니다. 건너뜁니다.\n` +
    `  비밀번호를 새로 발급하려면: SEED_STUDENTS_FORCE=1 npm run seed:students`);
  await pool.end();
  process.exit(0);
}

// 이름 중복 방지 — 각자 다른 이름으로 식별되게
const names = new Set();
while (names.size < COUNT) names.add(faker.person.fullName());
const nameList = [...names];

const rows = [];
for (let i = 0; i < COUNT; i++) {
  const loginId = `student${String(i + 1).padStart(2, '0')}`;
  const name = nameList[i];
  const password = randomPassword(); // 학생마다 서로 다른 비밀번호

  await pool.query(
    `INSERT INTO vuln.admin_users (login_id, password_md5, name)
     VALUES ($1,$2,$3)
     ON CONFLICT (login_id) DO UPDATE
       SET password_md5 = EXCLUDED.password_md5, name = EXCLUDED.name`,
    [loginId, md5(password), name]);

  rows.push({ loginId, name, password });
}

// 강사 배포용 자격증명 파일 (data/ 는 .gitignore 대상)
const csvPath = path.join(ROOT, 'data', 'students-credentials.csv');
await mkdir(path.dirname(csvPath), { recursive: true });
await writeFile(csvPath,
  '﻿아이디,이름,비밀번호\n' +
  rows.map((r) => `${r.loginId},${r.name},${r.password}`).join('\n') + '\n',
  'utf8');

console.log(`\n수강생 계정 ${rows.length}개 생성 완료\n`);
console.log('  아이디      이름            비밀번호');
console.log('  ' + '─'.repeat(46));
for (const r of rows) {
  console.log(`  ${r.loginId.padEnd(11)} ${r.name.padEnd(14)} ${r.password}`);
}
console.log(`
  배포용 파일: data/students-credentials.csv  (git에 커밋되지 않음)
  · 3200(진단 실습 대상)에 이 아이디/비밀번호로 로그인합니다.
  · 실습 행위 추적: make vuln-log  (actor 컬럼으로 학생 구분)
`);

await pool.end();
