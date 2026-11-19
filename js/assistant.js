// The AI layer of Intent Tab:
//   1. Smart suggestions under the question
//   2. Intent coach (clear goal, timer length, tiny steps)
//   3. Day summary in the report
//   4. "Ask AI" from the search bar
// Uses Chrome's on-device model when available (see ai.js); otherwise simple rules.

import { askAI, streamAI, aiReady, onAIStatus, refreshStatus, currentStatus, downloadModel } from './ai.js';
import { get, set, dayKey, uid } from './store.js';
import { t, num } from './strings.js';
import { getFocus } from './focus.js';
import { registerCommands } from './palette.js';
import { searchUrl } from './search.js';

const $ = (id) => document.getElementById(id);
const SPARK =
  '<svg class="spark" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">' +
  '<path d="M12 2.5l1.8 5.7 5.7 1.8-5.7 1.8L12 17.5l-1.8-5.7L4.5 10l5.7-1.8z" fill="url(#aiGrad)"/>' +
  '<path d="M18.5 14.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z" fill="url(#aiGrad)"/></svg>';
const HISTORY_MAX = 80;

let toastFn = () => {};
let busy = 0;

function setBusy(delta) {
  busy = Math.max(0, busy + delta);
  $('aiBadge')?.classList.toggle('is-thinking', busy > 0);
}

async function withBusy(fn) {
  setBusy(1);
  try { return await fn(); } finally { setBusy(-1); }
}

function hhmm(d = new Date()) {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

function header(titleKey, isAI) {
  const h = el('div', 'ai-head');
  h.innerHTML = SPARK;
  h.append(el('span', 'ai-title', t(titleKey)));
  if (isAI) h.append(el('span', 'ai-tag', t('aiTag')));
  return h;
}

// =========================================================
// Intent history (used by suggestions and the summary)
// =========================================================
export async function recordIntent(text) {
  const { history = [] } = await get('history');
  history.push({ text, at: Date.now(), done: false });
  await set({ history: history.slice(-HISTORY_MAX) });
}

export async function recordIntentDone(text) {
  const { history = [] } = await get('history');
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].text === text && !history[i].done) { history[i].done = true; break; }
  }
  await set({ history });
}

// Rough topic of an intent, for rules and summaries (English + Bangla keywords).
const CATEGORIES = [
  ['catEmail', /mail|inbox|gmail|message|reply|slack|chat|ইমেইল|মেইল|মেসেজ/i],
  ['catBreak', /break|rest|walk|relax|coffee|tea|stretch|বিরতি|বিশ্রাম|চা/i],
  ['catMaking', /write|build|design|code|fix|draft|create|plan|edit|make|লেখা|বানা|ডিজাইন|কোড/i],
  ['catResearch', /research|read|learn|study|search|look|compare|find|watch|doc|গবেষণা|পড়া|শেখা|খোঁজ/i],
];
export function category(text) {
  const hit = CATEGORIES.find(([, re]) => re.test(text));
  return hit ? hit[0] : null;
}

function ruleMinutes(text) {
  const cat = category(text);
  return { catEmail: 5, catBreak: 5, catResearch: 20, catMaking: 25 }[cat] || 10;
}

// =========================================================
// 1. Smart suggestions
// =========================================================
const DEFAULT_CHIPS = ['chipEmail', 'chipResearch', 'chipBreak', 'chipUnsure'];
let suggestSeq = 0;

async function ruleSuggestions() {
  const { todos = [], history = [] } = await get(['todos', 'history']);
  const defaults = new Set(DEFAULT_CHIPS.map((k) => t(k).toLowerCase()));
  const out = [];
  const add = (text) => {
    const k = text.trim().toLowerCase();
    if (k && !defaults.has(k) && !out.some((x) => x.toLowerCase() === k)) out.push(text.trim());
  };

  // Today's one thing comes first, then open tasks (oldest first).
  const focus = getFocus();
  if (focus && !focus.done) add(focus.text);
  todos.filter((x) => !x.done).slice(0, 2).forEach((x) => add(x.text));

  // Something you often do around this time of day (last 14 days).
  const hour = new Date().getHours();
  const since = Date.now() - 14 * 864e5;
  const counts = new Map();
  for (const h of history) {
    if (h.at < since) continue;
    const hh = new Date(h.at).getHours();
    if (Math.abs(hh - hour) > 2) continue;
    counts.set(h.text, (counts.get(h.text) || 0) + 1);
  }
  [...counts.entries()].filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]).slice(0, 2).forEach(([text]) => add(text));

  return out.slice(0, 3);
}

async function aiSuggestions() {
  const { todos = [], history = [], aiCache = {} } = await get(['todos', 'history', 'aiCache']);
  const open = todos.filter((x) => !x.done).map((x) => x.text).slice(0, 8);
  const recent = history.slice(-8).map((h) => ({ text: h.text, time: hhmm(new Date(h.at)), done: h.done }));
  const now = new Date();
  const focus = getFocus();
  const todayFocus = focus && !focus.done ? focus.text : null;
  const sig = JSON.stringify([open, recent.map((r) => r.text), now.getHours(), todayFocus]);
  const cached = aiCache.suggest;
  if (cached && cached.sig === sig && Date.now() - cached.at < 15 * 60 * 1000) return cached.list;

  const prompt =
    `Context (JSON): ${JSON.stringify({ time: hhmm(now), weekday: now.toLocaleDateString('en', { weekday: 'long' }), todayMainGoal: todayFocus, openTasks: open, recentIntents: recent })}\n` +
    'The user just opened a new browser tab. Suggest up to 3 short things they most likely want to do in it right now. ' +
    'Each must be 2 to 6 words, start with a verb, and be specific (reuse their task names when relevant). ' +
    'Do not suggest generic things like "Check email" or "Take a break".';
  const res = await askAI(prompt, {
    schema: {
      type: 'object',
      properties: { suggestions: { type: 'array', items: { type: 'string' }, maxItems: 3 } },
      required: ['suggestions'],
    },
  });
  const list = (res.suggestions || []).map((s) => String(s).trim()).filter(Boolean).slice(0, 3);
  await set({ aiCache: { ...aiCache, suggest: { sig, at: Date.now(), list } } });
  return list;
}

function drawSuggestions(box, list, onPick, isAI) {
  box.textContent = '';
  if (!list.length) { box.hidden = true; return; }
  box.hidden = false;
  const label = el('span', 'suggest-label');
  label.innerHTML = SPARK;
  label.append(t('suggested'));
  box.append(label);
  list.forEach((text, i) => {
    const c = el('button', 'chip chip-suggest' + (isAI ? ' is-ai' : ''), text);
    c.type = 'button';
    c.style.setProperty('--i', i);
    c.addEventListener('click', () => onPick(text));
    box.append(c);
  });
}

export async function renderSuggestions(box, onPick) {
  const seq = ++suggestSeq;
  const rules = await ruleSuggestions();
  if (seq !== suggestSeq) return;
  drawSuggestions(box, rules, onPick, false);
  if (!aiReady()) return;

  box.classList.add('is-thinking');
  if (box.hidden) { box.hidden = false; box.append(el('span', 'suggest-label ai-shimmer', t('aiThinking'))); }
  try {
    const list = await withBusy(() => aiSuggestions());
    if (seq !== suggestSeq) return;
    if (list.length) drawSuggestions(box, list, onPick, true);
    else drawSuggestions(box, rules, onPick, false);
  } catch (err) {
    console.warn('[Intent Tab] AI suggestions', err);
    if (seq === suggestSeq) drawSuggestions(box, rules, onPick, false);
  } finally {
    box.classList.remove('is-thinking');
  }
}

// =========================================================
// 2. Intent coach
// =========================================================
// api: { isCurrent(startedAt), saveCoach(coach), setMinutes(n), pick(text) }
const coachRequests = new Set();
let coachShown = '';

function isUnsure(text) {
  return text === t('chipUnsure') || /^(not sure|নিশ্চিত না)$/i.test(text.trim());
}

async function aiCoach(text) {
  const focus = getFocus();
  const prompt =
    `The user opened a new browser tab. Their intent: "${text}". Local time: ${hhmm()}.\n` +
    (focus && !focus.done ? `Their main goal for today: "${focus.text}". If it is related, connect the steps to it.\n` : '') +
    'Return JSON with: "focus" = the intent rewritten as one clear, specific goal (max 12 words, start with a verb); ' +
    '"minutes" = a realistic focus time (5 to 60); "steps" = 2 or 3 tiny concrete steps (max 8 words each). ' +
    'If it is about resting or a break, keep it gentle (5 to 15 minutes, simple steps).';
  const res = await askAI(prompt, {
    schema: {
      type: 'object',
      properties: {
        focus: { type: 'string' },
        minutes: { type: 'integer', minimum: 5, maximum: 60 },
        steps: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 3 },
      },
      required: ['focus', 'minutes', 'steps'],
    },
  });
  return {
    focus: String(res.focus || '').trim(),
    minutes: Math.min(60, Math.max(5, Math.round(Number(res.minutes) || 10))),
    steps: (res.steps || []).map((s) => String(s).trim()).filter(Boolean).slice(0, 3),
    source: 'ai',
  };
}

export async function renderCoach(intent, api) {
  const box = $('coach');
  if (!intent) { box.hidden = true; return; }
  const key = intent.startedAt;

  // "Not sure": offer a few concrete things to pick instead.
  if (isUnsure(intent.text)) {
    const list = await ruleSuggestions();
    if (!api.isCurrent(key)) return;
    if (!list.length) { box.hidden = true; return; }
    box.textContent = '';
    box.className = 'ai-card coach';
    box.append(header('coachUnsureTitle', false));
    const row = el('div', 'coach-picks');
    list.forEach((text) => {
      const c = el('button', 'chip chip-suggest', text);
      c.type = 'button';
      c.addEventListener('click', () => api.pick(text));
      row.append(c);
    });
    box.append(row);
    box.hidden = false;
    coachShown = '';
    return;
  }

  const coach = intent.coach;
  if (coach && coach.hidden) { box.hidden = true; return; }
  if (coach) { drawCoach(box, intent, coach, api); return; }

  // No coach yet: ask the AI once per intent, otherwise use the rules.
  if (coachRequests.has(key)) return;
  coachRequests.add(key);
  if (aiReady()) {
    box.textContent = '';
    box.className = 'ai-card coach is-thinking';
    box.append(header('coachTitle', true), el('p', 'ai-shimmer coach-thinking', t('aiThinking')));
    box.hidden = false;
    coachShown = '';
    try {
      const result = await withBusy(() => aiCoach(intent.text));
      if (api.isCurrent(key)) await api.saveCoach(result);
      return;
    } catch (err) {
      console.warn('[Intent Tab] AI coach', err);
    }
  }
  const rules = { focus: '', minutes: ruleMinutes(intent.text), steps: [], source: 'rules' };
  if (api.isCurrent(key)) await api.saveCoach(rules);
}

function drawCoach(box, intent, coach, api) {
  const currentMin = Math.round((intent.endsAt - intent.startedAt) / 60000);
  const sig = JSON.stringify([intent.startedAt, coach, currentMin]);
  if (sig === coachShown && !box.hidden) return;
  coachShown = sig;

  const isAI = coach.source === 'ai';
  const offerMinutes = coach.minutes && coach.minutes !== currentMin;
  if (!isAI && !offerMinutes) { box.hidden = true; return; }

  box.textContent = '';
  box.className = 'ai-card coach' + (isAI ? ' is-ai' : '');
  const head = header(isAI ? 'coachTitle' : 'coachRulesTitle', isAI);
  const hide = el('button', 'ai-icon-btn');
  hide.type = 'button';
  hide.title = t('coachHide');
  hide.setAttribute('aria-label', t('coachHide'));
  hide.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
  hide.addEventListener('click', () => api.saveCoach({ ...coach, hidden: true }));
  head.append(hide);
  box.append(head);

  if (coach.focus) box.append(el('p', 'coach-focus ai-type', coach.focus));
  if (!isAI && offerMinutes) box.append(el('p', 'coach-note', t('coachMinutesOnly', { n: coach.minutes })));

  if (coach.steps && coach.steps.length) {
    const ol = el('ol', 'coach-steps');
    coach.steps.forEach((s, i) => {
      const li = el('li', null, s);
      li.style.setProperty('--i', i);
      ol.append(li);
    });
    box.append(ol);
  }

  const actions = el('div', 'coach-actions');
  if (offerMinutes) {
    const b = el('button', 'btn btn-quiet btn-sm', t('coachUseMin', { n: coach.minutes }));
    b.type = 'button';
    b.addEventListener('click', () => api.setMinutes(coach.minutes));
    actions.append(b);
  }
  if (coach.steps && coach.steps.length && !coach.stepsAdded) {
    const b = el('button', 'btn btn-quiet btn-sm', t('coachAddSteps'));
    b.type = 'button';
    b.addEventListener('click', async () => {
      await addTodos(coach.steps);
      await api.saveCoach({ ...coach, stepsAdded: true });
      toastFn(t('coachAdded', { n: coach.steps.length }));
    });
    actions.append(b);
  }
  if (actions.children.length) box.append(actions);
  box.hidden = false;
}

async function addTodos(texts) {
  const { todos = [] } = await get('todos');
  const now = Date.now();
  texts.forEach((text) => todos.push({ id: uid(), text, done: false, createdAt: now, doneAt: null }));
  await set({ todos });
}

// =========================================================
// 3. Day summary (in the report card)
// =========================================================
let summarySeq = 0;
let summaryAbort = null;
let summaryInflight = null; // { key } while the AI is writing a summary

function ruleSummary(d, intents) {
  const pct = d.tabs ? Math.round((Math.min(d.intentTabs, d.tabs) / d.tabs) * 100) : 0;
  let text = t('sumRules', { tabs: d.tabs, pct, done: d.intentsDone, set: d.intentsSet });
  const counts = {};
  intents.forEach((i) => { const c = category(i.text); if (c) counts[c] = (counts[c] || 0) + 1; });
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  if (top && top[1] >= 2) text += ' ' + t('sumMostly', { cat: t(top[0]) });
  return text;
}

export async function renderSummary(key, d, { force = false } = {}) {
  const box = $('aiSummary');
  const textEl = $('aiSummaryText');
  if (!d || !d.tabs) { box.hidden = true; return; }
  box.hidden = false;

  const { history = [], aiCache = {} } = await get(['history', 'aiCache']);
  const isWeek = key === 'week';
  const since = Date.now() - 7 * 864e5;
  const intents = history
    .filter((h) => (isWeek ? h.at >= since : dayKey(new Date(h.at)) === key))
    .map((h) => ({ text: h.text, done: h.done }));
  const sig = JSON.stringify([d.tabs, d.intentTabs, d.intentsSet, d.intentsDone, d.todoDone, d.todoTotal, intents.length]);
  // Already writing a summary for this day: let it finish instead of restarting.
  if (!force && summaryInflight && summaryInflight.key === key) return;
  const seq = ++summarySeq;
  summaryAbort?.abort();
  summaryInflight = null;
  const cached = (aiCache.summary || {})[key];
  const isToday = key === dayKey();
  // Today changes with every tab, so reuse an AI summary for 30 minutes unless asked to refresh.
  const fresh = cached && (cached.sig === sig || (isToday && Date.now() - cached.at < 30 * 60 * 1000));

  $('aiSummaryTag').hidden = true;
  if (cached && fresh && !force && (cached.source === 'ai' || !aiReady())) {
    textEl.textContent = cached.text;
    $('aiSummaryTag').hidden = cached.source !== 'ai';
    return;
  }

  const rules = ruleSummary(d, intents);
  textEl.textContent = rules;
  if (!aiReady()) return;

  const facts = {
    tabsOpened: d.tabs,
    tabsWithIntentPercent: Math.round((Math.min(d.intentTabs, d.tabs) / d.tabs) * 100),
    intentsSet: d.intentsSet,
    intentsCompleted: d.intentsDone,
    tasksDone: d.todoDone,
    tasksTotal: d.todoTotal,
    intents: intents.slice(-15),
  };
  const prompt =
    `Facts about the user's ${isWeek ? 'past 7 days' : 'day'} in their browser (JSON): ${JSON.stringify(facts)}\n` +
    `Write a 2-sentence summary of ${isWeek ? 'their week' : 'their day'} for them, addressed as "you". Neutral and kind: no judgement, no advice, ` +
    'no exclamation marks. Mention what most intents were about. Max 40 words.';

  box.classList.add('is-thinking');
  const ctrl = new AbortController();
  summaryAbort = ctrl;
  summaryInflight = { key };
  try {
    let out = '';
    await withBusy(async () => {
      for await (const text of streamAI(prompt, { signal: ctrl.signal })) {
        if (seq !== summarySeq) return;
        out = text;
        textEl.textContent = text;
        textEl.classList.add('ai-caret');
      }
    });
    if (seq !== summarySeq || !out.trim()) return;
    $('aiSummaryTag').hidden = false;
    const summary = { ...(aiCache.summary || {}) };
    summary[key] = { sig, at: Date.now(), text: out.trim(), source: 'ai' };
    // Keep only the last 7 days of summaries.
    Object.keys(summary).sort().slice(0, -7).forEach((k) => delete summary[k]);
    const { aiCache: latest = {} } = await get('aiCache');
    await set({ aiCache: { ...latest, summary } });
  } catch (err) {
    if (err.name !== 'AbortError') console.warn('[Intent Tab] AI summary', err);
    if (seq === summarySeq) textEl.textContent = rules;
  } finally {
    textEl.classList.remove('ai-caret');
    if (seq === summarySeq) {
      box.classList.remove('is-thinking');
      summaryInflight = null;
    }
  }
}

// =========================================================
// 4. Ask AI from the search bar
// =========================================================
let askAbort = null;

function inline(target, s) {
  for (const part of s.split(/(\*\*[^*]+\*\*|`[^`]+`)/)) {
    if (!part) continue;
    if (part.startsWith('**') && part.endsWith('**')) target.append(el('strong', null, part.slice(2, -2)));
    else if (part.startsWith('`') && part.endsWith('`')) target.append(el('code', null, part.slice(1, -1)));
    else target.append(part);
  }
}

// Tiny, safe Markdown: paragraphs, bullet/numbered lists, headings, **bold**, `code`.
function renderMarkdown(target, text) {
  target.textContent = '';
  let list = null;
  for (const raw of text.split('\n')) {
    const line = raw.trimEnd();
    const li = line.match(/^\s*(?:[-*•]|(\d+)[.)])\s+(.*)$/);
    if (li) {
      const tag = li[1] ? 'ol' : 'ul';
      if (!list || list.tagName.toLowerCase() !== tag) { list = el(tag); target.append(list); }
      const item = el('li');
      inline(item, li[2]);
      list.append(item);
      continue;
    }
    list = null;
    if (!line.trim()) continue;
    const h = line.match(/^#{1,4}\s+(.*)$/);
    const p = el(h ? 'h4' : 'p');
    inline(p, h ? h[1] : line);
    target.append(p);
  }
}

export function isAnswerOpen() {
  return !$('aiAnswer').hidden;
}

export function closeAnswer() {
  askAbort?.abort();
  askAbort = null;
  $('aiAnswer').hidden = true;
}

async function runAsk(q) {
  q = q.trim();
  if (!q || !aiReady()) return;
  askAbort?.abort();
  const ctrl = new AbortController();
  askAbort = ctrl;

  const card = $('aiAnswer');
  const body = $('aiAnswerBody');
  $('aiAnswerQ').textContent = q;
  $('aiAnswerGoogle').href = searchUrl(q);
  $('aiAnswerFoot').hidden = true;
  body.textContent = '';
  body.append(el('p', 'ai-shimmer', t('aiThinking')));
  card.hidden = false;
  card.classList.add('is-thinking');

  let out = '';
  try {
    await withBusy(async () => {
      const prompt = `${q}\n\nAnswer concisely (max 140 words). Use short paragraphs or bullet points. If you are not sure, say so.`;
      for await (const text of streamAI(prompt, { signal: ctrl.signal })) {
        if (askAbort !== ctrl) return;
        out = text;
        renderMarkdown(body, text);
        body.lastElementChild?.classList.add('ai-caret');
      }
    });
  } catch (err) {
    if (err.name === 'AbortError') return;
    console.warn('[Intent Tab] Ask AI', err);
    body.textContent = '';
    body.append(el('p', 'muted', t('askError')));
  } finally {
    if (askAbort === ctrl) {
      card.classList.remove('is-thinking');
      body.querySelectorAll('.ai-caret').forEach((x) => x.classList.remove('ai-caret'));
      $('aiAnswerFoot').hidden = false;
      $('aiAnswerCopy').onclick = async () => {
        try { await navigator.clipboard.writeText(out); toastFn(t('askCopied')); } catch { /* ignore */ }
      };
    }
  }
}

function bindAsk() {
  const input = $('searchInput');
  const btn = $('askAiBtn');
  const sync = () => { btn.hidden = !(aiReady() && input.value.trim()); };
  input.addEventListener('input', sync);
  onAIStatus(sync);
  btn.addEventListener('click', () => runAsk(input.value));
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Tab' && !e.shiftKey && aiReady() && input.value.trim()) {
      e.preventDefault();
      runAsk(input.value);
    }
  });
  $('aiAnswerClose').addEventListener('click', closeAnswer);
}

// =========================================================
// Settings section + top-bar badge
// =========================================================
function renderStatus(status) {
  const text = $('aiStatusText');
  const dl = $('aiDownload');
  const prog = $('aiProgress');
  const badge = $('aiBadge');
  const key = {
    available: 'aiStatusReady',
    downloadable: 'aiStatusDownloadable',
    downloading: 'aiStatusDownloading',
    unavailable: 'aiStatusUnavailable',
    off: 'aiStatusOff',
  }[status] || 'aiStatusUnavailable';
  text.textContent = t(key, { pct: Math.round((renderStatus.pct || 0) * 100) });
  dl.hidden = status !== 'downloadable';
  prog.hidden = status !== 'downloading';
  $('aiStatusDot').dataset.state = status;
  badge.hidden = !(status === 'available' || status === 'downloading');
  badge.dataset.state = status;
}

function bindSettings() {
  $('aiDownload').addEventListener('click', async () => {
    try {
      await downloadModel((p) => {
        renderStatus.pct = p;
        $('aiProgressFill').style.width = Math.round(p * 100) + '%';
        renderStatus('downloading');
      });
      toastFn(t('aiStatusReady'));
    } catch (err) {
      console.warn('[Intent Tab] model download', err);
      toastFn(t('aiDownloadFailed'));
    }
  });
  $('aiBadge').addEventListener('click', () => $('settingsBtn').click());
  onAIStatus(renderStatus);
  document.addEventListener('intent:lang', () => renderStatus(currentStatus()));
}

export async function initAssistant(toast) {
  toastFn = toast || toastFn;
  bindSettings();
  bindAsk();
  registerCommands((q) => (q && aiReady() ? [{
    group: 'quick', always: true, rank: 4, icon: 'spark', label: t('palAskAI', { q }),
    run: () => {
      $('searchInput').value = q;
      $('searchInput').dispatchEvent(new Event('input'));
      runAsk(q);
    },
  }] : []));
  renderStatus(currentStatus());
  await refreshStatus();
}
