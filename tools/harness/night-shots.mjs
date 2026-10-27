// Usage: node night-shots.mjs <outDir> [viewsCsv]
// Screenshots of the harness build (out/after) for design review:
// <view>-<desktop|phone>-<light|dark>.png, plus <view>-phone-light-full.png.
// Desktop is 1440x900 full page (focus mode, an overlay, is the viewport);
// phone is 390x844, viewport only.
import http from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const [outArg, viewsCsv] = process.argv.slice(2);
if (!outArg) throw new Error('usage: node night-shots.mjs <outDir> [viewsCsv]');
const here = path.dirname(new URL(import.meta.url).pathname);
const root = path.join(here, 'out', 'after');
const out = path.resolve(outArg);
await mkdir(out, { recursive: true });

const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.csv': 'text/csv', '.md': 'text/markdown', '.woff2': 'font/woff2' };
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  try {
    const file = path.join(root, url.pathname === '/' ? 'index.html' : url.pathname);
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((resolve) => server.listen(0, resolve));
const base = `http://localhost:${server.address().port}`;

const nav = (label) => ['click', `.nav button:has(.nav-label:text-is("${label}"))`];
const views = {
  today: [],
  plan: [nav('Plan')],
  learn: [nav('Learn')],
  lesson: [nav('Learn'), ['click', '.lesson-week[open] li button >> nth=2']],
  document: [nav('Learn'), ['click', '.segmented button:has-text("Documents")'], ['click', '.releases .release >> nth=0'], ['click', '.doc-list li >> nth=1 >> button']],
  practice: [nav('Practice')],
  quiz: [nav('Practice'), ['click', '.tile-scenarios'], ['click', '.answer >> nth=1'], ['click', '.quiz-foot .primary'], ['wait', 700]],
  progress: [nav('Progress')],
  focus: [['click', '.play'], ['wait', 2200]],
};
// Extra screens, only shot when named on the command line.
const extra = {
  documents: [nav('Learn'), ['click', '.segmented button:has-text("Documents")']],
  exams: [nav('Learn'), ['click', '.segmented button:has-text("Exams")']],
  exam: [nav('Learn'), ['click', '.segmented button:has-text("Exams")'], ['click', '.exam-card >> nth=2'], ['click', '.area summary >> nth=0']],
  glossary: [nav('Learn'), ['click', '.segmented button:has-text("Glossary")']],
  flashcards: [nav('Practice'), ['click', '.tile-cards'], ['click', '.flash-card']],
  labs: [nav('Practice'), ['click', '.tile-labs']],
  review: [nav('Practice'), ['click', '.tile-review']],
  wrong: [nav('Practice'), ['click', '.tile-scenarios'], ['click', '.answer >> nth=0'], ['click', '.quiz-foot .primary'], ['wait', 700]],
  portfolio: [nav('Progress'), ['click', '.segmented button:has-text("Portfolio")']],
  celebrate: [['click', '.play'], ['wait', 1200], ['click', 'button:has-text("Finish session")'], ['wait', 1400]],
  yours: [['click', '.me, .avatar-button >> visible=true'], ['wait', 400]],
  'focus-read': [['click', '.play'], ['wait', 800], ['click', '.focus-lesson']],
  onboarding: [],
};
Object.assign(views, extra);
const overlays = new Set(['focus', 'celebrate', 'yours', 'focus-read']);
const dark = new Set(['today', 'practice', 'progress', 'focus']);
const wanted = viewsCsv ? viewsCsv.split(',') : Object.keys(views).filter((key) => !(key in extra));

const browser = await chromium.launch();
async function shoot(view, device, theme, full) {
  const viewport = device === 'desktop' ? { width: 1440, height: 900 } : { width: 390, height: 844 };
  const context = await browser.newContext({ viewport, deviceScaleFactor: device === 'phone' ? 2 : 1 });
  await context.addInitScript((prefs) => { localStorage.setItem('tricert.ui.v3', JSON.stringify(prefs)); }, { theme, accent: 'beacon' });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto(`${base}/?state=${view === 'onboarding' ? 'fresh' : 'midway'}`);
  await page.waitForSelector(view === 'onboarding' ? '.onboard-form' : 'main.stage');
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);
  for (const [action, target] of views[view]) {
    if (action === 'click') await page.click(target);
    if (action === 'wait') await page.waitForTimeout(target);
    await page.waitForTimeout(250);
  }
  await page.mouse.move(1, 1);
  await page.waitForTimeout(300);
  const name = full ? `${view}-phone-light-full.png` : `${view}-${device}-${theme}.png`;
  // Focus mode is a fixed overlay, so it is captured as the viewport.
  const fullPage = !overlays.has(view) && (device === 'desktop' || full);
  // Bars fixed to the bottom of the window (phone tabs, the quiz's Continue)
  // belong at the bottom of a full-page picture: grow the window to the page.
  const grow = fullPage && (full || view === 'quiz' || view === 'wrong');
  if (fullPage) await page.evaluate(() => window.scrollTo(0, 0));
  if (grow) {
    const height = await page.evaluate(() => document.documentElement.scrollHeight);
    await page.setViewportSize({ width: viewport.width, height: Math.max(viewport.height, height) });
    await page.waitForTimeout(300);
  }
  await page.screenshot({ path: path.join(out, name), fullPage: fullPage && !grow });
  console.log(name, errors.length ? `ERRORS: ${errors.join(' | ')}` : '');
  await context.close();
}

for (const view of wanted) {
  if (!views[view]) continue;
  for (const theme of dark.has(view) || (view in extra && process.env.BOTH) ? ['light', 'dark'] : ['light']) {
    await shoot(view, 'desktop', theme, false);
    await shoot(view, 'phone', theme, false);
  }
  await shoot(view, 'phone', 'light', true);
}
await browser.close();
server.close();
