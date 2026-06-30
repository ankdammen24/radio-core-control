import { AppError } from "../../core/app-error.js";
import type { StationRepository } from "./stations.repository.js";

export class StationService {
  constructor(private readonly repository: StationRepository) {}

  async listStations() {
    return this.repository.findAll();
  }

  async getStation(id: string) {
    const station = await this.repository.findById(id);
    if (!station) {
      throw AppError.notFound(`Station ${id} not found`, "STATION_NOT_FOUND");
    }
    return station;
  }
}
