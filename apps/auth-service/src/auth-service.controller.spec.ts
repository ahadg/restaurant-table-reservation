import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { AuthServiceController } from './auth-service.controller.js';
import { AuthServiceService } from './auth-service.service.js';

describe('AuthServiceController', () => {
  let authServiceController: AuthServiceController;

  const mockAuthServiceService = {
    getHello: vi.fn().mockReturnValue('Auth Service is active'),
    register: vi.fn(),
    login: vi.fn(),
    validateToken: vi.fn(),
    getProfile: vi.fn(),
  };

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AuthServiceController],
      providers: [
        {
          provide: AuthServiceService,
          useValue: mockAuthServiceService,
        },
      ],
    }).compile();

    authServiceController = app.get<AuthServiceController>(AuthServiceController);
  });

  describe('root', () => {
    it('should return health check status', () => {
      expect(authServiceController.healthCheck()).toBe('Auth Service is active');
    });
  });
});
