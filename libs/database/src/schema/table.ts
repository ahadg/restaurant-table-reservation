import { sql } from "drizzle-orm";
import {
    pgTable,
    uuid,
    varchar,
    timestamp,
    integer,
    index,
    uniqueIndex,
    jsonb,
    check,
} from "drizzle-orm/pg-core";

// restaurantId / ownerId are plain UUIDs — no FK, those rows live in other services.

export const floor = pgTable(
    "floor",
    {
        id: uuid("id").defaultRandom().primaryKey(),
        restaurantId: uuid("restaurant_id").notNull(),
        floorNumber: integer("floor_number").notNull(),
        name: varchar("name", { length: 255 }), // optional label, e.g. "Rooftop"
        createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
        updatedAt: timestamp("updated_at", { withTimezone: true })
            .defaultNow()
            .notNull()
            .$onUpdate(() => new Date()),
    },
    (t) => [
        index("floor_restaurant_idx").on(t.restaurantId),
        uniqueIndex("floor_restaurant_number_uq").on(t.restaurantId, t.floorNumber),
    ]
);

export const restaurantTable = pgTable(
    "restaurant_tables",
    {
        id: uuid("id").defaultRandom().primaryKey(),
        floorId: uuid("floor_id")
            .notNull()
            .references(() => floor.id, { onDelete: "cascade" }),
        restaurantId: uuid("restaurant_id").notNull(),
        ownerId: uuid("owner_id"),
        name: varchar("name", { length: 255 }).notNull(),
        tableNumber: integer("table_number").notNull(),
        capacity: integer("capacity").notNull(),
        createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
        updatedAt: timestamp("updated_at", { withTimezone: true })
            .defaultNow()
            .notNull()
            .$onUpdate(() => new Date()),
    },
    (t) => [
        index("restaurant_tables_owner_idx").on(t.ownerId),
        index("restaurant_tables_floor_idx").on(t.floorId),
        uniqueIndex("restaurant_tables_floor_number_uq").on(t.floorId, t.tableNumber),
        check("restaurant_tables_capacity_positive", sql`${t.capacity} > 0`),
    ]
);

export const tableCombinations = pgTable(
    "table_combinations",
    {
        id: uuid("id").defaultRandom().primaryKey(),
        floorId: uuid("floor_id")
            .notNull()
            .references(() => floor.id, { onDelete: "cascade" }),
        // Array of restaurant_tables.id values that can be joined together
        combination: jsonb("combination").$type<string[]>().notNull(),
    },
    (t) => [index("table_combinations_floor_idx").on(t.floorId)]
);

export type RestaurantTable = typeof restaurantTable.$inferSelect;
export type NewRestaurantTable = typeof restaurantTable.$inferInsert;
export type Floor = typeof floor.$inferSelect;
export type NewFloor = typeof floor.$inferInsert;
export type TableCombination = typeof tableCombinations.$inferSelect;
export type NewTableCombination = typeof tableCombinations.$inferInsert;