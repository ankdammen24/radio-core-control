/**
 * Cloudflare R2 (S3-compatible) storage helpers.
 *
 * Server-only. Never import from client code.
 *
 * Buckets:
 *   - media   (audio, mp3/wav/flac/m4a/ogg)   -> MEDIA_PUBLIC_URL
 *   - artwork (images, jpg/png/webp/svg)      -> ARTWORK_PUBLIC_URL
 *   - public  (any allowed type)              -> PUBLIC_CDN_URL
 */
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export type BucketType = "media" | "artwork" | "public";

export const AUDIO_EXTS = ["mp3", "wav", "flac", "m4a", "ogg"];
export const AUDIO_MIME = [
  "audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav",
  "audio/flac", "audio/x-flac", "audio/mp4", "audio/m4a",
  "audio/x-m4a", "audio/ogg", "audio/vorbis",
];

export const IMAGE_EXTS = ["jpg", "jpeg", "png", "webp", "svg"];
export const IMAGE_MIME = [
  "image/jpeg", "image/png", "image/webp", "image/svg+xml",
];

export const MAX_AUDIO_BYTES = 500 * 1024 * 1024; // 500 MB
export const MAX_IMAGE_BYTES = 25 * 1024 * 1024;  //  25 MB

function envOrThrow(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

export function getR2Config() {
  return {
    endpoint: envOrThrow("S3_ENDPOINT"),
    region: process.env.S3_REGION || "auto",
    accessKeyId: envOrThrow("S3_ACCESS_KEY_ID"),
    secretAccessKey: envOrThrow("S3_SECRET_ACCESS_KEY"),
    buckets: {
      media: envOrThrow("S3_BUCKET_MEDIA"),
      artwork: envOrThrow("S3_BUCKET_ARTWORK"),
      public: envOrThrow("S3_BUCKET_PUBLIC"),
    },
    publicUrls: {
      media: envOrThrow("MEDIA_PUBLIC_URL").replace(/\/+$/, ""),
      artwork: envOrThrow("ARTWORK_PUBLIC_URL").replace(/\/+$/, ""),
      public: envOrThrow("PUBLIC_CDN_URL").replace(/\/+$/, ""),
    },
  };
}

let _client: S3Client | null = null;
export function getS3Client(): S3Client {
  if (_client) return _client;
  const cfg = getR2Config();
  _client = new S3Client({
    region: cfg.region,
    endpoint: cfg.endpoint,
    forcePathStyle: true,
    credentials: {
      accessKeyId: cfg.accessKeyId,
      secretAccessKey: cfg.secretAccessKey,
    },
  });
  return _client;
}

export function bucketName(type: BucketType): string {
  return getR2Config().buckets[type];
}

export function getPublicUrl(type: BucketType, key: string): string {
  const base = getR2Config().publicUrls[type];
  const k = key.replace(/^\/+/, "");
  return `${base}/${k}`;
}

function extOf(name: string): string {
  const m = name.toLowerCase().match(/\.([a-z0-9]+)$/);
  return m ? m[1] : "";
}

export function validateUpload(
  type: BucketType,
  filename: string,
  contentType: string,
  sizeBytes: number,
) {
  const ext = extOf(filename);
  const ct = (contentType || "").toLowerCase();

  let allowedExts: string[];
  let allowedMime: string[];
  let maxBytes: number;

  if (type === "media") {
    allowedExts = AUDIO_EXTS;
    allowedMime = AUDIO_MIME;
    maxBytes = MAX_AUDIO_BYTES;
  } else if (type === "artwork") {
    allowedExts = IMAGE_EXTS;
    allowedMime = IMAGE_MIME;
    maxBytes = MAX_IMAGE_BYTES;
  } else {
    allowedExts = [...AUDIO_EXTS, ...IMAGE_EXTS];
    allowedMime = [...AUDIO_MIME, ...IMAGE_MIME];
    maxBytes = MAX_AUDIO_BYTES;
  }

  if (!allowedExts.includes(ext)) {
    throw new Error(
      `File extension .${ext || "?"} not allowed for ${type}. Allowed: ${allowedExts.join(", ")}`,
    );
  }
  if (ct && !allowedMime.includes(ct)) {
    throw new Error(`Content-type ${ct} not allowed for ${type}.`);
  }
  if (sizeBytes <= 0) throw new Error("Empty file");
  if (sizeBytes > maxBytes) {
    throw new Error(`File too large (${sizeBytes} bytes > ${maxBytes}).`);
  }
}

export async function putObject(
  type: BucketType,
  key: string,
  body: Buffer | Uint8Array,
  contentType: string,
) {
  const cleanKey = key.replace(/^\/+/, "");
  await getS3Client().send(
    new PutObjectCommand({
      Bucket: bucketName(type),
      Key: cleanKey,
      Body: body,
      ContentType: contentType || "application/octet-stream",
    }),
  );
  return { key: cleanKey, url: getPublicUrl(type, cleanKey) };
}

/** Convenience wrappers matching the public storage API. */
export async function uploadMedia(body: Buffer | Uint8Array, key: string, contentType: string) {
  return putObject("media", key, body, contentType);
}
export async function uploadArtwork(body: Buffer | Uint8Array, key: string, contentType: string) {
  return putObject("artwork", key, body, contentType);
}
export async function uploadPublic(body: Buffer | Uint8Array, key: string, contentType: string) {
  return putObject("public", key, body, contentType);
}
export async function deleteObject(bucket: BucketType, key: string) {
  return deleteObjectByType(bucket, key);
}

export async function deleteObjectByType(type: BucketType, key: string) {
  await getS3Client().send(
    new DeleteObjectCommand({ Bucket: bucketName(type), Key: key.replace(/^\/+/, "") }),
  );
}

export async function headObject(type: BucketType, key: string) {
  return getS3Client().send(
    new HeadObjectCommand({ Bucket: bucketName(type), Key: key.replace(/^\/+/, "") }),
  );
}

/** Stub for future private-playback signed URLs. */
export async function getSignedReadUrl(type: BucketType, key: string, expiresInSeconds = 900) {
  const cmd = new (await import("@aws-sdk/client-s3")).GetObjectCommand({
    Bucket: bucketName(type),
    Key: key.replace(/^\/+/, ""),
  });
  return getSignedUrl(getS3Client(), cmd, { expiresIn: expiresInSeconds });
}
