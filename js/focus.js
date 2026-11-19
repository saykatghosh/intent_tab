// "Today's one thing": a single goal for the day, shown as a small pill
// above the question. Asked until it's set (or skipped) each day.

import { get, set, dayKey } from './store.js';
import { t } from './strings.js';
import { burstFrom } from './effects.js';
import { registerCommands } from './palette.js';

const $ = (id) => document.getElementById(id);
const TARGET_SVG = '<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r=".7" fill="currentColor"/></svg>';
const CHECK_SVG = '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const EDIT_SVG = '<svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>';
const ARROW_SVG = '<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

let focus = null;   // { day, text, done } | { day, skipped: true } | null
let editing = false;

function today(f) {
  return f && f.day === dayKey() ? f : null;
}

// The day's focus, if one is set (used by the AI suggestions and coach).
export function getFocus() {
  return focus && !focus.skipped && focus.text ? focus : null;
}

export async function initFocus() {
  const { focus: saved } = await get('focus');
  focus = today(saved);
  render();
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes.focus) return;
    focus = today(changes.focus.newValue);
    if (!editing) render();
  });
  document.addEventListener('intent:lang', () => { if (!editing) render(); });

  registerCommands((q) => {
    const f = getFocus();
    const out = [{
      group: q ? 'quick' : 'actions', icon: 'target', always: !!q, rank: 2,
      label: q ? t('palSetFocusQ', { q }) : t('palSetFocus'),
      keywords: 'focus goal today one thing লক্ষ্য',
      run: () => (q ? saveFocus(q) : startEdit()),
    }];
    if (f) {
      out.push({
        group: 'actions', icon: 'check', keywords: 'focus goal done',
        label: f.done ? t('palFocusUndone') : t('palFocusDone'),
        run: () => toggleDone(),
      });
    }
    return out;
  });
}

async function saveFocus(text) {
  text = String(text || '').trim();
  if (!text) return;
  focus = { day: dayKey(), text, done: false };
  editing = false;
  await set({ focus });
  render();
}

async function skip() {
  focus = { day: dayKey(), skipped: true };
  editing = false;
  await set({ focus });
  render();
}

async function toggleDone(btn) {
  if (!getFocus()) return;
  focus = { ...focus, done: !focus.done };
  await set({ focus });
  if (focus.done && btn) burstFrom(btn, { count: 24, spread: 90 });
  render();
}

function startEdit() {
  editing = true;
  render();
  $('focusInput')?.focus();
}

function render() {
  const box = $('focusStrip');
  box.textContent = '';
  box.className = 'focus-strip';

  // Skipped for today and not editing: stay out of the way.
  if (!editing && focus && focus.skipped) { box.hidden = true; return; }
  box.hidden = false;

  if (editing || !getFocus()) {
    box.classList.add('is-asking');
    const form = document.createElement('form');
    form.className = 'focus-form';
    form.autocomplete = 'off';
    form.innerHTML = `<span class="focus-icon">${TARGET_SVG}</span>`;
    const input = document.createElement('input');
    input.type = 'text';
    input.id = 'focusInput';
    input.maxLength = 120;
    input.placeholder = t('focusPlaceholder');
    input.setAttribute('aria-label', t('focusQuestion'));
    if (editing && getFocus()) input.value = focus.text;
    const go = document.createElement('button');
    go.type = 'submit';
    go.className = 'focus-go';
    go.innerHTML = ARROW_SVG;
    go.title = t('intentSubmit');
    go.setAttribute('aria-label', t('intentSubmit'));
    form.append(input, go);
    form.addEventListener('submit', (e) => { e.preventDefault(); saveFocus(input.value); });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && editing && getFocus()) { e.stopPropagation(); editing = false; render(); }
    });

    const later = document.createElement('button');
    later.type = 'button';
    later.className = 'focus-skip';
    later.textContent = editing && getFocus() ? t('cancel') : t('focusSkip');
    later.addEventListener('click', () => {
      if (editing && getFocus()) { editing = false; render(); } else skip();
    });

    const label = document.createElement('span');
    label.className = 'focus-label';
    label.textContent = t('focusQuestion');
    box.append(label, form, later);
    return;
  }

  // Focus is set: a quiet pill with done / edit.
  if (focus.done) box.classList.add('is-done');
  const pill = document.createElement('div');
  pill.className = 'focus-pill';
  pill.innerHTML = `<span class="focus-icon">${TARGET_SVG}</span>`;
  const label = document.createElement('span');
  label.className = 'focus-tag';
  label.textContent = t('focusToday');
  const text = document.createElement('span');
  text.className = 'focus-text';
  text.textContent = focus.text;

  const done = document.createElement('button');
  done.type = 'button';
  done.className = 'focus-btn focus-check';
  done.innerHTML = CHECK_SVG;
  done.title = focus.done ? t('palFocusUndone') : t('palFocusDone');
  done.setAttribute('aria-pressed', String(!!focus.done));
  done.setAttribute('aria-label', done.title);
  done.addEventListener('click', () => toggleDone(done));

  const edit = document.createElement('button');
  edit.type = 'button';
  edit.className = 'focus-btn';
  edit.innerHTML = EDIT_SVG;
  edit.title = t('focusEdit');
  edit.setAttribute('aria-label', t('focusEdit'));
  edit.addEventListener('click', startEdit);

  pill.append(label, text, done, edit);
  box.append(pill);
}
