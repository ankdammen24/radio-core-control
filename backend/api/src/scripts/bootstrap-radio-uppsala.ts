import { randomUUID } from "node:crypto";
import { closeMongo, getMongoDatabase } from "../database/mongo.js";
import { initializeMongo } from "../database/initialize.js";
import { stationsCollection } from "../models/index.js";

async function bootstrapRadioUppsala() {
  await initializeMongo();
  const stations = stationsCollection(await getMongoDatabase());
  const now = new Date();
  const id = process.env.RADIO_UPPSALA_STATION_ID ?? randomUUID();

  await stations.updateOne(
    { slug: "radio-uppsala" },
    {
      $setOnInsert: { id, created_at: now },
      $set: {
        name: "Radio Uppsala",
        slug: "radio-uppsala",
        domain: "radiouppsala.se",
        apiDomain: "api.radiouppsala.se",
        status: "active",
        description: "Lokal radio från Uppsala.",
        is_active: true,
        logo_url: null,
        accent_color: "#dc2626",
        slogan: "Uppsala i etern",
        public_url: "https://radiouppsala.se",
        updated_at: now,
      },
    },
    { upsert: true },
  );

  console.log(`Radio Uppsala bootstrap complete (${id})`);
}

bootstrapRadioUppsala()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => void closeMongo());
