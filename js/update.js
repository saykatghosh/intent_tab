// "A new version is out" notice, for copies installed from the ZIP file.
// Copies from the Chrome Web Store update themselves, so they skip all of this.
//
// Once a day the service worker asks GitHub for the latest release (only the
// version number and links come back; nothing about the user is sent) and keeps
//   update          = { version, url, zip, checkedAt }
//   updateDismissed = '1.3.0'   (the version the user said "Later" to)
// The new tab page and the panel show a small card when a newer version waits.

import { get, set } from './store.js';
import { t } from './strings.js';

const LATEST = 'https://api.github.com/repos/saykatghosh/intent_tab/releases/latest';
const RELEASES = 'https://github.com/saykatghosh/intent_tab/releases/latest';
const CHECK_EVERY = 12 * 60 * 60 * 1000;

export function currentVersion() {
  return chrome.runtime.getManifest().version;
}

// Installed from the Chrome Web Store (Chrome adds update_url to the manifest).
export function fromStore() {
  return !!chrome.runtime.getManifest().update_url;
}

// Is version a newer than version b? ("1.10.0" > "1.9.2")
export function isNewer(a, b) {
  const pa = String(a || '').replace(/^v/, '').split('.').map(Number);
  const pb = String(b || '').replace(/^v/, '').split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] || 0;
    const y = pb[i] || 0;
    if (x !== y) return x > y;
  }
  return false;
}

// Ask GitHub for the latest release (at most twice a day).
export async function checkForUpdate(force = false) {
  if (fromStore()) return null;
  const { update } = await get('update');
  if (!force && update && Date.now() - (update.checkedAt || 0) < CHECK_EVERY) return update;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 10000);
    const res = await fetch(LATEST, { headers: { Accept: 'application/vnd.github+json' }, signal: ctrl.signal, cache: 'no-store' });
    clearTimeout(timer);
    if (!res.ok) return update || null;
    const rel = await res.json();
    const version = String(rel.tag_name || '').replace(/^v/, '');
    const zip = (rel.assets || []).find((a) => /\.zip$/i.test(a.name || ''));
    const next = { version, url: rel.html_url || RELEASES, zip: zip ? zip.browser_download_url : '', checkedAt: Date.now() };
    await set({ update: next });
    return next;
  } catch {
    return update || null;
  }
}

// The update to show, if any.
export async function pendingUpdate() {
  if (fromStore()) return null;
  const { update, updateDismissed } = await get(['update', 'updateDismissed']);
  if (!update || !update.version || !isNewer(update.version, currentVersion())) return null;
  if (updateDismissed === update.version) return null;
  return update;
}

// A small card: "Intent Tab 1.3.0 is out" · Download · how to update · Later.
export function buildNotice(update, onClose) {
  const card = document.createElement('div');
  card.className = 'update-card';
  card.setAttribute('role', 'status');

  const head = document.createElement('div');
  head.className = 'update-head';
  const title = document.createElement('b');
  title.textContent = t('updateAvailable', { v: update.version });
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'update-x';
  close.setAttribute('aria-label', t('updateLater'));
  close.title = t('updateLater');
  close.innerHTML = '<svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>';
  head.append(title, close);

  const how = document.createElement('p');
  how.className = 'update-how';
  how.textContent = t('updateHow');

  const row = document.createElement('div');
  row.className = 'update-row';
  const dl = document.createElement('a');
  dl.className = 'update-go';
  dl.href = update.zip || update.url;
  dl.target = '_blank';
  dl.rel = 'noopener';
  dl.textContent = t('updateDownload');
  const notes = document.createElement('a');
  notes.className = 'update-notes';
  notes.href = update.url;
  notes.target = '_blank';
  notes.rel = 'noopener';
  notes.textContent = t('updateWhatsNew');
  row.append(dl, notes);

  card.append(head, how, row);
  close.addEventListener('click', async () => {
    await set({ updateDismissed: update.version });
    card.remove();
    if (onClose) onClose();
  });
  return card;
}
