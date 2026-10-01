import { Injectable } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import {
  DatabaseService,
  restaurants,
  locations,
  openingHours,
  houseRules,
} from '@app/database';
import { eq, count } from 'drizzle-orm';

@Injectable()
export class RestaurantServiceService {
  constructor(private readonly dbService: DatabaseService) {}

  async createRestaurant(data: {
    name: string;
    description?: string;
    phone?: string;
    email?: string;
    cuisine?: string;
    ownerId?: string;
  }) {
    const [newRestaurant] = await this.dbService.db
      .insert(restaurants)
      .values({
        name: data.name,
        description: data.description || '',
        phone: data.phone || '',
        email: data.email || '',
        cuisine: data.cuisine || '',
        ownerId: data.ownerId || null,
      })
      .returning();

    return this.formatRestaurantResponse(newRestaurant);
  }

  async getRestaurant(id: string) {
    const [restaurant] = await this.dbService.db
      .select()
      .from(restaurants)
      .where(eq(restaurants.id, id));

    if (!restaurant) {
      throw new RpcException({
        code: 5, // NOT_FOUND in gRPC
        message: `Restaurant with ID ${id} not found`,
      });
    }

    const [location] = await this.dbService.db
      .select()
      .from(locations)
      .where(eq(locations.restaurantId, id));

    const hours = await this.dbService.db
      .select()
      .from(openingHours)
      .where(eq(openingHours.restaurantId, id));

    const rules = await this.dbService.db
      .select()
      .from(houseRules)
      .where(eq(houseRules.restaurantId, id));

    return this.formatRestaurantResponse(restaurant, location, hours, rules);
  }

  async listRestaurants(page = 1, limit = 10) {
    const offset = (page - 1) * limit;

    const items = await this.dbService.db
      .select()
      .from(restaurants)
      .limit(limit)
      .offset(offset);

    const [{ value: totalCount }] = await this.dbService.db
      .select({ value: count() })
      .from(restaurants);

    const formattedItems = await Promise.all(
      items.map(async (item) => {
        const [location] = await this.dbService.db
          .select()
          .from(locations)
          .where(eq(locations.restaurantId, item.id));

        const hours = await this.dbService.db
          .select()
          .from(openingHours)
          .where(eq(openingHours.restaurantId, item.id));

        const rules = await this.dbService.db
          .select()
          .from(houseRules)
          .where(eq(houseRules.restaurantId, item.id));

        return this.formatRestaurantResponse(item, location, hours, rules);
      }),
    );

    return {
      restaurants: formattedItems,
      total: Number(totalCount),
    };
  }

  async updateRestaurant(data: {
    id: string;
    name?: string;
    description?: string;
    phone?: string;
    email?: string;
    cuisine?: string;
  }) {
    const [existing] = await this.dbService.db
      .select()
      .from(restaurants)
      .where(eq(restaurants.id, data.id));

    if (!existing) {
      throw new RpcException({
        code: 5,
        message: `Restaurant with ID ${data.id} not found`,
      });
    }

    const [updated] = await this.dbService.db
      .update(restaurants)
      .set({
        name: data.name ?? existing.name,
        description: data.description ?? existing.description,
        phone: data.phone ?? existing.phone,
        email: data.email ?? existing.email,
        cuisine: data.cuisine ?? existing.cuisine,
        updatedAt: new Date(),
      })
      .where(eq(restaurants.id, data.id))
      .returning();

    return this.getRestaurant(updated.id);
  }

  async deleteRestaurant(id: string) {
    const [existing] = await this.dbService.db
      .select()
      .from(restaurants)
      .where(eq(restaurants.id, id));

    if (!existing) {
      throw new RpcException({
        code: 5,
        message: `Restaurant with ID ${id} not found`,
      });
    }

    await this.dbService.db
      .delete(restaurants)
      .where(eq(restaurants.id, id));

    return {
      success: true,
      message: `Restaurant ${id} deleted successfully`,
    };
  }

  async addLocation(data: {
    restaurantId: string;
    address: string;
    city: string;
    state?: string;
    zipCode?: string;
    country?: string;
    latitude?: string;
    longitude?: string;
  }) {
    const [newLocation] = await this.dbService.db
      .insert(locations)
      .values({
        restaurantId: data.restaurantId,
        address: data.address,
        city: data.city,
        state: data.state || '',
        zipCode: data.zipCode || '',
        country: data.country || '',
        latitude: data.latitude || '',
        longitude: data.longitude || '',
      })
      .returning();

    return {
      id: newLocation.id,
      restaurantId: newLocation.restaurantId,
      address: newLocation.address,
      city: newLocation.city,
      state: newLocation.state || '',
      zipCode: newLocation.zipCode || '',
      country: newLocation.country || '',
      latitude: newLocation.latitude || '',
      longitude: newLocation.longitude || '',
    };
  }

  async setOpeningHours(data: {
    restaurantId: string;
    hours: Array<{
      dayOfWeek: number;
      openTime: string;
      closeTime: string;
      isClosed?: boolean;
    }>;
  }) {
    await this.dbService.db
      .delete(openingHours)
      .where(eq(openingHours.restaurantId, data.restaurantId));

    if (!data.hours || data.hours.length === 0) {
      return { hours: [] };
    }

    const inserted = await this.dbService.db
      .insert(openingHours)
      .values(
        data.hours.map((h) => ({
          restaurantId: data.restaurantId,
          dayOfWeek: h.dayOfWeek,
          openTime: h.openTime,
          closeTime: h.closeTime,
          isClosed: h.isClosed ?? false,
        })),
      )
      .returning();

    return {
      hours: inserted.map((item) => ({
        id: item.id,
        restaurantId: item.restaurantId,
        dayOfWeek: item.dayOfWeek,
        openTime: item.openTime,
        closeTime: item.closeTime,
        isClosed: item.isClosed,
      })),
    };
  }

  async addHouseRule(data: { restaurantId: string; rule: string }) {
    const [newRule] = await this.dbService.db
      .insert(houseRules)
      .values({
        restaurantId: data.restaurantId,
        rule: data.rule,
      })
      .returning();

    return {
      id: newRule.id,
      restaurantId: newRule.restaurantId,
      rule: newRule.rule,
      createdAt: newRule.createdAt.toISOString(),
    };
  }

  private formatRestaurantResponse(
    restaurant: any,
    location?: any,
    hoursList: any[] = [],
    rulesList: any[] = [],
  ) {
    return {
      id: restaurant.id,
      name: restaurant.name,
      description: restaurant.description || '',
      phone: restaurant.phone || '',
      email: restaurant.email || '',
      cuisine: restaurant.cuisine || '',
      isActive: restaurant.isActive,
      ownerId: restaurant.ownerId || '',
      createdAt: restaurant.createdAt ? new Date(restaurant.createdAt).toISOString() : '',
      updatedAt: restaurant.updatedAt ? new Date(restaurant.updatedAt).toISOString() : '',
      location: location
        ? {
            id: location.id,
            restaurantId: location.restaurantId,
            address: location.address,
            city: location.city,
            state: location.state || '',
            zipCode: location.zipCode || '',
            country: location.country || '',
            latitude: location.latitude || '',
            longitude: location.longitude || '',
          }
        : undefined,
      openingHours: hoursList.map((h) => ({
        id: h.id,
        restaurantId: h.restaurantId,
        dayOfWeek: h.dayOfWeek,
        openTime: h.openTime,
        closeTime: h.closeTime,
        isClosed: h.isClosed,
      })),
      houseRules: rulesList.map((r) => ({
        id: r.id,
        restaurantId: r.restaurantId,
        rule: r.rule,
        createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : '',
      })),
    };
  }
}
