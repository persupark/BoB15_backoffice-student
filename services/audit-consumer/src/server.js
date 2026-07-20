import { createKafkaClient, createPool } from '@boblog/shared';

/**
 * audit-consumer — vuln.audit-events(Kafka) 구독 → vuln.access_log(Postgres) 적재.
 *
 * 접속기록의 실제 쓰기 경로는 이제 여기 하나뿐이다(backoffice-vuln은 발행만 한다).
 * 이 서비스가 죽거나 지연되면 접속기록 적재도 그만큼 지연된다(최종적 일관성) —
 * "접속기록이 즉시 조회 가능해야 하는가"는 그 자체로 제8조 해석의 논점이 된다.
 */
const pool = createPool();
const kafka = createKafkaClient('audit-consumer');
const consumer = kafka.consumer({ groupId: 'access-log-writer' });

async function main() {
  await consumer.connect();
  await consumer.subscribe({ topic: 'vuln.audit-events', fromBeginning: true });
  await consumer.run({
    eachMessage: async ({ message }) => {
      try {
        const evt = JSON.parse(message.value.toString());
        await pool.query(
          'INSERT INTO vuln.access_log (actor, action, ip, occurred_at) VALUES ($1, $2, $3, $4)',
          [evt.actor, evt.action, evt.ip, evt.occurred_at],
        );
      } catch (e) {
        // 메시지 하나의 오류로 전체 컨슈머가 멈추지 않게 로그만 남기고 계속 진행한다.
        console.error('audit-consumer: 메시지 처리 실패, 건너뜀:', e.message);
      }
    },
  });
  console.log('audit-consumer: vuln.audit-events 구독 시작 → vuln.access_log 적재');
}

main().catch((e) => { console.error('audit-consumer 실행 오류:', e); process.exit(1); });
