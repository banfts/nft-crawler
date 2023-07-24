import * as dotenv from 'dotenv';
import { crawl_supply_blocks, crawl_nft, crawl_minted } from './crawl.js';
import { get_all_minters, get_nft, add_nft, get_minted_nft, add_minted_nft } from './database.js';

dotenv.config();

//
