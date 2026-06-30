import { Router } from "express";
import { getMongoDatabase } from "../database/mongo.js";
import { systemConfigCollection } from "../models/index.js";

const router = Router();

router.get("/public", async (_req, res, next) => {
  try {
    const config = await systemConfigCollection(await getMongoDatabase()).findOne(
      { key: "public", is_public: true },
      { projection: { _id: 0, key: 0, is_public: 0, created_at: 0, updated_at: 0 } },
    );
    if (!config) return res.status(404).json({ error: "Public config not found" });
    res.set("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
    return res.json({ data: config.value, source: "radio-core" });
  } catch (error) {
    return next(error);
  }
});

export default router;
