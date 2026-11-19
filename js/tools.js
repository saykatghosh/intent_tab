// Developer tools inside Intent Tab — all local, no network:
//   JSON · Encode (Base64 / URL / JWT) · Timestamp · Color · Generate (UUID / password) · Regex · Units
// Open them from Ctrl+K. The palette also answers instantly for things you type:
//   2*(3+4)  ·  1732032000  ·  #7fd6bd  ·  24px  ·  eyJhbGciOi…  ·  uuid  ·  password

import { t, locale } from './strings.js';
import { registerCommands } from './palette.js';

const $ = (id) => document.getElementById(id);
const TOOLS = ['json', 'encode', 'time', 'color', 'gen', 'regex', 'units'];
let toastFn = () => {};
let active = 'json';

// ---------- helpers ----------
function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

async function copy(text) {
  try { await navigator.clipboard.writeText(String(text)); toastFn(t('copied')); } catch { toastFn(String(text)); }
}

function copyBtn(get) {
  const b = el('button', 'tool-copy');
  b.type = 'button';
  b.title = t('askCopy');
  b.setAttribute('aria-label', t('askCopy'));
  b.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M8 8h11v12H8z M5 16V4h11"/></svg>';
  b.addEventListener('click', () => copy(typeof get === 'function' ? get() : get));
  return b;
}

// One labelled output line with a copy button.
function outRow(label, value) {
  const row = el('div', 'tool-out');
  row.append(el('span', 'tool-out-label', label), el('code', 'tool-out-value', value), copyBtn(() => value));
  return row;
}

function input(type, cls, value = '', placeholder = '') {
  const i = el(type === 'textarea' ? 'textarea' : 'input', cls);
  if (type !== 'textarea') i.type = type;
  i.value = value;
  if (placeholder) i.placeholder = placeholder;
  i.spellcheck = false;
  return i;
}

function seg(options, current, onPick) {
  const box = el('div', 'seg tool-seg');
  for (const [id, label] of options) {
    const b = el('button', 'seg-btn', label);
    b.type = 'button';
    b.setAttribute('aria-pressed', String(id === current));
    b.classList.toggle('is-active', id === current);
    b.addEventListener('click', () => onPick(id));
    box.append(b);
  }
  return box;
}

// ---------- calculator (safe: a tiny parser, no eval) ----------
export function calc(expr) {
  const s = String(expr).replace(/\s+/g, '').replace(/×/g, '*').replace(/÷/g, '/');
  let i = 0;
  const num = () => {
    const start = i;
    while (/[\d.]/.test(s[i] || '')) i++;
    if (start === i) throw new Error('number expected');
    return parseFloat(s.slice(start, i));
  };
  const factor = () => {
    if (s[i] === '+') { i++; return factor(); }
    if (s[i] === '-') { i++; return -factor(); }
    if (s[i] === '(') { i++; const v = sum(); if (s[i] !== ')') throw new Error(') expected'); i++; return v; }
    return num();
  };
  const power = () => { const b = factor(); if (s[i] === '^') { i++; return b ** power(); } return b; };
  const product = () => {
    let v = power();
    while (s[i] === '*' || s[i] === '/' || s[i] === '%') {
      const op = s[i++]; const r = power();
      v = op === '*' ? v * r : op === '/' ? v / r : v % r;
    }
    return v;
  };
  const sum = () => {
    let v = product();
    while (s[i] === '+' || s[i] === '-') { const op = s[i++]; const r = product(); v = op === '+' ? v + r : v - r; }
    return v;
  };
  const v = sum();
  if (i !== s.length) throw new Error('unexpected input');
  return v;
}

function fmtNum(n) {
  if (!Number.isFinite(n)) return String(n);
  return String(Math.round(n * 1e10) / 1e10);
}

// ---------- time ----------
function parseTime(raw) {
  const s = String(raw || '').trim();
  if (!s) return null;
  if (/^-?\d{9,11}$/.test(s)) return new Date(Number(s) * 1000);
  if (/^-?\d{12,14}$/.test(s)) return new Date(Number(s));
  const d = new Date(s);
  return isNaN(d) ? null : d;
}

function relative(d) {
  const diff = (d.getTime() - Date.now()) / 1000;
  const units = [['year', 31536000], ['month', 2592000], ['week', 604800], ['day', 86400], ['hour', 3600], ['minute', 60], ['second', 1]];
  const rtf = new Intl.RelativeTimeFormat(locale(), { numeric: 'auto' });
  for (const [u, sec] of units) {
    if (Math.abs(diff) >= sec || u === 'second') return rtf.format(Math.round(diff / sec), u);
  }
  return '';
}

// ---------- color ----------
let probe = null;
export function parseColor(str) {
  const s = String(str || '').trim();
  if (!s) return null;
  if (!CSS.supports('color', s) && !CSS.supports('color', '#' + s)) return null;
  const css = CSS.supports('color', s) ? s : '#' + s;
  probe = probe || Object.assign(document.createElement('canvas'), { width: 1, height: 1 }).getContext('2d', { willReadFrequently: true });
  probe.clearRect(0, 0, 1, 1);
  probe.fillStyle = '#000';
  probe.fillStyle = css;
  probe.fillRect(0, 0, 1, 1);
  const [r, g, b, a] = probe.getImageData(0, 0, 1, 1).data;
  return { r, g, b, a: Math.round((a / 255) * 100) / 100 };
}

const hex2 = (n) => n.toString(16).padStart(2, '0');
function toHex({ r, g, b, a }) { return '#' + hex2(r) + hex2(g) + hex2(b) + (a < 1 ? hex2(Math.round(a * 255)) : ''); }
function toRgb({ r, g, b, a }) { return a < 1 ? `rgb(${r} ${g} ${b} / ${a})` : `rgb(${r} ${g} ${b})`; }
function toHsl({ r, g, b, a }) {
  const R = r / 255, G = g / 255, B = b / 255;
  const max = Math.max(R, G, B), min = Math.min(R, G, B);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    h = max === R ? (G - B) / d + (G < B ? 6 : 0) : max === G ? (B - R) / d + 2 : (R - G) / d + 4;
    h *= 60;
  }
  const out = `${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
  return a < 1 ? `hsl(${out} / ${a})` : `hsl(${out})`;
}
function toOklch({ r, g, b, a }) {
  const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  const [R, G, B] = [lin(r), lin(g), lin(b)];
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
  const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
  const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
  const L = 0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s;
  const Bb = 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s;
  const C = Math.sqrt(A * A + Bb * Bb);
  let H = (Math.atan2(Bb, A) * 180) / Math.PI;
  if (H < 0) H += 360;
  const out = `${(L * 100).toFixed(1)}% ${C.toFixed(3)} ${C < 0.0005 ? 0 : H.toFixed(1)}`;
  return a < 1 ? `oklch(${out} / ${a})` : `oklch(${out})`;
}
function luminance({ r, g, b }) {
  const f = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
export function contrast(c1, c2) {
  const [a, b] = [luminance(c1), luminance(c2)].sort((x, y) => y - x);
  return (a + 0.05) / (b + 0.05);
}

// ---------- encoding ----------
function b64encode(s) { return btoa(String.fromCharCode(...new TextEncoder().encode(s))); }
function b64decode(s) {
  const clean = s.trim().replace(/-/g, '+').replace(/_/g, '/').replace(/\s+/g, '');
  const pad = clean + '==='.slice((clean.length + 3) % 4);
  return new TextDecoder().decode(Uint8Array.from(atob(pad), (c) => c.charCodeAt(0)));
}
export function decodeJwt(token) {
  const parts = String(token).trim().split('.');
  if (parts.length < 2) throw new Error(t('toolJwtInvalid'));
  return { header: JSON.parse(b64decode(parts[0])), payload: JSON.parse(b64decode(parts[1])) };
}
function looksLikeJwt(s) { return /^eyJ[\w-]+\.eyJ[\w-]+\.[\w-]*$/.test(String(s).trim()); }

// ---------- generators ----------
function password(len, { upper, digits, symbols }) {
  let chars = 'abcdefghijkmnopqrstuvwxyz';
  if (upper) chars += 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  if (digits) chars += '23456789';
  if (symbols) chars += '!@#$%^&*()-_=+[]{};:,.?';
  const out = [];
  const buf = new Uint32Array(len);
  crypto.getRandomValues(buf);
  for (let i = 0; i < len; i++) out.push(chars[buf[i] % chars.length]);
  return { value: out.join(''), bits: Math.round(len * Math.log2(chars.length)) };
}

// =========================================================
// Tool panels
// =========================================================
const state = { json: '', enc: { mode: 'b64e', text: '' }, time: '', color: '#7fd6bd', regex: { p: '\\b\\w+@\\w+\\.\\w+\\b', f: 'g', text: 'Write to hello@example.com or team@intent.tab' }, units: { px: '16', base: '16', bytes: '1048576' }, pw: { len: 20, upper: true, digits: true, symbols: true } };

const PANELS = {
  json(box) {
    const ta = input('textarea', 'tool-area', state.json, '{"paste": "JSON here"}');
    const out = el('pre', 'tool-pre');
    const err = el('p', 'form-error');
    err.hidden = true;
    const run = (minify) => {
      state.json = ta.value;
      err.hidden = true;
      if (!ta.value.trim()) { out.textContent = ''; return; }
      try {
        const v = JSON.parse(ta.value);
        out.textContent = minify ? JSON.stringify(v) : JSON.stringify(v, null, 2);
      } catch (e) {
        out.textContent = '';
        err.textContent = e.message;
        err.hidden = false;
      }
    };
    const actions = el('div', 'tool-actions');
    const fmt = el('button', 'btn btn-quiet btn-sm', t('toolFormat'));
    const min = el('button', 'btn btn-quiet btn-sm', t('toolMinify'));
    const cp = el('button', 'btn btn-primary btn-sm', t('askCopy'));
    [fmt, min, cp].forEach((b) => { b.type = 'button'; });
    fmt.addEventListener('click', () => run(false));
    min.addEventListener('click', () => run(true));
    cp.addEventListener('click', () => copy(out.textContent || ta.value));
    ta.addEventListener('input', () => run(false));
    actions.append(fmt, min, cp);
    box.append(ta, actions, err, out);
    run(false);
  },

  encode(box) {
    const modes = [['b64e', 'Base64 →'], ['b64d', '← Base64'], ['urle', 'URL →'], ['urld', '← URL'], ['jwt', 'JWT']];
    const ta = input('textarea', 'tool-area', state.enc.text, t('toolEncodePlaceholder'));
    const out = el('pre', 'tool-pre');
    const err = el('p', 'form-error');
    err.hidden = true;
    const run = () => {
      state.enc.text = ta.value;
      err.hidden = true;
      out.textContent = '';
      if (!ta.value) return;
      try {
        const v = ta.value;
        switch (state.enc.mode) {
          case 'b64e': out.textContent = b64encode(v); break;
          case 'b64d': out.textContent = b64decode(v); break;
          case 'urle': out.textContent = encodeURIComponent(v); break;
          case 'urld': out.textContent = decodeURIComponent(v.replace(/\+/g, ' ')); break;
          case 'jwt': {
            const { header, payload } = decodeJwt(v);
            const when = (k) => (typeof payload[k] === 'number' ? `\n// ${k}: ${new Date(payload[k] * 1000).toLocaleString(locale())} (${relative(new Date(payload[k] * 1000))})` : '');
            out.textContent = `// header\n${JSON.stringify(header, null, 2)}\n\n// payload${when('iat')}${when('exp')}\n${JSON.stringify(payload, null, 2)}\n\n// ${t('toolJwtNote')}`;
            break;
          }
        }
      } catch (e) {
        err.textContent = e.message || String(e);
        err.hidden = false;
      }
    };
    const s = seg(modes, state.enc.mode, (id) => { state.enc.mode = id; render(); });
    ta.addEventListener('input', run);
    const cp = el('button', 'btn btn-primary btn-sm', t('askCopy'));
    cp.type = 'button';
    cp.addEventListener('click', () => copy(out.textContent));
    const actions = el('div', 'tool-actions');
    actions.append(cp);
    box.append(s, ta, err, out, actions);
    run();
  },

  time(box) {
    const inp = input('text', 'tool-input', state.time || String(Math.floor(Date.now() / 1000)), '1732032000 · 2026-01-31 14:00 · now');
    const now = el('button', 'btn btn-quiet btn-sm', t('toolNow'));
    now.type = 'button';
    const outs = el('div', 'tool-outs');
    const run = () => {
      state.time = inp.value;
      outs.textContent = '';
      const d = inp.value.trim().toLowerCase() === 'now' ? new Date() : parseTime(inp.value);
      if (!d) { outs.append(el('p', 'muted small', t('toolTimeInvalid'))); return; }
      outs.append(
        outRow(t('toolLocal'), d.toLocaleString(locale(), { dateStyle: 'full', timeStyle: 'long' })),
        outRow('ISO 8601', d.toISOString()),
        outRow('UTC', d.toUTCString()),
        outRow('Unix (s)', String(Math.floor(d.getTime() / 1000))),
        outRow('Unix (ms)', String(d.getTime())),
        outRow(t('toolRelative'), relative(d)),
      );
    };
    now.addEventListener('click', () => { inp.value = String(Math.floor(Date.now() / 1000)); run(); });
    inp.addEventListener('input', run);
    const row = el('div', 'tool-inline');
    row.append(inp, now);
    box.append(row, outs);
    run();
  },

  color(box) {
    const inp = input('text', 'tool-input', state.color, '#7fd6bd · rgb(…) · hsl(…) · oklch(…) · teal');
    const picker = input('color', 'tool-picker');
    const swatch = el('div', 'tool-swatch');
    const outs = el('div', 'tool-outs');
    const run = () => {
      state.color = inp.value;
      outs.textContent = '';
      const c = parseColor(inp.value);
      if (!c) { swatch.style.background = 'transparent'; outs.append(el('p', 'muted small', t('toolColorInvalid'))); return; }
      swatch.style.background = toRgb(c);
      picker.value = toHex({ ...c, a: 1 }).slice(0, 7);
      outs.append(outRow('HEX', toHex(c)), outRow('RGB', toRgb(c)), outRow('HSL', toHsl(c)), outRow('OKLCH', toOklch(c)));
      // WCAG contrast against white and black
      const grid = el('div', 'tool-contrast');
      for (const [name, bg] of [['White', { r: 255, g: 255, b: 255 }], ['Black', { r: 0, g: 0, b: 0 }]]) {
        const ratio = contrast(c, bg);
        const cell = el('div', 'tool-contrast-cell');
        cell.style.background = toRgb({ ...bg, a: 1 });
        cell.style.color = toRgb({ ...c, a: 1 });
        const grade = ratio >= 7 ? 'AAA' : ratio >= 4.5 ? 'AA' : ratio >= 3 ? 'AA Large' : t('toolFail');
        cell.append(el('strong', null, 'Aa'), el('span', null, `${ratio.toFixed(2)}:1 · ${grade} · ${name === 'White' ? t('toolOnWhite') : t('toolOnBlack')}`));
        grid.append(cell);
      }
      outs.append(grid);
    };
    inp.addEventListener('input', run);
    picker.addEventListener('input', () => { inp.value = picker.value; run(); });
    const row = el('div', 'tool-inline');
    row.append(swatch, inp, picker);
    box.append(row, outs);
    run();
  },

  gen(box) {
    // UUIDs
    box.append(el('h3', 'tool-sub', 'UUID v4'));
    const list = el('div', 'tool-outs');
    const fill = () => {
      list.textContent = '';
      for (let i = 0; i < 4; i++) list.append(outRow(String(i + 1), crypto.randomUUID()));
    };
    const again = el('button', 'btn btn-quiet btn-sm', t('toolRegenerate'));
    again.type = 'button';
    again.addEventListener('click', fill);
    box.append(list, again);
    fill();

    // Password
    box.append(el('h3', 'tool-sub', t('toolPassword')));
    const opts = state.pw;
    const out = el('div', 'tool-outs');
    const len = input('range', 'tool-range', String(opts.len));
    len.min = '8'; len.max = '64';
    const lenLabel = el('span', 'tool-out-label');
    const checks = el('div', 'tool-checks');
    for (const [k, label] of [['upper', 'A–Z'], ['digits', '0–9'], ['symbols', '!@#']]) {
      const l = el('label', 'tool-check');
      const c = input('checkbox', '');
      c.checked = !!opts[k];
      c.addEventListener('change', () => { opts[k] = c.checked; make(); });
      l.append(c, label);
      checks.append(l);
    }
    const make = () => {
      opts.len = Number(len.value);
      lenLabel.textContent = t('toolLength', { n: opts.len });
      const p = password(opts.len, opts);
      out.textContent = '';
      out.append(outRow(t('toolBits', { n: p.bits }), p.value));
    };
    len.addEventListener('input', make);
    const row = el('div', 'tool-inline');
    row.append(lenLabel, len, checks);
    const regen = el('button', 'btn btn-quiet btn-sm', t('toolRegenerate'));
    regen.type = 'button';
    regen.addEventListener('click', make);
    box.append(row, out, regen);
    make();
  },

  regex(box) {
    const st = state.regex;
    const row = el('div', 'tool-inline tool-regex');
    const slash1 = el('span', 'tool-slash', '/');
    const pat = input('text', 'tool-input', st.p, 'pattern');
    const slash2 = el('span', 'tool-slash', '/');
    const flags = input('text', 'tool-input tool-flags', st.f, 'gimsuy');
    row.append(slash1, pat, slash2, flags);
    const ta = input('textarea', 'tool-area', st.text, t('toolRegexText'));
    const view = el('div', 'tool-pre tool-highlight');
    const info = el('div', 'tool-outs');
    const err = el('p', 'form-error');
    err.hidden = true;
    const run = () => {
      Object.assign(st, { p: pat.value, f: flags.value, text: ta.value });
      view.textContent = '';
      info.textContent = '';
      err.hidden = true;
      if (!pat.value) { view.textContent = ta.value; return; }
      let re;
      try {
        const f = flags.value.replace(/[^dgimsuyv]/g, '');
        re = new RegExp(pat.value, f.includes('g') ? f : f + 'g');
      } catch (e) {
        err.textContent = e.message;
        err.hidden = false;
        view.textContent = ta.value;
        return;
      }
      let last = 0;
      let count = 0;
      let first = null;
      for (const m of ta.value.matchAll(re)) {
        if (count++ > 1000) break;
        if (!first) first = m;
        view.append(ta.value.slice(last, m.index));
        view.append(el('mark', null, m[0] || '∅'));
        last = m.index + m[0].length;
      }
      view.append(ta.value.slice(last));
      info.append(el('p', 'muted small', t('toolMatches', { n: count })));
      if (first && first.length > 1) {
        for (let i = 1; i < first.length; i++) info.append(outRow(`$${i}`, first[i] ?? ''));
      }
      if (first && first.groups) {
        for (const [k, v] of Object.entries(first.groups)) info.append(outRow(`<${k}>`, v ?? ''));
      }
    };
    [pat, flags, ta].forEach((x) => x.addEventListener('input', run));
    box.append(row, err, ta, view, info);
    run();
  },

  units(box) {
    const u = state.units;
    // px ↔ rem
    box.append(el('h3', 'tool-sub', 'px ↔ rem'));
    const px = input('text', 'tool-input tool-num', u.px);
    const base = input('text', 'tool-input tool-num', u.base);
    const pxOut = el('div', 'tool-outs');
    const runPx = () => {
      Object.assign(u, { px: px.value, base: base.value });
      pxOut.textContent = '';
      const v = parseFloat(px.value);
      const b = parseFloat(base.value) || 16;
      if (!Number.isFinite(v)) return;
      pxOut.append(outRow(`${fmtNum(v)}px`, `${fmtNum(v / b)}rem`), outRow(`${fmtNum(v)}rem`, `${fmtNum(v * b)}px`));
    };
    const r1 = el('div', 'tool-inline');
    r1.append(el('span', 'tool-out-label', t('toolValue')), px, el('span', 'tool-out-label', t('toolBase')), base);
    [px, base].forEach((x) => x.addEventListener('input', runPx));
    box.append(r1, pxOut);
    runPx();

    // Bytes
    box.append(el('h3', 'tool-sub', t('toolBytes')));
    const bytes = input('text', 'tool-input tool-num', u.bytes);
    const bOut = el('div', 'tool-outs tool-grid2');
    const runB = () => {
      u.bytes = bytes.value;
      bOut.textContent = '';
      const n = parseFloat(bytes.value);
      if (!Number.isFinite(n)) return;
      for (const [label, div] of [['KB', 1e3], ['KiB', 1024], ['MB', 1e6], ['MiB', 1024 ** 2], ['GB', 1e9], ['GiB', 1024 ** 3]]) {
        bOut.append(outRow(label, fmtNum(Math.round((n / div) * 1e4) / 1e4)));
      }
    };
    const r2 = el('div', 'tool-inline');
    r2.append(el('span', 'tool-out-label', 'Bytes'), bytes);
    bytes.addEventListener('input', runB);
    box.append(r2, bOut);
    runB();

    // Time zones
    box.append(el('h3', 'tool-sub', t('toolZones')));
    const when = input('datetime-local', 'tool-input');
    const d0 = new Date();
    d0.setSeconds(0, 0);
    when.value = new Date(d0.getTime() - d0.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    const zOut = el('div', 'tool-outs');
    const ZONES = ['UTC', 'America/Los_Angeles', 'America/New_York', 'Europe/London', 'Europe/Berlin', 'Asia/Dhaka', 'Asia/Kolkata', 'Asia/Singapore', 'Asia/Tokyo', 'Australia/Sydney'];
    const runZ = () => {
      zOut.textContent = '';
      const d = new Date(when.value);
      if (isNaN(d)) return;
      for (const z of ZONES) {
        const s = d.toLocaleString(locale(), { timeZone: z, weekday: 'short', hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' });
        zOut.append(outRow(z.replace(/_/g, ' '), s));
      }
    };
    when.addEventListener('input', runZ);
    const r3 = el('div', 'tool-inline');
    r3.append(el('span', 'tool-out-label', t('toolLocalTime')), when);
    box.append(r3, zOut);
    runZ();
  },
};

// =========================================================
// Dialog
// =========================================================
function render() {
  const tabs = $('toolTabs');
  tabs.textContent = '';
  for (const id of TOOLS) {
    const b = el('button', 'tool-tab', t('tool_' + id));
    b.type = 'button';
    b.setAttribute('role', 'tab');
    b.setAttribute('aria-selected', String(id === active));
    b.addEventListener('click', () => { active = id; render(); });
    tabs.append(b);
  }
  const body = $('toolBody');
  body.textContent = '';
  PANELS[active](body);
  body.querySelector('textarea, input[type="text"]')?.focus({ preventScroll: true });
}

export function openTool(id = active, preset) {
  active = TOOLS.includes(id) ? id : 'json';
  if (preset != null) {
    if (active === 'json') state.json = preset;
    if (active === 'encode') { state.enc.text = preset; if (looksLikeJwt(preset)) state.enc.mode = 'jwt'; }
    if (active === 'time') state.time = preset;
    if (active === 'color') state.color = preset;
  }
  render();
  if (!$('toolsDialog').open) $('toolsDialog').showModal();
}

// =========================================================
// Palette: instant answers + tool launchers
// =========================================================
function instant(q) {
  const out = [];
  const s = q.trim();
  if (!s) return out;

  // Calculator: needs at least one operator and one digit.
  if (/^[\d\s.+\-*/%^()×÷]+$/.test(s) && /\d/.test(s) && /[+\-*/%^×÷]/.test(s.replace(/^-/, ''))) {
    try {
      const v = fmtNum(calc(s));
      out.push({ group: 'quick', always: true, rank: 9, icon: 'calc', label: `= ${v}`, hint: t('toolCopyHint'), run: () => copy(v) });
    } catch { /* not a full expression yet */ }
  }
  // Unix timestamp
  if (/^\d{10}$|^\d{13}$/.test(s)) {
    const d = parseTime(s);
    if (d) out.push({ group: 'quick', always: true, rank: 9, icon: 'timer', label: `${s} → ${d.toLocaleString(locale(), { dateStyle: 'medium', timeStyle: 'short' })}`, hint: relative(d), run: () => openTool('time', s) });
  }
  // Colour
  if (/^#[0-9a-f]{3,8}$/i.test(s) || /^(rgb|hsl|hwb|lab|lch|oklab|oklch)a?\(/i.test(s)) {
    const c = parseColor(s);
    if (c) out.push({ group: 'quick', always: true, rank: 9, icon: 'color', label: `${toHex(c)} · ${toRgb(c)} · ${toOklch(c)}`, hint: t('tool_color'), run: () => openTool('color', s) });
  }
  // px / rem
  const m = s.match(/^(-?\d+(?:\.\d+)?)\s*(px|rem)$/i);
  if (m) {
    const v = parseFloat(m[1]);
    const ans = m[2].toLowerCase() === 'px' ? `${fmtNum(v / 16)}rem` : `${fmtNum(v * 16)}px`;
    out.push({ group: 'quick', always: true, rank: 9, icon: 'calc', label: `${s} = ${ans}`, hint: t('toolCopyHint'), run: () => copy(ans) });
  }
  // JWT
  if (looksLikeJwt(s)) {
    out.push({ group: 'quick', always: true, rank: 9, icon: 'key', label: t('toolDecodeJwt'), hint: 'JWT', run: () => openTool('encode', s) });
  }
  // JSON pasted
  if (/^[[{]/.test(s) && s.length > 2) {
    out.push({ group: 'quick', always: true, rank: 8, icon: 'code', label: t('toolFormatJson'), hint: 'JSON', run: () => openTool('json', s) });
  }
  return out;
}

export function initTools(toast) {
  toastFn = toast || toastFn;
  $('toolsClose').addEventListener('click', () => $('toolsDialog').close());
  $('toolsDialog').addEventListener('click', (e) => { if (e.target === $('toolsDialog')) $('toolsDialog').close(); });
  document.addEventListener('intent:lang', () => { if ($('toolsDialog').open) render(); });

  registerCommands((q) => [
    ...instant(q),
    { group: 'tools', icon: 'code', label: t('tool_json'), keywords: 'json format pretty minify validate', run: () => openTool('json') },
    { group: 'tools', icon: 'key', label: t('toolEncodeTitle'), keywords: 'base64 url encode decode jwt token', run: () => openTool('encode') },
    { group: 'tools', icon: 'timer', label: t('toolTimeTitle'), keywords: 'timestamp unix epoch date time iso', run: () => openTool('time') },
    { group: 'tools', icon: 'color', label: t('toolColorTitle'), keywords: 'color colour hex rgb hsl oklch contrast wcag', run: () => openTool('color') },
    { group: 'tools', icon: 'key', label: t('toolUuid'), hint: t('toolCopyHint'), keywords: 'uuid guid id generate random', run: () => copy(crypto.randomUUID()) },
    { group: 'tools', icon: 'key', label: t('toolPasswordCopy'), hint: t('toolCopyHint'), keywords: 'password generate random secure', run: () => copy(password(20, { upper: true, digits: true, symbols: true }).value) },
    { group: 'tools', icon: 'code', label: t('toolRegexTitle'), keywords: 'regex regexp regular expression test match', run: () => openTool('regex') },
    { group: 'tools', icon: 'calc', label: t('toolUnitsTitle'), keywords: 'px rem bytes kb mb units convert timezone time zone', run: () => openTool('units') },
  ]);
}
