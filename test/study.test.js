'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { validateInput, buildPrompt, parseModelJson, isValidResult } = require('../lib/study');

const NOTES = 'Photosynthesis converts light energy into chemical energy stored in glucose inside chloroplasts.';

test('validateInput accepts valid input and trims text', () => {
  const r = validateInput({ mode: 'quiz', text: `  ${NOTES}  ` });
  assert.equal(r.ok, true);
  assert.equal(r.text, NOTES);
});

test('validateInput rejects bad mode, short text, long text and non-objects', () => {
  assert.equal(validateInput({ mode: 'hack', text: NOTES }).ok, false);
  assert.equal(validateInput({ mode: 'toString', text: NOTES }).ok, false);
  assert.equal(validateInput({ mode: 'summary', text: 'short' }).ok, false);
  assert.equal(validateInput({ mode: 'summary', text: 'x'.repeat(8001) }).ok, false);
  assert.equal(validateInput({ mode: 'summary', text: 42 }).ok, false);
  assert.equal(validateInput(null).ok, false);
});

test('buildPrompt embeds the notes and requested shape', () => {
  const p = buildPrompt('flashcards', NOTES);
  assert.match(p, /cards/);
  assert.ok(p.includes(NOTES));
});

test('parseModelJson handles plain and fenced JSON and rejects garbage', () => {
  assert.deepEqual(parseModelJson('{"a":1}'), { a: 1 });
  assert.deepEqual(parseModelJson('```json\n{"a":1}\n```'), { a: 1 });
  assert.throws(() => parseModelJson('not json'));
  assert.throws(() => parseModelJson(undefined));
});

test('isValidResult enforces the shape for every mode', () => {
  assert.equal(isValidResult('summary', { title: 'T', summary: 'S', keyPoints: ['a'] }), true);
  assert.equal(isValidResult('summary', { title: 'T' }), false);
  const q = { question: 'Q?', options: ['a', 'b', 'c', 'd'], answerIndex: 2, explanation: 'E' };
  assert.equal(isValidResult('quiz', { questions: [q] }), true);
  assert.equal(isValidResult('quiz', { questions: [{ ...q, answerIndex: 9 }] }), false);
  assert.equal(isValidResult('flashcards', { cards: [{ front: 'a', back: 'b' }] }), true);
  assert.equal(isValidResult('flashcards', { cards: [] }), false);
  assert.equal(isValidResult('explain', { analogy: 'a', explanation: 'b', example: 'c' }), true);
  assert.equal(isValidResult('nope', {}), false);
});
