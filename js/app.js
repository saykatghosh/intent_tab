import { applyStrings, setLang, getLang, locale, t } from './strings.js';
import { getSettings } from './store.js';
import { initIntent, updateSettings, dismissQuestion } from './intent.js';
import { initTodos } from './todos.js';
import { initBookmarks, initTopSites } from './bookmarks.js';
import { initReport } from './report.js';
import { initBackground, setBackgroundMode } from './background.js';
import { initEffects, transition } from './effects.js';
import { initIcons } from './icons.js';
import { initContextMenu } from './contextmenu.js';
import { initAssistant, isAnswerOpen, closeAnswer } from './assistant.js';
import { setAIEnabled } from './ai.js';
import { initSettings, isOpen as settingsOpen, close as closeSettings, applySettings, openSettings } from './settings.js';
import { initPalette, registerCommands } from './palette.js';
import { initFocus } from './focus.js';
import { engine, searchUrl, bindShortcuts, parseShortcut } from './search.js';
import { initTools, openTool } from './tools.js';
import { initProjects } from './projects.js';
import { initDevCard } from './devcard.js';
import { initRobot, setRobotEnabled } from './robot.js';
import { pullSyncedSettings } from './store.js';
import { initPrefs, applyAccent } from './prefs.js';
import { initLayout } from './layout.js';
import { initNotes } from './notes.js';
import { initOnboarding } from './onboarding.js';
import { pendingUpdate, buildNotice } from './update.js';

const $ = (id) => document.getElementById(id);

// ---------- theme ----------
function applyTheme(theme) {
  if (theme === 'light' || theme === 'dark') document.documentElement.dataset.theme = theme;
  else delete document.documentElement.dataset.theme;
  try { localStorage.setItem('intent-theme', theme); } catch (e) { /* ignore */ }
}

// ---------- modules ----------
async function applyModules(settings) {
  const m = settings.modules;
  const jobs = [];

  $('todoModule').hidden = !m.todo;
  if (m.todo) jobs.push(initTodos());

  $('notesModule').hidden = !m.notes;
  if (m.notes) jobs.push(initNotes());

  $('devModule').hidden = !m.dev;
  if (m.dev) jobs.push(initDevCard());

  $('reportModule').hidden = !m.report;
  if (m.report) jobs.push(initReport());

  $('bookmarksModule').hidden = !m.bookmarks;
  if (m.bookmarks) jobs.push(initBookmarks(toast));

  if (m.topSites) {
    jobs.push(initTopSites().then(() => {
      $('topSitesModule').hidden = $('topSitesModule').dataset.empty === '1';
    }));
  } else {
    $('topSitesModule').hidden = true;
  }

  await Promise.allSettled(jobs).then((results) => {
    results.forEach((r) => { if (r.status === 'rejected') console.error('[Intent Tab]', r.reason); });
  });
}

// ---------- clock ----------
function startClock() {
  const tick = () => {
    const now = new Date();
    const time = now.toLocaleTimeString(locale(), { hour: 'numeric', minute: '2-digit' });
    const el = $('clockTime');
    if (el.textContent && el.textContent !== time) {
      el.classList.remove('tick');
      void el.offsetWidth; // restart the fade
      el.classList.add('tick');
    }
    el.textContent = time;
    $('clockDate').textContent = now.toLocaleDateString(locale(), { weekday: 'long', month: 'long', day: 'numeric' });
    const h = now.getHours();
    $('greeting').textContent = t(h >= 5 && h < 12 ? 'greetMorning' : h < 17 && h >= 12 ? 'greetAfternoon' : h >= 17 && h < 21 ? 'greetEvening' : 'greetNight');
  };
  tick();
  // align to the next full second, then tick every second
  setTimeout(() => { tick(); setInterval(tick, 1000); }, 1000 - (Date.now() % 1000));
}

// ---------- toast ----------
let toastTimer;
// toast('Saved.')  or  toast('Deleted.', { label: 'Undo', run: () => … })
function toast(msg, action) {
  const el = $('toast');
  const btn = $('toastAction');
  $('toastText').textContent = msg;
  btn.hidden = !action;
  btn.onclick = null;
  if (action) {
    btn.textContent = action.label;
    btn.onclick = () => {
      el.classList.remove('is-on');
      clearTimeout(toastTimer);
      action.run();
    };
  }
  el.classList.toggle('has-action', !!action);
  el.classList.add('is-on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('is-on'), action ? 7000 : 2200);
}

// ---------- command palette: search + settings ----------
function registerAppCommands() {
  registerCommands((q) => {
    const out = [];
    // "mdn flexbox", "npm react", "gh owner/repo" … jump straight to that site.
    const hit = parseShortcut(q);
    if (hit) {
      out.push({ group: 'quick', always: true, rank: 10, icon: 'search', label: t('palShortcut', { name: hit.shortcut.name, q: hit.query }), run: () => { location.href = hit.url; } });
    }
    if (q) {
      out.push({
        group: 'quick', always: true, rank: 1, icon: 'search', label: t('palSearchWith', { name: engine().name, q }),
        run: () => { location.href = searchUrl(q); },
      });
    }
    const s = (label, icon, patch, keywords) => ({ group: 'settings', label, icon, keywords, run: () => applySettings(patch) });
    out.push(
      s(t('palThemeLight'), 'sun', { theme: 'light' }, 'theme light mode day'),
      s(t('palThemeDark'), 'moon', { theme: 'dark' }, 'theme dark mode night'),
      s(t('palThemeAuto'), 'settings', { theme: 'auto' }, 'theme system auto'),
      s('Language: English', 'globe', { lang: 'en' }, 'language english ইংরেজি'),
      s('ভাষা: বাংলা', 'globe', { lang: 'bn' }, 'language bangla bengali বাংলা'),
      s(t('palBgCosmos'), 'image', { background: 'cosmos' }, 'background cosmos space stars world'),
      s(t('palBgAnimated'), 'image', { background: 'animated' }, 'background animation motion'),
      s(t('palBgStill'), 'image', { background: 'still' }, 'background still static'),
      s(t('palBgPlain'), 'image', { background: 'plain' }, 'background plain off'),
      { group: 'settings', icon: 'settings', label: t('palOpenSettings'), keywords: 'settings preferences options সেটিংস', run: () => openSettings() },
    );
    return out;
  });
}

// v1.4: switch everyone to the Cosmos world once (they can switch back in Settings).
async function enterNewWorld(settings) {
  const { ui = {} } = await chrome.storage.local.get('ui');
  if (ui.worldV14) return settings;
  const next = { ...settings, background: 'cosmos', modules: { ...settings.modules, robot: true } };
  await chrome.storage.local.set({ settings: next, ui: { ...ui, worldV14: true } });
  return next;
}

// ---------- boot ----------
async function main() {
  // Settings from Chrome sync win when sync is on (same setup on every computer).
  let settings = await pullSyncedSettings(await getSettings());
  settings = await enterNewWorld(settings);
  setLang(settings.lang);
  applyStrings();
  startClock();
  applyTheme(settings.theme);
  applyAccent(settings.accent);
  initBackground(settings.background);
  initEffects();
  initContextMenu();
  initPalette();
  registerAppCommands();
  await initFocus(); // today's goal is used by suggestions and the coach

  // On-device AI status must be known before suggestions and the coach are drawn.
  setAIEnabled(settings.ai);
  await initAssistant(toast).catch((err) => console.warn('[Intent Tab] AI init', err));

  // Intent first: it counts the tab and must read "last tab" time before anything else.
  await initIntent(settings, toast);
  await initIcons(toast); // custom tile icons must be loaded before tiles are drawn
  await applyModules(settings);

  initSettings(settings, (next) => {
    // Theme and language changes cross-fade smoothly.
    const langChanged = next.lang !== getLang();
    const themeChanged = (document.documentElement.dataset.theme || 'auto') !== next.theme;
    const apply = () => {
      applyTheme(next.theme);
      setBackgroundMode(next.background); // also picks up a theme change
      if (langChanged) {
        setLang(next.lang);
        applyStrings();
        document.dispatchEvent(new Event('intent:lang'));
      }
    };
    if (langChanged || themeChanged) transition(apply); else apply();
    setAIEnabled(next.ai);
    updateSettings(next);
    applyModules(next);
    setRobotEnabled(next.modules.robot !== false);
  });

  // v1.2: search engine, accent, photo, focus mode, sync, export; card layout; welcome tour.
  initPrefs(settings, toast);
  initLayout(settings);
  // Developer features: search shortcuts, projects, tools.
  bindShortcuts();
  initTools(toast);
  $('toolsBtn').addEventListener('click', () => { closeSettings(); openTool(); });
  $('devTopBtn').addEventListener('click', () => openTool());
  initProjects(toast).catch((err) => console.warn('[Intent Tab] projects', err));
  initOnboarding().catch((err) => console.warn('[Intent Tab] tour', err));

  // A newer version is out (ZIP installs): a small card in the corner.
  pendingUpdate().then((u) => {
    if (!u) return;
    const card = buildNotice(u);
    card.classList.add('is-page');
    document.body.append(card);
  }).catch(() => {});

  // The toolbar popup's Settings button opens newtab.html#settings.
  if (location.hash === '#settings') {
    history.replaceState(null, '', location.pathname);
    openSettings();
  }
  initRobot(settings.modules.robot !== false).catch((err) => console.warn('[Intent Tab] robot', err));

  // "/" jumps to the search bar (when not already typing somewhere).
  document.addEventListener('keydown', (e) => {
    if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return;
    const tag = (document.activeElement?.tagName || '').toLowerCase();
    if (['input', 'textarea', 'select'].includes(tag) || document.activeElement?.isContentEditable) return;
    if (document.querySelector('dialog[open]')) return;
    e.preventDefault();
    $('searchInput').focus();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (document.querySelector('dialog[open]')) return; // dialogs (incl. the palette) close themselves
    if (!$('bmMenu').hidden) return;                          // bookmarks menu handles its own Esc
    if (settingsOpen()) { closeSettings(); return; }
    if (isAnswerOpen()) { closeAnswer(); return; }
    if (dismissQuestion()) e.preventDefault();
  });
}

main().catch((err) => console.error('[Intent Tab]', err));
