export function log(...to_log) {
  if (!process.env.CRAWLER_NO_LOG) {
    console.log(...to_log);
  }
}
