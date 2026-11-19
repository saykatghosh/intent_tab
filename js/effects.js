// Small, calm visual effects shared by every module.
// Everything here turns itself off when the system asks for reduced motion.

const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
export const motionOK = () => !reduce.matches;

// ---------- View transitions (smooth cross-fade between states) ----------
export function transition(update) {
  if (!motionOK() || !document.startViewTransition || document.hidden) {
    update();
    return Promise.resolve();
  }
  return document.startViewTransition(update).finished.catch(() => {});
}

// ---------- Word-by-word reveal ----------
export function revealText(el, text) {
  el.textContent = '';
  if (!motionOK()) { el.textContent = text; return; }
  const words = String(text).split(/(\s+)/);
  let i = 0;
  for (const w of words) {
    if (/^\s+$/.test(w)) { el.append(w); continue; }
    const s = document.createElement('span');
    s.className = 'word';
    s.style.setProperty('--i', i++);
    s.textContent = w;
    el.append(s);
  }
  el.setAttribute('aria-label', text);
}

// ---------- Count-up numbers ----------
const lastValues = new WeakMap();
export function countUp(el, to, format = String, duration = 700) {
  const from = lastValues.has(el) ? lastValues.get(el) : 0;
  lastValues.set(el, to);
  if (!motionOK() || from === to) { el.textContent = format(to); return; }
  const start = performance.now();
  const step = (now) => {
    const k = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - k, 3);
    el.textContent = format(Math.round(from + (to - from) * eased));
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

// ---------- Particle burst (Done, all tasks finished) ----------
export function burst(x, y, { count = 22, spread = 90 } = {}) {
  if (!motionOK()) return;
  const styles = getComputedStyle(document.documentElement);
  const colors = [styles.getPropertyValue('--accent'), styles.getPropertyValue('--accent-2'), '#e8b98f', '#d9a7b4'];
  const layer = document.createElement('div');
  layer.className = 'burst-layer';
  document.body.append(layer);
  for (let i = 0; i < count; i++) {
    const p = document.createElement('i');
    const size = 4 + Math.random() * 5;
    p.style.cssText = `left:${x}px;top:${y}px;width:${size}px;height:${size}px;background:${colors[i % colors.length].trim()};border-radius:${Math.random() > .5 ? '50%' : '2px'}`;
    layer.append(p);
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.4;
    const dist = spread * (0.5 + Math.random() * 0.7);
    const dx = Math.cos(angle) * dist;
    const dy = Math.sin(angle) * dist - 20;
    p.animate(
      [
        { transform: 'translate(-50%, -50%) scale(1) rotate(0deg)', opacity: 1 },
        { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy + 40}px)) scale(.4) rotate(${Math.random() * 360}deg)`, opacity: 0 },
      ],
      { duration: 900 + Math.random() * 500, easing: 'cubic-bezier(.15,.7,.3,1)', fill: 'forwards' },
    );
  }
  setTimeout(() => layer.remove(), 1600);
}

export function burstFrom(el, opts) {
  const r = el.getBoundingClientRect();
  burst(r.left + r.width / 2, r.top + r.height / 2, opts);
}

// ---------- Ripple on buttons & chips ----------
function ripple(e) {
  const host = e.target.closest('.btn, .chip, .seg-btn, .tile');
  if (!host || !motionOK()) return;
  const r = host.getBoundingClientRect();
  const s = document.createElement('span');
  s.className = 'ripple';
  const size = Math.max(r.width, r.height) * 2;
  s.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX - r.left - size / 2}px;top:${e.clientY - r.top - size / 2}px`;
  host.append(s);
  s.addEventListener('animationend', () => s.remove());
}

// ---------- Cursor spotlight on cards ----------
function spotlight(e) {
  const el = e.target.closest?.('.card, .search, .intent-form, .tile');
  if (!el) return;
  const r = el.getBoundingClientRect();
  el.style.setProperty('--mx', `${e.clientX - r.left}px`);
  el.style.setProperty('--my', `${e.clientY - r.top}px`);
}

// ---------- Collapse an element out, then remove ----------
export function collapseOut(el) {
  if (!motionOK()) { el.remove(); return Promise.resolve(); }
  const h = el.offsetHeight;
  const a = el.animate(
    [
      { opacity: 1, height: h + 'px', transform: 'translateX(0)' },
      { opacity: 0, height: '0px', paddingTop: '0px', paddingBottom: '0px', transform: 'translateX(12px)' },
    ],
    { duration: 260, easing: 'cubic-bezier(.4,0,.2,1)' },
  );
  return a.finished.then(() => el.remove()).catch(() => el.remove());
}

export function initEffects() {
  document.addEventListener('pointerdown', ripple, { passive: true });
  document.addEventListener('pointermove', spotlight, { passive: true });
}
