// The toolbar popup: the focus timer, today's one thing, the to-do list,
// focus time and focus mode (the sites to block), with Intent the robot on top.
// While the timer runs, the background shows the minutes left on the icon.
// It reads and writes the same chrome.storage keys as the new tab page, so
// both stay in step (and Chrome sync picks up changes made here too).

import { get, set, getSettings, saveSettings, updateDay, dayKey, uid, creditFocus, BREAK_RE, FOCUS_MS, INTENT_MAX_AGE_MS, focusTodayMs, badgeFor } from './store.js';
import { t, setLang, applyStrings, digits } from './strings.js';
import { ROBOT_SVG, HANDS_SVG } from './robot-svg.js';
import { pendingUpdate, buildNotice } from './update.js';

const $ = (id) => document.getElementById(id);
// Opened as the floating panel on a web page (inside an iframe) rather than the popup.
const EMBED = new URLSearchParams(location.search).has('embed');
const ADD_MS = 5 * 60 * 1000;
const HISTORY_MAX = 80;
const TIMER_CHOICES = [5, 10, 25, 50];

const state = {
  settings: null,
  intent: null,
  todos: [],
  focus: null,     // today's one thing: { day, text, done } | { day, skipped } | null
  days: {},
  editingOne: false,
  tipIndex: 0,
  sayKey: '',
  minutes: 25,     // the length picked for the next focus timer
  granted: [],     // origins Chrome has allowed (focus mode needs them per site)
};

// ---------- rules (same as the new tab page) ----------
function intentActive(intent, now = Date.now()) {
  if (!intent || !intent.text) return false;
  if (dayKey(new Date(intent.startedAt)) !== dayKey(new Date(now))) return false;
  const expiresAt = Math.max(intent.startedAt + INTENT_MAX_AGE_MS, (intent.endsAt || 0) + 30 * 60 * 1000);
  return now < expiresAt;
}
const isBreak = (text) => BREAK_RE.test(text || '') || text === t('chipBreak');

function cleanTodos(list) {
  const today = dayKey();
  return (list || []).filter((x) => !x.done || dayKey(new Date(x.doneAt)) === today);
}

function todayFocus(f) {
  return f && f.day === dayKey() ? f : null;
}

function fmtDur(ms) {
  const total = Math.round(ms / 60000);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return digits(h ? t('durHM', { h, m }) : t('durM', { m }));
}

function fmtClock(ms) {
  const s = Math.ceil(ms / 1000);
  return digits(`${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`);
}

// ---------- theme ----------
function applyLook(s) {
  const root = document.documentElement;
  if (s.theme === 'light' || s.theme === 'dark') root.dataset.theme = s.theme; else delete root.dataset.theme;
  if (s.accent && s.accent !== 'sage') root.dataset.accent = s.accent; else delete root.dataset.accent;
}

// =========================================================
// Intent
// =========================================================
async function setIntent(text, minutes) {
  text = String(text || '').trim();
  if (!text) return;
  const now = Date.now();
  const min = minutes || (isBreak(text) ? 5 : Number(state.settings.timerMin) || FOCUS_MS / 60000);
  await creditFocus(); // the intent being replaced
  state.intent = { text, startedAt: now, endsAt: now + min * 60 * 1000 };
  await set({ intent: state.intent });
  await updateDay((d) => { d.intentsSet += 1; });
  const { history = [] } = await get('history');
  history.push({ text, at: now, done: false });
  await set({ history: history.slice(-HISTORY_MAX) });
  render();
  const [key, vars] = tips()[0];
  robotSay(key, vars, 'is-wave');
}

async function markDone() {
  const it = state.intent;
  if (!it) return;
  const { history = [] } = await get('history');
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].text === it.text && !history[i].done) { history[i].done = true; break; }
  }
  await creditFocus();
  state.intent = null;
  await set({ intent: null, history });
  // Count it on the day it was set, so a late-night intent never shows "1 of 0".
  await updateDay((d) => { d.intentsDone += 1; }, dayKey(new Date(it.startedAt || Date.now())));
  render();
  robotSay('tabiNice', {}, 'is-cheer');
}

async function addTime() {
  if (!state.intent) return;
  state.intent = { ...state.intent, endsAt: Math.max(Date.now(), state.intent.endsAt) + ADD_MS, notified: null };
  await set({ intent: state.intent });
  render();
}

// Start a focus timer from the popup (no intent text needed).
function startTimer() {
  return setIntent(t('popFocusSession'), state.minutes);
}

async function stopTimer() {
  await creditFocus();
  state.intent = null;
  await set({ intent: null });
  render();
  pickTip();
}

function renderIntent() {
  const running = intentActive(state.intent);
  $('popIntentRun').hidden = !running;
  $('popTimerPick').hidden = running;
  if (running) $('popIntentText').textContent = state.intent.text;
  else renderDurations();
  tick();
}

function renderDurations() {
  const box = $('popDurs');
  box.textContent = '';
  for (const n of TIMER_CHOICES) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'pop-dur';
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-checked', String(n === state.minutes));
    b.textContent = t('minShort', { n });
    b.addEventListener('click', () => { state.minutes = n; renderDurations(); });
    box.append(b);
  }
  $('popStart').textContent = `${t('tabiStart')} · ${t('minShort', { n: state.minutes })}`;
}

// The toolbar icon: countdown while a timer runs, otherwise today's focus time.
// The background keeps it up to date; setting it here keeps it exact while open.
let lastBadge = null;
function setBadge(b) {
  const key = b.text + b.color;
  if (key === lastBadge || !chrome.action || !chrome.action.setBadgeText) return;
  lastBadge = key;
  chrome.action.setBadgeBackgroundColor({ color: b.color }).catch(() => {});
  chrome.action.setBadgeText({ text: b.text }).catch(() => {});
}

// Timer and focus time, every second.
function tick() {
  const it = state.intent;
  const now = Date.now();
  if (intentActive(it, now)) {
    const total = Math.max(1, it.endsAt - it.startedAt);
    const left = Math.max(0, it.endsAt - now);
    $('popTimerBar').style.width = (100 * (1 - left / total)).toFixed(1) + '%';
    const up = left <= 0;
    $('popTimerText').textContent = up ? t('timeUp') : t('popLeft', { time: fmtClock(left) });
    $('popTimerText').classList.toggle('is-up', up);
    $('popAddTime').hidden = !up;
  }
  // Focus time today, including the intent that is running right now.
  const ms = focusTodayMs(state.days, it, now);
  setBadge(badgeFor(state.days, it, now));
  $('popFocusTime').textContent = ms >= 60000 ? fmtDur(ms) : fmtDur(0);
  $('popFocusTime').title = t('idleFocusLabel');
}

// =========================================================
// Today's one thing
// =========================================================
async function saveOne(text) {
  text = String(text || '').trim();
  state.editingOne = false;
  if (!text) { renderOne(); return; }
  state.focus = { day: dayKey(), text, done: false };
  await set({ focus: state.focus });
  renderOne();
  robotSay('tabiFocus', { text });
}

async function toggleOne() {
  const f = todayFocus(state.focus);
  if (!f || !f.text) return;
  state.focus = { ...f, done: !f.done };
  await set({ focus: state.focus });
  renderOne();
  if (state.focus.done) robotSay('tabiNice', {}, 'is-cheer');
}

function renderOne() {
  const f = todayFocus(state.focus);
  const has = !!(f && f.text);
  const show = has && !state.editingOne;
  $('popOneShow').hidden = !show;
  $('popOneForm').hidden = show;
  $('popOne').classList.toggle('is-done', !!(has && f.done));
  if (has) {
    $('popOneText').textContent = f.text;
    $('popOneDone').setAttribute('aria-checked', String(!!f.done));
    $('popOneDone').setAttribute('aria-label', f.done ? t('palFocusUndone') : t('palFocusDone'));
    $('popOneText').title = t('focusEdit');
  }
}

// =========================================================
// To-do
// =========================================================
async function saveTodos() {
  const total = state.todos.length;
  const done = state.todos.filter((x) => x.done).length;
  await set({ todos: state.todos });
  await updateDay((d) => { d.todoDone = done; d.todoTotal = total; });
}

async function addTodo(text) {
  text = String(text || '').trim();
  if (!text) return;
  state.todos.push({ id: uid(), text, done: false, createdAt: Date.now(), doneAt: null });
  await saveTodos();
  renderTodos();
  pickTip();
}

async function toggleTodo(id) {
  const item = state.todos.find((x) => x.id === id);
  if (!item) return;
  item.done = !item.done;
  item.doneAt = item.done ? Date.now() : null;
  await saveTodos();
  renderTodos();
  if (item.done) {
    const left = state.todos.some((x) => !x.done);
    robotSay(left ? 'tabiNice' : 'tabiAllDone', {}, 'is-cheer');
  } else pickTip();
}

async function deleteTodo(id) {
  state.todos = state.todos.filter((x) => x.id !== id);
  await saveTodos();
  renderTodos();
}

function renderTodos() {
  const list = $('popTodoList');
  list.textContent = '';
  const next = state.todos.find((x) => !x.done);
  for (const item of state.todos) {
    const li = document.createElement('li');
    if (item.done) li.className = 'is-done';
    else if (next && item.id === next.id) li.className = 'is-next';

    const cb = document.createElement('button');
    cb.type = 'button';
    cb.className = 'pop-check';
    cb.setAttribute('role', 'checkbox');
    cb.setAttribute('aria-checked', String(item.done));
    cb.setAttribute('aria-label', item.text);
    cb.addEventListener('click', () => toggleTodo(item.id));

    const txt = document.createElement('span');
    txt.className = 'txt';
    txt.textContent = item.text;
    txt.addEventListener('click', () => toggleTodo(item.id));

    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'pop-del';
    del.title = t('todoDelete');
    del.setAttribute('aria-label', t('todoDelete'));
    del.innerHTML = '<svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg>';
    del.addEventListener('click', () => deleteTodo(item.id));

    li.append(cb, txt, del);
    list.append(li);
  }
  const total = state.todos.length;
  const done = state.todos.filter((x) => x.done).length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  $('popTodoEmpty').hidden = total > 0;
  $('popTodoBar').style.width = pct + '%';
  $('popTodoCount').textContent = total ? digits(`${done}/${total}`) : '';
}

// =========================================================
// Focus mode: the sites to block
// =========================================================
function cleanDomain(raw) {
  let v = String(raw || '').trim().toLowerCase();
  if (!v) return '';
  v = v.replace(/^[a-z]+:\/\//, '').replace(/^www\./, '').split(/[/?#:]/)[0];
  return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(v) ? v : '';
}
const originsFor = (d) => [`*://${d}/*`, `*://*.${d}/*`];
const isGranted = (d) => originsFor(d).every((o) => state.granted.includes(o));

async function loadGranted() {
  try { state.granted = (await chrome.permissions.getAll()).origins || []; } catch { state.granted = []; }
}

// Chrome asks once per site. The popup may close while Chrome shows its question,
// so the site is saved first; the background picks it up once it's allowed.
async function askFor(domains) {
  try { return await chrome.permissions.request({ origins: domains.flatMap(originsFor) }); } catch { return false; }
}

async function saveFocus(patch) {
  const s = await getSettings();
  state.settings = { ...s, ...patch };
  await saveSettings(state.settings);
  renderFocusMode();
}

async function addSite(raw) {
  const d = cleanDomain(raw);
  const err = $('popSiteError');
  if (!d) { err.textContent = t('focusSiteInvalid'); err.hidden = false; return; }
  err.hidden = true;
  $('popSiteInput').value = '';
  const sites = state.settings.focusSites || [];
  if (!sites.includes(d)) await saveFocus({ focusSites: [...sites, d], focusMode: true });
  else if (!state.settings.focusMode) await saveFocus({ focusMode: true });
  if (!isGranted(d)) {
    await askFor([d]);
    await loadGranted();
    renderFocusMode();
  }
}

async function removeSite(d) {
  await saveFocus({ focusSites: (state.settings.focusSites || []).filter((v) => v !== d) });
  chrome.permissions.remove({ origins: originsFor(d) }).catch(() => {});
}

async function toggleFocusMode(on) {
  const sites = state.settings.focusSites || [];
  if (on && !sites.length) { $('popFocusMode').checked = false; $('popSiteInput').focus(); return; }
  await saveFocus({ focusMode: on });
  const missing = sites.filter((d) => !isGranted(d));
  if (on && missing.length) { await askFor(missing); await loadGranted(); renderFocusMode(); }
}

function renderFocusMode() {
  const s = state.settings;
  const sites = s.focusSites || [];
  $('popFocusMode').checked = !!s.focusMode;
  const names = sites.slice(0, 2).join(', ') + (sites.length > 2 ? ` +${digits(String(sites.length - 2))}` : '');
  $('popFocusSites').textContent = !sites.length ? t('popFocusNoSites')
    : s.focusMode ? t('popFocusOnNote', { sites: names }) : t('popFocusOffNote', { sites: names });

  const list = $('popSiteList');
  list.textContent = '';
  for (const d of sites) {
    const li = document.createElement('li');
    li.className = 'pop-site' + (isGranted(d) ? '' : ' is-pending');
    const name = document.createElement('span');
    name.textContent = d;
    li.append(name);
    if (!isGranted(d)) {
      const ok = document.createElement('button');
      ok.type = 'button';
      ok.className = 'pop-site-allow';
      ok.textContent = t('popSiteAllow');
      ok.title = t('popSiteAllowTitle');
      ok.addEventListener('click', async () => { await askFor([d]); await loadGranted(); renderFocusMode(); });
      li.append(ok);
    }
    const x = document.createElement('button');
    x.type = 'button';
    x.className = 'pop-site-x';
    x.setAttribute('aria-label', t('popSiteRemove', { site: d }));
    x.title = t('popSiteRemove', { site: d });
    x.innerHTML = '<svg viewBox="0 0 24 24" width="11" height="11" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>';
    x.addEventListener('click', () => removeSite(d));
    li.append(x);
    list.append(li);
  }
}

// =========================================================
// Intent, the robot
// =========================================================
let moodTimer = 0;

function robotSay(key, vars = {}, mood = '') {
  const p = $('popSay');
  const text = t(key, vars);
  if (p.textContent !== text) {
    p.textContent = text;
    p.classList.remove('is-pop');
    void p.offsetWidth;
    p.classList.add('is-pop');
  }
  state.sayKey = key;
  const robot = $('popRobot');
  robot.classList.remove('is-wave', 'is-cheer');
  clearTimeout(moodTimer);
  if (mood) {
    void robot.offsetWidth;
    robot.classList.add(mood);
    moodTimer = setTimeout(() => robot.classList.remove(mood), 1800);
  }
  robot.classList.toggle('is-watch', intentActive(state.intent) && state.intent.endsAt > Date.now());
}

// What the robot can say right now, most useful first.
function tips() {
  const out = [];
  const it = state.intent;
  if (intentActive(it)) {
    if (it.endsAt <= Date.now()) out.push(['timeUp', {}]);
    else if (isBreak(it.text)) out.push(['tabiBreak', {}]);
    else if (it.text === t('popFocusSession')) out.push(['popWatching', {}]);
    else out.push(['tabiWatching', { text: it.text }]);
  }
  const f = todayFocus(state.focus);
  if (f && f.text && !f.done && !intentActive(it)) out.push(['tabiFocus', { text: f.text }]);
  const next = state.todos.find((x) => !x.done);
  if (next) out.push(['tabiDoThis', { text: next.text }]);
  else if (state.todos.length) out.push(['tabiAllDone', {}]);
  else out.push(['tabiEmpty', {}]);
  out.push(['tabiHello', {}]);
  return out;
}

function pickTip() {
  const [key, vars] = tips()[0];
  robotSay(key, vars);
}

function nextTip() {
  const list = tips();
  state.tipIndex = (state.tipIndex + 1) % list.length;
  const [key, vars] = list[state.tipIndex];
  robotSay(key, vars, 'is-wave');
}

function initRobot() {
  const robot = $('popRobot');
  robot.innerHTML = ROBOT_SVG;
  $('popHands').innerHTML = HANDS_SVG;
  robot.addEventListener('click', nextTip);
  // Eyes follow the mouse inside the popup.
  document.addEventListener('mousemove', (e) => {
    const r = robot.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2);
    const dy = e.clientY - (r.top + r.height * 0.4);
    const len = Math.hypot(dx, dy) || 1;
    const k = Math.min(1, len / 140);
    robot.style.setProperty('--look-x', ((dx / len) * 3 * k).toFixed(2) + 'px');
    robot.style.setProperty('--look-y', ((dy / len) * 3 * k).toFixed(2) + 'px');
    robot.style.setProperty('--tilt', ((dx / len) * 5 * k).toFixed(1) + 'deg');
  }, { passive: true });
}

// =========================================================
// Wiring
// =========================================================
function render() {
  renderIntent();
  renderOne();
  renderTodos();
  renderFocusMode();
}

// Close the popup, or ask the page to remove the floating panel.
function closeMe() {
  if (EMBED) window.parent.postMessage({ intentTabPanel: 'close' }, '*');
  else window.close();
}

function openSettings() {
  chrome.tabs.create({ url: 'newtab.html#settings' });
  closeMe();
}

// Floating panel: header moves inside the panel, a close button appears, and the
// page is told how tall the panel is so its frame fits.
function initEmbed() {
  document.documentElement.classList.add('is-embed');
  const panel = document.querySelector('.pop-panel');
  panel.prepend(document.querySelector('.pop-head'));
  $('popClose').hidden = false;
  $('popClose').addEventListener('click', closeMe);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMe(); });
  const report = () => window.parent.postMessage({ intentTabPanel: 'size', h: Math.ceil(document.documentElement.scrollHeight) }, '*');
  new ResizeObserver(report).observe(document.body);
  report();
}

function bindEvents() {
  $('popStart').addEventListener('click', startTimer);
  $('popDone').addEventListener('click', markDone);
  $('popAddTime').addEventListener('click', addTime);
  $('popStop').addEventListener('click', stopTimer);

  $('popOneForm').addEventListener('submit', (e) => { e.preventDefault(); saveOne($('popOneInput').value); });
  $('popOneInput').addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && state.editingOne) { e.preventDefault(); state.editingOne = false; renderOne(); }
  });
  $('popOneDone').addEventListener('click', toggleOne);
  $('popOneText').addEventListener('click', () => {
    const f = todayFocus(state.focus);
    state.editingOne = true;
    renderOne();
    $('popOneInput').value = f && f.text ? f.text : '';
    $('popOneInput').focus();
  });

  $('popTodoForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const v = $('popTodoInput').value;
    $('popTodoInput').value = '';
    addTodo(v);
  });

  $('popFocusMode').addEventListener('change', (e) => toggleFocusMode(e.target.checked));
  $('popSiteForm').addEventListener('submit', (e) => { e.preventDefault(); addSite($('popSiteInput').value); });
  chrome.permissions.onAdded.addListener(async () => { await loadGranted(); renderFocusMode(); });
  $('popOpenTab').addEventListener('click', () => { chrome.tabs.create({}); closeMe(); });
  $('popSettings').addEventListener('click', openSettings);

  // Changes from the new tab page (or another computer through sync) show up here at once.
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes.intent) { state.intent = changes.intent.newValue || null; renderIntent(); }
    if (changes.todos) {
      const next = cleanTodos(changes.todos.newValue);
      if (JSON.stringify(next) !== JSON.stringify(state.todos)) { state.todos = next; renderTodos(); }
    }
    if (changes.focus && !state.editingOne) { state.focus = changes.focus.newValue || null; renderOne(); }
    if (changes.days) { state.days = changes.days.newValue || {}; tick(); }
    if (changes.settings) {
      state.settings = { ...state.settings, ...(changes.settings.newValue || {}) };
      applyLook(state.settings);
      renderFocusMode();
    }
  });
}

async function init() {
  state.settings = await getSettings();
  setLang(state.settings.lang);
  applyStrings();
  document.title = 'Intent Tab';
  applyLook(state.settings);
  state.minutes = TIMER_CHOICES.includes(Number(state.settings.timerMin)) ? Number(state.settings.timerMin) : 25;
  await loadGranted();

  const data = await get(['intent', 'todos', 'focus', 'days']);
  state.intent = data.intent || null;
  state.todos = cleanTodos(data.todos);
  state.focus = data.focus || null;
  state.days = data.days || {};

  if (EMBED) initEmbed();
  initRobot();
  bindEvents();
  render();

  const update = await pendingUpdate().catch(() => null);
  if (update) {
    const card = buildNotice(update);
    const head = document.querySelector('.pop-panel > .pop-head');
    if (head) head.after(card); else document.querySelector('.pop-panel').prepend(card);
  }
  setInterval(tick, 1000);

  // Say hello the first time today, then something useful.
  const first = tips()[0];
  if (first[0] === 'tabiHello') robotSay('tabiHello', {}, 'is-wave');
  else robotSay(first[0], first[1], 'is-wave');

}

init().catch((err) => console.warn('[Intent Tab] popup', err));
