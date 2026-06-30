import type { Validator } from "../../middleware/validation.middleware.js";
import { isNonEmptyString, isOneOf, isOptionalString } from "../../utils/validate.js";
import type { CreateStationInput, StationStatus, UpdateStationInput } from "./stations.types.js";

const STATUSES: readonly StationStatus[] = ["active", "inactive"];

export const validateCreateStation: Validator<CreateStationInput> = (input) => {
  const errors: string[] = [];
  if (typeof input !== "object" || input === null) {
    return { valid: false, errors: ["Request body must be an object"] };
  }
  const body = input as Record<string, unknown>;

  if (!isNonEmptyString(body.name)) errors.push("name is required and must be a non-empty string");
  if (!isNonEmptyString(body.slug)) errors.push("slug is required and must be a non-empty string");
  if (!isOptionalString(body.description)) errors.push("description must be a string");
  if (!isOptionalString(body.logoUrl)) errors.push("logoUrl must be a string");
  if (!isOptionalString(body.streamUrl)) errors.push("streamUrl must be a string");
  if (!isOptionalString(body.timezone)) errors.push("timezone must be a string");
  if (body.status !== undefined && !isOneOf(body.status, STATUSES)) {
    errors.push(`status must be one of: ${STATUSES.join(", ")}`);
  }

  if (errors.length > 0) return { valid: false, errors };

  return {
    valid: true,
    value: {
      name: (body.name as string).trim(),
      slug: (body.slug as string).trim(),
      description: body.description as string | undefined,
      logoUrl: body.logoUrl as string | undefined,
      streamUrl: body.streamUrl as string | undefined,
      timezone: body.timezone as string | undefined,
      status: body.status as StationStatus | undefined,
    },
  };
};

export const validateUpdateStation: Validator<UpdateStationInput> = (input) => {
  const errors: string[] = [];
  if (typeof input !== "object" || input === null) {
    return { valid: false, errors: ["Request body must be an object"] };
  }
  const body = input as Record<string, unknown>;

  if (body.name !== undefined && !isNonEmptyString(body.name)) errors.push("name must be a non-empty string");
  if (body.slug !== undefined && !isNonEmptyString(body.slug)) errors.push("slug must be a non-empty string");
  if (!isOptionalString(body.description)) errors.push("description must be a string");
  if (!isOptionalString(body.logoUrl)) errors.push("logoUrl must be a string");
  if (!isOptionalString(body.streamUrl)) errors.push("streamUrl must be a string");
  if (!isOptionalString(body.timezone)) errors.push("timezone must be a string");
  if (body.status !== undefined && !isOneOf(body.status, STATUSES)) {
    errors.push(`status must be one of: ${STATUSES.join(", ")}`);
  }

  if (errors.length > 0) return { valid: false, errors };

  return { valid: true, value: body as UpdateStationInput };
};
