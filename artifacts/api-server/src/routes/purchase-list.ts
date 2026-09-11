import { Router, type IRouter } from "express";
import {
  ListPurchaseListResponse,
  MarkPurchaseItemParams,
  PurchaseListItemResponse,
} from "@workspace/api-zod";
import {
  listPurchaseCandidates,
  markPurchaseItemPending,
  markPurchaseItemPurchased,
  PurchaseListError,
} from "../lib/purchase";

const router: IRouter = Router();

router.get("/purchase-list", async (_req, res): Promise<void> => {
  const items = await listPurchaseCandidates();
  res.json(ListPurchaseListResponse.parse(items));
});

router.post(
  "/purchase-list/:productId/mark-purchased",
  async (req, res): Promise<void> => {
    const params = MarkPurchaseItemParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    try {
      await markPurchaseItemPurchased(params.data.productId);
    } catch (error) {
      if (error instanceof PurchaseListError) {
        res.status(400).json({ error: error.message });
        return;
      }
      throw error;
    }

    const items = await listPurchaseCandidates({ productId: params.data.productId });
    res.json(PurchaseListItemResponse.parse(items[0]));
  },
);

router.post(
  "/purchase-list/:productId/mark-pending",
  async (req, res): Promise<void> => {
    const params = MarkPurchaseItemParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    await markPurchaseItemPending(params.data.productId);

    const items = await listPurchaseCandidates({ productId: params.data.productId });
    if (!items[0]) {
      res.status(404).json({ error: "Produto não está na lista de compras." });
      return;
    }
    res.json(PurchaseListItemResponse.parse(items[0]));
  },
);

export default router;
