import { Router } from "express";
import { getMongoDatabase } from "../database/mongo.js";
import { mediaAssetsCollection } from "../models/index.js";

const router = Router();

router.get("/status", async (req, res, next) => {
  try {
    const stationId = typeof req.query.station_id === "string" ? req.query.station_id : undefined;
    const collection = mediaAssetsCollection(await getMongoDatabase());
    const filter = stationId ? { station_id: stationId } : {};
    const grouped = await collection
      .aggregate<{ _id: string; count: number }>([
        { $match: filter },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ])
      .toArray();
    const byStatus = Object.fromEntries(grouped.map(({ _id, count }) => [_id, count]));
    const total = grouped.reduce((sum, row) => sum + row.count, 0);
    res.set("Cache-Control", "no-store");
    res.json({
      data: {
        total,
        ready: byStatus.ready ?? 0,
        pending: byStatus.pending ?? 0,
        processing: byStatus.processing ?? 0,
        error: byStatus.error ?? 0,
        missing_metadata: byStatus.missing_metadata ?? 0,
        by_status: byStatus,
      },
      source: "radio-core",
    });
  } catch (error) {
    next(error);
  }
});

export default router;
