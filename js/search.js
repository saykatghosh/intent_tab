// Search engines for the search bar, Ask AI's "search instead" link and the palette.

import { t } from './strings.js';

export const ENGINES = {
  google: { name: 'Google', url: 'https://www.google.com/search', param: 'q' },
  bing: { name: 'Bing', url: 'https://www.bing.com/search', param: 'q' },
  duckduckgo: { name: 'DuckDuckGo', url: 'https://duckduckgo.com/', param: 'q' },
  brave: { name: 'Brave Search', url: 'https://search.brave.com/search', param: 'q' },
  youtube: { name: 'YouTube', url: 'https://www.youtube.com/results', param: 'search_query' },
  perplexity: { name: 'Perplexity', url: 'https://www.perplexity.ai/search', param: 'q' },
  chatgpt: { name: 'ChatGPT', url: 'https://chatgpt.com/', param: 'q' },
};

let current = 'google';

export function engine() {
  return ENGINES[current] || ENGINES.google;
}

export function searchUrl(q) {
  const e = engine();
  return `${e.url}?${e.param}=${encodeURIComponent(q)}`;
}

// ---------- Developer shortcuts ("bangs") ----------
// Type a keyword, a space and your query in the search bar or the palette:
//   mdn flexbox · npm react · gh vercel/next.js · so useEffect loop · can container queries
const enc = encodeURIComponent;
export const SHORTCUTS = [
  { key: 'mdn', name: 'MDN', url: (q) => `https://developer.mozilla.org/en-US/search?q=${enc(q)}` },
  { key: 'npm', name: 'npm', url: (q) => `https://www.npmjs.com/search?q=${enc(q)}` },
  // gh owner/repo → the repo; anything else → GitHub search
  { key: 'gh', name: 'GitHub', url: (q) => (/^[\w.-]+\/[\w.-]+$/.test(q) ? `https://github.com/${q}` : `https://github.com/search?q=${enc(q)}&type=repositories`) },
  { key: 'so', name: 'Stack Overflow', url: (q) => `https://stackoverflow.com/search?q=${enc(q)}` },
  { key: 'can', name: 'Can I use', url: (q) => `https://caniuse.com/?search=${enc(q)}` },
  { key: 'dd', name: 'DevDocs', url: (q) => `https://devdocs.io/#q=${enc(q)}` },
  { key: 'pypi', name: 'PyPI', url: (q) => `https://pypi.org/search/?q=${enc(q)}` },
  { key: 'crates', name: 'crates.io', url: (q) => `https://crates.io/search?q=${enc(q)}` },
  { key: 'bundle', name: 'Bundlephobia', url: (q) => `https://bundlephobia.com/package/${enc(q)}` },
  { key: 'tw', name: 'Tailwind CSS', url: (q) => `https://tailwindcss.com/docs?q=${enc(q)}` },
  { key: 'yt', name: 'YouTube', url: (q) => `https://www.youtube.com/results?search_query=${enc(q)}` },
  { key: 'w', name: 'Wikipedia', url: (q) => `https://en.wikipedia.org/w/index.php?search=${enc(q)}` },
];

// "npm react" → { shortcut, query, url } or null
export function parseShortcut(text) {
  const m = String(text || '').match(/^\s*([a-z]+)\s+(.+?)\s*$/i);
  if (!m) return null;
  const s = SHORTCUTS.find((x) => x.key === m[1].toLowerCase());
  return s ? { shortcut: s, query: m[2], url: s.url(m[2]) } : null;
}

// Search bar: follow a shortcut instead of the normal search, and show a hint pill while typing.
export function bindShortcuts() {
  const form = document.getElementById('searchForm');
  const input = document.getElementById('searchInput');
  const hint = document.getElementById('searchShortcut');
  form.addEventListener('submit', (e) => {
    const hit = parseShortcut(input.value);
    if (!hit) return;
    e.preventDefault();
    location.href = hit.url;
  });
  input.addEventListener('input', () => {
    const hit = parseShortcut(input.value);
    hint.hidden = !hit;
    if (hit) hint.textContent = t('shortcutHint', { name: hit.shortcut.name });
  });
}

// Point the search form at the chosen engine.
export function setEngine(id) {
  current = ENGINES[id] ? id : 'google';
  const e = engine();
  const form = document.getElementById('searchForm');
  const input = document.getElementById('searchInput');
  if (!form || !input) return;
  form.action = e.url;
  input.name = e.param;
  input.placeholder = t('searchWith', { name: e.name });
  const link = document.getElementById('aiAnswerGoogle');
  if (link) link.textContent = t('askSearchWith', { name: e.name });
}
