import * as dotenv from 'dotenv';

import { MongoClient } from 'mongodb';

import { DATABASE_URI } from './config.js';

import { logger } from './logger.js';

dotenv.config();

const connectionString = DATABASE_URI;

const client = new MongoClient(connectionString);

let connection;
/*
client.connect()
  .then((dbConnection) => {
    connection = dbConnection;
    logger.debug('Connected to database');
  })
  .catch((error) => {
    logger.error(error)
  });
*/ // testing co to esnext for top level await hhe
try {
  connection = await client.connect();
  logger.debug('Connected to database');
} catch (error) {
  logger.error(error);
  connection.error(error);
}


export const nftDb = connection.db('nfts');
