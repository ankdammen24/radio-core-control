import type { Collection, Document, Filter, OptionalUnlessRequiredId, UpdateFilter, WithId } from "mongodb";
import { ObjectId } from "mongodb";
import { getMongoDatabase } from "../database/mongo.js";

export abstract class BaseRepository<T extends Document> {
  protected constructor(private readonly collectionName: string) {}

  protected async collection(): Promise<Collection<T>> {
    const db = await getMongoDatabase();
    return db.collection<T>(this.collectionName);
  }

  async findAll(filter: Filter<T> = {}): Promise<WithId<T>[]> {
    const collection = await this.collection();
    return collection.find(filter).toArray();
  }

  async findOne(filter: Filter<T>): Promise<WithId<T> | null> {
    const collection = await this.collection();
    return collection.findOne(filter);
  }

  async findById(id: string): Promise<WithId<T> | null> {
    if (!ObjectId.isValid(id)) return null;
    const collection = await this.collection();
    return collection.findOne({ _id: new ObjectId(id) } as Filter<T>);
  }

  async insertOne(doc: OptionalUnlessRequiredId<T>): Promise<WithId<T>> {
    const collection = await this.collection();
    const result = await collection.insertOne(doc);
    return { ...doc, _id: result.insertedId } as WithId<T>;
  }

  async updateById(id: string, update: Partial<T>): Promise<WithId<T> | null> {
    if (!ObjectId.isValid(id)) return null;
    const collection = await this.collection();
    return collection.findOneAndUpdate(
      { _id: new ObjectId(id) } as Filter<T>,
      { $set: { ...update, updatedAt: new Date() } } as unknown as UpdateFilter<T>,
      { returnDocument: "after" },
    );
  }

  async deleteById(id: string): Promise<boolean> {
    if (!ObjectId.isValid(id)) return false;
    const collection = await this.collection();
    const result = await collection.deleteOne({ _id: new ObjectId(id) } as Filter<T>);
    return result.deletedCount === 1;
  }
}
