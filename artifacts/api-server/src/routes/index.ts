import { Router, type IRouter } from "express";
import healthRouter from "./health";
import categoriesRouter from "./categories";
import suppliersRouter from "./suppliers";
import productsRouter from "./products";
import catalogRouter from "./catalog";
import movementsRouter from "./movements";
import alertsRouter from "./alerts";
import purchaseListRouter from "./purchase-list";

const router: IRouter = Router();

router.use(healthRouter);
router.use(categoriesRouter);
router.use(suppliersRouter);
router.use(productsRouter);
router.use(catalogRouter);
router.use(movementsRouter);
router.use(alertsRouter);
router.use(purchaseListRouter);

export default router;
