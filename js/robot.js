// Intent — a small robot companion that peeks over the top of the To-do card,
// waves hello, follows your mouse with its eyes, points at the task to do next
// ("Let's do this one 👉"), cheers when you finish things, and keeps watch
// while an intent runs. Click it for the next suggestion.

import { get, dayKey } from './store.js';
import { t } from './strings.js';
import { startIntent, isBreakIntent } from './intent.js';
import { isIdle } from './effects.js';

const $ = (id) => document.getElementById(id);
const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');

const ROBOT_SVG = `
<svg class="tabi-svg" viewBox="0 0 140 150" aria-hidden="true">
  <defs>
    <linearGradient id="tabiShell" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#f7f9ff"/><stop offset="1" stop-color="#c9d2ea"/>
    </linearGradient>
    <linearGradient id="tabiVisor" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#1b2550"/><stop offset="1" stop-color="#0a0f26"/>
    </linearGradient>
    <radialGradient id="tabiGlow" cx=".5" cy=".5" r=".5">
      <stop offset="0" style="stop-color: var(--tabi-eye); stop-opacity: .9"/><stop offset="1" style="stop-color: var(--tabi-eye); stop-opacity: 0"/>
    </radialGradient>
  </defs>
  <!-- waving arm (behind the head) -->
  <g class="tabi-arm">
    <path d="M104 96 C 116 88, 122 74, 124 60" stroke="#c9d2ea" stroke-width="9" stroke-linecap="round" fill="none"/>
    <circle cx="124" cy="56" r="9" fill="url(#tabiShell)" stroke="#aab5d4" stroke-width="1.5"/>
  </g>
  <!-- body (mostly hidden behind the card) -->
  <rect x="38" y="92" width="64" height="58" rx="18" fill="url(#tabiShell)" stroke="#aab5d4" stroke-width="1.5"/>
  <circle class="tabi-heart" cx="70" cy="112" r="5"/>
  <!-- antenna -->
  <line x1="70" y1="24" x2="70" y2="10" stroke="#aab5d4" stroke-width="3" stroke-linecap="round"/>
  <circle class="tabi-bulb-glow" cx="70" cy="8" r="10" fill="url(#tabiGlow)"/>
  <circle class="tabi-bulb" cx="70" cy="8" r="5"/>
  <!-- ears -->
  <rect x="17" y="46" width="12" height="24" rx="6" fill="#b9c3df"/>
  <rect x="111" y="46" width="12" height="24" rx="6" fill="#b9c3df"/>
  <!-- head -->
  <g class="tabi-head">
    <rect x="24" y="22" width="92" height="72" rx="28" fill="url(#tabiShell)" stroke="#aab5d4" stroke-width="1.5"/>
    <rect x="34" y="34" width="72" height="46" rx="20" fill="url(#tabiVisor)"/>
    <ellipse cx="56" cy="42" rx="14" ry="4" fill="#fff" opacity=".12"/>
    <g class="tabi-eyes">
      <g class="tabi-eye-l"><ellipse class="tabi-eye" cx="55" cy="56" rx="7" ry="9"/><circle class="tabi-pupil" cx="57" cy="53" r="2.4" fill="#fff"/></g>
      <g class="tabi-eye-r"><ellipse class="tabi-eye" cx="85" cy="56" rx="7" ry="9"/><circle class="tabi-pupil" cx="87" cy="53" r="2.4" fill="#fff"/></g>
    </g>
    <!-- happy eyes (shown when cheering) -->
    <g class="tabi-happy" fill="none" stroke-width="4" stroke-linecap="round">
      <path d="M48 58 Q55 49 62 58"/><path d="M78 58 Q85 49 92 58"/>
    </g>
    <path class="tabi-mouth" d="M62 69 Q70 75 78 69" stroke-width="3" fill="none" stroke-linecap="round"/>
    <circle cx="42" cy="70" r="4.5" fill="#ff8fb0" opacity=".45"/>
    <circle cx="98" cy="70" r="4.5" fill="#ff8fb0" opacity=".45"/>
  </g>
</svg>`;

// Little mitten hands that hold the top edge of the card (drawn in front of it).
const HANDS_SVG = `
<svg viewBox="0 0 120 48" aria-hidden="true">
  <g class="tabi-finger"><rect x="84" y="14" width="10" height="26" rx="5" fill="#f1f4fc" stroke="#aab5d4" stroke-width="1.4"/></g>
  <g fill="url(#tabiHand)" stroke="#aab5d4" stroke-width="1.4">
    <rect x="18" y="2" width="26" height="20" rx="10"/>
    <rect x="76" y="2" width="26" height="20" rx="10"/>
  </g>
  <g stroke="#aab5d4" stroke-width="1.2" stroke-linecap="round" opacity=".7">
    <line x1="27" y1="11" x2="27" y2="19"/><line x1="35" y1="11" x2="35" y2="19"/>
    <line x1="85" y1="11" x2="85" y2="19"/><line x1="93" y1="11" x2="93" y2="19"/>
  </g>
  <defs><linearGradient id="tabiHand" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f7f9ff"/><stop offset="1" stop-color="#d4dbef"/></linearGradient></defs>
</svg>`;

let robot, hands, bubble, anchor = null;
let tips = [];
let tipIndex = 0;
let lastDone = null;
let rotateTimer = 0;
let hidden = false;
let enabled = true;
let started = false;

// ---------- placement: always tucked behind the top edge of a card ----------
function pickAnchor() {
  const ids = ['todoModule', 'notesModule', 'reportModule', 'devModule'];
  return ids.map($).find((el) => el && !el.hidden && el.offsetParent !== null) || null;
}

function place() {
  anchor = enabled ? pickAnchor() : null;
  const show = !!anchor;
  [robot, hands, bubble].forEach((el) => el.classList.toggle('is-gone', !show));
  // The column the robot sits on gets a little headroom, so the robot never covers the clock.
  document.querySelectorAll('.tabi-col').forEach((col) => { if (!anchor || col !== anchor.parentElement) col.classList.remove('tabi-col'); });
  if (!show) return;
  anchor.parentElement.classList.add('tabi-col');
  const r = anchor.getBoundingClientRect();
  const x = r.right + window.scrollX - 158;
  const y = r.top + window.scrollY;
  robot.style.left = x + 'px';
  robot.style.top = (y - 104) + 'px';
  hands.style.left = (x + 10) + 'px';
  hands.style.top = (y - 13) + 'px';
  // Speech bubble to the right of the robot, above the card.
  bubble.style.left = (x + 128) + 'px';
  bubble.style.maxWidth = Math.max(180, Math.min(360, window.innerWidth - (x + 128) - 16)) + 'px';
  // Sit above the search bar, never on top of it.
  const search = $('searchForm').getBoundingClientRect();
  const limit = search.top + window.scrollY - bubble.offsetHeight - 12;
  bubble.style.top = Math.max(8, Math.min(y - 150, limit)) + 'px';
  if (x + 128 + 180 > window.innerWidth) {
    // No room on the right: put the bubble above-left instead.
    bubble.style.left = Math.max(8, x - 150) + 'px';
    bubble.style.top = Math.max(8, y - 190) + 'px';
    bubble.classList.add('is-above');
  } else {
    bubble.classList.remove('is-above');
  }
}

// ---------- eyes follow the mouse ----------
// Run fn at most once per animation frame (mousemove/resize fire far more often).
function perFrame(fn) {
  let queued = false, arg;
  return (a) => {
    arg = a;
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; fn(arg); });
  };
}

function lookAt(e) {
  if (!robot || reduce.matches) return;
  const r = robot.getBoundingClientRect();
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height * 0.38;
  const dx = Math.max(-1, Math.min(1, (e.clientX - cx) / 300));
  const dy = Math.max(-1, Math.min(1, (e.clientY - cy) / 300));
  robot.style.setProperty('--look-x', (dx * 3.5).toFixed(2) + 'px');
  robot.style.setProperty('--look-y', (dy * 3).toFixed(2) + 'px');
  robot.style.setProperty('--tilt', (dx * 4).toFixed(2) + 'deg');
}

// ---------- moods ----------
function mood(name, ms) {
  for (const el of [robot, hands]) {
    el.classList.remove('is-wave', 'is-point', 'is-cheer', 'is-watch');
    if (name) el.classList.add('is-' + name);
  }
  if (ms) setTimeout(() => { robot.classList.remove('is-' + name); hands.classList.remove('is-' + name); }, ms);
}

function highlightTask(text) {
  document.querySelectorAll('.todo-item.robot-pick').forEach((li) => li.classList.remove('robot-pick'));
  if (!text) return;
  const li = [...document.querySelectorAll('.todo-item')].find((x) => x.querySelector('.todo-text')?.textContent === text);
  if (li) {
    li.classList.add('robot-pick');
    li.scrollIntoView({ block: 'nearest', behavior: reduce.matches ? 'auto' : 'smooth' });
  }
}

// ---------- what the robot says ----------
async function buildTips() {
  const { todos = [], focus, intent } = await get(['todos', 'focus', 'intent']);
  const out = [];
  const running = intent && intent.text && Date.now() < intent.endsAt;
  const open = todos.filter((x) => !x.done);
  const done = todos.filter((x) => x.done);
  const focusToday = focus && focus.day === dayKey() && focus.text && !focus.done && !focus.skipped ? focus : null;

  if (running && isBreakIntent(intent.text)) {
    out.push({ text: t('tabiBreak'), mood: 'watch' });
  } else if (running) {
    out.push({ text: t('tabiWatching', { text: intent.text }), mood: 'watch' });
  }
  if (focusToday && !running) {
    out.push({ text: t('tabiFocus', { text: focusToday.text }), mood: 'point', start: focusToday.text });
  }
  open.forEach((x) => out.push({ text: t('tabiDoThis', { text: x.text }), mood: 'point', start: x.text, task: x.text }));
  if (!open.length && done.length) out.push({ text: t('tabiAllDone'), mood: 'cheer' });
  if (!todos.length && !running && !focusToday) out.push({ text: t('tabiEmpty'), mood: 'wave' });
  return out.length ? out : [{ text: t('tabiHello'), mood: 'wave' }];
}

function showTip(i, { quiet = false } = {}) {
  if (!tips.length) return;
  tipIndex = ((i % tips.length) + tips.length) % tips.length;
  const tip = tips[tipIndex];
  const body = $('tabiText');
  body.textContent = tip.text;
  const actions = $('tabiActions');
  actions.textContent = '';
  if (tip.start) {
    const go = document.createElement('button');
    go.type = 'button';
    go.className = 'tabi-btn tabi-go';
    go.textContent = t('tabiStart');
    go.addEventListener('click', (e) => { e.stopPropagation(); mood('cheer', 1400); startIntent(tip.start); });
    actions.append(go);
  }
  if (tips.length > 1) {
    const next = document.createElement('button');
    next.type = 'button';
    next.className = 'tabi-btn';
    next.textContent = t('tabiNext');
    next.addEventListener('click', (e) => { e.stopPropagation(); showTip(tipIndex + 1); });
    actions.append(next);
  }
  actions.hidden = !actions.children.length;
  highlightTask(tip.task || null);
  if (!quiet) mood(tip.mood === 'cheer' ? 'cheer' : tip.mood, tip.mood === 'cheer' ? 1800 : 0);
  if (!hidden) {
    bubble.classList.remove('is-pop');
    void bubble.offsetWidth;
    bubble.classList.add('is-pop');
  }
  place();
}

async function refresh({ celebrate = false } = {}) {
  const prev = tips[tipIndex] && tips[tipIndex].text;
  tips = await buildTips();
  const same = tips.findIndex((x) => x.text === prev);
  showTip(same >= 0 ? same : 0, { quiet: same >= 0 && !celebrate });
  if (celebrate) {
    mood('cheer', 1800);
    $('tabiText').textContent = t('tabiNice');
    setTimeout(() => showTip(0), 2200);
  }
}

function toggleBubble(force) {
  hidden = force != null ? !force : !hidden;
  bubble.classList.toggle('is-hidden', hidden);
  if (!hidden) showTip(tipIndex + (force == null ? 1 : 0));
}

// ---------- build ----------
function build() {
  robot = document.createElement('button');
  robot.type = 'button';
  robot.className = 'tabi is-entering';
  robot.id = 'tabi';
  robot.innerHTML = ROBOT_SVG;
  robot.setAttribute('aria-label', t('tabiLabel'));
  robot.title = t('tabiLabel');

  hands = document.createElement('div');
  hands.className = 'tabi-hands';
  hands.innerHTML = HANDS_SVG;

  bubble = document.createElement('div');
  bubble.className = 'tabi-bubble';
  bubble.setAttribute('role', 'status');
  bubble.setAttribute('aria-live', 'polite');
  bubble.innerHTML = '<span class="tabi-name"></span><p id="tabiText"></p><div class="tabi-actions" id="tabiActions"></div><button type="button" class="tabi-close" id="tabiClose"></button>';
  bubble.querySelector('.tabi-name').textContent = 'Intent'; // the robot's name
  const close = bubble.querySelector('#tabiClose');
  close.innerHTML = '<svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
  close.setAttribute('aria-label', t('coachHide'));

  document.body.append(robot, hands, bubble);

  robot.addEventListener('click', () => { if (hidden) toggleBubble(true); else showTip(tipIndex + 1); });
  robot.addEventListener('mouseenter', () => { if (!robot.classList.contains('is-cheer')) mood('wave', 1600); });
  close.addEventListener('click', () => toggleBubble(false));
  bubble.addEventListener('click', (e) => { if (e.target === bubble || e.target.id === 'tabiText') showTip(tipIndex + 1); });
}

export function setRobotEnabled(on) {
  enabled = !!on;
  if (started) place();
}

export async function initRobot(on = true) {
  enabled = !!on;
  if (started) { place(); return; }
  started = true;
  build();
  place();
  // Peek in, then wave hello.
  setTimeout(() => { robot.classList.remove('is-entering'); mood('wave', 2000); }, 700);

  const { todos = [] } = await get('todos');
  lastDone = todos.filter((x) => x.done).length;
  await refresh();

  // The robot is positioned in page coordinates, so scrolling never needs a re-place.
  const placeSoon = perFrame(place);
  window.addEventListener('pointermove', perFrame(lookAt), { passive: true });
  window.addEventListener('resize', placeSoon);
  new ResizeObserver(placeSoon).observe(document.querySelector('.layout'));
  document.addEventListener('intent:settings', () => setTimeout(place, 50));
  document.addEventListener('intent:lang', () => { robot.title = t('tabiLabel'); refresh(); });
  chrome.storage.onChanged.addListener(async (c, area) => {
    if (area !== 'local' || !(c.todos || c.focus || c.intent)) return;
    let celebrate = false;
    if (c.todos) {
      const done = (c.todos.newValue || []).filter((x) => x.done).length;
      celebrate = lastDone != null && done > lastDone;
      lastDone = done;
    }
    await refresh({ celebrate });
  });
  // Gently rotate to the next suggestion now and then.
  clearInterval(rotateTimer);
  rotateTimer = setInterval(() => { if (!hidden && tips.length > 1 && !document.hidden && !isIdle()) showTip(tipIndex + 1); }, 20000);
}
