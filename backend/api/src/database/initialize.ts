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
        required: [
          "id",
          "station_id",
          "file_name",
          "asset_type",
          "status",
          "created_at",
          "updated_at",
        ],
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
  const existing = new Set(
    (await db.listCollections({}, { nameOnly: true }).toArray()).map(({ name }) => name),
  );
  for (const { name, validator } of validators) {
    if (!existing.has(name)) await db.createCollection(name, { validator });
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
}
