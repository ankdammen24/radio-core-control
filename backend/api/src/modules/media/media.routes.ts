import { Router } from "express";
import { sendSuccess } from "../../core/api-response.js";
import { validateBody } from "../../middleware/validation.middleware.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { MediaRepository } from "./media.repository.js";
import { MediaService } from "./media.service.js";
import { validateCreateMedia, validateUpdateMedia } from "./media.validation.js";

const repository = new MediaRepository();
const service = new MediaService(repository);

export const mediaRouter = Router();

mediaRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const media = await service.listMedia();
    sendSuccess(res, media, { count: media.length });
  }),
);

mediaRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const media = await service.getMedia(req.params.id);
    sendSuccess(res, media);
  }),
);

mediaRouter.post(
  "/",
  validateBody(validateCreateMedia),
  asyncHandler(async (req, res) => {
    const media = await service.registerMedia(req.body);
    sendSuccess(res, media, undefined, 201);
  }),
);

mediaRouter.patch(
  "/:id",
  validateBody(validateUpdateMedia),
  asyncHandler(async (req, res) => {
    const media = await service.updateMediaMetadata(req.params.id, req.body);
    sendSuccess(res, media);
  }),
);

mediaRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    await service.deleteMedia(req.params.id);
    res.status(204).end();
  }),
);
