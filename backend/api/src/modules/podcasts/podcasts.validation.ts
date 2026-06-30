import type { Validator } from "../../middleware/validation.middleware.js";
import { isNonEmptyString, isOneOf, isOptionalNumber, isOptionalString } from "../../utils/validate.js";
import type {
  CreateEpisodeInput,
  CreatePodcastInput,
  EpisodeStatus,
  PodcastStatus,
  UpdatePodcastInput,
} from "./podcasts.types.js";

const PODCAST_STATUSES: readonly PodcastStatus[] = ["active", "inactive"];
const EPISODE_STATUSES: readonly EpisodeStatus[] = ["draft", "published"];

export const validateCreatePodcast: Validator<CreatePodcastInput> = (input) => {
  if (typeof input !== "object" || input === null) {
    return { valid: false, errors: ["Request body must be an object"] };
  }
  const body = input as Record<string, unknown>;
  const errors: string[] = [];

  if (!isNonEmptyString(body.title)) errors.push("title is required and must be a non-empty string");
  if (!isOptionalString(body.description)) errors.push("description must be a string");
  if (!isOptionalString(body.author)) errors.push("author must be a string");
  if (!isOptionalString(body.imageUrl)) errors.push("imageUrl must be a string");
  if (!isOptionalString(body.rssUrl)) errors.push("rssUrl must be a string");
  if (body.status !== undefined && !isOneOf(body.status, PODCAST_STATUSES)) {
    errors.push(`status must be one of: ${PODCAST_STATUSES.join(", ")}`);
  }

  if (errors.length > 0) return { valid: false, errors };

  return {
    valid: true,
    value: {
      title: (body.title as string).trim(),
      description: body.description as string | undefined,
      author: body.author as string | undefined,
      imageUrl: body.imageUrl as string | undefined,
      rssUrl: body.rssUrl as string | undefined,
      status: body.status as PodcastStatus | undefined,
    },
  };
};

export const validateUpdatePodcast: Validator<UpdatePodcastInput> = (input) => {
  if (typeof input !== "object" || input === null) {
    return { valid: false, errors: ["Request body must be an object"] };
  }
  const body = input as Record<string, unknown>;
  const errors: string[] = [];

  if (body.title !== undefined && !isNonEmptyString(body.title)) errors.push("title must be a non-empty string");
  if (!isOptionalString(body.description)) errors.push("description must be a string");
  if (!isOptionalString(body.author)) errors.push("author must be a string");
  if (!isOptionalString(body.imageUrl)) errors.push("imageUrl must be a string");
  if (!isOptionalString(body.rssUrl)) errors.push("rssUrl must be a string");
  if (body.status !== undefined && !isOneOf(body.status, PODCAST_STATUSES)) {
    errors.push(`status must be one of: ${PODCAST_STATUSES.join(", ")}`);
  }

  if (errors.length > 0) return { valid: false, errors };

  return { valid: true, value: body as UpdatePodcastInput };
};

export const validateCreateEpisode: Validator<CreateEpisodeInput> = (input) => {
  if (typeof input !== "object" || input === null) {
    return { valid: false, errors: ["Request body must be an object"] };
  }
  const body = input as Record<string, unknown>;
  const errors: string[] = [];

  if (!isNonEmptyString(body.title)) errors.push("title is required and must be a non-empty string");
  if (!isOptionalString(body.description)) errors.push("description must be a string");
  if (!isOptionalString(body.audioUrl)) errors.push("audioUrl must be a string");
  if (!isOptionalNumber(body.duration)) errors.push("duration must be a number");
  if (!isOptionalString(body.publishedAt)) errors.push("publishedAt must be an ISO date string");
  if (body.status !== undefined && !isOneOf(body.status, EPISODE_STATUSES)) {
    errors.push(`status must be one of: ${EPISODE_STATUSES.join(", ")}`);
  }

  if (errors.length > 0) return { valid: false, errors };

  return {
    valid: true,
    value: {
      title: (body.title as string).trim(),
      description: body.description as string | undefined,
      audioUrl: body.audioUrl as string | undefined,
      duration: body.duration as number | undefined,
      publishedAt: body.publishedAt as string | undefined,
      status: body.status as EpisodeStatus | undefined,
    },
  };
};
