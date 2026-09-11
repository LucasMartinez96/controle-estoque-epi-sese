import { and, desc, eq } from "drizzle-orm";
import {
  db,
  productsTable,
  stockAlertsTable,
  type StockAlertStatus,
} from "@workspace/db";
import { notifyLowStock } from "./notifications/telegram-notification-service";

// The transaction type isn't exported directly by drizzle in a convenient
// way, so it's derived from `db.transaction`'s own callback parameter. This
// keeps `syncStockAlert` usable both from inside `createMovement`'s
// transaction and from a dedicated transaction of its own.
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export class AlertError extends Error {
  code: "NOT_FOUND" | "ALREADY_RESOLVED";

  constructor(code: "NOT_FOUND" | "ALREADY_RESOLVED", message: string) {
    super(message);
    this.name = "AlertError";
    this.code = code;
  }
}

/**
 * Single source of truth for opening/resolving stock alerts. Call this
 * every time a product's currentStock or minimumStock may have changed
 * (after a movement, after creating a product with an initial stock, or
 * after editing a product's minimum stock) — never open/resolve an alert
 * anywhere else.
 *
 * Regra: estoque atual <= estoque mínimo => alerta OPEN.
 * Quando o estoque volta a ficar acima do mínimo, o alerta OPEN existente
 * é marcado como RESOLVED. Nunca duplica um alerta OPEN para o mesmo
 * produto (o banco também garante isso via índice único).
 */
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

    // Um alerta novo (não um que já estava OPEN) dispara a notificação —
    // é essa checagem, junto com o "shouldBeOpen && !openAlert" acima,
    // que evita mensagens duplicadas enquanto o mesmo alerta continuar
    // aberto (ex.: estoque cai de 8 para 7 com mínimo 10: openAlert já
    // existe, então este bloco nem roda de novo).
    const notification = await buildLowStockNotificationPayload(tx, {
      productId,
      alertId: inserted.id,
      currentStock,
      minimumStock,
    });
    return notification;
  }

  if (!shouldBeOpen && openAlert) {
    await tx
      .update(stockAlertsTable)
      .set({ status: "RESOLVED", resolvedAt: new Date() })
      .where(eq(stockAlertsTable.id, openAlert.id));
  }

  return null;
}

/** Dados necessários para enviar a notificação depois do COMMIT da transação. */
export interface LowStockNotificationPayload {
  productId: number;
  alertId: number;
  productName: string;
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
    unit: product.unit,
    currentStock: params.currentStock,
    minimumStock: params.minimumStock,
    maximumStock: product.maximumStock,
  };
}

/**
 * Envia o Telegram fora da transação. Qualquer falha é apenas registrada e
 * nunca desfaz uma movimentação ou alteração de estoque já confirmada.
 */
export async function dispatchLowStockNotification(
  payload: LowStockNotificationPayload | null,
): Promise<void> {
  if (!payload) return;

  try {
    await notifyLowStock(payload);
  } catch (error) {
    console.error(
      "[telegram-notification] Falha ao processar alerta de estoque mínimo.",
      {
        productId: payload.productId,
        alertId: payload.alertId,
        error: error instanceof Error ? error.message : String(error),
      },
    );
  }
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

/**
 * Manual resolution (e.g. the user restocked outside of a registered
 * movement and just wants to clear the alert). Automatic resolution still
 * happens via `syncStockAlert` whenever stock/minimum changes.
 */
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
