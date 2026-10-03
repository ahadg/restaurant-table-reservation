import { Test, TestingModule } from '@nestjs/testing';
import { TableServiceController } from './table-service.controller.js';
import { TableServiceService } from './table-service.service.js';

describe('TableServiceController', () => {
  let controller: TableServiceController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [TableServiceController],
      providers: [
        {
          provide: TableServiceService,
          useValue: {
            listFloors: async () => ({ floors: [] }),
          },
        },
      ],
    }).compile();

    controller = app.get(TableServiceController);
  });

  it('lists floors', async () => {
    await expect(controller.listFloors({ restaurantId: 'r1' })).resolves.toEqual({
      floors: [],
    });
  });
});
