import { Kafka } from 'kafkajs';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';

export function kafkaBrokers(): string[] {
  const raw = process.env.KAFKA_BROKERS || process.env.KAFKA_BROKER || 'localhost:9092';
  return raw.split(',').map((b) => b.trim()).filter(Boolean);
}

export function createKafkaClient(clientId: string) {
  return new Kafka({
    clientId,
    brokers: kafkaBrokers(),
  });
}

export function kafkaMicroserviceOptions(groupId: string): MicroserviceOptions {
  return {
    transport: Transport.KAFKA,
    options: {
      client: {
        clientId: groupId,
        brokers: kafkaBrokers(),
      },
      consumer: {
        groupId,
        allowAutoTopicCreation: true,
      },
    },
  };
}
