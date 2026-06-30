import { apiConfig } from "../config/api.js";

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
    "/api/v1/stations": {
      get: {
        summary: "List stations",
        tags: ["Stations"],
        responses: {
          "200": {
            description: "List of stations",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean" },
                    data: { type: "array", items: { $ref: "#/components/schemas/Station" } },
                    meta: { type: "object" },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/api/v1/stations/{id}": {
      get: {
        summary: "Get a station by id",
        tags: ["Stations"],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": {
            description: "Station",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean" },
                    data: { $ref: "#/components/schemas/Station" },
                  },
                },
              },
            },
          },
          "404": {
            description: "Station not found",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
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
          apiDomain: { type: "string" },
          status: { type: "string", enum: ["active", "inactive"] },
        },
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
