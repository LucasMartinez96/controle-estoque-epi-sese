/**
 * Hand-written to match the orval v8.23.0 generation style used by the
 * rest of this package. Regenerate with `pnpm --filter @workspace/api-spec
 * run codegen` once the OpenAPI spec below has been reviewed, which will
 * replace this file with an equivalent fully-generated one.
 * Api
 * API do controle de estoque para pizzarias
 * OpenAPI spec version: 0.1.0
 */
import type { StockAlertStatus } from './stockAlertStatus';

export interface StockAlert {
  id: number;
  productId: number;
  productName: string;
  unit: string;
  status: StockAlertStatus;
  stockAtTrigger: number;
  minimumStockAtTrigger: number;
  triggeredAt: Date;
  /** @nullable */
  resolvedAt: Date | null;
  /** @nullable */
  resolvedByUserId: number | null;
}
