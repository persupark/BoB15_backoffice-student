import { Kafka } from 'kafkajs';

export function createKafkaClient(clientId) {
  return new Kafka({
    clientId,
    brokers: [process.env.KAFKA_BROKERS || 'localhost:9092'],
    logLevel: 1, // ERROR만(kafkajs 기본 로그가 시끄러움)
  });
}
