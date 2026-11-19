import { get, set, updateDay, dayKey, FOCUS_MS, BREAK_MS, INTENT_MAX_AGE_MS } from './store.js';
import { t, digits } from './strings.js';
import { transition, revealText, burstFrom } from './effects.js';
import { renderSuggestions, renderCoach, recordIntent, recordIntentDone, category } from './assistant.js';
import { startBreathing, stopBreathing } from './breathe.js';
import { registerCommands } from './palette.js';

const TIMER_CHOICES = [5, 10, 25, 50];

const CHIP_KEYS = ['chipEmail', 'chipResearch', 'chipBreak', 'chipUnsure'];
const CHIP_ICONS = {
  chipEmail: '<path d="M4 6h16v12H4z M4 7l8 6 8-6"/>',
  chipResearch: '<path d="M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14z M20 20l-4-4"/>',
  chipBreak: '<path d="M5 9h11v5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5z M16 10h2a2 2 0 0 1 0 4h-2 M8 3v3 M11 3v3"/>',
  chipUnsure: '<path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14 M12 17.5h.01"/>',
};
const ADD_MS = 5 * 60 * 1000;
const RING_LEN = 2 * Math.PI * 19; // r=19 in the SVG

const $ = (id) => document.getElementById(id);

const state = {
  settings: null,
  intent: null,       // running intent as stored
  countedTab: false,  // has this tab already been counted as an "intent tab"?
  timerId: null,
  view: null,         // 'ask' | 'show' | 'idle'
};

// ---------- rules ----------
export function isIntentActive(intent, now = Date.now()) {
  if (!intent || !intent.text) return false;
  if (dayKey(new Date(intent.startedAt)) !== dayKey(new Date(now))) return false;
  const expiresAt = Math.max(intent.startedAt + INTENT_MAX_AGE_MS, (intent.endsAt || 0) + 30 * 60 * 1000);
  return now < expiresAt;
}

function minutesOf(hhmm) {
  const [h, m] = String(hhmm || '0:0').split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

function inWorkHours(settings, now) {
  const d = new Date(now);
  const cur = d.getHours() * 60 + d.getMinutes();
  const start = minutesOf(settings.workStart);
  const end = minutesOf(settings.workEnd);
  return start <= end ? cur >= start && cur < end : cur >= start || cur < end; // supports overnight
}

export function isSnoozed(ask, now = Date.now()) {
  return (ask.snoozeUntil && ask.snoozeUntil > now) || ask.skipDay === dayKey(new Date(now));
}

// Decide what the centre of the page should show for a fresh tab.
function decideView(settings, ask, intent, now) {
  const active = isIntentActive(intent, now);
  const mode = settings.askMode;
  const snoozed = isSnoozed(ask, now);
  const isBreak = !ask.lastTabAt || now - ask.lastTabAt > BREAK_MS;

  if (mode === 'always') {
    if (!snoozed) return 'ask';
    return active ? 'show' : 'idle';
  }
  if (active) return 'show';
  if (mode === 'off' || snoozed) return 'idle';
  if (mode === 'smart') return isBreak ? 'ask' : 'idle';
  if (mode === 'work') return inWorkHours(settings, now) && isBreak ? 'ask' : 'idle';
  return 'idle';
}

// ---------- init ----------
export async function initIntent(settings, toast) {
  state.settings = settings;
  state.toast = toast;
  const now = Date.now();

  const { ask = {}, intent = null } = await get(['ask', 'intent']);
  state.intent = isIntentActive(intent, now) ? intent : null;

  const view = decideView(settings, ask, intent, now);

  // Count this tab and remember when it was opened.
  const day = await updateDay((d) => { d.tabs += 1; });
  await set({ ask: { ...ask, lastTabAt: now } });
  state.tabNo = day.tabs;
  $('tabNumber').textContent = t('tabNumber', { n: state.tabNo });

  renderChips();
  bindEvents();
  show(view);
  registerIntentCommands();

  // Language switched in Settings: redraw text without touching what the user typed.
  document.addEventListener('intent:lang', () => {
    $('tabNumber').textContent = t('tabNumber', { n: state.tabNo });
    renderChips();
    if (state.view === 'ask') revealText(document.querySelector('.question'), t('question'));
    if (state.view === 'show') render('show');
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes.intent) return;
    const next = changes.intent.newValue || null;
    const same = (next && state.intent && next.startedAt === state.intent.startedAt);
    state.intent = isIntentActive(next) ? next : null;
    if (state.view === 'show') {
      // Same intent, only details changed (coach, timer length): update in place.
      if (same && state.intent) { refreshCoach(); return; }
      if (state.intent) { if (!same) countIntentTab(); show('show'); }
      else show('idle');
    }
  });
}

// Breaks get the breathing guide, never the coach.
function refreshCoach() {
  if (!state.intent || state.view !== 'show') return;
  if (isBreakIntent(state.intent.text)) { $('coach').hidden = true; return; }
  renderCoach(state.intent, coachApi);
}

// What the AI coach is allowed to do with the running intent.
const coachApi = {
  isCurrent: (startedAt) => !!(state.intent && state.intent.startedAt === startedAt && state.view === 'show'),
  async saveCoach(coach) {
    if (!state.intent) return;
    state.intent = { ...state.intent, coach };
    await set({ intent: state.intent });
    refreshCoach();
  },
  async setMinutes(min) {
    if (!state.intent) return;
    state.intent = { ...state.intent, endsAt: state.intent.startedAt + min * 60 * 1000 };
    await set({ intent: state.intent });
    stopTimer();
    startTimer();
    renderDurations();
    if (!isBreakIntent(state.intent.text)) renderCoach(state.intent, coachApi);
  },
  pick: (text) => setIntent(text),
};

export function updateSettings(settings) {
  state.settings = settings;
}

// ---------- rendering ----------
function renderChips() {
  const box = $('chips');
  box.textContent = '';
  if (state.intent && isIntentActive(state.intent)) {
    const c = document.createElement('button');
    c.type = 'button';
    c.className = 'chip chip-continue';
    c.textContent = t('continuePrefix', { text: state.intent.text });
    c.addEventListener('click', () => { countIntentTab(); show('show'); });
    box.append(c);
  }
  for (const key of CHIP_KEYS) {
    const c = document.createElement('button');
    c.type = 'button';
    c.className = 'chip';
    c.innerHTML = `<svg class="chip-icon" viewBox="0 0 24 24" width="15" height="15" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${CHIP_ICONS[key]}</svg>`;
    c.append(t(key));
    c.addEventListener('click', () => setIntent(t(key)));
    box.append(c);
  }
}

// Switch views with a soft cross-fade (after the first paint).
function show(view) {
  if (!state.ready) { render(view); state.ready = true; return Promise.resolve(); }
  return transition(() => render(view));
}

function render(view) {
  if (view === 'show' && !state.intent) view = 'idle';
  state.view = view;
  $('askView').hidden = view !== 'ask';
  $('showView').hidden = view !== 'show';
  $('idleView').hidden = view !== 'idle';
  stopTimer();

  if (view === 'ask') {
    renderChips();
    $('intentInput').value = '';
    revealText(document.querySelector('.question'), t('question'));
    renderSuggestions($('suggestRow'), (text) => setIntent(text));
  }
  if (view === 'show') {
    countIntentTab();
    revealText($('intentText'), state.intent.text);
    startTimer();
    renderDurations();
    if (isBreakIntent(state.intent.text)) {
      // Breaks get the breathing guide instead of the coach.
      $('coach').hidden = true;
      startBreathing();
    } else {
      stopBreathing();
      renderCoach(state.intent, coachApi);
    }
  } else {
    $('coach').hidden = true;
    stopBreathing();
  }
}

function registerIntentCommands() {
  registerCommands((q) => {
    const out = [];
    if (q) out.push({ group: 'quick', always: true, rank: 5, icon: 'target', label: t('palSetIntent', { q }), run: () => setIntent(q) });
    out.push({
      group: 'actions', icon: 'target', label: t('palNewIntent'), keywords: 'intent why question new',
      run: async () => { await show('ask'); $('intentInput').focus(); },
    });
    out.push({
      group: 'actions', icon: 'breath', label: t('palBreathe'), keywords: 'break breathe rest relax calm বিরতি',
      run: () => setIntent(t('breakIntent'), 5),
    });
    if (state.intent) {
      out.push({ group: 'actions', icon: 'check', label: t('palIntentDone', { text: state.intent.text }), keywords: 'done finish complete', run: () => markDone() });
      out.push({ group: 'actions', icon: 'timer', label: t('addTime'), keywords: 'more time extend timer', run: () => addTime() });
      for (const n of TIMER_CHOICES) {
        if (n !== currentMinutes()) {
          out.push({ group: 'actions', icon: 'timer', label: t('coachUseMin', { n }), keywords: 'timer minutes pomodoro', run: () => coachApi.setMinutes(n) });
        }
      }
    }
    return out;
  });
}

export function isBreakIntent(text) {
  return text === t('chipBreak') || text === t('breakIntent') || category(text) === 'catBreak';
}

function currentMinutes() {
  const it = state.intent;
  return it ? Math.round((it.endsAt - it.startedAt) / 60000) : 0;
}

// Quick timer lengths under the ring: 5 · 10 · 25 · 50 min.
function renderDurations() {
  const box = $('durPick');
  box.textContent = '';
  const cur = currentMinutes();
  for (const n of TIMER_CHOICES) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'dur-btn';
    b.textContent = t('minShort', { n });
    b.setAttribute('aria-pressed', String(n === cur));
    b.title = t('coachUseMin', { n });
    b.addEventListener('click', () => coachApi.setMinutes(n));
    box.append(b);
  }
}

function startTimer() {
  const ring = $('ringFill');
  ring.style.strokeDasharray = String(RING_LEN);
  const tick = () => {
    const it = state.intent;
    if (!it) return;
    const total = Math.max(1, it.endsAt - it.startedAt);
    const left = Math.max(0, it.endsAt - Date.now());
    ring.style.strokeDashoffset = String(RING_LEN * (1 - left / total));
    const up = left <= 0;
    $('timer').classList.toggle('is-up', up);
    $('addTimeBtn').hidden = !up;
    // After a real focus session (20+ min), offer a short break, Pomodoro style.
    $('breakBtn').hidden = !(up && total >= 20 * 60000 && !isBreakIntent(it.text));
    if (up) {
      $('timerText').textContent = t('timeUp');
    } else {
      const s = Math.ceil(left / 1000);
      $('timerText').textContent = digits(`${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`);
    }
  };
  tick();
  state.timerId = setInterval(tick, 1000);
}

function stopTimer() {
  if (state.timerId) clearInterval(state.timerId);
  state.timerId = null;
}

// ---------- actions ----------
async function countIntentTab() {
  if (state.countedTab) return;
  state.countedTab = true;
  await updateDay((d) => { d.intentTabs += 1; });
}

async function setIntent(text, minutes) {
  text = String(text || '').trim();
  if (!text) return;
  const now = Date.now();
  // Breaks default to 5 minutes; everything else to the length chosen in Settings.
  const min = minutes || (isBreakIntent(text) ? 5 : Number(state.settings && state.settings.timerMin) || FOCUS_MS / 60000);
  state.intent = { text, startedAt: now, endsAt: now + min * 60 * 1000 };
  await set({ intent: state.intent });
  await updateDay((d) => { d.intentsSet += 1; });
  recordIntent(text);
  show('show');
}

async function markDone() {
  if (!state.intent) return;
  burstFrom($('doneBtn'), { count: 28, spread: 120 });
  recordIntentDone(state.intent.text);
  state.intent = null;
  await set({ intent: null });
  await updateDay((d) => { d.intentsDone += 1; });
  show('idle');
  state.toast(t('doneToast'));
}

async function newIntent() {
  state.intent = null;
  await set({ intent: null });
  await show('ask');
  $('intentInput').focus();
}

async function addTime() {
  if (!state.intent) return;
  state.intent = { ...state.intent, endsAt: Math.max(Date.now(), state.intent.endsAt) + ADD_MS };
  await set({ intent: state.intent });
  stopTimer();
  startTimer(); // keep the text in place, just restart the ring
}

async function snooze(kind) {
  const { ask = {} } = await get('ask');
  if (kind === 'hour') ask.snoozeUntil = Date.now() + 60 * 60 * 1000;
  else ask.skipDay = dayKey();
  await set({ ask });
  show(state.intent ? 'show' : 'idle');
}

function bindEvents() {
  $('intentForm').addEventListener('submit', (e) => {
    e.preventDefault();
    setIntent($('intentInput').value);
  });
  $('doneBtn').addEventListener('click', markDone);
  $('newIntentBtn').addEventListener('click', newIntent);
  $('addTimeBtn').addEventListener('click', addTime);
  $('breakBtn').addEventListener('click', () => setIntent(t('breakIntent'), 5));
  $('snoozeHour').addEventListener('click', () => snooze('hour'));
  $('snoozeToday').addEventListener('click', () => snooze('day'));
  $('setIntentBtn').addEventListener('click', async () => {
    await show('ask');
    $('intentInput').focus();
  });
}

// Esc dismisses the question (handled by app.js so the settings panel can take priority).
export function dismissQuestion() {
  if (state.view !== 'ask') return false;
  show(state.intent ? 'show' : 'idle');
  return true;
}
