/**
 * Local dev: serves static files from public/ + /api/submissions (loads .env.local).
 * Usage: npm run dev → http://localhost:3000
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const submissionsHandler = require(path.join(__dirname, '..', 'api', 'submissions.js'));
const staticRoot = path.join(__dirname, '..', 'public');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.mp3': 'audio/mpeg',
  '.json': 'application/json; charset=utf-8',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function serveStatic(filePath, res) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      return res.end('Not found');
    }
    const ext = path.extname(filePath);
    res.setHeader('Content-Type', MIME[ext] || 'application/octet-stream');
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  const host = req.headers.host || '127.0.0.1';
  let url;
  try {
    url = new URL(req.url || '/', `http://${host}`);
  } catch {
    res.statusCode = 400;
    return res.end('Bad request');
  }

  if (url.pathname === '/api/submissions') {
    let body;
    try {
      const buf = await readBody(req);
      body = buf.length ? JSON.parse(buf.toString('utf8')) : {};
    } catch {
      body = null;
    }
    const mockReq = {
      method: req.method,
      headers: req.headers,
      body,
    };
    try {
      await submissionsHandler(mockReq, res);
    } catch (e) {
      console.error(e);
      if (!res.writableEnded) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ error: 'Server error' }));
      }
    }
    return;
  }

  let rel = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
  rel = path.normalize(rel).replace(/^(\.\.(\/|\\|$))+/, '');
  const filePath = path.join(staticRoot, rel);
  const resolvedFile = path.resolve(filePath);
  const resolvedStatic = path.resolve(staticRoot);

  if (
    resolvedFile !== resolvedStatic &&
    !resolvedFile.startsWith(resolvedStatic + path.sep)
  ) {
    res.statusCode = 403;
    return res.end('Forbidden');
  }

  serveStatic(filePath, res);
});

const PREFERRED = Number(process.env.PORT) || 3000;
const MAX_TRIES = 25;

function listenOnPort(port) {
  return new Promise((resolve, reject) => {
    const onErr = (err) => {
      server.removeListener('error', onErr);
      reject(err);
    };
    server.once('error', onErr);
    server.listen(port, () => {
      server.removeListener('error', onErr);
      resolve(port);
    });
  });
}

(async function start() {
  for (let p = PREFERRED; p < PREFERRED + MAX_TRIES; p++) {
    try {
      await listenOnPort(p);
      if (p !== PREFERRED) {
        console.warn(`Port ${PREFERRED} was busy — using ${p} instead.`);
      }
      console.log(`Open http://localhost:${p}`);
      console.log('Serving static from public/. Env: .env.local (DATABASE_URL for API).');
      return;
    } catch (err) {
      if (err.code !== 'EADDRINUSE') {
        console.error(err);
        process.exit(1);
      }
    }
  }
  console.error(
    `No free port between ${PREFERRED} and ${PREFERRED + MAX_TRIES - 1}. Close the other app or set PORT, e.g. PORT=3010 npm run dev`
  );
  process.exit(1);
})();
