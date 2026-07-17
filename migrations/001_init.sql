-- boblog 초기 스키마 — app = 서비스(회원/사진/친구/결제)

CREATE SCHEMA IF NOT EXISTS app;

-- ── 회원 (개인정보 원장) ─────────────────────────────────────────
CREATE TABLE app.members (
  id            SERIAL PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name          TEXT NOT NULL,
  phone_enc     TEXT,                       -- 암호화(제7조): DEK로 봉투암호화
  ci_enc        TEXT,                       -- 본인확인값(모의) 암호화
  birth_date    DATE,
  dek_wrapped   TEXT,                       -- 마스터키로 래핑된 회원별 DEK (crypto-shred 지점)
  mfa_secret    TEXT,
  status        TEXT NOT NULL DEFAULT 'active',  -- active | destroyed
  failed_count  INT  NOT NULL DEFAULT 0,
  locked_until  TIMESTAMPTZ,
  retention_until DATE,                     -- 보유기간 만료일(제13조 파기 배치 대상)
  deleted_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE app.photos (
  id         SERIAL PRIMARY KEY,
  member_id  INT NOT NULL REFERENCES app.members(id) ON DELETE CASCADE,
  file_path  TEXT NOT NULL,
  caption    TEXT,
  loc_enc    TEXT,                          -- 촬영 위치(암호화)
  taken_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE app.friends (
  id            SERIAL PRIMARY KEY,
  member_id     INT NOT NULL REFERENCES app.members(id) ON DELETE CASCADE,
  friend_id     INT NOT NULL REFERENCES app.members(id) ON DELETE CASCADE,
  invited_phone_masked TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (member_id, friend_id)
);

CREATE TABLE app.payments (
  id         SERIAL PRIMARY KEY,
  member_id  INT NOT NULL REFERENCES app.members(id) ON DELETE CASCADE,
  item       TEXT NOT NULL,
  amount     INT  NOT NULL,
  card_enc   TEXT,                          -- 카드번호 암호화
  card_last4 TEXT,                          -- 마스킹 표시용
  paid_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_photos_member   ON app.photos(member_id);
CREATE INDEX idx_payments_member ON app.payments(member_id);
CREATE INDEX idx_members_retention ON app.members(retention_until) WHERE status = 'active';
