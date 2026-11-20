'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

// Mock Gemini so tests run offline and need no real key.
const mock = http.createServer((req, res) => {
  req.resume();
  req.on('end', () => {
    const payload = { title: 'Photosynthesis', summary: 'Plants make glucose from light.', keyPoints: ['Light', 'Glucose'] };
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(payload) }] } }] }));
  });
});

let app, base;
test.before(async () => {
  await new Promise((r) => mock.listen(0, r));
  process.env.GEMINI_API_BASE = `http://127.0.0.1:${mock.address().port}`;
  process.env.GEMINI_API_KEY = 'test-key';
  app = require('../server');
  await new Promise((r) => app.listen(0, r));
  base = `http://127.0.0.1:${app.address().port}`;
});
test.after(() => { app.close(); mock.close(); });

const post = (b) => fetch(`${base}/api/study`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) });
const NOTES = 'Photosynthesis converts light energy into chemical energy stored in glucose inside chloroplasts.';

test('GET /api/health returns ok', async () => {
  const r = await fetch(`${base}/api/health`);
  assert.equal(r.status, 200);
  assert.equal((await r.json()).status, 'ok');
});

test('serves the front end with security headers', async () => {
  const r = await fetch(`${base}/`);
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(r.headers.get('content-type'), 'text/html; charset=utf-8');
  assert.match(await r.text(), /<title>StudyMate AI<\/title>/);
});

test('blocks path traversal', async () => {
  const r = await fetch(`${base}/..%2fserver.js`);
  assert.notEqual(r.status, 200);
});

test('POST /api/study returns a validated result', async () => {
  const r = await post({ mode: 'summary', text: NOTES });
  assert.equal(r.status, 200);
  assert.equal((await r.json()).result.title, 'Photosynthesis');
});

test('rejects invalid input with 400', async () => {
  assert.equal((await post({ mode: 'summary', text: 'short' })).status, 400);
  assert.equal((await post({ mode: 'bad', text: NOTES })).status, 400);
});

test('rejects a model answer with the wrong shape for the mode (502)', async () => {
  assert.equal((await post({ mode: 'quiz', text: NOTES })).status, 502);
});
