// Ambient background: soft drifting colour fields + gentle wave lines.
// Colours follow the time of day and the light/dark theme.
// Modes: 'animated' (default), 'still' (one frame), 'plain' (off).
// Respects prefers-reduced-motion and pauses while the tab is hidden.

const FPS = 30;
const DPR_MAX = 1.5;
const WAVE_COUNT = 7;

// Three blob colours per time of day, for light and dark themes.
const PALETTES = {
  light: {
    morning: ['#f2c6a4', '#b7d4c3', '#f1dfb8', '#e9b9a6'],
    day:     ['#a8d0bf', '#b9d0e8', '#e9dcbc', '#c4dccb'],
    evening: ['#f0b596', '#dba5b6', '#c8c1e2', '#f2cfa0'],
    night:   ['#a2b9cf', '#b8b0d9', '#a6cbbd', '#c5c9e6'],
  },
  dark: {
    morning: ['#5b3c2b', '#2c4a3d', '#4d422c', '#4f3330'],
    day:     ['#22463a', '#243a52', '#3e3926', '#1f3f36'],
    evening: ['#5c3226', '#4c2a3b', '#2e2b4d', '#553b22'],
    night:   ['#1b3348', '#2c2752', '#1d3e33', '#2a2f55'],
  },
};

let canvas, ctx, w = 0, h = 0, dpr = 1;
let mode = 'animated';
let raf = 0, lastFrame = 0, t0 = performance.now();
let palette = null, dark = false;

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');

function isDark() {
  const forced = document.documentElement.dataset.theme;
  if (forced === 'dark') return true;
  if (forced === 'light') return false;
  return darkQuery.matches;
}

function period(hour) {
  if (hour >= 5 && hour < 11) return 'morning';
  if (hour >= 11 && hour < 17) return 'day';
  if (hour >= 17 && hour < 21) return 'evening';
  return 'night';
}

function rgba(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

function pickPalette() {
  dark = isDark();
  palette = PALETTES[dark ? 'dark' : 'light'][period(new Date().getHours())];
}

function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, DPR_MAX);
  w = window.innerWidth;
  h = window.innerHeight;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

// Blob paths: centre (fraction of screen), drift radius, speed, phase.
const BLOBS = [
  { x: 0.15, y: 0.10, rx: 0.10, ry: 0.08, s: 0.050, p: 0.0, r: 0.60 },
  { x: 0.88, y: 0.18, rx: 0.08, ry: 0.10, s: 0.041, p: 1.7, r: 0.52 },
  { x: 0.70, y: 0.92, rx: 0.12, ry: 0.06, s: 0.036, p: 3.1, r: 0.62 },
  { x: 0.20, y: 0.85, rx: 0.09, ry: 0.07, s: 0.045, p: 4.4, r: 0.48 },
];

// Gentle parallax: blobs lean a little toward the mouse.
const pointer = { x: 0, y: 0, sx: 0, sy: 0 };
const PARALLAX = 36; // px

function draw(time) {
  const t = (time - t0) / 1000;
  pointer.sx += (pointer.x - pointer.sx) * 0.04;
  pointer.sy += (pointer.y - pointer.sy) * 0.04;
  ctx.clearRect(0, 0, w, h);

  // 1. colour fields
  const big = Math.max(w, h);
  const alpha = dark ? 0.75 : 0.62;
  BLOBS.forEach((b, i) => {
    const depth = i % 2 ? 1 : -0.6;
    const cx = (b.x + Math.sin(t * b.s + b.p) * b.rx) * w + pointer.sx * PARALLAX * depth;
    const cy = (b.y + Math.cos(t * b.s * 0.8 + b.p) * b.ry) * h + pointer.sy * PARALLAX * depth;
    const r = big * b.r * (1 + Math.sin(t * b.s * 1.3 + i) * 0.06);
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    const c = palette[i % palette.length];
    g.addColorStop(0, rgba(c, alpha));
    g.addColorStop(0.55, rgba(c, alpha * 0.35));
    g.addColorStop(1, rgba(c, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });

  // 2. wave lines, kept to the lower part of the screen
  ctx.lineWidth = 1;
  const step = 8;
  for (let i = 0; i < WAVE_COUNT; i++) {
    const k = i / (WAVE_COUNT - 1);
    const y0 = h * (0.62 + k * 0.30);
    const a1 = 14 + k * 10;
    const a2 = 6 + (1 - k) * 6;
    const lineAlpha = (dark ? 0.07 : 0.09) * (0.5 + k * 0.7);
    ctx.strokeStyle = dark ? `rgba(210, 235, 222, ${lineAlpha})` : `rgba(50, 75, 64, ${lineAlpha})`;
    ctx.beginPath();
    for (let x = -step; x <= w + step; x += step) {
      const y = y0 + pointer.sy * (6 + k * 10)
        + Math.sin(x * 0.0035 + t * 0.22 + i * 0.7) * a1
        + Math.sin(x * 0.0081 - t * 0.15 + i * 1.9) * a2;
      if (x === -step) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
}

function loop(time) {
  raf = requestAnimationFrame(loop);
  if (time - lastFrame < 1000 / FPS) return;
  lastFrame = time;
  draw(time);
}

function stop() {
  if (raf) cancelAnimationFrame(raf);
  raf = 0;
}

function start() {
  stop();
  if (mode === 'plain' || mode === 'photo') { canvas.hidden = true; return; } // photo: an image is shown instead
  canvas.hidden = false;
  pickPalette();
  resize();
  if (mode === 'still' || reduceMotion.matches || document.hidden) {
    draw(t0 + 40000); // a pleasant fixed moment
    return;
  }
  raf = requestAnimationFrame(loop);
}

export function initBackground(initialMode) {
  canvas = document.getElementById('bg');
  ctx = canvas.getContext('2d');
  mode = initialMode || 'animated';

  window.addEventListener('pointermove', (e) => {
    pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
  }, { passive: true });

  window.addEventListener('resize', () => { if (mode === 'plain') return; resize(); if (!raf) start(); });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop();
    else start();
  });
  darkQuery.addEventListener('change', start);
  reduceMotion.addEventListener('change', start);
  // Colours follow the time of day: re-check every 5 minutes.
  setInterval(() => { if (mode !== 'plain') pickPalette(); if (!raf && mode !== 'plain') start(); }, 5 * 60 * 1000);

  start();
}

export function setBackgroundMode(next) {
  mode = next || 'animated';
  start();
}

// Call after the theme changes.
export function refreshBackground() {
  start();
}
