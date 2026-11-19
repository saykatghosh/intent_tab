// Serves the extension folder over http with a fake chrome.* API injected,
// so the real newtab.html / blocked.html can be screenshotted headlessly.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(process.argv[2]);
const PORT = Number(process.argv[3] || 8765);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };

const COLORS = ['#24292f', '#ea4335', '#ff0000', '#a259ff', '#5e6ad2', '#111111', '#f48024', '#10a37f', '#0a66c2', '#1d9bf0', '#e44d26', '#00a4ef'];
function faviconSvg(pageUrl) {
  let host = 'x';
  try { host = new URL(pageUrl).hostname.replace(/^www\./, ''); } catch { /* ignore */ }
  let h = 0;
  for (const c of host) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const bg = COLORS[h % COLORS.length];
  const letter = host[0].toUpperCase();
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="${bg}"/><text x="16" y="22" text-anchor="middle" font-family="Segoe UI,Arial" font-weight="700" font-size="17" fill="#fff">${letter}</text></svg>`;
}

http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  if (url.pathname.startsWith('/_favicon')) {
    res.writeHead(200, { 'content-type': 'image/svg+xml' });
    return res.end(faviconSvg(url.searchParams.get('pageUrl') || ''));
  }
  if (url.pathname === '/__shim.js') {
    const manifest = fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8');
    const shim = fs.readFileSync(path.join(HERE, 'shim.js'), 'utf8').replace('__MANIFEST__', manifest);
    res.writeHead(200, { 'content-type': 'text/javascript' });
    return res.end(shim);
  }
  const file = path.join(ROOT, decodeURIComponent(url.pathname));
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
  let body = fs.readFileSync(file);
  const ext = path.extname(file);
  if (ext === '.html') body = body.toString().replace('<head>', '<head><script src="/__shim.js"></script>');
  res.writeHead(200, { 'content-type': TYPES[ext] || 'application/octet-stream' });
  res.end(body);
}).listen(PORT, () => console.log('listening ' + PORT));

