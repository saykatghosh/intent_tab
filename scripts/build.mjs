#!/usr/bin/env node
// Intent Tab build script — no dependencies, just Node 18+.
//
//   node scripts/build.mjs check            validate manifest, JS syntax, imports, element ids, strings
//   node scripts/build.mjs bump [patch|minor|major]   raise the version in manifest.json (+ package.json)
//   node scripts/build.mjs                  check, then write dist/intent-tab-v<version>.zip
//   node scripts/build.mjs release [patch|minor|major] bump + check + zip in one go
//
// The ZIP contains only what Chrome needs (no store/, scripts/, .git, README, …).

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const EXCLUDE = new Set(['.git', '.github', '.vscode', 'dist', 'node_modules', 'scripts', 'store', 'package.json', 'package-lock.json', '.gitignore', '.gitattributes', 'README.md', 'CHANGELOG.md']);
// Element ids created at runtime, and string keys built from a prefix (e.g. 'sound_' + kind).
const DYNAMIC_IDS = new Set(['focusInput', 'cardDropLine']);
const KEY_PREFIXES = ['sound_', 'accent_', 'tool_'];

const c = { red: (s) => `\x1b[31m${s}\x1b[0m`, green: (s) => `\x1b[32m${s}\x1b[0m`, dim: (s) => `\x1b[2m${s}\x1b[0m`, bold: (s) => `\x1b[1m${s}\x1b[0m` };
const rel = (p) => path.relative(ROOT, p).split(path.sep).join('/');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    if (dir === ROOT && EXCLUDE.has(name)) continue;
    if (name.endsWith('.zip') || name === '.DS_Store' || name === 'Thumbs.db') continue;
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

// =========================================================
// check
// =========================================================
function check() {
  const problems = [];
  const fail = (msg) => problems.push(msg);

  // 1. manifest
  let manifest;
  try { manifest = JSON.parse(read('manifest.json')); } catch (e) { fail(`manifest.json is not valid JSON: ${e.message}`); return report(problems); }
  if (manifest.manifest_version !== 3) fail('manifest_version must be 3');
  if (!/^\d+(\.\d+){0,3}$/.test(manifest.version || '')) fail(`bad version "${manifest.version}"`);
  if ((manifest.description || '').length > 132) fail(`description is ${manifest.description.length} chars (max 132)`);
  const referenced = [
    manifest.chrome_url_overrides?.newtab,
    manifest.background?.service_worker,
    ...Object.values(manifest.icons || {}),
    ...(manifest.web_accessible_resources || []).flatMap((w) => w.resources).filter((r) => !r.includes('*')),
    'offscreen.html',
  ].filter(Boolean);
  for (const f of referenced) if (!fs.existsSync(path.join(ROOT, f))) fail(`manifest points to missing file: ${f}`);

  // 2. JS syntax (package.json "type": "module" makes node treat .js as ES modules)
  const jsFiles = walk(ROOT).filter((f) => f.endsWith('.js'));
  for (const f of jsFiles) {
    const r = spawnSync(process.execPath, ['--check', f], { encoding: 'utf8' });
    if (r.status !== 0) fail(`syntax error in ${rel(f)}:\n${(r.stderr || '').split('\n').slice(0, 5).join('\n')}`);
  }

  // 3. named imports resolve to real exports
  for (const f of jsFiles) {
    const src = fs.readFileSync(f, 'utf8');
    for (const m of src.matchAll(/import\s*\{([^}]*)\}\s*from\s*'([^']+)'/g)) {
      const target = path.join(path.dirname(f), m[2]);
      if (!fs.existsSync(target)) { fail(`${rel(f)} imports missing file ${m[2]}`); continue; }
      const tsrc = fs.readFileSync(target, 'utf8');
      for (const name of m[1].split(',').map((s) => s.trim().split(/\s+as\s+/)[0]).filter(Boolean)) {
        if (!new RegExp(`export\\s+(async\\s+)?(function\\*?|const|let|class)\\s+${name}\\b`).test(tsrc)) fail(`${rel(f)}: "${name}" is not exported by ${m[2]}`);
      }
    }
  }

  // 4. $('id') used by page scripts exists in newtab.html
  const html = read('newtab.html');
  const ids = new Set([...html.matchAll(/id="([^"]+)"/g)].map((m) => m[1]));
  for (const f of jsFiles.filter((f) => rel(f).startsWith('js/'))) {
    for (const m of fs.readFileSync(f, 'utf8').matchAll(/\$\('([A-Za-z0-9_-]+)'\)/g)) {
      if (!ids.has(m[1]) && !DYNAMIC_IDS.has(m[1])) fail(`${rel(f)}: #${m[1]} is not in newtab.html`);
    }
  }

  // 5. every string key used exists in both English and Bangla
  const strings = read('js/strings.js');
  const block = (from, to) => strings.slice(strings.indexOf(from), strings.indexOf(to));
  const keys = (b) => new Set([...b.matchAll(/^\s+([A-Za-z0-9_]+):/gm)].map((m) => m[1]));
  const en = keys(block('en: {', 'bn: {'));
  const bn = keys(block('bn: {', '// Locale used'));
  const used = new Set();
  for (const f of [...jsFiles, path.join(ROOT, 'newtab.html'), path.join(ROOT, 'blocked.html')]) {
    const src = fs.readFileSync(f, 'utf8');
    for (const m of src.matchAll(/\bt\('([A-Za-z0-9_]+)'/g)) used.add(m[1]);
    for (const m of src.matchAll(/data-i18n(?:-placeholder|-title|-aria)?="([A-Za-z0-9_]+)"/g)) used.add(m[1]);
  }
  for (const k of used) {
    if (KEY_PREFIXES.includes(k)) continue;
    if (!en.has(k)) fail(`string "${k}" is missing in English`);
    if (!bn.has(k)) fail(`string "${k}" is missing in Bangla`);
  }
  for (const k of en) if (!bn.has(k)) fail(`string "${k}" has no Bangla translation`);

  return report(problems, { files: jsFiles.length, strings: used.size, version: manifest.version });
}

function report(problems, info = {}) {
  if (problems.length) {
    console.log(c.red(c.bold(`✗ ${problems.length} problem${problems.length > 1 ? 's' : ''}`)));
    problems.forEach((p) => console.log(c.red('  • ') + p));
    process.exitCode = 1;
    return false;
  }
  console.log(c.green(c.bold('✓ check passed')) + c.dim(` — v${info.version}, ${info.files} JS files, ${info.strings} strings in en + bn`));
  return true;
}

// =========================================================
// bump
// =========================================================
function bump(kind = 'patch') {
  if (!['patch', 'minor', 'major'].includes(kind)) { console.log(c.red(`unknown bump "${kind}" (use patch, minor or major)`)); process.exit(1); }
  const file = path.join(ROOT, 'manifest.json');
  const text = fs.readFileSync(file, 'utf8');
  const old = JSON.parse(text).version;
  const [a, b = 0, d = 0] = old.split('.').map(Number);
  const next = kind === 'major' ? `${a + 1}.0.0` : kind === 'minor' ? `${a}.${b + 1}.0` : `${a}.${b}.${d + 1}`;
  // Replace only the version line, so the file keeps its formatting.
  fs.writeFileSync(file, text.replace(/("version"\s*:\s*")[^"]+(")/, `$1${next}$2`));
  const pkg = path.join(ROOT, 'package.json');
  if (fs.existsSync(pkg)) fs.writeFileSync(pkg, fs.readFileSync(pkg, 'utf8').replace(/("version"\s*:\s*")[^"]+(")/, `$1${next}$2`));
  console.log(`version ${c.dim(old)} → ${c.bold(next)}`);
  return next;
}

// =========================================================
// zip (minimal, no dependencies)
// =========================================================
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let v = n;
    for (let k = 0; k < 8; k++) v = v & 1 ? 0xedb88320 ^ (v >>> 1) : v >>> 1;
    t[n] = v >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
function dosTime(d) {
  return {
    time: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1),
    date: ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  };
}

function writeZip(outFile, files) {
  const parts = [];
  const central = [];
  let offset = 0;
  for (const f of files) {
    const name = Buffer.from(rel(f), 'utf8');
    const data = fs.readFileSync(f);
    const deflated = zlib.deflateRawSync(data, { level: 9 });
    const useDeflate = deflated.length < data.length;
    const body = useDeflate ? deflated : data;
    const crc = crc32(data);
    const { time, date } = dosTime(fs.statSync(f).mtime);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6); // UTF-8 names
    local.writeUInt16LE(useDeflate ? 8 : 0, 8);
    local.writeUInt16LE(time, 10);
    local.writeUInt16LE(date, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    parts.push(local, name, body);

    const cen = Buffer.alloc(46);
    cen.writeUInt32LE(0x02014b50, 0);
    cen.writeUInt16LE(20, 4);
    cen.writeUInt16LE(20, 6);
    cen.writeUInt16LE(0x0800, 8);
    cen.writeUInt16LE(useDeflate ? 8 : 0, 10);
    cen.writeUInt16LE(time, 12);
    cen.writeUInt16LE(date, 14);
    cen.writeUInt32LE(crc, 16);
    cen.writeUInt32LE(body.length, 20);
    cen.writeUInt32LE(data.length, 24);
    cen.writeUInt16LE(name.length, 28);
    cen.writeUInt32LE(offset, 42);
    central.push(cen, name);
    offset += local.length + name.length + body.length;
  }
  const cenSize = central.reduce((n, b) => n + b.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(cenSize, 12);
  end.writeUInt32LE(offset, 16);
  fs.writeFileSync(outFile, Buffer.concat([...parts, ...central, end]));
}

function build() {
  if (!check()) { console.log(c.red('build stopped — fix the problems above first')); return; }
  const version = JSON.parse(read('manifest.json')).version;
  fs.mkdirSync(DIST, { recursive: true });
  const out = path.join(DIST, `intent-tab-v${version}.zip`);
  const files = walk(ROOT).sort();
  writeZip(out, files);
  const kb = (fs.statSync(out).size / 1024).toFixed(1);
  console.log(c.green(c.bold('✓ built ')) + rel(out) + c.dim(` — ${files.length} files, ${kb} KB`));
  console.log(c.dim('  upload it at https://chrome.google.com/webstore/devconsole'));
}

// =========================================================
const [cmd, arg] = process.argv.slice(2);
if (cmd === 'check') check();
else if (cmd === 'bump') bump(arg);
else if (cmd === 'release') { bump(arg || 'patch'); build(); }
else if (!cmd || cmd === 'build') build();
else console.log('usage: node scripts/build.mjs [check | bump <patch|minor|major> | build | release <patch|minor|major>]');
