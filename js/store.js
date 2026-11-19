// Thin wrapper around chrome.storage.local plus shared helpers.
// Keys:
//   settings  – user preferences (see DEFAULT_SETTINGS)
//   intent    – { text, startedAt, endsAt } | null  (the running intent)
//   ask       – { lastTabAt, snoozeUntil, skipDay }
//   todos     – [{ id, text, done, createdAt, doneAt }]
//   days      – { 'YYYY-MM-DD': { tabs, intentTabs, intentsSet, intentsDone, todoDone, todoTotal } }

export const FOCUS_MS = 10 * 60 * 1000;      // focus timer length
export const BREAK_MS = 10 * 60 * 1000;      // Smart mode: gap that counts as a break
export const INTENT_MAX_AGE_MS = 2 * 60 * 60 * 1000; // a forgotten intent expires after 2h
const KEEP_DAYS = 60;

export const DEFAULT_SETTINGS = {
  askMode: 'smart', // smart | always | work | off
  workStart: '09:00',
  workEnd: '18:00',
  theme: 'auto', // auto | light | dark
  background: 'animated', // animated | still | plain
  ai: true, // use Chrome's on-device AI when available
  timerMin: 10, // default focus timer: 5 | 10 | 25 | 50
  lang: 'en', // en | bn – English by default, Bangla can be chosen in Settings
  notify: true, // desktop notification when the focus timer ends
  focusMode: false, // redirect distracting sites while an intent is running
  focusSites: [], // e.g. ['youtube.com', 'facebook.com']
  engine: 'google', // google | bing | duckduckgo | brave | youtube | perplexity | chatgpt
  accent: 'sage', // sage | ocean | violet | amber | rose
  bgDim: 0.25, // darkening over a background photo (0–0.7)
  sync: false, // copy settings to chrome.storage.sync (all your Chrome browsers)
  layout: null, // { left: [...cardIds], right: [...cardIds] } — card order
  modules: { todo: true, notes: true, bookmarks: true, topSites: true, report: true },
};

// Small breaks shouldn't trigger focus mode; matches the "Take a break" intents.
export const BREAK_RE = /break|rest|walk|relax|coffee|tea|stretch|বিরতি|বিশ্রাম/i;

export async function get(keys) {
  return chrome.storage.local.get(keys);
}

export async function set(obj) {
  return chrome.storage.local.set(obj);
}

export async function getSettings() {
  const { settings } = await get('settings');
  return {
    ...DEFAULT_SETTINGS,
    ...(settings || {}),
    modules: { ...DEFAULT_SETTINGS.modules, ...((settings && settings.modules) || {}) },
  };
}

export async function saveSettings(settings) {
  await set({ settings });
  // Optional: keep a copy in Chrome sync so other computers get the same setup.
  if (settings.sync && chrome.storage.sync) {
    try { await chrome.storage.sync.set({ settings: { ...settings, syncedAt: Date.now() } }); } catch (e) { console.warn('[Intent Tab] sync', e); }
  }
}

// At start-up: if sync is on (or this is a fresh install), take newer settings from Chrome sync.
export async function pullSyncedSettings(local) {
  if (!chrome.storage.sync) return local;
  try {
    const { settings: remote } = await chrome.storage.sync.get('settings');
    const { settings: stored } = await get('settings');
    if (!remote || !remote.sync) return local;
    if (stored && !stored.sync) return local;
    if (stored && (stored.syncedAt || 0) >= (remote.syncedAt || 0)) return local;
    const merged = { ...local, ...remote, modules: { ...local.modules, ...(remote.modules || {}) } };
    await set({ settings: merged });
    return merged;
  } catch {
    return local;
  }
}

// ---- dates ----
export function dayKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function daysAgo(n) {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return d;
}

export function emptyDay() {
  return { tabs: 0, intentTabs: 0, intentsSet: 0, intentsDone: 0, todoDone: 0, todoTotal: 0 };
}

// Read-modify-write one day's stats. Calls are queued so two updates
// from the same page never overwrite each other.
let dayQueue = Promise.resolve();
export function updateDay(fn, key = dayKey()) {
  const run = dayQueue.then(() => updateDayNow(fn, key));
  dayQueue = run.catch(() => {});
  return run;
}

async function updateDayNow(fn, key) {
  const { days = {} } = await get('days');
  const day = { ...emptyDay(), ...(days[key] || {}) };
  fn(day);
  days[key] = day;
  // prune old history
  const cutoff = dayKey(daysAgo(KEEP_DAYS));
  for (const k of Object.keys(days)) if (k < cutoff) delete days[k];
  await set({ days });
  return day;
}

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
