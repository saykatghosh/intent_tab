// Thin wrapper around chrome.storage.local plus shared helpers.
// Keys:
//   settings  – user preferences (see DEFAULT_SETTINGS)
//   intent    – { text, startedAt, endsAt } | null  (the running intent)
//   ask       – { lastTabAt, snoozeUntil, skipDay }
//   todos     – [{ id, text, done, createdAt, doneAt }]
//   days      – { 'YYYY-MM-DD': { tabs, intentTabs, intentsSet, intentsDone, todoDone, todoTotal, focusMs, focusSessions } }

export const FOCUS_MS = 10 * 60 * 1000;      // focus timer length
export const BREAK_MS = 10 * 60 * 1000;      // Smart mode: gap that counts as a break
export const INTENT_MAX_AGE_MS = 2 * 60 * 60 * 1000; // a forgotten intent expires after 2h
const KEEP_DAYS = 60;

export const DEFAULT_SETTINGS = {
  askMode: 'smart', // smart | always | work | off
  workStart: '09:00',
  workEnd: '18:00',
  theme: 'auto', // auto | light | dark
  background: 'cosmos', // cosmos | animated | still | plain | photo
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
  modules: { todo: true, notes: true, bookmarks: true, topSites: true, report: true, dev: true, robot: true },
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
  return { tabs: 0, intentTabs: 0, intentsSet: 0, intentsDone: 0, todoDone: 0, todoTotal: 0, focusMs: 0, focusSessions: 0 };
}

// Focus time: add the time spent on the current intent to the day it started.
// Called when an intent ends (Done, replaced, timer up). Counts only up to the
// timer's end, never twice (intent.creditedMs remembers what's already counted),
// and breaks don't count.
const FOCUS_CAP_MS = 4 * 60 * 60 * 1000;
export async function creditFocus(end = Date.now()) {
  const { intent } = await get('intent');
  if (!intent || !intent.text || !intent.startedAt) return;
  const spent = Math.min(FOCUS_CAP_MS, Math.max(0, Math.min(end, intent.endsAt || end) - intent.startedAt));
  const already = intent.creditedMs || 0;
  if (spent <= already) return;
  await set({ intent: { ...intent, creditedMs: spent } });
  if (BREAK_RE.test(intent.text)) return;
  if (!already && spent < 60 * 1000) return; // under a minute isn't a session
  await updateDay((d) => {
    d.focusMs = (d.focusMs || 0) + (spent - already);
    if (!already) d.focusSessions = (d.focusSessions || 0) + 1;
  }, dayKey(new Date(intent.startedAt)));
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

// Today's focus time, including the part of a running intent not yet counted.
export function focusTodayMs(days = {}, intent = null, now = Date.now()) {
  const today = dayKey(new Date(now));
  let ms = (days[today] && days[today].focusMs) || 0;
  if (intent && intent.text && intent.startedAt && !BREAK_RE.test(intent.text) && dayKey(new Date(intent.startedAt)) === today) {
    const spent = Math.min(FOCUS_CAP_MS, Math.max(0, Math.min(now, intent.endsAt || now) - intent.startedAt));
    if (spent >= 60000 || intent.creditedMs) ms += Math.max(0, spent - (intent.creditedMs || 0));
  }
  return ms;
}

// Short text for the toolbar badge: "35m", "1h05", "12h". Empty under a minute.
export function badgeText(ms) {
  const total = Math.floor(ms / 60000);
  if (total < 1) return '';
  if (total < 60) return `${total}m`;
  const h = Math.floor(total / 60);
  return h >= 10 ? `${h}h` : `${h}h${String(total % 60).padStart(2, '0')}`;
}

// What the toolbar icon shows: the countdown while a timer runs (orange, or blue
// for a break), otherwise today's total focus time (green).
export function badgeFor(days = {}, intent = null, now = Date.now()) {
  const focusMs = focusTodayMs(days, intent, now);
  if (intent && intent.text && intent.endsAt > now && (intent.startedAt || 0) <= now) {
    const leftMs = intent.endsAt - now;
    const min = Math.ceil(leftMs / 60000);
    const brk = BREAK_RE.test(intent.text);
    return { text: min > 99 ? `${Math.floor(min / 60)}h` : `${min}m`, color: brk ? '#5b7fb0' : '#d9822b', countdown: true, leftMs, focusMs };
  }
  return { text: badgeText(focusMs), color: '#2f8f6f', countdown: false, leftMs: 0, focusMs };
}

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
