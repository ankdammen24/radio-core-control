import express from "express";
import { closeMongo, pingMongo } from "./database/mongo.js";

const app = express();
const port = Number(process.env.PORT) || 3000;

app.disable("x-powered-by");

app.get("/health", (_request, response) => {
  response.set("Cache-Control", "no-store");
  response.status(200).json({ status: "ok", service: "radio-core-api" });
});

app.get("/api/health", async (_request, response) => {
  const database = await pingMongo()
    .then(() => "connected" as const)
    .catch(() => "not_connected" as const);

  response.set("Cache-Control", "no-store");
  response.status(200).json({ status: "ok", service: "radio-core-api", database });
});

app.use((_request, response) => {
  response.status(404).json({ error: "Not found" });
});

const server = app.listen(port, "0.0.0.0", () => {
  console.log(`[radio-core-api] listening on 0.0.0.0:${port}`);
  void pingMongo()
    .then(() => console.log("[radio-core-api] MongoDB connected"))
    .catch((error) => console.warn(`[radio-core-api] MongoDB unavailable: ${error.message}`));
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    server.close(() => void closeMongo().finally(() => process.exit(0)));
  });
}
