import { WebSocket } from 'ws';
//import ReconnectingWebSocket from 'reconnecting-websocket/dist/reconnecting-websocket.mjs';
import ReconnectingWebSocket from 'reconnecting-websocket'; // HBB: Dunno why it doesnt work

import { crawl_nft } from './crawl.js';
import { get_all_nfts, find_minted_by_asset_rep } from './database.js';
import { ws_log } from './log.js';

/* 
 - wss://kaliumapi.appditto.com (doest seem to work)
 - wss://ws.banano.trade (works)
 - wss://ws.banano.cc (works) (why not this one(?))
*/
const NODE_WEBSOCKET_URL = "wss://ws.banano.trade"; //please don't change this url
const KNOWN_REPS_SPYGLASS_URL = "https://api.spyglass.pw/banano/v1/representatives/online";

export async function websocket_listen() {
  // Create a reconnecting WebSocket
  const ws = new ReconnectingWebSocket(NODE_WEBSOCKET_URL, [], {
    WebSocket: WebSocket,
    connectionTimeout: 1000,
    maxRetries: 100000,
    maxReconnectionDelay: 2000,
    minReconnectionDelay: 10, // if not set, initial connection will take a few seconds by default
  });

  ws_log("a")
  
  // initialize before calling the db not vice versa
  const nfts = await get_all_nfts();

  let known_representatives: string[] = await (await fetch(KNOWN_REPS_SPYGLASS_URL)).json();

  // Reps that are offline but are not asset reps
  let non_asset_representatives: string[] = [];
  
  // As soon as we connect, subscribe to block confirmations
  ws.onopen = async () => {
    ws_log("WS opened");
  
    // Subscribe to all
    const confirmation_subscription = {
  		"action": "subscribe", 
  		"topic": "confirmation",
      "ack": true,
  	};
    
    /* Use if required
    const confirmation_subscription_options = {
      "options": {
        "accounts": [
          "ban_3o48j8c4guyuquicsmygr1ueaihitrf8xnhygyxkkhtntpeq9y8iprty13ob"
        ],
      }
    }

    const confirmation_subscription_with_options = {
      ...confirmation_subscription,
      ...confirmation_subscription_options
    } */
    
  	ws.send(JSON.stringify(confirmation_subscription));
  
    // Other subscriptions can go here
  };
  
  // The node sent us a message
  ws.onmessage = async (message) => {
    const data = JSON.parse(message.data);
    
    if (data.ack === 'subscribe') {
      ws_log("User subscribed successfully");
    }
  
    if (data.topic === "confirmation") {
      //ws_log("Transaction Confirmed: Hash ", data.message.hash)
  
      const { block } = data.message;
      const { representative, subtype } = block;
      if (subtype === "send") {
        if (!known_representatives.includes(representative) && !non_asset_representatives.includes(representative)) {
          //ws_log("Send, and possibly asset representative.");
          // Check if representative is an asset/mint representative
          //ws_log("rep", representative);
          let minted_nft = await find_minted_by_asset_rep(representative);
          if (!minted_nft) {
            non_asset_representatives.push(representative);
            return;
          }
          //ws_log("Is asset rep");
          if (minted_nft.owner !== block.block_account) {
            //Not owner
            return; 
          }
          // Order a recrawl
          //ws_log("Ordering recrawl", minted_nft.mint_hash);
          ws_log(`Ordering recrawl ${minted_nft.mint_hash}`);
          const nft = nfts.find((nft) => nft.supply_hash === minted_nft.supply_hash);
          await crawl_nft(nft.minter_address, minted_nft);
        }
      }
    }
  }
}
