import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import type { Producer } from 'kafkajs';
import { createKafkaClient } from './kafka.options.js';

@Injectable()
export class KafkaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KafkaService.name);
  private producer: Producer | null = null;
  private connected = false;
  private connecting: Promise<void> | null = null;

  async onModuleInit() {
    try {
      await this.connectProducer();
      this.logger.log(`Kafka producer connected (${process.env.KAFKA_BROKER || process.env.KAFKA_BROKERS || 'localhost:9092'})`);
    } catch (error) {
      // Keep the producer instance so an outbox retry can reconnect on demand.
      this.logger.error('Kafka producer failed to connect; durable events will retry', error);
    }
  }

  async emit(topic: string, data: unknown, options: { eventId?: string; key?: string } = {}) {
    await this.connectProducer();
    const producer = this.producer!;

    const record = data as { restaurantId?: string; id?: string };

    await producer.send({
      topic,
      messages: [
        {
          key: options.key || record.restaurantId || record.id || topic,
          value: JSON.stringify({
            pattern: topic,
            data,
          }),
          ...(options.eventId ? { headers: { 'x-outbox-event-id': options.eventId } } : {}),
        },
      ],
    });
  }

  private async connectProducer(): Promise<void> {
    if (!this.producer) {
      const kafka = createKafkaClient(process.env.KAFKA_CLIENT_ID || 'restaurant-app');
      this.producer = kafka.producer();
    }
    if (this.connected) return;

    if (!this.connecting) {
      this.connecting = this.producer.connect()
        .then(() => { this.connected = true; })
        .finally(() => { this.connecting = null; });
    }
    await this.connecting;
  }

  async onModuleDestroy() {
    if (this.producer && this.connected) {
      await this.producer.disconnect();
      this.connected = false;
    }
  }
}
