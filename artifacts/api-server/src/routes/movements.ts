import { Router, type IRouter } from "express";
import {
  CreateMovementBody,
  CreateMovementResponse,
  ListMovementsQueryParams,
  ListMovementsResponse,
} from "@workspace/api-zod";
import {
  createMovement,
  getMovementResponse,
  listMovementRows,
  MovementError,
} from "../lib/movements";

const router: IRouter = Router();

router.get("/movements", async (req, res): Promise<void> => {
  const parsedQuery = ListMovementsQueryParams.safeParse(req.query);
  if (!parsedQuery.success) {
    res.status(400).json({ error: parsedQuery.error.message });
    return;
  }

  const rows = await listMovementRows({
    productId: parsedQuery.data.productId,
    type: parsedQuery.data.type,
    recipientSearch: parsedQuery.data.recipientSearch,
    limit: parsedQuery.data.limit,
  });

  res.json(ListMovementsResponse.parse(rows));
});

router.post("/movements", async (req, res): Promise<void> => {
  const parsed = CreateMovementBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  try {
    const { movement } = await createMovement(parsed.data);
    const response = await getMovementResponse(movement.id);
    res.status(201).json(CreateMovementResponse.parse(response));
  } catch (error) {
    if (error instanceof MovementError) {
      res.status(400).json({ error: error.message });
      return;
    }
    throw error;
  }
});

export default router;
