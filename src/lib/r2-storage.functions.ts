/**
 * Server functions exposing Cloudflare R2 storage to the admin UI.
 *
 * All uploads happen server-side. Frontend never receives R2 credentials.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  type BucketType,
  putObject,
  deleteObjectByType,
  validateUpload,
  getPublicUrl,
} from "@/server/r2-storage.server";

const BucketTypeEnum = z.enum(["media", "artwork", "public"]);

const UploadSchema = z.object({
  type: BucketTypeEnum,
  filename: z.string().min(1).max(512).regex(/^[^/\\]+$/, "filename must not contain slashes"),
  contentType: z.string().min(1).max(255),
  // base64-encoded payload (without data: prefix)
  base64: z.string().min(1),
  // Optional logical sub-path inside the bucket (e.g. "tracks/2026/")
  pathPrefix: z.string().max(512).regex(/^[a-zA-Z0-9/_-]*$/).optional(),
  stationId: z.string().uuid().optional(),
});

export const uploadObject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => UploadSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const buf = Buffer.from(data.base64, "base64");

    validateUpload(data.type, data.filename, data.contentType, buf.byteLength);

    const prefix = (data.pathPrefix ?? "").replace(/^\/+|\/+$/g, "");
    // Add a unique suffix to avoid collisions.
    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const safeName = data.filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    const key = (prefix ? `${prefix}/` : "") + `${stamp}-${safeName}`;

    const { url } = await putObject(data.type, key, buf, data.contentType);

    const bucketName = (await import("@/server/r2-storage.server")).bucketName(data.type);

    const { data: row, error } = await supabase
      .from("storage_objects")
      .insert({
        bucket_type: data.type,
        bucket: bucketName,
        object_key: key,
        content_type: data.contentType,
        size_bytes: buf.byteLength,
        public_url: url,
        uploaded_by: userId,
        station_id: data.stationId ?? null,
      })
      .select()
      .single();
    if (error) {
      // Best-effort rollback of the uploaded object.
      try { await deleteObjectByType(data.type, key); } catch { /* ignore */ }
      throw new Error(`DB insert failed: ${error.message}`);
    }

    return row;
  });

const DeleteSchema = z.object({ id: z.string().uuid() });

export const deleteStoredObject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => DeleteSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: row, error } = await supabase
      .from("storage_objects")
      .select("id, bucket_type, object_key")
      .eq("id", data.id)
      .single();
    if (error || !row) throw new Error(error?.message || "Object not found");

    await deleteObjectByType(row.bucket_type as BucketType, row.object_key);

    const { error: delErr } = await supabase.from("storage_objects").delete().eq("id", row.id);
    if (delErr) throw new Error(delErr.message);
    return { ok: true };
  });

export const listStoredObjects = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("storage_objects")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return (data ?? []).map((r: any) => ({
      ...r,
      // Always recompute in case public-url envs change.
      public_url: r.public_url ?? getPublicUrl(r.bucket_type as BucketType, r.object_key),
    }));
  });
