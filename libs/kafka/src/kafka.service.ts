import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import type { Producer } from 'kafkajs';
import { createKafkaClient } from './kafka.options.js';

@Injectable()
export class KafkaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KafkaService.name);
  private producer: Producer | null = null;

  async onModuleInit() {
    try {
      const kafka = createKafkaClient(process.env.KAFKA_CLIENT_ID || 'restaurant-app');
      this.producer = kafka.producer();
      await this.producer.connect();
      this.logger.log(`Kafka producer connected (${process.env.KAFKA_BROKER || process.env.KAFKA_BROKERS || 'localhost:9092'})`);
    } catch (error) {
      this.producer = null;
      this.logger.error('Kafka producer failed to connect; events will be skipped', error);
    }
  }

  async emit(topic: string, data: unknown) {
    if (!this.producer) {
      this.logger.warn(`Skip emit ${topic}: producer is not connected`);
      return;
    }

    const record = data as { restaurantId?: string; id?: string };

    await this.producer.send({
      topic,
      messages: [
        {
          key: record.restaurantId || record.id || topic,
          value: JSON.stringify({
            pattern: topic,
            data,
          }),
        },
      ],
    });
  }

  async onModuleDestroy() {
    if (this.producer) {
      await this.producer.disconnect();
    }
  }
}
