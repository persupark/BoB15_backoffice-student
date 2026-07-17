-- ════════════════════════════════════════════════════════════════════
-- vuln 스키마 — 진단 실습 대상 개인정보처리시스템
--
-- 데이터는 전부 가명·합성(faker)입니다. 실개인정보를 절대 사용하지 않습니다.
-- ════════════════════════════════════════════════════════════════════

CREATE SCHEMA IF NOT EXISTS vuln;

CREATE TABLE vuln.members (
  id              SERIAL PRIMARY KEY,
  email           TEXT NOT NULL UNIQUE,
  password_md5    TEXT NOT NULL,
  name            TEXT NOT NULL,
  phone           TEXT,
  ci_value        TEXT,
  birth_date      DATE,
  retention_until DATE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE vuln.payments (
  id        SERIAL PRIMARY KEY,
  member_id INT NOT NULL REFERENCES vuln.members(id) ON DELETE CASCADE,
  item      TEXT NOT NULL,
  amount    INT  NOT NULL,
  card_no   TEXT,
  paid_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE vuln.admin_users (
  id           SERIAL PRIMARY KEY,
  login_id     TEXT NOT NULL UNIQUE,
  password_md5 TEXT NOT NULL,
  name         TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE vuln.access_log (
  id          SERIAL PRIMARY KEY,
  actor       TEXT NOT NULL,
  action      TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_vuln_payments_member ON vuln.payments(member_id);
