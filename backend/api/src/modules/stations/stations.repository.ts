import { BaseRepository } from "../../repositories/base.repository.js";
import type { Station } from "./stations.types.js";

export class StationRepository extends BaseRepository<Station> {
  constructor() {
    super("stations");
  }
}
