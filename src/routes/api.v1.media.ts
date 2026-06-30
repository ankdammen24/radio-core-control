import { createFileRoute } from "@tanstack/react-router";
import { jsonError, jsonSuccess, readJsonBody } from "@/server/api-response";

export const Route = createFileRoute("/api/v1/media")({
  server: {
    handlers: {
      GET: async () => {
        const { listMedia } = await import("@/server/repositories/mediaAssets.repository");
        const media = await listMedia();
        return jsonSuccess(media);
      },
      POST: async ({ request }) => {
        const body = await readJsonBody(request);
        const fileName = typeof body.fileName === "string" ? body.fileName.trim() : "";
        if (!fileName) {
          return jsonError("fileName is required", "VALIDATION_ERROR");
        }
        const { createMedia } = await import("@/server/repositories/mediaAssets.repository");
        const media = await createMedia({
          fileName,
          stationId: typeof body.stationId === "string" && body.stationId ? body.stationId : undefined,
          filePath: typeof body.filePath === "string" ? body.filePath : undefined,
          fileType: typeof body.fileType === "string" ? body.fileType : undefined,
          mediaKind: typeof body.mediaKind === "string" ? body.mediaKind : undefined,
          status: typeof body.status === "string" ? body.status : undefined,
          durationSeconds: typeof body.durationSeconds === "number" ? body.durationSeconds : undefined,
          title: typeof body.title === "string" ? body.title : undefined,
          artist: typeof body.artist === "string" ? body.artist : undefined,
          album: typeof body.album === "string" ? body.album : undefined,
          genre: typeof body.genre === "string" ? body.genre : undefined,
          artworkUrl: typeof body.artworkUrl === "string" ? body.artworkUrl : undefined,
          streamUrl: typeof body.streamUrl === "string" ? body.streamUrl : undefined,
        });
        return jsonSuccess(media, 201);
      },
    },
  },
});
