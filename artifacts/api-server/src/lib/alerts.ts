import { and, desc, eq } from "drizzle-orm";
import {
  db,
  productsTable,
  stockAlertsTable,
  type StockAlertStatus,
} from "@workspace/db";
import { notifyLowStock } from "./notifications/telegram-notification-service";
import { notifyLowStockByEmail } from "./notifications/email-notification-service";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export class AlertError extends Error {
  code: "NOT_FOUND" | "ALREADY_RESOLVED";

  constructor(code: "NOT_FOUND" | "ALREADY_RESOLVED", message: string) {
    super(message);
    this.name = "AlertError";
    this.code = code;
  }
}

export async function syncStockAlert(
  tx: Tx,
  params: { productId: number; currentStock: number; minimumStock: number },
): Promise<LowStockNotificationPayload | null> {
  const { productId, currentStock, minimumStock } = params;

  const [openAlert] = await tx
    .select()
    .from(stockAlertsTable)
    .where(
      and(
        eq(stockAlertsTable.productId, productId),
        eq(stockAlertsTable.status, "OPEN"),
      ),
    );

  const shouldBeOpen = currentStock <= minimumStock;

  if (shouldBeOpen && !openAlert) {
    const [inserted] = await tx
      .insert(stockAlertsTable)
      .values({
        productId,
        status: "OPEN",
        stockAtTrigger: currentStock,
        minimumStockAtTrigger: minimumStock,
      })
      .returning();

    return buildLowStockNotificationPayload(tx, {
      productId,
      alertId: inserted.id,
      currentStock,
      minimumStock,
    });
  }

  if (!shouldBeOpen && openAlert) {
    await tx
      .update(stockAlertsTable)
      .set({ status: "RESOLVED", resolvedAt: new Date() })
      .where(eq(stockAlertsTable.id, openAlert.id));
  }

  return null;
}

export interface LowStockNotificationPayload {
  productId: number;
  alertId: number;
  productName: string;
  ca: string;
  unit: string;
  currentStock: number;
  minimumStock: number;
  maximumStock: number;
}

async function buildLowStockNotificationPayload(
  tx: Tx,
  params: {
    productId: number;
    alertId: number;
    currentStock: number;
    minimumStock: number;
  },
): Promise<LowStockNotificationPayload | null> {
  const [product] = await tx
    .select({
      name: productsTable.name,
      ca: productsTable.ca,
      unit: productsTable.unit,
      maximumStock: productsTable.maximumStock,
    })
    .from(productsTable)
    .where(eq(productsTable.id, params.productId));

  if (!product) return null;

  return {
    productId: params.productId,
    alertId: params.alertId,
    productName: product.name,
    ca: product.ca,
    unit: product.unit,
    currentStock: params.currentStock,
    minimumStock: params.minimumStock,
    maximumStock: product.maximumStock,
  };
}

/**
 * Notificações são processadas somente depois do COMMIT. Falha de um canal
 * é registrada e nunca desfaz a movimentação de estoque já confirmada.
 */
export async function dispatchLowStockNotification(
  payload: LowStockNotificationPayload | null,
): Promise<void> {
  if (!payload) return;

  const channels = [
    { name: "telegram", send: () => notifyLowStock(payload) },
    { name: "email", send: () => notifyLowStockByEmail(payload) },
  ];

  await Promise.all(
    channels.map(async ({ name, send }) => {
      try {
        await send();
      } catch (error) {
        console.error(`[${name}-notification] Falha ao processar alerta de estoque mínimo.`, {
          productId: payload.productId,
          alertId: payload.alertId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }),
  );
}

export async function alertResponse(id: number) {
  const [row] = await db
    .select({
      alert: stockAlertsTable,
      productName: productsTable.name,
      unit: productsTable.unit,
    })
    .from(stockAlertsTable)
    .innerJoin(productsTable, eq(stockAlertsTable.productId, productsTable.id))
    .where(eq(stockAlertsTable.id, id));

  if (!row) return undefined;

  return {
    ...row.alert,
    productName: row.productName,
    unit: row.unit,
  };
}

export async function listAlertRows(options: {
  status?: StockAlertStatus;
  productId?: number;
  limit: number;
}) {
  const filters = [];
  if (options.status !== undefined) {
    filters.push(eq(stockAlertsTable.status, options.status));
  }
  if (options.productId !== undefined) {
    filters.push(eq(stockAlertsTable.productId, options.productId));
  }

  const rows = await db
    .select({
      alert: stockAlertsTable,
      productName: productsTable.name,
      unit: productsTable.unit,
    })
    .from(stockAlertsTable)
    .innerJoin(productsTable, eq(stockAlertsTable.productId, productsTable.id))
    .where(filters.length > 0 ? and(...filters) : undefined)
    .orderBy(desc(stockAlertsTable.triggeredAt))
    .limit(options.limit);

  return rows.map((row) => ({
    ...row.alert,
    productName: row.productName,
    unit: row.unit,
  }));
}

export async function resolveAlertById(
  id: number,
  userId?: number | null,
): Promise<void> {
  await db.transaction(async (tx) => {
    const [alert] = await tx
      .select()
      .from(stockAlertsTable)
      .where(eq(stockAlertsTable.id, id))
      .for("update");

    if (!alert) {
      throw new AlertError("NOT_FOUND", "Alerta não encontrado.");
    }
    if (alert.status === "RESOLVED") {
      throw new AlertError("ALREADY_RESOLVED", "Alerta já está resolvido.");
    }

    await tx
      .update(stockAlertsTable)
      .set({
        status: "RESOLVED",
        resolvedAt: new Date(),
        resolvedByUserId: userId ?? null,
      })
      .where(eq(stockAlertsTable.id, id));
  });
}
