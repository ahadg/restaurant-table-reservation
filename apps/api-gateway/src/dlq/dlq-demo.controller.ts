import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { DlqService } from './dlq.service.js';

@Controller('admin/dlq/demo')
export class DlqDemoController {
  constructor(private readonly dlq: DlqService) {}

  @Get()
  list(@Query('limit') limit?: string) {
    return this.dlq.listDemoMessages(Number(limit) || 100);
  }

  @Post('replay')
  replay(@Body() body: { id: string; data: unknown }) {
    return this.dlq.replayDemo(body);
  }
}
