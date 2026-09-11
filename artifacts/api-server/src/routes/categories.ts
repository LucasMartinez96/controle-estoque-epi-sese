import { Router, type IRouter } from "express";
import { asc, eq } from "drizzle-orm";
import { db, categoriesTable } from "@workspace/db";
import {
  CreateCategoryBody,
  CreateCategoryResponse,
  ListCategoriesQueryParams,
  ListCategoriesResponse,
  UpdateCategoryBody,
  UpdateCategoryParams,
  UpdateCategoryResponse,
} from "@workspace/api-zod";
import {
  categoryResponse,
  getCategory,
  isUniqueViolation,
  normalizeRequiredName,
} from "../lib/catalog";

const router: IRouter = Router();

router.get("/categories", async (req, res): Promise<void> => {
  const parsedQuery = ListCategoriesQueryParams.safeParse(req.query);
  if (!parsedQuery.success) {
    res.status(400).json({ error: parsedQuery.error.message });
    return;
  }

  const categories = await db
    .select()
    .from(categoriesTable)
    .where(
      parsedQuery.data.activeOnly
        ? eq(categoriesTable.isActive, 1)
        : undefined,
    )
    .orderBy(asc(categoriesTable.name));

  res.json(ListCategoriesResponse.parse(categories.map(categoryResponse)));
});

router.post("/categories", async (req, res): Promise<void> => {
  const parsed = CreateCategoryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const name = normalizeRequiredName(parsed.data.name);
  if (!name) {
    res.status(400).json({ error: "O nome da categoria é obrigatório." });
    return;
  }

  try {
    const [category] = await db
      .insert(categoriesTable)
      .values({ name })
      .returning();

    res.status(201).json(CreateCategoryResponse.parse(categoryResponse(category)));
  } catch (error) {
    if (isUniqueViolation(error)) {
      res.status(409).json({ error: "Já existe uma categoria com esse nome." });
      return;
    }
    throw error;
  }
});

router.patch("/categories/:id", async (req, res): Promise<void> => {
  const params = UpdateCategoryParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateCategoryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  if (Object.keys(parsed.data).length === 0) {
    res.status(400).json({ error: "Informe ao menos um campo para atualizar." });
    return;
  }

  const current = await getCategory(params.data.id);
  if (!current) {
    res.status(404).json({ error: "Categoria não encontrada." });
    return;
  }

  const values: Partial<typeof categoriesTable.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (parsed.data.name !== undefined) {
    const name = normalizeRequiredName(parsed.data.name);
    if (!name) {
      res.status(400).json({ error: "O nome da categoria é obrigatório." });
      return;
    }
    values.name = name;
  }
  if (parsed.data.isActive !== undefined) {
    values.isActive = parsed.data.isActive ? 1 : 0;
  }

  try {
    const [category] = await db
      .update(categoriesTable)
      .set(values)
      .where(eq(categoriesTable.id, params.data.id))
      .returning();

    res.json(UpdateCategoryResponse.parse(categoryResponse(category)));
  } catch (error) {
    if (isUniqueViolation(error)) {
      res.status(409).json({ error: "Já existe uma categoria com esse nome." });
      return;
    }
    throw error;
  }
});

export default router;