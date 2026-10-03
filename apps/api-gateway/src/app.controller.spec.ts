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

  const mockGrpc = {
    getService: vi.fn().mockReturnValue({}),
  };

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        { provide: SERVICES.AUTH_SERVICE, useValue: mockClientProxy },
        { provide: SERVICES.NOTIFICATION_SERVICE, useValue: mockClientProxy },
        { provide: SERVICES.RESTAURANT_SERVICE, useValue: mockGrpc },
        { provide: SERVICES.TABLE_SERVICE, useValue: mockGrpc },
        { provide: SERVICES.RESERVATION_SERVICE, useValue: mockGrpc },
      ],
    }).compile();

    appController = app.get(AppController);
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
