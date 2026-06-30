import { Router } from "express";
import { sendSuccess } from "../../core/api-response.js";
import { validateBody } from "../../middleware/validation.middleware.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { EpisodeRepository, PodcastRepository } from "./podcasts.repository.js";
import { PodcastService } from "./podcasts.service.js";
import {
  validateCreateEpisode,
  validateCreatePodcast,
  validateUpdatePodcast,
} from "./podcasts.validation.js";

const podcastRepository = new PodcastRepository();
const episodeRepository = new EpisodeRepository();
const service = new PodcastService(podcastRepository, episodeRepository);

export const podcastsRouter = Router();

podcastsRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const podcasts = await service.listPodcasts();
    sendSuccess(res, podcasts, { count: podcasts.length });
  }),
);

podcastsRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const podcast = await service.getPodcast(req.params.id);
    sendSuccess(res, podcast);
  }),
);

podcastsRouter.post(
  "/",
  validateBody(validateCreatePodcast),
  asyncHandler(async (req, res) => {
    const podcast = await service.createPodcast(req.body);
    sendSuccess(res, podcast, undefined, 201);
  }),
);

podcastsRouter.patch(
  "/:id",
  validateBody(validateUpdatePodcast),
  asyncHandler(async (req, res) => {
    const podcast = await service.updatePodcast(req.params.id, req.body);
    sendSuccess(res, podcast);
  }),
);

podcastsRouter.post(
  "/:id/episodes",
  validateBody(validateCreateEpisode),
  asyncHandler(async (req, res) => {
    const episode = await service.createEpisode(req.params.id, req.body);
    sendSuccess(res, episode, undefined, 201);
  }),
);

podcastsRouter.get(
  "/:id/episodes",
  asyncHandler(async (req, res) => {
    const episodes = await service.listEpisodes(req.params.id);
    sendSuccess(res, episodes, { count: episodes.length });
  }),
);
