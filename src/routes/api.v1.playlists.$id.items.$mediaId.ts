import { createFileRoute } from "@tanstack/react-router";
import { jsonError, jsonSuccess } from "@/server/api-response";

export const Route = createFileRoute("/api/v1/playlists/$id/items/$mediaId")({
  server: {
    handlers: {
      DELETE: async ({ params }) => {
        const { findPlaylistById, removePlaylistItem, listPlaylistItems } = await import(
          "@/server/repositories/playlists.repository"
        );
        const playlist = await findPlaylistById(params.id);
        if (!playlist) return jsonError("Playlist not found", "PLAYLIST_NOT_FOUND", 404);
        await removePlaylistItem(params.id, params.mediaId);
        const items = await listPlaylistItems(params.id);
        return jsonSuccess({ ...playlist, items });
      },
    },
  },
});
