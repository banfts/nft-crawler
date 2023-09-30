import { createServer } from 'http';

import { PORT, HOST, API_KEY, RATE_LIMIT_MAX_RPM } from './config.js'
import { ONE_MINUTE_MS, HTTP_MESSAGES, BASE_HEADERS } from './constants.js'

import { logger } from './logger.js'

const run_timestamp = Date.now()
const requestCount = new Map();

function rateLimitMiddleware(req, res, next) {
  const clientIP = req.socket.remoteAddress;
  const currentTimestamp = Date.now();

  if (!requestCount.has(clientIP)) {
    requestCount.set(clientIP, {
      ip: clientIP,
      count: 0,
      firstTimestamp: currentTimestamp,
      timestamp: currentTimestamp
    });
  }

  const clientData = requestCount.get(clientIP);
  const clientCount = clientData.count;
  const clientFirstTimestamp = clientData.firstTimestamp;
  console.log(clientData)
  // Check if client has exceeded the rate limit
  if (clientCount >= RATE_LIMIT_MAX_RPM && currentTimestamp - clientFirstTimestamp <= ONE_MINUTE_MS) {
    res.writeHead(429, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: '429 Too Many Requests',
      message: 'The client has sent too many request in under a minute'
    }));
    return;
  }

  // Reset request count after 1 minute
  if (currentTimestamp - clientFirstTimestamp > ONE_MINUTE_MS) {
    requestCount.delete(clientIP);
  }

  // Update request count for the client
  requestCount.set(clientIP, {
    ...clientData,
    count: clientCount + 1,
    timestamp: currentTimestamp
  });

  next();
}



/*
function formatJson(obj, indentation = 2): string {
  
}*/

function auth_middleware(req, res, next) {
  // Check for API key in the request headers
  const apiKey = req.headers['api-key']

  // Validate the API key
  if (apiKey !== API_KEY) {
    res.writeHead(401, BASE_HEADERS);
    res.end(JSON.stringify(HTTP_MESSAGES.STATUS_401, null, 2));
    return;
  }
  
  next()
}
  
function router(req, res, next) {
  const { url, method, headers } = req;
  if (method === 'GET' && url === '/') {
    const message = `Running since ${new Date(run_timestamp).toUTCString()}`

    res.writeHead(200, BASE_HEADERS);
    res.end(JSON.stringify({ ...HTTP_MESSAGES.STATUS_200, message }, null, 2));
  } else if (method === 'GET' && url === '/ping') {
    const message = 'pong'
      
    res.writeHead(200, BASE_HEADERS);
    res.end(JSON.stringify({ ...HTTP_MESSAGES.STATUS_200, message }, null, 2));
  } else if (method !== 'GET') {
    res.writeHead(405, BASE_HEADERS);
    res.end(JSON.stringify(HTTP_MESSAGES.STATUS_405, null, 2));
  } else {
    res.writeHead(404, BASE_HEADERS);
    res.end(JSON.stringify(HTTP_MESSAGES.STATUS_404, null, 2));
  }
  next()
}

function api(req, res) {
  // Apply rate limiting middleware
  rateLimitMiddleware(req, res, router);
}

export const server = createServer(api);

export function run_server() {
  // Error handling middleware
  server.on('error', (error: Error) => {
    logger.error(error);
  });

  // Enable server to listen on IPv4 and IPv6 addresses
  server.listen(PORT, HOST, () => {
    logger.debug(`Crawlers are crawling on http://${HOST}:${PORT}`);
  });
}
