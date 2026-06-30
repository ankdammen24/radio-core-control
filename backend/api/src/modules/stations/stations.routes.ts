import { Router } from "express";
import { sendSuccess } from "../../core/api-response.js";
import { validateBody } from "../../middleware/validation.middleware.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { StationRepository } from "./stations.repository.js";
import { StationService } from "./stations.service.js";
import { validateCreateStation, validateUpdateStation } from "./stations.validation.js";

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

stationsRouter.post(
  "/",
  validateBody(validateCreateStation),
  asyncHandler(async (req, res) => {
    const station = await service.createStation(req.body);
    sendSuccess(res, station, undefined, 201);
  }),
);

stationsRouter.patch(
  "/:id",
  validateBody(validateUpdateStation),
  asyncHandler(async (req, res) => {
    const station = await service.updateStation(req.params.id, req.body);
    sendSuccess(res, station);
  }),
);

stationsRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    await service.deleteStation(req.params.id);
    res.status(204).end();
  }),
);
