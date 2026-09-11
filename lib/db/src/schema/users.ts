import { createInsertSchema } from "drizzle-zod";
import {
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

export const usersTable = pgTable(
  "users",
  {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    externalAuthId: varchar("external_auth_id", { length: 255 }),
    name: varchar("name", { length: 160 }).notNull(),
    email: varchar("email", { length: 255 }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("users_external_auth_id_uidx").on(table.externalAuthId),
    uniqueIndex("users_email_uidx").on(table.email),
  ],
);

export const insertUserSchema = createInsertSchema(usersTable).omit({
  createdAt: true,
});
export type InsertUser = typeof usersTable.$inferInsert;
export type User = typeof usersTable.$inferSelect;