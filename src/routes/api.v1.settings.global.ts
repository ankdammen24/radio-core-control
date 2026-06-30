import { createFileRoute } from "@tanstack/react-router";
import { jsonError, jsonSuccess, readJsonBody } from "@/server/api-response";

export const Route = createFileRoute("/api/v1/settings/global")({
  server: {
    handlers: {
      GET: async () => {
        const { getGlobalSettings } = await import("@/server/repositories/settings.repository");
        const values = await getGlobalSettings();
        return jsonSuccess(values);
      },
      PATCH: async ({ request }) => {
        const body = await readJsonBody(request);
        const values =
          body.values && typeof body.values === "object" ? (body.values as Record<string, unknown>) : null;
        if (!values) return jsonError("values is required and must be an object", "VALIDATION_ERROR");
        const { upsertGlobalSettings } = await import("@/server/repositories/settings.repository");
        const updated = await upsertGlobalSettings(values);
        return jsonSuccess(updated);
      },
    },
  },
});
