import { and, asc, desc, eq, gt, ilike, or, sql } from "drizzle-orm";
import {
  db,
  inventoryLotsTable,
  inventoryMovementsTable,
  inventorySettingsTable,
  productsTable,
  suppliersTable,
  type MovementType,
} from "@workspace/db";
import { dispatchLowStockNotification, syncStockAlert } from "./alerts";

export class MovementError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MovementError";
  }
}

async function getAllowNegativeStock(): Promise<boolean> {
  const [settings] = await db.select().from(inventorySettingsTable).limit(1);
  return settings ? settings.allowNegativeStock === 1 : false;
}

async function consumeLotsFefo(tx: any, productId: number, quantity: number) {
  let remaining = quantity;
  const lots = await tx.select().from(inventoryLotsTable)
    .where(and(eq(inventoryLotsTable.productId, productId), gt(inventoryLotsTable.currentQuantity, 0)))
    .orderBy(sql`${inventoryLotsTable.expirationDate} ASC NULLS LAST`, asc(inventoryLotsTable.receivedAt), asc(inventoryLotsTable.id))
    .for("update");

  for (const lot of lots) {
    if (remaining <= 0) break;
    const consumed = Math.min(lot.currentQuantity, remaining);
    await tx.update(inventoryLotsTable)
      .set({ currentQuantity: lot.currentQuantity - consumed })
      .where(eq(inventoryLotsTable.id, lot.id));
    remaining -= consumed;
  }
  if (remaining > 0.000001) {
    throw new MovementError("Saldo por lote insuficiente. Confira os lotes do EPI.");
  }
}

/**
 * Registers a stock movement (ENTRY, EXIT or ADJUSTMENT) and updates the
 * product's currentStock, all inside a single transaction so the movement
 * history and the live balance can never drift apart.
 */
export async function createMovement(input: {
  productId: number;
  type: MovementType;
  quantity?: number;
  newStock?: number;
  supplierId?: number | null;
  unitCost?: number | null;
  reason?: string | null;
  notes?: string | null;
  userId?: number | null;
  lotCode?: string | null;
  expirationDate?: string | null;
  recipientName?: string | null;
  recipientRegistration?: string | null;
}) {
  const result = await db.transaction(async (tx) => {
    const [product] = await tx
      .select()
      .from(productsTable)
      .where(eq(productsTable.id, input.productId))
      .for("update");

    if (!product) {
      throw new MovementError("Produto não encontrado.");
    }
    if (product.isActive !== 1) {
      throw new MovementError(
        "Não é possível movimentar um produto desativado.",
      );
    }

    const stockBefore = product.currentStock;
    let stockAfter: number;
    let quantity: number;
    let adjustmentDifference: number | null = null;
    let lotId: number | null = null;

    if (input.type === "ENTRY") {
      if (input.quantity === undefined || input.quantity <= 0) {
        throw new MovementError(
          "Informe uma quantidade maior que zero para a entrada.",
        );
      }
      const lotCode = input.lotCode?.trim();
      const expirationDate = input.expirationDate?.trim();
      if (!lotCode) throw new MovementError("Informe o lote do EPI para registrar a entrada.");
      if (!expirationDate || !/^\d{4}-\d{2}-\d{2}$/.test(expirationDate)) {
        throw new MovementError("Informe uma validade válida para o lote (AAAA-MM-DD).");
      }
      quantity = input.quantity;
      stockAfter = stockBefore + quantity;
      const [lot] = await tx.insert(inventoryLotsTable).values({
        productId: input.productId, lotCode, expirationDate,
        initialQuantity: quantity, currentQuantity: quantity,
        supplierId: input.supplierId ?? product.supplierId ?? null,
        unitCost: input.unitCost ?? product.unitCost ?? null,
      }).returning();
      lotId = lot.id;
    } else if (input.type === "EXIT") {
      if (input.quantity === undefined || input.quantity <= 0) {
        throw new MovementError(
          "Informe uma quantidade maior que zero para a saída.",
        );
      }
      const recipientName = input.recipientName?.trim();
      const recipientRegistration = input.recipientRegistration?.trim();
      if (!recipientName) {
        throw new MovementError("Informe o colaborador que recebeu o EPI.");
      }
      if (!recipientRegistration) {
        throw new MovementError("Informe a matrícula do colaborador.");
      }
      quantity = input.quantity;
      stockAfter = stockBefore - quantity;

      const allowNegative = await getAllowNegativeStock();
      if (stockAfter < 0 && !allowNegative) {
        throw new MovementError(
          `Estoque insuficiente. Disponível: ${stockBefore} ${product.unit}.`,
        );
      }
      if (stockAfter >= 0) await consumeLotsFefo(tx, input.productId, quantity);
    } else if (input.type === "ADJUSTMENT") {
      if (input.newStock === undefined || input.newStock < 0) {
        throw new MovementError(
          "Informe a nova contagem de estoque (maior ou igual a zero).",
        );
      }
      adjustmentDifference = input.newStock - stockBefore;
      quantity = Math.abs(adjustmentDifference);
      if (quantity === 0) {
        throw new MovementError(
          "A nova contagem é igual ao estoque atual — nada para registrar.",
        );
      }
      stockAfter = input.newStock;
      if (adjustmentDifference < 0) {
        await consumeLotsFefo(tx, input.productId, Math.abs(adjustmentDifference));
      } else if (adjustmentDifference > 0) {
        const [adjustmentLot] = await tx.insert(inventoryLotsTable).values({
          productId: input.productId,
          lotCode: `AJUSTE-${Date.now()}`,
          expirationDate: null,
          initialQuantity: adjustmentDifference,
          currentQuantity: adjustmentDifference,
          supplierId: product.supplierId ?? null,
          unitCost: product.unitCost ?? null,
        }).returning();
        lotId = adjustmentLot.id;
      }
    } else {
      throw new MovementError("Tipo de movimentação inválido.");
    }

    const [movement] = await tx
      .insert(inventoryMovementsTable)
      .values({
        productId: input.productId,
        type: input.type,
        lotId,
        quantity,
        stockBefore,
        stockAfter,
        adjustmentDifference,
        supplierId: input.supplierId ?? null,
        unitCost: input.unitCost ?? null,
        recipientName: input.type === "EXIT" ? input.recipientName?.trim() || null : null,
        recipientRegistration: input.type === "EXIT" ? input.recipientRegistration?.trim() || null : null,
        reason: input.reason ?? null,
        notes: input.notes ?? null,
        userId: input.userId ?? null,
      })
      .returning();

    await tx
      .update(productsTable)
      .set({ currentStock: stockAfter, updatedAt: new Date() })
      .where(eq(productsTable.id, input.productId));

    // Estoque atual <= estoque mínimo abre/mantém o alerta; acima do
    // mínimo resolve um alerta OPEN existente. Único ponto que altera
    // o estoque, então único ponto que precisa resincronizar o alerta.
    const lowStockNotification = await syncStockAlert(tx, {
      productId: input.productId,
      currentStock: stockAfter,
      minimumStock: product.minimumStock,
    });

    return {
      movement,
      product: { ...product, currentStock: stockAfter },
      lowStockNotification,
    };
  });

  await dispatchLowStockNotification(result.lowStockNotification);
  return result;
}

export async function getMovementResponse(id: number) {
  const [row] = await db
    .select({
      movement: inventoryMovementsTable,
      productName: productsTable.name,
      unit: productsTable.unit,
      supplierName: suppliersTable.name,
      lotCode: inventoryLotsTable.lotCode,
      expirationDate: inventoryLotsTable.expirationDate,
    })
    .from(inventoryMovementsTable)
    .innerJoin(
      productsTable,
      eq(inventoryMovementsTable.productId, productsTable.id),
    )
    .leftJoin(
      suppliersTable,
      eq(inventoryMovementsTable.supplierId, suppliersTable.id),
    )
    .leftJoin(
      inventoryLotsTable,
      eq(inventoryMovementsTable.lotId, inventoryLotsTable.id),
    )
    .where(eq(inventoryMovementsTable.id, id));

  if (!row) return undefined;

  return {
    ...row.movement,
    productName: row.productName,
    unit: row.unit,
    supplierName: row.supplierName ?? null,
    lotCode: row.lotCode ?? null,
    expirationDate: row.expirationDate ?? null,
  };
}

export async function listMovementRows(options: {
  productId?: number;
  type?: MovementType;
  recipientSearch?: string;
  limit: number;
}) {
  const filters = [];
  if (options.productId !== undefined) {
    filters.push(eq(inventoryMovementsTable.productId, options.productId));
  }
  if (options.type !== undefined) {
    filters.push(eq(inventoryMovementsTable.type, options.type));
  }
  const recipientSearch = options.recipientSearch?.trim();
  if (recipientSearch) {
    const pattern = `%${recipientSearch}%`;
    filters.push(
      or(
        ilike(inventoryMovementsTable.recipientName, pattern),
        ilike(inventoryMovementsTable.recipientRegistration, pattern),
      )!,
    );
  }

  const rows = await db
    .select({
      movement: inventoryMovementsTable,
      productName: productsTable.name,
      unit: productsTable.unit,
      supplierName: suppliersTable.name,
      lotCode: inventoryLotsTable.lotCode,
      expirationDate: inventoryLotsTable.expirationDate,
    })
    .from(inventoryMovementsTable)
    .innerJoin(
      productsTable,
      eq(inventoryMovementsTable.productId, productsTable.id),
    )
    .leftJoin(
      suppliersTable,
      eq(inventoryMovementsTable.supplierId, suppliersTable.id),
    )
    .leftJoin(
      inventoryLotsTable,
      eq(inventoryMovementsTable.lotId, inventoryLotsTable.id),
    )
    .where(filters.length > 0 ? and(...filters) : undefined)
    .orderBy(desc(inventoryMovementsTable.occurredAt))
    .limit(options.limit);

  return rows.map((row) => ({
    ...row.movement,
    productName: row.productName,
    unit: row.unit,
    supplierName: row.supplierName ?? null,
    lotCode: row.lotCode ?? null,
    expirationDate: row.expirationDate ?? null,
  }));
}

