import { Router } from "express";
import { sendSuccess } from "../../core/api-response.js";
import { validateBody } from "../../middleware/validation.middleware.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { PlaylistRepository } from "./playlists.repository.js";
import { PlaylistService } from "./playlists.service.js";
import { validateAddPlaylistItem, validateCreatePlaylist } from "./playlists.validation.js";

const repository = new PlaylistRepository();
const service = new PlaylistService(repository);

export const playlistsRouter = Router();

playlistsRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const playlists = await service.listPlaylists();
    sendSuccess(res, playlists, { count: playlists.length });
  }),
);

playlistsRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const playlist = await service.getPlaylist(req.params.id);
    sendSuccess(res, playlist);
  }),
);

playlistsRouter.post(
  "/",
  validateBody(validateCreatePlaylist),
  asyncHandler(async (req, res) => {
    const playlist = await service.createPlaylist(req.body);
    sendSuccess(res, playlist, undefined, 201);
  }),
);

playlistsRouter.post(
  "/:id/items",
  validateBody(validateAddPlaylistItem),
  asyncHandler(async (req, res) => {
    const playlist = await service.addMediaToPlaylist(req.params.id, req.body.mediaId);
    sendSuccess(res, playlist, undefined, 201);
  }),
);

playlistsRouter.delete(
  "/:id/items/:mediaId",
  asyncHandler(async (req, res) => {
    const playlist = await service.removeMediaFromPlaylist(req.params.id, req.params.mediaId);
    sendSuccess(res, playlist);
  }),
);
