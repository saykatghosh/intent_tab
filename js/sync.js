// Data sync through Chrome sync (chrome.storage.sync), run by the service worker.
// When "sync" is on in Settings, to-dos, notes and projects follow you to every
// Chrome signed in to the same Google account, and come back after a reinstall.
//
// Chrome sync is small (≈100 KB in all, 8 KB per item), so each value is saved as
// JSON split into chunks:
//   x:<key>     – { n, at }   number of chunks, time of the change
//   x:<key>:<i> – one piece of the JSON text
// Locally, syncMeta = { <key>: at } remembers when each value last changed here.
// The newer side wins. The first time a computer joins, its data is merged with
// what is already in sync instead of being replaced.
//
// syncState = { at, error } is shown in Settings ('quota' when it doesn't fit).

import { get, set, getSettings } from './store.js';

export const SYNC_KEYS = ['todos', 'notes', 'projects'];
const PREFIX = 'x:';
const CHUNK_BYTES = 7000;  // under the 8 KB per-item limit, including the key
const PUSH_DELAY = 4000;   // wait for typing to settle before writing

const utf8 = new TextEncoder();
const timers = {};
const applying = new Map(); // key -> JSON we just wrote locally from sync (ignore its echo)
let queue = Promise.resolve();

// Run one sync job at a time so pulls and pushes never interleave.
function enqueue(job) {
  const run = queue.then(job);
  queue = run.catch((e) => console.warn('[Intent Tab] sync', e));
  return run;
}

async function enabled() {
  if (!chrome.storage.sync) return false;
  return !!(await getSettings()).sync;
}

function blank(key) {
  return key === 'notes' ? { text: '' } : [];
}

function isEmpty(key, v) {
  if (v == null) return true;
  if (key === 'notes') return !(v.text || '').trim();
  return Array.isArray(v) && v.length === 0;
}

// Split text into pieces that each stay under CHUNK_BYTES once stored.
function chunk(text) {
  const out = [];
  let cur = '';
  let bytes = 0;
  for (const ch of text) {
    const cost = utf8.encode(JSON.stringify(ch)).length - 2;
    if (bytes + cost > CHUNK_BYTES) { out.push(cur); cur = ''; bytes = 0; }
    cur += ch;
    bytes += cost;
  }
  out.push(cur);
  return out;
}

// Read one value from sync. Returns null when missing or not fully arrived yet.
function readRemote(all, key) {
  const meta = all[PREFIX + key];
  if (!meta || !meta.n) return null;
  let text = '';
  for (let i = 0; i < meta.n; i++) {
    const part = all[`${PREFIX}${key}:${i}`];
    if (typeof part !== 'string') return null;
    text += part;
  }
  try { return { at: meta.at || 0, value: JSON.parse(text) }; } catch { return null; }
}

async function setState(patch) {
  const { syncState = {} } = await get('syncState');
  await set({ syncState: { ...syncState, ...patch } });
}

async function push(key, value, at) {
  const parts = chunk(JSON.stringify(value ?? blank(key)));
  const items = { [PREFIX + key]: { n: parts.length, at } };
  parts.forEach((p, i) => { items[`${PREFIX}${key}:${i}`] = p; });
  try {
    await chrome.storage.sync.set(items);
  } catch (e) {
    const quota = /QUOTA/i.test(String(e && e.message));
    await setState({ error: quota ? 'quota' : 'failed', at: Date.now() });
    return false;
  }
  // Remove leftover chunks from a longer, older version.
  const all = await chrome.storage.sync.get(null);
  const stale = Object.keys(all).filter((k) => {
    const m = k.match(/^x:(\w+):(\d+)$/);
    return m && m[1] === key && Number(m[2]) >= parts.length;
  });
  if (stale.length) await chrome.storage.sync.remove(stale);
  await setState({ error: null, at: Date.now() });
  return true;
}

async function applyLocal(key, value, at) {
  const { syncMeta = {} } = await get('syncMeta');
  const v = value ?? blank(key);
  applying.set(key, JSON.stringify(v));
  await set({ [key]: v, syncMeta: { ...syncMeta, [key]: at } });
}

// First time on this computer: keep both sides.
function merge(key, local, remote) {
  if (isEmpty(key, remote)) return local;
  if (key === 'notes') {
    const a = (remote.text || '').trim();
    const b = (local.text || '').trim();
    if (!a || a.includes(b)) return remote;
    if (!b || b.includes(a)) return local;
    return { text: `${a}\n\n${b}`, updatedAt: Date.now() };
  }
  const seen = new Set(remote.map((x) => x.id));
  return [...remote, ...local.filter((x) => !seen.has(x.id))];
}

async function reconcileKey(key, all) {
  const { [key]: local, syncMeta = {} } = await get([key, 'syncMeta']);
  const l = syncMeta[key] || 0;
  const remote = readRemote(all, key);

  if (!remote) {
    if (all[PREFIX + key]) return; // still arriving
    if (isEmpty(key, local)) return;
    const at = l || Date.now();
    if (!l) await set({ syncMeta: { ...syncMeta, [key]: at } });
    await push(key, local, at);
    return;
  }

  if (!l && !isEmpty(key, local)) {
    const merged = merge(key, local, remote.value);
    const at = Date.now();
    await applyLocal(key, merged, at);
    await push(key, merged, at);
    return;
  }

  if (remote.at > l) await applyLocal(key, remote.value, remote.at);
  else if (l > remote.at) await push(key, local, l);
  else await setState({ error: null, at: Date.now() });
}

// Bring every synced value up to date (start-up, install, sync just turned on).
export function reconcileAll() {
  return enqueue(async () => {
    if (!(await enabled())) return;
    const all = await chrome.storage.sync.get(null);
    for (const key of SYNC_KEYS) await reconcileKey(key, all);
  });
}

// A synced value changed on this computer.
async function onLocalChange(changes) {
  const touched = SYNC_KEYS.filter((k) => changes[k]);
  if (!touched.length) return;
  const mine = touched.filter((k) => {
    const echo = applying.get(k);
    if (echo === undefined) return true;
    applying.delete(k);
    return echo !== JSON.stringify(changes[k].newValue ?? null);
  });
  // Changes made while sync is off aren't timed: turning sync on later merges instead.
  if (!mine.length || !(await enabled())) return;
  const { syncMeta = {} } = await get('syncMeta');
  const now = Date.now();
  for (const k of mine) syncMeta[k] = now;
  await set({ syncMeta });

  for (const k of mine) {
    clearTimeout(timers[k]);
    timers[k] = setTimeout(() => enqueue(async () => {
      if (!(await enabled())) return;
      const { [k]: value, syncMeta: m = {} } = await get([k, 'syncMeta']);
      await push(k, value, m[k] || Date.now());
    }), PUSH_DELAY);
  }
}

// Another computer wrote to Chrome sync.
function onRemoteChange(changes) {
  const keys = SYNC_KEYS.filter((k) => Object.keys(changes).some((c) => c === PREFIX + k || c.startsWith(`${PREFIX}${k}:`)));
  if (!keys.length) return;
  enqueue(async () => {
    if (!(await enabled())) return;
    const all = await chrome.storage.sync.get(null);
    for (const k of keys) await reconcileKey(k, all);
  });
}

export function initSync() {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'sync') { onRemoteChange(changes); return; }
    if (area !== 'local') return;
    onLocalChange(changes).catch((e) => console.warn('[Intent Tab] sync', e));
    // Sync turned on (here, or pulled in on a fresh install): catch up.
    if (changes.settings) {
      const was = !!(changes.settings.oldValue && changes.settings.oldValue.sync);
      const now = !!(changes.settings.newValue && changes.settings.newValue.sync);
      if (now && !was) reconcileAll();
      if (was && !now) enqueue(() => set({ syncMeta: {}, syncState: {} }));
    }
  });
}
