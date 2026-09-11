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

export interface MovementInput {
  /** @minimum 1 */
  productId: number;
  type: MovementType;
  /**
   * Obrigatório para ENTRY e EXIT.
   * @minimum 0.001
   */
  quantity?: number;
  /**
   * Nova contagem física do estoque. Obrigatório para ADJUSTMENT.
   * @minimum 0
   */
  newStock?: number;
  /**
   * @minimum 1
   * @nullable
   */
  supplierId?: number | null;
  /** @minimum 0 */
  unitCost?: number | null;
  lotCode?: string | null;
  expirationDate?: string | null;
  /** @maxLength 160 */
  recipientName?: string | null;
  /** @maxLength 60 */
  recipientRegistration?: string | null;
  /** @maxLength 160 */
  reason?: string | null;
  notes?: string | null;
}
