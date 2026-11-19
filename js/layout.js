// Rearrange the side cards (To-do, Notes, Report) by dragging their ⠿ handle,
// between the left and right columns. The order is saved in settings.layout.

import { t } from './strings.js';
import { applySettings } from './settings.js';

const $ = (id) => document.getElementById(id);
const CARDS = ['todoModule', 'notesModule', 'reportModule'];
const DEFAULT = { left: ['todoModule', 'notesModule'], right: ['reportModule'] };
const TYPE = 'application/x-intent-card';
const GRIP = '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><g fill="currentColor"><circle cx="9" cy="6" r="1.5"/><circle cx="15" cy="6" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="18" r="1.5"/></g></svg>';

let dragging = null;

function cols() {
  return { left: document.querySelector('.side-left'), right: document.querySelector('.side-right') };
}

export function applyLayout(layout) {
  const l = layout && Array.isArray(layout.left) && Array.isArray(layout.right) ? layout : DEFAULT;
  const { left, right } = cols();
  const placed = new Set();
  for (const [col, ids] of [[left, l.left], [right, l.right]]) {
    for (const id of ids) {
      const el = $(id);
      if (el && !placed.has(id)) { col.append(el); placed.add(id); }
    }
  }
  // Cards missing from a saved layout (e.g. new in an update) go to their default column.
  for (const id of CARDS) {
    if (placed.has(id)) continue;
    const el = $(id);
    if (el) (DEFAULT.right.includes(id) ? right : left).append(el);
  }
}

function readLayout() {
  const { left, right } = cols();
  const ids = (col) => [...col.children].map((c) => c.id).filter((id) => CARDS.includes(id));
  return { left: ids(left), right: ids(right) };
}

function placeholder() {
  let p = $('cardDropLine');
  if (!p) {
    p = document.createElement('div');
    p.id = 'cardDropLine';
    p.className = 'card-drop-line';
  }
  return p;
}

function addGrip(card) {
  if (card.querySelector('.card-grip')) return;
  const grip = document.createElement('button');
  grip.type = 'button';
  grip.className = 'card-grip';
  grip.innerHTML = GRIP;
  grip.title = t('layoutDrag');
  grip.setAttribute('aria-label', t('layoutDrag'));
  // The card is only draggable while the handle is held, so text inside stays selectable.
  grip.addEventListener('pointerdown', () => { card.draggable = true; });
  grip.addEventListener('pointerup', () => { card.draggable = false; });
  card.addEventListener('dragstart', (e) => {
    if (!card.draggable) return;
    dragging = card;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData(TYPE, card.id);
    requestAnimationFrame(() => card.classList.add('is-moving'));
  });
  card.addEventListener('dragend', () => {
    card.draggable = false;
    card.classList.remove('is-moving');
    placeholder().remove();
    dragging = null;
  });
  card.append(grip);
}

function bindColumn(col) {
  col.addEventListener('dragover', (e) => {
    if (!dragging || ![...e.dataTransfer.types].includes(TYPE)) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    const cards = [...col.children].filter((c) => CARDS.includes(c.id) && c !== dragging && !c.hidden);
    const after = cards.find((c) => {
      const r = c.getBoundingClientRect();
      return e.clientY < r.top + r.height / 2;
    });
    const p = placeholder();
    if (after) col.insertBefore(p, after); else col.append(p);
  });
  col.addEventListener('drop', async (e) => {
    if (!dragging) return;
    e.preventDefault();
    e.stopPropagation();
    const p = placeholder();
    if (p.parentNode === col) col.insertBefore(dragging, p);
    p.remove();
    await applySettings({ layout: readLayout() });
  });
}

export function initLayout(settings) {
  applyLayout(settings.layout);
  CARDS.forEach((id) => { const c = $(id); if (c) addGrip(c); });
  const { left, right } = cols();
  bindColumn(left);
  bindColumn(right);
  document.addEventListener('intent:settings', (e) => {
    // Only re-apply when the layout was reset or changed elsewhere (not mid-drag).
    if (!dragging && JSON.stringify(e.detail.layout) !== JSON.stringify(readLayout())) applyLayout(e.detail.layout);
  });
  document.addEventListener('intent:lang', () => {
    document.querySelectorAll('.card-grip').forEach((g) => { g.title = t('layoutDrag'); g.setAttribute('aria-label', t('layoutDrag')); });
  });
}
