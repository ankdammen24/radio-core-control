import { createFileRoute } from "@tanstack/react-router";
import { jsonError, jsonSuccess, readJsonBody } from "@/server/api-response";

export const Route = createFileRoute("/api/v1/playlists/$id/items")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const body = await readJsonBody(request);
        const mediaId = typeof body.mediaId === "string" ? body.mediaId : "";
        if (!mediaId) return jsonError("mediaId is required", "VALIDATION_ERROR");
        const { findPlaylistById, addPlaylistItem, listPlaylistItems } = await import(
          "@/server/repositories/playlists.repository"
        );
        const playlist = await findPlaylistById(params.id);
        if (!playlist) return jsonError("Playlist not found", "PLAYLIST_NOT_FOUND", 404);
        await addPlaylistItem(params.id, mediaId);
        const items = await listPlaylistItems(params.id);
        return jsonSuccess({ ...playlist, items }, 201);
      },
    },
  },
});
