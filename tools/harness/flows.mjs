// Functional checks of the redesigned flows against the harness build (out/after).
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const here = path.dirname(new URL(import.meta.url).pathname);
const root = path.join(here, 'out', 'after');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.woff2': 'font/woff2' };
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
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });

let passed = 0;
async function check(name, fn) { await fn(); passed += 1; console.log(`ok - ${name}`); }
const nav = (label) => page.click(`.nav button:has(.nav-label:text-is("${label}"))`);

await page.goto(`${base}/?state=midway`);
await page.waitForSelector('.hero-session');

await check('Today greets Moye by name and shows week 6, day 3 and the totals; Plan shows the 13-week track', async () => {
  assert.match(await page.textContent('.hello h1'), /^Good (morning|afternoon|evening), Moye$/);
  assert.match(await page.textContent('.hello .lede'), /Week 6 of 13\. One session, then your PL-300 and ITIL V5 gate\./);
  assert.match(await page.textContent('.why'), /Pass all four/);
  assert.match(await page.textContent('.tally'), /Sessions done\s*27\/65/);
  assert.match(await page.textContent('.tally'), /Days to PL-300/);
  assert.match(await page.textContent('.hero-label'), /Up next/);
  assert.match(await page.textContent('.hero-when'), /Week 6, Day 3/);
  assert.equal(await page.locator('.days .day-mark.is-done').count(), 2);
  assert.equal(await page.locator('.ring-arc, .rings').count(), 0);
  await nav('Plan');
  await page.waitForSelector('.plan .track-week');
  assert.equal(await page.locator('.track-week').count(), 13);
  assert.equal(await page.locator('.track-interactive .track-week.is-partial').count(), 1);
  assert.equal(await page.locator('.track-interactive .track-week.is-full').count(), 5);
  assert.equal(await page.getAttribute('.track-week.is-selected', 'aria-label'), 'Week 6: 2 of 5 sessions done, PL-300 and ITIL exam gate');
  await nav('Today');
  await page.waitForSelector('.hero-session');
});

await check('Choosing another week on Today shows that week', async () => {
  for (let step = 0; step < 4; step += 1) await page.click('.strip-head .arrow[aria-label="Previous week"]');
  assert.match(await page.textContent('.hero-when'), /Week 2, Day 5/);
  assert.match(await page.textContent('.hero-label'), /Done/);
  await page.click('.week-strip .text-link');
  assert.match(await page.textContent('.hero-when'), /Week 6, Day 3/);
});

await check('Start opens focus mode with a running timer and the session work', async () => {
  await page.click('.play');
  await page.waitForSelector('.focus');
  await page.waitForTimeout(1300);
  assert.match(await page.getAttribute('.focus-clock .digits', 'aria-label'), /00:0[1-9]/);
  const kinds = await page.locator('.fw-kind').allTextContents();
  assert.ok(kinds.some((kind) => /^R1-/.test(kind)) && kinds.includes('Practice'), kinds.join(','));
});

await check('Pause stops the clock; minimise keeps the session in the rail', async () => {
  await page.click('.focus-actions .round');
  const a = await page.getAttribute('.focus-clock .digits', 'aria-label');
  await page.waitForTimeout(1200);
  assert.equal(await page.getAttribute('.focus-clock .digits', 'aria-label'), a);
  await page.click('.focus-actions .round');
  await page.click('.focus-bar .ghost');
  await page.waitForSelector('.live-pill');
  await page.click('.live-pill');
  await page.waitForSelector('.focus');
});

await check('Finish shows the completion screen and advances to day 4', async () => {
  await page.click('button:has-text("Finish session")');
  await page.waitForSelector('.celebrate');
  assert.match(await page.textContent('.celebrate-stats'), /3 of 5/);
  await page.click('.celebrate .primary');
  await page.waitForFunction(() => document.querySelector('.hero-when')?.textContent?.includes('Day 4'));
  assert.equal(await page.locator('.days .day-mark.is-done').count(), 3);
});

await check('Mark done finishes the week; its reflection opens and saves on Plan, with week 7 current', async () => {
  await page.click('.hero-actions .ghost');
  await page.click('.celebrate .primary');
  await page.waitForFunction(() => document.querySelector('.hero-when')?.textContent?.includes('Day 5'));
  await page.click('.hero-actions .ghost');
  await page.click('.celebrate .primary');
  await page.click('.waiting .row:has-text("Week 6 reflection")');
  await page.waitForSelector('.plan #reflection-6[open]');
  assert.match(await page.textContent('.weeks > li.is-current'), /Week 7, this week/);
  assert.match(await page.textContent('#reflection-6 summary'), /Not written yet/);
  await page.fill('#retro-6', 'Decision I can now defend: grain before visuals. '.repeat(3));
  await page.click('#reflection-6 .primary');
  await page.waitForSelector('.toast:not(.is-error)');
  assert.match(await page.textContent('#reflection-6 summary'), /Saved/);
});

await check('A session opened from Plan shows on Today', async () => {
  await page.click('.plan .track-week >> nth=0');
  await page.click('#week-1 .week-detail li >> nth=4 >> button');
  await page.waitForSelector('.hero-session');
  assert.match(await page.textContent('#session-title'), /programme charter/i);
  assert.match(await page.textContent('.hero-actions'), /Done/);
  await nav('Plan');
  await page.click('.plan .track-week >> nth=6');
  await page.click('#week-7 .week-detail li >> nth=0 >> button');
  await page.waitForSelector('.hero-session');
  assert.match(await page.textContent('#session-title'), /WBS/);
});

await check('Focus work link opens the document with its draft', async () => {
  await page.click('.play');
  await page.waitForSelector('.focus');
  await page.click('.focus-work button:has-text("Release 2 schedule and cost baseline")');
  await page.waitForSelector('.doc');
  assert.equal(await page.textContent('#doc-title'), 'Release 2 schedule and cost baseline');
  assert.match(await page.inputValue('#work'), /Decision or problem/);
  assert.equal(await page.locator('.finished-fold').count(), 1);
  assert.equal(await page.locator('.live-pill').count(), 1);
});

await check('Done-when ticks and mark-complete explains what is missing', async () => {
  await page.click('.done-when > summary');
  await page.click('.rubric label >> nth=0');
  assert.match(await page.textContent('.done-when > summary'), /1 of 5 checked/);
  await page.fill('#work', 'short');
  await page.fill('#explain', '');
  assert.match(await page.textContent('.doc-actions .hint'), /115 more characters of work and 40 more characters of explanation/);
  await page.fill('#work', 'x'.repeat(130));
  await page.fill('#explain', 'y'.repeat(45));
  await page.click('.doc-actions .primary');
  await page.waitForSelector('.toast:not(.is-error)');
});

await check('Check yourself runs five questions for this document', async () => {
  await page.click('.check-yourself');
  await page.waitForSelector('.quiz');
  assert.match(await page.textContent('.quiz-count'), /1\/5/);
  await page.click('.quiz .close');
  await page.waitForSelector('.tiles');
});

await check('Scenarios: keyboard B + Enter shows the sheet; Enter continues', async () => {
  await page.click('.tile-scenarios');
  await page.waitForSelector('.quiz');
  await page.keyboard.press('b');
  await page.keyboard.press('Enter');
  await page.waitForSelector('.sheet.is-right');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => /^2\/\d{3}$/.test(document.querySelector('.quiz-count')?.textContent || ''));
  await page.click('.quiz .close');
  await page.waitForSelector('.toast');
});

await check('Review opens the connected document', async () => {
  await page.click('.tile-review');
  await page.waitForSelector('.review-list li');
  await page.click('.review-list li >> nth=0 >> button');
  await page.waitForSelector('.doc');
});

await check('Progress shows four exam cards; Portfolio tab and #portfolio work', async () => {
  await nav('Progress');
  await page.waitForSelector('.cert-scores');
  assert.equal(await page.locator('.cert-scores li').count(), 4);
  await page.click('.segmented button:has-text("Portfolio")');
  assert.equal(new URL(page.url()).hash, '#portfolio');
  await page.reload();
  await page.waitForSelector('.checklist.interactive');
});

await check('Learn: lesson opens from Today and moves to the next lesson', async () => {
  await page.goto(`${base}/?state=midway`);
  await page.waitForSelector('.hero-session');
  const title = (await page.textContent('#session-title')).trim();
  await page.click('.hero-lesson');
  await page.waitForSelector('.reader .lesson');
  assert.equal((await page.textContent('#reader-title')).trim(), title);
  assert.equal(new URL(page.url()).hash, '#learn');
  assert.equal(await page.locator('.self-check li').count(), 3);
  await page.click('.self-check details >> nth=0 >> summary');
  assert.ok((await page.textContent('.self-check details >> nth=0 >> p')).length >= 60);
  assert.ok(await page.locator('.read').count() >= 4);
  await page.click('.reader-nav .next');
  assert.notEqual((await page.textContent('#reader-title')).trim(), title);
});

await check('Learn: exam guide, glossary search and document guide', async () => {
  await page.click('.back');
  await page.click('.segmented button:has-text("Exams")');
  await page.click('.exam-card:has-text("ITIL")');
  assert.match(await page.textContent('.reader'), /Discover.*Design.*Acquire.*Build.*Transition.*Operate.*Deliver.*Support/s);
  await page.click('.back');
  await page.click('.segmented button:has-text("Glossary")');
  await page.fill('#term-search', 'critical path');
  assert.ok(await page.locator('.terms > div').count() >= 1);
  await page.click('.segmented button:has-text("Documents")');
  assert.equal(await page.locator('.releases .release').count(), 3);
  await page.click('.releases .release >> nth=0');
  await page.click('.doc-list li >> nth=0 >> button');
  await page.waitForSelector('.doc');
  assert.equal((await page.textContent('#doc-title')).trim(), 'Programme brief');
  assert.equal(await page.locator('.guide-fold').count(), 2);
  await page.click('.finished-fold > summary');
  assert.ok((await page.textContent('.finished-fold .rich')).length > 1500);
});

await check('Focus mode: read the lesson while the timer keeps running', async () => {
  await nav('Today');
  await page.click('.play');
  await page.waitForSelector('.focus');
  await page.click('.focus-lesson');
  await page.waitForSelector('.focus-read .lesson');
  const before = await page.getAttribute('.focus-mini .digits', 'aria-label');
  await page.waitForTimeout(1200);
  assert.notEqual(await page.getAttribute('.focus-mini .digits', 'aria-label'), before);
  await page.click('.focus-read .primary');
  await page.waitForSelector('.focus-clock');
  await page.click('.focus-actions .ghost');
});

await check('Practice: timed set uses the chosen exam; flashcards filter by exam', async () => {
  await nav('Practice');
  await page.selectOption('#lens', 'CISSP');
  await page.click('.tile-timed .start');
  await page.waitForSelector('.quiz');
  assert.match(await page.textContent('.quiz-meta'), /CISSP|All four/);
  await page.click('.quiz .close');
  await page.click('.tile-cards');
  await page.click('.pills .pill:has-text("PL-300")');
  assert.match(await page.textContent('.flash-cert'), /PL-300, card 1 of \d+/);
});

await check('Onboarding steps through and creates the plan', async () => {
  await page.goto(`${base}/?state=fresh`);
  await page.waitForSelector('.onboard-form');
  await page.fill('#displayName', 'Sam Rivera');
  await page.fill('#motivation', 'Move into security architecture.');
  await page.click('button:has-text("Continue")');
  await page.fill('#pmMonths', '40');
  await page.click('button:has-text("Continue")');
  await page.click('.chip:has-text("Identity & access")');
  await page.click('button:has-text("Continue")');
  await page.click('button:has-text("Continue")');
  await page.fill('#pl300Target', '2027-01-15');
  await page.click('button:has-text("Create my plan")');
  await page.waitForSelector('.hero-session');
  assert.match(await page.textContent('.hero-when'), /Week 1, Day 1/);
  assert.match(await page.textContent('.rail-exam'), /PL-300/);
  assert.match(await page.textContent('.hello h1'), /, Sam$/);
  assert.match(await page.textContent('.why'), /security architecture/);
  assert.equal(await page.textContent('.me .avatar'), 'SR');
});

await check('Make it yours: colour and appearance apply at once; name and why save', async () => {
  await page.click('.me');
  await page.waitForSelector('.yours');
  await page.click('.swatch:has-text("Glacier")');
  assert.equal(await page.evaluate(() => document.documentElement.dataset.accent), 'glacier');
  await page.click('.chip-option:has-text("Night")');
  assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), 'dark');
  assert.equal(await page.evaluate(() => getComputedStyle(document.body).backgroundColor), 'rgb(9, 9, 11)');
  await page.fill('#yours-name', 'Samira');
  await page.fill('#yours-why', 'Lead the next programme.');
  await page.click('.yours .primary');
  await page.waitForSelector('.yours', { state: 'detached' });
  assert.match(await page.textContent('.hello h1'), /, Samira$/);
  assert.match(await page.textContent('.why'), /Lead the next programme/);
  await page.click('.me');
  await page.click('.chip-option:has-text("Light")');
  await page.keyboard.press('Escape');
  await page.waitForSelector('.yours', { state: 'detached' });
  assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), 'light');
  await page.reload();
  await page.waitForSelector('.onboard-form, .hero-session');
  assert.equal(await page.evaluate(() => document.documentElement.dataset.accent), 'glacier');
});

await check('Errors show as an alert', async () => {
  await page.goto(`${base}/?state=midway`);
  await page.waitForSelector('.hero-session');
  await page.evaluate(() => {
    const original = window.fetch;
    window.fetch = async (input, init) => (init && init.method === 'PUT' ? new Response(JSON.stringify({ error: 'Database unavailable.' }), { status: 500, headers: { 'Content-Type': 'application/json' } }) : original(input, init));
  });
  await page.click('.hero-actions .ghost');
  await page.waitForSelector('.toast.is-error');
  assert.equal(await page.getAttribute('.toast.is-error', 'role'), 'alert');
});

assert.deepEqual(errors, [], `console errors: ${errors.join(' | ')}`);
console.log(`\n${passed} flow checks passed, no console errors`);
await browser.close();
server.close();
