import { Injectable } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import {
  DatabaseService,
  tableCombinations,
  restaurantTable,
  floor,
} from '@app/database';
import { and, asc, eq } from 'drizzle-orm';

@Injectable()
export class TableServiceService {
  constructor(private readonly dbService: DatabaseService) {}

  async listFloors(restaurantId: string) {
    const rows = await this.dbService.db
      .select()
      .from(floor)
      .where(eq(floor.restaurantId, restaurantId))
      .orderBy(asc(floor.floorNumber));

    return { floors: rows.map((row) => this.formatFloor(row)) };
  }

  async getFloor(id: string) {
    const [row] = await this.dbService.db
      .select()
      .from(floor)
      .where(eq(floor.id, id));

    if (!row) {
      throw new RpcException({
        code: 5,
        message: `Floor with ID ${id} not found`,
      });
    }

    return this.formatFloor(row);
  }

  async createFloor(data: { restaurantId: string; name?: string; floorNumber: number }) {
    try {
      const [row] = await this.dbService.db
        .insert(floor)
        .values({
          restaurantId: data.restaurantId,
          name: data.name || null,
          floorNumber: data.floorNumber,
        })
        .returning();
      return this.formatFloor(row);
    } catch (error: any) {
      this.rethrowUnique(error, 'Floor number already exists for this restaurant');
    }
  }

  async updateFloor(data: { id: string; name?: string; floorNumber?: number }) {
    const existing = await this.requireFloor(data.id);

    try {
      const [row] = await this.dbService.db
        .update(floor)
        .set({
          name: data.name ?? existing.name,
          floorNumber: data.floorNumber ?? existing.floorNumber,
        })
        .where(eq(floor.id, data.id))
        .returning();
      return this.formatFloor(row);
    } catch (error: any) {
      this.rethrowUnique(error, 'Floor number already exists for this restaurant');
    }
  }

  async deleteFloor(id: string) {
    await this.requireFloor(id);
    await this.dbService.db.delete(floor).where(eq(floor.id, id));
    return { success: true, message: `Floor ${id} deleted successfully` };
  }

  async listTables(data: { restaurantId: string; floorId?: string }) {
    const filters = [eq(restaurantTable.restaurantId, data.restaurantId)];
    if (data.floorId) {
      filters.push(eq(restaurantTable.floorId, data.floorId));
    }

    const rows = await this.dbService.db
      .select()
      .from(restaurantTable)
      .where(and(...filters))
      .orderBy(asc(restaurantTable.tableNumber));

    return { tables: rows.map((row) => this.formatTable(row)) };
  }

  async getTable(id: string) {
    const [row] = await this.dbService.db
      .select()
      .from(restaurantTable)
      .where(eq(restaurantTable.id, id));

    if (!row) {
      throw new RpcException({
        code: 5,
        message: `Table with ID ${id} not found`,
      });
    }

    return this.formatTable(row);
  }

  async createTable(data: {
    restaurantId: string;
    floorId: string;
    ownerId?: string;
    name: string;
    tableNumber: number;
    capacity: number;
  }) {
    const parent = await this.requireFloor(data.floorId);
    if (parent.restaurantId !== data.restaurantId) {
      throw new RpcException({
        code: 3,
        message: 'Floor does not belong to this restaurant',
      });
    }

    try {
      const [row] = await this.dbService.db
        .insert(restaurantTable)
        .values({
          restaurantId: data.restaurantId,
          floorId: data.floorId,
          ownerId: data.ownerId || null,
          name: data.name,
          tableNumber: data.tableNumber,
          capacity: data.capacity,
        })
        .returning();
      return this.formatTable(row);
    } catch (error: any) {
      this.rethrowUnique(error, 'Table number already exists on this floor');
    }
  }

  async updateTable(data: { id: string; name?: string; tableNumber?: number; capacity?: number }) {
    const existing = await this.requireTable(data.id);

    try {
      const [row] = await this.dbService.db
        .update(restaurantTable)
        .set({
          name: data.name ?? existing.name,
          tableNumber: data.tableNumber ?? existing.tableNumber,
          capacity: data.capacity ?? existing.capacity,
        })
        .where(eq(restaurantTable.id, data.id))
        .returning();
      return this.formatTable(row);
    } catch (error: any) {
      this.rethrowUnique(error, 'Table number already exists on this floor');
    }
  }

  async deleteTable(id: string) {
    await this.requireTable(id);
    await this.dbService.db.delete(restaurantTable).where(eq(restaurantTable.id, id));
    return { success: true, message: `Table ${id} deleted successfully` };
  }

  async listCombinations(floorId: string) {
    await this.requireFloor(floorId);
    const rows = await this.dbService.db
      .select()
      .from(tableCombinations)
      .where(eq(tableCombinations.floorId, floorId));

    return { combinations: rows.map((row) => this.formatCombination(row)) };
  }

  async createCombination(data: { floorId: string; tableIds: string[] }) {
    await this.requireFloor(data.floorId);
    if (!data.tableIds?.length) {
      throw new RpcException({
        code: 3,
        message: 'At least one table id is required',
      });
    }

    const [row] = await this.dbService.db
      .insert(tableCombinations)
      .values({
        floorId: data.floorId,
        combination: data.tableIds,
      })
      .returning();

    return this.formatCombination(row);
  }

  async deleteCombination(id: string) {
    const [existing] = await this.dbService.db
      .select()
      .from(tableCombinations)
      .where(eq(tableCombinations.id, id));

    if (!existing) {
      throw new RpcException({
        code: 5,
        message: `Combination with ID ${id} not found`,
      });
    }

    await this.dbService.db.delete(tableCombinations).where(eq(tableCombinations.id, id));
    return { success: true, message: `Combination ${id} deleted successfully` };
  }

  private async requireFloor(id: string) {
    const [row] = await this.dbService.db.select().from(floor).where(eq(floor.id, id));
    if (!row) {
      throw new RpcException({
        code: 5,
        message: `Floor with ID ${id} not found`,
      });
    }
    return row;
  }

  private async requireTable(id: string) {
    const [row] = await this.dbService.db
      .select()
      .from(restaurantTable)
      .where(eq(restaurantTable.id, id));
    if (!row) {
      throw new RpcException({
        code: 5,
        message: `Table with ID ${id} not found`,
      });
    }
    return row;
  }

  private rethrowUnique(error: any, message: string): never {
    if (error?.code === '23505') {
      throw new RpcException({ code: 6, message });
    }
    throw error;
  }

  private formatFloor(row: typeof floor.$inferSelect) {
    return {
      id: row.id,
      restaurantId: row.restaurantId,
      name: row.name || '',
      floorNumber: row.floorNumber,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private formatTable(row: typeof restaurantTable.$inferSelect) {
    return {
      id: row.id,
      restaurantId: row.restaurantId,
      floorId: row.floorId,
      ownerId: row.ownerId || '',
      name: row.name,
      tableNumber: row.tableNumber,
      capacity: row.capacity,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private formatCombination(row: typeof tableCombinations.$inferSelect) {
    return {
      id: row.id,
      floorId: row.floorId,
      tableIds: row.combination || [],
    };
  }
}
