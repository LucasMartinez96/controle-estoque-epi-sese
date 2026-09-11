import { createInsertSchema } from "drizzle-zod";
import { sql } from "drizzle-orm";
import {
  check,
  date,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { productsTable, suppliersTable } from "./catalog";
import { usersTable } from "./users";

export const movementTypes = [
  "ENTRY",
  "EXIT",
  "ADJUSTMENT",
] as const;
export type MovementType = (typeof movementTypes)[number];

export const inventoryLotsTable = pgTable(
  "inventory_lots",
  {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    productId: integer("product_id").notNull().references(() => productsTable.id, { onDelete: "cascade" }),
    lotCode: varchar("lot_code", { length: 80 }).notNull(),
    expirationDate: date("expiration_date", { mode: "string" }),
    initialQuantity: numeric("initial_quantity", { precision: 14, scale: 3, mode: "number" }).notNull(),
    currentQuantity: numeric("current_quantity", { precision: 14, scale: 3, mode: "number" }).notNull(),
    supplierId: integer("supplier_id").references(() => suppliersTable.id, { onDelete: "set null" }),
    unitCost: numeric("unit_cost", { precision: 14, scale: 2, mode: "number" }),
    receivedAt: timestamp("received_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    check("inventory_lots_initial_quantity_positive_ck", sql`${table.initialQuantity} > 0`),
    check("inventory_lots_current_quantity_non_negative_ck", sql`${table.currentQuantity} >= 0`),
  ],
);

export const inventoryMovementsTable = pgTable(
  "inventory_movements",
  {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    productId: integer("product_id")
      .notNull()
      .references(() => productsTable.id, { onDelete: "restrict" }),
    type: varchar("type", { length: 20 }).$type<MovementType>().notNull(),
    lotId: integer("lot_id").references(() => inventoryLotsTable.id, { onDelete: "set null" }),
    quantity: numeric("quantity", {
      precision: 14,
      scale: 3,
      mode: "number",
    }).notNull(),
    stockBefore: numeric("stock_before", {
      precision: 14,
      scale: 3,
      mode: "number",
    }).notNull(),
    stockAfter: numeric("stock_after", {
      precision: 14,
      scale: 3,
      mode: "number",
    }).notNull(),
    adjustmentDifference: numeric("adjustment_difference", {
      precision: 14,
      scale: 3,
      mode: "number",
    }),
    occurredAt: timestamp("occurred_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
    supplierId: integer("supplier_id").references(() => suppliersTable.id, {
      onDelete: "set null",
    }),
    unitCost: numeric("unit_cost", {
      precision: 14,
      scale: 2,
      mode: "number",
    }),
    recipientName: varchar("recipient_name", { length: 160 }),
    recipientRegistration: varchar("recipient_registration", { length: 60 }),
    reason: varchar("reason", { length: 160 }),
    notes: text("notes"),
    userId: integer("user_id").references(() => usersTable.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check("inventory_movements_quantity_positive_ck", sql`${table.quantity} > 0`),
    check(
      "inventory_movements_unit_cost_non_negative_ck",
      sql`${table.unitCost} IS NULL OR ${table.unitCost} >= 0`,
    ),
  ],
);

export const stockAlertStatuses = ["OPEN", "RESOLVED"] as const;
export type StockAlertStatus = (typeof stockAlertStatuses)[number];

export const stockAlertsTable = pgTable(
  "stock_alerts",
  {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    productId: integer("product_id")
      .notNull()
      .references(() => productsTable.id, { onDelete: "cascade" }),
    status: varchar("status", { length: 20 })
      .$type<StockAlertStatus>()
      .default("OPEN")
      .notNull(),
    stockAtTrigger: numeric("stock_at_trigger", {
      precision: 14,
      scale: 3,
      mode: "number",
    }).notNull(),
    minimumStockAtTrigger: numeric("minimum_stock_at_trigger", {
      precision: 14,
      scale: 3,
      mode: "number",
    }).notNull(),
    triggeredAt: timestamp("triggered_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true, mode: "date" }),
    resolvedByUserId: integer("resolved_by_user_id").references(
      () => usersTable.id,
      { onDelete: "set null" },
    ),
  },
  (table) => [
    uniqueIndex("stock_alerts_product_open_uidx")
      .on(table.productId)
      .where(sql`${table.status} = 'OPEN'`),
  ],
);

export const inventorySettingsTable = pgTable(
  "inventory_settings",
  {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    attentionThresholdPercent: numeric("attention_threshold_percent", {
      precision: 5,
      scale: 2,
      mode: "number",
    })
      .default(20)
      .notNull(),
    allowNegativeStock: integer("allow_negative_stock").default(0).notNull(),
    updatedByUserId: integer("updated_by_user_id").references(
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
    check(
      "inventory_settings_attention_threshold_ck",
      sql`${table.attentionThresholdPercent} >= 0 AND ${table.attentionThresholdPercent} <= 100`,
    ),
  ],
);

export const purchaseListStatuses = ["PENDING", "PURCHASED"] as const;
export type PurchaseListStatus = (typeof purchaseListStatuses)[number];

export const purchaseListItemsTable = pgTable(
  "purchase_list_items",
  {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    productId: integer("product_id")
      .notNull()
      .references(() => productsTable.id, { onDelete: "cascade" }),
    suggestedQuantity: numeric("suggested_quantity", {
      precision: 14,
      scale: 3,
      mode: "number",
    }).notNull(),
    status: varchar("status", { length: 20 })
      .$type<PurchaseListStatus>()
      .default("PENDING")
      .notNull(),
    markedPurchasedAt: timestamp("marked_purchased_at", {
      withTimezone: true,
      mode: "date",
    }),
    markedPurchasedByUserId: integer("marked_purchased_by_user_id").references(
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
    check(
      "purchase_list_suggested_quantity_non_negative_ck",
      sql`${table.suggestedQuantity} >= 0`,
    ),
    uniqueIndex("purchase_list_product_pending_uidx")
      .on(table.productId)
      .where(sql`${table.status} = 'PENDING'`),
  ],
);

export const insertInventoryLotSchema = createInsertSchema(inventoryLotsTable).omit({ createdAt: true });
export const insertInventoryMovementSchema = createInsertSchema(
  inventoryMovementsTable,
).omit({
  createdAt: true,
});
export const insertStockAlertSchema = createInsertSchema(stockAlertsTable);
export const insertInventorySettingsSchema = createInsertSchema(
  inventorySettingsTable,
).omit({
  createdAt: true,
  updatedAt: true,
});
export const insertPurchaseListItemSchema = createInsertSchema(
  purchaseListItemsTable,
).omit({
  createdAt: true,
  updatedAt: true,
});

export type InventoryLot = typeof inventoryLotsTable.$inferSelect;
export type InsertInventoryLot = typeof inventoryLotsTable.$inferInsert;
export type InventoryMovement = typeof inventoryMovementsTable.$inferSelect;
export type InsertInventoryMovement =
  typeof inventoryMovementsTable.$inferInsert;
export type StockAlert = typeof stockAlertsTable.$inferSelect;
export type InsertStockAlert = typeof stockAlertsTable.$inferInsert;
export type InventorySettings = typeof inventorySettingsTable.$inferSelect;
export type PurchaseListItem = typeof purchaseListItemsTable.$inferSelect;
export type InsertPurchaseListItem =
  typeof purchaseListItemsTable.$inferInsert;