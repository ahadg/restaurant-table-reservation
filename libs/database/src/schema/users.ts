import {
    pgTable,
    uuid,
    varchar,
    timestamp,
    boolean,
    pgEnum,
    uniqueIndex,
    index,
} from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("role", ["USER", "ADMIN"]);

export const users = pgTable(
    "users",
    {
        id: uuid("id").defaultRandom().primaryKey(),

        name: varchar("name", { length: 255 }).notNull(),

        email: varchar("email", { length: 255 }).notNull(),

        // Store a hashed password (Argon2 or bcrypt), never plaintext
        password: varchar("password", { length: 255 }).notNull(),

        role: roleEnum("role").default("USER").notNull(),

        isActive: boolean("is_active").default(true).notNull(),

        emailVerifiedAt: timestamp("email_verified_at", {
            withTimezone: true,
        }),

        lastLoginAt: timestamp("last_login_at", {
            withTimezone: true,
        }),

        createdAt: timestamp("created_at", {
            withTimezone: true,
        })
            .defaultNow()
            .notNull(),

        updatedAt: timestamp("updated_at", {
            withTimezone: true,
        })
            .defaultNow()
            .notNull(),

        deletedAt: timestamp("deleted_at", {
            withTimezone: true,
        }),
    },
    (table) => ({
        emailUnique: uniqueIndex("users_email_unique").on(table.email),
        roleIndex: index("users_role_idx").on(table.role),
        // activeIndex: index("users_active_idx").on(table.isActive),
    })
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;