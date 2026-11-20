// Extra settings and controls added in v1.2:
//   search engine, accent colour, background photo, focus mode sites,
//   notifications, sync, export / import (with a backup reminder), reset layout,
//   and focus sounds.

import { get, set, dayKey } from './store.js';
import { t, locale } from './strings.js';
import { registerCommands } from './palette.js';
import { applySettings, currentSettings } from './settings.js';
import { ENGINES, setEngine } from './search.js';

const $ = (id) => document.getElementById(id);
export const ACCENTS = ['sage', 'ocean', 'violet', 'amber', 'rose'];
const SOUNDS = ['off', 'rain', 'ocean', 'fan'];
const SOUND_ICONS = {
  off: '<path d="M11 5L6 9H3v6h3l5 4z M16 9l5 6 M21 9l-5 6"/>',
  rain: '<path d="M7 15a4 4 0 0 1-.5-8 5.5 5.5 0 0 1 10.6 1.5A3.5 3.5 0 0 1 17 15z M8 19l-1 2 M12 18l-1 3 M16 19l-1 2"/>',
  ocean: '<path d="M3 10c2 0 2-2 4.5-2S10 10 12 10s2-2 4.5-2S19 10 21 10 M3 15c2 0 2-2 4.5-2S10 15 12 15s2-2 4.5-2S19 15 21 15"/>',
  fan: '<circle cx="12" cy="12" r="1.6"/><path d="M12 10.4c-1-3 .5-6 3-6 1.8 0 2 2.6-1 4.5 M13.6 12c3-1 6 .5 6 3 0 1.8-2.6 2-4.5-1 M12 13.6c1 3-.5 6-3 6-1.8 0-2-2.6 1-4.5 M10.4 12c-3 1-6-.5-6-3 0-1.8 2.6-2 4.5 1"/>',
};
let toastFn = () => {};

// ---------- Accent colour ----------
export function applyAccent(accent) {
  if (accent && accent !== 'sage') document.documentElement.dataset.accent = accent;
  else delete document.documentElement.dataset.accent;
  try { localStorage.setItem('intent-accent', accent || 'sage'); } catch { /* ignore */ }
}

// ---------- Background photo ----------
export async function applyPhoto(settings) {
  const el = $('bgPhoto');
  if (settings.background !== 'photo') { el.hidden = true; el.style.backgroundImage = ''; return; }
  const { bgPhoto } = await get('bgPhoto');
  el.hidden = !bgPhoto;
  if (bgPhoto) el.style.backgroundImage = `url("${bgPhoto}")`;
  el.style.setProperty('--bg-dim', String(settings.bgDim ?? 0.25));
}

async function imageToDataUrl(file, max = 2400) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bitmap.width * scale);
  c.height = Math.round(bitmap.height * scale);
  c.getContext('2d').drawImage(bitmap, 0, 0, c.width, c.height);
  bitmap.close?.();
  return c.toDataURL('image/jpeg', 0.84);
}

// ---------- Focus mode sites ----------
function cleanDomain(raw) {
  let s = String(raw || '').trim().toLowerCase();
  if (!s) return '';
  s = s.replace(/^[a-z]+:\/\//, '').replace(/^www\./, '').split(/[/?#:]/)[0];
  return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(s) ? s : '';
}

function originsFor(d) {
  return [`*://${d}/*`, `*://*.${d}/*`];
}

async function askPermission(domains) {
  const origins = domains.flatMap(originsFor);
  if (!origins.length) return true;
  try {
    return await chrome.permissions.request({ origins });
  } catch (err) {
    console.warn('[Intent Tab] permission', err);
    return false;
  }
}

function renderSites(settings) {
  const list = $('focusSites');
  list.textContent = '';
  for (const d of settings.focusSites || []) {
    const chip = document.createElement('span');
    chip.className = 'site-chip';
    const img = document.createElement('img');
    img.alt = '';
    img.src = (() => { const u = new URL(chrome.runtime.getURL('/_favicon/')); u.searchParams.set('pageUrl', 'https://' + d); u.searchParams.set('size', '16'); return u.toString(); })();
    const name = document.createElement('span');
    name.textContent = d;
    const x = document.createElement('button');
    x.type = 'button';
    x.setAttribute('aria-label', t('ctxDelete') + ': ' + d);
    x.innerHTML = '<svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
    x.addEventListener('click', async () => {
      const s = currentSettings();
      await applySettings({ focusSites: s.focusSites.filter((v) => v !== d) });
      chrome.permissions.remove({ origins: originsFor(d) }).catch(() => {});
    });
    chip.append(img, name, x);
    list.append(chip);
  }
  $('focusSitesEmpty').hidden = (settings.focusSites || []).length > 0;
}

// ---------- Sounds (played by the background, see offscreen.js) ----------
async function renderSound() {
  const { sound = { kind: 'off', volume: 0.5 } } = await get('sound');
  const box = $('soundPick');
  box.textContent = '';
  for (const kind of SOUNDS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'sound-btn';
    b.title = t('sound_' + kind);
    b.setAttribute('aria-label', t('sound_' + kind));
    b.setAttribute('aria-pressed', String(sound.kind === kind));
    b.innerHTML = `<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${SOUND_ICONS[kind]}</svg>`;
    if (kind !== 'off') b.append(t('sound_' + kind));
    b.addEventListener('click', () => setSound(kind));
    box.append(b);
  }
  const vol = document.createElement('input');
  vol.type = 'range';
  vol.min = '0';
  vol.max = '1';
  vol.step = '0.05';
  vol.value = String(sound.volume ?? 0.5);
  vol.className = 'sound-vol';
  vol.hidden = sound.kind === 'off';
  vol.setAttribute('aria-label', t('soundVolume'));
  vol.addEventListener('change', async () => {
    const { sound: cur = { kind: 'off' } } = await get('sound');
    await set({ sound: { ...cur, volume: Number(vol.value) } });
  });
  box.append(vol);
}

async function setSound(kind) {
  const { sound: cur = { volume: 0.5 } } = await get('sound');
  await set({ sound: { ...cur, kind } });
}

// ---------- Export / import ----------
// Bookkeeping that belongs to this computer only, never to a backup file.
const LOCAL_ONLY = ['syncMeta', 'syncState', 'update', 'updateDismissed'];

export async function exportData() {
  const all = await chrome.storage.local.get(null);
  for (const k of LOCAL_ONLY) delete all[k];
  const blob = new Blob([JSON.stringify({ app: 'intent-tab', version: chrome.runtime.getManifest().version, exportedAt: new Date().toISOString(), data: all }, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `intent-tab-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  const { backup = {} } = await get('backup');
  await set({ backup: { ...backup, lastAt: Date.now() } });
  toastFn(t('exportDone'));
}

async function importData(file) {
  try {
    const json = JSON.parse(await file.text());
    const data = json && json.app === 'intent-tab' ? json.data : null;
    if (!data || typeof data !== 'object') throw new Error('not an Intent Tab backup');
    if (!confirm(t('importConfirm'))) return;
    for (const k of LOCAL_ONLY) delete data[k];
    await chrome.storage.local.clear();
    await chrome.storage.local.set(data);
    location.reload();
  } catch (err) {
    console.warn('[Intent Tab] import', err);
    toastFn(t('importFailed'));
  }
}

// ---------- Backup status and reminder ----------
const DAY_MS = 24 * 60 * 60 * 1000;

function shortDate(ms) {
  return new Date(ms).toLocaleDateString(locale(), { day: 'numeric', month: 'short' });
}

function shortTime(ms) {
  const d = new Date(ms);
  if (dayKey(d) !== dayKey()) return shortDate(ms);
  return d.toLocaleTimeString(locale(), { hour: 'numeric', minute: '2-digit' });
}

// "Last backup: 12 Nov" and, with sync on, "Last synced: 10:32" (or why it failed).
async function renderDataStatus() {
  const el = $('dataStatus');
  if (!el) return;
  const { backup = {}, syncState = {} } = await get(['backup', 'syncState']);
  const lines = [backup.lastAt ? t('backupLast', { date: shortDate(backup.lastAt) }) : t('backupNever')];
  if (currentSettings().sync) {
    if (syncState.error === 'quota') lines.push(t('syncTooBig'));
    else if (syncState.error) lines.push(t('syncFailed'));
    else if (syncState.at) lines.push(t('syncLast', { time: shortTime(syncState.at) }));
    else lines.push(t('syncWaiting'));
  }
  el.textContent = lines.join(' · ');
  el.classList.toggle('is-warn', !backup.lastAt || !!syncState.error);
}

function hasData({ todos = [], notes = {}, projects = [] }) {
  return todos.length > 0 || projects.length > 0 || !!(notes.text || '').trim();
}

// No backup for a week (a month with sync on)? Say so once, then wait 3 days.
async function remindBackup() {
  const now = Date.now();
  const all = await get(['backup', 'todos', 'notes', 'projects']);
  const backup = all.backup || {};
  if (!backup.firstSeen) { await set({ backup: { ...backup, firstSeen: now } }); return; }
  if (!hasData(all) || (backup.snoozeUntil || 0) > now) return;
  const every = (currentSettings().sync ? 30 : 7) * DAY_MS;
  const since = backup.lastAt || backup.firstSeen;
  if (now - since < every) return;
  await set({ backup: { ...backup, snoozeUntil: now + 3 * DAY_MS } });
  const days = Math.floor((now - since) / DAY_MS);
  toastFn(t(backup.lastAt ? 'backupRemind' : 'backupRemindFirst', { n: days }), { label: t('backupNow'), run: exportData });
}

// ---------- Fill the settings controls ----------
function fill(settings) {
  $('engineSelect').value = settings.engine || 'google';
  document.querySelectorAll('[data-accent-choice]').forEach((b) => {
    b.setAttribute('aria-pressed', String(b.dataset.accentChoice === (settings.accent || 'sage')));
  });
  $('photoRow').hidden = settings.background !== 'photo';
  $('bgDim').value = String(settings.bgDim ?? 0.25);
  $('notifyToggle').checked = settings.notify !== false;
  $('focusToggle').checked = !!settings.focusMode;
  $('focusSitesBox').hidden = !settings.focusMode;
  $('syncToggle').checked = !!settings.sync;
  renderSites(settings);
}

function applyAll(settings) {
  setEngine(settings.engine);
  applyAccent(settings.accent);
  applyPhoto(settings);
  fill(settings);
}

export function initPrefs(settings, toast) {
  toastFn = toast || toastFn;

  // Search engine
  const sel = $('engineSelect');
  Object.entries(ENGINES).forEach(([id, e]) => {
    const o = document.createElement('option');
    o.value = id;
    o.textContent = e.name;
    sel.append(o);
  });
  sel.addEventListener('change', () => applySettings({ engine: sel.value }));

  // Accent
  document.querySelectorAll('[data-accent-choice]').forEach((b) => {
    b.addEventListener('click', () => applySettings({ accent: b.dataset.accentChoice }));
  });

  // Photo background
  $('photoBtn').addEventListener('click', () => $('photoFile').click());
  $('photoFile').addEventListener('change', async () => {
    const file = $('photoFile').files[0];
    $('photoFile').value = '';
    if (!file) return;
    try {
      const url = await imageToDataUrl(file);
      await set({ bgPhoto: url });
      await applySettings({ background: 'photo' });
      toastFn(t('photoSaved'));
    } catch (err) {
      console.warn('[Intent Tab] photo', err);
      toastFn(t('iconBadImage'));
    }
  });
  $('photoRemove').addEventListener('click', async () => {
    await chrome.storage.local.remove('bgPhoto');
    await applySettings({ background: 'animated' });
  });
  $('bgDim').addEventListener('input', () => { $('bgPhoto').style.setProperty('--bg-dim', $('bgDim').value); });
  $('bgDim').addEventListener('change', () => applySettings({ bgDim: Number($('bgDim').value) }));

  // Focus & notifications
  $('notifyToggle').addEventListener('change', (e) => applySettings({ notify: e.target.checked }));
  $('focusToggle').addEventListener('change', async (e) => {
    const on = e.target.checked;
    if (on) await askPermission(currentSettings().focusSites || []);
    await applySettings({ focusMode: on });
  });
  $('focusSiteForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const d = cleanDomain($('focusSiteInput').value);
    if (!d) { toastFn(t('focusSiteInvalid')); return; }
    const s = currentSettings();
    if ((s.focusSites || []).includes(d)) { $('focusSiteInput').value = ''; return; }
    // Chrome asks the user once per site; nothing is blocked without that permission.
    const ok = await askPermission([d]);
    if (!ok) { toastFn(t('focusSiteDenied')); return; }
    $('focusSiteInput').value = '';
    await applySettings({ focusSites: [...(s.focusSites || []), d] });
  });

  // Data
  $('syncToggle').addEventListener('change', (e) => applySettings({ sync: e.target.checked }));
  $('exportBtn').addEventListener('click', exportData);
  $('importBtn').addEventListener('click', () => $('importFile').click());
  $('importFile').addEventListener('change', () => {
    const f = $('importFile').files[0];
    $('importFile').value = '';
    if (f) importData(f);
  });
  $('resetLayoutBtn').addEventListener('click', () => applySettings({ layout: null }));
  renderDataStatus();
  chrome.storage.onChanged.addListener((c, area) => {
    if (area === 'local' && (c.backup || c.syncState || c.settings)) renderDataStatus();
  });
  // Wait until the page has settled so the reminder doesn't cover the intent question.
  setTimeout(() => remindBackup().catch((e) => console.warn('[Intent Tab] backup', e)), 4000);

  // Sounds under the timer
  renderSound();
  chrome.storage.onChanged.addListener((c, area) => { if (area === 'local' && c.sound) renderSound(); });

  document.addEventListener('intent:settings', (e) => applyAll(e.detail));
  document.addEventListener('intent:lang', () => { applyAll(currentSettings()); renderSound(); renderDataStatus(); });
  applyAll(settings);

  // Palette commands
  registerCommands(() => [
    ...SOUNDS.map((k) => ({ group: 'settings', icon: k === 'off' ? 'settings' : 'breath', label: t('palSound', { name: t('sound_' + k) }), keywords: 'sound music noise rain ocean fan শব্দ', run: () => setSound(k) })),
    ...ACCENTS.map((a) => ({ group: 'settings', icon: 'sun', label: t('palAccent', { name: t('accent_' + a) }), keywords: 'accent colour color রং', run: () => applySettings({ accent: a }) })),
    ...Object.entries(ENGINES).map(([id, e]) => ({ group: 'settings', icon: 'search', label: t('palEngine', { name: e.name }), keywords: 'search engine', run: () => applySettings({ engine: id }) })),
    { group: 'settings', icon: 'image', label: t('photoChoose'), keywords: 'background photo wallpaper image ছবি', run: () => $('photoFile').click() },
    { group: 'settings', icon: 'target', label: currentSettings().focusMode ? t('palFocusModeOff') : t('palFocusModeOn'), keywords: 'focus mode block distracting sites', run: () => applySettings({ focusMode: !currentSettings().focusMode }) },
    { group: 'settings', icon: 'bookmark', label: t('exportBtn'), keywords: 'export backup download data', run: exportData },
  ]);
}
