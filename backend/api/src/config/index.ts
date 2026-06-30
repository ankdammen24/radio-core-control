import { apiConfig } from "./api.js";
import { authConfig } from "./auth.js";
import { mongodbConfig } from "./mongodb.js";
import { storageConfig } from "./storage.js";
import { workerConfig } from "./worker.js";

export const config = Object.freeze({
  api: apiConfig,
  mongodb: mongodbConfig,
  auth: authConfig,
  storage: storageConfig,
  worker: workerConfig,
});

export { apiConfig, authConfig, mongodbConfig, storageConfig, workerConfig };
