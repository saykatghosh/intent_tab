// Projects: keep each project's links (repo, staging, production, design,
// tracker…) and its tasks together, with a progress bar.
//   • Developer card: one row per project → click it to open the project view
//   • Project view (popup): links, tasks, progress
//   • Manage dialog: name + links
//   • Ctrl+K: type the project name to open it or any of its links
// Stored as `projects`: [{ id, name, links: [{ label, url }], tasks: [{ id, text, done }] }]

import { get, set, uid } from './store.js';
import { t, digits } from './strings.js';
import { registerCommands } from './palette.js';

const $ = (id) => document.getElementById(id);
const TEMPLATE = ['Repo', 'Local', 'Staging', 'Production', 'Design', 'Tracker'];
const X_SVG = '<svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
let projects = [];
let saveTimer = 0;
let toastFn = () => {};
let viewId = null; // project open in the project view

function favicon(url, size = 16) {
  const u = new URL(chrome.runtime.getURL('/_favicon/'));
  u.searchParams.set('pageUrl', url);
  u.searchParams.set('size', String(size));
  return u.toString();
}

function host(url) {
  try { const u = new URL(url); return u.host.replace(/^www\./, ''); } catch { return url; }
}

// "localhost:3000" → http://…, "github.com/me/app" → https://…
export function normalizeLink(raw) {
  let s = String(raw || '').trim();
  if (!s) return '';
  // "localhost:3000" looks like a scheme, so only "xyz://" or a few known schemes count as one.
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(s) && !/^(mailto|tel|chrome|about|file|data|vscode):/i.test(s)) {
    s = (/^(localhost|127\.0\.0\.1|\[::1\]|0\.0\.0\.0)(:\d+)?(\/|$)/i.test(s) ? 'http://' : 'https://') + s;
  }
  try { return new URL(s).href; } catch { return ''; }
}

// Tasks done / total, and the percentage (0 when there are no tasks).
export function progressOf(p) {
  const tasks = (p && p.tasks) || [];
  const done = tasks.filter((x) => x.done).length;
  return { done, total: tasks.length, pct: tasks.length ? Math.round((done / tasks.length) * 100) : 0 };
}

function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flush, 300);
}

function flush() {
  clearTimeout(saveTimer);
  saveTimer = 0;
  return set({ projects });
}

function openLinks(p) {
  const urls = p.links.map((l) => l.url).filter(Boolean);
  urls.forEach((url, i) => chrome.tabs.create({ url, active: i === 0 }));
}

// ---------- Manage dialog ----------
function linkRow(p, link) {
  const row = document.createElement('div');
  row.className = 'proj-link';
  const label = document.createElement('input');
  label.type = 'text';
  label.className = 'proj-label';
  label.value = link.label;
  label.placeholder = t('projLinkLabel');
  label.setAttribute('aria-label', t('projLinkLabel'));
  label.addEventListener('input', () => { link.label = label.value; save(); });
  const url = document.createElement('input');
  url.type = 'text';
  url.className = 'proj-url';
  url.value = link.url;
  url.placeholder = 'github.com/you/app · localhost:3000';
  url.setAttribute('aria-label', t('projLinkUrl'));
  url.addEventListener('input', () => { link.url = normalizeLink(url.value); save(); });
  url.addEventListener('blur', () => { if (url.value.trim()) url.value = link.url || url.value; });
  const del = document.createElement('button');
  del.type = 'button';
  del.className = 'proj-x';
  del.innerHTML = X_SVG;
  del.setAttribute('aria-label', t('ctxDelete'));
  del.addEventListener('click', () => { p.links = p.links.filter((l) => l !== link); save(); renderDialog(); });
  row.append(label, url, del);
  return row;
}

function renderDialog(focusId) {
  const list = $('projList');
  list.textContent = '';
  $('projEmpty').hidden = projects.length > 0;
  for (const p of projects) {
    const card = document.createElement('section');
    card.className = 'proj-card';
    const head = document.createElement('div');
    head.className = 'proj-head';
    const name = document.createElement('input');
    name.type = 'text';
    name.className = 'proj-name';
    name.value = p.name;
    name.placeholder = t('projNamePlaceholder');
    name.setAttribute('aria-label', t('projName'));
    name.addEventListener('input', () => { p.name = name.value; save(); });
    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'link-btn small';
    del.textContent = t('projDelete');
    del.addEventListener('click', () => {
      if (!confirm(t('projDeleteConfirm', { name: p.name || t('projUntitled') }))) return;
      projects = projects.filter((x) => x !== p);
      save();
      renderDialog();
    });
    head.append(name, del);
    card.append(head);
    p.links.forEach((l) => card.append(linkRow(p, l)));
    const add = document.createElement('button');
    add.type = 'button';
    add.className = 'link-btn small proj-add-link';
    add.textContent = '+ ' + t('projAddLink');
    add.addEventListener('click', () => {
      p.links.push({ label: '', url: '' });
      save();
      renderDialog();
      list.querySelector(`[data-pid="${p.id}"] .proj-link:last-of-type .proj-label`)?.focus();
    });
    card.dataset.pid = p.id;
    card.append(add);
    list.append(card);
    if (focusId === p.id) setTimeout(() => name.focus(), 0);
  }
}

function newProject(name = '') {
  const p = { id: uid(), name, links: TEMPLATE.map((label) => ({ label, url: '' })), tasks: [] };
  projects.push(p);
  save();
  openManager(p.id);
}

export function openManager(focusId) {
  renderDialog(focusId);
  if (!$('projDialog').open) $('projDialog').showModal();
}

// ---------- Project view (popup) ----------
function current() {
  return projects.find((p) => p.id === viewId) || null;
}

function taskItem(p, task) {
  const li = document.createElement('li');
  li.className = 'pv-task' + (task.done ? ' is-done' : '');
  const label = document.createElement('label');
  const box = document.createElement('input');
  box.type = 'checkbox';
  box.checked = !!task.done;
  box.addEventListener('change', () => { task.done = box.checked; save(); renderView(); });
  const text = document.createElement('span');
  text.textContent = task.text;
  label.append(box, text);
  const del = document.createElement('button');
  del.type = 'button';
  del.className = 'proj-x';
  del.innerHTML = X_SVG;
  del.setAttribute('aria-label', `${t('ctxDelete')}: ${task.text}`);
  del.addEventListener('click', () => { p.tasks = p.tasks.filter((x) => x !== task); save(); renderView(); });
  li.append(label, del);
  return li;
}

function renderView() {
  const p = current();
  if (!p) { if ($('projView').open) $('projView').close(); return; }
  p.tasks = p.tasks || [];
  const links = p.links.filter((l) => l.url);
  const pr = progressOf(p);

  $('pvName').textContent = p.name || t('projUntitled');
  $('pvMeta').textContent = digits(t('pvMeta', { links: links.length, done: pr.done, total: pr.total }));
  $('pvRing').style.setProperty('--p', pr.pct);
  $('pvRing').classList.toggle('is-full', pr.total > 0 && pr.done === pr.total);
  $('pvPct').textContent = digits(pr.pct + '%');
  $('pvBarFill').style.width = pr.pct + '%';
  $('pvCount').textContent = pr.total ? digits(t('pvCount', { done: pr.done, total: pr.total })) : '';

  // links
  const box = $('pvLinks');
  box.textContent = '';
  for (const l of links) {
    const a = document.createElement('a');
    a.className = 'pv-link';
    a.href = l.url;
    a.title = l.url;
    const img = document.createElement('img');
    img.src = favicon(l.url, 32);
    img.alt = '';
    const body = document.createElement('span');
    body.className = 'pv-link-body';
    const name = document.createElement('span');
    name.className = 'pv-link-name';
    name.textContent = l.label || host(l.url);
    const h = document.createElement('span');
    h.className = 'pv-link-host';
    h.textContent = host(l.url);
    body.append(name, h);
    a.append(img, body);
    box.append(a);
  }
  $('pvNoLinks').hidden = links.length > 0;
  $('pvOpenAll').hidden = links.length < 2;
  $('pvOpenAll').textContent = t('pvOpenAll', { n: links.length });

  // tasks: open ones first, finished ones below
  const list = $('pvTasks');
  list.textContent = '';
  [...p.tasks.filter((x) => !x.done), ...p.tasks.filter((x) => x.done)].forEach((task) => list.append(taskItem(p, task)));
  $('pvNoTasks').hidden = p.tasks.length > 0;
}

export function openProject(id) {
  viewId = id;
  if (!current()) return;
  renderView();
  if (!$('projView').open) $('projView').showModal();
  setTimeout(() => $('pvTaskInput').focus(), 0);
}

function bindView() {
  const dlg = $('projView');
  $('pvClose').addEventListener('click', () => dlg.close());
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
  dlg.addEventListener('close', () => { if (saveTimer) flush(); viewId = null; });
  $('pvEdit').addEventListener('click', () => { const id = viewId; dlg.close(); openManager(id); });
  $('pvOpenAll').addEventListener('click', () => { const p = current(); if (p) openLinks(p); });
  $('pvTaskForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const p = current();
    const input = $('pvTaskInput');
    const text = input.value.trim();
    if (!p || !text) return;
    p.tasks = p.tasks || [];
    p.tasks.push({ id: uid(), text, done: false });
    input.value = '';
    save();
    renderView();
  });
}

// ---------- Init ----------
export async function initProjects(toast) {
  toastFn = toast || toastFn;
  const { projects: saved = [] } = await get('projects');
  projects = saved;
  chrome.storage.onChanged.addListener((c, a) => {
    // Changes from another tab; ignore while we're editing here (our own pending save wins).
    if (a !== 'local' || !c.projects || $('projDialog').open || saveTimer) return;
    projects = c.projects.newValue || [];
    if ($('projView').open) renderView();
  });
  $('projAdd').addEventListener('click', () => newProject(''));
  $('projDone').addEventListener('click', () => $('projDialog').close());
  $('projDialog').addEventListener('close', () => {
    // Drop empty links; keep projects that have a name, a link or a task.
    projects = projects
      .map((p) => ({ ...p, links: p.links.filter((l) => l.url), tasks: p.tasks || [] }))
      .filter((p) => p.name.trim() || p.links.length || p.tasks.length);
    flush();
  });
  $('projDialog').addEventListener('click', (e) => { if (e.target === $('projDialog')) $('projDialog').close(); });
  $('projectsBtn').addEventListener('click', () => openManager());
  bindView();

  registerCommands((q) => {
    const out = [];
    for (const p of projects) {
      if (!p.name) continue;
      const pr = progressOf(p);
      out.push({
        group: 'projects', icon: 'folder', label: t('projOpen', { name: p.name }),
        hint: pr.total ? digits(`${pr.done}/${pr.total}`) : '',
        keywords: `${p.name} project open tasks progress`, run: () => openProject(p.id),
      });
      const links = p.links.filter((l) => l.url);
      for (const l of links) {
        out.push({
          group: 'projects', img: favicon(l.url),
          label: `${p.name} › ${l.label || host(l.url)}`, hint: host(l.url),
          keywords: `${p.name} ${l.label} ${l.url} project`,
          run: () => { location.href = l.url; },
        });
      }
      if (links.length > 1) {
        out.push({
          group: 'projects', icon: 'folder', label: t('projOpenAll', { name: p.name, n: links.length }),
          keywords: `${p.name} project open all`, run: () => openLinks({ ...p, links }),
        });
      }
    }
    out.push({ group: 'actions', icon: 'folder', label: t('projManage'), keywords: 'projects manage edit links', run: () => openManager() });
    out.push({
      group: 'actions', icon: 'plus', label: q ? t('projNewNamed', { q }) : t('projNew'), keywords: 'project new create',
      run: () => newProject(q || ''),
    });
    return out;
  });
}
