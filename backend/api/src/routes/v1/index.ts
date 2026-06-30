import { Router } from "express";
import { stationsRouter } from "../../modules/stations/index.js";

export const v1Router = Router();

v1Router.use("/stations", stationsRouter);
