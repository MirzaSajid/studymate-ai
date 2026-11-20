'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { SYSTEM_PROMPT, validateInput, buildPrompt, parseModelJson, isValidResult } = require('./lib/study');

// Minimal .env loader (no dependencies). Real environment variables take precedence.
try {
  for (const line of fs.readFileSync(path.join(__dirname, '.env'), 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !line.trim().startsWith('#') && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
} catch { /* .env is optional */ }

const PORT = Number(process.env.PORT) || 3000;
const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const API_BASE = process.env.GEMINI_API_BASE || 'https://generativelanguage.googleapis.com/v1beta';
const PUBLIC_DIR = path.join(__dirname, 'public');
const MAX_BODY_BYTES = 32 * 1024;
const RATE_LIMIT = 20; // requests per minute per IP
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml' };
const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Content-Security-Policy': "default-src 'self'; style-src 'self'; script-src 'self'; connect-src 'self'",
};

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

const hits = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < 60_000);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > RATE_LIMIT;
}

function send(res, status, body, type = 'application/json; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': type, ...SECURITY_HEADERS });
  if (Buffer.isBuffer(body)) res.end(body);
  else res.end(typeof body === 'string' ? body : JSON.stringify(body));
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY_BYTES) { reject(new HttpError(413, 'Request body too large.')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
      catch { reject(new HttpError(400, 'Invalid JSON body.')); }
    });
    req.on('error', () => reject(new HttpError(400, 'Could not read request.')));
  });
}

async function callGemini(prompt) {
  const key = process.env.GEMINI_API_KEY;
  if (!key || key === 'your_api_key_here') throw new HttpError(500, 'Server is missing GEMINI_API_KEY. See README setup.');
  let res;
  try {
    res = await fetch(`${API_BASE}/models/${encodeURIComponent(MODEL)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.4, responseMimeType: 'application/json' },
      }),
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    throw new HttpError(504, 'The AI service did not respond in time. Please try again.');
  }
  if (!res.ok) throw new HttpError(502, `AI service returned an error (${res.status}). Check your API key, model name and quota.`);
  const data = await res.json();
  return (data?.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('');
}

async function handleStudy(req, res) {
  if (rateLimited(req.socket.remoteAddress || 'unknown')) throw new HttpError(429, 'Too many requests. Please wait a minute.');
  const input = validateInput(await readJson(req));
  if (!input.ok) throw new HttpError(400, input.error);
  let result;
  try { result = parseModelJson(await callGemini(buildPrompt(input.mode, input.text))); }
  catch (err) {
    if (err instanceof HttpError) throw err;
    throw new HttpError(502, 'The AI returned an unreadable answer. Please try again.');
  }
  if (!isValidResult(input.mode, result)) throw new HttpError(502, 'The AI returned an incomplete answer. Please try again.');
  send(res, 200, { mode: input.mode, result });
}

function serveStatic(req, res) {
  const urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  const rel = urlPath === '/' ? 'index.html' : urlPath.slice(1);
  const file = path.normalize(path.join(PUBLIC_DIR, rel));
  if (!file.startsWith(PUBLIC_DIR + path.sep)) return send(res, 403, { error: 'Forbidden.' });
  fs.readFile(file, (err, buf) => {
    if (err) return send(res, 404, { error: 'Not found.' });
    send(res, 200, buf, MIME[path.extname(file)] || 'application/octet-stream');
  });
}

const server = http.createServer(async (req, res) => {
  try {
    const { pathname } = new URL(req.url, 'http://localhost');
    if (req.method === 'POST' && pathname === '/api/study') return await handleStudy(req, res);
    if (req.method === 'GET' && pathname === '/api/health') return send(res, 200, { status: 'ok', model: MODEL });
    if (req.method === 'GET') return serveStatic(req, res);
    send(res, 405, { error: 'Method not allowed.' });
  } catch (err) {
    if (err instanceof HttpError) return send(res, err.status, { error: err.message });
    console.error(err);
    send(res, 500, { error: 'Unexpected server error.' });
  }
});

if (require.main === module) {
  server.listen(PORT, () => console.log(`StudyMate AI running at http://localhost:${PORT} (model: ${MODEL})`));
}
module.exports = server;
