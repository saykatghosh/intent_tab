// Fake chrome.* for screenshots. Scene comes from ?scene=… in the URL.
(() => {
  const params = new URLSearchParams(location.search.split('&u=')[0]);
  const SCENE = location.pathname.includes('blocked') ? 'focus' : (params.get('scene') || 'question');

  // ---- fixed clock: today at 10:24 ----
  const RealDate = Date;
  const target = new RealDate(); target.setHours(10, 24, 0, 0);
  const OFF = target.getTime() - RealDate.now();
  class FakeDate extends RealDate {
    constructor(...a) { if (a.length) super(...a); else super(RealDate.now() + OFF); }
    static now() { return RealDate.now() + OFF; }
  }
  window.Date = FakeDate;
  const now = FakeDate.now();
  const pad = (n) => String(n).padStart(2, '0');
  const key = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const ago = (n) => { const d = new FakeDate(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - n); return d; };
  const MIN = 60000;

  const dark = SCENE !== 'question';
  try { localStorage.setItem('intent-theme', dark ? 'dark' : 'light'); } catch { /* ignore */ }

  // ---- sample data ----
  const days = {};
  const week = [[34, 22, 5, 4, 95], [41, 25, 6, 5, 120], [28, 20, 4, 4, 80], [46, 30, 7, 6, 140], [38, 27, 5, 5, 110], [22, 14, 3, 2, 50], [17, 12, 3, 3, 95]];
  week.forEach(([tabs, intentTabs, set, done, focusMin], i) => {
    days[key(ago(6 - i))] = { tabs, intentTabs, intentsSet: set, intentsDone: done, todoDone: 3, todoTotal: 5, focusMs: focusMin * MIN, focusSessions: Math.round(focusMin / 25) };
  });
  const todayKey = key(new FakeDate());
  const todos = [
    { id: 't1', text: 'Write the v1.4 release notes', done: true, createdAt: now - 300 * MIN, doneAt: now - 60 * MIN },
    { id: 't2', text: 'Ship the landing page', done: false, createdAt: now - 280 * MIN, doneAt: null },
    { id: 't3', text: 'Reply to design feedback', done: false, createdAt: now - 200 * MIN, doneAt: null },
    { id: 't4', text: 'Review the onboarding PR', done: true, createdAt: now - 190 * MIN, doneAt: now - 30 * MIN },
    { id: 't5', text: 'Plan next week’s sprint', done: false, createdAt: now - 100 * MIN, doneAt: null },
  ];
  const projects = [
    { id: 'p1', name: 'Intent Tab', links: [
      { label: 'Repo', url: 'https://github.com/you/intent-tab' },
      { label: 'Local', url: 'http://localhost:5173/' },
      { label: 'Design', url: 'https://www.figma.com/file/intent-tab' },
      { label: 'Tracker', url: 'https://linear.app/you/intent-tab' },
      { label: 'Store', url: 'https://chromewebstore.google.com/' },
    ], tasks: [
      { id: 'a', text: 'New logo and promo tiles', done: true },
      { id: 'b', text: 'Projects: tasks and progress', done: true },
      { id: 'c', text: 'Focus time in the quiet centre', done: true },
      { id: 'd', text: 'Fresh store screenshots', done: false },
      { id: 'e', text: 'Submit v1.4 to the Web Store', done: false },
    ] },
    { id: 'p2', name: 'Portfolio site', links: [
      { label: 'Repo', url: 'https://github.com/you/portfolio' },
      { label: 'Production', url: 'https://vercel.com/you/portfolio' },
    ], tasks: [
      { id: 'f', text: 'Case study: Intent Tab', done: false },
      { id: 'g', text: 'Dark mode', done: true },
    ] },
    { id: 'p3', name: 'Client: Bloom Café', links: [
      { label: 'Staging', url: 'https://staging.bloomcafe.com/' },
      { label: 'Design', url: 'https://www.figma.com/file/bloom' },
    ], tasks: [] },
  ];
  const settings = {
    theme: dark ? 'dark' : 'light', lang: 'en', background: SCENE === 'question' ? 'animated' : 'cosmos',
    askMode: SCENE === 'question' ? 'always' : 'off', ai: false, accent: 'sage',
    modules: { todo: true, notes: true, bookmarks: true, topSites: true, report: true, dev: true, robot: true },
  };
  const running = { text: 'Ship the landing page', startedAt: now - 9 * MIN, endsAt: now + 16 * MIN };
  const store = {
    settings, todos, days, projects,
    ui: { onboarded: true, bmTipDismissed: true, footerTipDismissed: true, worldV14: true },
    ask: {},
    focus: { day: todayKey, text: 'Ship Intent Tab 1.4', done: false },
    notes: { text: 'Release checklist:\n– bump version\n– new screenshots\n– zip + upload', updatedAt: now },
    history: [
      { text: 'Ship the landing page', at: now - 200 * MIN, done: true },
      { text: 'Check email', at: now - 120 * MIN, done: true },
      { text: 'Research icon styles', at: now - 80 * MIN, done: true },
    ],
    intent: SCENE === 'focus' ? running : null,
  };

  // ---- chrome.storage ----
  const listeners = [];
  const clone = (v) => (v === undefined ? v : JSON.parse(JSON.stringify(v)));
  const local = {
    async get(keys) {
      if (keys == null) return clone(store);
      const list = typeof keys === 'string' ? [keys] : Array.isArray(keys) ? keys : Object.keys(keys);
      const out = {};
      for (const k of list) if (k in store) out[k] = clone(store[k]);
      return out;
    },
    async set(obj) {
      const changes = {};
      for (const [k, v] of Object.entries(obj)) { changes[k] = { oldValue: clone(store[k]), newValue: clone(v) }; store[k] = clone(v); }
      setTimeout(() => listeners.forEach((fn) => fn(changes, 'local')), 0);
    },
    async remove(keys) { [].concat(keys).forEach((k) => delete store[k]); },
    async clear() {},
  };

  // ---- bookmarks ----
  const bm = (id, title, url) => ({ id, title, url, parentId: '1' });
  const tree = [{ id: '0', title: '', children: [
    { id: '1', title: 'Bookmarks bar', children: [
      { id: '10', title: 'Work', parentId: '1', children: [bm('11', 'Linear', 'https://linear.app/'), bm('12', 'Notion', 'https://www.notion.so/')] },
      bm('20', 'GitHub', 'https://github.com/'),
      bm('21', 'Figma', 'https://www.figma.com/'),
      bm('22', 'Gmail', 'https://mail.google.com/'),
      bm('23', 'MDN', 'https://developer.mozilla.org/'),
      bm('24', 'YouTube', 'https://www.youtube.com/'),
      { id: '30', title: 'Reading', parentId: '1', children: [bm('31', 'Smashing', 'https://www.smashingmagazine.com/')] },
    ] },
    { id: '2', title: 'Other bookmarks', children: [] },
  ] }];
  const find = (id, nodes = tree) => { for (const n of nodes) { if (n.id === id) return n; const f = n.children && find(id, n.children); if (f) return f; } return null; };

  const noop = async () => {};
  const evt = () => ({ addListener() {}, removeListener() {} });
  const granted = [];
  window.chrome = {
    storage: { local, sync: { get: async () => ({}), set: noop }, onChanged: { addListener: (fn) => listeners.push(fn), removeListener() {} } },
    bookmarks: {
      getTree: async () => clone(tree), getSubTree: async (id) => [clone(find(id))], get: async (id) => [clone(find(id))],
      search: async () => [], create: noop, update: noop, remove: noop, removeTree: noop, move: noop,
      onCreated: evt(), onRemoved: evt(), onChanged: evt(), onMoved: evt(), onChildrenReordered: evt(), onImportEnded: evt(),
    },
    topSites: { get: async () => [
      ['GitHub', 'https://github.com/'], ['Gmail', 'https://mail.google.com/'], ['YouTube', 'https://www.youtube.com/'],
      ['Figma', 'https://www.figma.com/'], ['Linear', 'https://linear.app/'], ['Stack Overflow', 'https://stackoverflow.com/'],
      ['ChatGPT', 'https://chatgpt.com/'], ['MDN', 'https://developer.mozilla.org/'],
    ].map(([title, url]) => ({ title, url })) },
    tabs: { query: async () => new Array(9).fill({}), create: noop, update: noop, getCurrent: async () => null, onCreated: evt(), onRemoved: evt() },
    windows: { create: noop },
    runtime: { getURL: (p) => location.origin + (p.startsWith('/') ? p : '/' + p), getManifest: () => (__MANIFEST__), id: 'intent-tab', onMessage: evt(), sendMessage: noop },
    permissions: { request: async (o) => { granted.push(...((o && o.origins) || [])); return true; }, remove: async () => true, contains: async () => true, getAll: async () => ({ origins: granted.slice() }), onAdded: evt(), onRemoved: evt() },
    alarms: { create: noop, clear: noop, onAlarm: evt() },
  };

  // Freeze entrance animations in their final state for clean screenshots.
  document.addEventListener('DOMContentLoaded', () => {
    const st = document.createElement('style');
    st.textContent = '*,*::before,*::after{animation:none!important;transition:none!important}';
    document.head.append(st);
  });

  // ---- scene actions (after the page has booted) ----
  const after = (ms, fn) => window.addEventListener('load', () => setTimeout(fn, ms));
  if (SCENE === 'palette') after(1600, async () => (await import('/js/palette.js')).openPalette('intent'));
  if (SCENE === 'project') after(1600, async () => (await import('/js/projects.js')).openProject('p1'));
})();
