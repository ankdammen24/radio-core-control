import { Router } from "express";
import { docsRouter } from "./docs.routes.js";
import { healthRouter } from "./health.routes.js";
import { v1Router } from "./v1/index.js";

export const rootRouter = Router();

rootRouter.use(healthRouter);
rootRouter.use(docsRouter);
rootRouter.use("/api/v1", v1Router);
