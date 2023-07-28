import { NanoNode } from 'nano-account-crawler/dist/nano-node';
import { INanoBlock } from "nano-account-crawler/dist/nano-interfaces";
import { SupplyBlocksCrawler } from 'banano-nft-crawler/dist/supply-blocks-crawler';
import { MintBlocksCrawler } from 'banano-nft-crawler/dist/mint-blocks-crawler';
import { AssetCrawler } from 'banano-nft-crawler/dist/asset-crawler';
import { add_nft, add_minted_nft, NFT, MintedNFT } from './database.js';

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
      (tip) => {
        typeof tip.name === "string" && typeof tip.account === "string"
      }
    )) return undefined;
  }
  return {
    name: ipfs_json.name,
    image: ipfs_json.image,
    description: ipfs_json.description,
    external_url: ipfs_json.external_url,
    animation_url: ipfs_json.animation_url,
    properties: {
      issuer: ipfs_json.issuer,
      supply_block_hash: ipfs_json.supply_block_hash,
      tips: ipfs_json.tips,
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
export async function crawl_supply_blocks(minter_address: `ban_${string}`, head_hash?: string) {
  let supply_crawler = new SupplyBlocksCrawler(minter_address, head_hash);
  let new_supply_blocks: INanoBlock[] = await supply_crawler.crawl(banano_node);
  for (let i=0; i < new_supply_blocks.length; i++) {
    //
    //get_nft_metadata
    //
  }
}

//crawl for **new** minted nfts, then `crawl_nft` for them
export async function crawl_minted(minter_address: `ban_${string}`, supply_hash: string, head_hash?: string) {
  let mint_crawler = new MintBlocksCrawler(minter_address, supply_hash);
  if (head_hash) {
    await mint_crawler.crawlFromFrontier(banano_node, head_hash);
  } else {
    await mint_crawler.crawl(banano_node);
  }
  let new_mint_blocks: INanoBlock[] = mint_crawler.mintBlocks;
  for (let i=0; i < new_mint_blocks.length; i++) {
    //
  }
}

//for a specific minted nft, update owner/status/etc if needed (or add to db if new)
export async function crawl_nft(minter_address: `ban_${string}`, mint_block: string, head_hash?: string) {
  //mint_block needs to be INanoBlock
  //let asset_crawler = new AssetCrawler(minter_address, mint_block);
  //
}
