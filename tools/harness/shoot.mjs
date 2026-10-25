// Usage: node shoot.mjs <name> [viewsCsv]
// Serves out/<name> and screenshots each view at desktop and phone widths into shots/<name>/.
import http from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const [name, viewsCsv] = process.argv.slice(2);
const here = path.dirname(new URL(import.meta.url).pathname);
const root = path.join(here, 'out', name);
const shots = path.join(here, 'shots', name);
await mkdir(shots, { recursive: true });

const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.csv': 'text/csv', '.md': 'text/markdown', '.sql': 'text/plain', '.woff2': 'font/woff2' };
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  let file = path.join(root, url.pathname === '/' ? 'index.html' : url.pathname);
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end('not found');
  }
});
await new Promise((resolve) => server.listen(0, resolve));
const port = server.address().port;

// Each view: how to reach it from a freshly loaded page.
const views = {
  onboarding: { state: 'fresh', steps: [] },
  home: { steps: [] },
  plan: { steps: [['nav', 'Plan']] },
  projects: { steps: [['nav', 'Project']] },
  document: { steps: [['nav', 'Project'], ['click', '.doc-list li >> nth=1 >> button']] },
  practice: { steps: [['nav', 'Practice']] },
  'practice-run': { steps: [['nav', 'Practice'], ['click', '.tile-scenarios']] },
  'practice-answered': { steps: [['nav', 'Practice'], ['click', '.tile-scenarios'], ['click', '.answer >> nth=1'], ['click', 'button:has-text("Check")'], ['wait', 600]] },
  'practice-wrong': { steps: [['nav', 'Practice'], ['click', '.tile-scenarios'], ['click', '.answer >> nth=0'], ['click', 'button:has-text("Check")'], ['wait', 600]] },
  flashcards: { steps: [['nav', 'Practice'], ['click', '.tile-cards']] },
  labs: { steps: [['nav', 'Practice'], ['click', '.tile-labs']] },
  review: { steps: [['nav', 'Practice'], ['click', '.tile-review']] },
  progress: { steps: [['nav', 'Progress']] },
  portfolio: { steps: [['nav', 'Progress'], ['click', '.segmented button:has-text("Portfolio")']] },
  focus: { steps: [['click', '.play'], ['wait', 2200]] },
  learn: { steps: [['nav', 'Learn']] },
  'lesson-w1': { steps: [['nav', 'Learn'], ['click', '.lw-fold >> nth=0 >> summary'], ['click', '.lw-fold >> nth=0 >> li button >> nth=0'], ['click', '.self-check details >> nth=0 >> summary'], ['click', '.finished >> nth=0 >> summary']] },
  lesson: { steps: [['nav', 'Learn'], ['click', '.lesson-week[open] li button >> nth=2']] },
  'learn-exams': { steps: [['nav', 'Learn'], ['click', '.segmented button:has-text("Exams")']] },
  'learn-exam': { steps: [['nav', 'Learn'], ['click', '.segmented button:has-text("Exams")'], ['click', '.exam-card >> nth=2'], ['click', '.area summary >> nth=0']] },
  'learn-docs': { steps: [['nav', 'Learn'], ['click', '.segmented button:has-text("Documents")']] },
  'learn-doc': { steps: [['nav', 'Learn'], ['click', '.segmented button:has-text("Documents")'], ['click', '.lesson-week[open] li button >> nth=1']] },
  glossary: { steps: [['nav', 'Learn'], ['click', '.segmented button:has-text("Glossary")']] },
  'lesson-today': { steps: [['click', '.hero-lesson']] },
  'focus-read': { steps: [['click', '.play'], ['wait', 800], ['click', '.focus-lesson']] },
  celebrate: { steps: [['click', '.play'], ['wait', 1200], ['click', 'button:has-text("Finish session")'], ['wait', 1600]] },
};
const wanted = viewsCsv ? viewsCsv.split(',') : Object.keys(views);
const viewports = [
  ['desktop', { width: 1440, height: 900 }],
  ['phone', { width: 390, height: 844 }],
];

const browser = await chromium.launch();
for (const [label, viewport] of viewports) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  for (const key of wanted) {
    const view = views[key];
    if (!view) continue;
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
    await page.goto(`http://localhost:${port}/?state=${view.state || 'midway'}`);
    await page.waitForSelector('main', { timeout: 10000 });
    await page.waitForTimeout(400);
    for (const [action, target] of view.steps) {
      if (action === 'nav') await page.click(`.nav button:has(.nav-label:text-is("${target}"))`);
      if (action === 'click') await page.click(target);
      if (action === 'wait') await page.waitForTimeout(target);
      await page.waitForTimeout(250);
    }
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(shots, `${key}-${label}.png`), fullPage: !['focus','focus-read','celebrate','practice-answered','practice-wrong','practice-run'].includes(key) });
    const height = await page.evaluate(() => document.documentElement.scrollHeight);
    console.log(`${name}/${key}-${label}: ${viewport.width}x${height}${errors.length ? ` ERRORS: ${errors.join(' | ')}` : ''}`);
    await page.close();
  }
  await context.close();
}
await browser.close();
server.close();
