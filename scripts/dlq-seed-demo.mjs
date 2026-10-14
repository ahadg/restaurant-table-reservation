// Publish synthetic failed events to an isolated DLQ topic for the public demo.
// These are never sent to reservation.created / reservation.cancelled.
import { Kafka } from 'kafkajs';

const brokers = (process.env.KAFKA_BROKERS || process.env.KAFKA_BROKER || 'localhost:9092')
  .split(',').map((broker) => broker.trim()).filter(Boolean);
const suffix = process.env.KAFKA_DLQ_SUFFIX || '.dlq';
const sourceTopic = 'dlq.demo';
const dlqTopic = `${sourceTopic}${suffix}`;
const kafka = new Kafka({ clientId: `dlq-demo-seeder-${Date.now()}`, brokers });
const admin = kafka.admin();
const producer = kafka.producer();
const now = new Date();

const samples = [
  {
    id: 'demo-reservation-001',
    event: { id: 'demo-reservation-001', restaurantId: 'demo-restaurant', guestName: 'Avery Demo', guestEmail: 'avery@example.test', partySize: 2, status: 'CONFIRMED' },
    error: 'Temporary database timeout while writing notification',
  },
  {
    id: 'demo-reservation-002',
    event: { id: 'demo-reservation-002', restaurantId: 'demo-restaurant', guestName: 'Jordan Sample', guestEmail: 'jordan@example.test', partySize: 4, status: 'CONFIRMED' },
    error: 'Payload validation failed: partySize was not accepted by the downstream handler',
  },
  {
    id: 'demo-reservation-003',
    event: { id: 'demo-reservation-003', restaurantId: 'demo-restaurant', guestName: 'Casey Example', guestEmail: 'casey@example.test', partySize: 3, status: 'CANCELLED' },
    error: 'Email provider timed out after retries',
  },
];

async function main() {
  await admin.connect();
  await admin.createTopics({
    waitForLeaders: true,
    topics: [sourceTopic, dlqTopic].map((topic) => ({ topic, numPartitions: 1, replicationFactor: 1 })),
  });
  await producer.connect();
  const failedAt = now.toISOString();
  await producer.send({
    topic: dlqTopic,
    messages: samples.map(({ id, event, error }, index) => ({
      key: id,
      value: JSON.stringify({
        pattern: sourceTopic,
        data: event,
        dlq: {
          sourceTopic,
          partition: 0,
          offset: String(100 + index),
          attempts: 3,
          failedAt,
          error,
        },
      }),
      headers: {
        'x-dlq-source-topic': sourceTopic,
        'x-dlq-source-offset': String(100 + index),
        'x-dlq-attempts': '3',
        'x-dlq-failed-at': failedAt,
        'x-dlq-error': error,
        'x-dlq-demo': 'true',
      },
    })),
  });
  console.log(`Published ${samples.length} synthetic records to ${dlqTopic}; replay target ${sourceTopic} has no consumer.`);
}

main().catch((error) => {
  console.error(`DLQ demo seed failed: ${error instanceof Error ? error.message : error}`);
  process.exitCode = 1;
}).finally(async () => {
  await producer.disconnect().catch(() => undefined);
  await admin.disconnect().catch(() => undefined);
});
