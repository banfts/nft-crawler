import * as dotenv from 'dotenv';
import { crawl_supply_blocks, crawl_nft, crawl_minted } from './crawl.js';
import { add_minters, get_all_minters, get_all_nfts, get_all_minted_nfts } from './database.js';

dotenv.config();

//get all minters, crawl for new supply blocks

//then get all nfts, crawl for new mint blocks

//then get all minted nfts, crawl for ownership updates
