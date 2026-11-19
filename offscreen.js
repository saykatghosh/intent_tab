// Ambient focus sounds, generated live with Web Audio (no audio files).
//   rain  – pink noise, softened, with a gentle shimmer
//   ocean – brown noise that swells and falls like waves
//   fan   – steady low brown noise
// The service worker sends { target: 'offscreen', type: 'play' | 'stop', kind, volume }.

let ctx = null;
let master = null;
let nodes = [];
let current = 'off';

function noiseBuffer(kind) {
  const len = ctx.sampleRate * 4;
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const out = buf.getChannelData(ch);
    if (kind === 'pink') {
      // Paul Kellet's refined pink-noise filter
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759;
        b2 = 0.96900 * b2 + w * 0.1538520; b3 = 0.86650 * b3 + w * 0.3104856;
        b4 = 0.55000 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.0168980;
        out[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
        b6 = w * 0.115926;
      }
    } else {
      // brown noise
      let last = 0;
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1;
        last = (last + 0.02 * w) / 1.02;
        out[i] = last * 3.5;
      }
    }
  }
  return buf;
}

function source(kind) {
  const s = ctx.createBufferSource();
  s.buffer = noiseBuffer(kind);
  s.loop = true;
  return s;
}

function build(kind) {
  const out = ctx.createGain();
  out.connect(master);
  const made = [out];

  if (kind === 'rain') {
    const s = source('pink');
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 500;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 7000;
    const g = ctx.createGain(); g.gain.value = 0.9;
    s.connect(hp).connect(lp).connect(g).connect(out);
    // slow shimmer on the brightness
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.13;
    const depth = ctx.createGain(); depth.gain.value = 900;
    lfo.connect(depth).connect(lp.frequency);
    s.start(); lfo.start();
    made.push(s, hp, lp, g, lfo, depth);
  } else if (kind === 'ocean') {
    const s = source('brown');
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1200;
    const swell = ctx.createGain(); swell.gain.value = 0.55;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.09; // ~11 s per wave
    const depth = ctx.createGain(); depth.gain.value = 0.42;
    lfo.connect(depth).connect(swell.gain);
    s.connect(lp).connect(swell).connect(out);
    s.start(); lfo.start();
    made.push(s, lp, swell, lfo, depth);
  } else if (kind === 'fan') {
    const s = source('brown');
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 520;
    const g = ctx.createGain(); g.gain.value = 1.1;
    s.connect(lp).connect(g).connect(out);
    s.start();
    made.push(s, lp, g);
  }
  return made;
}

function fadeTo(value, seconds) {
  const now = ctx.currentTime;
  master.gain.cancelScheduledValues(now);
  master.gain.setValueAtTime(master.gain.value, now);
  master.gain.linearRampToValueAtTime(value, now + seconds);
}

function stopNodes(list) {
  list.forEach((n) => {
    try { if (n.stop) n.stop(); } catch { /* already stopped */ }
    try { n.disconnect(); } catch { /* ignore */ }
  });
}

async function play(kind, volume) {
  if (!ctx) {
    ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') await ctx.resume();
  const level = Math.max(0, Math.min(1, volume ?? 0.5)) * 0.6;
  if (kind === current) { fadeTo(level, 0.6); return; }

  // Cross-fade: fade out, swap, fade in.
  const old = nodes;
  fadeTo(0, 0.8);
  setTimeout(() => {
    stopNodes(old);
    nodes = build(kind);
    current = kind;
    fadeTo(level, 1.6);
  }, old.length ? 850 : 0);
}

function stop() {
  if (!ctx) return;
  fadeTo(0, 1.2);
  const old = nodes;
  nodes = [];
  current = 'off';
  setTimeout(() => stopNodes(old), 1300);
}

chrome.runtime.onMessage.addListener((msg) => {
  if (!msg || msg.target !== 'offscreen') return;
  if (msg.type === 'play') play(msg.kind, msg.volume);
  if (msg.type === 'stop') stop();
});
