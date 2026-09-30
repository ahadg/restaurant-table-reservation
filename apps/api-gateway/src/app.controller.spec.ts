import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { SERVICES } from '@app/common';

describe('AppController', () => {
  let appController: AppController;

  const mockClientProxy = {
    send: vi.fn(),
    emit: vi.fn(),
  };

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        {
          provide: SERVICES.AUTH_SERVICE,
          useValue: mockClientProxy,
        },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return hello string from AppService', () => {
      expect(appController.getHello()).toBe('Hello World!');
    });

    it('should return ping response', () => {
      const ping = appController.ping();
      expect(ping.message).toBe('API Gateway is running');
    });
  });
});
