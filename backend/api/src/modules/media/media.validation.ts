import type { Validator } from "../../middleware/validation.middleware.js";
import { isNonEmptyString, isOneOf, isOptionalNumber, isOptionalString } from "../../utils/validate.js";
import type { CreateMediaInput, MediaStatus, UpdateMediaInput } from "./media.types.js";

const STATUSES: readonly MediaStatus[] = ["active", "archived"];

export const validateCreateMedia: Validator<CreateMediaInput> = (input) => {
  if (typeof input !== "object" || input === null) {
    return { valid: false, errors: ["Request body must be an object"] };
  }
  const body = input as Record<string, unknown>;
  const errors: string[] = [];

  if (!isNonEmptyString(body.title)) errors.push("title is required and must be a non-empty string");
  if (!isOptionalString(body.artist)) errors.push("artist must be a string");
  if (!isOptionalString(body.album)) errors.push("album must be a string");
  if (!isOptionalNumber(body.duration)) errors.push("duration must be a number");
  if (!isNonEmptyString(body.fileUrl)) errors.push("fileUrl is required and must be a non-empty string");
  if (!isNonEmptyString(body.storageKey)) errors.push("storageKey is required and must be a non-empty string");
  if (!isNonEmptyString(body.type)) errors.push("type is required and must be a non-empty string");
  if (body.status !== undefined && !isOneOf(body.status, STATUSES)) {
    errors.push(`status must be one of: ${STATUSES.join(", ")}`);
  }

  if (errors.length > 0) return { valid: false, errors };

  return {
    valid: true,
    value: {
      title: (body.title as string).trim(),
      artist: body.artist as string | undefined,
      album: body.album as string | undefined,
      duration: body.duration as number | undefined,
      fileUrl: body.fileUrl as string,
      storageKey: body.storageKey as string,
      type: body.type as string,
      status: body.status as MediaStatus | undefined,
    },
  };
};

export const validateUpdateMedia: Validator<UpdateMediaInput> = (input) => {
  if (typeof input !== "object" || input === null) {
    return { valid: false, errors: ["Request body must be an object"] };
  }
  const body = input as Record<string, unknown>;
  const errors: string[] = [];

  if (body.title !== undefined && !isNonEmptyString(body.title)) errors.push("title must be a non-empty string");
  if (!isOptionalString(body.artist)) errors.push("artist must be a string");
  if (!isOptionalString(body.album)) errors.push("album must be a string");
  if (!isOptionalNumber(body.duration)) errors.push("duration must be a number");
  if (!isOptionalString(body.fileUrl)) errors.push("fileUrl must be a string");
  if (!isOptionalString(body.storageKey)) errors.push("storageKey must be a string");
  if (!isOptionalString(body.type)) errors.push("type must be a string");
  if (body.status !== undefined && !isOneOf(body.status, STATUSES)) {
    errors.push(`status must be one of: ${STATUSES.join(", ")}`);
  }

  if (errors.length > 0) return { valid: false, errors };

  return { valid: true, value: body as UpdateMediaInput };
};
