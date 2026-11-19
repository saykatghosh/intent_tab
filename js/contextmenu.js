// A small right-click menu, styled like the rest of the page.
// items: [{ label, icon?, run, disabled?, danger? } | 'sep']

const ICONS = {
  tab: '<path d="M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z M4 9h16" />',
  window: '<path d="M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M3 8h18 M6 5.5h.01 M8.5 5.5h.01" />',
  incognito: '<path d="M3 11h18 M6 11l1.5-5h9L18 11 M9.5 17a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0z M19.5 17a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0z M9.5 16.5c1.5-1 3.5-1 5 0" />',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z" />',
  icon: '<path d="M12 3l2.5 5.5L20 9l-4 4 1 6-5-3-5 3 1-6-4-4 5.5-.5z" />',
  copy: '<path d="M8 8h11v12H8z M5 16V4h11" />',
  trash: '<path d="M4 7h16 M9 7V4h6v3 M6 7l1 13h10l1-13 M10 11v6 M14 11v6" />',
  page: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1 M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />',
  folder: '<path d="M3.5 7.5a2 2 0 0 1 2-2h4l2 2h7a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z" />',
  manager: '<path d="M7 4h10a1 1 0 0 1 1 1v15l-6-4-6 4V5a1 1 0 0 1 1-1z" />',
  openAll: '<path d="M4 8a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z M8 3h10a3 3 0 0 1 3 3v10" />',
};

let lastFocus = null;
const $ = (id) => document.getElementById(id);

function svg(name) {
  return `<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${ICONS[name] || ''}</svg>`;
}

export function isContextMenuOpen() {
  return !$('ctxMenu').hidden;
}

export function closeContextMenu(restoreFocus = true) {
  const m = $('ctxMenu');
  if (m.hidden) return;
  m.hidden = true;
  m.textContent = '';
  if (restoreFocus && lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
  lastFocus = null;
}

// Open at a point (mouse) or under an element (keyboard / ⋯ button).
export function showContextMenu(at, items) {
  const m = $('ctxMenu');
  lastFocus = document.activeElement;
  m.textContent = '';

  for (const item of items) {
    if (item === 'sep') {
      const s = document.createElement('div');
      s.className = 'ctx-sep';
      s.setAttribute('role', 'separator');
      m.append(s);
      continue;
    }
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'ctx-item' + (item.danger ? ' is-danger' : '');
    b.setAttribute('role', 'menuitem');
    b.disabled = !!item.disabled;
    b.innerHTML = `<span class="ctx-icon">${svg(item.icon)}</span>`;
    const label = document.createElement('span');
    label.className = 'ctx-label';
    label.textContent = item.label;
    b.append(label);
    b.addEventListener('click', () => {
      closeContextMenu(false);
      item.run();
    });
    m.append(b);
  }

  m.hidden = false;
  // Position inside the viewport.
  let x, y;
  if (at instanceof Element) {
    const r = at.getBoundingClientRect();
    x = r.left;
    y = r.bottom + 4;
  } else {
    x = at.x;
    y = at.y;
  }
  const w = m.offsetWidth;
  const h = m.offsetHeight;
  if (x + w > window.innerWidth - 8) x = Math.max(8, window.innerWidth - w - 8);
  if (y + h > window.innerHeight - 8) y = Math.max(8, y - h - (at instanceof Element ? at.getBoundingClientRect().height + 8 : 0));
  m.style.left = x + 'px';
  m.style.top = y + 'px';
  m.querySelector('.ctx-item:not(:disabled)')?.focus({ preventScroll: true });
}

export function initContextMenu() {
  const m = $('ctxMenu');
  document.addEventListener('pointerdown', (e) => {
    if (!m.hidden && !m.contains(e.target)) closeContextMenu(false);
  }, true);
  // Capture phase: Esc closes this menu before anything else reacts.
  document.addEventListener('keydown', (e) => {
    if (m.hidden) return;
    if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); closeContextMenu(); return; }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      e.stopPropagation();
      const items = [...m.querySelectorAll('.ctx-item:not(:disabled)')];
      const i = items.indexOf(document.activeElement);
      const next = e.key === 'ArrowDown' ? (i + 1) % items.length : (i - 1 + items.length) % items.length;
      items[next]?.focus();
    }
  }, true);
  window.addEventListener('resize', () => closeContextMenu(false));
  window.addEventListener('blur', () => closeContextMenu(false));
  document.addEventListener('scroll', () => closeContextMenu(false), true);
}
