// On-device AI through Chrome's built-in Prompt API (Gemini Nano).
// Runs locally: no API key, no server, nothing leaves the computer.
// When the model isn't available, callers fall back to simple rules.
//
// Status values: 'available' | 'downloadable' | 'downloading' | 'unavailable' | 'off'

const SYSTEM_PROMPT =
  'You are the quiet assistant inside "Intent Tab", a calm browser new-tab page that helps people ' +
  'open tabs on purpose. Be brief, warm, practical and neutral. Never judge, guilt or lecture. ' +
  'Reply in plain English.';

const MODEL_OPTIONS = {
  expectedInputs: [{ type: 'text', languages: ['en'] }],
  expectedOutputs: [{ type: 'text', languages: ['en'] }],
};

let enabled = true;
let status = 'unavailable';
let base = null;       // a ready session with the system prompt; cloned per request
let creating = null;
let pollTimer = 0;
const listeners = new Set();

function api() {
  return self.LanguageModel || null;
}

function emit() {
  listeners.forEach((fn) => fn(currentStatus()));
}

export function currentStatus() {
  return enabled ? status : 'off';
}

export function onAIStatus(fn) {
  listeners.add(fn);
}

export function aiReady() {
  return enabled && status === 'available';
}

export function setAIEnabled(on) {
  enabled = !!on;
  emit();
}

// Never let the page wait long for this: Chrome can take a while to answer.
// After `timeout` ms we carry on; the status updates (and listeners fire) when Chrome replies.
export async function refreshStatus({ timeout = 800 } = {}) {
  const LM = api();
  if (!LM) {
    status = 'unavailable';
    emit();
    return status;
  }
  const check = (async () => {
    try { return await LM.availability(MODEL_OPTIONS); } catch { /* try without options */ }
    try { return await LM.availability(); } catch { return 'unavailable'; }
  })().then((s) => {
    status = s;
    // While Chrome downloads the model, check back now and then.
    clearTimeout(pollTimer);
    if (status === 'downloading') pollTimer = setTimeout(() => refreshStatus(), 20000);
    emit();
    return s;
  });
  const res = await Promise.race([check, new Promise((r) => setTimeout(() => r(null), timeout))]);
  return res || status;
}

function withTimeout(promise, ms, ctrl) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => { ctrl?.abort(); reject(new Error('AI timed out')); }, ms);
    }),
  ]).finally(() => clearTimeout(timer));
}

function getBase(onProgress) {
  if (base) return Promise.resolve(base);
  if (creating) return creating;
  creating = api()
    .create({
      ...MODEL_OPTIONS,
      initialPrompts: [{ role: 'system', content: SYSTEM_PROMPT }],
      monitor(m) {
        m.addEventListener('downloadprogress', (e) => onProgress && onProgress(e.loaded));
      },
    })
    .then((s) => {
      base = s;
      creating = null;
      status = 'available';
      emit();
      return s;
    })
    .catch((err) => {
      creating = null;
      throw err;
    });
  return creating;
}

// Starts the one-time model download. Must be called from a click (user gesture).
export async function downloadModel(onProgress) {
  if (!api()) throw new Error('Prompt API not supported');
  status = 'downloading';
  emit();
  try {
    await getBase(onProgress);
  } catch (err) {
    await refreshStatus();
    throw err;
  }
}

async function freshSession(signal) {
  const b = await withTimeout(getBase(), 15000);
  return b.clone ? b.clone({ signal }) : b;
}

// Pull a JSON object out of a reply, even if the model wrapped it in text.
function parseJSON(text) {
  try { return JSON.parse(text); } catch { /* fall through */ }
  const m = String(text).match(/\{[\s\S]*\}/);
  if (m) return JSON.parse(m[0]);
  throw new Error('No JSON in reply');
}

// One-shot prompt. With `schema`, returns parsed JSON (structured output).
export async function askAI(prompt, { schema, signal, timeout = 20000 } = {}) {
  if (!aiReady()) throw new Error('AI not ready');
  const ctrl = new AbortController();
  signal?.addEventListener('abort', () => ctrl.abort());
  let s = null;
  const run = (async () => {
    s = await freshSession(ctrl.signal);
    const opts = { signal: ctrl.signal };
    if (schema) Object.assign(opts, { responseConstraint: schema, omitResponseConstraintInput: true });
    const out = await s.prompt(prompt, opts);
    return schema ? parseJSON(out) : String(out).trim();
  })();
  try {
    return await withTimeout(run, timeout, ctrl);
  } finally {
    if (s && s !== base) s.destroy?.();
  }
}

// Streaming prompt: yields the full text so far after each chunk.
export async function* streamAI(prompt, { signal } = {}) {
  if (!aiReady()) throw new Error('AI not ready');
  const s = await freshSession(signal);
  try {
    let text = '';
    for await (const chunk of s.promptStreaming(prompt, { signal })) {
      // Newer Chrome sends pieces; older versions sent the whole text so far.
      text = chunk.startsWith(text) && text ? chunk : text + chunk;
      yield text;
    }
  } finally {
    if (s !== base) s.destroy?.();
  }
}
