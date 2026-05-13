/**
 * Storage Targets server functions. Client-importable.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { runStorageHealthCheck, loadStorageTarget } from "@/server/storage-targets.server";
import { buildStorageAdapter } from "@/server/storage-adapters";

const providerEnum = z.enum(["r2", "s3", "local", "azure_blob", "external_url"]);
const purposeEnum = z.enum(["media", "artwork", "cdn", "backup", "exports"]);

const upsertSchema = z.object({
  id: z.string().uuid().optional(),
  station_id: z.string().uuid(),
  name: z.string().min(1).max(120),
  provider: providerEnum,
  purpose: purposeEnum,
  bucket: z.string().max(255).nullable().optional(),
  endpoint_url: z.string().url().max(500).nullable().optional().or(z.literal("")),
  region: z.string().max(64).nullable().optional(),
  public_base_url: z.string().url().max(500).nullable().optional().or(z.literal("")),
  access_key_ref: z.string().max(120).nullable().optional(),
  secret_key_ref: z.string().max(120).nullable().optional(),
  is_active: z.boolean().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

function emptyToNull(v: string | null | undefined) {
  if (v === undefined || v === null) return null;
  const t = v.trim();
  return t === "" ? null : t;
}

export const upsertStorageTarget = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => upsertSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const payload = {
      station_id: data.station_id,
      name: data.name.trim(),
      provider: data.provider,
      purpose: data.purpose,
      bucket: emptyToNull(data.bucket ?? null),
      endpoint_url: emptyToNull(data.endpoint_url ?? null),
      region: emptyToNull(data.region ?? null),
      public_base_url: emptyToNull(data.public_base_url ?? null),
      access_key_ref: emptyToNull(data.access_key_ref ?? null),
      secret_key_ref: emptyToNull(data.secret_key_ref ?? null),
      is_active: data.is_active ?? true,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      metadata: (data.metadata ?? {}) as any,
    };
    if (data.id) {
      const { data: row, error } = await supabase
        .from("storage_targets").update(payload).eq("id", data.id).select().single();
      if (error) throw error;
      return { ok: true as const, target: row };
    }
    const { data: row, error } = await supabase
      .from("storage_targets").insert(payload).select().single();
    if (error) throw error;
    return { ok: true as const, target: row };
  });

export const deleteStorageTarget = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("storage_targets").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true as const };
  });

async function requireAdmin(context: { supabase: any; userId: string | null }) {
  const { data: roles } = await context.supabase.from("user_roles").select("role").eq("user_id", context.userId);
  const isAdmin = (roles ?? []).some((r: { role: string }) => r.role === "admin");
  if (!isAdmin) throw new Response("Forbidden", { status: 403 });
}

export const testStorageTarget = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const result = await runStorageHealthCheck(data.id, context.userId ?? null);
    return {
      ok: result.status === "online",
      status: result.status,
      message: result.message,
      duration_ms: result.duration_ms,
      target_id: result.target_id,
    };
  });

export const getStorageTargetInfo = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const cfg = await loadStorageTarget(data.id);
    try {
      const adapter = buildStorageAdapter(cfg);
      const info = await adapter.getStorageInfo();
      return { ok: true as const, info };
    } catch (e) {
      return { ok: false as const, error: (e as Error).message, info: null };
    }
  });
