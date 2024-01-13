import {
  crawl_supply_blocks,
  crawl_minted,
  crawl_ownership_updates,
} from "./crawl.js";
import {
  add_minters,
  get_all_minters,
  get_all_nfts,
  get_all_minted_nfts_cursor,
} from "./database.js";
import { log } from "./log.js";

const NFT_BATCH_SIZE: number = 50;

async function main() {
  await add_minters();
  const minters = await get_all_minters();

  // Parallel crawling for supply blocks
  await Promise.all(
    minters.map((minter) => {
      return minter.head_hash ? crawl_supply_blocks(minter, minter.head_hash) : crawl_supply_blocks(minter);
    })
  );
  log("\x1b[0;32mFINISHED NEW SUPPLY BLOCK UPDATE\x1b[0m", Date.now());

  // Parallel crawling for mint blocks
  const nfts = await get_all_nfts();
  await Promise.all(
    nfts.map((nft) => {
      return crawl_minted(nft);
    })
  );
  log("\x1b[0;32mFINISHED NEW MINT BLOCK UPDATE\x1b[0m", Date.now());
  //then get all minted nfts, crawl for ownership updates
  //see: https://stackoverflow.com/questions/44248108/mongodb-error-getmore-command-failed-cursor-not-found#44250410
  // Parallel crawling for ownership updates
  let new_cursor_time: number = Date.now();
  let minted_nfts_cursor = (await get_all_minted_nfts_cursor()).sort({ _id: -1 }).batchSize(120);
  let processed: number = 0; // Initialize the processed counter

  while (await minted_nfts_cursor.hasNext()) {
    log("\x1b[0;32mCrawl batch start\x1b[0m", Date.now());

    await crawl_ownership_updates(nfts, minted_nfts_cursor, NFT_BATCH_SIZE);

    processed += NFT_BATCH_SIZE;

    // Updating processed count and cursor for efficient data handling
    if (Date.now() > new_cursor_time + 6 * 60 * 1000) {
      log("\x1b[0;32mNew cursor\x1b[0m");
      new_cursor_time = Date.now();
      minted_nfts_cursor = (await get_all_minted_nfts_cursor()).sort({ _id: -1 }).skip(processed).batchSize(120);
    }
  }
  log("FINISHED MINTING ASSET CHAIN UPDATE", Date.now());
  log("FINISHED ALL");
  setTimeout(main, 8 * 60 * 1000);
}

//wait for db to connect
setTimeout(main, 5000);
