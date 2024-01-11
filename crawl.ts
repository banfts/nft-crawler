import { NanoNode } from 'nano-account-crawler/dist/nano-node';
import type { INanoBlock } from 'nano-account-crawler/dist/nano-interfaces';
import { SupplyBlocksCrawler } from 'banano-nft-crawler/dist/supply-blocks-crawler';
import { MintBlocksCrawler } from 'banano-nft-crawler/dist/mint-blocks-crawler';
import { AssetCrawler } from 'banano-nft-crawler/dist/asset-crawler';
import { parseSupplyRepresentative } from 'banano-nft-crawler/dist/block-parsers/supply';
import { bananoIpfs } from 'banano-nft-crawler/dist/lib/banano-ipfs';
import { getBlock } from 'banano-nft-crawler/dist/lib/get-block';
import { BananoUtil } from '@bananocoin/bananojs';
import { add_nft, add_minted_nft, update_mint_blocks_head_hash, update_minter_head_hash, count_mint_blocks, Address, NFT, MintedNFT } from './database.js';
import { log } from './log.js';

import fetch from 'node-fetch';

let banano_node = new NanoNode("https://booster.dev-ptera.com/banano-rpc", fetch);

export interface NFTTips {
  name: string,
  account: string,
}

export interface NFTProperties {
  issuer: string,
  supply_block_hash: string,
  tips?: NFTTips[],
}

export interface NFTMetadata {
  name: string,
  image: string,
  description: string,
  external_url?: string,
  animation_url?: string,
  properties: NFTProperties,
}

function ipfs_to_metadata(ipfs_json: any): NFTMetadata | undefined {
  //required
  if (typeof ipfs_json.name !== "string" || typeof ipfs_json.description !== "string" || typeof ipfs_json.description !== "string") return undefined;
  if (typeof ipfs_json.properties?.issuer !== "string" || typeof ipfs_json.properties?.supply_block_hash !== "string") return undefined;
  //optional
  if ((typeof ipfs_json.external_url !== "string" && typeof ipfs_json.external_url !== "undefined") || (typeof ipfs_json.animation_url !== "string" && typeof ipfs_json.animation_url !== "undefined")) return undefined;
  //tips
  if (ipfs_json.properties?.tips) {
    if (!ipfs_json.properties.tips.every(
      (tip) => typeof tip.name === "string" && typeof tip.account === "string"
    )) return undefined;
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

async function get_nft_metadata(ipfs_cid: string): Promise<NFTMetadata | undefined> {
  let ipfs_url = `https://gateway.ipfs.io/ipfs/${ipfs_cid}#x-ipfs-companion-no-redirect`;
  let resp = await fetch(ipfs_url);
  try {
    return ipfs_to_metadata(await resp.json());
  } catch (e) {
    return undefined;
  }
}

//get (new) supply blocks (nfts) for a minter, get metadata, add to db
export async function crawl_supply_blocks(minter_address: Address, head_hash?: string) {
  let supply_crawler = new SupplyBlocksCrawler(minter_address, head_hash);
  let new_supply_blocks: INanoBlock[] = await supply_crawler.crawl(banano_node);
  log(`Found ${new_supply_blocks.length} new supply blocks`);
  for (let i=0; i < new_supply_blocks.length; i++) {
    let supply_block: INanoBlock = new_supply_blocks[i];
    let metadata_representative: Address = supply_crawler.metadataRepresentatives[i] as Address;
    let nft_metadata: NFTMetadata = await get_nft_metadata(bananoIpfs.accountToIpfsCidV0(metadata_representative));
    log("Found NFT supply block", supply_block.hash, nft_metadata);
    if (!nft_metadata) {
      log("ERROR, COULD NOT FIND NFT METADATA");
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
    //add to db
    await add_nft(nft, true);
  }
  log("New head", supply_crawler.head ? supply_crawler.head : "undefined probably because nothing new found");
  await update_minter_head_hash(minter_address, supply_crawler.head);
}

export async function crawl_supply_blocks_no_db(minter_address: Address, head_hash?: string) {
  let supply_crawler = new SupplyBlocksCrawler(minter_address, head_hash);
  let new_supply_blocks: INanoBlock[] = await supply_crawler.crawl(banano_node);
  for (let i=0; i < new_supply_blocks.length; i++) {
    let supply_block: INanoBlock = new_supply_blocks[i];
    let metadata_representative: Address = supply_crawler.metadataRepresentatives[i] as Address;
    let nft_metadata: NFTMetadata = await get_nft_metadata(bananoIpfs.accountToIpfsCidV0(metadata_representative));
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

//crawl for **new** minted nfts
export async function crawl_minted(nft: NFT) {
  let mint_crawler = new MintBlocksCrawler(nft.minter_address, nft.supply_hash);
  if (nft.head_hash !== nft.supply_hash) {
    mint_crawler.initFromCache(BigInt(nft.supply_block_height), BigInt(await count_mint_blocks(nft.supply_hash)), `${nft.version.major_version}.${nft.version.minor_version}.${nft.version.patch_version}`, BigInt(nft.max_supply), nft.metadata_representative);
    await mint_crawler.crawlFromFrontier(banano_node, nft.head_hash);
    log("Crawling from frontier");
  } else {
    await mint_crawler.crawl(banano_node);
    log("Crawling from start");
  }
  let new_mint_blocks: INanoBlock[] = mint_crawler.mintBlocks;
  log(`Finished crawling for new mint blocks, ${new_mint_blocks.length} found`);
  for (let i=0; i < new_mint_blocks.length; i++) {
    let mint_block: INanoBlock = new_mint_blocks[i];
    log("Found new mint block", mint_block.hash, nft.supply_hash);
    let minted_nft: MintedNFT = {
      supply_hash: nft.supply_hash,
      mint_hash: mint_block.hash,
      owner: "unknown",
      locked: false,
      metadata_representative: mint_block.representative as Address,
      mint_type: mint_block.subtype as "send" | "change",
      asset_chain: [],
    };
    await add_minted_nft(minted_nft, true);
  }
  let new_head = mint_crawler.head;
  if (!new_head && new_mint_blocks.length > 0) {
    new_head = new_mint_blocks[new_mint_blocks.length - 1].hash;
  }
  log("New head", new_head ? new_head : "undefined probably because nothing new found");
  if (new_head) {
    await update_mint_blocks_head_hash(nft.supply_hash, new_head);
  }
}

//for a specific minted nft, update owner/status/etc if needed (or add to db if new)
export async function crawl_nft(minter_address: Address, minted_nft: MintedNFT) {
  let mint_block_return = await getBlock(banano_node, minter_address, minted_nft.mint_hash);
  if (mint_block_return.status === "error") {
    log(`Error retrieving block: ${mint_block_return.error_type}: ${mint_block_return.message}`);
    return;
  }
  let old_asset_chain_length: number = minted_nft.asset_chain.length;
  let mint_block = mint_block_return.value;
  let asset_crawler = new AssetCrawler(minter_address, mint_block);
  asset_crawler.initFromCache(BananoUtil.getAccount(minted_nft.mint_hash, "ban_") as Address, minted_nft.asset_chain);
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
