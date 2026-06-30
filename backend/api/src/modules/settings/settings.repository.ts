import type { Filter, UpdateFilter } from "mongodb";
import { BaseRepository } from "../../repositories/base.repository.js";
import type { SettingsDocument } from "./settings.types.js";

export class SettingsRepository extends BaseRepository<SettingsDocument> {
  constructor() {
    super("settings");
  }

  async getGlobal(): Promise<SettingsDocument | null> {
    return this.findOne({ scope: "global" } as Filter<SettingsDocument>);
  }

  async getForStation(stationId: string): Promise<SettingsDocument | null> {
    return this.findOne({ scope: "station", stationId } as Filter<SettingsDocument>);
  }

  async upsertGlobal(values: Record<string, unknown>): Promise<SettingsDocument> {
    const collection = await this.collection();
    const result = await collection.findOneAndUpdate(
      { scope: "global" } as Filter<SettingsDocument>,
      {
        $set: { values, updatedAt: new Date() },
        $setOnInsert: { scope: "global" },
      } as unknown as UpdateFilter<SettingsDocument>,
      { returnDocument: "after", upsert: true },
    );
    return result as SettingsDocument;
  }

  async upsertForStation(stationId: string, values: Record<string, unknown>): Promise<SettingsDocument> {
    const collection = await this.collection();
    const result = await collection.findOneAndUpdate(
      { scope: "station", stationId } as Filter<SettingsDocument>,
      {
        $set: { values, updatedAt: new Date() },
        $setOnInsert: { scope: "station", stationId },
      } as unknown as UpdateFilter<SettingsDocument>,
      { returnDocument: "after", upsert: true },
    );
    return result as SettingsDocument;
  }
}
