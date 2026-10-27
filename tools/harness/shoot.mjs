// Usage: node shoot.mjs <name> [viewsCsv] [outDir]
// Serves out/<name> (run `node build.mjs <name> ../..` first) and writes
// <view>-<desktop|phone>-<light|dark>.png for every screen into outDir
// (default shots/<name>/). Desktop is 1440x900, full page; phone is 390x844,
// the viewport only. Overlays (focus mode, completion, Make it yours) are
// captured as the viewport. Every view is shot light; the views in `dark`
// are also shot in night. Set PHONE_FULL=<dir> to add full-page phone shots.
import http from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const [name = 'after', viewsCsv, outArg] = process.argv.slice(2);
const here = path.dirname(new URL(import.meta.url).pathname);
const root = path.join(here, 'out', name);
const out = path.resolve(outArg || path.join(here, 'shots', name));
const phoneFull = process.env.PHONE_FULL ? path.resolve(process.env.PHONE_FULL) : null;
await mkdir(out, { recursive: true });
if (phoneFull) await mkdir(phoneFull, { recursive: true });

const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.csv': 'text/csv', '.md': 'text/markdown', '.sql': 'text/plain', '.woff2': 'font/woff2' };
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  try {
    const file = path.join(root, url.pathname === '/' ? 'index.html' : url.pathname);
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end('not found');
  }
});
await new Promise((resolve) => server.listen(0, resolve));
const base = `http://localhost:${server.address().port}`;

const nav = (label) => ['click', `.nav button:has(.nav-label:text-is("${label}"))`];
const learnTab = (label) => ['click', `.segmented button:has-text("${label}")`];
const failSaves = ['eval', () => {
  const original = window.fetch;
  window.fetch = async (input, init) => (init && init.method === 'PUT' ? new Response(JSON.stringify({ error: 'Your work could not be saved. Check the connection and try again.' }), { status: 500, headers: { 'Content-Type': 'application/json' } }) : original(input, init));
}];

const onboard = [
  ['fill', ['#displayName', 'Moye']],
  ['click', 'button:has-text("Continue")'], ['click', 'button:has-text("Continue")'], ['click', 'button:has-text("Continue")'], ['click', 'button:has-text("Continue")'],
  ['fill', ['#pl300Target', '2026-12-10']],
  ['click', 'button:has-text("Create my plan")'], ['wait', 600],
];

// Each view: how to reach it from a freshly loaded page.
const views = {
  today: { steps: [] },
  plan: { steps: [nav('Plan')] },
  learn: { steps: [nav('Learn')] },
  lesson: { steps: [nav('Learn'), ['click', '.lesson-week[open] li button >> nth=2'], ['wait', 300]] },
  'learn-exams': { steps: [nav('Learn'), learnTab('Exams')] },
  'learn-exam': { steps: [nav('Learn'), learnTab('Exams'), ['click', '.exam-card >> nth=2'], ['click', '.area summary >> nth=0']] },
  'learn-docs': { steps: [nav('Learn'), learnTab('Documents')] },
  'learn-doc': { steps: [nav('Learn'), learnTab('Documents'), ['click', '.doc-list li >> nth=1 >> button'], ['click', '.guide-fold >> nth=0 >> summary']] },
  glossary: { steps: [nav('Learn'), learnTab('Glossary')] },
  projects: { hash: 'projects', steps: [] },
  document: { steps: [nav('Learn'), learnTab('Documents'), ['click', '.doc-list li >> nth=5 >> button']] },
  practice: { steps: [nav('Practice')] },
  'quiz-run': { steps: [nav('Practice'), ['click', '.tile-scenarios'], ['click', '.answer >> nth=1']] },
  'quiz-right': { steps: [nav('Practice'), ['click', '.tile-scenarios'], ['click', '.answer >> nth=1'], ['click', '.quiz-foot .primary'], ['wait', 700]] },
  'quiz-wrong': { steps: [nav('Practice'), ['click', '.tile-scenarios'], ['click', '.answer >> nth=0'], ['click', '.quiz-foot .primary'], ['wait', 700]] },
  timed: { steps: [nav('Practice'), ['click', '.tile-timed .start'], ['wait', 300]] },
  flashcards: { steps: [nav('Practice'), ['click', '.tile-cards'], ['click', '.flash-card']] },
  labs: { steps: [nav('Practice'), ['click', '.tile-labs']] },
  review: { steps: [nav('Practice'), ['click', '.tile-review']] },
  progress: { steps: [nav('Progress')] },
  portfolio: { steps: [nav('Progress'), learnTab('Portfolio')] },
  focus: { overlay: true, steps: [['click', '.play'], ['wait', 2200]] },
  'focus-read': { overlay: true, steps: [['click', '.play'], ['wait', 800], ['click', '.focus-lesson'], ['wait', 300]] },
  celebrate: { overlay: true, steps: [['click', '.play'], ['wait', 1200], ['click', 'button:has-text("Finish session")'], ['wait', 1400]] },
  onboarding: { state: 'fresh', steps: [] },
  yours: { overlay: true, steps: [['click', '.me:visible, .avatar-button:visible'], ['wait', 400]] },
  'error-toast': { steps: [failSaves, ['click', '.hero-actions .ghost'], ['wait', 600]] },
  // Extra states worth a look: the running-session pill, a finished
  // session, the first day after onboarding and an empty review queue.
  timer: { steps: [['click', '.play'], ['wait', 1300], ['click', '.focus-bar .ghost'], ['wait', 400]] },
  'today-done': { steps: [['click', '.strip-head .arrow[aria-label="Previous week"]']] },
  'today-new': { state: 'fresh', steps: [...onboard] },
  'review-empty': { state: 'fresh', steps: [...onboard, nav('Practice'), ['click', '.tile-review']] },
};
const dark = new Set(['today', 'plan', 'lesson', 'practice', 'quiz-right', 'progress', 'focus', 'yours']);
const wanted = viewsCsv ? viewsCsv.split(',') : Object.keys(views);
const devices = [
  ['desktop', { width: 1440, height: 900 }, 1],
  ['phone', { width: 390, height: 844 }, 2],
];

const browser = await chromium.launch();
let failures = 0;
async function shoot(key, device, viewport, scale, theme, full) {
  const view = views[key];
  const context = await browser.newContext({ viewport, deviceScaleFactor: scale });
  await context.addInitScript((prefs) => { localStorage.setItem('tricert.ui.v3', JSON.stringify(prefs)); }, { v: 7, theme, accent: 'beacon' });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error' && !/status of 500/.test(message.text())) errors.push(message.text()); });
  await page.goto(`${base}/?state=${view.state || 'midway'}${view.hash ? `#${view.hash}` : ''}`);
  await page.waitForSelector(view.state === 'fresh' ? '.onboard-form' : 'main.stage', { timeout: 10000 });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(350);
  for (const [action, target] of view.steps) {
    if (action === 'click') await page.click(target);
    if (action === 'wait') await page.waitForTimeout(target);
    if (action === 'eval') await page.evaluate(target);
    if (action === 'fill') await page.fill(target[0], target[1]);
    await page.waitForTimeout(220);
  }
  await page.mouse.move(1, 1);
  await page.waitForTimeout(300);
  const fullPage = full || (device === 'desktop' && !view.overlay);
  if (fullPage) await page.evaluate(() => window.scrollTo(0, 0));
  const file = path.join(full ? phoneFull : out, `${key}-${device}-${theme}${full ? '-full' : ''}.png`);
  await page.screenshot({ path: file, fullPage });
  const width = await page.evaluate(() => document.documentElement.scrollWidth);
  const overflow = width > viewport.width ? ` OVERFLOW ${width}px` : '';
  if (errors.length || overflow) failures += 1;
  console.log(`${path.basename(file)}${overflow}${errors.length ? ` ERRORS: ${errors.join(' | ')}` : ''}`);
  await context.close();
}

for (const key of wanted) {
  if (!views[key]) { console.log(`unknown view ${key}`); continue; }
  for (const theme of dark.has(key) ? ['light', 'dark'] : ['light']) {
    for (const [device, viewport, scale] of devices) await shoot(key, device, viewport, scale, theme, false);
  }
  if (phoneFull && !views[key].overlay) await shoot(key, 'phone', devices[1][1], 1, 'light', true);
}
await browser.close();
server.close();
if (failures) { console.log(`${failures} screenshots had errors or sideways scrolling`); process.exitCode = 1; }
