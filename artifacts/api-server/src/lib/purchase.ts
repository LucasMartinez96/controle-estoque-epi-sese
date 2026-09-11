import { and, asc, desc, eq, inArray, lte } from "drizzle-orm";
import {
  db,
  categoriesTable,
  productsTable,
  purchaseListItemsTable,
  suppliersTable,
  type PurchaseListStatus,
} from "@workspace/db";

/**
 * Regra de quantidade sugerida para a Lista de Compras.
 *
 * quantidade sugerida = estoque máximo - estoque atual, nunca negativa.
 * Produtos com estoque acima do máximo retornam 0 (não entram na lista).
 * Esta é a única função que calcula quantidade sugerida — reutilizada
 * tanto na listagem quanto ao marcar um item como comprado.
 */
export function suggestedPurchaseQuantity(
  currentStock: number,
  maximumStock: number,
): number {
  const diff = maximumStock - currentStock;
  return diff > 0 ? diff : 0;
}

export class PurchaseListError extends Error {
  code: "NOT_ELIGIBLE";

  constructor(code: "NOT_ELIGIBLE", message: string) {
    super(message);
    this.name = "PurchaseListError";
    this.code = code;
  }
}

/**
 * Lista de compras: sempre calculada ao vivo a partir dos produtos reais
 * (estoque atual, mínimo, máximo já cadastrados) — nunca de dados
 * fictícios e nunca duplicando a regra de estoque. Marcar um item como
 * comprado/pendente NUNCA altera productsTable.currentStock; isso só
 * acontece via Entrada, Saída ou Ajuste (lib/movements.ts).
 *
 * Regra: só entram produtos ativos com currentStock <= minimumStock e
 * quantidade sugerida > 0 (estoque acima do máximo nunca entra).
 */
export async function listPurchaseCandidates(options?: { productId?: number }) {
  const filters = [
    eq(productsTable.isActive, 1),
    lte(productsTable.currentStock, productsTable.minimumStock),
  ];
  if (options?.productId !== undefined) {
    filters.push(eq(productsTable.id, options.productId));
  }

  const products = await db
    .select({
      id: productsTable.id,
      name: productsTable.name,
      unit: productsTable.unit,
      currentStock: productsTable.currentStock,
      minimumStock: productsTable.minimumStock,
      maximumStock: productsTable.maximumStock,
      unitCost: productsTable.unitCost,
      categoryId: productsTable.categoryId,
      categoryName: categoriesTable.name,
      supplierId: productsTable.supplierId,
      supplierName: suppliersTable.name,
    })
    .from(productsTable)
    .innerJoin(categoriesTable, eq(productsTable.categoryId, categoriesTable.id))
    .leftJoin(suppliersTable, eq(productsTable.supplierId, suppliersTable.id))
    .where(and(...filters));

  const candidates = products
    .map((product) => ({
      ...product,
      suggestedQuantity: suggestedPurchaseQuantity(product.currentStock, product.maximumStock),
    }))
    .filter((product) => product.suggestedQuantity > 0);

  if (candidates.length === 0) return [];

  // Última linha de acompanhamento (pendente/comprado) por produto, se
  // existir. Ids são sequenciais, então a última em ordem crescente é a
  // mais recente — evita subquery de "latest per group".
  const trackingRows = await db
    .select()
    .from(purchaseListItemsTable)
    .where(
      inArray(
        purchaseListItemsTable.productId,
        candidates.map((candidate) => candidate.id),
      ),
    )
    .orderBy(asc(purchaseListItemsTable.id));

  const latestByProduct = new Map<number, (typeof trackingRows)[number]>();
  for (const row of trackingRows) {
    latestByProduct.set(row.productId, row);
  }

  return candidates.map((product) => {
    const tracking = latestByProduct.get(product.id);
    const status: PurchaseListStatus = tracking?.status === "PURCHASED" ? "PURCHASED" : "PENDING";
    return {
      productId: product.id,
      productName: product.name,
      categoryId: product.categoryId,
      categoryName: product.categoryName,
      supplierId: product.supplierId,
      supplierName: product.supplierName ?? null,
      unit: product.unit,
      currentStock: product.currentStock,
      minimumStock: product.minimumStock,
      maximumStock: product.maximumStock,
      unitCost: product.unitCost,
      suggestedQuantity: product.suggestedQuantity,
      estimatedCost: Math.round(product.suggestedQuantity * product.unitCost * 100) / 100,
      status,
      markedPurchasedAt: status === "PURCHASED" ? (tracking?.markedPurchasedAt ?? null) : null,
    };
  });
}

/**
 * Marca um produto elegível como comprado. Não toca em currentStock —
 * o estoque só muda via Entrada/Saída/Ajuste.
 */
export async function markPurchaseItemPurchased(productId: number): Promise<void> {
  const [product] = await db
    .select()
    .from(productsTable)
    .where(eq(productsTable.id, productId));

  if (!product) {
    throw new PurchaseListError("NOT_ELIGIBLE", "Produto não encontrado.");
  }

  const suggestedQuantity = suggestedPurchaseQuantity(product.currentStock, product.maximumStock);
  if (product.isActive !== 1 || product.currentStock > product.minimumStock || suggestedQuantity <= 0) {
    throw new PurchaseListError(
      "NOT_ELIGIBLE",
      "Este produto não está na lista de compras no momento.",
    );
  }

  const [pending] = await db
    .select()
    .from(purchaseListItemsTable)
    .where(
      and(
        eq(purchaseListItemsTable.productId, productId),
        eq(purchaseListItemsTable.status, "PENDING"),
      ),
    );

  if (pending) {
    await db
      .update(purchaseListItemsTable)
      .set({
        status: "PURCHASED",
        suggestedQuantity,
        markedPurchasedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(purchaseListItemsTable.id, pending.id));
  } else {
    await db.insert(purchaseListItemsTable).values({
      productId,
      suggestedQuantity,
      status: "PURCHASED",
      markedPurchasedAt: new Date(),
    });
  }
}

/**
 * Reverte um item para pendente. Também não altera o estoque.
 */
export async function markPurchaseItemPending(productId: number): Promise<void> {
  const [mostRecent] = await db
    .select()
    .from(purchaseListItemsTable)
    .where(eq(purchaseListItemsTable.productId, productId))
    .orderBy(desc(purchaseListItemsTable.id));

  if (!mostRecent || mostRecent.status === "PENDING") {
    return;
  }

  await db
    .update(purchaseListItemsTable)
    .set({ status: "PENDING", markedPurchasedAt: null, updatedAt: new Date() })
    .where(eq(purchaseListItemsTable.id, mostRecent.id));
}
