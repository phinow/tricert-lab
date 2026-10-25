// Screenshots of personal themes and the Make it yours sheet.
import http from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
const here = path.dirname(new URL(import.meta.url).pathname);
const root = path.join(here, 'out', 'after');
const shots = path.join(here, 'shots', 'after');
await mkdir(shots, { recursive: true });
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  try { const file = path.join(root, url.pathname === '/' ? 'index.html' : url.pathname); const body = await readFile(file); res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' }); res.end(body); } catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(0, r));
const base = `http://localhost:${server.address().port}`;
const browser = await chromium.launch();
const cases = [
  ['dark-rose-desktop', { width: 1440, height: 900 }, { theme: 'dark', accent: 'rose' }, null],
  ['dark-glacier-phone', { width: 390, height: 844 }, { theme: 'dark', accent: 'glacier' }, null],
  ['canola-desktop', { width: 1440, height: 900 }, { theme: 'light', accent: 'canola' }, null],
  ['yours-desktop', { width: 1440, height: 900 }, {}, '.me'],
  ['yours-phone', { width: 390, height: 844 }, {}, '.avatar-button'],
  ['dark-lesson-desktop', { width: 1440, height: 900 }, { theme: 'dark', accent: 'beacon' }, '.hero-lesson'],
];
for (const [name, viewport, prefs, click] of cases) {
  const context = await browser.newContext({ viewport });
  await context.addInitScript((p) => { localStorage.setItem('tricert.ui.v3', JSON.stringify(p)); }, prefs);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${base}/?state=midway`);
  await page.waitForSelector('main.stage');
  await page.waitForTimeout(500);
  if (click) { await page.click(click); await page.waitForTimeout(700); }
  await page.mouse.move(0, 0);
  await page.screenshot({ path: path.join(shots, `${name}.png`) });
  console.log(name, errors.join(' | '));
  await context.close();
}
await browser.close();
server.close();
