import type { Validator } from "../../middleware/validation.middleware.js";
import { isNonEmptyString, isOneOf, isOptionalString } from "../../utils/validate.js";
import type { CreatePlaylistInput, PlaylistStatus, UpdatePlaylistInput } from "./playlists.types.js";

const STATUSES: readonly PlaylistStatus[] = ["active", "inactive"];

export const validateCreatePlaylist: Validator<CreatePlaylistInput> = (input) => {
  if (typeof input !== "object" || input === null) {
    return { valid: false, errors: ["Request body must be an object"] };
  }
  const body = input as Record<string, unknown>;
  const errors: string[] = [];

  if (!isNonEmptyString(body.name)) errors.push("name is required and must be a non-empty string");
  if (!isOptionalString(body.description)) errors.push("description must be a string");
  if (!isOptionalString(body.stationId)) errors.push("stationId must be a string");
  if (body.status !== undefined && !isOneOf(body.status, STATUSES)) {
    errors.push(`status must be one of: ${STATUSES.join(", ")}`);
  }

  if (errors.length > 0) return { valid: false, errors };

  return {
    valid: true,
    value: {
      name: (body.name as string).trim(),
      description: body.description as string | undefined,
      stationId: body.stationId as string | undefined,
      status: body.status as PlaylistStatus | undefined,
    },
  };
};

export const validateUpdatePlaylist: Validator<UpdatePlaylistInput> = (input) => {
  if (typeof input !== "object" || input === null) {
    return { valid: false, errors: ["Request body must be an object"] };
  }
  const body = input as Record<string, unknown>;
  const errors: string[] = [];

  if (body.name !== undefined && !isNonEmptyString(body.name)) errors.push("name must be a non-empty string");
  if (!isOptionalString(body.description)) errors.push("description must be a string");
  if (!isOptionalString(body.stationId)) errors.push("stationId must be a string");
  if (body.status !== undefined && !isOneOf(body.status, STATUSES)) {
    errors.push(`status must be one of: ${STATUSES.join(", ")}`);
  }

  if (errors.length > 0) return { valid: false, errors };

  return { valid: true, value: body as UpdatePlaylistInput };
};

export interface AddPlaylistItemInput {
  mediaId: string;
}

export const validateAddPlaylistItem: Validator<AddPlaylistItemInput> = (input) => {
  if (typeof input !== "object" || input === null) {
    return { valid: false, errors: ["Request body must be an object"] };
  }
  const body = input as Record<string, unknown>;
  if (!isNonEmptyString(body.mediaId)) {
    return { valid: false, errors: ["mediaId is required and must be a non-empty string"] };
  }
  return { valid: true, value: { mediaId: body.mediaId.trim() } };
};
