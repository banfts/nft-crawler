import { EventEmitter } from 'events';
import { debug } from './logger.js';
import { v4 as uuidv4 } from 'uuid';
import { createServer, RequestListener, IncomingMessage, ServerResponse } from 'http';
/*
interface Next {
    onSuccess: (result: any) => void;
    onError: (error: Error) => void;
}*/

//type Next = (request: Request | Error, response: ServerResponse, next: Next) => void;

interface Next {
    (request?: Request | Error, response?: ServerResponse, next?: Next, error?: Error): void;
}

type RequestTiming = {
  reqStart: number;
  reqEnd: number;
  toReqTime: number | string;
}

interface Request extends IncomingMessage {
  log: object;
  uuid: string;
  timing: RequestTiming;
}

interface Response extends ServerResponse {
  locals: object;
}
/*
interface Listener extends RequestListener {
  (request?: Request | Error, response?: ServerResponse, next?: Next, error?: Error): void;
}*/

const topLogPrefix = `nft-crawler: ${import.meta.url} -`

function hrtime_to_ms(hrtime: any = undefined): number {
  if (!hrtime) {
    hrtime = process.hrtime();
  }
  return (hrtime[0] * 1000) + (hrtime[1] / 1000000);
};

function create_api(options: any = {}) {
  const log = options.log || debug();
  const middlewares = options.middlewares || [];
  const routes = {
    GET: {},
    MIDDLEWARE: [],
  };

  const handleReq = (req: Request, res: Response): void => {
    const logPrefix = topLogPrefix + 'handleReq() - ';
    req.uuid = uuidv4();
    req.log = log;

    log.debug(logPrefix + 'req.uuid: ' + req.uuid + ' to url: ' + logUrl(req) + ' started');

    req.timing = {} as RequestTiming;
    req.timing.reqStart = hrtime_to_ms();
    runMiddleware(0, req, res);
  };

  const runMiddleware = (index: number, req: Request, res: Response) => {
    const logPrefix = topLogPrefix + 'runMiddleware() - ';

    if (middlewares[index]) {
      const middlewareStart = hrtime_to_ms();

      middlewares[index](req, res, (error: Error) => {
        const runTime = (hrtime_to_ms() - middlewareStart).toFixed(3);

        if (error) {
          log.debug(logPrefix + 'Error running middleware: ' + error.stack);
          emitter.emit('error', error, req, res);
        } else {
          req.timing['middleware_' + String(index).padStart(3, '0')] = {
            'runTime': runTime,
            'name': middlewares[index].name,
          };
          log.debug(logPrefix + 'req.uuid: ' + req.uuid + ' middleware_' + String(index).padStart(3, '0') + ' (' + middlewares[index].name + '): ' + runTime);
          runMiddleware(index + 1, req, res);
        }
      });
    } else {
      // Check if there's a route matching the HTTP method and URL
      const routeHandler = routes[req.method][req.url];

      if (routeHandler) {
        routeHandler(req, res);
      } else {
        req.timing.reqEnd = hrtime_to_ms();
        req.timing.toReqTime = (req.timing.reqEnd - req.timing.reqStart).toFixed(3);
        log.debug(logPrefix + 'req.uuid: ' + req.uuid + ' to url: ' + logUrl(req) + ' completed, run time: ' + req.timing.toReqTime + 'ms');
      }
    }
  };

  const start = (next: Next) => {
    const logPrefix = topLogPrefix + 'on:start - ';

    if (!Array.isArray(middlewares) || middlewares.length === 0 || Object.keys(routes.GET).length === 0) {
      const error = new Error('At least one middleware is required');
      log.error(logPrefix + error.message);
      return next(error);
    }

    const server = createServer((req: Request, res: Response): void => {
      handleReq(req, res);
    });

    server.on('listening', () => {
      log.debug(logPrefix + 'http server listening on port ' + server.address());
    });

    server.listen(options.httpOptions, next);
  };

  const logUrl = (req: Request) => {
    // Do not log password
    return !req || !req.url ? '' : req.url.replace(/password=[^&]*/ig, 'password=xxxxx');
  };

  const emitter = new EventEmitter();

  const api = {
    on: emitter.on.bind(emitter),
    start,
    logUrl,
    handleReq,
    get: (url: string, handler) => {
      const validRoutes = Object.keys(routes)
      console.log("Rts", validRoutes)
      if (validRoutes.includes(url))  {
        
    
        routes.GET[url] = handler;
      } else {
        routes.GET[url] = (req, res) => { return };
      }
    },
    use: (middleware: Next) => {
      middlewares.push(middleware);
      //routes.MIDDLEWARE.push(middleware);
    },
  };

  return api;
}

export default create_api;
