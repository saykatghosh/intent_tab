import { get, set, saveSettings } from './store.js';
import { isSnoozed } from './intent.js';
import { t, locale } from './strings.js';

const $ = (id) => document.getElementById(id);
let settings;
let onChange;
let lastFocus = null;

export function initSettings(initial, changed) {
  settings = initial;
  onChange = changed;

  $('settingsBtn').addEventListener('click', open);
  $('closeSettings').addEventListener('click', close);
  $('scrim').addEventListener('click', close);

  document.querySelectorAll('input[name="askMode"]').forEach((r) => {
    r.addEventListener('change', () => { if (r.checked) update({ askMode: r.value }); });
  });
  $('workStart').addEventListener('change', (e) => update({ workStart: e.target.value || '09:00' }));
  $('workEnd').addEventListener('change', (e) => update({ workEnd: e.target.value || '18:00' }));

  document.querySelectorAll('[data-module]').forEach((cb) => {
    cb.addEventListener('change', () => update({ modules: { ...settings.modules, [cb.dataset.module]: cb.checked } }));
  });
  document.querySelectorAll('[data-theme-choice]').forEach((b) => {
    b.addEventListener('click', () => update({ theme: b.dataset.themeChoice }));
  });
  document.querySelectorAll('[data-lang-choice]').forEach((b) => {
    b.addEventListener('click', () => update({ lang: b.dataset.langChoice }));
  });
  document.querySelectorAll('[data-bg-choice]').forEach((b) => {
    b.addEventListener('click', () => update({ background: b.dataset.bgChoice }));
  });
  $('aiToggle').addEventListener('change', (e) => update({ ai: e.target.checked }));
  document.querySelectorAll('[data-timer-choice]').forEach((b) => {
    b.addEventListener('click', () => update({ timerMin: Number(b.dataset.timerChoice) }));
  });
  document.addEventListener('intent:lang', () => { if (isOpen()) renderSnooze(); });

  $('resumeBtn').addEventListener('click', async () => {
    const { ask = {} } = await get('ask');
    await set({ ask: { ...ask, snoozeUntil: 0, skipDay: null } });
    renderSnooze();
  });

  fill();
}

// Change settings from elsewhere (e.g. the command palette).
export function applySettings(patch) {
  return update(patch);
}

export function openSettings() {
  open();
}

export function isOpen() {
  return !$('settingsPanel').hidden;
}

function open() {
  lastFocus = document.activeElement;
  fill();
  renderSnooze();
  $('settingsPanel').hidden = false;
  $('scrim').hidden = false;
  $('settingsBtn').setAttribute('aria-expanded', 'true');
  $('closeSettings').focus();
}

export function close() {
  $('settingsPanel').hidden = true;
  $('scrim').hidden = true;
  $('settingsBtn').setAttribute('aria-expanded', 'false');
  if (lastFocus && lastFocus.focus) lastFocus.focus();
}

async function update(patch) {
  settings = { ...settings, ...patch };
  await saveSettings(settings);
  fill();
  onChange(settings);
  document.dispatchEvent(new CustomEvent('intent:settings', { detail: settings }));
}

export function currentSettings() {
  return settings;
}

function fill() {
  document.querySelectorAll('input[name="askMode"]').forEach((r) => { r.checked = r.value === settings.askMode; });
  $('workStart').value = settings.workStart;
  $('workEnd').value = settings.workEnd;
  document.querySelectorAll('[data-module]').forEach((cb) => { cb.checked = !!settings.modules[cb.dataset.module]; });
  document.querySelectorAll('[data-theme-choice]').forEach((b) => {
    b.classList.toggle('is-active', b.dataset.themeChoice === settings.theme);
    b.setAttribute('aria-pressed', String(b.dataset.themeChoice === settings.theme));
  });
  document.querySelectorAll('[data-lang-choice]').forEach((b) => {
    b.classList.toggle('is-active', b.dataset.langChoice === settings.lang);
    b.setAttribute('aria-pressed', String(b.dataset.langChoice === settings.lang));
  });
  $('aiToggle').checked = settings.ai !== false;
  document.querySelectorAll('[data-timer-choice]').forEach((b) => {
    const on = Number(b.dataset.timerChoice) === Number(settings.timerMin);
    b.classList.toggle('is-active', on);
    b.setAttribute('aria-pressed', String(on));
  });
  document.querySelectorAll('[data-bg-choice]').forEach((b) => {
    b.classList.toggle('is-active', b.dataset.bgChoice === settings.background);
    b.setAttribute('aria-pressed', String(b.dataset.bgChoice === settings.background));
  });
}

async function renderSnooze() {
  const { ask = {} } = await get('ask');
  const note = $('snoozeNote');
  if (!isSnoozed(ask)) { note.hidden = true; return; }
  const until = ask.snoozeUntil && ask.snoozeUntil > Date.now()
    ? t('snoozedUntil', { time: new Date(ask.snoozeUntil).toLocaleTimeString(locale(), { hour: 'numeric', minute: '2-digit' }) })
    : t('snoozedToday');
  $('snoozeText').textContent = until;
  note.hidden = false;
}
