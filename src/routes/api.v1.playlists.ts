import { createFileRoute } from "@tanstack/react-router";
import { jsonError, jsonSuccess, readJsonBody } from "@/server/api-response";

export const Route = createFileRoute("/api/v1/playlists")({
  server: {
    handlers: {
      GET: async () => {
        const { listPlaylists } = await import("@/server/repositories/playlists.repository");
        const playlists = await listPlaylists();
        return jsonSuccess(playlists);
      },
      POST: async ({ request }) => {
        const body = await readJsonBody(request);
        const name = typeof body.name === "string" ? body.name.trim() : "";
        const stationId = typeof body.stationId === "string" ? body.stationId.trim() : "";
        if (!name) return jsonError("name is required", "VALIDATION_ERROR");
        if (!stationId) return jsonError("stationId is required", "VALIDATION_ERROR");
        const { createPlaylist } = await import("@/server/repositories/playlists.repository");
        const playlist = await createPlaylist({
          name,
          stationId,
          description: typeof body.description === "string" ? body.description : undefined,
          playlistType: typeof body.playlistType === "string" ? body.playlistType : undefined,
          priority: typeof body.priority === "number" ? body.priority : undefined,
          azuracastPlaylistId:
            typeof body.azuracastPlaylistId === "string" && body.azuracastPlaylistId
              ? body.azuracastPlaylistId
              : undefined,
        });
        return jsonSuccess(playlist, 201);
      },
    },
  },
});
