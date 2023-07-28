import type { Collection } from 'mongodb';
import { connect } from './mongo.js';
import type { NFTMetadata } from './crawl.js';
import minters_array from './minters.json';

export interface Minter {
  name?: string,
  description?: string,
  external_url?: string,
  address: `ban_${string}`,
  head_hash: string,
}

export interface NFTVersion {
  major_version: number,
  minor_version: number,
  patch_version: number,
}

export interface NFT {
  minter_address: `ban_${string}`,
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
  owner: `ban_${string}` | "unknown",
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

export async function get_all_minters(): Promise<Minter[]> {
  return (await (await minters.find({})).toArray()) as unknown as Minter[];
}

export async function add_minters() {
  let current_minters: Minter[] = await get_all_minters(); //Minter[], almost
  for (let i=0; i < minters_array.length; i++) {
    let minter: Minter = minters_array[i] as Minter;
    let found = current_minters.find((m) => m.address === minter.address);
    if (found) {
      await minters.replaceOne({
        address: minter.address,
      }, minter);
      current_minters = current_minters.filter((m) => m.address !== minter.address);
    } else {
      await minters.insertOne(minter);
    }
  }
  //remove remaining minters
  for (let i=0; i < current_minters.length; i++) {
    await minters.deleteOne({
      address: current_minters[i].address,
    });
  }
}

export async function get_all_nfts(): Promise<NFT[]> {
  return (await (await info.find({})).toArray()) as unknown as NFT[];
}

export async function get_nft(supply_hash: string): Promise<NFT> {
  return await info.findOne({
    supply_hash,
  }, {
    projection: {
      //exclude _id
      _id: 0,
    },
  }) as unknown as NFT;
}

export async function add_nft(nft: NFT, skip_find?: boolean) {
  //insert or replace to `info` collection
  if (!skip_find) {
    //just insert
    await info.insertOne(nft);
    return;
  }
  //true if already exists, false otherwise
  let replace = await get_nft(nft.supply_hash);
  if (replace) {
    await info.replaceOne({
      supply_hash: nft.supply_hash,
    }, nft);
  } else {
    await info.insertOne(nft);
  }
}

export async function get_all_minted_nfts(): Promise<MintedNFT[]> {
  return (await (await ownership.find({})).toArray()) as unknown as MintedNFT[];
}

export async function get_minted_nft(mint_hash: string): Promise<MintedNFT> {
  return await ownership.findOne({
    mint_hash,
  }, {
    projection: {
      //exclude _id
      _id: 0,
    },
  }) as unknown as MintedNFT;
}

export async function add_minted_nft(minted_nft: MintedNFT, skip_find?: boolean) {
  //insert or replace to `ownership` collection
  if (!skip_find) {
    //just insert
    await ownership.insertOne(minted_nft);
    return;
  }
  //true if already exists, false otherwise
  let replace = await get_minted_nft(minted_nft.mint_hash);
  if (replace) {
    await ownership.replaceOne({
      mint_hash: minted_nft.mint_hash,
    }, minted_nft);
  } else {
    await ownership.insertOne(minted_nft);
  }
}
