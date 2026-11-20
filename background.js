// Intent Tab service worker. Runs in the background (no page needed) for:
//   • Focus mode  – while it's on, chosen sites redirect to a calm "blocked" page
//   • Badge       – today's focus time on the toolbar icon
//   • Panel       – clicking the icon opens a floating panel on the page
//   • Notification – "Time's up" when the focus timer ends (with Done / +5 min)
//   • Focus sounds – rain / ocean / fan, played from an offscreen document
//   • Data sync    – to-dos, notes and projects through Chrome sync (js/sync.js)
// Everything is driven by chrome.storage, so the new-tab page just writes data.

import { get, set, getSettings, updateDay, dayKey, BREAK_RE, creditFocus, badgeFor } from './js/store.js';
import { t, setLang, digits } from './js/strings.js';
import { initSync, reconcileAll } from './js/sync.js';

const RULE_BASE = 1000;
const ALARM_SYNC = 'focus-sync';
const ALARM_END = 'intent-end';
const ALARM_BADGE = 'badge';
const NOTIFY_ID = 'intent-end';

async function loadLang() {
  const s = await getSettings();
  setLang(s.lang);
  return s;
}

function isRunning(intent, now = Date.now()) {
  return !!(intent && intent.text && now < intent.endsAt);
}

function isBreak(text) {
  return BREAK_RE.test(text || '');
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function originsFor(domain) {
  return [`*://${domain}/*`, `*://*.${domain}/*`];
}

// =========================================================
// Focus mode rules
// =========================================================
async function syncRules() {
  const s = await getSettings();
  const { intent, focusAllow = {} } = await get(['intent', 'focusAllow']);
  const now = Date.now();
  let domains = [];

  // Focus mode on = the listed sites are blocked (except during a break).
  const onBreak = isRunning(intent, now) && isBreak(intent.text);
  if (s.focusMode && !onBreak) {
    const { origins = [] } = await chrome.permissions.getAll();
    domains = (s.focusSites || [])
      .filter((d) => !(focusAllow[d] > now))
      .filter((d) => originsFor(d).every((o) => origins.includes(o)));
  }

  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  const page = chrome.runtime.getURL('blocked.html');
  const addRules = domains.map((d, i) => ({
    id: RULE_BASE + i,
    priority: 1,
    action: { type: 'redirect', redirect: { regexSubstitution: `${page}?u=\\1` } },
    condition: {
      regexFilter: `^(https?://([^/?#]*\\.)?${escapeRegex(d)}([:/?#].*)?)$`,
      resourceTypes: ['main_frame'],
    },
  }));
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: existing.map((r) => r.id),
    addRules,
  });

  // Wake up again when something changes on its own: the timer ends or a "5 more minutes" runs out.
  const times = [];
  if (isRunning(intent, now)) times.push(intent.endsAt);
  Object.values(focusAllow).forEach((until) => { if (until > now) times.push(until); });
  await chrome.alarms.clear(ALARM_SYNC);
  if (times.length) chrome.alarms.create(ALARM_SYNC, { when: Math.min(...times) + 500 });
}

// =========================================================
// "Time's up" notification
// =========================================================
async function scheduleEnd() {
  const { intent } = await get('intent');
  await chrome.alarms.clear(ALARM_END);
  if (isRunning(intent) && intent.notified !== intent.endsAt) {
    chrome.alarms.create(ALARM_END, { when: intent.endsAt });
  }
}

async function notifyEnd() {
  await creditFocus(); // count the focus time even if no tab is open
  const s = await loadLang();
  const { intent } = await get('intent');
  if (!intent || !intent.text || intent.notified === intent.endsAt) return;
  if (Math.abs(Date.now() - intent.endsAt) > 2 * 60 * 1000) return; // stale alarm
  await set({ intent: { ...intent, notified: intent.endsAt } });
  if (!s.notify) return;
  const brk = isBreak(intent.text);
  chrome.notifications.create(NOTIFY_ID, {
    type: 'basic',
    iconUrl: 'icons/icon128.png',
    title: brk ? t('notifyBreakTitle') : t('notifyTitle'),
    message: brk ? t('notifyBreakBody') : intent.text,
    buttons: brk ? [{ title: t('newIntent') }] : [{ title: t('done') }, { title: t('addTime') }],
    priority: 1,
  });
}

async function markDone() {
  const { intent, history = [] } = await get(['intent', 'history']);
  if (!intent) return;
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].text === intent.text && !history[i].done) { history[i].done = true; break; }
  }
  await creditFocus();
  await set({ intent: null, history });
  // Count it on the day it was set, so a late-night intent never shows "1 of 0".
  await updateDay((d) => { d.intentsDone += 1; }, dayKey(new Date(intent.startedAt || Date.now())));
}

async function addFive() {
  const { intent } = await get('intent');
  if (!intent) return;
  await set({ intent: { ...intent, endsAt: Math.max(Date.now(), intent.endsAt) + 5 * 60 * 1000, notified: null } });
}

chrome.notifications.onButtonClicked.addListener(async (id, index) => {
  if (id !== NOTIFY_ID) return;
  chrome.notifications.clear(id);
  const { intent } = await get('intent');
  if (intent && isBreak(intent.text)) {
    await set({ intent: null });
    chrome.tabs.create({});
    return;
  }
  if (index === 0) await markDone();
  else await addFive();
});

chrome.notifications.onClicked.addListener((id) => {
  if (id !== NOTIFY_ID) return;
  chrome.notifications.clear(id);
  chrome.tabs.create({}); // opens Intent Tab
});

// =========================================================
// Badge: the countdown while a timer runs, otherwise today's focus time
// =========================================================
function fmtDur(ms) {
  const total = Math.round(ms / 60000);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return digits(h ? t('durHM', { h, m }) : t('durM', { m }));
}

async function syncBadge() {
  await loadLang();
  const { intent, days = {} } = await get(['intent', 'days']);
  const b = badgeFor(days, intent);
  await chrome.action.setBadgeBackgroundColor({ color: b.color });
  if (chrome.action.setBadgeTextColor) await chrome.action.setBadgeTextColor({ color: '#ffffff' });
  await chrome.action.setBadgeText({ text: b.text });
  // Hovering the icon tells both: time left and today's total.
  await chrome.action.setTitle({ title: b.countdown
    ? t('badgeTitleTimer', { left: fmtDur(b.leftMs), total: fmtDur(b.focusMs) })
    : t('badgeTitle', { total: fmtDur(b.focusMs) }) });
  // While a timer runs the numbers change, so refresh every 30 s (the shortest alarm
  // Chrome allows). Otherwise refresh once at midnight, when the day starts over.
  const running = isRunning(intent);
  const a = await chrome.alarms.get(ALARM_BADGE);
  if (running && !(a && a.periodInMinutes)) chrome.alarms.create(ALARM_BADGE, { periodInMinutes: 0.5 });
  if (!running) {
    const midnight = new Date();
    midnight.setHours(24, 0, 5, 0);
    chrome.alarms.create(ALARM_BADGE, { when: midnight.getTime() });
  }
}

// =========================================================
// Toolbar click: a floating panel on the page (the popup where pages can't have one)
// =========================================================
chrome.action.onClicked.addListener(async (tab) => {
  try {
    if (!tab || !tab.id || !/^https?:|^file:/.test(tab.url || '')) throw new Error('not a web page');
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['js/panel-inject.js'] });
  } catch {
    // chrome:// pages, the Web Store, the new tab page…: open the regular popup instead.
    try {
      await chrome.action.setPopup({ tabId: tab.id, popup: 'popup.html' });
      await chrome.action.openPopup({ windowId: tab.windowId });
    } catch {
      chrome.tabs.create({});
    } finally {
      setTimeout(() => chrome.action.setPopup({ tabId: tab.id, popup: '' }).catch(() => {}), 500);
    }
  }
});

// =========================================================
// Focus sounds (offscreen document plays Web Audio)
// =========================================================
let creating = null;

async function hasOffscreen() {
  if (chrome.runtime.getContexts) {
    const ctx = await chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'] });
    return ctx.length > 0;
  }
  return false;
}

async function ensureOffscreen() {
  if (await hasOffscreen()) return;
  if (!creating) {
    creating = chrome.offscreen.createDocument({
      url: 'offscreen.html',
      reasons: ['AUDIO_PLAYBACK'],
      justification: 'Plays optional ambient focus sounds (rain, ocean, fan) chosen by the user.',
    }).finally(() => { creating = null; });
  }
  await creating;
}

async function syncSound() {
  const { sound = { kind: 'off', volume: 0.5 }, intent } = await get(['sound', 'intent']);
  // Sounds play only while an intent (focus or break) is running.
  const want = sound.kind && sound.kind !== 'off' && isRunning(intent) ? sound.kind : 'off';
  if (want === 'off') {
    if (await hasOffscreen()) {
      try { await chrome.runtime.sendMessage({ target: 'offscreen', type: 'stop' }); } catch { /* ignore */ }
      setTimeout(async () => { if (await hasOffscreen()) { const { sound: s2 } = await get('sound'); if (!s2 || s2.kind === 'off' || !isRunning((await get('intent')).intent)) chrome.offscreen.closeDocument().catch(() => {}); } }, 1800);
    }
    return;
  }
  await ensureOffscreen();
  try {
    await chrome.runtime.sendMessage({ target: 'offscreen', type: 'play', kind: want, volume: sound.volume ?? 0.5 });
  } catch (err) {
    console.warn('[Intent Tab] sound', err);
  }
}

// =========================================================
// Wiring
// =========================================================
async function syncAll() {
  await Promise.allSettled([syncRules(), scheduleEnd(), syncSound(), syncBadge()]);
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  if (changes.intent || changes.settings || changes.focusAllow) {
    syncRules().catch((e) => console.warn('[Intent Tab] rules', e));
  }
  if (changes.intent) scheduleEnd();
  if (changes.intent || changes.days) syncBadge();
  if (changes.intent || changes.sound) syncSound();
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === ALARM_END) {
    await notifyEnd();
    await syncRules();
    await syncSound();
  }
  if (alarm.name === ALARM_BADGE) {
    await syncBadge();
    return;
  }
  if (alarm.name === ALARM_SYNC) {
    await syncRules();
    await syncSound();
  }
});

chrome.permissions.onAdded.addListener(() => syncRules());
chrome.permissions.onRemoved.addListener(() => syncRules());
chrome.runtime.onStartup.addListener(syncAll);
chrome.runtime.onInstalled.addListener(syncAll);

// To-dos, notes and projects through Chrome sync (when turned on in Settings).
initSync();
chrome.runtime.onStartup.addListener(reconcileAll);
chrome.runtime.onInstalled.addListener(reconcileAll);
