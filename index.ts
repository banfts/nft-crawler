import {
  crawl_supply_blocks,
  crawl_minted,
  crawlOwnershipUpdates,
} from "./crawl.js";
import {
  add_minters,
  get_all_minters,
  get_all_nfts,
  get_all_minted_nfts_cursor,
} from "./database.js";
import { log } from "./log.js";

async function main() {
  await add_minters();
  const minters = await get_all_minters();

  // Parallel crawling for supply blocks
  await Promise.all(
    minters.map((minter) => {
      log(
        `Crawling supply blocks for ${minter.address} ${
          minter.name ? `(${minter.name})` : ""
        }`
      );
      return minter.head_hash
        ? crawl_supply_blocks(minter.address, minter.head_hash)
        : crawl_supply_blocks(minter.address);
    })
  );
  log("\\033[0;32mFINISHED NEW SUPPLY BLOCK UPDATE\\033[0m", Date.now());

  // Parallel crawling for mint blocks
  const nfts = await get_all_nfts();
  await Promise.all(
    nfts.map((nft) => {
      log(
        `Crawling mint blocks for NFT ${nft.nft_metadata.name} ${nft.supply_hash} (minted by ${nft.minter_address})`
      );
      return crawl_minted(nft);
    })
  );
  log("\\033[0;32mFINISHED NEW MINT BLOCK UPDATE\\033[0m", Date.now());
  //then get all minted nfts, crawl for ownership updates
  //see: https://stackoverflow.com/questions/44248108/mongodb-error-getmore-command-failed-cursor-not-found#44250410
  // Parallel crawling for ownership updates
  let new_cursor_time = Date.now();
  let minted_nfts_cursor = (await get_all_minted_nfts_cursor())
    .sort({ _id: -1 })
    .batchSize(120);
  let processed = 0; // Initialize the processed counter

  while (await minted_nfts_cursor.hasNext()) {
    await crawlOwnershipUpdates(nfts, minted_nfts_cursor);

    // Updating processed count and cursor for efficient data handling
    if (Date.now() > new_cursor_time + 6 * 60 * 1000) {
      log("\\033[0;32mNew cursor\\033[0m");
      new_cursor_time = Date.now();
      processed += 120; // Increment processed count by the batch size
      minted_nfts_cursor = (await get_all_minted_nfts_cursor())
        .sort({ _id: -1 })
        .skip(processed)
        .batchSize(120);
    }
  }
  log("FINISHED MINTING ASSET CHAIN UPDATE", Date.now());
  log("FINISHED ALL");
  setTimeout(main, 4 * 60 * 1000);
}

//wait for db to connect
setTimeout(main, 5000);
