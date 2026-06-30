import type { Validator } from "../../middleware/validation.middleware.js";
import { isPlainObject } from "../../utils/validate.js";

export interface UpdateSettingsInput {
  values: Record<string, unknown>;
}

export const validateUpdateSettings: Validator<UpdateSettingsInput> = (input) => {
  if (!isPlainObject(input) || !isPlainObject(input.values)) {
    return { valid: false, errors: ["Request body must be an object with a `values` object"] };
  }
  return { valid: true, value: { values: input.values } };
};
