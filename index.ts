import { crawl_supply_blocks, crawl_nft, crawl_minted, crawl_supply_blocks_no_db } from './crawl.js';
import { add_minters, get_all_minters, get_all_nfts, get_all_minted_nfts } from './database.js';
import { start } from './web.js';

start();

async function main() {
  await add_minters();
  //get all minters, crawl for new supply blocks
  let minters = await get_all_minters();
  for (let i=0; i < minters.length; i++) {
    let minter = minters[i];
    console.log(`Crawling supply blocks for ${minter.address} ${minter.name ? `(${minter.name})` : ""}`);
    await crawl_supply_blocks(minter.address, minter.head_hash);
  }
  console.log("FINISHED NEW SUPPLY BLOCK UPDATE");
  //then get all nfts, crawl for new mint blocks
  let nfts = await get_all_nfts();
  for (let i=0; i < nfts.length; i++) {
    let nft = nfts[i];
    console.log(`Crawling mint blocks for NFT ${nft.nft_metadata.name} ${nft.supply_hash} (minted by ${nft.minter_address})`);
    await crawl_minted(nft);
  }
  console.log("FINISHED NEW MINT BLOCK UPDATE");
  //then get all minted nfts, crawl for ownership updates
  let minted_nfts = await get_all_minted_nfts();
  for (let i=0; i < minted_nfts.length; i++) {
    let minted_nft = minted_nfts[i];
    console.log(`Crawling asset chain for minted NFT ${minted_nft.mint_hash} (${minted_nft.supply_hash})`);
    let nft = nfts.find((nft) => nft.supply_hash === minted_nft.supply_hash);
    await crawl_nft(nft.minter_address, minted_nft);
  }
  console.log("FINISHED MINTING ASSET CHAIN UPDATE");
  console.log("FINISHED ALL");
  //and do it all again after 2 minutes
  setTimeout(main, 2*60*1000);
}

//wait for db to connect
setTimeout(main, 2000);
