import * as dotenv from 'dotenv';
import { crawl_supply_blocks, crawl_nft, crawl_minted } from './crawl.js';
import { add_minters, get_all_minters, get_all_nfts, get_all_minted_nfts } from './database.js';

dotenv.config();

async function main() {
  await add_minters();
  //get all minters, crawl for new supply blocks
  let minters = await get_all_minters();
  for (let i=0; i < minters.length; i++) {
    let minter = minters[i];
    await crawl_supply_blocks(minter.address, minter.head_hash);
  }
  //then get all nfts, crawl for new mint blocks
  let nfts = await get_all_nfts();
  for (let i=0; i < nfts.length; i++) {
    let nft = nfts[i];
    await crawl_minted(nft.minter_address, nft.supply_hash, nft.head_hash);
  }
  //then get all minted nfts, crawl for ownership updates
  let minted_nfts = await get_all_minted_nfts();
  for (let i=0; i < minted_nfts.length; i++) {
    let minted_nft = minted_nfts[i];
    let nft = nfts.find((nft) => nft.supply_hash === minted_nft.supply_hash);
    await crawl_nft(nft.minter_address, minted_nft);
  }
}

//wait for db to connect
setTimeout(main, 2000);
