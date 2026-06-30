import { MongoClient, type Db } from "mongodb";

const mongoUri = process.env.MONGODB_URI ?? "mongodb://mongodb:27017/radio-core";

let client: MongoClient | undefined;
let connection: Promise<MongoClient> | undefined;

export function getMongoClient() {
  client ??= new MongoClient(mongoUri, {
    maxPoolSize: 10,
    minPoolSize: 0,
    serverSelectionTimeoutMS: 1_500,
  });
  connection ??= client.connect().catch((error) => {
    connection = undefined;
    throw error;
  });
  return connection;
}

export async function getMongoDatabase(): Promise<Db> {
  return (await getMongoClient()).db();
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
