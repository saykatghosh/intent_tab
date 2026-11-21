// Bookmarks bar at the top of the page (like Chrome's own bar) + Most visited grid.
import { t } from './strings.js';
import { bookmarksManagerUrl } from './browser.js';
import { get, set } from './store.js';
import { openIconDialog, paintIcon, iconFor, displayTitle, effectiveIcon, onIconsChanged, moveIcon, leadingEmoji } from './icons.js';
import { showContextMenu, isContextMenuOpen } from './contextmenu.js';
import { registerCommands } from './palette.js';

const $ = (id) => document.getElementById(id);
const FOLDER_SVG = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M3.5 7.5a2 2 0 0 1 2-2h4l2 2h7a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>';
const FOLDER_SVG_BIG = FOLDER_SVG.replace(/width="16" height="16"/, 'width="20" height="20"');
const PLUS_SVG = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
const BACK_SVG = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M15 6l-6 6 6 6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const CHEVRON_SVG = '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const EDIT_SVG = '<svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>';
const TOP_SITES_MAX = 10;

let toastFn = () => {};
let bmStarted = false;
let tsStarted = false;
let rootIds = { bar: '1', others: [] };
let overflowNodes = [];
const menu = { stack: [], anchor: null }; // stack of { id, title } or { title, nodes }
let addTarget = null;                       // { id, title } folder the add dialog saves into

export function faviconUrl(pageUrl, size = 32) {
  const url = new URL(chrome.runtime.getURL('/_favicon/'));
  url.searchParams.set('pageUrl', pageUrl);
  url.searchParams.set('size', String(size));
  return url.toString();
}

function hostOf(u) {
  try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return u; }
}

const faviconFallback = (href, size) => (el) => {
  const img = document.createElement('img');
  img.src = faviconUrl(href, size);
  img.alt = '';
  img.loading = 'lazy';
  el.append(img);
};
const folderFallback = (svg) => (el) => { el.innerHTML = svg; };

// Root folders (Bookmarks bar, Other bookmarks, Mobile) can't be renamed.
function canRename(node) {
  return node.parentId && node.parentId !== '0';
}

function editIcon(node, title, fallback) {
  closeMenu();
  openIconDialog({ key: 'bm:' + node.id, bookmarkId: canRename(node) ? node.id : null, title: title || node.title || hostOf(node.url || ''), rawTitle: node.title, fallback });
}

// =========================================================
// Right-click menu (Chrome-style)
// =========================================================
const MORE_SVG = '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><circle cx="6" cy="12" r="1.6" fill="currentColor"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/><circle cx="18" cy="12" r="1.6" fill="currentColor"/></svg>';

// Mouse right-click opens at the pointer; keyboard (Menu key / Shift+F10) under the element.
function ctxPoint(e, el) {
  return e && (e.clientX || e.clientY) ? { x: e.clientX, y: e.clientY } : el;
}

function openUrls(urls, where) {
  if (!urls.length) return;
  if (where === 'tab') {
    urls.forEach((url, i) => chrome.tabs.create({ url, active: i === 0 && urls.length === 1 }));
  } else {
    chrome.windows.create({ url: urls, incognito: where === 'incognito' });
  }
}

async function folderUrls(id) {
  const [n] = await chrome.bookmarks.getSubTree(id);
  return (n.children || []).filter((c) => c.url && !c.url.startsWith('javascript:')).map((c) => c.url);
}

async function openBookmarkMenu(e, node, el) {
  if (e) { e.preventDefault(); e.stopPropagation(); }
  const isFolder = !node.url;
  const key = 'bm:' + node.id;
  const title = displayTitle(key, node.title) || (isFolder ? '' : hostOf(node.url));
  const fallback = isFolder ? folderFallback(FOLDER_SVG_BIG) : faviconFallback(node.url, 32);
  const editable = canRename(node);
  // New pages/folders go next to a bookmark, or inside a folder.
  const parent = isFolder ? { id: node.id, title } : { id: node.parentId, title: await folderTitle(node.parentId) };

  let items;
  if (isFolder) {
    const urls = await folderUrls(node.id);
    const n = urls.length;
    items = [
      { label: t('ctxOpenAll', { n }), icon: 'openAll', disabled: !n, run: () => openUrls(urls, 'tab') },
      { label: t('ctxOpenAllWindow'), icon: 'window', disabled: !n, run: () => openUrls(urls, 'window') },
      { label: t('ctxOpenAllIncognito'), icon: 'incognito', disabled: !n, run: () => openUrls(urls, 'incognito') },
      'sep',
      { label: t('ctxRename'), icon: 'edit', disabled: !editable, run: () => openEditDialog(node) },
      { label: t('ctxChangeIcon'), icon: 'icon', run: () => editIcon(node, title, fallback) },
      { label: t('ctxDelete'), icon: 'trash', danger: true, disabled: !editable, run: () => deleteNode(node) },
    ];
  } else {
    items = [
      { label: t('ctxOpenNewTab'), icon: 'tab', run: () => openUrls([node.url], 'tab') },
      { label: t('ctxOpenNewWindow'), icon: 'window', run: () => openUrls([node.url], 'window') },
      { label: t('ctxOpenIncognito'), icon: 'incognito', run: () => openUrls([node.url], 'incognito') },
      'sep',
      { label: t('ctxEdit'), icon: 'edit', run: () => openEditDialog(node) },
      { label: t('ctxChangeIcon'), icon: 'icon', run: () => editIcon(node, title, fallback) },
      { label: t('ctxCopyLink'), icon: 'copy', run: () => copyLink(node.url) },
      { label: t('ctxDelete'), icon: 'trash', danger: true, run: () => deleteNode(node) },
    ];
  }
  items.push(
    'sep',
    { label: t('ctxAddPage'), icon: 'page', run: () => { closeMenu(); openAddDialog(parent, 'bookmark'); } },
    { label: t('ctxAddFolder'), icon: 'folder', run: () => { closeMenu(); openAddDialog(parent, 'folder'); } },
    'sep',
    { label: t('ctxManager'), icon: 'manager', run: () => chrome.tabs.create({ url: bookmarksManagerUrl(isFolder ? node.id : node.parentId) }) },
  );
  showContextMenu(ctxPoint(e, el), items);
}

async function folderTitle(id) {
  try {
    const [f] = await chrome.bookmarks.get(id);
    return displayTitle('bm:' + id, f.title) || t('bookmarksRoot');
  } catch {
    return t('bookmarksRoot');
  }
}

async function copyLink(url) {
  try {
    await navigator.clipboard.writeText(url);
    toastFn(t('linkCopied'));
  } catch {
    toastFn(url);
  }
}

// ---------- Delete with Undo ----------
async function deleteNode(node) {
  const [snapshot] = await chrome.bookmarks.getSubTree(node.id);
  const key = 'bm:' + node.id;
  const name = displayTitle(key, node.title) || hostOf(node.url || '') || t('bmKindFolder');
  if (snapshot.children) await chrome.bookmarks.removeTree(node.id);
  else await chrome.bookmarks.remove(node.id);

  toastFn(t('deletedItem', { name }), {
    label: t('undo'),
    run: async () => {
      await restoreNode(snapshot, snapshot.parentId, snapshot.index);
      toastFn(t('restored'));
    },
  });
}

// Recreate a deleted bookmark/folder (with everything inside) and keep its custom icons.
async function restoreNode(n, parentId, index) {
  const created = await chrome.bookmarks.create({ parentId, index, title: n.title, ...(n.url ? { url: n.url } : {}) });
  await moveIcon('bm:' + n.id, 'bm:' + created.id);
  for (const c of n.children || []) await restoreNode(c, created.id);
  return created;
}

// =========================================================
// Drag & drop (reorder, move into folders, drop links from pages)
// =========================================================
const DND_TYPE = 'application/x-intent-bookmark';
const SPRING_MS = 700; // hover a folder this long while dragging to open it
let drag = null;       // { id, node } while dragging one of our items
let dropSpot = null;   // { parentId, index?, targetId? }
let spring = { el: null, timer: 0 };

function canAccept(e) {
  const types = [...(e.dataTransfer?.types || [])];
  return types.includes(DND_TYPE) || types.includes('text/uri-list');
}

function makeDraggable(el, node) {
  if (!canRename(node)) return; // Chrome's root folders can't be moved
  el.draggable = true;
  el.addEventListener('dragstart', (e) => {
    drag = { id: node.id, node };
    e.dataTransfer.effectAllowed = 'copyMove';
    e.dataTransfer.setData(DND_TYPE, node.id);
    if (node.url) {
      e.dataTransfer.setData('text/uri-list', node.url);
      e.dataTransfer.setData('text/plain', node.url);
    } else {
      e.dataTransfer.setData('text/plain', node.title || '');
    }
    requestAnimationFrame(() => el.classList.add('is-dragging'));
  });
  el.addEventListener('dragend', () => {
    el.classList.remove('is-dragging');
    drag = null;
    clearDrop();
  });
}

// Where would a drop on `el` (showing `node`) land? axis: 'x' for the bar, 'y' for menus.
function spotFor(e, el, node, axis) {
  const r = el.getBoundingClientRect();
  const pos = axis === 'x' ? (e.clientX - r.left) / r.width : (e.clientY - r.top) / r.height;
  const isFolder = !node.url;
  if (isFolder && (!canRename(node) || (pos > 0.25 && pos < 0.75))) {
    return { mode: 'into', parentId: node.id, targetId: node.id };
  }
  const after = pos >= 0.5;
  return { mode: after ? 'after' : 'before', parentId: node.parentId, index: node.index + (after ? 1 : 0), targetId: node.id };
}

function showDrop(spot, el, axis) {
  const line = $('dropLine');
  document.querySelectorAll('.drop-into').forEach((x) => { if (x !== el) x.classList.remove('drop-into'); });
  if (spot.mode === 'into') {
    el.classList.add('drop-into');
    line.hidden = true;
    return;
  }
  el.classList.remove('drop-into');
  const r = el.getBoundingClientRect();
  line.hidden = false;
  if (axis === 'x') {
    const x = spot.mode === 'after' || spot.mode === 'end' ? r.right + 1 : r.left - 1;
    Object.assign(line.style, { left: x - 1 + 'px', top: r.top + 4 + 'px', width: '2px', height: r.height - 8 + 'px' });
  } else {
    const y = spot.mode === 'after' ? r.bottom : r.top;
    Object.assign(line.style, { left: r.left + 8 + 'px', top: y - 1 + 'px', width: r.width - 16 + 'px', height: '2px' });
  }
}

function clearDrop() {
  $('dropLine').hidden = true;
  document.querySelectorAll('.drop-into').forEach((x) => x.classList.remove('drop-into'));
  clearTimeout(spring.timer);
  spring = { el: null, timer: 0 };
  dropSpot = null;
}

// Hovering a folder while dragging opens it (like Chrome).
function springOpen(el, open) {
  if (spring.el === el) return;
  clearTimeout(spring.timer);
  spring = { el, timer: setTimeout(open, SPRING_MS) };
}

function attachDrop(el, node, axis) {
  el.addEventListener('dragover', (e) => {
    if (!canAccept(e)) return;
    const spot = spotFor(e, el, node, axis);
    if (drag && spot.targetId === drag.id) { clearDrop(); return; } // onto itself
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = drag ? 'move' : 'copy';
    dropSpot = spot;
    showDrop(spot, el, axis);

    if (spot.mode === 'into' && !node.url) {
      if (axis === 'x') {
        springOpen(el, () => { if (menu.anchor !== el) toggleMenu({ id: node.id, title: displayTitle('bm:' + node.id, node.title) }, el); });
      } else {
        springOpen(el, async () => {
          menu.stack.push({ id: node.id, title: displayTitle('bm:' + node.id, node.title) });
          await renderMenu();
        });
      }
    } else if (spring.el) {
      clearTimeout(spring.timer);
      spring = { el: null, timer: 0 };
    }
  });
  el.addEventListener('drop', onDrop);
}

async function onDrop(e) {
  if (!canAccept(e)) return;
  e.preventDefault();
  e.stopPropagation();
  const spot = dropSpot;
  clearDrop();
  if (!spot) return;
  const dest = { parentId: spot.parentId };
  if (Number.isInteger(spot.index)) dest.index = spot.index;
  try {
    if (drag) {
      if (spot.parentId === drag.id) return;
      await chrome.bookmarks.move(drag.id, dest);
    } else {
      // A link dragged in from a web page or the address bar.
      const list = (e.dataTransfer.getData('text/uri-list') || '').split(/\r?\n/).find((l) => l && !l.startsWith('#'));
      const url = normalizeUrl(list || e.dataTransfer.getData('text/plain') || '');
      if (!url) return;
      let title = '';
      const html = e.dataTransfer.getData('text/html');
      if (html) title = new DOMParser().parseFromString(html, 'text/html').body.textContent.trim().slice(0, 120);
      await chrome.bookmarks.create({ ...dest, title: title || hostOf(url), url });
      toastFn(t('bmSaved'));
    }
  } catch (err) {
    console.warn('[Intent Tab] drop failed', err);
    toastFn(t('bmMoveFailed'));
  } finally {
    // The dragged element may be redrawn before `dragend` fires, so reset here too.
    drag = null;
  }
}

function bindDropZones() {
  // Empty space at the end of the bar → append to the Bookmarks bar.
  const bar = $('bookmarksModule');
  bar.addEventListener('dragover', (e) => {
    if (!canAccept(e)) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = drag ? 'move' : 'copy';
    const visible = [...$('bmbarItems').children].filter((x) => !x.hidden);
    const last = visible[visible.length - 1];
    dropSpot = { mode: 'end', parentId: rootIds.bar };
    if (last) showDrop(dropSpot, last, 'x');
    else clearDrop();
  });
  bar.addEventListener('drop', onDrop);

  // » button: hover to open the overflow list.
  $('bmbarMore').addEventListener('dragover', (e) => {
    if (!canAccept(e)) return;
    e.preventDefault();
    e.stopPropagation();
    springOpen($('bmbarMore'), () => { if (menu.anchor !== $('bmbarMore')) toggleMenu({ title: t('bmMore'), nodes: overflowNodes }, $('bmbarMore')); });
  });

  // Empty space inside an open folder menu → into that folder.
  const m = $('bmMenu');
  m.addEventListener('dragover', (e) => {
    const cur = menu.stack[menu.stack.length - 1];
    if (!canAccept(e) || !cur || !cur.id) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = drag ? 'move' : 'copy';
    $('dropLine').hidden = true;
    dropSpot = { mode: 'into', parentId: cur.id };
  });
  m.addEventListener('drop', onDrop);

  // Anywhere else: hide the indicator.
  document.addEventListener('dragover', () => { if (dropSpot) clearDrop(); });
}

// ---------- Edit / Rename ----------
let editing = null; // node being edited in the bookmark dialog

function openEditDialog(node) {
  closeMenu();
  editing = node;
  const isFolder = !node.url;
  const key = 'bm:' + node.id;
  addTarget = null;
  setAddKind(isFolder ? 'folder' : 'bookmark');
  $('bmKindTabs').hidden = true;
  $('bmDialogTitle').textContent = t(isFolder ? 'renameFolderTitle' : 'editBookmarkTitle');
  $('bmName').value = displayTitle(key, node.title);
  $('bmUrl').value = node.url || '';
  $('bmWhere').textContent = '';
  $('bmDialog').showModal();
  $('bmName').focus();
  $('bmName').select();
}

async function saveEdit() {
  const node = editing;
  const isFolder = !node.url;
  const name = $('bmName').value.trim();
  const changes = {};
  if (isFolder && !name) { showAddError('bmFolderNameNeeded', $('bmName')); return false; }
  if (!isFolder) {
    const url = normalizeUrl($('bmUrl').value);
    if (!url) { showAddError('bmInvalid', $('bmUrl')); return false; }
    changes.url = url;
  }
  // Keep the emoji we show in Chrome's own bar, if there is one.
  const rec = iconFor('bm:' + node.id);
  const base = name || (isFolder ? '' : hostOf(changes.url));
  const keep = (rec && rec.prefixed) || (leadingEmoji(node.title) || {}).emoji;
  changes.title = keep ? (base ? `${keep} ${base}` : keep) : base;
  await chrome.bookmarks.update(node.id, changes);
  toastFn(t('bmUpdated'));
  return true;
}

// =========================================================
// Bookmarks bar
// =========================================================
export async function initBookmarks(toast) {
  if (bmStarted) return;
  bmStarted = true;
  toastFn = toast || (() => {});
  bindAddDialog();
  bindMenu();
  bindDropZones();
  initTip();

  // Command palette: search all bookmarks + bookmark actions.
  registerCommands(async (q) => {
    const out = [
      { group: 'actions', icon: 'bookmark', label: t('bmAddTitle'), keywords: 'bookmark add new link', run: () => openAddDialog({ id: rootIds.bar, title: t('bookmarksRoot') }, 'bookmark') },
      { group: 'actions', icon: 'folder', label: t('bmAddFolderTitle'), keywords: 'bookmark folder new', run: () => openAddDialog({ id: rootIds.bar, title: t('bookmarksRoot') }, 'folder') },
      { group: 'actions', icon: 'bookmark', label: t('ctxManager'), keywords: 'bookmarks manager organize', run: () => chrome.tabs.create({ url: bookmarksManagerUrl() }) },
    ];
    if (q) {
      const found = (await chrome.bookmarks.search(q)).filter((b) => b.url && !b.url.startsWith('javascript:')).slice(0, 8);
      for (const b of found) {
        out.push({
          group: 'bookmarks', always: true, label: displayTitle('bm:' + b.id, b.title) || hostOf(b.url), hint: hostOf(b.url),
          img: faviconUrl(b.url, 16), run: () => { location.href = b.url; },
        });
      }
    }
    return out;
  });

  $('bmbarAdd').addEventListener('click', () => openAddDialog({ id: rootIds.bar, title: t('bookmarksRoot') }));
  $('bmbarMore').addEventListener('click', () => toggleMenu({ title: t('bmMore'), nodes: overflowNodes }, $('bmbarMore')));

  await renderBar();

  // Redraw once when several events arrive together (e.g. icon saved + bookmark renamed).
  let pending = 0;
  const refresh = () => {
    clearTimeout(pending);
    pending = setTimeout(async () => {
      await renderBar();
      if (!$('bmMenu').hidden) renderMenu().catch(closeMenu);
    }, 60);
  };
  for (const ev of ['onCreated', 'onRemoved', 'onChanged', 'onMoved', 'onChildrenReordered']) {
    chrome.bookmarks[ev]?.addListener(refresh);
  }
  onIconsChanged(refresh);
  document.addEventListener('intent:lang', refresh);
  new ResizeObserver(() => layoutBar()).observe($('bookmarksModule'));
}

function barItem(node, isRootFolder = false) {
  const key = 'bm:' + node.id;
  const isFolder = !node.url;
  const title = displayTitle(key, node.title) || (isRootFolder ? t('bookmarksOther') : '');
  const el = document.createElement(isFolder ? 'button' : 'a');
  el.className = 'bmbar-item' + (isFolder ? ' is-folder' : '');
  if (isFolder) {
    el.type = 'button';
    el.setAttribute('aria-haspopup', 'menu');
    el.setAttribute('aria-expanded', 'false');
    el.addEventListener('click', () => toggleMenu({ id: node.id, title }, el));
  } else {
    el.href = node.url;
  }
  el.title = isFolder ? title : `${title || hostOf(node.url)}\n${node.url}`;

  const icon = document.createElement('span');
  icon.className = 'bmbar-icon';
  const fallback = isFolder ? folderFallback(FOLDER_SVG) : faviconFallback(node.url, 16);
  paintIcon(icon, effectiveIcon(key, node.title), fallback);
  el.append(icon);

  if (title) {
    const name = document.createElement('span');
    name.className = 'bmbar-name';
    name.textContent = title;
    el.append(name);
  } else {
    el.classList.add('icon-only');
  }

  el.addEventListener('contextmenu', (e) => openBookmarkMenu(e, node, el));
  makeDraggable(el, node);
  attachDrop(el, node, 'x');
  el._node = node;
  return el;
}

async function renderBar() {
  const [root] = await chrome.bookmarks.getTree();
  const roots = root.children || [];
  const bar = roots[0];
  rootIds = { bar: bar ? bar.id : '1', others: roots.slice(1).map((r) => r.id) };

  const box = $('bmbarItems');
  box.textContent = '';
  const items = ((bar && bar.children) || []).filter((c) => c.children || (c.url && !c.url.startsWith('javascript:')));
  items.forEach((c, i) => {
    const el = barItem(c);
    el.style.setProperty('--i', Math.min(i, 20));
    box.append(el);
  });
  $('bmbarEmpty').hidden = items.length > 0;

  // Other bookmarks / Mobile bookmarks on the right, when they have content.
  const other = $('bmbarOther');
  other.textContent = '';
  for (const r of roots.slice(1)) {
    if (r.children && r.children.length) other.append(barItem(r, true));
  }
  other.hidden = !other.children.length;

  layoutBar();
}

// Hide items that don't fit and list them in the » menu.
function layoutBar() {
  const box = $('bmbarItems');
  const more = $('bmbarMore');
  const items = [...box.children];
  items.forEach((el) => { el.hidden = false; });
  more.hidden = true;
  overflowNodes = [];
  if (box.scrollWidth <= box.clientWidth + 1) return;

  more.hidden = false; // showing it takes some room, so measure after
  const limit = box.clientWidth;
  for (const el of items) {
    if (el.offsetLeft + el.offsetWidth > limit) {
      el.hidden = true;
      overflowNodes.push(el._node);
    }
  }
}

// =========================================================
// Folder menu (drop-down)
// =========================================================
function bindMenu() {
  document.addEventListener('pointerdown', (e) => {
    const m = $('bmMenu');
    if (m.hidden) return;
    if (m.contains(e.target) || (menu.anchor && menu.anchor.contains(e.target))) return;
    if ($('ctxMenu').contains(e.target) || isContextMenuOpen()) return; // right-click menu on top
    if ($('iconDialog').open || $('bmDialog').open) return;
    closeMenu();
  });
  // Capture phase so Esc closes the menu before anything else reacts to it.
  document.addEventListener('keydown', (e) => {
    if (isContextMenuOpen()) return; // the right-click menu closes first
    if (e.key === 'Escape' && !$('bmMenu').hidden) {
      e.stopPropagation();
      const anchor = menu.anchor;
      closeMenu();
      anchor?.focus();
    }
  }, true);
  window.addEventListener('resize', () => closeMenu());
}

async function toggleMenu(entry, anchor) {
  const m = $('bmMenu');
  if (!m.hidden && menu.anchor === anchor) { closeMenu(); return; }
  closeMenu();
  menu.anchor = anchor;
  menu.stack = [entry];
  anchor.setAttribute('aria-expanded', 'true');
  anchor.classList.add('is-open');
  await renderMenu();
  m.hidden = false;
  positionMenu();
  m.querySelector('.menu-row')?.focus({ preventScroll: true });
}

export function closeMenu() {
  const m = $('bmMenu');
  m.hidden = true;
  if (menu.anchor) {
    menu.anchor.setAttribute('aria-expanded', 'false');
    menu.anchor.classList.remove('is-open');
  }
  menu.anchor = null;
  menu.stack = [];
}

function positionMenu() {
  const m = $('bmMenu');
  const r = menu.anchor.getBoundingClientRect();
  const w = m.offsetWidth;
  const left = Math.max(8, Math.min(r.left, window.innerWidth - w - 8));
  m.style.left = left + 'px';
  m.style.top = (r.bottom + 6) + 'px';
  m.style.maxHeight = (window.innerHeight - r.bottom - 20) + 'px';
}

function menuRow(node) {
  const key = 'bm:' + node.id;
  const isFolder = !node.url;
  const title = displayTitle(key, node.title) || (isFolder ? '' : hostOf(node.url));
  const row = document.createElement(isFolder ? 'button' : 'a');
  row.className = 'menu-row';
  row.setAttribute('role', 'menuitem');
  if (isFolder) {
    row.type = 'button';
    row.addEventListener('click', async () => {
      menu.stack.push({ id: node.id, title });
      await renderMenu();
      $('bmMenu').querySelector('.menu-row')?.focus({ preventScroll: true });
    });
  } else {
    row.href = node.url;
    row.title = node.url;
  }

  const icon = document.createElement('span');
  icon.className = 'bmbar-icon';
  paintIcon(icon, effectiveIcon(key, node.title), isFolder ? folderFallback(FOLDER_SVG) : faviconFallback(node.url, 16));
  const name = document.createElement('span');
  name.className = 'menu-name';
  name.textContent = title;
  row.append(icon, name);

  if (isFolder) {
    const chev = document.createElement('span');
    chev.className = 'menu-chevron';
    chev.innerHTML = CHEVRON_SVG;
    row.append(chev);
  }

  // ⋯ button and right-click both open the Chrome-style actions menu.
  const more = document.createElement('button');
  more.type = 'button';
  more.className = 'menu-edit';
  more.innerHTML = MORE_SVG;
  more.title = t('ctxMore');
  more.setAttribute('aria-label', `${t('ctxMore')}: ${title}`);
  more.setAttribute('aria-haspopup', 'menu');
  more.addEventListener('click', (e) => {
    e.stopPropagation();
    openBookmarkMenu(null, node, more);
  });
  row.addEventListener('contextmenu', (e) => openBookmarkMenu(e, node, row));

  const wrap = document.createElement('div');
  wrap.className = 'menu-item';
  wrap.append(row, more);
  makeDraggable(row, node);
  attachDrop(wrap, node, 'y');
  return wrap;
}

async function renderMenu() {
  const m = $('bmMenu');
  const cur = menu.stack[menu.stack.length - 1];
  let children = cur.nodes;
  if (!children) {
    const [node] = await chrome.bookmarks.getSubTree(cur.id);
    children = node.children || [];
  }
  children = children.filter((c) => c.children || (c.url && !c.url.startsWith('javascript:')));

  m.textContent = '';
  if (menu.stack.length > 1) {
    const head = document.createElement('button');
    head.type = 'button';
    head.className = 'menu-row menu-back';
    head.innerHTML = `<span class="bmbar-icon">${BACK_SVG}</span>`;
    const name = document.createElement('span');
    name.className = 'menu-name';
    name.textContent = cur.title;
    head.append(name);
    head.addEventListener('click', async () => {
      menu.stack.pop();
      await renderMenu();
      $('bmMenu').querySelector('.menu-row')?.focus({ preventScroll: true });
    });
    m.append(head);
  }

  const list = document.createElement('div');
  list.className = 'menu-list';
  children.forEach((c, i) => {
    const row = menuRow(c);
    row.style.setProperty('--i', Math.min(i, 15));
    list.append(row);
  });
  m.append(list);

  if (!children.length) {
    const p = document.createElement('p');
    p.className = 'menu-empty';
    p.textContent = t('bookmarksEmpty');
    m.append(p);
  }

  // "Add bookmark here" for real folders (not the » overflow list).
  if (cur.id) {
    const sep = document.createElement('div');
    sep.className = 'menu-sep';
    const add = document.createElement('button');
    add.type = 'button';
    add.className = 'menu-row menu-add';
    add.innerHTML = `<span class="bmbar-icon">${PLUS_SVG}</span>`;
    const name = document.createElement('span');
    name.className = 'menu-name';
    name.textContent = t('bmAddHere');
    add.append(name);
    add.addEventListener('click', () => {
      const folder = { id: cur.id, title: cur.title };
      closeMenu();
      openAddDialog(folder, 'bookmark');
    });

    const newFolder = document.createElement('button');
    newFolder.type = 'button';
    newFolder.className = 'menu-row menu-add';
    newFolder.innerHTML = `<span class="bmbar-icon">${FOLDER_SVG}</span>`;
    const fname = document.createElement('span');
    fname.className = 'menu-name';
    fname.textContent = t('bmFolderHere');
    newFolder.append(fname);
    newFolder.addEventListener('click', () => {
      const folder = { id: cur.id, title: cur.title };
      closeMenu();
      openAddDialog(folder, 'folder');
    });
    m.append(sep, add, newFolder);
  }
  if (menu.anchor) positionMenu();
}

// Arrow keys move through the menu.
function menuKeys(e) {
  if (!['ArrowDown', 'ArrowUp', 'ArrowLeft'].includes(e.key)) return;
  const rows = [...$('bmMenu').querySelectorAll('.menu-row')];
  const i = rows.indexOf(document.activeElement);
  if (e.key === 'ArrowLeft') {
    const back = $('bmMenu').querySelector('.menu-back');
    if (back) { e.preventDefault(); back.click(); }
    return;
  }
  e.preventDefault();
  const next = e.key === 'ArrowDown' ? (i + 1) % rows.length : (i - 1 + rows.length) % rows.length;
  rows[next]?.focus();
}

// =========================================================
// "Hide Chrome's bar" tip
// =========================================================
async function initTip() {
  const { ui = {} } = await get('ui');
  if (ui.bmTipDismissed) return;
  $('bmTip').hidden = false;
  $('bmTipClose').addEventListener('click', async () => {
    $('bmTip').hidden = true;
    const { ui: cur = {} } = await get('ui');
    await set({ ui: { ...cur, bmTipDismissed: true } });
  });
}

// =========================================================
// Add bookmark dialog
// =========================================================
let addKind = 'bookmark'; // 'bookmark' | 'folder'

function openAddDialog(folder, kind = 'bookmark') {
  addTarget = folder;
  editing = null;
  $('bmKindTabs').hidden = false;
  $('bmName').value = '';
  $('bmUrl').value = '';
  $('bmWhere').textContent = t('bmWhere', { folder: folder.title || t('bookmarksRoot') });
  setAddKind(kind);
  $('bmDialog').showModal();
  (kind === 'folder' ? $('bmName') : $('bmUrl')).focus();
}

function setAddKind(kind) {
  addKind = kind;
  const folder = kind === 'folder';
  document.querySelectorAll('[data-bm-kind]').forEach((b) => {
    b.setAttribute('aria-selected', String(b.dataset.bmKind === kind));
  });
  $('bmDialogTitle').textContent = t(folder ? 'bmAddFolderTitle' : 'bmAddTitle');
  $('bmUrlRow').hidden = folder;
  $('bmName').placeholder = t(folder ? 'bmFolderPlaceholder' : 'bmNamePlaceholder');
  $('bmName').required = folder;
  $('bmError').hidden = true;
}

function showAddError(key, field) {
  $('bmError').textContent = t(key);
  $('bmError').hidden = false;
  field.focus();
}

// Accepts "example.com", "www.example.com/page" or a full http(s) URL.
function normalizeUrl(raw) {
  let s = raw.trim();
  if (!s) return null;
  if (!/^[a-z][a-z0-9+.-]*:/i.test(s)) s = 'https://' + s;
  try {
    const u = new URL(s);
    if (!['http:', 'https:'].includes(u.protocol)) return null;
    if (!u.hostname.includes('.') && u.hostname !== 'localhost') return null;
    return u.href;
  } catch {
    return null;
  }
}

function bindAddDialog() {
  const dlg = $('bmDialog');
  $('bmCancel').addEventListener('click', () => dlg.close());
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); }); // click on backdrop
  $('bmUrl').addEventListener('input', () => { $('bmError').hidden = true; });
  $('bmName').addEventListener('input', () => { $('bmError').hidden = true; });
  document.querySelectorAll('[data-bm-kind]').forEach((b) => {
    b.addEventListener('click', () => {
      setAddKind(b.dataset.bmKind);
      (addKind === 'folder' ? $('bmName') : $('bmUrl')).focus();
    });
  });
  $('bmForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (editing) {
      if (await saveEdit()) { editing = null; dlg.close(); }
      return;
    }
    const parentId = (addTarget && addTarget.id) || rootIds.bar;
    const name = $('bmName').value.trim();

    if (addKind === 'folder') {
      if (!name) { showAddError('bmFolderNameNeeded', $('bmName')); return; }
      await chrome.bookmarks.create({ parentId, title: name }); // no url = folder
      dlg.close();
      toastFn(t('bmFolderSaved'));
      return;
    }

    const url = normalizeUrl($('bmUrl').value);
    if (!url) { showAddError('bmInvalid', $('bmUrl')); return; }
    await chrome.bookmarks.create({ parentId, title: name || hostOf(url), url });
    dlg.close();
    toastFn(t('bmSaved'));
  });
  $('bmMenu').addEventListener('keydown', menuKeys);
}

// =========================================================
// Most visited (grid of tiles)
// =========================================================
let topSites = [];

function siteTile(site) {
  const key = 'url:' + site.url;
  const title = displayTitle(key, site.title) || hostOf(site.url);
  const a = document.createElement('a');
  a.className = 'tile';
  a.href = site.url;
  a.title = `${title}\n${site.url}`;
  const icon = document.createElement('span');
  icon.className = 'tile-icon';
  const fallback = faviconFallback(site.url, 32);
  paintIcon(icon, effectiveIcon(key, site.title), fallback);
  const name = document.createElement('span');
  name.className = 'tile-name';
  name.textContent = title;
  a.append(icon, name);

  const open = () => openIconDialog({ key, bookmarkId: null, title, rawTitle: site.title, fallback });
  a.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    showContextMenu(ctxPoint(e, a), [
      { label: t('ctxOpenNewTab'), icon: 'tab', run: () => openUrls([site.url], 'tab') },
      { label: t('ctxOpenNewWindow'), icon: 'window', run: () => openUrls([site.url], 'window') },
      { label: t('ctxOpenIncognito'), icon: 'incognito', run: () => openUrls([site.url], 'incognito') },
      'sep',
      { label: t('ctxChangeIcon'), icon: 'icon', run: open },
      { label: t('ctxCopyLink'), icon: 'copy', run: () => copyLink(site.url) },
      { label: t('ctxBookmarkThis'), icon: 'page', run: () => bookmarkSite(site) },
    ]);
  });
  const edit = document.createElement('button');
  edit.type = 'button';
  edit.className = 'tile-edit';
  edit.innerHTML = EDIT_SVG;
  edit.title = t('iconTitle');
  edit.setAttribute('aria-label', `${t('iconTitle')}: ${title}`);
  edit.addEventListener('click', open);

  const wrap = document.createElement('div');
  wrap.className = 'tile-wrap';
  wrap.append(a, edit);
  return wrap;
}

async function bookmarkSite(site) {
  await chrome.bookmarks.create({ parentId: rootIds.bar, title: site.title || hostOf(site.url), url: site.url });
  toastFn(t('bmSaved'));
}

export async function initTopSites() {
  if (tsStarted) return;
  tsStarted = true;
  topSites = (await chrome.topSites.get()).slice(0, TOP_SITES_MAX);
  renderTopSites();
  onIconsChanged(renderTopSites);
  if (!topSites.length) $('topSitesModule').dataset.empty = '1';
}

function renderTopSites() {
  const grid = $('topSites');
  grid.textContent = '';
  topSites.forEach((s, i) => {
    const el = siteTile(s);
    el.style.setProperty('--i', Math.min(i, 20));
    grid.append(el);
  });
}
