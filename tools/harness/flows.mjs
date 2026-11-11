// Functional checks of the version 8 flows against the harness build (out/after).
// The harness fixtures (entry.tsx): `midway` is the ITIL block with mornings 1 to 4
// and review 1 done, cards and questions due, practice exam A not taken; `ready`
// has every morning to review 2 and the lab done, so practice exam A is open;
// `booked` has the whole block and two passing practice exams; `fresh`
// has no profile. ?today=YYYY-MM-DD sets the date (default Wednesday 2026-11-18)
// and ?keep=1 keeps the fake server's state in the tab across reloads.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { readFileSync, readdirSync } from 'node:fs';
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

// The right option of every question, from the content source files.
const contentDir = path.join(here, '..', 'content', 'parts2');
const correctOf = new Map();
for (const file of readdirSync(contentDir).filter((name) => /^questions.*\.json$/.test(name))) {
  for (const item of JSON.parse(readFileSync(path.join(contentDir, file), 'utf8')).items) correctOf.set(item.id, item.correct);
}

const browser = await chromium.launch();
const errors = [];
let page;
async function open(viewport = { width: 1440, height: 900 }) {
  const context = await browser.newContext({ viewport });
  // A test can hand the next page load a morning to start from (see inject()).
  await context.addInitScript(() => {
    const next = sessionStorage.getItem('flows.inject');
    if (next) { localStorage.setItem('tricert.morning.v1', next); sessionStorage.removeItem('flows.inject'); }
  });
  const fresh = await context.newPage();
  fresh.on('pageerror', (error) => errors.push(error.message));
  fresh.on('console', (message) => { if (message.type() === 'error' && !/status of 500/.test(message.text())) errors.push(message.text()); });
  page = fresh;
  return context;
}

let passed = 0;
async function check(name, fn) { await fn(); passed += 1; console.log(`ok - ${name}`); }
const nav = (label) => page.click(`.nav button:has(.nav-label:text-is("${label}"))`);
const getState = () => page.evaluate(async () => (await fetch('/api/state')).json());
const storedRun = () => page.evaluate(() => JSON.parse(localStorage.getItem('tricert.morning.v1') || 'null'));
const mainLabel = async () => (await page.textContent('.morning-foot .primary')).trim();

/* Cards: Show answer, then Good (or the grade given) until the part is done. */
async function passCards(grade = 'Good') {
  for (let step = 0; step < 120; step += 1) {
    const label = await mainLabel();
    if (label === 'Show answer') { await page.click('.morning-foot .primary'); await page.waitForSelector('.m-card-back'); continue; }
    if (label === 'Good') { await page.click(`.morning-foot button:text-is("${grade}")`); await page.waitForSelector('.m-card-back', { state: 'detached' }); continue; }
    return label;
  }
  throw new Error('cards never ended');
}

/* Answer the question on screen: right or wrong, Sure or Guess. Returns its id. */
async function answerQuestion(kind = 'right', confidence = 'Sure') {
  const current = await storedRun();
  const id = current.questions.ids[current.questions.index];
  const correct = correctOf.get(id);
  assert.ok(correct, `no answer key for ${id}`);
  const letter = kind === 'wrong' ? ['A', 'B', 'C', 'D'].find((key) => key !== correct) : correct;
  await page.click(`.answer:has(input[value="${letter}"])`);
  await page.click(`.sure label:has-text("${confidence}")`);
  await page.click('.morning-foot .primary');
  await page.waitForSelector(`#sheet-${id}`);
  return id;
}

/* Next question, or on to the next part on the last one. */
async function nextQuestion() {
  const before = await page.textContent('#morning-title');
  await page.click('.morning-foot .primary');
  await page.waitForFunction((text) => document.querySelector('#morning-title')?.textContent !== text, before);
}

async function answerAll(kind = 'right', confidence = 'Sure') {
  while (await page.locator('.q-head').count()) {
    await answerQuestion(kind, confidence);
    await nextQuestion();
  }
}

/* The next page load starts with this morning in the browser. */
async function inject(run) {
  await page.evaluate((value) => sessionStorage.setItem('flows.inject', JSON.stringify(value)), run);
}

let context = await open();
await page.goto(`${base}/?state=midway`);
await page.waitForSelector('.hero-session');

await check('Today shows the next ITIL morning, the short morning link and reviews due; the 13-week strip is gone', async () => {
  assert.match(await page.textContent('.hello h1'), /^Good (morning|afternoon|evening), Moye$/);
  assert.match(await page.textContent('.hello .lede'), /^ITIL Foundation \(Version 5\)\. Exam about /);
  assert.match(await page.textContent('.tally'), /Mornings done\s*5\/12/);
  assert.match(await page.textContent('.hero-label'), /Up next/);
  assert.match(await page.textContent('.hero-when'), /ITIL, morning 6 of 12/);
  assert.equal((await page.textContent('#session-title')).trim(), 'The product and service lifecycle');
  assert.match(await page.textContent('.hero-sub'), /Cards, Learn, Questions, Mistakes.*Brief from Tomás Rivera/);
  assert.equal(await page.locator('.hero-session .primary').count(), 1);
  assert.equal((await page.textContent('.hero-session .play')).trim(), 'Start morning');
  assert.equal((await page.textContent('.hero-link')).trim(), 'Short morning (45 minutes)');
  const waiting = await page.locator('.waiting .row').allTextContents();
  assert.ok(waiting.some((row) => /7 cards and 8 questions due for review/.test(row)), waiting.join(' | '));
  assert.ok(waiting.some((row) => /Draft, R1-06/.test(row)), waiting.join(' | '));
  assert.equal(await page.locator('.week-strip, .days, .track').count(), 0);
  assert.equal(await page.getAttribute('.nav button:has(.nav-label:text-is("Practice"))', 'aria-label'), 'Practice, 15 due for review');
});

await check('Saturday shows the next weekend block with a link to do a morning instead', async () => {
  await page.goto(`${base}/?state=midway&today=2026-11-21`);
  await page.waitForSelector('.hero-session');
  assert.match(await page.textContent('.hero-label'), /This weekend/);
  assert.match(await page.textContent('.hero-when'), /ITIL, weekend block 1 of 3/);
  assert.match(await page.textContent('#session-title'), /Jira Service Management/);
  assert.equal((await page.textContent('.hero-session .play')).trim(), 'Start lab');
  assert.equal((await page.textContent('.hero-link')).trim(), 'Do a morning instead');
  await page.click('.hero-link');
  await page.waitForSelector('.morning');
  assert.match(await page.textContent('.focus-where'), /ITIL, morning 6/);
  await page.keyboard.press('Escape');
  await page.waitForSelector('.morning', { state: 'detached' });
});

await check('The lab lists its steps with a tick for each; ticks survive a reload; Finish block saves it and shows the completion screen', async () => {
  await page.click('.hero-session .play');
  await page.waitForSelector('.morning #weekend-title');
  assert.equal(await page.locator('.lab-steps li').count(), 10);
  await page.click('.lab-steps label >> nth=0');
  await page.click('.lab-steps label >> nth=2');
  assert.match(await page.textContent('.focus .hint'), /2 of 10 steps ticked/);
  await page.reload();
  await page.waitForSelector('.hero-session');
  await page.click('.hero-session .play');
  await page.waitForSelector('.morning #weekend-title');
  assert.deepEqual(await page.locator('.lab-steps input').evaluateAll((boxes) => boxes.map((box) => box.checked).slice(0, 3)), [true, false, true]);
  assert.equal((await page.textContent('.morning-foot .primary')).trim(), 'Finish block');
  await page.click('.morning-foot .primary');
  await page.waitForSelector('.celebrate');
  assert.match(await page.textContent('#celebrate-title'), /Weekend block done/);
  await page.click('.celebrate .primary');
  const state = await getState();
  assert.ok(state.progress.some((row) => row.item_key === 'itil-w1' && row.status === 'complete'));
  assert.ok(state.records.log.some((row) => row.key === 'itil-w1' && row.kind === 'lab'));
  // Practice exam A waits for review 2, so Saturday now offers the morning.
  await page.waitForFunction(() => /ITIL, morning 6 of 12/.test(document.querySelector('.hero-when')?.textContent || ''));
  assert.match(await page.textContent('.hero-note'), /No weekend block is open yet\. The next one opens after Review: mornings 5 to 8\./);
});
await context.close();

/* ------------------------------------------------ a whole morning, kept */
context = await open();
await page.goto(`${base}/?state=midway&keep=1`);
await page.waitForSelector('.hero-session');
let wrongId = '';
let guessId = '';
let questionTotal = 0;

await check('Start morning opens focus mode with the four parts and their minutes; keyboard focus moves in', async () => {
  await page.click('.hero-session .play');
  await page.waitForSelector('.morning');
  await page.waitForFunction(() => document.activeElement?.matches('.morning'));
  assert.equal(await page.evaluate(() => document.querySelector('.app').inert), true);
  const steps = await page.locator('.step-line li').allTextContents();
  assert.deepEqual(steps.map((text) => text.replace(/\s+/g, ' ').trim()), ['Cards10 min', 'Learn35 min', 'Questions30 min', 'Mistakes15 min']);
  assert.match(await page.textContent('.step-line li[aria-current="step"]'), /Cards/);
});

await check('Cards: Show answer, then Again or Good; Again saves the reset and shows the card once more', async () => {
  assert.match(await page.textContent('.morning-col .hint'), /15 cards left/);
  assert.equal(await mainLabel(), 'Show answer');
  await page.click('.morning-foot .primary');
  await page.waitForSelector('.m-card-back');
  const first = (await storedRun()).cards.queue[0].id;
  await page.click('.morning-foot button:text-is("Again")');
  await page.waitForSelector('.m-card-back', { state: 'detached' });
  assert.match(await page.textContent('.morning-col .hint'), /15 cards left/);
  const state = await getState();
  // Oldest due first: a card from morning 2. Again resets it, due tomorrow, and keeps its first day.
  assert.deepEqual(state.records.srs.cards[first], { stage: 0, due: '2026-11-19', first: '2026-11-10' });
  const queue = (await storedRun()).cards.queue;
  assert.deepEqual(queue[queue.length - 1], { id: first, repeat: true });
  assert.equal(await passCards(), 'Continue to learn');
  assert.match(await page.textContent('.morning-col .hint'), /15 reviewed, 1 to see again tomorrow/);
});

await check('Learn: the brief, the lesson, the step with its model answer, then three recall prompts', async () => {
  await page.click('.morning-foot .primary');
  assert.match(await page.textContent('.brief-note figcaption'), /Tomás Rivera/);
  assert.match(await page.textContent('.brief-ask'), /Your task/);
  await page.click('.morning-foot .primary');
  await page.waitForSelector('.morning .lesson .read');
  assert.ok(await page.locator('.morning .lesson .read').count() >= 4);
  assert.equal(await page.locator('#ml-build, #ml-check').count(), 0);
  await page.click('.morning-foot .primary');
  await page.fill('#build-answer', 'Discover: ask the unit managers. Design: the page. Support: the 05:00 refresh.');
  assert.equal(await page.locator('.model-answer').count(), 0);
  await page.click('button:has-text("Reveal the model answer")');
  assert.ok((await page.textContent('.model-answer')).length > 200);
  await page.click('.morning-foot .primary');
  assert.equal(await page.locator('.recall li').count(), 3);
  await page.click('.recall .reveal >> nth=0');
  assert.equal(await page.locator('.recall-a').count(), 1);
  assert.equal(await mainLabel(), 'Continue to questions');
  await page.click('.morning-foot .primary');
  await page.waitForSelector('.q-head');
});

await check('Leave keeps the morning; a reload returns to the same part with one quiet line', async () => {
  await page.click('.focus-bar button:has-text("Leave")');
  await page.waitForSelector('.morning', { state: 'detached' });
  assert.match(await page.textContent('.live-pill'), /Questions/);
  assert.match(await page.textContent('.hero-label'), /In progress/);
  assert.match(await page.textContent('.hero-session .play'), /Resume morning, questions/);
  await page.click('.hero-session .play');
  await page.waitForSelector('.q-head');
  await page.waitForTimeout(2200);
  await page.reload();
  await page.waitForSelector('.morning .q-head');
  assert.match(await page.textContent('.step-line li[aria-current="step"]'), /Questions/);
  assert.match(await page.textContent('.restored'), /Back where you left off/);
  assert.match((await storedRun()).learn.build, /05:00 refresh/);
});

await check('Questions: one at a time with a clock at the exam pace; Sure or Guess; the explanation and why each wrong option is wrong', async () => {
  const head = await page.textContent('.quiz-meta');
  questionTotal = Number(head.match(/Question 1 of (\d+)/)[1]);
  assert.ok(questionTotal >= 9 && questionTotal <= 20, head);
  assert.match(await page.textContent('.q-clock'), /of 01:30/);
  const start = await page.getAttribute('.q-clock .digits', 'aria-label');
  await page.waitForTimeout(1300);
  assert.notEqual(await page.getAttribute('.q-clock .digits', 'aria-label'), start);
  assert.equal(await page.isDisabled('.morning-foot .primary'), true);
  wrongId = await answerQuestion('wrong', 'Sure');
  assert.match(await page.textContent('.sheet'), /The answer is [A-D]/);
  assert.match(await page.textContent('.sheet'), /Why the other answers are wrong/);
  assert.equal(await page.locator('.why-wrong li').count(), 3);
  const state = await getState();
  const attempt = state.attempts.find((row) => row.question_id === wrongId);
  assert.equal(attempt.correct, 0);
  assert.equal(attempt.confidence, 'high');
  assert.equal(state.records.srs.questions[wrongId].due, '2026-11-20');
  await nextQuestion();
  guessId = await answerQuestion('right', 'Guess');
  assert.match(await page.textContent('.sheet'), /Right, but a guess/);
  assert.equal((await getState()).attempts.find((row) => row.question_id === guessId).confidence, 'low');
  await nextQuestion();
  await answerAll('right', 'Sure');
  assert.match(await page.textContent('.step-line li[aria-current="step"]'), /Mistakes/);
});

await check('Mistakes lists the wrong and guessed questions; Finish morning saves the cards, progress and log, then shows what he did', async () => {
  assert.equal(await page.locator('.mistakes li').count(), 2);
  await page.fill(`#rule-${wrongId}`, 'Lifecycle activities describe the work, not the order it happens in.');
  await page.fill(`#rule-${guessId}`, 'Support is a lifecycle activity on its own.');
  assert.equal(await mainLabel(), 'Finish morning');
  await page.click('.morning-foot .primary');
  await page.waitForSelector('.celebrate');
  assert.match(await page.textContent('#celebrate-title'), /Morning done/);
  const stats = (await page.textContent('.celebrate-stats')).replace(/\s+/g, ' ');
  assert.match(stats, new RegExp(`Cards\\s*15.*Questions\\s*${questionTotal}.*Right\\s*${questionTotal - 1}.*Minutes\\s*\\d+`));
  await page.click('.celebrate .primary');
  await page.waitForFunction(() => /ITIL, morning 7 of 12/.test(document.querySelector('.hero-when')?.textContent || ''));
  const state = await getState();
  assert.ok(state.progress.some((row) => row.item_key === 'itil-m5' && row.status === 'complete'));
  const log = state.records.log[state.records.log.length - 1];
  assert.equal(log.key, 'itil-m5');
  assert.equal(log.kind, 'learn');
  assert.equal(log.questions, questionTotal);
  assert.equal(log.cards, 15);
  assert.equal(state.records.usercards.length, 3);
  const mine = state.records.usercards.find((card) => card.question === wrongId);
  assert.equal(mine.back, 'Lifecycle activities describe the work, not the order it happens in.');
  assert.deepEqual(state.records.srs.cards[mine.id], { stage: 0, due: '2026-11-19' });
  assert.equal(await storedRun(), null);
});

await check('Spaced review: two days later the wrong and the guessed questions are due again', async () => {
  await page.goto(`${base}/?state=midway&keep=1&today=2026-11-20`);
  await page.waitForSelector('.hero-session');
  const state = await getState();
  const due = Object.entries(state.records.srs.questions).filter(([, value]) => value.stage < 4 && value.due <= '2026-11-20').map(([id]) => id).sort();
  assert.deepEqual(due, [guessId, wrongId].sort());
  assert.ok((await page.locator('.waiting .row').allTextContents()).some((row) => /and 2 questions due for review/.test(row)));
});
await context.close();

/* ------------------------------------------------------ short morning */
context = await open();
await page.goto(`${base}/?state=midway&keep=1`);
await page.waitForSelector('.hero-session');

await check('Plan: four blocks in order, the current one open with its mornings and weekend blocks; the others say they are being built', async () => {
  await nav('Plan');
  await page.waitForSelector('.blocks');
  assert.equal(await page.locator('.block').count(), 4);
  assert.match(await page.textContent('.block.is-current .eyebrow'), /Exam 1 of 4.*Now/);
  assert.match(await page.textContent('.block.is-current .block-when'), /Exam about /);
  const mornings = page.locator('.block.is-current .plan-items >> nth=0').locator('li');
  assert.equal(await mornings.count(), 12);
  assert.equal(await page.locator('.block.is-current .plan-items >> nth=0').locator('.tick.is-done').count(), 5);
  assert.match(await mornings.nth(5).textContent(), /The product and service lifecycle.*Next/);
  assert.match(await mornings.nth(6).textContent(), /Thu, Nov\.? 19/);
  assert.match(await mornings.nth(10).textContent(), /Opens after Practice exam A/);
  assert.equal(await mornings.nth(10).locator('button').count(), 0);
  const weekends = await page.locator('.block.is-current .plan-items >> nth=1').locator('li').allTextContents();
  assert.equal(weekends.length, 3);
  assert.match(weekends[1], /Practice exam A.*Opens after Review: mornings 5 to 8/);
  const others = await page.locator('.block:not(.is-current) .block-line').allTextContents();
  assert.equal(others.length, 3);
  assert.ok(others.every((line) => /^Being built\./.test(line)), others.join(' | '));
});

await check('A morning opens from Plan; a review morning has a quiz of up to 30 and ends with the weekly reflection', async () => {
  await page.click('.plan-item:has-text("Review: mornings 1 to 4")');
  await page.waitForSelector('.morning');
  const steps = await page.locator('.step-line li').allTextContents();
  assert.deepEqual(steps.map((text) => text.replace(/\s+/g, ' ').trim()), ['Cards10 min', 'Quiz40 min', 'Mistakes20 min', 'Reflection20 min']);
  const run = await storedRun();
  assert.equal(run.key, 'itil-r1');
  assert.ok(run.questions.ids.length >= 8 && run.questions.ids.length <= 30, String(run.questions.ids.length));
  assert.match(await page.textContent('.morning-col .hint'), /cards left/);
  await page.click('.focus-bar button:has-text("Leave")');
  await inject({ ...run, part: 3, open: true });
  await page.reload();
  await page.waitForSelector('.morning #reflection');
  assert.equal(await page.isDisabled('.morning-foot .primary'), true);
  const text = 'I can explain the four dimensions without notes. Governance still needs notes, so next week I will draw the Value System from memory first.';
  await page.fill('#reflection', text);
  await page.click('.morning-foot .primary');
  await page.waitForSelector('.celebrate');
  await page.click('.celebrate .primary');
  const state = await getState();
  assert.equal(state.artifacts.find((row) => row.artifact_key === 'retrospective-itil-r1').evidence_text, text);
  assert.equal(state.records.log[state.records.log.length - 1].kind, 'review');
});

await check('Short morning: cards, due questions only, mistakes; it logs a line and does not complete the morning', async () => {
  await nav('Today');
  await page.click('.hero-link');
  await page.waitForSelector('.morning');
  const steps = await page.locator('.step-line li').allTextContents();
  assert.deepEqual(steps.map((text) => text.replace(/\s+/g, ' ').trim()), ['Cards8 min', 'Questions25 min', 'Mistakes10 min']);
  assert.match(await page.textContent('.focus-where'), /ITIL, short morning/);
  assert.equal(await passCards(), 'Continue to questions');
  await page.click('.morning-foot .primary');
  assert.match(await page.textContent('.quiz-meta'), /Question 1 of 8/);
  await answerAll('right', 'Sure');
  assert.match(await page.textContent('#morning-title'), /Nothing to write up/);
  await page.click('.morning-foot .primary');
  await page.waitForSelector('.celebrate');
  assert.match(await page.textContent('#celebrate-title'), /Short morning done/);
  await page.click('.celebrate .primary');
  assert.match(await page.textContent('.hero-when'), /ITIL, morning 6 of 12/);
  const state = await getState();
  assert.equal(state.progress.some((row) => row.item_key === 'itil-m5'), false);
  const log = state.records.log[state.records.log.length - 1];
  assert.equal(log.kind, 'short');
  assert.equal(log.key, 'short');
  assert.equal(log.questions, 8);
});

await context.close();

/* ------------------------------------------------------------- Learn */
context = await open();
await page.goto(`${base}/?state=midway`);
await page.waitForSelector('.hero-session');

await check('Learn: the ITIL lessons first, then the Kestrel library of 65 lessons by week', async () => {
  await nav('Learn');
  await page.waitForSelector('.lesson-library');
  assert.equal(await page.getAttribute('.segmented button:has-text("Lessons")', 'aria-selected'), 'true');
  assert.equal(await page.locator('.block-lessons li').count(), 8);
  assert.equal(await page.locator('.block-lessons .status.is-done').count(), 4);
  assert.equal(await page.locator('.lesson-weeks .week-fold').count(), 13);
  assert.equal(await page.locator('.week-lessons li').count(), 65);
});

await check('An ITIL lesson opens in the reader and moves to the next; a Kestrel lesson opens from its week', async () => {
  await page.click('.block-lessons li >> nth=2 >> button');
  await page.waitForSelector('.reader .lesson');
  assert.match(await page.textContent('.reader-head .eyebrow'), /ITIL, morning 3 of 12, done/);
  assert.equal((await page.textContent('#reader-title')).trim(), 'The four dimensions and the ITIL Value System');
  assert.equal(await page.locator('.self-check li').count(), 3);
  assert.ok(await page.locator('.read').count() >= 4);
  assert.equal(new URL(page.url()).hash, '#learn');
  await page.click('.reader-nav .next');
  assert.equal((await page.textContent('#reader-title')).trim(), 'The seven guiding principles');
  await page.click('.reader .back');
  await page.waitForSelector('.lesson-library');
  await page.click('#library-week-6 > summary');
  await page.click('#library-week-6 .week-lessons li >> nth=2 >> button');
  await page.waitForSelector('.reader .lesson');
  assert.match(await page.textContent('.reader-head .eyebrow'), /Kestrel library, week 6, Day 3/);
});

await check('Browser Back from a lesson returns to the Learn lessons', async () => {
  await page.goBack();
  await page.waitForSelector('.lesson-library');
  assert.equal(new URL(page.url()).hash, '#learn');
  assert.equal(await page.locator('.reader').count(), 0);
  await page.click('.block-lessons li >> nth=0 >> button');
  await page.waitForSelector('.reader .lesson');
  await page.reload();
  await page.waitForSelector('.reader .lesson');
  assert.equal((await page.textContent('#reader-title')).trim(), 'Value, products and services');
  await page.goBack();
  await page.waitForSelector('.lesson-library');
});

await check('Learn: exam guide, glossary search and document guide', async () => {
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

await check('Unsaved document writing is kept in the browser and restored with one quiet line', async () => {
  await page.fill('#explain', 'Grain first, then the measures. Half a thought about the sponsor.');
  await page.waitForTimeout(2300);
  await page.reload();
  await page.waitForSelector('.releases .release');
  await page.click('.releases .release >> nth=0');
  await page.click('.doc-list li >> nth=0 >> button');
  await page.waitForSelector('.doc');
  assert.equal(await page.inputValue('#explain'), 'Grain first, then the measures. Half a thought about the sponsor.');
  assert.match(await page.textContent('.restored'), /^Restored your unsaved writing from /);
  await page.click('button:has-text("Save draft")');
  await page.waitForSelector('.toast:not(.is-error)');
  assert.equal(await page.locator('.restored').count(), 0);
  assert.equal(await page.evaluate(() => Object.keys(localStorage).filter((key) => key.startsWith('tricert.draft.')).length), 0);
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
  await page.waitForSelector('.review-card');
});

await check('Practice: Today’s review first with its count and one button; then Practice exam, Flashcards, Scenarios across exams and Labs; no Timed set or Review', async () => {
  await nav('Practice');
  await page.waitForSelector('.review-card');
  assert.match(await page.textContent('.review-card h2'), /7 cards and 8 questions due/);
  assert.equal(await page.locator('.practice .primary').count(), 1);
  assert.equal((await page.textContent('.review-card .play')).trim(), 'Start review');
  const rows = (await page.locator('.practice-list .row-text strong').allTextContents()).map((text) => text.trim());
  assert.deepEqual(rows, ['Practice exam', 'Flashcards', 'Scenarios across exams', 'Labs']);
  assert.match(await page.textContent('.tile-exam small'), /Practice exam A opens when the 8 learn mornings are done\. 4 of 8 are done\./);
  const text = await page.textContent('main');
  assert.doesNotMatch(text, /Timed set|Wrong or guessed answers to go over|week \d+ of 13|readiness score/i);
});

await check('Practice exam locked: the start screen says plainly when form A opens and has no start button', async () => {
  await page.click('.tile-exam');
  await page.waitForSelector('.exam-start');
  assert.match(await page.textContent('.exam-start h1'), /Practice exam A/);
  assert.match(await page.textContent('.exam-locked'), /Not open yet\. Practice exam A opens when the 8 learn mornings are done/);
  assert.equal(await page.locator('.exam-start .play').count(), 0);
  await page.click('.exam-start .back');
  await page.waitForSelector('.review-card');
});

await check('Flashcards browse the cards of the exams he has started (ITIL only)', async () => {
  await page.click('.tile-cards');
  await page.waitForSelector('.flash-card');
  assert.equal(await page.locator('.pills').count(), 0);
  assert.match(await page.textContent('.flash-cert'), /^ITIL V5, card 1 of \d+$/);
  await page.click('.flash-card');
  await page.waitForSelector('.flash-a');
  await page.click('.flash .back');
});

await check('Scenarios across exams: keyboard B + Enter shows the sheet; Enter continues; nothing is saved', async () => {
  let puts = 0;
  const count = (request) => { if (request.method() === 'PUT') puts += 1; };
  page.on('request', count);
  await page.click('.tile-cross');
  await page.waitForSelector('.quiz');
  assert.match(await page.textContent('.quiz-run'), /Scenarios across exams, counts toward nothing/);
  assert.match(await page.textContent('.quiz-count'), /^1\/88$/);
  assert.equal(await page.locator('.sure').count(), 0);
  await page.keyboard.press('b');
  await page.keyboard.press('Enter');
  await page.waitForSelector('.sheet');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => /^2\/88$/.test(document.querySelector('.quiz-count')?.textContent || ''));
  await page.click('.quiz .close');
  await page.waitForSelector('.toast');
  page.off('request', count);
  assert.equal(puts, 0);
});

await check('Progress: the four Ready to book checks with their details, an empty exam history, the delayed-review score and other exams; Portfolio and #portfolio work', async () => {
  await nav('Progress');
  await page.waitForSelector('.book-checks');
  assert.match(await page.textContent('.progress .lede'), /^ITIL: 0 of 4 checks met\. Book when all four are met\.$/);
  const checks = await page.locator('.book-checks .checklist li').allTextContents();
  assert.equal(checks.length, 4);
  assert.match(checks[0], /Every learn morning done.*Not yet\. 4 of 8 learn mornings done\./);
  assert.match(checks[1], /Two practice exams at 80% or more.*No practice exam yet/);
  assert.match(checks[2], /No weak area.*Checked once two practice exams pass\./);
  assert.match(checks[3], /Delayed reviews at 80% or more.*Not enough reviews yet: 6 of 20/);
  assert.equal(await page.locator('.booking-list').count(), 0);
  assert.match(await page.textContent('.empty-line'), /No practice exam yet\. Practice exam A opens when/);
  assert.match(await page.textContent('.delayed-score'), /6\s*of 20 answers needed/);
  assert.deepEqual((await page.locator('.other-exams .pi-state').allTextContents()), ['Being built', 'Being built', 'Being built']);
  assert.equal(await page.locator('.cert-scores, .gate-checks, .parts').count(), 0);
  assert.doesNotMatch(await page.textContent('main'), /gate|week \d+, day|Coverage|out of 100/i);
  await page.click('.segmented button:has-text("Portfolio")');
  assert.equal(new URL(page.url()).hash, '#portfolio');
  await page.reload();
  await page.waitForSelector('.checklist.interactive');
});

await check('Errors show as an alert and the card stays on screen', async () => {
  await page.goto(`${base}/?state=midway`);
  await page.waitForSelector('.hero-session');
  await page.click('.hero-session .play');
  await page.click('.morning-foot .primary');
  await page.waitForSelector('.m-card-back');
  await page.evaluate(() => {
    const original = window.fetch;
    window.fetch = async (input, init) => (init && init.method === 'PUT' ? new Response(JSON.stringify({ error: 'Database unavailable.' }), { status: 500, headers: { 'Content-Type': 'application/json' } }) : original(input, init));
  });
  await page.click('.morning-foot button:text-is("Good")');
  await page.waitForSelector('.toast.is-error');
  assert.equal(await page.getAttribute('.toast.is-error', 'role'), 'alert');
  assert.match(await page.textContent('.toast.is-error'), /Database unavailable/);
  assert.equal(await page.locator('.m-card-back').count(), 1);
  await page.keyboard.press('Escape');
  await page.waitForSelector('.morning', { state: 'detached' });
  await page.waitForFunction(() => document.activeElement?.matches('.hero-session .play'));
});
await context.close();

/* ------------------------------------------------------ Today's review */
context = await open();
await page.goto(`${base}/?state=midway&keep=1`);
await page.waitForSelector('.hero-session');

await check('Today’s review runs cards, then questions, then mistakes, with no lesson; it logs a line and completes no morning', async () => {
  await page.click('.waiting .row:has-text("due for review")');
  await page.waitForSelector('.review-card .play');
  await page.click('.review-card .play');
  await page.waitForSelector('.morning');
  assert.match(await page.textContent('.focus-where'), /Today’s review/);
  assert.deepEqual((await page.locator('.step-name').allTextContents()), ['Cards', 'Questions', 'Mistakes']);
  assert.equal(await passCards(), 'Continue to questions');
  await page.click('.morning-foot .primary');
  await page.waitForSelector('.q-head');
  assert.equal((await storedRun()).questions.ids.length, 8);
  await answerAll('right', 'Sure');
  assert.match(await page.textContent('#morning-title'), /Nothing to write up/);
  assert.equal(await mainLabel(), 'Finish review');
  await page.click('.morning-foot .primary');
  await page.waitForSelector('.celebrate');
  assert.match(await page.textContent('#celebrate-title'), /Review done/);
  await page.click('.celebrate .primary');
  const state = await getState();
  assert.ok(state.records.log.some((row) => row.key === 'due-review' && row.kind === 'due' && row.questions === 8));
  assert.equal(state.progress.filter((row) => row.status === 'complete').length, 6);
  await page.waitForSelector('.review-card.is-done');
  assert.match(await page.textContent('.review-card h2'), /Nothing due today/);
  assert.equal(await page.locator('.practice .primary').count(), 0);
});
await context.close();

/* ------------------------------------------------------ practice exam */
const examRun = () => page.evaluate(() => JSON.parse(localStorage.getItem('tricert.exam.v1') || 'null'));
const clockSeconds = async () => { const [m, sec] = (await page.getAttribute('.exam-clock', 'aria-label')).replace(' left', '').split(':').map(Number); return m * 60 + sec; };
async function pick(kind = 'right') {
  const run = await examRun();
  const id = run.ids[run.index];
  const correct = correctOf.get(id);
  const letter = kind === 'wrong' ? ['A', 'B', 'C', 'D'].find((key) => key !== correct) : correct;
  await page.click(`.exam .answer:has(input[value="${letter}"])`);
  return id;
}
async function moveStart(secondsAgo) {
  await page.evaluate((ago) => {
    const run = JSON.parse(localStorage.getItem('tricert.exam.v1'));
    run.startedAt = Date.now() - ago * 1000;
    localStorage.setItem('tricert.exam.v1', JSON.stringify(run));
  }, secondsAgo);
}

context = await open();
await page.goto(`${base}/?state=ready&keep=1&today=2026-11-21`);
await page.waitForSelector('.hero-session');
let examIds = [];

await check('A practice exam weekend block opens the practice exam: its start screen says what it is, with one button', async () => {
  assert.match(await page.textContent('.hero-when'), /ITIL, weekend block 2 of 3/);
  assert.equal((await page.textContent('#session-title')).trim(), 'Practice exam A');
  assert.equal((await page.textContent('.hero-session .play')).trim(), 'Start practice exam');
  await page.click('.hero-session .play');
  await page.waitForSelector('.exam-start');
  assert.equal(new URL(page.url()).hash, '#practice');
  assert.match(await page.textContent('#exam-start-title'), /40 questions, 60 minutes/);
  const rules = await page.textContent('.exam-rules');
  assert.match(rules, /No feedback until the end/);
  assert.match(rules, /Unanswered questions count as wrong\. At 00:00 the exam finishes by itself\./);
  assert.match(rules, /flag a question, go back, and jump/);
  assert.equal(await page.locator('.exam-start .primary').count(), 1);
});

await check('The exam: question n of N, the clock counting down, answers with no feedback, Flag, Previous and Next, and the question list to jump', async () => {
  await page.click('.exam-start .play');
  await page.waitForSelector('.exam .q-head');
  await page.waitForFunction(() => document.activeElement?.closest('.exam'));
  assert.equal(await page.evaluate(() => document.querySelector('.app').inert), true);
  assert.match(await page.textContent('.exam .quiz-meta'), /Question 1 of 40/);
  const first = await clockSeconds();
  assert.ok(first <= 3600 && first > 3590, `clock ${first}`);
  await page.waitForTimeout(2100);
  assert.ok((await clockSeconds()) < first, 'the clock counts down');
  examIds = (await examRun()).ids;
  assert.equal(examIds.length, 40);
  assert.equal((await examRun()).form, 'A');
  const one = await pick('right');
  assert.equal(await page.locator('.exam .sheet, .exam .is-right, .exam .is-wrong').count(), 0);
  await page.click('.flag-toggle');
  assert.equal(await page.getAttribute('.flag-toggle', 'aria-pressed'), 'true');
  assert.equal(await page.locator('.morning-foot .secondary').count(), 0);
  await page.click('.morning-foot .primary');
  await page.waitForFunction(() => /Question 2 of 40/.test(document.querySelector('.exam .quiz-meta')?.textContent || ''));
  await pick('wrong');
  await page.click('.morning-foot .secondary');
  await page.waitForFunction(() => /Question 1 of 40/.test(document.querySelector('.exam .quiz-meta')?.textContent || ''));
  assert.equal(await page.locator(`.exam .answer.is-picked input[value="${correctOf.get(one)}"]`).count(), 1);
  assert.match(await page.textContent('.exam-count'), /2\/40 answered, 1 flagged/);
  await page.click('.exam-tools .ghost:has-text("Questions")');
  await page.waitForSelector('.exam-list');
  assert.equal(await page.locator('.exam-cell').count(), 40);
  assert.equal(await page.getAttribute('.exam-cell >> nth=0', 'aria-label'), 'Question 1, answered, flagged');
  assert.equal(await page.getAttribute('.exam-cell >> nth=2', 'aria-label'), 'Question 3, unanswered');
  await page.click('.exam-cell >> nth=4');
  await page.waitForFunction(() => /Question 5 of 40/.test(document.querySelector('.exam .quiz-meta')?.textContent || ''));
  await pick('right');
});

await check('Finish exam asks first and says how many questions are unanswered; Keep going returns to the question', async () => {
  await page.click('.exam-tools .ghost:has-text("Finish exam")');
  await page.waitForSelector('#exam-title:text("Finish the exam?")');
  assert.match(await page.textContent('.exam .lede'), /37 of 40 questions are unanswered\. They count as wrong\. 1 is flagged\./);
  await page.click('.morning-foot .secondary');
  await page.waitForSelector('.exam .q-head');
  assert.match(await page.textContent('.exam .quiz-meta'), /Question 5 of 40/);
});

await check('A reload during the exam returns to it with the clock still running from the start time', async () => {
  await moveStart(10 * 60);
  await page.reload();
  await page.waitForSelector('.exam .q-head');
  assert.match(await page.textContent('.exam .restored'), /The clock kept running/);
  const left = await clockSeconds();
  assert.ok(left <= 50 * 60 && left > 50 * 60 - 15, `clock ${left}`);
  assert.match(await page.textContent('.exam-count'), /3\/40 answered/);
  await page.click('.focus-bar .ghost');
  await page.waitForSelector('.exam', { state: 'detached' });
  assert.match(await page.textContent('.live-pill'), /Back to your practice exam/);
  await page.click('.live-pill');
  await page.waitForSelector('.exam .q-head');
});

await check('At 00:00 the exam finishes by itself; unanswered questions are wrong; the result shows the score against the target, by area and every question', async () => {
  await moveStart(60 * 60 - 3);
  await page.reload();
  await page.waitForSelector('.exam .q-head');
  await page.waitForSelector('.exam-result', { timeout: 10000 });
  assert.equal(await page.locator('.exam').count(), 0);
  assert.match(await page.textContent('.exam-result h1'), /^2 of 40, 5%$/);
  assert.match(await page.textContent('.exam-result .lede'), /Your target is 80%\. That is 30 more right answers\. 37 unanswered questions count as wrong\./);
  assert.equal(await page.locator('.result-areas li').count(), 6);
  assert.equal(await page.locator('.exam-review > li').count(), 40);
  assert.equal(await page.locator('.exam-review .mark:text-is("Unanswered")').count(), 37);
  assert.equal(await page.locator('.exam-review .mark:text-is("Wrong")').count(), 1);
  assert.match(await page.textContent('.exam-review > li >> nth=0'), /Your answer.*Question 1|Right.*Your answer/s);
  assert.match(await page.textContent('.exam-review > li >> nth=1'), /Your answer.*Right answer/s);
  await page.waitForFunction(() => !localStorage.getItem('tricert.exam.v1'));
  assert.equal(await page.locator('.exam-unsaved').count(), 0);
});

await check('The result is saved: the mocks record with his answers, the review schedules, the weekend block and a log line; form B waits for the repair mornings and 7 days', async () => {
  const state = await getState();
  assert.equal(state.records.mocks.length, 1);
  const mock = state.records.mocks[0];
  assert.equal(mock.form, 'A');
  assert.equal(mock.exam, 'ITIL');
  assert.equal(mock.date, '2026-11-21');
  assert.equal(mock.total, 40);
  assert.equal(mock.right, 2);
  assert.equal(mock.areas.length, 6);
  assert.deepEqual(mock.ids, examIds);
  assert.equal(Object.keys(mock.answers).length, 3);
  const unanswered = examIds.find((id) => !mock.answers[id]);
  assert.equal(state.records.srs.questions[unanswered].due, '2026-11-23');
  assert.ok(state.progress.some((row) => row.item_key === 'itil-w2' && row.status === 'complete'));
  assert.ok(state.records.log.some((row) => row.key === 'itil-w2' && row.kind === 'mock' && row.right === 2));
  await page.click('.exam-result .back');
  await page.click('.tile-exam');
  await page.waitForSelector('.exam-start');
  assert.match(await page.textContent('.exam-start h1'), /Practice exam B/);
  // B waits for the two repair mornings and 7 days after A, the same on Plan, Today and here.
  assert.match(await page.textContent('.exam-locked'), /Practice exam B opens after Repair: your second weakest area and on Nov\.? 28, 2026, 7 days after exam A\./);
  assert.match(await page.textContent('.exam-last'), /Your last result: Practice exam A/);
  await nav('Progress');
  assert.match(await page.textContent('.history'), /Practice exam A.*5%.*2 of 40/s);
});

await check('Spaced review: the questions of a practice exam come due two days later', async () => {
  await page.goto(`${base}/?state=ready&keep=1&today=2026-11-23`);
  await page.waitForSelector('.hero-session');
  await nav('Practice');
  const due = Number((await page.textContent('.review-card h2')).match(/(\d+) questions due/)[1]);
  assert.ok(due >= 38, `${due} due`);
});
await context.close();

context = await open();
await check('If the time ran out while the page was closed, the exam finishes as it loads', async () => {
  await page.goto(`${base}/?state=ready&keep=1`);
  await page.waitForSelector('.hero-session');
  await nav('Practice');
  await page.click('.tile-exam');
  await page.click('.exam-start .play');
  await page.waitForSelector('.exam .q-head');
  await pick('right');
  await moveStart(61 * 60);
  await page.reload();
  await page.waitForSelector('.exam-result');
  assert.equal(await page.locator('.exam').count(), 0);
  assert.match(await page.textContent('.exam-result h1'), /^1 of 40, 2\.5%$/);
  await page.waitForFunction(async () => (await (await fetch('/api/state')).json()).records.mocks.length === 1);
});
await context.close();

/* ------------------------------------------------------ ready to book */
context = await open();
await check('Ready to book: all four checks met shows the booking checklist; the history opens a past result; the next practice exam is a new draw', async () => {
  await page.goto(`${base}/?state=booked#progress`);
  await page.waitForSelector('.book-checks');
  assert.match(await page.textContent('.progress .lede'), /ITIL: all four checks are met\. You are ready to book\./);
  assert.equal(await page.locator('.book-checks .tick.is-done').count(), 4);
  assert.equal(await page.locator('.booking-list li').count(), 6);
  assert.match(await page.textContent('.booking-list'), /US\$690.*Take2.*48 hours.*65%/s);
  assert.deepEqual((await page.locator('.history .row-text strong').allTextContents()), ['Practice exam B', 'Practice exam A']);
  assert.match(await page.textContent('.delayed-score'), /88%\s*23 of 26 right/);
  await page.click('.history .row >> nth=1');
  await page.waitForSelector('.exam-result');
  assert.match(await page.textContent('.exam-result h1'), /^34 of 40, 85%$/);
  assert.match(await page.textContent('.exam-result .lede'), /At or above your target of 80%/);
  await page.click('.exam-result .back');
  await page.click('.tile-exam');
  assert.match(await page.textContent('.exam-start h1'), /Practice exam, new draw/);
  assert.equal(await page.locator('.exam-start .play').count(), 1);
});
await context.close();

/* ------------------------------------------------------------- setup */
context = await open();

await check('Setup: three steps create the plan with its start date; Today opens on ITIL morning 1', async () => {
  await page.goto(`${base}/?state=fresh`);
  await page.waitForSelector('.onboard-form');
  assert.equal(await page.locator('.steps-bar span').count(), 3);
  await page.fill('#displayName', 'Sam Rivera');
  await page.fill('#motivation', 'Move into security architecture.');
  await page.click('button:has-text("Continue")');
  await page.selectOption('#education', 'associate');
  await page.fill('#pmMonths', '40');
  await page.fill('#cyberMonths', '12');
  await page.click('.tickbox');
  await page.click('button:has-text("Continue")');
  assert.equal(await page.inputValue('#startDate'), '2026-11-18');
  await page.fill('#startDate', '2026-11-23');
  await page.click('button:has-text("Create my plan")');
  await page.waitForSelector('.hero-session');
  await page.waitForFunction(async () => (await (await fetch('/api/state')).json()).records.plan.startDate === '2026-11-23');
  assert.match(await page.textContent('.hero-when'), /ITIL, morning 1 of 12/);
  assert.equal((await page.textContent('#session-title')).trim(), 'Value, products and services');
  assert.match(await page.textContent('.hero-sub'), /Brief from Janelle Cardinal/);
  const state = await getState();
  assert.deepEqual(state.records.plan, { startDate: '2026-11-23' });
  assert.equal(state.profile.education, 'associate');
  assert.equal(state.profile.pm_months, 40);
  assert.equal(state.profile.cyber_months, 12);
  assert.equal(state.profile.pm_training_complete, 1);
  assert.equal(state.profile.pm_training_hours, 35);
  assert.equal(state.profile.itil_level, 'beginner');
  await nav('Plan');
  assert.match(await page.textContent('.plan .lede'), /your start date, Nov\.? 23, 2026/);
  await nav('Today');
  assert.match(await page.textContent('.hello h1'), /, Sam$/);
  assert.match(await page.textContent('.why'), /security architecture/);
  assert.equal(await page.textContent('.me .avatar'), 'SR');
});

await check('Make it yours: colour and appearance apply at once; name and why save', async () => {
  await page.click('.me');
  await page.waitForSelector('.yours');
  await page.waitForFunction(() => document.activeElement?.id === 'yours-name');
  assert.equal(await page.evaluate(() => document.querySelector('.app').inert), true);
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
  await page.waitForFunction(() => document.activeElement?.matches('.me'));
  assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), 'light');
  await page.reload();
  await page.waitForSelector('.onboard-form, .hero-session');
  assert.equal(await page.evaluate(() => document.documentElement.dataset.accent), 'glacier');
});
await context.close();

/* ------------------------------------------------------------- phone */
context = await open({ width: 390, height: 844 });

await check('Phone: Today, a morning, Plan and Learn fit 390px with 44px targets', async () => {
  const fits = async (where) => assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= 390), `${where} scrolls sideways`);
  const tall = async (selector) => { const box = await page.locator(selector).first().boundingBox(); assert.ok(box && box.height >= 43.5, `${selector} is ${box?.height}px`); };
  await page.goto(`${base}/?state=midway`);
  await page.waitForSelector('.hero-session');
  await fits('Today');
  await tall('.hero-session .play');
  await tall('.hero-link');
  await page.click('.hero-session .play');
  await page.waitForSelector('.morning');
  await fits('Cards');
  await tall('.morning-foot .primary');
  await tall('.focus-bar .ghost');
  await page.click('.morning-foot .primary');
  await tall('.morning-foot .secondary');
  assert.ok(await page.evaluate(() => [...document.querySelectorAll('.step-line li')].every((item) => item.getBoundingClientRect().right <= 390)));
  await page.click('.focus-bar .ghost');
  await page.click('.nav button:has(.nav-label:text-is("Plan"))');
  await page.waitForSelector('.blocks');
  await fits('Plan');
  await tall('.plan-item');
  await page.click('.nav button:has(.nav-label:text-is("Learn"))');
  await page.waitForSelector('.lesson-library');
  await fits('Learn');
  await tall('.block-lessons .row');
  await tall('.segmented button');
});

await check('Phone: Practice, the practice exam, its result and Progress fit 390px with 44px targets', async () => {
  const fits = async (where) => assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= 390), `${where} scrolls sideways`);
  const tall = async (selector) => { const box = await page.locator(selector).first().boundingBox(); assert.ok(box && box.height >= 43.5, `${selector} is ${box?.height}px`); };
  await page.goto(`${base}/?state=ready`);
  await page.waitForSelector('.hero-session');
  await page.click('.nav button:has(.nav-label:text-is("Practice"))');
  await page.waitForSelector('.review-card');
  await fits('Practice');
  await tall('.review-card .play');
  await tall('.practice-list .row');
  await page.click('.tile-exam');
  await fits('Practice exam start');
  await tall('.exam-start .play');
  await page.click('.exam-start .play');
  await page.waitForSelector('.exam .q-head');
  await fits('Practice exam');
  await tall('.flag-toggle');
  await tall('.exam-tools .ghost');
  await tall('.morning-foot .primary');
  await tall('.focus-bar .ghost');
  assert.ok(await page.evaluate(() => document.querySelector('.exam-bar').getBoundingClientRect().height < 60), 'the exam bar stays on one line');
  await page.click('.exam-tools .ghost:has-text("Questions")');
  await tall('.exam-cell');
  await fits('Question list');
  await page.click('.exam-tools .ghost:has-text("Finish exam")');
  await page.click('.morning-foot .primary');
  await page.waitForSelector('.exam-result');
  await fits('Result');
  await page.click('.nav button:has(.nav-label:text-is("Progress"))');
  await page.waitForSelector('.book-checks');
  await fits('Progress');
});
await context.close();

assert.deepEqual(errors, [], `console errors: ${errors.join(' | ')}`);
console.log(`\n${passed} flow checks passed, no console errors`);
await browser.close();
server.close();
