import { Router, type IRouter } from "express";
import {
  ListAlertsQueryParams,
  ListAlertsResponse,
  ResolveAlertParams,
  ResolveAlertResponse,
} from "@workspace/api-zod";
import {
  alertResponse,
  AlertError,
  listAlertRows,
  resolveAlertById,
} from "../lib/alerts";

const router: IRouter = Router();

router.get("/alerts", async (req, res): Promise<void> => {
  const parsedQuery = ListAlertsQueryParams.safeParse(req.query);
  if (!parsedQuery.success) {
    res.status(400).json({ error: parsedQuery.error.message });
    return;
  }

  const rows = await listAlertRows({
    status: parsedQuery.data.status,
    productId: parsedQuery.data.productId,
    limit: parsedQuery.data.limit,
  });

  res.json(ListAlertsResponse.parse(rows));
});

router.post("/alerts/:id/resolve", async (req, res): Promise<void> => {
  const params = ResolveAlertParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  try {
    await resolveAlertById(params.data.id);
    const response = await alertResponse(params.data.id);
    res.json(ResolveAlertResponse.parse(response));
  } catch (error) {
    if (error instanceof AlertError) {
      res.status(error.code === "NOT_FOUND" ? 404 : 400).json({ error: error.message });
      return;
    }
    throw error;
  }
});

export default router;
