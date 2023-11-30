export function log(...to_log) {
  if (process.env.CRAWLER_LOG) {
    console.log(...to_log);
  }
}

export function ws_log(...to_log) {
  if (!process.env.WS_DONT_LOG) {
    console.log(...to_log);
  }
}
