import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { DatabaseService } from './database.service.js';

vi.mock('pg', () => {
  return {
    Pool: vi.fn().mockImplementation(() => ({
      on: vi.fn(),
      end: vi.fn(),
    })),
  };
});

describe('DatabaseService', () => {
  let service: DatabaseService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DatabaseService],
    }).compile();

    service = module.get<DatabaseService>(DatabaseService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
