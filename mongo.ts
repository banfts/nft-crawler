import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';

dotenv.config();

if (!process.env.MONGO_CONNECTION_STRING!) {
  throw new Error("`MONGO_CONNECTION_STRING` missing from env variables");
}

const client: MongoClient = new MongoClient(process.env.MONGO_CONNECTION_STRING!);

export async function connect() {
  await client.connect();
  return client.db("crawler");
}
