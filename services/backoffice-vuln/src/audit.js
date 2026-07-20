import { createKafkaClient } from '@boblog/shared';

const AUDIT_TOPIC = 'vuln.audit-events';
const kafka = createKafkaClient('backoffice-vuln');
const producer = kafka.producer();
let connected = false;

/**
 * 접속기록(vuln.access_log) 기록 경로. DB에 직접 쓰지 않고 Kafka에 발행만 한다 —
 * 실제 INSERT는 audit-consumer 서비스가 vuln.audit-events 토픽을 구독해 수행한다.
 */
export async function publishAuditEvent({ actor, action, ip }) {
  if (!connected) {
    await producer.connect();
    connected = true;
  }
  await producer.send({
    topic: AUDIT_TOPIC,
    messages: [{ value: JSON.stringify({ actor, action, ip, occurred_at: new Date().toISOString() }) }],
  });
}
