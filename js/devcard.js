// The "Developer" card on the page: tools, projects and search shortcuts
// one click away (the same things are also in Ctrl+K and Settings).

import { get } from './store.js';
import { t, digits } from './strings.js';
import { openTool } from './tools.js';
import { openManager, openProject, progressOf } from './projects.js';
import { SHORTCUTS } from './search.js';

const $ = (id) => document.getElementById(id);
let started = false;

const TOOL_ICONS = {
  json: '<path d="M8 4c-2 0-2 1.5-2 3s0 3-2 3c2 0 2 1.5 2 3s0 3 2 3 M16 4c2 0 2 1.5 2 3s0 3 2 3c-2 0-2 1.5-2 3s0 3-2 3"/>',
  encode: '<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M17 6l3 3M14 9l2 2"/>',
  time: '<circle cx="12" cy="13" r="7.5"/><path d="M12 9v4l2.5 2M9.5 2.5h5"/>',
  color: '<path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.6-.9 1.2-1.8-.5-1-.1-2.2 1.2-2.2H17a4 4 0 0 0 4-4c0-5.5-4-10-9-10z"/><circle cx="7.5" cy="11" r="1"/><circle cx="10" cy="7" r="1"/><circle cx="15" cy="7.5" r="1"/>',
  gen: '<path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/>',
  regex: '<path d="M17 3v8M13.5 5l7 4M13.5 9l7-4"/><rect x="3" y="15" width="6" height="6" rx="1"/>',
  units: '<path d="M3 17l14-14 4 4L7 21H3z M7 13l2 2M10 10l2 2M13 7l2 2"/>',
};
const SHOWN_SHORTCUTS = ['mdn', 'npm', 'gh', 'so', 'can'];

function icon(paths, size = 16) {
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
}

function favicon(url) {
  const u = new URL(chrome.runtime.getURL('/_favicon/'));
  u.searchParams.set('pageUrl', url);
  u.searchParams.set('size', '32');
  return u.toString();
}

function host(url) {
  try { return new URL(url).host.replace(/^www\./, ''); } catch { return url; }
}

function renderTools() {
  const box = $('devTools');
  box.textContent = '';
  for (const id of Object.keys(TOOL_ICONS)) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'dev-tool';
    b.innerHTML = `<span class="dev-tool-icon">${icon(TOOL_ICONS[id])}</span>`;
    const name = document.createElement('span');
    name.textContent = t('devShort_' + id); // short names fit the 4-column grid
    b.append(name);
    b.title = t('tool_' + id);
    b.addEventListener('click', () => openTool(id));
    box.append(b);
  }
}

async function renderProjects() {
  const { projects = [] } = await get('projects');
  const box = $('devProjects');
  box.textContent = '';
  // Every named project shows up right after it's created, links or not.
  const list = projects.filter((p) => p.name && p.name.trim());
  $('devProjectsEmpty').hidden = list.length > 0;

  for (const p of list) {
    const links = p.links.filter((l) => l.url);
    const row = document.createElement('div');
    row.className = 'dev-proj';
    // Name + progress: click to open the project view.
    const main = document.createElement('button');
    main.type = 'button';
    main.className = 'dev-proj-main';
    main.title = t('projOpen', { name: p.name });
    main.addEventListener('click', () => openProject(p.id));
    const name = document.createElement('span');
    name.className = 'dev-proj-name';
    name.textContent = p.name;
    const pr = progressOf(p);
    const meta = document.createElement('span');
    meta.className = 'dev-proj-meta';
    if (pr.total) {
      const bar = document.createElement('span');
      bar.className = 'dev-proj-bar';
      const fill = document.createElement('i');
      fill.style.width = pr.pct + '%';
      bar.append(fill);
      const count = document.createElement('span');
      count.textContent = digits(`${pr.done}/${pr.total}`);
      meta.append(bar, count);
    } else {
      meta.textContent = t('devProjNoTasks');
      meta.classList.add('is-empty');
    }
    main.append(name, meta);
    const icons = document.createElement('div');
    icons.className = 'dev-proj-links';
    for (const l of links.slice(0, 3)) {
      const a = document.createElement('a');
      a.className = 'dev-link';
      a.href = l.url;
      a.title = `${l.label || host(l.url)} — ${host(l.url)}`;
      a.setAttribute('aria-label', `${p.name}: ${l.label || host(l.url)}`);
      const img = document.createElement('img');
      img.src = favicon(l.url);
      img.alt = '';
      a.append(img);
      icons.append(a);
    }
    const all = document.createElement('button');
    all.type = 'button';
    all.className = 'dev-open-all';
    all.title = t('projOpenAll', { name: p.name, n: links.length });
    all.setAttribute('aria-label', all.title);
    all.innerHTML = icon('<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>', 14);
    all.addEventListener('click', () => links.forEach((l, i) => chrome.tabs.create({ url: l.url, active: i === 0 })));
    row.append(main, icons);
    if (links.length > 1) row.append(all);
    box.append(row);
  }
}

function renderShortcuts() {
  const box = $('devShortcuts');
  box.textContent = '';
  for (const key of SHOWN_SHORTCUTS) {
    const s = SHORTCUTS.find((x) => x.key === key);
    if (!s) continue;
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'dev-sc';
    b.textContent = key;
    b.title = s.name;
    b.addEventListener('click', () => {
      const input = $('searchInput');
      input.value = key + ' ';
      input.focus();
      input.dispatchEvent(new Event('input'));
    });
    box.append(b);
  }
}

function render() {
  renderTools();
  renderProjects();
  renderShortcuts();
}

export async function initDevCard() {
  if (started) return;
  started = true;
  $('devManage').addEventListener('click', () => openManager());
  $('devAddProject').addEventListener('click', () => openManager());
  chrome.storage.onChanged.addListener((c, a) => { if (a === 'local' && c.projects) renderProjects(); });
  document.addEventListener('intent:lang', render);
  render();
}
