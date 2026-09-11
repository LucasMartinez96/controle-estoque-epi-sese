import { Router, type IRouter } from "express";
import { and, asc, eq } from "drizzle-orm";
import { db, categoriesTable, productsTable, suppliersTable } from "@workspace/db";
import { dispatchLowStockNotification, syncStockAlert } from "../lib/alerts";
import {
  CreateProductBody,
  CreateProductResponse,
  ListProductsQueryParams,
  ListProductsResponse,
  UpdateProductBody,
  UpdateProductParams,
  UpdateProductResponse,
} from "@workspace/api-zod";
import {
  getCategory,
  getProduct,
  getSupplier,
  isUniqueViolation,
  listProductRows,
  normalizeRequiredName,
  productResponse,
} from "../lib/catalog";

const router: IRouter = Router();

async function validateRelations(categoryId: number, supplierId: number | null | undefined) {
  const category = await getCategory(categoryId);
  if (!category || category.isActive !== 1) {
    return "A categoria selecionada não existe ou está desativada.";
  }

  if (supplierId !== undefined && supplierId !== null) {
    const supplier = await getSupplier(supplierId);
    if (!supplier || supplier.isActive !== 1) {
      return "O fornecedor selecionado não existe ou está desativado.";
    }
  }

  return null;
}

function validateStockLimits(minimumStock: number, maximumStock: number) {
  return maximumStock >= minimumStock
    ? null
    : "O estoque máximo deve ser maior ou igual ao estoque mínimo.";
}

router.get("/products", async (req, res): Promise<void> => {
  const parsedQuery = ListProductsQueryParams.safeParse(req.query);
  if (!parsedQuery.success) {
    res.status(400).json({ error: parsedQuery.error.message });
    return;
  }

  const products = await listProductRows({
    search: parsedQuery.data.search,
    categoryId: parsedQuery.data.categoryId,
    activeOnly: parsedQuery.data.activeOnly,
  });

  res.json(ListProductsResponse.parse(products));
});

router.post("/products", async (req, res): Promise<void> => {
  const parsed = CreateProductBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const name = normalizeRequiredName(parsed.data.name);
  if (!name) {
    res.status(400).json({ error: "O nome do EPI é obrigatório." });
    return;
  }

  if (parsed.data.currentStock !== 0) {
    res.status(400).json({ error: "O estoque inicial deve ser zero. Registre a primeira entrada com lote e validade." });
    return;
  }

  const stockError = validateStockLimits(
    parsed.data.minimumStock,
    parsed.data.maximumStock,
  );
  if (stockError) {
    res.status(400).json({ error: stockError });
    return;
  }

  const relationError = await validateRelations(
    parsed.data.categoryId,
    parsed.data.supplierId,
  );
  if (relationError) {
    res.status(400).json({ error: relationError });
    return;
  }

  try {
    const [product] = await db
      .insert(productsTable)
      .values({
        name,
        categoryId: parsed.data.categoryId,
        supplierId: parsed.data.supplierId ?? null,
        ca: parsed.data.ca.trim(),
        manufacturer: parsed.data.manufacturer.trim(),
        size: parsed.data.size?.trim() || null,
        unit: parsed.data.unit,
        currentStock: 0,
        minimumStock: parsed.data.minimumStock,
        maximumStock: parsed.data.maximumStock,
        unitCost: parsed.data.unitCost,
      })
      .returning();

    // Estoque inicial já pode nascer em ou abaixo do mínimo — mantém o
    // histórico de alertas consistente com a mesma lógica usada nas
    // movimentações, sem criar uma segunda forma de alterar estoque.
    const lowStockNotification = await db.transaction((tx) =>
      syncStockAlert(tx, {
        productId: product.id,
        currentStock: product.currentStock,
        minimumStock: product.minimumStock,
      }),
    );
    await dispatchLowStockNotification(lowStockNotification);

    const response = await productResponse(product.id);
    res.status(201).json(CreateProductResponse.parse(response));
  } catch (error) {
    if (isUniqueViolation(error)) {
      res.status(409).json({ error: "Já existe um EPI com esse nome." });
      return;
    }
    throw error;
  }
});

router.patch("/products/:id", async (req, res): Promise<void> => {
  const params = UpdateProductParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateProductBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  if (Object.keys(parsed.data).length === 0) {
    res.status(400).json({ error: "Informe ao menos um campo para atualizar." });
    return;
  }

  const current = await getProduct(params.data.id);
  if (!current) {
    res.status(404).json({ error: "EPI não encontrado." });
    return;
  }

  const nextCategoryId = parsed.data.categoryId ?? current.categoryId;
  const nextSupplierId =
    parsed.data.supplierId !== undefined
      ? parsed.data.supplierId
      : current.supplierId;
  const nextMinimumStock = parsed.data.minimumStock ?? current.minimumStock;
  const nextMaximumStock = parsed.data.maximumStock ?? current.maximumStock;

  const stockError = validateStockLimits(nextMinimumStock, nextMaximumStock);
  if (stockError) {
    res.status(400).json({ error: stockError });
    return;
  }

  const relationError = await validateRelations(nextCategoryId, nextSupplierId);
  if (relationError) {
    res.status(400).json({ error: relationError });
    return;
  }

  const values: Partial<typeof productsTable.$inferInsert> = {
    updatedAt: new Date(),
  };
  if (parsed.data.name !== undefined) {
    const name = normalizeRequiredName(parsed.data.name);
    if (!name) {
      res.status(400).json({ error: "O nome do EPI é obrigatório." });
      return;
    }
    values.name = name;
  }
  if (parsed.data.categoryId !== undefined) values.categoryId = parsed.data.categoryId;
  if (parsed.data.supplierId !== undefined) {
    values.supplierId = parsed.data.supplierId ?? null;
  }
  if (parsed.data.ca !== undefined) values.ca = parsed.data.ca.trim();
  if (parsed.data.manufacturer !== undefined) values.manufacturer = parsed.data.manufacturer.trim();
  if (parsed.data.size !== undefined) values.size = parsed.data.size?.trim() || null;
  if (parsed.data.unit !== undefined) values.unit = parsed.data.unit;
  if (parsed.data.minimumStock !== undefined) {
    values.minimumStock = parsed.data.minimumStock;
  }
  if (parsed.data.maximumStock !== undefined) {
    values.maximumStock = parsed.data.maximumStock;
  }
  if (parsed.data.unitCost !== undefined) values.unitCost = parsed.data.unitCost;
  if (parsed.data.isActive !== undefined) {
    values.isActive = parsed.data.isActive ? 1 : 0;
  }

  try {
    await db
      .update(productsTable)
      .set(values)
      .where(eq(productsTable.id, params.data.id));

    // O estoque atual não é editável aqui (só entrada/saída/ajuste
    // alteram currentStock), mas o mínimo pode mudar — resincroniza o
    // alerta com o mesmo estoque atual e o novo mínimo.
    const lowStockNotification = await db.transaction((tx) =>
      syncStockAlert(tx, {
        productId: params.data.id,
        currentStock: current.currentStock,
        minimumStock: nextMinimumStock,
      }),
    );
    await dispatchLowStockNotification(lowStockNotification);

    const response = await productResponse(params.data.id);
    res.json(UpdateProductResponse.parse(response));
  } catch (error) {
    if (isUniqueViolation(error)) {
      res.status(409).json({ error: "Já existe um EPI com esse nome." });
      return;
    }
    throw error;
  }
});

export default router;