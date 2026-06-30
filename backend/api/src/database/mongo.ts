import { MongoClient, type Db } from "mongodb";

const mongoUrl = process.env.MONGODB_URL;
const databaseName = process.env.MONGODB_DB ?? "radiocore";

let client: MongoClient | undefined;
let connection: Promise<MongoClient> | undefined;

export function getMongoClient() {
  if (!mongoUrl) throw new Error("MONGODB_URL is not configured");
  client ??= new MongoClient(mongoUrl, {
    maxPoolSize: 10,
    minPoolSize: 0,
    serverSelectionTimeoutMS: 3_000,
  });
  connection ??= client.connect().catch((error) => {
    connection = undefined;
    throw error;
  });
  return connection;
}

export async function getMongoDatabase(): Promise<Db> {
  return (await getMongoClient()).db(databaseName);
}

export async function pingMongo() {
  const startedAt = Date.now();
  await (await getMongoDatabase()).command({ ping: 1 });
  return { ok: true as const, latency_ms: Date.now() - startedAt };
}

export async function closeMongo() {
  await client?.close();
  client = undefined;
  connection = undefined;
}
