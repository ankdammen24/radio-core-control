import { Router } from "express";
import { sendSuccess } from "../../core/api-response.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { StationRepository } from "./stations.repository.js";
import { StationService } from "./stations.service.js";

const repository = new StationRepository();
const service = new StationService(repository);

export const stationsRouter = Router();

stationsRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const stations = await service.listStations();
    sendSuccess(res, stations, { count: stations.length });
  }),
);

stationsRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const station = await service.getStation(req.params.id);
    sendSuccess(res, station);
  }),
);
