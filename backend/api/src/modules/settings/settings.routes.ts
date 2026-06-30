import { Router } from "express";
import { sendSuccess } from "../../core/api-response.js";
import { validateBody } from "../../middleware/validation.middleware.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { SettingsRepository } from "./settings.repository.js";
import { SettingsService } from "./settings.service.js";
import { validateUpdateSettings } from "./settings.validation.js";

const repository = new SettingsRepository();
const service = new SettingsService(repository);

export const settingsRouter = Router();

settingsRouter.get(
  "/global",
  asyncHandler(async (_req, res) => {
    const values = await service.getGlobalSettings();
    sendSuccess(res, values);
  }),
);

settingsRouter.patch(
  "/global",
  validateBody(validateUpdateSettings),
  asyncHandler(async (req, res) => {
    const values = await service.updateGlobalSettings(req.body.values);
    sendSuccess(res, values);
  }),
);

settingsRouter.get(
  "/stations/:stationId",
  asyncHandler(async (req, res) => {
    const values = await service.getStationSettings(req.params.stationId);
    sendSuccess(res, values);
  }),
);

settingsRouter.patch(
  "/stations/:stationId",
  validateBody(validateUpdateSettings),
  asyncHandler(async (req, res) => {
    const values = await service.updateStationSettings(req.params.stationId, req.body.values);
    sendSuccess(res, values);
  }),
);
