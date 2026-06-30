import { createFileRoute } from "@tanstack/react-router";
import { jsonError, jsonSuccess, readJsonBody } from "@/server/api-response";

export const Route = createFileRoute("/api/v1/playlists/$id")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const { findPlaylistById, listPlaylistItems } = await import(
          "@/server/repositories/playlists.repository"
        );
        const playlist = await findPlaylistById(params.id);
        if (!playlist) return jsonError("Playlist not found", "PLAYLIST_NOT_FOUND", 404);
        const items = await listPlaylistItems(params.id);
        return jsonSuccess({ ...playlist, items });
      },
      PATCH: async ({ request, params }) => {
        const body = await readJsonBody(request);
        const { updatePlaylist } = await import("@/server/repositories/playlists.repository");
        const playlist = await updatePlaylist(params.id, {
          ...(typeof body.name === "string" ? { name: body.name } : {}),
          ...(typeof body.description === "string" ? { description: body.description } : {}),
          ...(typeof body.stationId === "string" && body.stationId ? { stationId: body.stationId } : {}),
          ...(typeof body.playlistType === "string" ? { playlistType: body.playlistType } : {}),
          ...(typeof body.priority === "number" ? { priority: body.priority } : {}),
          ...(typeof body.azuracastPlaylistId === "string"
            ? { azuracastPlaylistId: body.azuracastPlaylistId || null }
            : {}),
          ...(typeof body.isActive === "boolean" ? { isActive: body.isActive } : {}),
        });
        if (!playlist) return jsonError("Playlist not found", "PLAYLIST_NOT_FOUND", 404);
        return jsonSuccess(playlist);
      },
      DELETE: async ({ params }) => {
        const { deletePlaylist } = await import("@/server/repositories/playlists.repository");
        const deleted = await deletePlaylist(params.id);
        if (!deleted) return jsonError("Playlist not found", "PLAYLIST_NOT_FOUND", 404);
        return new Response(null, { status: 204 });
      },
    },
  },
});
