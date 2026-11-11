// Usage: node shoot.mjs <name> [viewsCsv] [outDir]
// Views follow the version 8 screens: Today, the morning in focus mode, Plan,
// Learn, Practice (Today's review, the practice exam and its result),
// Progress and setup.
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
  ['click', 'button:has-text("Continue")'], ['click', 'button:has-text("Continue")'],
  ['click', 'button:has-text("Create my plan")'], ['wait', 600],
];
const start = [['click', '.hero-session .play'], ['wait', 300]];
const toLearn = [...start, ['cards'], ['click', '.morning-foot .primary']];
const toQuestions = [...toLearn, ['click', '.morning-foot .primary'], ['wait', 400], ['click', '.morning-foot .primary'], ['click', '.morning-foot .primary'], ['click', '.morning-foot .primary'], ['wait', 300]];

// Each view: how to reach it from a freshly loaded page. `query` adds to the
// address (the harness reads ?today=YYYY-MM-DD; Wednesday 18 November 2026 by default).
const views = {
  today: { steps: [] },
  'today-weekend': { query: 'today=2026-11-21', steps: [] },
  plan: { steps: [nav('Plan')] },
  learn: { steps: [nav('Learn')] },
  lesson: { steps: [nav('Learn'), ['click', '.block-lessons li >> nth=2 >> button'], ['wait', 300]] },
  'lesson-kestrel': { steps: [nav('Learn'), ['click', '#library-week-6 > summary'], ['click', '#library-week-6 .week-lessons li >> nth=2 >> button'], ['wait', 300]] },
  'learn-exams': { steps: [nav('Learn'), learnTab('Exams')] },
  'learn-exam': { steps: [nav('Learn'), learnTab('Exams'), ['click', '.exam-card >> nth=2'], ['click', '.area summary >> nth=0']] },
  'learn-docs': { steps: [nav('Learn'), learnTab('Documents')] },
  'learn-doc': { steps: [nav('Learn'), learnTab('Documents'), ['click', '.doc-list li >> nth=1 >> button'], ['click', '.guide-fold >> nth=0 >> summary']] },
  glossary: { steps: [nav('Learn'), learnTab('Glossary')] },
  projects: { hash: 'projects', steps: [] },
  document: { steps: [nav('Learn'), learnTab('Documents'), ['click', '.doc-list li >> nth=5 >> button']] },
  practice: { steps: [nav('Practice')] },
  'practice-done': { state: 'booked', steps: [nav('Practice')] },
  'review-run': { overlay: true, steps: [nav('Practice'), ['click', '.review-card .play'], ['wait', 300]] },
  'exam-locked': { steps: [nav('Practice'), ['click', '.tile-exam']] },
  'exam-start': { state: 'ready', steps: [nav('Practice'), ['click', '.tile-exam']] },
  'exam-question': { overlay: true, state: 'ready', steps: [nav('Practice'), ['click', '.tile-exam'], ['click', '.exam-start .play'], ['click', '.answer >> nth=1'], ['click', '.flag-toggle']] },
  'exam-list': { overlay: true, state: 'ready', steps: [nav('Practice'), ['click', '.tile-exam'], ['click', '.exam-start .play'], ['click', '.answer >> nth=1'], ['click', '.morning-foot .primary'], ['click', '.answer >> nth=2'], ['click', '.flag-toggle'], ['click', '.exam-tools .ghost >> nth=0']] },
  'exam-confirm': { overlay: true, state: 'ready', steps: [nav('Practice'), ['click', '.tile-exam'], ['click', '.exam-start .play'], ['click', '.answer >> nth=1'], ['click', '.exam-tools .ghost:has-text("Finish exam")']] },
  'exam-result': { state: 'ready', steps: [nav('Practice'), ['click', '.tile-exam'], ['click', '.exam-start .play'], ['exam'], ['click', '.exam-tools .ghost:has-text("Finish exam")'], ['click', '.morning-foot .primary'], ['wait', 1500]] },
  'quiz-run': { steps: [nav('Practice'), ['click', '.tile-cross'], ['click', '.answer >> nth=1']] },
  'quiz-right': { steps: [nav('Practice'), ['click', '.tile-cross'], ['click', '.answer >> nth=1'], ['click', '.quiz-foot .primary'], ['wait', 700]] },
  'quiz-wrong': { steps: [nav('Practice'), ['click', '.tile-cross'], ['click', '.answer >> nth=0'], ['click', '.quiz-foot .primary'], ['wait', 700]] },
  flashcards: { steps: [nav('Practice'), ['click', '.tile-cards'], ['click', '.flash-card']] },
  labs: { steps: [nav('Practice'), ['click', '.tile-labs']] },
  progress: { steps: [nav('Progress')] },
  'progress-booked': { state: 'booked', steps: [nav('Progress')] },
  portfolio: { steps: [nav('Progress'), learnTab('Portfolio')] },
  'today-exam': { state: 'ready', query: 'today=2026-11-21', steps: [] },
  'morning-cards': { overlay: true, steps: [...start] },
  'morning-card-back': { overlay: true, steps: [...start, ['click', '.morning-foot .primary']] },
  'morning-brief': { overlay: true, steps: [...toLearn] },
  'morning-lesson': { overlay: true, steps: [...toLearn, ['click', '.morning-foot .primary'], ['wait', 500]] },
  'morning-build': { overlay: true, steps: [...toLearn, ['click', '.morning-foot .primary'], ['wait', 400], ['click', '.morning-foot .primary'], ['click', '.reveal']] },
  'morning-recall': { overlay: true, steps: [...toLearn, ['click', '.morning-foot .primary'], ['wait', 400], ['click', '.morning-foot .primary'], ['click', '.morning-foot .primary'], ['click', '.recall .reveal >> nth=0']] },
  'morning-question': { overlay: true, steps: [...toQuestions, ['click', '.answer >> nth=1'], ['click', '.sure label >> nth=0']] },
  'morning-answered': { overlay: true, steps: [...toQuestions, ['answer'], ['wait', 500]] },
  'morning-mistakes': { overlay: true, steps: [...toQuestions, ['questions']] },
  'short-morning': { overlay: true, steps: [['click', '.hero-link'], ['wait', 300]] },
  'weekend-lab': { overlay: true, query: 'today=2026-11-21', steps: [...start, ['click', '.lab-steps label >> nth=0'], ['click', '.lab-steps label >> nth=1']] },
  celebrate: { overlay: true, query: 'today=2026-11-21', steps: [...start, ['click', '.morning-foot .primary'], ['wait', 900]] },
  onboarding: { state: 'fresh', steps: [] },
  'onboarding-rhythm': { state: 'fresh', steps: [['click', 'button:has-text("Continue")'], ['click', 'button:has-text("Continue")']] },
  yours: { overlay: true, steps: [['click', '.me:visible, .avatar-button:visible'], ['wait', 400]] },
  'error-toast': { overlay: true, steps: [...start, ['click', '.morning-foot .primary'], failSaves, ['click', '.morning-foot .primary'], ['wait', 600]] },
  // Extra states worth a look: a morning left open, the first day after
  // setup and an empty Practice.
  'morning-left': { steps: [...start, ['click', '.focus-bar .ghost'], ['wait', 400]] },
  'today-new': { state: 'fresh', steps: [...onboard] },
  'practice-new': { state: 'fresh', steps: [...onboard, nav('Practice')] },
  'progress-new': { state: 'fresh', steps: [...onboard, nav('Progress')] },
};
const dark = process.env.ALL_DARK ? { has: () => true } : new Set(['today', 'plan', 'lesson', 'practice', 'quiz-right', 'progress', 'progress-booked', 'exam-start', 'exam-question', 'exam-list', 'exam-result', 'morning-cards', 'morning-answered', 'weekend-lab', 'yours']);
const wanted = viewsCsv ? viewsCsv.split(',') : Object.keys(views);
const devices = [
  ['desktop', { width: 1440, height: 900 }, 1],
  ['phone', { width: 390, height: 844 }, 2],
];

/* A morning: pass the cards with Good; answer with the second option and Sure. */
async function passCards(page) {
  for (let step = 0; step < 120; step += 1) {
    const label = (await page.textContent('.morning-foot .primary')).trim();
    if (label === 'Show answer') { await page.click('.morning-foot .primary'); await page.waitForSelector('.m-card-back'); continue; }
    if (label === 'Good') { await page.click('.morning-foot .primary'); await page.waitForSelector('.m-card-back', { state: 'detached' }); continue; }
    return;
  }
}
async function answerFirst(page) {
  await page.click('.answer >> nth=1');
  await page.click('.sure label >> nth=0');
  await page.click('.morning-foot .primary');
  await page.waitForSelector('.sheet');
}

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
  await page.goto(`${base}/?state=${view.state || 'midway'}${view.query ? `&${view.query}` : ''}${view.hash ? `#${view.hash}` : ''}`);
  await page.waitForSelector(view.state === 'fresh' ? '.onboard-form' : 'main.stage', { timeout: 10000 });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(350);
  for (const [action, target] of view.steps) {
    if (action === 'click') await page.click(target);
    if (action === 'wait') await page.waitForTimeout(target);
    if (action === 'eval') await page.evaluate(target);
    if (action === 'fill') await page.fill(target[0], target[1]);
    if (action === 'cards') await passCards(page);
    if (action === 'answer') await answerFirst(page);
    // A practice exam: answer the first 30 with the first option and leave the rest.
    if (action === 'exam') { for (let index = 0; index < 30; index += 1) { await page.click('.answer >> nth=0'); await page.click('.morning-foot .primary'); } }
    if (action === 'questions') { while (await page.locator('.q-head').count()) { await answerFirst(page); await page.click('.morning-foot .primary'); await page.waitForTimeout(200); } }
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
