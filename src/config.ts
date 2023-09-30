export const PORT: number = parseInt(process.env.PORT, 10) || 3000;
export const HOST: string = process.env.HOST || '0.0.0.0';
export const NODE_ENV: string = process.env.NODE_ENV || 'development';

export const DEBUG: boolean = process.env.NODE_ENV === 'development';

export const API_KEY: string = process.env.API_KEY;
export const DATABASE_URI: string = process.env.MONGODB_URI;

/* Currently available alterative public nodes
 * - https://booster.dev-ptera.com/banano-rpc // No rate limit enforced (Don't abuse obviously)
 * - https://public.node.jungletv.live/rpc // 1K Requests per hour. Probably unenforced
 */

export const BANANO_NODE_API_URL: string = process.env.NANO_NODE_API || 'https://booster.dev-ptera.com/banano-rpc';
export const BANANO_NODE_WS_URL: string = process.env.NANO_NODE_WS || 'wss://ws.banano.cc/';

export const QUEUE_TIMEOUT: number = parseInt(process.env.AUTH_TIMEOUT || '60000', 10);
export const QUEUE_CHECK_INTERVAL: number = parseInt(process.env.AUTH_CHECK_INTERVAL || '10000', 10);

export const RATE_LIMIT_MAX_RPM: number = parseInt(process.env.RATE_LIMIT_MAX_RPM || '10', 10);

if (!DATABASE_URI) {
  throw new Error('Environment variable "MONGODB_URI" is undefined');
}

if (!API_KEY) {
  throw new Error('Environment variable "API_KEY" is undefined');
}

