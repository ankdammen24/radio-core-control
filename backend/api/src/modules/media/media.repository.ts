import { BaseRepository } from "../../repositories/base.repository.js";
import type { MediaFile } from "./media.types.js";

export class MediaRepository extends BaseRepository<MediaFile> {
  constructor() {
    super("media");
  }
}
