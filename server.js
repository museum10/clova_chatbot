const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

loadEnv(path.join(__dirname, '.env'));

const PORT = Number(process.env.PORT || 3000);
const CLOVA_API_URL = process.env.https://6w62cndbwa.apigw.ntruss.com/custom/v1/18682/a1749236fb24ba879695b7821e99f648b89d4d5f78396e45d7095b49de90e0c6;
const CLOVA_SECRET_KEY = process.env.T0RaVmxGV0hFSkhnbWhUUXBZakRZdXdKWWNmS0hXdXo=;

if (!CLOVA_API_URL || !CLOVA_SECRET_KEY) {
  console.error('Missing CLOVA_API_URL or CLOVA_SECRET_KEY. Set them in .env');
  process.exit(1);
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html')) {
      return serveFile(res, path.join(__dirname, 'public', 'index.html'), 'text/html; charset=utf-8');
    }

    if (req.method === 'POST' && req.url === '/api/chat') {
      const payload = await readJson(req);
      const userId = String(payload.userId || '').slice(0, 256) || `web-${Date.now()}`;
      const event = payload.event === 'open' ? 'open' : 'send';

      const requestBody = buildClovaBody({ userId, event, text: payload.text });
      const requestBodyString = JSON.stringify(requestBody);
      const signature = makeSignature(CLOVA_SECRET_KEY, Buffer.from(requestBodyString, 'utf-8'));

      const clovaRes = await fetch(CLOVA_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json;UTF-8',
          'X-NCP-CHATBOT_SIGNATURE': signature
        },
        body: requestBodyString
      });

      const raw = await clovaRes.text();
      let data;
      try {
        data = JSON.parse(raw);
      } catch {
        data = { message: raw };
      }

      if (!clovaRes.ok) {
        return writeJson(res, clovaRes.status, {
          error: 'CLOVA API request failed',
          detail: data
        });
      }

      const answers = extractAnswers(data);
      return writeJson(res, 200, { answers, raw: data });
    }

    writeJson(res, 404, { error: 'Not found' });
  } catch (err) {
    writeJson(res, 500, { error: 'Server error', detail: String(err.message || err) });
  }
});

server.listen(PORT, () => {
  console.log(`Server started: http://localhost:${PORT}`);
});

function buildClovaBody({ userId, event, text }) {
  const base = {
    version: 'v2',
    userId,
    timestamp: Date.now(),
    event,
    bubbles: []
  };

  if (event === 'open') {
    base.bubbles = [{
      type: 'text',
      data: { description: 'welcome' }
    }];
    return base;
  }

  base.bubbles = [{
    type: 'text',
    data: { description: String(text || '') }
  }];

  return base;
}

function makeSignature(secretKey, requestBodyBuffer) {
  return crypto
    .createHmac('sha256', Buffer.from(secretKey, 'utf-8'))
    .update(requestBodyBuffer)
    .digest('base64');
}

function extractAnswers(clovaResponse) {
  const bubbles = Array.isArray(clovaResponse?.bubbles) ? clovaResponse.bubbles : [];
  const answers = [];

  for (const bubble of bubbles) {
    const type = bubble?.type;
    const data = bubble?.data || {};

    if (type === 'text' && typeof data.description === 'string' && data.description.trim()) {
      answers.push(data.description.trim());
      continue;
    }

    if (type === 'template' && Array.isArray(data.cover?.data?.description)) {
      answers.push(data.cover.data.description.join('\n').trim());
      continue;
    }

    if (typeof data.description === 'string' && data.description.trim()) {
      answers.push(data.description.trim());
    }
  }

  return answers;
}

function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) return;
  const lines = fs.readFileSync(filePath, 'utf-8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx <= 0) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();
    if (!(key in process.env)) process.env[key] = value;
  }
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => {
      data += chunk;
      if (data.length > 1_000_000) {
        reject(new Error('Payload too large'));
        req.destroy();
      }
    });
    req.on('end', () => {
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

function writeJson(res, statusCode, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS'
  });
  res.end(body);
}

function serveFile(res, filePath, contentType) {
  const content = fs.readFileSync(filePath);
  res.writeHead(200, {
    'Content-Type': contentType,
    'Content-Length': content.length
  });
  res.end(content);
}
