import express from "express";
import { apiConfig } from "./config/api.js";
import { logger } from "./core/logger.js";
import { closeMongo, pingMongo } from "./database/mongo.js";
import { cors } from "./middleware/cors.middleware.js";
import { errorHandler } from "./middleware/error-handler.middleware.js";
import { notFound } from "./middleware/not-found.middleware.js";
import { requestId } from "./middleware/request-id.middleware.js";
import { requestLogger } from "./middleware/request-logger.middleware.js";
import { rootRouter } from "./routes/index.js";
import { startWorkers } from "./workers/index.js";

const app = express();

app.disable("x-powered-by");
app.use(requestId);
app.use(cors);
app.use(requestLogger);
app.use(express.json());

app.use(rootRouter);

app.use(notFound);
app.use(errorHandler);

const server = app.listen(apiConfig.port, "0.0.0.0", () => {
  logger.info(`radio-core-api listening on 0.0.0.0:${apiConfig.port}`);
  void pingMongo()
    .then(() => logger.info("MongoDB connected"))
    .catch((error: unknown) =>
      logger.warn("MongoDB unavailable", {
        error: error instanceof Error ? error.message : String(error),
      }),
    );
  void startWorkers();
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    server.close(() => void closeMongo().finally(() => process.exit(0)));
  });
}
