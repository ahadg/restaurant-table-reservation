import { Injectable } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import {
  DatabaseService,
  tableCombinations,
  restaurantTable,
  floor
} from '@app/database';
import { eq, count } from 'drizzle-orm';

@Injectable()
export class TableServiceService {
  constructor(private readonly dbService: DatabaseService) { }

  async getfloor(restaurantId: string) {
    const [floors] = await this.dbService.db
      .select()
      .from(floor)
      .where(eq(floor.restaurantId, restaurantId));

    if (!floors) {
      throw new RpcException({
        code: 5, // NOT_FOUND in gRPC
        message: `Floor with ID ${restaurantId} not found`,
      });
    }

    return floors;
  }

  async insertFloor(data: { restaurantId: string, name: string, floorNumber: number }): Promise<any> {
    const [newFloor] = await this.dbService.db
      .insert(floor)
      .values({
        name: data.name,
        restaurantId: data.restaurantId,
        floorNumber: data.floorNumber,
      })
      .returning();
    return newFloor;
  }


}
