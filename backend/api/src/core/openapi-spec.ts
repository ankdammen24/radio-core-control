import { apiConfig } from "../config/api.js";

function successOf(schema: Record<string, unknown>) {
  return {
    type: "object",
    properties: {
      success: { type: "boolean", example: true },
      data: schema,
      meta: { type: "object" },
    },
  };
}

function ref(name: string) {
  return { $ref: `#/components/schemas/${name}` };
}

function listOf(name: string) {
  return successOf({ type: "array", items: ref(name) });
}

const errorResponse = {
  description: "Error",
  content: { "application/json": { schema: ref("ErrorResponse") } },
};

export const openApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "Radio Core API",
    version: apiConfig.version,
    description: "Radio Core Control backend API.",
  },
  servers: [{ url: apiConfig.publicUrl ?? "/" }],
  paths: {
    "/health": {
      get: {
        summary: "Liveness check",
        responses: {
          "200": {
            description: "Service is running",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    status: { type: "string", example: "ok" },
                    service: { type: "string", example: "radio-core-api" },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/api/health": {
      get: {
        summary: "Readiness check with dependency status",
        responses: {
          "200": {
            description: "Service and dependency status",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    status: { type: "string" },
                    service: { type: "string" },
                    database: { type: "string", enum: ["connected", "not_connected"] },
                    checks: { type: "object" },
                  },
                },
              },
            },
          },
        },
      },
    },

    // --- Stations ---
    "/api/v1/stations": {
      get: {
        summary: "List stations",
        tags: ["Stations"],
        responses: { "200": { description: "List of stations", content: { "application/json": { schema: listOf("Station") } } } },
      },
      post: {
        summary: "Create a station",
        tags: ["Stations"],
        requestBody: { required: true, content: { "application/json": { schema: ref("CreateStation") } } },
        responses: {
          "201": { description: "Created station", content: { "application/json": { schema: successOf(ref("Station")) } } },
          "400": errorResponse,
          "409": errorResponse,
        },
      },
    },
    "/api/v1/stations/{id}": {
      get: {
        summary: "Get a station by id",
        tags: ["Stations"],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": { description: "Station", content: { "application/json": { schema: successOf(ref("Station")) } } },
          "404": errorResponse,
        },
      },
      patch: {
        summary: "Update a station",
        tags: ["Stations"],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: { required: true, content: { "application/json": { schema: ref("UpdateStation") } } },
        responses: {
          "200": { description: "Updated station", content: { "application/json": { schema: successOf(ref("Station")) } } },
          "404": errorResponse,
        },
      },
      delete: {
        summary: "Delete a station",
        tags: ["Stations"],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { "204": { description: "Deleted" }, "404": errorResponse },
      },
    },

    // --- Media ---
    "/api/v1/media": {
      get: {
        summary: "List media files",
        tags: ["Media"],
        responses: { "200": { description: "List of media files", content: { "application/json": { schema: listOf("MediaFile") } } } },
      },
      post: {
        summary: "Register a media file",
        tags: ["Media"],
        requestBody: { required: true, content: { "application/json": { schema: ref("CreateMedia") } } },
        responses: {
          "201": { description: "Registered media file", content: { "application/json": { schema: successOf(ref("MediaFile")) } } },
          "400": errorResponse,
        },
      },
    },
    "/api/v1/media/{id}": {
      get: {
        summary: "Get a media file by id",
        tags: ["Media"],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": { description: "Media file", content: { "application/json": { schema: successOf(ref("MediaFile")) } } },
          "404": errorResponse,
        },
      },
      patch: {
        summary: "Update media metadata",
        tags: ["Media"],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: { required: true, content: { "application/json": { schema: ref("UpdateMedia") } } },
        responses: {
          "200": { description: "Updated media file", content: { "application/json": { schema: successOf(ref("MediaFile")) } } },
          "404": errorResponse,
        },
      },
      delete: {
        summary: "Delete a media file",
        tags: ["Media"],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { "204": { description: "Deleted" }, "404": errorResponse },
      },
    },

    // --- Playlists ---
    "/api/v1/playlists": {
      get: {
        summary: "List playlists",
        tags: ["Playlists"],
        responses: { "200": { description: "List of playlists", content: { "application/json": { schema: listOf("Playlist") } } } },
      },
      post: {
        summary: "Create a playlist",
        tags: ["Playlists"],
        requestBody: { required: true, content: { "application/json": { schema: ref("CreatePlaylist") } } },
        responses: {
          "201": { description: "Created playlist", content: { "application/json": { schema: successOf(ref("Playlist")) } } },
          "400": errorResponse,
        },
      },
    },
    "/api/v1/playlists/{id}": {
      get: {
        summary: "Get a playlist by id",
        tags: ["Playlists"],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": { description: "Playlist", content: { "application/json": { schema: successOf(ref("Playlist")) } } },
          "404": errorResponse,
        },
      },
    },
    "/api/v1/playlists/{id}/items": {
      post: {
        summary: "Add a media file to a playlist",
        tags: ["Playlists"],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object", properties: { mediaId: { type: "string" } } } } },
        },
        responses: {
          "201": { description: "Updated playlist", content: { "application/json": { schema: successOf(ref("Playlist")) } } },
          "404": errorResponse,
        },
      },
    },
    "/api/v1/playlists/{id}/items/{mediaId}": {
      delete: {
        summary: "Remove a media file from a playlist",
        tags: ["Playlists"],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
          { name: "mediaId", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: {
          "200": { description: "Updated playlist", content: { "application/json": { schema: successOf(ref("Playlist")) } } },
          "404": errorResponse,
        },
      },
    },

    // --- Podcasts ---
    "/api/v1/podcasts": {
      get: {
        summary: "List podcasts",
        tags: ["Podcasts"],
        responses: { "200": { description: "List of podcasts", content: { "application/json": { schema: listOf("Podcast") } } } },
      },
      post: {
        summary: "Create a podcast",
        tags: ["Podcasts"],
        requestBody: { required: true, content: { "application/json": { schema: ref("CreatePodcast") } } },
        responses: {
          "201": { description: "Created podcast", content: { "application/json": { schema: successOf(ref("Podcast")) } } },
          "400": errorResponse,
        },
      },
    },
    "/api/v1/podcasts/{id}": {
      get: {
        summary: "Get a podcast by id",
        tags: ["Podcasts"],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": { description: "Podcast", content: { "application/json": { schema: successOf(ref("Podcast")) } } },
          "404": errorResponse,
        },
      },
      patch: {
        summary: "Update a podcast",
        tags: ["Podcasts"],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: { required: true, content: { "application/json": { schema: ref("UpdatePodcast") } } },
        responses: {
          "200": { description: "Updated podcast", content: { "application/json": { schema: successOf(ref("Podcast")) } } },
          "404": errorResponse,
        },
      },
    },
    "/api/v1/podcasts/{id}/episodes": {
      get: {
        summary: "List episodes for a podcast",
        tags: ["Podcasts"],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "List of episodes", content: { "application/json": { schema: listOf("Episode") } } }, "404": errorResponse },
      },
      post: {
        summary: "Create an episode",
        tags: ["Podcasts"],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: { required: true, content: { "application/json": { schema: ref("CreateEpisode") } } },
        responses: {
          "201": { description: "Created episode", content: { "application/json": { schema: successOf(ref("Episode")) } } },
          "404": errorResponse,
        },
      },
    },

    // --- Settings ---
    "/api/v1/settings/global": {
      get: {
        summary: "Get global settings",
        tags: ["Settings"],
        responses: { "200": { description: "Global settings values", content: { "application/json": { schema: successOf({ type: "object" }) } } } },
      },
      patch: {
        summary: "Update global settings",
        tags: ["Settings"],
        requestBody: { required: true, content: { "application/json": { schema: ref("UpdateSettings") } } },
        responses: { "200": { description: "Updated global settings values", content: { "application/json": { schema: successOf({ type: "object" }) } } } },
      },
    },
    "/api/v1/settings/stations/{stationId}": {
      get: {
        summary: "Get settings for a station",
        tags: ["Settings"],
        parameters: [{ name: "stationId", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Station settings values", content: { "application/json": { schema: successOf({ type: "object" }) } } } },
      },
      patch: {
        summary: "Update settings for a station",
        tags: ["Settings"],
        parameters: [{ name: "stationId", in: "path", required: true, schema: { type: "string" } }],
        requestBody: { required: true, content: { "application/json": { schema: ref("UpdateSettings") } } },
        responses: { "200": { description: "Updated station settings values", content: { "application/json": { schema: successOf({ type: "object" }) } } } },
      },
    },
  },
  components: {
    schemas: {
      Station: {
        type: "object",
        properties: {
          _id: { type: "string" },
          name: { type: "string" },
          slug: { type: "string" },
          description: { type: "string" },
          logoUrl: { type: "string" },
          streamUrl: { type: "string" },
          timezone: { type: "string" },
          status: { type: "string", enum: ["active", "inactive"] },
        },
      },
      CreateStation: {
        type: "object",
        required: ["name", "slug"],
        properties: {
          name: { type: "string" },
          slug: { type: "string" },
          description: { type: "string" },
          logoUrl: { type: "string" },
          streamUrl: { type: "string" },
          timezone: { type: "string" },
          status: { type: "string", enum: ["active", "inactive"] },
        },
      },
      UpdateStation: { allOf: [ref("CreateStation")] },

      MediaFile: {
        type: "object",
        properties: {
          _id: { type: "string" },
          title: { type: "string" },
          artist: { type: "string" },
          album: { type: "string" },
          duration: { type: "number" },
          fileUrl: { type: "string" },
          storageKey: { type: "string" },
          type: { type: "string" },
          status: { type: "string", enum: ["active", "archived"] },
        },
      },
      CreateMedia: {
        type: "object",
        required: ["title", "fileUrl", "storageKey", "type"],
        properties: {
          title: { type: "string" },
          artist: { type: "string" },
          album: { type: "string" },
          duration: { type: "number" },
          fileUrl: { type: "string" },
          storageKey: { type: "string" },
          type: { type: "string" },
          status: { type: "string", enum: ["active", "archived"] },
        },
      },
      UpdateMedia: { allOf: [ref("CreateMedia")] },

      Playlist: {
        type: "object",
        properties: {
          _id: { type: "string" },
          name: { type: "string" },
          description: { type: "string" },
          stationId: { type: "string" },
          items: {
            type: "array",
            items: { type: "object", properties: { mediaId: { type: "string" }, addedAt: { type: "string" } } },
          },
          status: { type: "string", enum: ["active", "inactive"] },
        },
      },
      CreatePlaylist: {
        type: "object",
        required: ["name"],
        properties: {
          name: { type: "string" },
          description: { type: "string" },
          stationId: { type: "string" },
          status: { type: "string", enum: ["active", "inactive"] },
        },
      },

      Podcast: {
        type: "object",
        properties: {
          _id: { type: "string" },
          title: { type: "string" },
          description: { type: "string" },
          author: { type: "string" },
          imageUrl: { type: "string" },
          rssUrl: { type: "string" },
          status: { type: "string", enum: ["active", "inactive"] },
        },
      },
      CreatePodcast: {
        type: "object",
        required: ["title"],
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          author: { type: "string" },
          imageUrl: { type: "string" },
          rssUrl: { type: "string" },
          status: { type: "string", enum: ["active", "inactive"] },
        },
      },
      UpdatePodcast: { allOf: [ref("CreatePodcast")] },

      Episode: {
        type: "object",
        properties: {
          _id: { type: "string" },
          podcastId: { type: "string" },
          title: { type: "string" },
          description: { type: "string" },
          audioUrl: { type: "string" },
          duration: { type: "number" },
          publishedAt: { type: "string" },
          status: { type: "string", enum: ["draft", "published"] },
        },
      },
      CreateEpisode: {
        type: "object",
        required: ["title"],
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          audioUrl: { type: "string" },
          duration: { type: "number" },
          publishedAt: { type: "string" },
          status: { type: "string", enum: ["draft", "published"] },
        },
      },

      UpdateSettings: {
        type: "object",
        required: ["values"],
        properties: { values: { type: "object" } },
      },

      ErrorResponse: {
        type: "object",
        properties: {
          success: { type: "boolean", example: false },
          error: {
            type: "object",
            properties: {
              message: { type: "string" },
              code: { type: "string" },
            },
          },
        },
      },
    },
  },
} as const;
