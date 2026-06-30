export const mongodbConfig = Object.freeze({
  uri: process.env.MONGODB_URI ?? "mongodb://mongodb:27017/radio-core",
});
