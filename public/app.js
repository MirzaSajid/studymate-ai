'use strict';

const notes = document.getElementById('notes');
const counter = document.getElementById('counter');
const generate = document.getElementById('generate');
const statusEl = document.getElementById('status');
const output = document.getElementById('output');
let mode = 'summary';

// Elements are built with textContent only, so AI output can never inject HTML.
function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  Object.assign(node, props);
  node.append(...children);
  return node;
}

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.className = isError ? 'error' : '';
}

notes.addEventListener('input', () => { counter.textContent = `${notes.value.length} / 8000`; });

document.querySelectorAll('.mode').forEach((btn) =>
  btn.addEventListener('click', () => {
    mode = btn.dataset.mode;
    document.querySelectorAll('.mode').forEach((b) => b.classList.toggle('active', b === btn));
  })
);

const renderers = {
  summary: (d) => el('div', { className: 'result' }, el('h3', { textContent: d.title }), el('p', { textContent: d.summary }),
    el('ul', {}, ...d.keyPoints.map((p) => el('li', { textContent: p })))),

  quiz: (d) => {
    const box = el('div', { className: 'result' });
    d.questions.forEach((q, i) => {
      const block = el('div', { className: 'q' }, el('strong', { textContent: `${i + 1}. ${q.question}` }));
      const feedback = el('p', { className: 'expl' });
      const buttons = q.options.map((text, idx) => {
        const b = el('button', { type: 'button', className: 'opt', textContent: text });
        b.addEventListener('click', () => {
          buttons.forEach((x, j) => { x.disabled = true; if (j === q.answerIndex) x.classList.add('correct'); });
          if (idx !== q.answerIndex) b.classList.add('wrong');
          feedback.textContent = (idx === q.answerIndex ? 'Correct. ' : 'Not quite. ') + q.explanation;
        });
        return b;
      });
      block.append(...buttons, feedback);
      box.append(block);
    });
    return box;
  },

  flashcards: (d) => el('div', { className: 'result' }, el('div', { className: 'grid' },
    ...d.cards.map((c) => {
      const label = el('small', { textContent: 'Question' });
      const text = el('span', { textContent: c.front });
      const card = el('button', { type: 'button', className: 'flash', title: 'Click to flip' }, label, text);
      let showBack = false;
      card.addEventListener('click', () => {
        showBack = !showBack;
        label.textContent = showBack ? 'Answer' : 'Question';
        text.textContent = showBack ? c.back : c.front;
      });
      return card;
    }))),

  explain: (d) => el('div', { className: 'result' },
    el('h3', { textContent: 'Explained simply' }), el('p', { textContent: d.explanation }),
    el('h3', { textContent: 'Analogy' }), el('p', { textContent: d.analogy }),
    el('h3', { textContent: 'Example' }), el('p', { textContent: d.example })),
};

generate.addEventListener('click', async () => {
  const text = notes.value.trim();
  if (text.length < 40) { setStatus('Please paste at least 40 characters of notes.', true); return; }
  generate.disabled = true;
  output.replaceChildren();
  setStatus('Generating with AI...');
  try {
    const res = await fetch('/api/study', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode, text }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Something went wrong.');
    output.replaceChildren(renderers[data.mode](data.result));
    setStatus('Done.');
  } catch (err) {
    setStatus(err.message || 'Network error. Is the server running?', true);
  } finally {
    generate.disabled = false;
  }
});
