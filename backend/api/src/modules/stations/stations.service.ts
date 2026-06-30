import { AppError } from "../../core/app-error.js";
import type { StationRepository } from "./stations.repository.js";
import type { CreateStationInput, UpdateStationInput } from "./stations.types.js";

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

  async createStation(input: CreateStationInput) {
    const existing = await this.repository.findOne({ slug: input.slug });
    if (existing) {
      throw new AppError(`Station with slug "${input.slug}" already exists`, {
        statusCode: 409,
        code: "STATION_SLUG_TAKEN",
      });
    }
    const now = new Date();
    return this.repository.insertOne({
      ...input,
      status: input.status ?? "active",
      createdAt: now,
      updatedAt: now,
    });
  }

  async updateStation(id: string, input: UpdateStationInput) {
    const updated = await this.repository.updateById(id, input);
    if (!updated) {
      throw AppError.notFound(`Station ${id} not found`, "STATION_NOT_FOUND");
    }
    return updated;
  }

  async deleteStation(id: string) {
    const deleted = await this.repository.deleteById(id);
    if (!deleted) {
      throw AppError.notFound(`Station ${id} not found`, "STATION_NOT_FOUND");
    }
  }
}
