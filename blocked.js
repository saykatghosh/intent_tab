// The calm page shown instead of a blocked site while focus mode is on.
// It never locks you out: "Open anyway for 5 minutes" always works.

import { get, set, getSettings } from './js/store.js';
import { t, setLang, digits } from './js/strings.js';
import { newTabUrl } from './js/browser.js';

const $ = (id) => document.getElementById(id);
const ALLOW_MS = 5 * 60 * 1000;

// The original address arrives after "?u=" (unencoded, so take everything after it).
const href = location.href;
const original = href.includes('?u=') ? href.slice(href.indexOf('?u=') + 3) : '';
let host = '';
try { host = new URL(original).hostname.replace(/^www\./, ''); } catch { /* ignore */ }

function siteKey(settings) {
  // Which entry of the focus list matched this host (e.g. "youtube.com" for m.youtube.com).
  return (settings.focusSites || []).find((d) => host === d || host.endsWith('.' + d)) || host;
}

async function main() {
  const settings = await getSettings();
  setLang(settings.lang);
  document.documentElement.lang = settings.lang;
  if (settings.accent && settings.accent !== 'sage') document.documentElement.dataset.accent = settings.accent;
  const { intent } = await get('intent');

  document.title = t('blockedTitleShort');
  $('bSite').textContent = t('blockedFocusOn');
  $('bTitle').textContent = t('blockedTitle', { site: host || t('blockedThisSite') });
  $('bLabel').textContent = t('blockedFocusing');
  $('bIntent').textContent = intent && intent.text ? intent.text : '';
  $('bLabel').parentElement.hidden = !(intent && intent.text);
  $('bBack').textContent = intent && intent.text && intent.endsAt > Date.now() ? t('blockedBack') : t('blockedGoBack');
  $('bAllow').textContent = t('blockedAllow');
  $('bNote').textContent = t('blockedNote');

  const tick = () => {
    if (!intent || !intent.endsAt) { $('bLeft').textContent = ''; return; }
    const left = Math.max(0, intent.endsAt - Date.now());
    const s = Math.ceil(left / 1000);
    $('bLeft').textContent = left > 0 ? t('blockedLeft', { time: digits(`${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`) }) : '';
  };
  tick();
  setInterval(tick, 1000);

  $('bBack').addEventListener('click', async () => {
    if (history.length > 1) history.back();
    else {
      const tab = await chrome.tabs.getCurrent();
      if (tab) chrome.tabs.update(tab.id, { url: newTabUrl() });
    }
  });

  $('bAllow').addEventListener('click', async () => {
    const key = siteKey(settings);
    const { focusAllow = {} } = await get('focusAllow');
    focusAllow[key] = Date.now() + ALLOW_MS;
    await set({ focusAllow });
    // Give the background a moment to lift the rule, then continue to the page.
    setTimeout(() => { if (original) location.replace(original); }, 700);
  });
}

main();
