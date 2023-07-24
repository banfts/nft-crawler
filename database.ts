import { connect } from './mongo.js';
import type { NFTMetadata } from './crawl.js';
import type { Collection } from 'mongodb';

export interface Minter {
  name?: string,
  description?: string,
  external_url?: string,
  address: string,
  supply_blocks: string[],
  head_hash: string,
}

export interface NFTVersion {
  major_version: number,
  minor_version: number,
  patch_version: number,
}

export interface NFT {
  minter_address: string,
  supply_hash: string,
  nft_metadata: NFTMetadata,
  //head hash of finding minting blocks for this nft
  head_hash: string,
  //stuff known from the supply block
  version: NFTVersion,
  max_supply: number, //max supply of 0 means infinite supply
  //
}

export interface MintedNFT {
  supply_hash: string,
  mint_hash: string,
  owner: string,
  status: string, //change to enum probably
  head_hash: string,
  //
}

let minters: Collection;
let info: Collection;
let ownership: Collection;

connect().then((db) => {
  //minters info (Minter interface)
  minters = db.collection("minters");
  //nft info (NFT interface)
  info = db.collection("info");
  //nft ownership info (MintedNFT interface)
  ownership = db.collection("ownership");
});

export async function get_all_minters() {
  return await (await minters.find({})).toArray();
}

export async function get_nft(supply_hash: string) {
  //insert or replace to `info` collection
  //
}

export async function add_nft(nft: NFT) {
  //insert or replace to `info` collection
  //
}

export async function get_minted_nft(mint_hash: string) {
  //insert or replace to `info` collection
  //
}

export async function add_minted_nft(nft: NFT) {
  //insert or replace to `ownership` collection
  //
}
