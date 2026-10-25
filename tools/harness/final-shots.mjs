import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
const here = path.dirname(new URL(import.meta.url).pathname);
const root = path.join(here, 'out', 'after');
const out = path.join(here, 'shots', 'final');
await (await import('node:fs/promises')).mkdir(out, { recursive: true });
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const server = http.createServer(async (req, res) => { const url = new URL(req.url, 'http://localhost'); try { const file = path.join(root, url.pathname === '/' ? 'index.html' : url.pathname); const body = await readFile(file); res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' }); res.end(body); } catch { res.writeHead(404); res.end(); } });
await new Promise((r) => server.listen(0, r));
const base = `http://localhost:${server.address().port}`;
const browser = await chromium.launch();
const nav = (label) => `.nav button:has(.nav-label:text-is("${label}"))`;
const cases = [
  ['v6-today', { width: 1440, height: 1000 }, {}, []],
  ['v6-today-phone', { width: 390, height: 844 }, {}, []],
  ['v6-today-night', { width: 1440, height: 1000 }, { theme: 'dark', accent: 'glacier' }, []],
  ['v6-make-it-yours', { width: 1440, height: 900 }, {}, ['.me']],
  ['v6-plan', { width: 1440, height: 1000 }, {}, [nav('Plan')]],
  ['v6-focus', { width: 1440, height: 900 }, {}, ['.play', 2200]],
  ['v6-lesson', { width: 1440, height: 1000 }, {}, ['.hero-lesson']],
  ['v6-practice', { width: 1440, height: 900 }, {}, [nav('Practice')]],
  ['v6-progress', { width: 1440, height: 1000 }, {}, [nav('Progress')]],
];
for (const [name, viewport, prefs, steps] of cases) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  await context.addInitScript((p) => { localStorage.setItem('tricert.ui.v3', JSON.stringify(p)); }, prefs);
  const page = await context.newPage();
  await page.goto(`${base}/?state=midway`);
  await page.waitForSelector('main.stage');
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);
  for (const step of steps) { if (typeof step === 'number') await page.waitForTimeout(step); else { await page.click(step); await page.waitForTimeout(500); } }
  await page.mouse.move(1, 1);
  await page.screenshot({ path: path.join(out, `${name}.png`) });
  console.log(name);
  await context.close();
}
await browser.close(); server.close();
