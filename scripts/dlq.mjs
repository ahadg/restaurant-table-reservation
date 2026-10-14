// Inspect and replay dead-lettered Kafka messages.
//
//   node scripts/dlq.mjs list   [--topic <sourceTopic>] [--limit 50] [--json]
//   node scripts/dlq.mjs replay [--topic <sourceTopic>] [--dry-run]
//
// "replay" re-produces each dead letter back to its original topic, using the
// `pattern`/`data` the envelope preserved. Fix the underlying bug first,
// otherwise the replay just lands back on the DLQ.
import { Kafka } from 'kafkajs';

const VAR = {
  brokers: process.env.KAFKA_BROKERS || process.env.KAFKA_BROKER || 'localhost:9092',
  dlqSuffix: process.env.KAFKA_DLQ_SUFFIX || '.dlq',
};

const argv = process.argv.slice(2);
const command = argv[0];
const flag = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : fallback;
};
const has = (name) => argv.includes(`--${name}`);

const sourceTopicFilter = flag('topic', null);
const limit = Number(flag('limit', 50));
const asJson = has('json');
const dryRun = has('dry-run');

const kafka = new Kafka({ clientId: `dlq-tool-${Date.now()}`, brokers: VAR.brokers.split(',').map((b) => b.trim()) });
const admin = kafka.admin();

/** Reads every message currently in a topic, using a throwaway group. */
async function drain(topic, max) {
  const consumer = kafka.consumer({ groupId: `dlq-tool-${topic}-${Date.now()}` });
  const collected = [];
  let done = false;
  // Declared before run(): messages can start arriving while run() is awaiting.
  let stopWaiting;
  const enough = new Promise((resolve) => {
    stopWaiting = resolve;
  });

  await consumer.connect();
  await consumer.subscribe({ topic, fromBeginning: true });

  await consumer.run({
    eachMessage: async ({ message }) => {
      if (done) {
        return;
      }
      collected.push({
        key: message.key?.toString() ?? null,
        headers: Object.fromEntries(
          Object.entries(message.headers ?? {}).map(([k, v]) => [k, v?.toString() ?? '']),
        ),
        raw: message.value?.toString() ?? '',
      });
      if (collected.length >= max) {
        done = true;
        stopWaiting();
      }
    },
  });

  // Finish once we have `max` messages, or once the topic goes quiet.
  await Promise.race([enough, new Promise((resolve) => setTimeout(resolve, 2500))]);

  await consumer.disconnect();
  return collected;
}

function parseEnvelope(raw) {
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && parsed.dlq) {
      return parsed;
    }
  } catch {
    /* fall through */
  }
  return null;
}

async function main() {
  await admin.connect();
  const all = await admin.listTopics();
  const dlqTopics = all
    .filter((t) => t.endsWith(VAR.dlqSuffix))
    .filter((t) => !sourceTopicFilter || t === `${sourceTopicFilter}${VAR.dlqSuffix}`);

  if (dlqTopics.length === 0) {
    console.log(
      sourceTopicFilter
        ? `No DLQ topic for "${sourceTopicFilter}" (expected ${sourceTopicFilter}${VAR.dlqSuffix}).`
        : `No dead letter topics found (looking for topics ending in "${VAR.dlqSuffix}").`,
    );
    return;
  }

  if (command === 'list') {
    for (const topic of dlqTopics) {
      const messages = await drain(topic, limit);
      console.log(`\n=== ${topic} (${messages.length} message${messages.length === 1 ? '' : 's'}) ===`);
      for (const [index, message] of messages.entries()) {
        const envelope = parseEnvelope(message.raw);
        if (asJson) {
          console.log(JSON.stringify(envelope ?? message.raw));
          continue;
        }
        console.log(`\n  [${index + 1}] offset=${message.headers['x-dlq-source-offset'] ?? '?'}`);
        console.log(`      failed : ${message.headers['x-dlq-failed-at'] ?? '?'}`);
        console.log(`      reason : ${message.headers['x-dlq-error'] ?? '?'}`);
        console.log(`      key    : ${message.key ?? '-'}`);
        if (envelope) {
          console.log(`      replay -> topic "${envelope.pattern}"`);
          console.log(`      data   : ${JSON.stringify(envelope.data)}`);
        } else {
          console.log(`      raw    : ${message.raw.slice(0, 300)}`);
        }
      }
    }
    return;
  }

  if (command === 'replay') {
    const producer = kafka.producer();
    await producer.connect();
    let replayed = 0;
    let skipped = 0;

    for (const topic of dlqTopics) {
      const messages = await drain(topic, limit);
      console.log(`\n=== replaying ${messages.length} from ${topic}${dryRun ? ' (dry run)' : ''} ===`);
      for (const message of messages) {
        const envelope = parseEnvelope(message.raw);
        if (!envelope) {
          skipped++;
          console.log(`  skipped (not a DLQ envelope): ${message.raw.slice(0, 120)}`);
          continue;
        }
        if (dryRun) {
          console.log(`  would replay -> ${envelope.pattern}: ${JSON.stringify(envelope.data)}`);
          replayed++;
          continue;
        }
        await producer.send({
          topic: envelope.pattern,
          messages: [
            {
              key: message.key,
              value: JSON.stringify({ pattern: envelope.pattern, data: envelope.data }),
              headers: { 'x-dlq-replayed-at': new Date().toISOString() },
            },
          ],
        });
        replayed++;
        console.log(`  replayed -> ${envelope.pattern}`);
      }
    }

    await producer.disconnect();
    console.log(`\n${dryRun ? 'would replay' : 'replayed'} ${replayed}, skipped ${skipped}.`);
    if (replayed > 0 && !dryRun) {
      console.log('Messages are still on the DLQ topic; delete them once the replay succeeds.');
    }
    return;
  }

  console.error('Usage: node scripts/dlq.mjs <list|replay> [--topic <sourceTopic>] [--limit N] [--json] [--dry-run]');
  process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(`dlq tool failed: ${error instanceof Error ? error.message : error}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await admin.disconnect().catch(() => {});
  });
