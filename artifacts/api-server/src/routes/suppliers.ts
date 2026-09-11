import { Router, type IRouter } from "express";
import { asc, eq } from "drizzle-orm";
import { db, suppliersTable } from "@workspace/db";
import {
  CreateSupplierBody,
  CreateSupplierResponse,
  ListSuppliersQueryParams,
  ListSuppliersResponse,
  UpdateSupplierBody,
  UpdateSupplierParams,
  UpdateSupplierResponse,
} from "@workspace/api-zod";
import {
  getSupplier,
  isUniqueViolation,
  normalizeRequiredName,
  supplierResponse,
} from "../lib/catalog";

const router: IRouter = Router();

router.get("/suppliers", async (req, res): Promise<void> => {
  const parsedQuery = ListSuppliersQueryParams.safeParse(req.query);
  if (!parsedQuery.success) {
    res.status(400).json({ error: parsedQuery.error.message });
    return;
  }

  const suppliers = await db
    .select()
    .from(suppliersTable)
    .where(
      parsedQuery.data.activeOnly ? eq(suppliersTable.isActive, 1) : undefined,
    )
    .orderBy(asc(suppliersTable.name));

  res.json(ListSuppliersResponse.parse(suppliers.map(supplierResponse)));
});

router.post("/suppliers", async (req, res): Promise<void> => {
  const parsed = CreateSupplierBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const name = normalizeRequiredName(parsed.data.name);
  if (!name) {
    res.status(400).json({ error: "O nome do fornecedor é obrigatório." });
    return;
  }

  try {
    const [supplier] = await db
      .insert(suppliersTable)
      .values({
        name,
        phone: parsed.data.phone ?? null,
        whatsapp: parsed.data.whatsapp ?? null,
        email: parsed.data.email ?? null,
        notes: parsed.data.notes ?? null,
      })
      .returning();

    res.status(201).json(CreateSupplierResponse.parse(supplierResponse(supplier)));
  } catch (error) {
    if (isUniqueViolation(error)) {
      res.status(409).json({ error: "Já existe um fornecedor com esse nome." });
      return;
    }
    throw error;
  }
});

router.patch("/suppliers/:id", async (req, res): Promise<void> => {
  const params = UpdateSupplierParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateSupplierBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  if (Object.keys(parsed.data).length === 0) {
    res.status(400).json({ error: "Informe ao menos um campo para atualizar." });
    return;
  }

  const current = await getSupplier(params.data.id);
  if (!current) {
    res.status(404).json({ error: "Fornecedor não encontrado." });
    return;
  }

  const values: Partial<typeof suppliersTable.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (parsed.data.name !== undefined) {
    const name = normalizeRequiredName(parsed.data.name);
    if (!name) {
      res.status(400).json({ error: "O nome do fornecedor é obrigatório." });
      return;
    }
    values.name = name;
  }
  if (parsed.data.phone !== undefined) values.phone = parsed.data.phone ?? null;
  if (parsed.data.whatsapp !== undefined) {
    values.whatsapp = parsed.data.whatsapp ?? null;
  }
  if (parsed.data.email !== undefined) values.email = parsed.data.email ?? null;
  if (parsed.data.notes !== undefined) values.notes = parsed.data.notes ?? null;
  if (parsed.data.isActive !== undefined) {
    values.isActive = parsed.data.isActive ? 1 : 0;
  }

  try {
    const [supplier] = await db
      .update(suppliersTable)
      .set(values)
      .where(eq(suppliersTable.id, params.data.id))
      .returning();

    res.json(UpdateSupplierResponse.parse(supplierResponse(supplier)));
  } catch (error) {
    if (isUniqueViolation(error)) {
      res.status(409).json({ error: "Já existe um fornecedor com esse nome." });
      return;
    }
    throw error;
  }
});

export default router;