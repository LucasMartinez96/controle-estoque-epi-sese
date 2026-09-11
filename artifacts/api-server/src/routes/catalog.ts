import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import {
  categoriesTable,
  db,
  productsTable,
  suppliersTable,
} from "@workspace/db";
import { GetCatalogSummaryResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/catalog/summary", async (_req, res): Promise<void> => {
  const [productSummary, categorySummary, supplierSummary] = await Promise.all([
    db
      .select({
        totalProducts: sql<number>`count(${productsTable.id})::int`,
        activeProducts: sql<number>`count(*) filter (where ${productsTable.isActive} = 1)::int`,
        totalStockValue: sql<number>`coalesce(sum(${productsTable.currentStock} * ${productsTable.unitCost}), 0)::float8`,
      })
      .from(productsTable),
    db
      .select({
        activeCategories: sql<number>`count(*) filter (where ${categoriesTable.isActive} = 1)::int`,
      })
      .from(categoriesTable),
    db
      .select({
        activeSuppliers: sql<number>`count(*) filter (where ${suppliersTable.isActive} = 1)::int`,
      })
      .from(suppliersTable),
  ]);

  const summary = {
    totalProducts: productSummary[0]?.totalProducts ?? 0,
    activeProducts: productSummary[0]?.activeProducts ?? 0,
    activeCategories: categorySummary[0]?.activeCategories ?? 0,
    activeSuppliers: supplierSummary[0]?.activeSuppliers ?? 0,
    totalStockValue: productSummary[0]?.totalStockValue ?? 0,
  };

  res.json(GetCatalogSummaryResponse.parse(summary));
});

export default router;