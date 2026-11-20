'use strict';

const MAX_INPUT_CHARS = 8000;
const MIN_INPUT_CHARS = 40;

const SYSTEM_PROMPT =
  'You are StudyMate, an accurate and concise study tutor. Use only the notes the user provides. ' +
  'Never invent facts that are not supported by the notes. Respond with a single valid JSON object ' +
  'that matches the requested shape exactly, with no markdown and no extra commentary.';

const MODES = {
  summary: {
    task: 'Summarise the notes for quick revision.',
    shape: '{"title": string, "summary": string (max 80 words), "keyPoints": string[] (4 to 7 items)}',
  },
  quiz: {
    task: 'Write a 5-question multiple-choice quiz that tests understanding of the notes.',
    shape:
      '{"questions": [{"question": string, "options": string[] (exactly 4), "answerIndex": integer 0-3, "explanation": string}] (exactly 5 items)}',
  },
  flashcards: {
    task: 'Create 6 flashcards covering the most important concepts in the notes.',
    shape: '{"cards": [{"front": string, "back": string}] (exactly 6 items)}',
  },
  explain: {
    task: 'Explain the core idea of the notes to a complete beginner.',
    shape: '{"analogy": string, "explanation": string (max 120 words), "example": string}',
  },
};

function validateInput(body) {
  if (!body || typeof body !== 'object') return { ok: false, error: 'Request body must be a JSON object.' };
  const { mode, text } = body;
  if (typeof mode !== 'string' || !Object.hasOwn(MODES, mode)) {
    return { ok: false, error: `mode must be one of: ${Object.keys(MODES).join(', ')}.` };
  }
  if (typeof text !== 'string') return { ok: false, error: 'text must be a string.' };
  const clean = text.trim();
  if (clean.length < MIN_INPUT_CHARS) {
    return { ok: false, error: `Please provide at least ${MIN_INPUT_CHARS} characters of notes.` };
  }
  if (clean.length > MAX_INPUT_CHARS) {
    return { ok: false, error: `Notes are too long (max ${MAX_INPUT_CHARS} characters).` };
  }
  return { ok: true, mode, text: clean };
}

function buildPrompt(mode, text) {
  const m = MODES[mode];
  return `${m.task}\n\nReturn JSON with exactly this shape:\n${m.shape}\n\nNOTES:\n"""\n${text}\n"""`;
}

function parseModelJson(raw) {
  if (typeof raw !== 'string') throw new Error('Empty model response.');
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  return JSON.parse(cleaned);
}

const isStr = (v) => typeof v === 'string' && v.trim().length > 0;
const isStrArr = (v) => Array.isArray(v) && v.length > 0 && v.every(isStr);

function isValidResult(mode, d) {
  if (!d || typeof d !== 'object') return false;
  switch (mode) {
    case 'summary':
      return isStr(d.title) && isStr(d.summary) && isStrArr(d.keyPoints);
    case 'quiz':
      return (
        Array.isArray(d.questions) &&
        d.questions.length > 0 &&
        d.questions.every(
          (q) =>
            q && isStr(q.question) && Array.isArray(q.options) && q.options.length === 4 &&
            q.options.every(isStr) && Number.isInteger(q.answerIndex) &&
            q.answerIndex >= 0 && q.answerIndex <= 3 && isStr(q.explanation)
        )
      );
    case 'flashcards':
      return Array.isArray(d.cards) && d.cards.length > 0 && d.cards.every((c) => c && isStr(c.front) && isStr(c.back));
    case 'explain':
      return isStr(d.analogy) && isStr(d.explanation) && isStr(d.example);
    default:
      return false;
  }
}

module.exports = { MODES, MAX_INPUT_CHARS, SYSTEM_PROMPT, validateInput, buildPrompt, parseModelJson, isValidResult };
