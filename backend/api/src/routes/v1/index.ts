import { Router } from "express";
import { mediaRouter } from "../../modules/media/index.js";
import { playlistsRouter } from "../../modules/playlists/index.js";
import { podcastsRouter } from "../../modules/podcasts/index.js";
import { settingsRouter } from "../../modules/settings/index.js";
import { stationsRouter } from "../../modules/stations/index.js";

export const v1Router = Router();

v1Router.use("/stations", stationsRouter);
v1Router.use("/media", mediaRouter);
v1Router.use("/playlists", playlistsRouter);
v1Router.use("/podcasts", podcastsRouter);
v1Router.use("/settings", settingsRouter);
