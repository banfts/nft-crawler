import { get_request } from './requests.js';

const MINTERS_API_URL: string = "https://cdn.jsdelivr.net/gh/banfts/minters@v1/";

export async function get_minters_from_api(query: string = "latest"): Promise<any | undefined> {
  if (!query || (query !== "latest" && query !== "blacklist")) {
    throw new TypeError('invalid query parameter');
  }

  try {
    const apiUrl: string = `${MINTERS_API_URL}${query}.json`;
    const response = await get_request(apiUrl);
    return response;
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
}

//translated from https://github.com/jetstream0/bananopie/blob/754a6d342aafb1d57a3d2e82f139a22ad5da4eaf/bananopie/util.py#L38 which is in turn translated from some public domain source?
function decode_base32(base32: string): Uint8Array {
  let alphabet = "13456789abcdefghijkmnopqrstuwxyz";
  let length = base32.length;
  let leftover = (length * 5) % 8;
  let offset = 0;
  if (leftover === 0) {
    offset = 0;
  } else {
    offset = 8 - leftover;
  }
  let bits = 0;
  let value = 0;
  let index = 0;
  let uint8 = new Uint8Array(Math.ceil(length * 5 / 8))
  for (let i=0; i < length; i++) {
    value = (value << 5) | alphabet.indexOf(base32[i]);
    bits += 5;
    if (bits >= 8) {
      uint8[index] = (value >> (bits + offset - 8)) & 255;
      index += 1;
      bits -= 8;
    }
  }
  if (bits > 0) {
    uint8[index] = (value << (bits + offset - 8)) & 255;
    index += 1;
  }
  if (leftover !== 0) {
    uint8 = uint8.slice(1);
  }
  return uint8;
}

function uint8_to_hex(uint8) {
  const hex_chars = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'A', 'B', 'C', 'D', 'E', 'F'];
  let hex = "";
  for (let i=0; i < uint8.length; i++) {
    hex += hex_chars[Math.floor(uint8[i]/16)];
    hex += hex_chars[uint8[i] % 16];
  }
  return hex;
}

export function asset_rep_to_mint_hash(asset_rep: string): string {
  asset_rep = asset_rep.replace("ban_", "");
  return uint8_to_hex(decode_base32(asset_rep.slice(0, 52)));
}
