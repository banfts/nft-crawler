import { createServer } from 'http';

const PORT: number = 8080;

export function start() {
  console.log(`web server on port ${PORT}`);
  createServer((_req, res) => {
    res.write("yo I'm alive");
    res.end();
  }).listen(PORT);
}
