// The toolbar popup: the running intent and its timer, today's one thing,
// the to-do list, focus time and focus mode, with Intent the robot on top.
// It reads and writes the same chrome.storage keys as the new tab page, so
// both stay in step (and Chrome sync picks up changes made here too).

import { get, set, getSettings, saveSettings, updateDay, dayKey, uid, creditFocus, BREAK_RE, FOCUS_MS, INTENT_MAX_AGE_MS } from './store.js';
import { t, setLang, applyStrings, digits } from './strings.js';
import { ROBOT_SVG } from './robot-svg.js';

const $ = (id) => document.getElementById(id);
const ADD_MS = 5 * 60 * 1000;
const HISTORY_MAX = 80;

const state = {
  settings: null,
  intent: null,
  todos: [],
  focus: null,     // today's one thing: { day, text, done } | { day, skipped } | null
  days: {},
  editingOne: false,
  tipIndex: 0,
  sayKey: '',
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
async function setIntent(text) {
  text = String(text || '').trim();
  if (!text) return;
  const now = Date.now();
  const min = isBreak(text) ? 5 : Number(state.settings.timerMin) || FOCUS_MS / 60000;
  await creditFocus(); // the intent being replaced
  state.intent = { text, startedAt: now, endsAt: now + min * 60 * 1000 };
  await set({ intent: state.intent });
  await updateDay((d) => { d.intentsSet += 1; });
  const { history = [] } = await get('history');
  history.push({ text, at: now, done: false });
  await set({ history: history.slice(-HISTORY_MAX) });
  render();
  robotSay('tabiWatching', { text }, 'is-wave');
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

async function newIntent() {
  await creditFocus();
  state.intent = null;
  await set({ intent: null });
  render();
  $('popIntentInput').focus();
}

function renderIntent() {
  const running = intentActive(state.intent);
  $('popIntentRun').hidden = !running;
  $('popIntentForm').hidden = running;
  if (running) $('popIntentText').textContent = state.intent.text;
  tick();
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
  const d = state.days[dayKey()] || {};
  let ms = d.focusMs || 0;
  if (it && it.text && !isBreak(it.text) && it.startedAt && dayKey(new Date(it.startedAt)) === dayKey()) {
    const spent = Math.max(0, Math.min(now, it.endsAt || now) - it.startedAt);
    if (spent >= 60000 || it.creditedMs) ms += Math.max(0, spent - (it.creditedMs || 0));
  }
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
// Focus mode
// =========================================================
function renderFocusMode() {
  const s = state.settings;
  const sites = s.focusSites || [];
  $('popFocusMode').checked = !!s.focusMode;
  $('popFocusSites').textContent = sites.length
    ? sites.slice(0, 2).join(', ') + (sites.length > 2 ? ` +${digits(String(sites.length - 2))}` : '')
    : t('popFocusNoSites');
}

async function toggleFocusMode(on) {
  const s = await getSettings();
  if (on && !(s.focusSites || []).length) {
    $('popFocusMode').checked = false;
    openSettings();
    return;
  }
  state.settings = { ...s, focusMode: on };
  await saveSettings(state.settings);
  renderFocusMode();
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

function openSettings() {
  chrome.tabs.create({ url: 'newtab.html#settings' });
  window.close();
}

function bindEvents() {
  $('popIntentForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const v = $('popIntentInput').value;
    $('popIntentInput').value = '';
    setIntent(v);
  });
  $('popDone').addEventListener('click', markDone);
  $('popAddTime').addEventListener('click', addTime);
  $('popNewIntent').addEventListener('click', newIntent);

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
  $('popOpenTab').addEventListener('click', () => { chrome.tabs.create({}); window.close(); });
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

  const data = await get(['intent', 'todos', 'focus', 'days']);
  state.intent = data.intent || null;
  state.todos = cleanTodos(data.todos);
  state.focus = data.focus || null;
  state.days = data.days || {};

  initRobot();
  bindEvents();
  render();
  setInterval(tick, 1000);

  // Say hello the first time today, then something useful.
  const first = tips()[0];
  if (first[0] === 'tabiHello') robotSay('tabiHello', {}, 'is-wave');
  else robotSay(first[0], first[1], 'is-wave');

  if (!intentActive(state.intent)) $('popIntentInput').focus();
}

init().catch((err) => console.warn('[Intent Tab] popup', err));
