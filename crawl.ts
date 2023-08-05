import { NanoNode } from 'nano-account-crawler/dist/nano-node';
import type { INanoBlock } from 'nano-account-crawler/dist/nano-interfaces';
import { SupplyBlocksCrawler } from 'banano-nft-crawler/dist/supply-blocks-crawler';
import { MintBlocksCrawler } from 'banano-nft-crawler/dist/mint-blocks-crawler';
import { AssetCrawler } from 'banano-nft-crawler/dist/asset-crawler';
import { parseSupplyRepresentative } from 'banano-nft-crawler/dist/block-parsers/supply';
import { bananoIpfs } from 'banano-nft-crawler/dist/lib/banano-ipfs';
import { BananoUtil } from '@bananocoin/bananojs';
import { add_nft, add_minted_nft, update_mint_blocks_count, update_mint_blocks_head_hash, update_minter_head_hash, Address, NFT, MintedNFT } from './database.js';

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
  for (let i=0; i < new_supply_blocks.length; i++) {
    let supply_block: INanoBlock = new_supply_blocks[i];
    let metadata_representative: Address = supply_crawler.metadataRepresentatives[i] as Address;
    let nft_metadata: NFTMetadata = await get_nft_metadata(bananoIpfs.accountToIpfsCidV0(metadata_representative));
    console.log("Found NFT supply block", supply_block.hash, nft_metadata);
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
      mint_blocks_count: 0,
    };
    //add to db
    await add_nft(nft, true);
  }
  console.log("New head", supply_crawler.head);
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
      mint_blocks_count: 0,
    };
    console.log("Found NFT supply block", nft);
  }
}

//crawl for **new** minted nfts
export async function crawl_minted(nft: NFT) {
  let mint_crawler = new MintBlocksCrawler(nft.minter_address, nft.supply_hash);
  if (nft.head_hash) {
    mint_crawler.initFromCache(BigInt(nft.supply_block_height), BigInt(nft.mint_blocks_count), `${nft.version.major_version}.${nft.version.minor_version}.${nft.version.patch_version}`, BigInt(nft.max_supply), nft.metadata_representative);
    await mint_crawler.crawlFromFrontier(banano_node, nft.head_hash);
    console.log("Crawling from frontier");
  } else {
    await mint_crawler.crawl(banano_node);
    console.log("Crawling from start");
  }
  let new_mint_blocks: INanoBlock[] = mint_crawler.mintBlocks;
  console.log(`Finished crawling for new mint blocks, ${new_mint_blocks.length} found`);
  for (let i=0; i < new_mint_blocks.length; i++) {
    let mint_block: INanoBlock = new_mint_blocks[i];
    console.log("Found new mint block", mint_block.hash, nft.supply_hash);
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
    await update_mint_blocks_count(nft.supply_hash);
  }
  console.log("New head", mint_crawler.head);
  await update_mint_blocks_head_hash(nft.supply_hash, mint_crawler.head);
}

export interface SpyglassBlock {
  amount: number,
  amountRaw: `${number}`,
  balance: `${number}`,
  blockAccount: Address,
  confirmed: boolean,
  contents: {
    account: Address,
    balance: `${number}`,
    link: string,
    linkAsAccount: string,
    previous: string,
    representative: Address,
    signature: string,
    type: string,
    work: string,
  },
  hash: string,
  height: number,
  sourceAccount: string,
  subtype: string,
  timestamp: number,
}

//for a specific minted nft, update owner/status/etc if needed (or add to db if new)
export async function crawl_nft(minter_address: Address, minted_nft: MintedNFT) {
  //mint_block needs to be INanoBlock
  let spyglass_block: SpyglassBlock = await (await fetch(`https://api.spyglass.pw/banano/v1/block/${minted_nft.mint_hash}`)).json() as SpyglassBlock;
  //but representative and hash are the only ones used, rest can be dummy
  let block: INanoBlock = {
    type: spyglass_block.contents.type as "state",
    subtype: spyglass_block.subtype as "send" | "receive" | "open" | "change" | "epoch",
    account: spyglass_block.contents.account,
    amount: spyglass_block.amountRaw,
    balance: spyglass_block.balance,
    representative: spyglass_block.contents.representative,
    previous: spyglass_block.contents.previous,
    hash: spyglass_block.hash,
    link: spyglass_block.contents.link,
    height: `${spyglass_block.height}`,
    work: spyglass_block.contents.work,
    signature: spyglass_block.contents.signature,
  };
  let asset_crawler = new AssetCrawler(minter_address, block);
  //asset_crawler.head = head_hash;
  asset_crawler.initFromCache(BananoUtil.getAccount(minted_nft.mint_hash, "ban_") as Address, minted_nft.asset_chain);
  await asset_crawler.crawl(banano_node);
  console.log(`Updated asset chain for minted NFT ${minted_nft.mint_hash}`);
  console.log(`Old asset chain length ${minted_nft.asset_chain.length}, new asset chain length ${asset_crawler.assetChain.length}`);
  minted_nft.asset_chain = asset_crawler.assetChain;
  minted_nft.owner = asset_crawler.frontier.owner as Address;
  minted_nft.locked = asset_crawler.frontier.locked;
  await add_minted_nft(minted_nft);
}
