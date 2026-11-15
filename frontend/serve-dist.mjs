import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const appDir = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(appDir, 'dist');
const port = Number(process.env.PORT || 5173);
const types = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
};

const server = createServer(async (request, response) => {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  } catch {
    response.writeHead(400).end('Bad request');
    return;
  }

  let filePath = path.resolve(distDir, `.${pathname}`);
  const relativePath = path.relative(distDir, filePath);
  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    response.writeHead(403).end('Forbidden');
    return;
  }

  try {
    const fileInfo = await stat(filePath);
    if (fileInfo.isDirectory()) filePath = path.join(filePath, 'index.html');
    await stat(filePath);
  } catch {
    // Client-side routes use the app shell; unknown asset paths still return 404.
    if (path.extname(pathname)) {
      response.writeHead(404).end('Not found');
      return;
    }
    filePath = path.join(distDir, 'index.html');
  }

  response.writeHead(200, {
    'Content-Type': types[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
    'X-Content-Type-Options': 'nosniff',
  });
  createReadStream(filePath).pipe(response);
});

server.listen(port, '127.0.0.1', () => {
  console.log(`ACS.AEROTECH is running at http://127.0.0.1:${port}/`);
  console.log('Static preview mode: edits require a production rebuild.');
});
