-- vuln.kafka_consumption_log — audit-consumer 자신의 Kafka 소비 기록.
--
-- 주의: 이 표는 audit-consumer라는 "이 컨슈머 그룹"의 소비만 기록한다.
-- 같은 토픽(vuln.audit-events)을 다른 컨슈머 그룹(예: Kafka 관리 UI로 직접 열람)이
-- 읽어도 여기엔 남지 않는다 — 브로커 자체에는 "누가 이 토픽을 읽었는지"를 보편적으로
-- 기록하는 장치가 없다(제2조 정의 결함, INTENDED_GAPS 참조).

CREATE TABLE vuln.kafka_consumption_log (
  id             BIGSERIAL PRIMARY KEY,
  consumer_group TEXT NOT NULL,
  topic          TEXT NOT NULL,
  partition      INT NOT NULL,
  kafka_offset   BIGINT NOT NULL,
  actor          TEXT,
  action         TEXT,
  consumed_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_kafka_consumption_log_time ON vuln.kafka_consumption_log(consumed_at DESC);
CREATE INDEX idx_kafka_consumption_log_topic_offset ON vuln.kafka_consumption_log(topic, partition, kafka_offset);
