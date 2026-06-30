import type { SettingsRepository } from "./settings.repository.js";

const EMPTY_VALUES: Record<string, unknown> = {};

export class SettingsService {
  constructor(private readonly repository: SettingsRepository) {}

  async getGlobalSettings() {
    const settings = await this.repository.getGlobal();
    return settings?.values ?? EMPTY_VALUES;
  }

  async updateGlobalSettings(values: Record<string, unknown>) {
    const settings = await this.repository.upsertGlobal(values);
    return settings.values;
  }

  async getStationSettings(stationId: string) {
    const settings = await this.repository.getForStation(stationId);
    return settings?.values ?? EMPTY_VALUES;
  }

  async updateStationSettings(stationId: string, values: Record<string, unknown>) {
    const settings = await this.repository.upsertForStation(stationId, values);
    return settings.values;
  }
}
