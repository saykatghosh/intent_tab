// Project switcher: keep each project's links (repo, staging, production,
// design, tracker…) together. Type the project name in Ctrl+K to open any of them.
// Stored as `projects`: [{ id, name, links: [{ label, url }] }]

import { get, set, uid } from './store.js';
import { t } from './strings.js';
import { registerCommands } from './palette.js';

const $ = (id) => document.getElementById(id);
const TEMPLATE = ['Repo', 'Local', 'Staging', 'Production', 'Design', 'Tracker'];
const X_SVG = '<svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
let projects = [];
let saveTimer = 0;
let toastFn = () => {};

function favicon(url) {
  const u = new URL(chrome.runtime.getURL('/_favicon/'));
  u.searchParams.set('pageUrl', url);
  u.searchParams.set('size', '16');
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

function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => set({ projects }), 300);
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
  const p = { id: uid(), name, links: TEMPLATE.map((label) => ({ label, url: '' })) };
  projects.push(p);
  save();
  openManager(p.id);
}

export function openManager(focusId) {
  renderDialog(focusId);
  if (!$('projDialog').open) $('projDialog').showModal();
}

// ---------- Init ----------
export async function initProjects(toast) {
  toastFn = toast || toastFn;
  const { projects: saved = [] } = await get('projects');
  projects = saved;
  chrome.storage.onChanged.addListener((c, a) => {
    if (a === 'local' && c.projects && !$('projDialog').open) projects = c.projects.newValue || [];
  });
  $('projAdd').addEventListener('click', () => newProject(''));
  $('projDone').addEventListener('click', () => $('projDialog').close());
  $('projDialog').addEventListener('close', () => {
    clearTimeout(saveTimer);
    // Drop empty links; keep projects that have a name or a link.
    projects = projects
      .map((p) => ({ ...p, links: p.links.filter((l) => l.url) }))
      .filter((p) => p.name.trim() || p.links.length);
    set({ projects });
  });
  $('projDialog').addEventListener('click', (e) => { if (e.target === $('projDialog')) $('projDialog').close(); });
  $('projectsBtn').addEventListener('click', () => openManager());

  registerCommands((q) => {
    const out = [];
    for (const p of projects) {
      const links = p.links.filter((l) => l.url);
      if (!links.length || !p.name) continue;
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
