import { Module } from '@nestjs/common';
import { RedisModule } from '@app/redis';
import { DlqController } from './dlq.controller.js';
import { DlqPageController } from './dlq-page.controller.js';
import { DlqDemoController } from './dlq-demo.controller.js';
import { DlqAdminGuard } from './dlq-admin.guard.js';
import { DlqService } from './dlq.service.js';

@Module({
  imports: [RedisModule],
  controllers: [DlqController, DlqDemoController, DlqPageController],
  providers: [DlqService, DlqAdminGuard],
})
export class DlqModule {}
