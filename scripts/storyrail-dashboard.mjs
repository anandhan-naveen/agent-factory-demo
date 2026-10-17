#!/usr/bin/env node
// Serves the StoryRail dashboard locally: http://localhost:4800
// The page polls /status.json, which agents update through scripts/storyrail-status.mjs.
// Usage: node scripts/storyrail-dashboard.mjs [port]

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.argv[2] ?? process.env.STORYRAIL_PORT ?? 4800);

const routes = {
  '/': { file: join(ROOT, 'storyrail-dashboard', 'index.html'), type: 'text/html; charset=utf-8' },
  '/status.json': { file: join(ROOT, '.storyrail', 'status.json'), type: 'application/json', empty: '{}' },
};

const server = createServer(async (req, res) => {
  const path = new URL(req.url ?? '/', 'http://localhost').pathname;
  const route = routes[path];
  if (!route) {
    res.writeHead(404, { 'content-type': 'text/plain' }).end('Not found');
    return;
  }
  try {
    const body = await readFile(route.file);
    res.writeHead(200, { 'content-type': route.type, 'cache-control': 'no-store' }).end(body);
  } catch {
    if (route.empty !== undefined) {
      res.writeHead(200, { 'content-type': route.type, 'cache-control': 'no-store' }).end(route.empty);
    } else {
      res.writeHead(500, { 'content-type': 'text/plain' }).end('Dashboard file missing');
    }
  }
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.log(`StoryRail dashboard already running on http://localhost:${PORT}`);
    process.exit(0);
  }
  throw err;
});

// Bind to localhost only: the dashboard is for this machine.
server.listen(PORT, '127.0.0.1', () => {
  console.log(`StoryRail dashboard: http://localhost:${PORT}`);
});
