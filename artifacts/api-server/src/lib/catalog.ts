import { and, eq, ilike, sql } from "drizzle-orm";
import {
  categoriesTable,
  productsTable,
  suppliersTable,
} from "@workspace/db";
import { db } from "@workspace/db";

export function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "23505"
  );
}

export function normalizeRequiredName(value: string): string | null {
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

export function categoryResponse(category: typeof categoriesTable.$inferSelect) {
  return {
    ...category,
    isActive: category.isActive === 1,
  };
}

export function supplierResponse(supplier: typeof suppliersTable.$inferSelect) {
  return {
    ...supplier,
    isActive: supplier.isActive === 1,
  };
}

export async function getCategory(id: number) {
  const [category] = await db
    .select()
    .from(categoriesTable)
    .where(eq(categoriesTable.id, id));
  return category;
}

export async function getSupplier(id: number) {
  const [supplier] = await db
    .select()
    .from(suppliersTable)
    .where(eq(suppliersTable.id, id));
  return supplier;
}

export async function getProduct(id: number) {
  const [product] = await db
    .select()
    .from(productsTable)
    .where(eq(productsTable.id, id));
  return product;
}

export async function productResponse(id: number) {
  const [row] = await db
    .select({
      product: productsTable,
      categoryName: categoriesTable.name,
      supplierName: suppliersTable.name,
    })
    .from(productsTable)
    .innerJoin(categoriesTable, eq(productsTable.categoryId, categoriesTable.id))
    .leftJoin(suppliersTable, eq(productsTable.supplierId, suppliersTable.id))
    .where(eq(productsTable.id, id));

  if (!row) return undefined;

  return {
    ...row.product,
    categoryName: row.categoryName,
    supplierName: row.supplierName ?? null,
    isActive: row.product.isActive === 1,
  };
}

export async function listProductRows(options: {
  search?: string;
  categoryId?: number;
  activeOnly: boolean;
}) {
  const filters = [];

  if (options.activeOnly) {
    filters.push(eq(productsTable.isActive, 1));
  }
  if (options.categoryId !== undefined) {
    filters.push(eq(productsTable.categoryId, options.categoryId));
  }
  if (options.search?.trim()) {
    filters.push(ilike(productsTable.name, `%${options.search.trim()}%`));
  }

  const rows = await db
    .select({
      product: productsTable,
      categoryName: categoriesTable.name,
      supplierName: suppliersTable.name,
    })
    .from(productsTable)
    .innerJoin(categoriesTable, eq(productsTable.categoryId, categoriesTable.id))
    .leftJoin(suppliersTable, eq(productsTable.supplierId, suppliersTable.id))
    .where(filters.length > 0 ? and(...filters) : undefined)
    .orderBy(sql`lower(${productsTable.name})`);

  return rows.map((row) => ({
    ...row.product,
    categoryName: row.categoryName,
    supplierName: row.supplierName ?? null,
    isActive: row.product.isActive === 1,
  }));
}