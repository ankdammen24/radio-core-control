import { AppError } from "../../core/app-error.js";
import type { MediaRepository } from "./media.repository.js";
import type { CreateMediaInput, UpdateMediaInput } from "./media.types.js";

export class MediaService {
  constructor(private readonly repository: MediaRepository) {}

  async listMedia() {
    return this.repository.findAll();
  }

  async getMedia(id: string) {
    const media = await this.repository.findById(id);
    if (!media) {
      throw AppError.notFound(`Media ${id} not found`, "MEDIA_NOT_FOUND");
    }
    return media;
  }

  async registerMedia(input: CreateMediaInput) {
    const now = new Date();
    return this.repository.insertOne({
      ...input,
      status: input.status ?? "active",
      createdAt: now,
      updatedAt: now,
    });
  }

  async updateMediaMetadata(id: string, input: UpdateMediaInput) {
    const updated = await this.repository.updateById(id, input);
    if (!updated) {
      throw AppError.notFound(`Media ${id} not found`, "MEDIA_NOT_FOUND");
    }
    return updated;
  }

  async deleteMedia(id: string) {
    const deleted = await this.repository.deleteById(id);
    if (!deleted) {
      throw AppError.notFound(`Media ${id} not found`, "MEDIA_NOT_FOUND");
    }
  }
}
