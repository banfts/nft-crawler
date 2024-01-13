import { NanoNode } from "nano-account-crawler/dist/nano-node";
import type { INanoBlock } from "nano-account-crawler/dist/nano-interfaces";
import { SupplyBlocksCrawler } from "banano-nft-crawler/dist/supply-blocks-crawler";
import { MintBlocksCrawler } from "banano-nft-crawler/dist/mint-blocks-crawler";
import { AssetCrawler } from "banano-nft-crawler/dist/asset-crawler";
import { parseSupplyRepresentative } from "banano-nft-crawler/dist/block-parsers/supply";
import { bananoIpfs } from "banano-nft-crawler/dist/lib/banano-ipfs";
import { getBlock } from "banano-nft-crawler/dist/lib/get-block";
import { BananoUtil } from "@bananocoin/bananojs";
import {
  add_nft,
  add_minted_nft,
  update_mint_blocks_head_hash,
  update_minter_head_hash,
  count_mint_blocks,
  Address,
  NFT,
  MintedNFT,
  Minter,
} from "./database.js";
import { log } from "./log.js";

import fetch from "node-fetch";

// List of RPC endpoints
const RPC_ENDPOINTS: string[] = [
  "https://booster.dev-ptera.com/banano-rpc",
  "https://api.banano.trade/proxy",
];

let current_rpc_index: number = 0;

let banano_node = new NanoNode(
  RPC_ENDPOINTS[current_rpc_index],
  fetch
);

export interface NFTTips {
  name: string;
  account: string;
}

export interface NFTProperties {
  issuer: string;
  supply_block_hash: string;
  tips?: NFTTips[];
}

export interface NFTMetadata {
  name: string;
  image: string;
  description: string;
  external_url?: string;
  animation_url?: string;
  properties: NFTProperties;
}

function ipfs_to_metadata(ipfs_json: any): NFTMetadata | undefined {
  //required
  if (
    typeof ipfs_json.name !== "string" ||
    typeof ipfs_json.description !== "string" ||
    typeof ipfs_json.description !== "string"
  )
    return undefined;
  if (
    typeof ipfs_json.properties?.issuer !== "string" ||
    typeof ipfs_json.properties?.supply_block_hash !== "string"
  )
    return undefined;
  //optional
  if (
    (typeof ipfs_json.external_url !== "string" &&
      typeof ipfs_json.external_url !== "undefined") ||
    (typeof ipfs_json.animation_url !== "string" &&
      typeof ipfs_json.animation_url !== "undefined")
  )
    return undefined;
  //tips
  if (ipfs_json.properties?.tips) {
    if (
      !ipfs_json.properties.tips.every(
        (tip) => typeof tip.name === "string" && typeof tip.account === "string"
      )
    )
      return undefined;
  }
  return {
    name: ipfs_json.name,
    image: ipfs_json.image,
    description: ipfs_json.description,
    external_url: ipfs_json.external_url,
    animation_url: ipfs_json.animation_url,
    properties: {
      issuer: ipfs_json.properties.issuer,
      supply_block_hash: ipfs_json.properties.supply_block_hash,
      tips: ipfs_json.properties.tips,
    },
  };
}

async function get_nft_metadata(
  ipfs_cid: string
): Promise<NFTMetadata | undefined> {
  let ipfs_url = `https://gateway.ipfs.io/ipfs/${ipfs_cid}#x-ipfs-companion-no-redirect`;
  let resp = await fetch(ipfs_url);
  try {
    return ipfs_to_metadata(await resp.json());
  } catch (e) {
    return undefined;
  }
}

// Function for batch processing of NFT ownership updates
export async function crawl_ownership_updates(nfts: NFT[], mintedNftsCursor: any, batch_size: number) {
  const batch = [];
  while (batch.length < batch_size && await mintedNftsCursor.hasNext()) {
    const minted_nft = await mintedNftsCursor.next() as unknown as MintedNFT;
    const nft = nfts.find(n => n.supply_hash === minted_nft.supply_hash);
    if (nft) {
      batch.push(crawl_nft(nft.minter_address, minted_nft));
    }
  }
  return Promise.all(batch);
}

async function with_retry(task, maxAttempts = 3, delay = 1000) {
  let attempts = 0;
  while (attempts < maxAttempts) {
    try {
      return await task();
    } catch (error) {
      current_rpc_index++;
      if (current_rpc_index === RPC_ENDPOINTS.length) {
        current_rpc_index = 0;
      }
      banano_node = new NanoNode(
        RPC_ENDPOINTS[current_rpc_index],
        fetch
      ); // Switch to the next RPC endpoint
      attempts++;
      log(`\x1b[0;31mAttempt ${attempts} failed: ${error.message}\x1b[0m`);
      if (attempts >= maxAttempts) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

//get (new) supply blocks (nfts) for a minter, get metadata, add to db
// Parallel fetching of NFT metadata for supply blocks
export async function crawl_supply_blocks(
  minter: Minter,
  head_hash?: string
) {
  log(`Crawling supply blocks for ${minter.address} ${ minter.name ? `(${minter.name})` : "" }`);

  const minter_address: Address = minter.address;

  let supply_crawler = new SupplyBlocksCrawler(minter_address, head_hash);
  let new_supply_blocks: INanoBlock[] = await with_retry(() =>
    supply_crawler.crawl(banano_node)
  );

  log(`Found ${new_supply_blocks.length} new supply blocks (${minter_address}${ minter.name ? " " + minter.name: "" })`);

  const metadataFetchPromises = new_supply_blocks.map((supply_block, i) => {
    let metadata_representative: Address = supply_crawler
      .metadataRepresentatives[i] as Address;
    return get_nft_metadata(
      bananoIpfs.accountToIpfsCidV0(metadata_representative)
    ).then((nft_metadata) => ({
      supply_block,
      nft_metadata,
      metadata_representative,
    }));
  });

  const supplyBlocksWithMetadata = await Promise.all(metadataFetchPromises);

  for (let {
    supply_block,
    nft_metadata,
    metadata_representative,
  } of supplyBlocksWithMetadata) {
    if (!nft_metadata) {
      log(`\x1b[0;31mERROR, COULD NOT FIND NFT METADATA for ${supply_block.hash}\x1b[0m`);
      nft_metadata = {
        name: "unknown",
        image: "unknown",
        description: "failed to get ipfs metadata",
        properties: {
          issuer: minter_address,
          supply_block_hash: supply_block.hash,
        },
      }
    }
    log(supply_block.hash, nft_metadata);
    let supply_info = parseSupplyRepresentative(supply_block.representative);
    let major_version: number = Number(supply_info.version.split(".")[0]);
    let minor_version: number = Number(supply_info.version.split(".")[1]);
    let patch_version: number = Number(supply_info.version.split(".")[2]);
    let nft: NFT = {
      minter_address,
      supply_hash: supply_block.hash,
      supply_block_height: Number(supply_block.height),
      metadata_representative,
      nft_metadata,
      version: {
        major_version,
        minor_version,
        patch_version,
      },
      max_supply: Number(supply_info.maxSupply),
      head_hash: supply_block.hash,
    };
    //add to db
    await add_nft(nft, true);
  }
  log(`New head for minter ${minter_address}: ${supply_crawler.head ? supply_crawler.head : "undefined probably because nothing new found"}`);
  if (supply_crawler.head) {
    await update_minter_head_hash(minter_address, supply_crawler.head);
  }
}

export async function crawl_supply_blocks_no_db(
  minter_address: Address,
  head_hash?: string
) {
  let supply_crawler = new SupplyBlocksCrawler(minter_address, head_hash);
  let new_supply_blocks: INanoBlock[] = await supply_crawler.crawl(banano_node);
  for (let i = 0; i < new_supply_blocks.length; i++) {
    let supply_block: INanoBlock = new_supply_blocks[i];
    let metadata_representative: Address = supply_crawler.metadataRepresentatives[i] as Address;
    let nft_metadata: NFTMetadata = await get_nft_metadata(
      bananoIpfs.accountToIpfsCidV0(metadata_representative)
    );
    let supply_info = parseSupplyRepresentative(supply_block.representative);
    let major_version: number = Number(supply_info.version.split(".")[0]);
    let minor_version: number = Number(supply_info.version.split(".")[1]);
    let patch_version: number = Number(supply_info.version.split(".")[2]);
    let nft: NFT = {
      minter_address,
      supply_hash: supply_block.hash,
      supply_block_height: Number(supply_block.height),
      metadata_representative: metadata_representative,
      nft_metadata,
      version: {
        major_version,
        minor_version,
        patch_version,
      },
      max_supply: Number(supply_info.maxSupply),
      head_hash: supply_block.hash,
    };
    log("Found NFT supply block", nft);
  }
}

// Parallel processing of new mint blocks with retry logic
export async function crawl_minted(nft: NFT) {
  let mint_crawler = new MintBlocksCrawler(nft.minter_address, nft.supply_hash);

  log(`Crawling mint blocks for NFT ${nft.nft_metadata.name} ${nft.supply_hash} (minted by ${nft.minter_address})`);

  // Wrapping crawl logic with retry
  await with_retry(async () => {
    if (nft.head_hash !== nft.supply_hash) {
      mint_crawler.initFromCache(
        BigInt(nft.supply_block_height),
        BigInt(await count_mint_blocks(nft.supply_hash)),
        `${nft.version.major_version}.${nft.version.minor_version}.${nft.version.patch_version}`,
        BigInt(nft.max_supply),
        nft.metadata_representative
      );
      await mint_crawler.crawlFromFrontier(banano_node, nft.head_hash);
      log("Crawling from frontier");
    } else {
      await mint_crawler.crawl(banano_node);
      log("Crawling from start");
    }
  });

  let new_mint_blocks: INanoBlock[] = mint_crawler.mintBlocks;
  log(`Finished crawling for new mint blocks, ${new_mint_blocks.length} found (${nft.supply_hash})`);

  const addMintedNFTPromises = new_mint_blocks.map((mint_block) => {
    log(`Mint block ${mint_block.hash} (for ${nft.supply_hash})`)
    let minted_nft: MintedNFT = {
      supply_hash: nft.supply_hash,
      mint_hash: mint_block.hash,
      owner: "unknown",
      locked: false,
      metadata_representative: mint_block.representative as Address,
      mint_type: mint_block.subtype as "send" | "change",
      asset_chain: [],
    };
    return add_minted_nft(minted_nft, true);
  });

  await Promise.all(addMintedNFTPromises);

  let new_head = mint_crawler.head;
  if (!new_head && new_mint_blocks.length > 0) {
    new_head = new_mint_blocks[new_mint_blocks.length - 1].hash;
  }
  log(`New head for supply ${nft.supply_hash}: ${new_head ? new_head : "undefined probably because nothing new found"}`);
  if (new_head) {
    await update_mint_blocks_head_hash(nft.supply_hash, new_head);
  }
}

//for a specific minted nft, update owner/status/etc if needed (or add to db if new)
export async function crawl_nft(
  minter_address: Address,
  minted_nft: MintedNFT
) {
  let mint_block_return = await getBlock(
    banano_node,
    minter_address,
    minted_nft.mint_hash
  );
  if (mint_block_return.status === "error") {
    log(
      `Error retrieving block: ${mint_block_return.error_type}: ${mint_block_return.message}`
    );
    return;
  }
  let old_asset_chain_length: number = minted_nft.asset_chain.length;
  let mint_block = mint_block_return.value;
  let asset_crawler = new AssetCrawler(minter_address, mint_block);
  asset_crawler.initFromCache(
    BananoUtil.getAccount(minted_nft.mint_hash, "ban_") as Address,
    minted_nft.asset_chain
  );
  await asset_crawler.crawl(banano_node);
  log(`Updated asset chain for minted NFT ${minted_nft.mint_hash}`);
  log(`Old asset chain length ${old_asset_chain_length}, new asset chain length ${asset_crawler.assetChain.length}`);
  minted_nft.asset_chain = asset_crawler.assetChain;
  minted_nft.owner = asset_crawler.frontier.owner as Address;
  minted_nft.locked = asset_crawler.frontier.locked;
  //prevent wasting bandwidth when there are no changes
  if (old_asset_chain_length === asset_crawler.assetChain.length) return;
  await add_minted_nft(minted_nft);
}
