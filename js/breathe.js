// Calm breathing guide for breaks: a soft orb grows (breathe in, 4s),
// stays (hold, 4s) and shrinks (breathe out, 6s), over and over.
// With reduced motion the orb stays still and only the words change.

import { t } from './strings.js';

const $ = (id) => document.getElementById(id);
const PHASES = [
  { key: 'breatheIn', ms: 4000, big: true },
  { key: 'breatheHold', ms: 4000, big: true },
  { key: 'breatheOut', ms: 6000, big: false },
];

let timer = 0;
let running = false;
let cycles = 0;

export function startBreathing() {
  stopBreathing();
  const box = $('breathe');
  const orb = $('breatheOrb');
  const label = $('breatheLabel');
  box.hidden = false;
  running = true;
  cycles = 0;
  let i = 0;
  orb.style.transitionDuration = '0ms';
  orb.classList.remove('is-big');

  const step = () => {
    if (!running) return;
    const phase = PHASES[i % PHASES.length];
    if (i % PHASES.length === 0 && i > 0) cycles += 1;
    label.textContent = t(phase.key);
    $('breatheCount').textContent = cycles ? t('breatheCycles', { n: cycles }) : '';
    orb.style.transitionDuration = phase.ms + 'ms';
    orb.classList.toggle('is-big', phase.big);
    orb.dataset.phase = phase.key;
    i += 1;
    timer = setTimeout(step, phase.ms);
  };
  // Two frames so the starting size is painted before the first transition.
  requestAnimationFrame(() => requestAnimationFrame(step));
}

export function stopBreathing() {
  running = false;
  clearTimeout(timer);
  const box = $('breathe');
  if (box) box.hidden = true;
}
