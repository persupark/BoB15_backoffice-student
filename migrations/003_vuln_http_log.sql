-- vuln.http_log — 실습 관찰용 HTTP 요청 기록.
-- 요청 바디와 응답 본문은 기록하지 않습니다(민감정보 보호).

CREATE TABLE vuln.http_log (
  id          BIGSERIAL PRIMARY KEY,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  actor       TEXT,
  method      TEXT NOT NULL,
  path        TEXT NOT NULL,
  query       TEXT,
  status      INT  NOT NULL,
  duration_ms INT  NOT NULL,
  ip          TEXT,
  user_agent  TEXT,
  bytes       INT
);

CREATE INDEX idx_vuln_http_log_time  ON vuln.http_log(occurred_at DESC);
CREATE INDEX idx_vuln_http_log_actor ON vuln.http_log(actor);
