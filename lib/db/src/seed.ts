import { eq } from "drizzle-orm";
import { db, pool } from "./index";
import {
  categoriesTable,
  inventorySettingsTable,
  productsTable,
  suppliersTable,
} from "./schema";

const categoryNames = [
  "Queijos",
  "Carnes",
  "Molhos",
  "Massas",
  "Bebidas",
  "Embalagens",
  "Temperos",
  "Outros",
] as const;

const productSeeds = [
  {
    name: "Mussarela",
    category: "Queijos",
    unit: "KG",
    currentStock: 8,
    minimumStock: 10,
    maximumStock: 30,
    unitCost: 32.5,
    supplier: "Laticínios Central",
  },
  {
    name: "Calabresa",
    category: "Carnes",
    unit: "KG",
    currentStock: 12,
    minimumStock: 10,
    maximumStock: 27,
    unitCost: 24.9,
    supplier: "Frios do Bairro",
  },
  {
    name: "Molho de tomate",
    category: "Molhos",
    unit: "UN",
    currentStock: 22,
    minimumStock: 10,
    maximumStock: 40,
    unitCost: 6.5,
    supplier: "Distribuidora Sabor",
  },
  {
    name: "Farinha",
    category: "Massas",
    unit: "KG",
    currentStock: 45,
    minimumStock: 20,
    maximumStock: 60,
    unitCost: 4.8,
    supplier: "Atacado da Massa",
  },
  {
    name: "Azeitona",
    category: "Temperos",
    unit: "KG",
    currentStock: 4,
    minimumStock: 8,
    maximumStock: 18,
    unitCost: 18.75,
    supplier: "Distribuidora Sabor",
  },
  {
    name: "Presunto",
    category: "Carnes",
    unit: "KG",
    currentStock: 9,
    minimumStock: 10,
    maximumStock: 25,
    unitCost: 26.4,
    supplier: "Frios do Bairro",
  },
  {
    name: "Refrigerante",
    category: "Bebidas",
    unit: "UN",
    currentStock: 72,
    minimumStock: 30,
    maximumStock: 100,
    unitCost: 5.5,
    supplier: "Bebidas Express",
  },
  {
    name: "Caixa de pizza",
    category: "Embalagens",
    unit: "UN",
    currentStock: 120,
    minimumStock: 50,
    maximumStock: 200,
    unitCost: 1.35,
    supplier: "Embalagens Ideal",
  },
] as const;

async function getOrCreateCategory(name: string) {
  const existing = await db
    .select()
    .from(categoriesTable)
    .where(eq(categoriesTable.name, name))
    .limit(1);
  if (existing[0]) return existing[0];

  const inserted = await db
    .insert(categoriesTable)
    .values({ name })
    .returning();
  return inserted[0];
}

async function getOrCreateSupplier(name: string) {
  const existing = await db
    .select()
    .from(suppliersTable)
    .where(eq(suppliersTable.name, name))
    .limit(1);
  if (existing[0]) return existing[0];

  const inserted = await db
    .insert(suppliersTable)
    .values({ name })
    .returning();
  return inserted[0];
}

async function seed() {
  for (const name of categoryNames) {
    await getOrCreateCategory(name);
  }

  for (const product of productSeeds) {
    const category = await getOrCreateCategory(product.category);
    const supplier = await getOrCreateSupplier(product.supplier);
    const existing = await db
      .select()
      .from(productsTable)
      .where(eq(productsTable.name, product.name))
      .limit(1);

    if (!existing[0]) {
      await db.insert(productsTable).values({
        name: product.name,
        categoryId: category.id,
        supplierId: supplier.id,
        unit: product.unit,
        currentStock: product.currentStock,
        minimumStock: product.minimumStock,
        maximumStock: product.maximumStock,
        unitCost: product.unitCost,
      });
    }
  }

  const settings = await db.select().from(inventorySettingsTable).limit(1);
  if (!settings[0]) {
    await db.insert(inventorySettingsTable).values({
      attentionThresholdPercent: 20,
      allowNegativeStock: 0,
    });
  }
}

seed()
  .then(async () => {
    await pool.end();
  })
  .catch(async (error) => {
    console.error(error);
    await pool.end();
    process.exitCode = 1;
  });