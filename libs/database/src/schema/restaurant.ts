import {
    pgTable,
    uuid,
    varchar,
    timestamp,
    boolean,
    text,
    integer,
    index,
} from "drizzle-orm/pg-core";

// NOTE: No import of `users` here. In a microservices architecture,
// each service owns its own database independently. The `ownerId`
// column stores the user's UUID for cross-service lookups, but does
// NOT have a foreign key constraint to the `users` table (which is
// owned by the Auth Service).

export const restaurants = pgTable(
    "restaurants",
    {
        id: uuid("id").defaultRandom().primaryKey(),
        name: varchar("name", { length: 255 }).notNull(),
        description: text("description"),
        phone: varchar("phone", { length: 50 }),
        email: varchar("email", { length: 255 }),
        cuisine: varchar("cuisine", { length: 100 }),
        isActive: boolean("is_active").default(true).notNull(),
        // Plain UUID — no FK reference to users table (owned by Auth Service)
        ownerId: uuid("owner_id"),
        createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
        updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    },
    (table) => ({
        ownerIndex: index("restaurants_owner_idx").on(table.ownerId),
    })
);

export const locations = pgTable(
    "locations",
    {
        id: uuid("id").defaultRandom().primaryKey(),
        restaurantId: uuid("restaurant_id")
            .references(() => restaurants.id, { onDelete: "cascade" })
            .notNull(),
        address: varchar("address", { length: 255 }).notNull(),
        city: varchar("city", { length: 100 }).notNull(),
        state: varchar("state", { length: 100 }),
        zipCode: varchar("zip_code", { length: 20 }),
        country: varchar("country", { length: 100 }),
        latitude: varchar("latitude", { length: 50 }),
        longitude: varchar("longitude", { length: 50 }),
        createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    },
    (table) => ({
        restaurantIndex: index("locations_restaurant_idx").on(table.restaurantId),
    })
);

export const openingHours = pgTable(
    "opening_hours",
    {
        id: uuid("id").defaultRandom().primaryKey(),
        restaurantId: uuid("restaurant_id")
            .references(() => restaurants.id, { onDelete: "cascade" })
            .notNull(),
        dayOfWeek: integer("day_of_week").notNull(), // 0 = Sunday, 1 = Monday, etc.
        openTime: varchar("open_time", { length: 10 }).notNull(), // e.g. "09:00"
        closeTime: varchar("close_time", { length: 10 }).notNull(), // e.g. "22:00"
        isClosed: boolean("is_closed").default(false).notNull(),
    },
    (table) => ({
        restaurantIndex: index("opening_hours_restaurant_idx").on(table.restaurantId),
    })
);

export const houseRules = pgTable(
    "house_rules",
    {
        id: uuid("id").defaultRandom().primaryKey(),
        restaurantId: uuid("restaurant_id")
            .references(() => restaurants.id, { onDelete: "cascade" })
            .notNull(),
        rule: text("rule").notNull(),
        createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    },
    (table) => ({
        restaurantIndex: index("house_rules_restaurant_idx").on(table.restaurantId),
    })
);

export type Restaurant = typeof restaurants.$inferSelect;
export type NewRestaurant = typeof restaurants.$inferInsert;
export type Location = typeof locations.$inferSelect;
export type NewLocation = typeof locations.$inferInsert;
export type OpeningHours = typeof openingHours.$inferSelect;
export type NewOpeningHours = typeof openingHours.$inferInsert;
export type HouseRule = typeof houseRules.$inferSelect;
export type NewHouseRule = typeof houseRules.$inferInsert;