const http = require('node:http');
const path = require('node:path');
const fs = require('node:fs/promises');
const { createReadStream } = require('node:fs');
const { loadSave, writeSave } = require('./save');
const { generateContract } = require('./worldgen');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml'
};

async function readDataFile(fileName) {
  const p = path.join(PUBLIC_DIR, 'data', fileName);
  const raw = await fs.readFile(p, 'utf8');
  return JSON.parse(raw);
}

function sendJson(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

function collectBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1e6) {
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

async function buildBootstrap() {
  const [save, world, missionData, upgrades] = await Promise.all([
    loadSave(),
    readDataFile('world.json'),
    readDataFile('missions.json'),
    readDataFile('upgrades.json')
  ]);

  const now = Date.now();
  const contracts = world.aois.map((aoi, idx) =>
    generateContract({
      aoi,
      templates: missionData.templates,
      modifiers: missionData.modifiers,
      seed: now + aoi.x,
      sequence: idx + 1
    })
  );

  return { save, world, upgrades, contracts };
}

async function handleApi(req, res) {
  if (req.method === 'GET' && req.url === '/api/bootstrap') {
    try {
      sendJson(res, 200, await buildBootstrap());
    } catch (error) {
      sendJson(res, 500, { error: error.message });
    }
    return true;
  }

  if (req.method === 'GET' && req.url === '/api/load') {
    try {
      sendJson(res, 200, await loadSave());
    } catch (error) {
      sendJson(res, 500, { error: error.message });
    }
    return true;
  }

  if (req.method === 'POST' && req.url === '/api/save') {
    try {
      const raw = await collectBody(req);
      const payload = raw ? JSON.parse(raw) : {};
      const saved = await writeSave(payload);
      sendJson(res, 200, saved);
    } catch (error) {
      sendJson(res, 400, { error: `Invalid save payload: ${error.message}` });
    }
    return true;
  }

  return false;
}

async function serveStatic(req, res) {
  const reqPath = req.url.split('?')[0];
  const normalizedPath = path.normalize(reqPath === '/' ? '/index.html' : reqPath);
  const trimmedPath = normalizedPath.replace(/^([.][.][/\\])+/, '');
  const filePath = path.join(PUBLIC_DIR, trimmedPath);

  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  try {
    const ext = path.extname(filePath);
    const contentType = CONTENT_TYPES[ext] || 'application/octet-stream';
    await fs.access(filePath);
    res.writeHead(200, { 'Content-Type': contentType });
    createReadStream(filePath).pipe(res);
  } catch {
    res.writeHead(404);
    res.end('Not found');
  }
}

const server = http.createServer(async (req, res) => {
  if (await handleApi(req, res)) return;
  serveStatic(req, res);
});

server.listen(PORT, () => {
  console.log(`Deep Sea Mission running at http://localhost:${PORT}`);
});
