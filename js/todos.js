import { get, set, updateDay, dayKey, daysAgo, uid } from './store.js';
import { t, locale } from './strings.js';
import { burstFrom, collapseOut } from './effects.js';
import { registerCommands } from './palette.js';

const $ = (id) => document.getElementById(id);
let todos = [];
let started = false;
const fx = { added: null, checked: null, chartDrawn: false }; // which items to animate on the next render

// Today's list = every open task + tasks finished today.
// Tasks finished on an earlier day are cleared away.
function cleanup(list) {
  const today = dayKey();
  return list.filter((x) => !x.done || dayKey(new Date(x.doneAt)) === today);
}

function counts() {
  const total = todos.length;
  const done = todos.filter((x) => x.done).length;
  return { total, done, pct: total ? Math.round((done / total) * 100) : 0 };
}

export async function initTodos() {
  if (started) return;
  started = true;
  const { todos: saved = [] } = await get('todos');
  todos = cleanup(saved);
  await save();

  $('todoForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = $('todoInput').value.trim();
    if (!text) return;
    $('todoInput').value = '';
    await addTodo(text);
  });

  // Command palette: add a task, or tick / untick one.
  registerCommands((q) => {
    const out = [];
    if (q) out.push({ group: 'quick', always: true, rank: 3, icon: 'plus', label: t('palAddTodo', { q }), run: () => addTodo(q) });
    for (const item of todos) {
      out.push({
        group: 'todos', icon: item.done ? 'undo' : 'check', label: item.text,
        hint: item.done ? t('palUndoDone') : t('palMarkDone'), keywords: 'todo task',
        run: () => toggleTodo(item.id),
      });
    }
    return out;
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes.todos) {
      const next = cleanup(changes.todos.newValue || []);
      // Our own writes echo back here; only redraw when another tab changed the list.
      if (JSON.stringify(next) !== JSON.stringify(todos)) { todos = next; render(); }
    }
    if (changes.days) renderWeek();
  });
  document.addEventListener('intent:lang', render);
}

async function addTodo(text) {
  text = String(text || '').trim();
  if (!text) return;
  const id = uid();
  todos.push({ id, text, done: false, createdAt: Date.now(), doneAt: null });
  fx.added = id;
  await save();
}

async function toggleTodo(id) {
  const item = todos.find((x) => x.id === id);
  if (!item) return;
  const before = counts();
  item.done = !item.done;
  item.doneAt = item.done ? Date.now() : null;
  fx.checked = item.done ? item.id : null;
  await save();
  const after = counts();
  if (after.total > 0 && after.pct === 100 && before.pct < 100) burstFrom($('todoBar'), { count: 30, spread: 110 });
}

async function save() {
  const { total, done } = counts();
  await set({ todos });
  await updateDay((d) => { d.todoDone = done; d.todoTotal = total; });
  render();
}

function render() {
  const list = $('todoList');
  list.textContent = '';
  for (const item of todos) {
    const li = document.createElement('li');
    li.className = 'todo-item' + (item.done ? ' is-done' : '');
    if (fx.added === item.id) li.classList.add('is-new');
    if (fx.checked === item.id && item.done) li.classList.add('just-done');

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.id = 'todo-' + item.id;
    cb.checked = item.done;
    cb.addEventListener('change', async () => {
      const before = counts();
      item.done = cb.checked;
      item.doneAt = cb.checked ? Date.now() : null;
      fx.checked = cb.checked ? item.id : null;
      await save();
      const after = counts();
      if (after.total > 0 && after.pct === 100 && before.pct < 100) burstFrom($('todoBar'), { count: 30, spread: 110 });
    });

    const label = document.createElement('label');
    label.htmlFor = cb.id;
    const text = document.createElement('span');
    text.className = 'todo-text';
    text.textContent = item.text;
    label.append(text);

    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'todo-del';
    del.setAttribute('aria-label', t('todoDelete'));
    del.title = t('todoDelete');
    del.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
    del.addEventListener('click', async () => {
      await collapseOut(li);
      todos = todos.filter((x) => x.id !== item.id);
      await save();
    });

    li.append(cb, label, del);
    list.append(li);
  }
  fx.added = null;
  fx.checked = null;

  const { total, done, pct } = counts();
  $('todoEmpty').hidden = total > 0;
  $('todoBar').style.width = pct + '%';
  $('todoProgressText').textContent = total ? t('todoProgress', { done, total, pct }) : '';
  renderWeek();
}

async function renderWeek() {
  const { days = {} } = await get('days');
  const chart = $('weekChart');
  const tip = $('chartTip');
  const lang = locale();

  // Skip the redraw when nothing changed (keeps hover state and the grow animation intact).
  const sig = lang + '|' + dayKey() + '|' + JSON.stringify(counts()) + '|' +
    [1, 2, 3, 4, 5, 6].map((i) => { const d = days[dayKey(daysAgo(i))] || {}; return `${d.todoDone || 0}/${d.todoTotal || 0}`; }).join(',');
  if (sig === fx.chartSig) return;
  fx.chartSig = sig;

  chart.textContent = '';
  tip.hidden = true;
  // Bars grow in only the first time the chart is drawn.
  chart.classList.toggle('grow', !fx.chartDrawn);
  fx.chartDrawn = true;
  const summary = [];

  for (let i = 6; i >= 0; i--) {
    const date = daysAgo(i);
    const key = dayKey(date);
    const rec = i === 0 ? counts() : (() => {
      const d = days[key] || {};
      const total = d.todoTotal || 0;
      const done = d.todoDone || 0;
      return { total, done, pct: total ? Math.round((done / total) * 100) : 0 };
    })();

    const dayName = date.toLocaleDateString(lang, { weekday: 'short' });
    const label = rec.total
      ? t('todoBarTitle', { day: dayName, done: rec.done, total: rec.total, pct: rec.pct })
      : t('todoBarEmpty', { day: dayName });
    summary.push(label);

    const col = document.createElement('div');
    col.className = 'bar-col' + (i === 0 ? ' is-today' : '');
    col.tabIndex = 0;
    col.setAttribute('aria-label', label);

    const hit = document.createElement('div');
    hit.className = 'bar-hit';
    const bar = document.createElement('div');
    bar.className = 'bar' + (rec.total && rec.pct > 0 ? '' : ' is-empty');
    bar.style.height = (rec.total && rec.pct > 0 ? Math.max(4, rec.pct) : 3) + '%';
    bar.style.setProperty('--i', 6 - i);
    hit.append(bar);

    const lab = document.createElement('div');
    lab.className = 'bar-label';
    lab.textContent = date.toLocaleDateString(lang, { weekday: 'narrow' });

    const showTip = () => {
      tip.textContent = label;
      tip.hidden = false;
      const left = col.offsetLeft + col.offsetWidth / 2;
      const max = chart.offsetWidth;
      const half = tip.offsetWidth / 2;
      tip.style.left = Math.min(Math.max(left, half), max - half) + 'px';
    };
    const hideTip = () => { tip.hidden = true; };
    col.addEventListener('mouseenter', showTip);
    col.addEventListener('focus', showTip);
    col.addEventListener('mouseleave', hideTip);
    col.addEventListener('blur', hideTip);

    col.append(hit, lab);
    chart.append(col);
  }
  chart.setAttribute('aria-label', t('todoWeek') + ': ' + summary.join('; '));
}
