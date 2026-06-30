import { Router } from "express";
import { getMongoDatabase } from "../database/mongo.js";
import { stationsCollection, type StationDocument } from "../models/index.js";

const router = Router();

function serializeStation({ _id: _ignored, ...station }: StationDocument & { _id?: unknown }) {
  return station;
}

router.get("/", async (_req, res, next) => {
  try {
    const stations = await stationsCollection(await getMongoDatabase())
      .find({}, { projection: { _id: 0 } })
      .sort({ name: 1 })
      .toArray();
    res.set("Cache-Control", "public, max-age=30, stale-while-revalidate=60");
    res.json({
      data: stations.map(serializeStation),
      source: "radio-core",
      count: stations.length,
    });
  } catch (error) {
    next(error);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const station = await stationsCollection(await getMongoDatabase()).findOne(
      { id: req.params.id },
      { projection: { _id: 0 } },
    );
    if (!station) return res.status(404).json({ error: "Station not found" });
    res.set("Cache-Control", "public, max-age=30, stale-while-revalidate=60");
    return res.json({ data: serializeStation(station), source: "radio-core" });
  } catch (error) {
    return next(error);
  }
});

export default router;
