import { IAssetBlock } from 'banano-nft-crawler/dist/interfaces/asset-block';
import type { Collection } from 'mongodb';
import { connect } from './mongo.js';
import type { NFTMetadata } from './crawl.js';
import minters_array from './minters.json';
import { asset_rep_to_mint_hash } from './utils.js';
import { log } from './log.js';

export type Address = `ban_${string}`;

export interface Minter {
  name?: string,
  description?: string,
  external_url?: string,
  address: Address,
  head_hash?: string,
}

export interface NFTVersion {
  major_version: number,
  minor_version: number,
  patch_version: number,
}

export interface NFT {
  minter_address: Address,
  supply_hash: string,
  supply_block_height: number,
  //metadata
  metadata_representative: Address,
  nft_metadata: NFTMetadata,
  //head hash of finding minting blocks for this nft
  head_hash: string,
  //stuff known from the supply block
  version: NFTVersion,
  max_supply: number, //max supply of 0 means infinite supply
  mint_blocks_count: number, //amount of mint blocks
}

export interface MintedNFT {
  supply_hash: string,
  mint_hash: string, //aka asset representative
  owner: Address | "unknown",
  locked: boolean,
  //head_hash: string,
  metadata_representative: Address, //keep in two places for convenience
  mint_type: "change" | "send",
  asset_chain: IAssetBlock[], //history of the asset
  //
}

let minters: Collection;
let info: Collection;
let ownership: Collection;

connect().then((db) => {
  log("Connected to database");
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
    log(`Adding minter ${minter.address} ${minter.name ? `(${minter.name})` : ""}`);
    let found = current_minters.find((m) => m.address === minter.address);
    if (found) {
      minter.head_hash = found.head_hash; //preserve head hash!!!
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

async function get_minter(minter_address: string): Promise<Minter> {
  return await minters.findOne({
    address: minter_address,
  }, {
    projection: {
      //exclude _id
      _id: 0,
    },
  }) as unknown as Minter;
}

//yeah I know there's a better way to do this with like $set or something
export async function update_minter_head_hash(minter_address: Address, head_hash: string) {
  let minter: Minter = await get_minter(minter_address);
  minter.head_hash = head_hash ? head_hash : minter.head_hash;
  await minters.replaceOne({
    address: minter_address,
  }, minter);
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
  if (skip_find) {
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

export async function update_mint_blocks_count(supply_hash: string,) {
  let nft: NFT = await get_nft(supply_hash);
  let mint_blocks_count: number = (await (await ownership.find({
    supply_hash,
  })).toArray()).length;
  nft.mint_blocks_count = mint_blocks_count;
  await info.replaceOne({
    supply_hash,
  }, nft);
}

export async function update_mint_blocks_head_hash(supply_hash: string, head_hash: string) {
  let nft: NFT = await get_nft(supply_hash);
  nft.head_hash = head_hash ? head_hash : nft.head_hash;
  await info.replaceOne({
    supply_hash,
  }, nft);
}

export async function get_all_minted_nfts(): Promise<MintedNFT[]> {
  return (await (await ownership.find({})).toArray()) as unknown as MintedNFT[];
}

export async function get_all_minted_nfts_cursor(): Promise<any> {
  return await ownership.find({});
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

export async function find_minted_by_asset_rep(asset_rep: Address): Promise<MintedNFT> {
  const mint_hash = asset_rep_to_mint_hash(asset_rep);
  const found = await ownership.findOne({
    mint_hash,
  }, {
    projection: {
      //exclude _id
      _id: 0,
    },
  }) as unknown as MintedNFT;
  return found;
}

export async function add_minted_nft(minted_nft: MintedNFT, skip_find?: boolean) {
  //insert or replace to `ownership` collection
  if (skip_find) {
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
