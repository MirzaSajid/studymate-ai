# StudyMate AI

An AI-powered study assistant. Paste your notes and instantly get a **summary**, a **5-question quiz**, **flashcards**, or a **beginner-friendly explanation**, powered by the Google Gemini API.

> Built for **Module 05 – AI Tools & Mini Project** (Superior University, AI program).

## Features

- Four study modes: Summary, Quiz (interactive, with explanations), Flashcards (click to flip), Explain Simply
- Structured JSON output from the model, validated on the server before it reaches the UI
- API key stays on the server and never reaches the browser
- XSS-safe rendering (AI output is inserted with `textContent` only)
- Input validation, request-size limit, per-IP rate limiting, security headers and a strict Content-Security-Policy
- Responsive, accessible UI with automatic dark mode
- Zero runtime dependencies (Node.js built-ins only) and an automated test suite

## Tech stack

Node.js 18+ (built-in `http`, `fetch`, `node:test`), vanilla HTML/CSS/JavaScript, Google Gemini API.

## Getting started

```bash
git clone https://github.com/<your-username>/studymate-ai.git
cd studymate-ai
cp .env.example .env        # Windows: copy .env.example .env
# edit .env and paste your key from https://aistudio.google.com/apikey
npm start
```

Open http://localhost:3000.

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `GEMINI_API_KEY` | Yes | – | Your Gemini API key |
| `GEMINI_MODEL` | No | `gemini-2.5-flash` | Model name (change it if Google retires or renames models) |
| `PORT` | No | `3000` | Server port |

## Run the tests

```bash
npm test
```

The tests mock the Gemini API, so they run offline and need no key.

## Project structure

```
studymate-ai/
├── server.js          # HTTP server, /api/study endpoint, Gemini call, static files
├── lib/study.js       # Prompts, input validation, JSON parsing, output validation
├── public/            # Front end (index.html, style.css, app.js)
├── test/              # Unit and integration tests
└── docs/linkedin-post.md
```

## How AI tools were used

1. **ChatGPT, Gemini and Microsoft Copilot** were explored for coding help, research and productivity (see the LinkedIn post for takeaways).
2. **Gemini API** powers the application itself: a system prompt keeps answers grounded in the user's notes, and the model is asked for strict JSON that the server validates.
3. AI-generated code was reviewed, tested and hardened by hand before being committed.

## Limitations and future work

- AI can make mistakes: verify important facts.
- Input is limited to 8,000 characters per request.
- Ideas: PDF upload, saving study sets, spaced-repetition mode, multi-language support.

## License

MIT © 2026 Sajid Hussain
