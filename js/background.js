// Ambient background: soft drifting colour fields + gentle wave lines.
// Colours follow the time of day and the light/dark theme.
// Modes: 'cosmos' (default — stars, nebula, planet), 'animated' (soft colour fields),
//        'still' (one frame), 'plain' (off), 'photo' (your own image).
// Respects prefers-reduced-motion and pauses while the tab is hidden.

const FPS = 24; // calm, slow motion needs no more
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

// =========================================================
// Cosmos: another world — twinkling stars, a nebula, shooting
// stars, a ringed planet on the horizon, floating dust.
// Dark theme = deep space; light theme = a dreamy pastel sky.
//
// Performance: everything that doesn't move (sky, nebula, glow,
// planet) is painted ONCE into a cached canvas. Each frame only
// copies that image and draws the stars, one meteor and a little dust.
// =========================================================
const COSMOS = {
  dark: {
    sky: ['#03040b', '#090d24', '#140d2c'],
    nebula: ['#3b2a8a', '#0f5f5c', '#6c2a74', '#1d3f86'],
    nebulaAlpha: 0.5,
    starAlpha: 1,
    planet: ['#3a4fae', '#121a46', '#06081a'],
    rim: '127, 214, 189',
    ring: 'rgba(190, 200, 255, .35)',
    glow: ['rgba(80, 200, 180, .16)', 'rgba(140, 100, 255, .12)'],
    dust: '#b4e6dc',
  },
  light: {
    sky: ['#c9d4ff', '#efe4f6', '#ffe6d3'],
    nebula: ['#aebcff', '#ffc2dc', '#bfeee0', '#ffd6b0'],
    nebulaAlpha: 0.55,
    starAlpha: 0.85,
    planet: ['#ffffff', '#d6d8ff', '#b7b2ea'],
    rim: '255, 255, 255',
    ring: 'rgba(255, 255, 255, .7)',
    glow: ['rgba(255, 190, 160, .22)', 'rgba(170, 150, 255, .18)'],
    dust: '#ffffff',
  },
};
const PAD = 24; // extra edge on the cached scene so parallax never shows a gap
const MAX_STARS = 200;
const DUST_COUNT = 18;

let stars = [];
let dust = [];
let meteor = null;
let nextMeteor = 0;
let scene = null; // cached static layer
let sparkle = null; // pre-drawn glow + cross for bright stars
let cosmosKey = '';

function seedCosmos() {
  const count = Math.min(MAX_STARS, Math.round((w * h) / 7000));
  stars = Array.from({ length: count }, () => ({
    x: Math.random(), y: Math.random() * (dark ? 1 : 0.62),
    r: Math.random() < 0.06 ? 1.3 + Math.random() * 1.1 : 0.35 + Math.random() * 0.9,
    a: 0.35 + Math.random() * 0.65, sp: 0.6 + Math.random() * 2.2, ph: Math.random() * 6.3,
    d: 0.2 + Math.random() * 0.8,
  }));
  dust = Array.from({ length: DUST_COUNT }, () => ({
    x: Math.random(), y: Math.random(), r: 0.6 + Math.random() * 1.6,
    vy: 0.004 + Math.random() * 0.01, vx: (Math.random() - 0.5) * 0.004, ph: Math.random() * 6.3,
  }));
}

function makeCanvas(cw, ch) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(cw));
  c.height = Math.max(1, Math.round(ch));
  return c;
}

function buildSparkle() {
  const S = 64; // drawn once at high res, scaled down per star
  sparkle = makeCanvas(S, S);
  const g = sparkle.getContext('2d');
  const c = S / 2;
  const glow = g.createRadialGradient(c, c, 0, c, c, c);
  glow.addColorStop(0, 'rgba(255, 255, 255, .35)');
  glow.addColorStop(1, 'rgba(255, 255, 255, 0)');
  g.fillStyle = glow;
  g.fillRect(0, 0, S, S);
  g.strokeStyle = 'rgba(255, 255, 255, .5)';
  g.lineWidth = 1.2;
  g.beginPath();
  g.moveTo(c * 0.33, c); g.lineTo(c * 1.67, c);
  g.moveTo(c, c * 0.33); g.lineTo(c, c * 1.67);
  g.stroke();
}

function buildScene() {
  const P = COSMOS[dark ? 'dark' : 'light'];
  const cw = w + PAD * 2;
  const ch = h + PAD * 2;
  scene = makeCanvas(cw * dpr, ch * dpr);
  const g = scene.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, PAD * dpr, PAD * dpr); // (0,0) = screen top-left

  // sky
  const sky = g.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, P.sky[0]);
  sky.addColorStop(0.55, P.sky[1]);
  sky.addColorStop(1, P.sky[2]);
  g.fillStyle = sky;
  g.fillRect(-PAD, -PAD, cw, ch);

  // nebula
  const big = Math.max(w, h);
  BLOBS.forEach((b, i) => {
    const cx = b.x * w;
    const cy = b.y * 0.8 * h;
    const r = big * b.r * 0.85;
    const grad = g.createRadialGradient(cx, cy, 0, cx, cy, r);
    const c = P.nebula[i % P.nebula.length];
    grad.addColorStop(0, rgba(c, P.nebulaAlpha));
    grad.addColorStop(0.5, rgba(c, P.nebulaAlpha * 0.3));
    grad.addColorStop(1, rgba(c, 0));
    g.fillStyle = grad;
    g.fillRect(-PAD, -PAD, cw, ch);
  });

  // horizon glow
  const hg = g.createRadialGradient(w * 0.5, h * 1.15, 0, w * 0.5, h * 1.15, h * 0.9);
  hg.addColorStop(0, P.glow[0]);
  hg.addColorStop(0.6, P.glow[1]);
  hg.addColorStop(1, 'rgba(0, 0, 0, 0)');
  g.fillStyle = hg;
  g.fillRect(-PAD, -PAD, cw, ch);

  // ringed planet low on the right
  const pr = Math.min(w, h) * 0.3;
  const px = w * 0.88;
  const py = h * 1.04;
  const ring = (from, to) => {
    g.save();
    g.translate(px, py);
    g.rotate(-0.32);
    g.scale(1, 0.22);
    g.strokeStyle = P.ring;
    g.lineWidth = pr * 0.09;
    g.beginPath();
    g.arc(0, 0, pr * 1.7, from, to);
    g.stroke();
    g.restore();
  };
  ring(Math.PI, Math.PI * 2);
  const pg = g.createRadialGradient(px - pr * 0.45, py - pr * 0.5, pr * 0.1, px, py, pr);
  pg.addColorStop(0, P.planet[0]);
  pg.addColorStop(0.6, P.planet[1]);
  pg.addColorStop(1, P.planet[2]);
  g.fillStyle = pg;
  g.beginPath();
  g.arc(px, py, pr, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = `rgba(${P.rim}, .45)`;
  g.lineWidth = 2;
  g.beginPath();
  g.arc(px, py, pr - 1, Math.PI * 1.05, Math.PI * 1.6);
  g.stroke();
  ring(0, Math.PI);
}

// Rebuild the cached scene only when size or theme changes.
function ensureCosmos() {
  const key = `${w}x${h}@${dpr}-${dark}`;
  if (key === cosmosKey && scene) return;
  cosmosKey = key;
  seedCosmos();
  buildScene();
  if (!sparkle) buildSparkle();
}

function drawCosmos(time) {
  ensureCosmos();
  const t = (time - t0) / 1000;
  const P = COSMOS[dark ? 'dark' : 'light'];
  pointer.sx += (pointer.x - pointer.sx) * 0.04;
  pointer.sy += (pointer.y - pointer.sy) * 0.04;

  // static layer (gentle parallax by shifting the cached image)
  ctx.globalAlpha = 1;
  ctx.drawImage(scene, -PAD - pointer.sx * 12, -PAD - pointer.sy * 9, w + PAD * 2, h + PAD * 2);

  // stars: tiny squares for the small ones, a pre-drawn sprite for the bright ones
  ctx.fillStyle = '#fff';
  for (const s of stars) {
    const x = s.x * w + pointer.sx * 10 * s.d;
    const y = s.y * h + pointer.sy * 8 * s.d;
    ctx.globalAlpha = s.a * (0.55 + 0.45 * Math.sin(t * s.sp + s.ph)) * P.starAlpha;
    if (s.r > 1.3) {
      const size = s.r * 12;
      ctx.drawImage(sparkle, x - size / 2, y - size / 2, size, size);
      ctx.beginPath();
      ctx.arc(x, y, s.r, 0, Math.PI * 2);
      ctx.fill();
    } else {
      const d = s.r * 1.8;
      ctx.fillRect(x - d / 2, y - d / 2, d, d);
    }
  }
  ctx.globalAlpha = 1;

  // shooting star every 7–15 s
  if (!meteor && t > nextMeteor) {
    meteor = { x: 0.35 + Math.random() * 0.6, y: Math.random() * 0.35, born: t, len: 140 + Math.random() * 120 };
    nextMeteor = t + 7 + Math.random() * 8;
  }
  if (meteor) {
    const k = (t - meteor.born) / 1.1;
    if (k >= 1 || k < 0) meteor = null;
    else {
      const sx = meteor.x * w - k * w * 0.35;
      const sy = meteor.y * h + k * h * 0.22;
      const tx = sx + meteor.len * 0.85;
      const ty = sy - meteor.len * 0.53;
      const fade = Math.sin(k * Math.PI);
      const g = ctx.createLinearGradient(sx, sy, tx, ty);
      g.addColorStop(0, `rgba(255, 255, 255, ${0.9 * fade})`);
      g.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.strokeStyle = g;
      ctx.lineWidth = 1.6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(tx, ty);
      ctx.stroke();
    }
  }

  // floating dust, drifting upward
  ctx.fillStyle = P.dust;
  for (const d of dust) {
    d.y -= d.vy / FPS;
    d.x += d.vx / FPS;
    if (d.y < -0.02) { d.y = 1.02; d.x = Math.random(); }
    ctx.globalAlpha = (dark ? 0.25 : 0.45) + 0.25 * Math.sin(t * 1.3 + d.ph);
    const s = d.r * 1.8;
    ctx.fillRect(d.x * w + pointer.sx * 20 - s / 2, d.y * h + pointer.sy * 16 - s / 2, s, s);
  }
  ctx.globalAlpha = 1;
}

function frame(time) {
  if (mode === 'cosmos') drawCosmos(time);
  else draw(time);
}

function loop(time) {
  raf = requestAnimationFrame(loop);
  if (time - lastFrame < 1000 / FPS) return;
  lastFrame = time;
  frame(time);
}

function stop() {
  if (raf) cancelAnimationFrame(raf);
  raf = 0;
}

let paused = false; // set while the page is idle or the window is in the background

// Animate only when someone is actually looking.
function canAnimate() {
  return mode !== 'still' && !reduceMotion.matches && !document.hidden && !paused;
}

function resume() {
  if (raf || !canvas || canvas.hidden) return;
  if (canAnimate()) raf = requestAnimationFrame(loop);
}

function start() {
  stop();
  const root = document.documentElement;
  // CSS swaps live blur for a frosted surface while the background moves.
  if ((mode === 'cosmos' || mode === 'animated') && !reduceMotion.matches) root.dataset.motion = ''; else delete root.dataset.motion;
  if (mode === 'plain' || mode === 'photo') { canvas.hidden = true; delete root.dataset.world; return; } // photo: an image is shown instead
  canvas.hidden = false;
  pickPalette();
  resize();
  // CSS uses this for the "other world" glass look.
  if (mode === 'cosmos') document.documentElement.dataset.world = 'cosmos'; else delete document.documentElement.dataset.world;
  frame(mode === 'still' ? t0 + 40000 : performance.now()); // paint now, even if we don't animate
  resume();
}

export function initBackground(initialMode) {
  canvas = document.getElementById('bg');
  ctx = canvas.getContext('2d');
  mode = initialMode || 'animated';

  window.addEventListener('pointermove', (e) => {
    pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
  }, { passive: true });

  // Rebuild once the window stops resizing, not on every pixel of a drag.
  let resizeTimer = 0;
  window.addEventListener('resize', () => {
    if (mode === 'plain' || mode === 'photo') return;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(start, 150);
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop();
    else resume();
  });
  // Nobody using the page for a while, or the window is in the background:
  // freeze on the current frame. Mouse or keyboard wakes it up again.
  document.addEventListener('intent:idle', (e) => {
    paused = e.detail;
    if (paused) stop(); else resume();
  });
  darkQuery.addEventListener('change', start);
  reduceMotion.addEventListener('change', start);
  // Colours follow the time of day: re-check every 5 minutes.
  setInterval(() => {
    if (mode !== 'animated' && mode !== 'still') return;
    pickPalette();
    if (!raf) frame(mode === 'still' ? t0 + 40000 : performance.now());
  }, 5 * 60 * 1000);

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
