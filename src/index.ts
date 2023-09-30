import { crawl_supply_blocks, crawl_nft, crawl_minted, crawl_supply_blocks_no_db } from './crawl.js';
import { add_minters, get_all_minters, get_all_nfts, get_all_minted_nfts } from './database.js';
import { run_server } from './server.js';
//import { logger } from './logger.js';
import { listen } from './websocket.js';

run_server();
listen();

async function main() {
  await add_minters();
  const logger = { debug: (x, ...rest) => [ x, rest ] }; //temporary fallback so it doesnt log
  // Get all minters, crawl for new supply blocks
  const minters = await get_all_minters();
  for (let i=0; i < minters.length; i++) {
    const minter = minters[i];
    logger.debug(`Crawling supply blocks for ${minter.address} ${minter.name ? `(${minter.name})` : ""}`);
    await crawl_supply_blocks(minter.address, minter.head_hash);
  }
  logger.debug("FINISHED NEW SUPPLY BLOCK UPDATE");
  
  // Get all nfts, crawl for new mint blocks
  const nfts = await get_all_nfts();
  for (let i=0; i < nfts.length; i++) {
    const nft = nfts[i];
    logger.debug(`Crawling mint blocks for NFT ${nft.nft_metadata.name} ${nft.supply_hash} (minted by ${nft.minter_address})`);
    await crawl_minted(nft);
  }
  logger.debug("FINISHED NEW MINT BLOCK UPDATE");
  
  // Get all minted nfts, crawl for ownership updates
  const minted_nfts = await get_all_minted_nfts();
  for (let i=0; i < minted_nfts.length; i++) {
    const minted_nft = minted_nfts[i];
    logger.debug(`Crawling asset chain for minted NFT ${minted_nft.mint_hash} (${minted_nft.supply_hash})`);
    const nft = nfts.find((nft) => nft.supply_hash === minted_nft.supply_hash);
    await crawl_nft(nft.minter_address, minted_nft);
  }
  logger.debug("FINISHED MINTING ASSET CHAIN UPDATE");
  logger.debug("FINISHED ALL");
  
  // Repeat every 2 minutes 
  setTimeout(main, 2 * 60 * 1000);
}

// Wait for db to connect
setTimeout(main, 2000);
