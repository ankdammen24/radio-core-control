import type { Document, Db } from "mongodb";
import { getMongoDatabase } from "./mongo.js";
import {
  MEDIA_ASSETS_COLLECTION,
  STATIONS_COLLECTION,
  SYSTEM_CONFIG_COLLECTION,
  mediaAssetsCollection,
  stationsCollection,
  systemConfigCollection,
} from "../models/index.js";

const RADIO_UPPSALA_ID =
  process.env.RADIO_UPPSALA_STATION_ID ?? "7b5fd114-b188-4d8d-9210-3e924c68efc7";
const SEED_MEDIA_ID = "ef279c25-bb3d-46a8-9c34-a83ce4c444b4";

const validators: Array<{ name: string; validator: Document }> = [
  {
    name: STATIONS_COLLECTION,
    validator: {
      $jsonSchema: {
        bsonType: "object",
        required: ["id", "name", "slug", "is_active", "created_at", "updated_at"],
        properties: {
          id: { bsonType: "string" },
          name: { bsonType: "string" },
          slug: { bsonType: "string" },
          is_active: { bsonType: "bool" },
        },
      },
    },
  },
  {
    name: MEDIA_ASSETS_COLLECTION,
    validator: {
      $jsonSchema: {
        bsonType: "object",
        required: ["id", "station_id", "file_name", "asset_type", "status", "created_at", "updated_at"],
      },
    },
  },
  {
    name: SYSTEM_CONFIG_COLLECTION,
    validator: {
      $jsonSchema: {
        bsonType: "object",
        required: ["key", "value", "is_public", "created_at", "updated_at"],
      },
    },
  },
];

async function ensureCollections(db: Db) {
  const existing = new Set((await db.listCollections({}, { nameOnly: true }).toArray()).map(({ name }) => name));
  for (const { name, validator } of validators) {
    if (!existing.has(name)) await db.createCollection(name, { validator });
    else await db.command({ collMod: name, validator, validationLevel: "moderate" });
  }
}

export async function initializeMongo() {
  const db = await getMongoDatabase();
  await ensureCollections(db);

  const stations = stationsCollection(db);
  const mediaAssets = mediaAssetsCollection(db);
  const systemConfig = systemConfigCollection(db);
  await Promise.all([
    stations.createIndex({ id: 1 }, { unique: true }),
    stations.createIndex({ slug: 1 }, { unique: true }),
    mediaAssets.createIndex({ id: 1 }, { unique: true }),
    mediaAssets.createIndex({ station_id: 1, status: 1 }),
    systemConfig.createIndex({ key: 1 }, { unique: true }),
  ]);

  const now = new Date();
  await stations.updateOne(
    { id: RADIO_UPPSALA_ID },
    {
      $setOnInsert: {
        id: RADIO_UPPSALA_ID,
        name: "Radio Uppsala",
        slug: "radio-uppsala",
        description: "Lokal radio från Uppsala.",
        is_active: true,
        logo_url: null,
        accent_color: "#dc2626",
        slogan: "Uppsala i etern",
        public_url: "https://radiouppsala.se",
        created_at: now,
      },
      $set: { updated_at: now },
    },
    { upsert: true },
  );

  await mediaAssets.updateOne(
    { id: SEED_MEDIA_ID },
    {
      $setOnInsert: {
        id: SEED_MEDIA_ID,
        station_id: RADIO_UPPSALA_ID,
        file_name: "radio-uppsala-station-ident.mp3",
        asset_type: "jingle",
        status: "pending",
        playback_url: null,
        duration_seconds: null,
        created_at: now,
      },
      $set: { updated_at: now },
    },
    { upsert: true },
  );

  await systemConfig.updateOne(
    { key: "public" },
    {
      $setOnInsert: { key: "public", created_at: now },
      $set: {
        is_public: true,
        updated_at: now,
        value: {
          product_name: "Radio Core",
          default_station_slug: "radio-uppsala",
          public_site_url: "https://radiouppsala.se",
          listen_url: "https://listen.radiouppsala.se",
          support_email: "info@radiouppsala.se",
          features: { podcasts: true, requests: true, public_player: true },
        },
      },
    },
    { upsert: true },
  );
}
