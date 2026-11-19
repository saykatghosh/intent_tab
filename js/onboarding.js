// A short welcome tour on first run (3 steps). Can be reopened from the palette.

import { get, set } from './store.js';
import { t } from './strings.js';
import { registerCommands } from './palette.js';

const $ = (id) => document.getElementById(id);
const STEPS = [
  { art: '?', title: 'tour1Title', body: 'tour1Body' },
  { art: 'bm', title: 'tour2Title', body: 'tour2Body' },
  { art: 'k', title: 'tour3Title', body: 'tour3Body' },
];
const ART = {
  '?': '<span class="tour-q">?</span>',
  bm: '<svg viewBox="0 0 24 24" width="44" height="44" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><path d="M7 4h10a1 1 0 0 1 1 1v15l-6-4-6 4V5a1 1 0 0 1 1-1z"/></svg>',
  k: '<span class="tour-keys"><kbd>Ctrl</kbd><kbd>K</kbd></span>',
};
let step = 0;

function render() {
  const s = STEPS[step];
  $('tourArt').innerHTML = ART[s.art];
  $('tourTitle').textContent = t(s.title);
  $('tourBody').textContent = t(s.body);
  $('tourDots').textContent = '';
  STEPS.forEach((_, i) => {
    const d = document.createElement('span');
    d.className = 'tour-dot' + (i === step ? ' is-on' : '');
    $('tourDots').append(d);
  });
  $('tourBack').hidden = step === 0;
  $('tourNext').textContent = step === STEPS.length - 1 ? t('tourStart') : t('tourNext');
  $('tourSkip').hidden = step === STEPS.length - 1;
  const card = $('tourCard');
  card.classList.remove('is-in');
  void card.offsetWidth;
  card.classList.add('is-in');
}

async function finish() {
  $('tour').close();
  const { ui = {} } = await get('ui');
  await set({ ui: { ...ui, onboarded: true } });
}

export function openTour() {
  step = 0;
  render();
  if (!$('tour').open) $('tour').showModal();
  $('tourNext').focus();
}

// Chrome adds its own bar under every extension's new tab ("Intent Tab ·
// Customize Chrome"). Extensions can't hide it, so tell people once how to.
function initFooterTip(ui) {
  if (ui.footerTipDismissed) return;
  const show = () => setTimeout(() => { $('footerTip').hidden = false; }, 1200);
  if ($('tour').open) $('tour').addEventListener('close', show, { once: true });
  else show();
  $('footerTipClose').addEventListener('click', async () => {
    $('footerTip').hidden = true;
    const { ui: cur = {} } = await get('ui');
    await set({ ui: { ...cur, footerTipDismissed: true } });
  });
}

export async function initOnboarding() {
  $('tourNext').addEventListener('click', () => {
    if (step < STEPS.length - 1) { step++; render(); } else finish();
  });
  $('tourBack').addEventListener('click', () => { if (step > 0) { step--; render(); } });
  $('tourSkip').addEventListener('click', finish);
  $('tour').addEventListener('cancel', () => finish());
  document.addEventListener('intent:lang', () => { if ($('tour').open) render(); });
  registerCommands(() => [{ group: 'actions', icon: 'spark', label: t('palTour'), keywords: 'welcome tour help guide intro', run: openTour }]);

  const { ui = {} } = await get('ui');
  if (!ui.onboarded) openTour();
  initFooterTip(ui);
}
