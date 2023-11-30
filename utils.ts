//translated from https://github.com/jetstream0/bananopie/blob/754a6d342aafb1d57a3d2e82f139a22ad5da4eaf/bananopie/util.py#L38 which is in turn translated from some public domain source?
function decode_base32(base32: string): Uint8Array {
  const alphabet = "13456789abcdefghijkmnopqrstuwxyz";
  // const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
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
  let hex_string = "";
  for (let i=0; i < uint8.length; i++) {
    let hex = uint8[i].toString(16);
    if (hex.length === 1) {
        hex = "0" + hex;
    }
    hex_string += hex;
  }
  return hex_string.toUpperCase();
}

export function asset_rep_to_mint_hash(asset_rep: string): string {
  asset_rep = asset_rep.replace("ban_", "");
  //log(asset_rep)
  return uint8_to_hex(decode_base32(asset_rep.slice(0, 52)));
}
