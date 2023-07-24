import { SupplyBlocksCrawler } from 'banano-nft-crawler/dist/supply-blocks-crawler';
import { MintBlocksCrawler } from 'banano-nft-crawler/dist/mint-blocks-crawler';
import { AssetCrawler } from 'banano-nft-crawler/dist/asset-crawler';

import fetch from 'node-fetch';

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
  description: string,
  image: string,
  external_url?: string,
  animation_url?: string,
  properties: NFTProperties,
}

export async function get_nft_metadata(ipfs_url: string) {
  //
}

//get (new) supply blocks (nfts) for a minter, get metadata, add to db
export async function crawl_supply_blocks(minter_address: string, head_hash?: string) {
  //
}

//for a specific minted nft, update owner/status/etc if needed (or add to db if new)
export async function crawl_nft(minter_address: string, mint_block: string) {
  //
}

//crawl for **new** minted nfts, then `crawl_nft` for them
export async function crawl_minted(minter_address: string, head_hash?: string) {
  //
}
