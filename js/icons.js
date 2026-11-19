// Custom tile icons: an emoji or an uploaded image, plus an optional
// background colour. Stored in chrome.storage.local under `icons`:
//   { [key]: { type: 'default' | 'emoji' | 'image', value, bg, prefixed } }
// key = 'bm:<bookmarkId>' for bookmarks/folders, 'url:<url>' for most visited.
// `prefixed` = the emoji we also put at the start of the bookmark's name,
// so it shows in Chrome's own bookmark bar (Chrome can't show custom icons).

import { get, set } from './store.js';
import { t } from './strings.js';

const EMOJIS = [
  '⭐', '❤️', '🔥', '✨', '📌', '🔖', '📁', '🗂️',
  '💼', '📚', '📝', '📅', '✉️', '💬', '📰', '📈',
  '💰', '🛒', '💻', '🔧', '🧪', '🔬', '🧠', '🎓',
  '🎨', '🎵', '🎬', '🎮', '📷', '🌐', '🏠', '✈️',
  '🍔', '☕', '🏃', '🧘', '🌱', '🐱', '⚽', '🚀',
];
const COLORS = ['', '#4a7364', '#3d6b8f', '#6a5aa8', '#a8566b', '#c0763b', '#b5953a', '#5f6b73', '#2b2b2b'];
const IMAGE_SIZE = 96;

let icons = {};
let draft = null;   // what the dialog is editing
let target = null;  // { key, bookmarkId, title, fallback }
let toastFn = () => {};
const listeners = new Set();
const $ = (id) => document.getElementById(id);

export async function initIcons(toast) {
  toastFn = toast || toastFn;
  const { icons: saved = {} } = await get('icons');
  icons = saved;
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.icons) {
      icons = changes.icons.newValue || {};
      listeners.forEach((fn) => fn());
    }
  });
  bindDialog();
}

export function onIconsChanged(fn) {
  listeners.add(fn);
}

// An emoji at the start of a bookmark name (e.g. "📁 Work") — we show it as the
// icon instead of next to Chrome's default icon, so there is only one icon.
export function leadingEmoji(title) {
  const s = String(title || '').trimStart();
  if (!s) return null;
  const g = firstGrapheme(s);
  if (!g || !/\p{Extended_Pictographic}|\p{Regional_Indicator}/u.test(g)) return null;
  return { emoji: g, rest: s.slice(g.length).trim() };
}

// The name to show (without the emoji we use as the icon).
export function displayTitle(key, title) {
  const r = icons[key];
  if (r && r.prefixed && title) {
    if (title === r.prefixed) return '';
    if (title.startsWith(r.prefixed + ' ')) return title.slice(r.prefixed.length + 1);
  }
  const le = leadingEmoji(title);
  return le ? le.rest : title;
}

// The icon to draw: a custom icon if set, otherwise an emoji from the start of the name.
export function effectiveIcon(key, title) {
  const r = icons[key];
  if (r && r.type !== 'default' && r.value) return r;
  const le = leadingEmoji(title);
  if (le) return { ...(r || {}), type: 'emoji', value: le.emoji };
  return r || null;
}

// Fill a .tile-icon element with the custom icon, or the default via `fallback(el)`.
export function paintIcon(el, record, fallback) {
  el.textContent = '';
  el.style.background = '';
  el.classList.remove('has-bg');
  if (!record || record.type === 'default' || !record.value) {
    fallback(el);
  } else if (record.type === 'emoji') {
    const s = document.createElement('span');
    s.className = 'tile-emoji';
    s.textContent = record.value;
    el.append(s);
  } else if (record.type === 'image') {
    const img = document.createElement('img');
    img.className = 'tile-custom-img';
    img.src = record.value;
    img.alt = '';
    el.append(img);
  }
  if (record && record.bg) {
    el.style.background = record.bg;
    el.classList.add('has-bg');
  }
}

export function iconFor(key) {
  return icons[key] || null;
}

// A deleted bookmark that is restored gets a new id: carry its icon over.
export async function moveIcon(oldKey, newKey) {
  if (!icons[oldKey]) return;
  icons[newKey] = icons[oldKey];
  delete icons[oldKey];
  await set({ icons });
  listeners.forEach((fn) => fn());
}

// ---------- Dialog ----------
export function openIconDialog(opts) {
  target = opts;
  const current = icons[opts.key];
  const shown = effectiveIcon(opts.key, opts.rawTitle || '');
  draft = shown ? { ...shown } : { type: 'default', value: '', bg: '' };
  $('iconFor').textContent = opts.title || '';
  $('emojiInput').value = draft.type === 'emoji' && !EMOJIS.includes(draft.value) ? draft.value : '';
  $('iconError').hidden = true;
  // On by default for bookmarks; afterwards remember what the user chose.
  $('barSync').checked = current && current.type === 'emoji' && current.value ? !!current.prefixed : true;
  switchTab(draft.type === 'image' ? 'image' : 'emoji');
  refresh();
  $('iconDialog').showModal();
}

function switchTab(tab) {
  document.querySelectorAll('[data-icon-tab]').forEach((b) => {
    b.setAttribute('aria-selected', String(b.dataset.iconTab === tab));
  });
  $('iconEmojiPane').hidden = tab !== 'emoji';
  $('iconImagePane').hidden = tab !== 'image';
}

function refresh() {
  paintIcon($('iconPreview'), draft, target.fallback);
  document.querySelectorAll('#emojiGrid button').forEach((b) => {
    b.setAttribute('aria-pressed', String(draft.type === 'emoji' && draft.value === b.textContent));
  });
  document.querySelectorAll('#swatches button').forEach((b) => {
    b.setAttribute('aria-pressed', String((draft.bg || '') === b.dataset.color));
  });
  // The Chrome-bar option only makes sense for a real bookmark with an emoji.
  $('barSyncRow').hidden = !(target.bookmarkId && draft.type === 'emoji' && draft.value);
}

function firstGrapheme(str) {
  const s = String(str).trim();
  if (!s) return '';
  if (window.Intl && Intl.Segmenter) {
    const it = new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(s)[Symbol.iterator]().next();
    return it.value ? it.value.segment : '';
  }
  return Array.from(s)[0];
}

async function imageToDataUrl(file) {
  const bitmap = await createImageBitmap(file);
  const c = document.createElement('canvas');
  c.width = c.height = IMAGE_SIZE;
  const ctx = c.getContext('2d');
  // cover-crop to a square
  const scale = Math.max(IMAGE_SIZE / bitmap.width, IMAGE_SIZE / bitmap.height);
  const w = bitmap.width * scale;
  const h = bitmap.height * scale;
  ctx.drawImage(bitmap, (IMAGE_SIZE - w) / 2, (IMAGE_SIZE - h) / 2, w, h);
  bitmap.close?.();
  return c.toDataURL('image/png');
}

async function save(record, wantBarEmoji) {
  const { key, bookmarkId } = target;
  const old = icons[key];
  const rec = record && (record.type !== 'default' || record.bg) ? { ...record } : null;
  if (rec) delete rec.prefixed;

  // Keep Chrome's bookmark bar in sync: remove our old emoji, add the new one if asked.
  if (bookmarkId) {
    try {
      const [node] = await chrome.bookmarks.get(bookmarkId);
      let base = node.title || '';
      if (old && old.prefixed) {
        if (base === old.prefixed) base = '';
        else if (base.startsWith(old.prefixed + ' ')) base = base.slice(old.prefixed.length + 1);
      }
      // An emoji typed into the name by hand was acting as the icon: replace it too.
      const le = leadingEmoji(base);
      if (le) base = le.rest;
      let title = base;
      if (rec && rec.type === 'emoji' && wantBarEmoji) {
        title = base ? `${rec.value} ${base}` : rec.value;
        rec.prefixed = rec.value;
      }
      if (title !== node.title) await chrome.bookmarks.update(bookmarkId, { title });
    } catch (e) {
      console.warn('[Intent Tab] could not rename bookmark', e);
    }
  }

  if (rec) icons[key] = rec;
  else delete icons[key];
  await set({ icons });
  listeners.forEach((fn) => fn());
}

function bindDialog() {
  const dlg = $('iconDialog');

  const grid = $('emojiGrid');
  for (const e of EMOJIS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = e;
    b.addEventListener('click', () => {
      draft = { ...draft, type: 'emoji', value: e };
      $('emojiInput').value = '';
      refresh();
    });
    grid.append(b);
  }

  const sw = $('swatches');
  for (const c of COLORS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.color = c;
    b.className = 'swatch' + (c ? '' : ' swatch-none');
    if (c) b.style.background = c;
    b.setAttribute('aria-label', c || t('iconNone'));
    b.title = c || t('iconNone');
    b.addEventListener('click', () => { draft = { ...draft, bg: c }; refresh(); });
    sw.append(b);
  }

  document.querySelectorAll('[data-icon-tab]').forEach((b) => {
    b.addEventListener('click', () => switchTab(b.dataset.iconTab));
  });

  $('emojiInput').addEventListener('input', () => {
    const g = firstGrapheme($('emojiInput').value);
    if (g) { draft = { ...draft, type: 'emoji', value: g }; refresh(); }
  });

  $('iconFile').addEventListener('change', async () => {
    const file = $('iconFile').files[0];
    $('iconFile').value = '';
    if (!file) return;
    try {
      const url = await imageToDataUrl(file);
      draft = { ...draft, type: 'image', value: url };
      $('iconError').hidden = true;
      refresh();
    } catch {
      $('iconError').hidden = false;
    }
  });

  $('iconCancel').addEventListener('click', () => dlg.close());
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });

  $('iconReset').addEventListener('click', async () => {
    await save(null, false);
    dlg.close();
    toastFn(t('iconSaved'));
  });

  $('iconForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    await save(draft, $('barSync').checked);
    dlg.close();
    toastFn(t('iconSaved'));
  });
}
