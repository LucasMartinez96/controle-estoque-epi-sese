import { createInsertSchema } from "drizzle-zod";
import { sql } from "drizzle-orm";
import {
  check,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const categoriesTable = pgTable(
  "categories",
  {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    name: varchar("name", { length: 120 }).notNull(),
    isActive: integer("is_active").default(1).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
  },
  (table) => [uniqueIndex("categories_name_uidx").on(table.name)],
);

export const suppliersTable = pgTable(
  "suppliers",
  {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    name: varchar("name", { length: 160 }).notNull(),
    phone: varchar("phone", { length: 40 }),
    whatsapp: varchar("whatsapp", { length: 40 }),
    email: varchar("email", { length: 255 }),
    notes: text("notes"),
    isActive: integer("is_active").default(1).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
  },
  (table) => [uniqueIndex("suppliers_name_uidx").on(table.name)],
);

export const productsTable = pgTable(
  "products",
  {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    name: varchar("name", { length: 160 }).notNull(),
    categoryId: integer("category_id")
      .notNull()
      .references(() => categoriesTable.id, { onDelete: "restrict" }),
    supplierId: integer("supplier_id").references(() => suppliersTable.id, {
      onDelete: "set null",
    }),
    ca: varchar("ca", { length: 30 }).notNull(),
    manufacturer: varchar("manufacturer", { length: 120 }).notNull(),
    size: varchar("size", { length: 40 }),
    unit: varchar("unit", { length: 10 }).notNull(),
    currentStock: numeric("current_stock", {
      precision: 14,
      scale: 3,
      mode: "number",
    })
      .default(0)
      .notNull(),
    minimumStock: numeric("minimum_stock", {
      precision: 14,
      scale: 3,
      mode: "number",
    })
      .default(0)
      .notNull(),
    maximumStock: numeric("maximum_stock", {
      precision: 14,
      scale: 3,
      mode: "number",
    })
      .default(0)
      .notNull(),
    unitCost: numeric("unit_cost", {
      precision: 14,
      scale: 2,
      mode: "number",
    })
      .default(0)
      .notNull(),
    isActive: integer("is_active").default(1).notNull(),
    createdByUserId: integer("created_by_user_id").references(
      () => usersTable.id,
      { onDelete: "set null" },
    ),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("products_name_uidx").on(table.name),
    check(
      "products_minimum_stock_non_negative_ck",
      sql`${table.minimumStock} >= 0`,
    ),
    check(
      "products_maximum_stock_non_negative_ck",
      sql`${table.maximumStock} >= 0`,
    ),
    check(
      "products_maximum_at_least_minimum_ck",
      sql`${table.maximumStock} >= ${table.minimumStock}`,
    ),
    check("products_unit_cost_non_negative_ck", sql`${table.unitCost} >= 0`),
  ],
);

export const insertCategorySchema = createInsertSchema(categoriesTable).omit({
  createdAt: true,
  updatedAt: true,
});
export const insertSupplierSchema = createInsertSchema(suppliersTable).omit({
  createdAt: true,
  updatedAt: true,
});
export const insertProductSchema = createInsertSchema(productsTable).omit({
  createdAt: true,
  updatedAt: true,
});

export type Category = typeof categoriesTable.$inferSelect;
export type InsertCategory = typeof categoriesTable.$inferInsert;
export type Supplier = typeof suppliersTable.$inferSelect;
export type InsertSupplier = typeof suppliersTable.$inferInsert;
export type Product = typeof productsTable.$inferSelect;
export type InsertProduct = typeof productsTable.$inferInsert;