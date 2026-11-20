// Builds the two promo-tile HTML pages (rendered to PNG with headless Chrome).
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.argv[2];
const OUT = process.argv[3];
const rootUrl = 'file:///' + ROOT.replace(/\\/g, '/');

const logo = fs.readFileSync(path.join(ROOT, 'docs/assets/robot.svg'), 'utf8').replace(/<!--[\s\S]*?-->/g, '');
const robotSrc = fs.readFileSync(path.join(ROOT, 'js/robot.js'), 'utf8');
const robot = robotSrc.match(/const ROBOT_SVG = `([\s\S]*?)`;/)[1].replace(/<!--[\s\S]*?-->/g, '');
const sized = (svg, n) => svg.replace(/width="\d+" height="\d+">/, `width="${n}" height="${n}">`);

// deterministic star field
function stars(w, h, n, seed = 7) {
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  let out = '';
  for (let i = 0; i < n; i++) {
    const big = rnd() < 0.08;
    const r = big ? 1.2 + rnd() * 1.1 : 0.4 + rnd() * 0.8;
    out += `<circle cx="${(rnd() * w).toFixed(1)}" cy="${(rnd() * h).toFixed(1)}" r="${r.toFixed(2)}" fill="#fff" opacity="${(0.35 + rnd() * 0.6).toFixed(2)}"/>`;
  }
  return `<svg class="stars" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${out}</svg>`;
}

const css = `
@font-face{font-family:"Instrument Serif";src:url("${rootUrl}/fonts/instrument-serif.woff2") format("woff2")}
@font-face{font-family:"Instrument Serif";font-style:italic;src:url("${rootUrl}/fonts/instrument-serif-italic.woff2") format("woff2")}
@font-face{font-family:Inter;src:url("${rootUrl}/fonts/inter-latin.woff2") format("woff2")}
*{box-sizing:border-box}
html,body{margin:0}
body{font-family:Inter,sans-serif;color:#f4f2ff;-webkit-font-smoothing:antialiased}
.tile{position:relative;overflow:hidden;
  background:
    radial-gradient(ellipse at 12% 0%, rgba(138,123,255,.55), transparent 55%),
    radial-gradient(ellipse at 100% 100%, rgba(47,217,180,.42), transparent 55%),
    radial-gradient(ellipse at 70% 10%, rgba(255,154,213,.16), transparent 45%),
    linear-gradient(160deg,#1b1a4f 0%,#0e0c2b 55%,#070617 100%);}
.stars{position:absolute;inset:0}
.serif{font-family:"Instrument Serif",serif;font-weight:400;letter-spacing:-.01em;line-height:1}
.grad{font-style:italic;background:linear-gradient(90deg,#a99cff,#2fd9b4);-webkit-background-clip:text;background-clip:text;color:transparent;padding-right:.08em}
.chip{display:inline-flex;align-items:center;gap:8px;padding:8px 15px;border-radius:999px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.14);font-size:15px;font-weight:500;color:#dcd9f5;white-space:nowrap}
.chip i{width:7px;height:7px;border-radius:50%;background:#5ff2d2;box-shadow:0 0 10px #5ff2d2}
/* robot */
.tabi-eye,.tabi-bulb,.tabi-heart{fill:#5ff2d2}
.tabi-mouth{stroke:#5ff2d2}
.tabi-happy{opacity:0}
.tabi-arm{transform-box:view-box;transform-origin:104px 96px;transform:rotate(-12deg)}
.tabi-eyes{filter:drop-shadow(0 0 4px #5ff2d2)}
.tabi-pupil{transform:translate(1.5px,1px)}
.tabi-head{transform-box:view-box;transform-origin:70px 92px;transform:rotate(-4deg)}
`;

// ---------- Marquee 1400 x 560 ----------
const todo = (text, cls = '') => `<li class="${cls}"><span class="box"></span>${text}</li>`;
const marquee = `<!doctype html><html><head><meta charset="utf-8"><style>${css}
.tile{width:1400px;height:560px}
.left{position:absolute;left:90px;top:0;bottom:0;width:820px;display:flex;flex-direction:column;justify-content:center}
.brand{display:flex;align-items:center;gap:16px;margin-bottom:34px}
.brand span{font-family:"Instrument Serif";font-size:40px}
.brand span em{font-style:italic;color:#a8f5e2}
h1{font-size:84px;margin:0 0 18px;white-space:nowrap}
.sub{font-size:23px;color:#c3c0e6;margin:0 0 32px}
.chips{display:flex;flex-wrap:nowrap;gap:9px}
/* product vignette */
.scene{position:absolute;right:80px;top:0;bottom:0;width:400px}
.card{position:absolute;left:0;right:0;top:216px;padding:24px 24px 20px;border-radius:26px;
  background:#17153d;z-index:1;border:1px solid rgba(255,255,255,.14);
  box-shadow:inset 0 1px 0 rgba(255,255,255,.12),0 40px 80px -30px rgba(0,0,0,.7)}
.card h3{margin:0 0 6px;font-size:17px;font-weight:600;display:flex;align-items:center;gap:10px}
.card h3 b{width:26px;height:26px;border-radius:9px;background:rgba(127,214,189,.18);display:grid;place-items:center;color:#7fd6bd;font-size:14px}
.prog{height:7px;border-radius:9px;background:rgba(255,255,255,.12);margin:14px 0 8px;overflow:hidden}
.prog i{display:block;width:66%;height:100%;border-radius:inherit;background:linear-gradient(90deg,#2fd9b4,#7e6eff)}
.meta{font-size:13px;color:#9a97c2;margin-bottom:12px}
ul{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:6px}
li{display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:13px;font-size:15.5px;color:#e8e6ff}
li .box{width:19px;height:19px;border-radius:50%;border:1.6px solid rgba(255,255,255,.35);flex:none}
li.done{color:#8c89b5;text-decoration:line-through}
li.done .box{background:#2fd9b4;border-color:#2fd9b4}
li.pick{background:rgba(127,214,189,.14);box-shadow:inset 0 0 0 1.5px #5ff2d2,0 0 24px -6px #5ff2d2}
.robot{position:absolute;left:220px;top:110px;width:140px;height:150px}
.hands{z-index:2;position:absolute;left:232px;top:203px;width:120px;height:26px;display:flex;justify-content:space-between;padding:0 18px}
.hands i{width:26px;height:20px;border-radius:10px;background:linear-gradient(#f7f9ff,#d4dbef);border:1.4px solid #aab5d4}
.bubble{position:absolute;left:-30px;top:72px;padding:12px 16px;border-radius:18px 18px 6px 18px;max-width:270px;
  background:#f4f2ff;color:#1a1745;font-size:15px;line-height:1.4;box-shadow:0 18px 40px -16px rgba(0,0,0,.6)}
.bubble small{display:flex;align-items:center;gap:6px;font-size:10.5px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#3b30c9;margin-bottom:3px}
.bubble small::before{content:"";width:6px;height:6px;border-radius:50%;background:#2fd9b4}
</style></head><body><div class="tile">
${stars(1400, 560, 150)}
<div class="left">
  <div class="brand">${sized(logo, 64)}<span>Intent <em>Tab</em></span></div>
  <h1 class="serif">Open tabs <span class="grad">on purpose.</span></h1>
  <p class="sub">A calm new tab that asks why you’re here.</p>
  <div class="chips">
    <span class="chip"><i></i>Intent + focus timer</span>
    <span class="chip"><i></i>Projects &amp; tasks</span>
    <span class="chip"><i></i>Ctrl K palette</span>
    <span class="chip"><i></i>On-device AI</span>
    <span class="chip"><i></i>Focus mode</span>
  </div>
</div>
<div class="scene">
  <div class="robot">${robot}</div>
  <div class="card">
    <h3><b>✓</b>To-do</h3>
    <div class="prog"><i></i></div>
    <div class="meta">2 of 3 done · 66%</div>
    <ul>
      ${todo('Write the release notes', 'done')}
      ${todo('Ship the landing page', 'pick')}
      ${todo('Reply to design feedback', 'done')}
    </ul>
  </div>
  <div class="hands"><i></i><i></i></div>
  <div class="bubble"><small>Intent</small>Let’s do this one 👉 Ship the landing page</div>
</div>
</div></body></html>`;

// ---------- Small 440 x 280 ----------
const small = `<!doctype html><html><head><meta charset="utf-8"><style>${css}
.tile{width:440px;height:280px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}
.logo{filter:drop-shadow(0 14px 26px rgba(43,35,144,.6));margin-bottom:16px}
.name{font-size:46px;margin:0 0 8px}
.name em{font-style:italic;background:linear-gradient(90deg,#a99cff,#2fd9b4);-webkit-background-clip:text;background-clip:text;color:transparent;padding-right:.06em}
.tag{font-size:16px;color:#c3c0e6;margin:0}
</style></head><body><div class="tile">
${stars(440, 280, 45, 3)}
<div class="logo" style="position:relative">${sized(logo, 92)}</div>
<h1 class="serif name" style="position:relative">Intent <em>Tab</em></h1>
<p class="tag" style="position:relative">Open tabs on purpose.</p>
</div></body></html>`;

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'marquee.html'), marquee);
fs.writeFileSync(path.join(OUT, 'small.html'), small);
console.log('written');
