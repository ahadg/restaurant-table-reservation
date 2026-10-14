import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@app/common';
import { DlqAdminGuard } from './dlq-admin.guard.js';
import { DlqService } from './dlq.service.js';

@Controller('admin/dlq')
@UseGuards(JwtAuthGuard, DlqAdminGuard)
export class DlqController {
  constructor(private readonly dlq: DlqService) {}

  @Get()
  list(@Query('limit') limit?: string, @Query('offset') offset?: string) {
    return this.dlq.listMessages(Number(limit) || 100, Number(offset) || 0);
  }

  @Post('replay')
  replay(@Body() body: { id: string; sourceTopic: string; data: unknown }) {
    return this.dlq.replay(body);
  }
}
