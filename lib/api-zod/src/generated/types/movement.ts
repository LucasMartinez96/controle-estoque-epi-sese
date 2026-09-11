/**
 * Hand-written to match the orval v8.23.0 generation style used by the
 * rest of this package. Regenerate with `pnpm --filter @workspace/api-spec
 * run codegen` once the OpenAPI spec below has been reviewed, which will
 * replace this file with an equivalent fully-generated one.
 * Api
 * API do controle de estoque para pizzarias
 * OpenAPI spec version: 0.1.0
 */
import type { MovementType } from './movementType';

export interface Movement {
  id: number;
  productId: number;
  productName: string;
  unit: string;
  type: MovementType;
  quantity: number;
  stockBefore: number;
  stockAfter: number;
  /** @nullable */
  adjustmentDifference: number | null;
  occurredAt: Date;
  /** @nullable */
  supplierId: number | null;
  /** @nullable */
  supplierName: string | null;
  /** @nullable */
  lotCode: string | null;
  /** @nullable */
  expirationDate: string | null;
  /** @nullable */
  unitCost: number | null;
  /** @nullable */
  recipientName: string | null;
  /** @nullable */
  recipientRegistration: string | null;
  /** @nullable */
  reason: string | null;
  /** @nullable */
  notes: string | null;
  /** @nullable */
  userId: number | null;
  createdAt: Date;
}
