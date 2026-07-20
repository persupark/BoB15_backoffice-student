import { createKafkaClient, createPool } from '@boblog/shared';

const CONSUMER_GROUP = 'access-log-writer';

/**
 * audit-consumer — vuln.audit-events(Kafka) 구독 → vuln.access_log(Postgres) 적재.
 *
 * 접속기록의 실제 쓰기 경로는 이제 여기 하나뿐이다(backoffice-vuln은 발행만 한다).
 * 이 서비스가 죽거나 지연되면 접속기록 적재도 그만큼 지연된다(최종적 일관성) —
 * "접속기록이 즉시 조회 가능해야 하는가"는 그 자체로 제8조 해석의 논점이 된다.
 *
 * vuln.kafka_consumption_log: 이 컨슈머 자신이 무엇을(topic/partition/offset) 언제
 * 소비했는지 남기는 기록이다. 다만 이 표는 "access-log-writer" 컨슈머 그룹만의
 * 소비 기록일 뿐 — 같은 토픽을 다른 그룹(예: Kafka 관리 UI)이 읽어도 여기엔 안 남는다.
 */
const pool = createPool();
const kafka = createKafkaClient('audit-consumer');
const consumer = kafka.consumer({ groupId: CONSUMER_GROUP });

async function main() {
  await consumer.connect();
  await consumer.subscribe({ topic: 'vuln.audit-events', fromBeginning: true });
  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      let evt = {};
      try {
        evt = JSON.parse(message.value.toString());
        await pool.query(
          'INSERT INTO vuln.access_log (actor, action, ip, occurred_at) VALUES ($1, $2, $3, $4)',
          [evt.actor, evt.action, evt.ip, evt.occurred_at],
        );
      } catch (e) {
        console.error('audit-consumer: 메시지 처리 실패, 건너뜀:', e.message);
      } finally {
        // 처리 성공/실패와 무관하게 "이 오프셋을 소비했다"는 사실 자체는 남긴다.
        try {
          await pool.query(
            `INSERT INTO vuln.kafka_consumption_log
               (consumer_group, topic, partition, kafka_offset, actor, action)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [CONSUMER_GROUP, topic, partition, message.offset, evt.actor ?? null, evt.action ?? null],
          );
        } catch (e2) {
          console.error('audit-consumer: 소비 기록(kafka_consumption_log) 실패:', e2.message);
        }
      }
    },
  });
  console.log('audit-consumer: vuln.audit-events 구독 시작 → vuln.access_log + kafka_consumption_log 적재');
}

main().catch((e) => { console.error('audit-consumer 실행 오류:', e); process.exit(1); });
