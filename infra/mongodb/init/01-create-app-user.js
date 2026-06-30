const appDb = db.getSiblingDB(process.env.MONGO_INITDB_DATABASE || "radiocore");
const user = process.env.MONGODB_USER || "radio";
const password = process.env.MONGODB_PASSWORD || "radio";

if (!appDb.getUser(user)) {
  appDb.createUser({
    user,
    pwd: password,
    roles: [{ role: "readWrite", db: appDb.getName() }],
  });
}
