/**
 * Hand-written to match the orval v8.23.0 generation style used by the
 * rest of this package. Regenerate with `pnpm --filter @workspace/api-spec
 * run codegen` once the OpenAPI spec below has been reviewed, which will
 * replace this file with an equivalent fully-generated one.
 * Api
 * API do controle de estoque para pizzarias
 * OpenAPI spec version: 0.1.0
 */
import type { PurchaseListStatus } from './purchaseListStatus';

export interface PurchaseListItem {
  productId: number;
  productName: string;
  categoryId: number;
  categoryName: string;
  /** @nullable */
  supplierId: number | null;
  /** @nullable */
  supplierName: string | null;
  unit: string;
  currentStock: number;
  minimumStock: number;
  maximumStock: number;
  unitCost: number;
  suggestedQuantity: number;
  estimatedCost: number;
  status: PurchaseListStatus;
  /** @nullable */
  markedPurchasedAt: Date | null;
}
