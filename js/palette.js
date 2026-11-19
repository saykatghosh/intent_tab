// Command palette (Ctrl+K / ⌘K): one place to search bookmarks and to-dos,
// set an intent, ask the AI and change settings.
// Every module adds its own commands with registerCommands(provider).
//
// provider(query) → item[] (or a Promise of it). An item:
//   { group, label, run, icon?, hint?, keywords?, always? }
// `always: true` keeps an item even if it doesn't match the text (used for
// "Set intent: <what you typed>" and similar).

import { t } from './strings.js';

const $ = (id) => document.getElementById(id);
const providers = [];
const GROUP_ORDER = ['quick', 'projects', 'bookmarks', 'todos', 'tools', 'actions', 'settings'];
const GROUP_LABEL = { answer: 'palGroupAnswer', tools: 'palGroupTools', projects: 'palGroupProjects', quick: 'palGroupQuick', bookmarks: 'palGroupBookmarks', todos: 'palGroupTodos', actions: 'palGroupActions', settings: 'palGroupSettings' };
const PER_GROUP = 6;

const ICONS = {
  target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r=".6"/>',
  spark: '<path d="M12 3l1.8 5.7L19.5 10.5l-5.7 1.8L12 18l-1.8-5.7L4.5 10.5l5.7-1.8z"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4 4"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  folder: '<path d="M3.5 7.5a2 2 0 0 1 2-2h4l2 2h7a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>',
  moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>',
  globe: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.5 2.5 3.5 5.5 3.5 8.5s-1 6-3.5 8.5c-2.5-2.5-3.5-5.5-3.5-8.5s1-6 3.5-8.5z"/>',
  settings: '<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>',
  breath: '<path d="M4 9h10a3 3 0 1 0-3-3M4 15h13a3 3 0 1 1-3 3M4 12h7"/>',
  timer: '<circle cx="12" cy="13" r="7.5"/><path d="M12 9v4l2.5 2M9.5 2.5h5"/>',
  image: '<rect x="4" y="5" width="16" height="14" rx="2"/><path d="M4 16l4.5-4.5 4 4 2.5-2.5L20 18"/>',
  bookmark: '<path d="M7 4h10a1 1 0 0 1 1 1v15l-6-4-6 4V5a1 1 0 0 1 1-1z"/>',
  undo: '<path d="M9 7L5 11l4 4M5 11h9a5 5 0 0 1 0 10h-2"/>',
  calc: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8 12h.01M12 12h.01M16 12h.01M8 16h.01M12 16h.01M16 16h.01"/>',
  color: '<path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.6-.9 1.2-1.8-.5-1-.1-2.2 1.2-2.2H17a4 4 0 0 0 4-4c0-5.5-4-10-9-10z"/><circle cx="7.5" cy="11" r="1"/><circle cx="10" cy="7" r="1"/><circle cx="15" cy="7.5" r="1"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M17 6l3 3M14 9l2 2"/>',
  code: '<path d="M9 7l-5 5 5 5M15 7l5 5-5 5"/>',
};

let items = [];
let active = 0;
let seq = 0;

export function registerCommands(provider) {
  providers.push(provider);
}

function icon(name) {
  return `<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${ICONS[name] || ICONS.spark}</svg>`;
}

function score(item, q) {
  if (!q) return 1;
  const label = item.label.toLowerCase();
  const hay = (label + ' ' + (item.keywords || '') + ' ' + (item.hint || '')).toLowerCase();
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.every((w) => hay.includes(w))) return 0;
  if (label.startsWith(q.toLowerCase())) return 4;
  if (label.split(/\s+/).some((w) => w.startsWith(words[0]))) return 3;
  if (label.includes(words[0])) return 2;
  return 1;
}

async function refresh() {
  const q = $('paletteInput').value.trim();
  const my = ++seq;
  const lists = await Promise.all(providers.map((p) => Promise.resolve().then(() => p(q)).catch((err) => {
    console.warn('[Intent Tab] palette provider', err);
    return [];
  })));
  if (my !== seq) return;

  const grouped = {};
  for (const item of lists.flat().filter(Boolean)) {
    // `rank` orders the always-shown quick items (Set intent first, Google last).
    const s = item.always ? 5 + (item.rank || 0) / 10 : score(item, q);
    if (!s) continue;
    (grouped[item.group] = grouped[item.group] || []).push({ ...item, _s: s });
  }
  // Order: instant answers (= 14, 24px = 1.5rem…) first. Then, if the text clearly
  // names a tool / project / bookmark / command, show those before the generic
  // "Set intent / Ask AI / Add to-do" fallbacks; otherwise the fallbacks lead.
  const quick = (grouped.quick || []).sort((a, b) => b._s - a._s);
  const answers = quick.filter((it) => (it.rank || 0) >= 8).map((it) => ({ ...it, group: 'answer' }));
  const fallbacks = quick.filter((it) => (it.rank || 0) < 8);
  const others = GROUP_ORDER.filter((g) => g !== 'quick');
  const strong = q && others.some((g) => (grouped[g] || []).some((it) => !it.always && it._s >= 3));
  const order = strong ? [...others, 'quick'] : ['quick', ...others];

  items = [...answers];
  for (const g of order) {
    const pool = g === 'quick' ? fallbacks : (grouped[g] || []).sort((a, b) => b._s - a._s);
    pool.slice(0, q ? PER_GROUP : (g === 'actions' ? 8 : 4)).forEach((it) => items.push(it));
  }
  active = 0;
  render();
}

function render() {
  const list = $('paletteList');
  list.textContent = '';
  let lastGroup = null;
  items.forEach((it, i) => {
    if (it.group !== lastGroup) {
      lastGroup = it.group;
      const h = document.createElement('div');
      h.className = 'pal-group';
      h.textContent = t(GROUP_LABEL[it.group] || 'palGroupActions');
      list.append(h);
    }
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'pal-item' + (i === active ? ' is-active' : '');
    row.setAttribute('role', 'option');
    row.setAttribute('aria-selected', String(i === active));
    row.id = 'pal-' + i;
    row.innerHTML = `<span class="pal-icon">${it.img ? '' : icon(it.icon)}</span>`;
    if (it.img) {
      const img = document.createElement('img');
      img.src = it.img;
      img.alt = '';
      row.firstChild.append(img);
    }
    const label = document.createElement('span');
    label.className = 'pal-label';
    label.textContent = it.label;
    row.append(label);
    if (it.hint) {
      const hint = document.createElement('span');
      hint.className = 'pal-hint';
      hint.textContent = it.hint;
      row.append(hint);
    }
    row.addEventListener('mousemove', () => { if (active !== i) { active = i; mark(); } });
    row.addEventListener('click', () => choose(i));
    list.append(row);
  });
  $('paletteEmpty').hidden = items.length > 0;
  $('paletteInput').setAttribute('aria-activedescendant', items.length ? 'pal-' + active : '');
}

function mark() {
  document.querySelectorAll('.pal-item').forEach((el, i) => {
    el.classList.toggle('is-active', i === active);
    el.setAttribute('aria-selected', String(i === active));
  });
  document.getElementById('pal-' + active)?.scrollIntoView({ block: 'nearest' });
  $('paletteInput').setAttribute('aria-activedescendant', 'pal-' + active);
}

function choose(i) {
  const it = items[i];
  if (!it) return;
  closePalette();
  // Let the dialog close before the action (some actions open another dialog).
  setTimeout(() => it.run(), 0);
}

export function openPalette(text = '') {
  const dlg = $('palette');
  if (dlg.open) { $('paletteInput').select(); return; }
  $('paletteInput').value = text;
  dlg.showModal();
  $('paletteInput').focus();
  refresh();
}

export function closePalette() {
  const dlg = $('palette');
  if (dlg.open) dlg.close();
}

export function initPalette() {
  const dlg = $('palette');
  const input = $('paletteInput');

  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      if (dlg.open) closePalette(); else openPalette();
    }
  });
  $('paletteBtn').addEventListener('click', () => openPalette());

  input.addEventListener('input', refresh);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!items.length) return;
      active = e.key === 'ArrowDown' ? (active + 1) % items.length : (active - 1 + items.length) % items.length;
      mark();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      choose(active);
    }
  });
  dlg.addEventListener('click', (e) => { if (e.target === dlg) closePalette(); });
  document.addEventListener('intent:lang', () => { if (dlg.open) refresh(); });
}
