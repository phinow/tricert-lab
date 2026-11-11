// Drive the real dev server (vinext + local D1) end to end and screenshot it.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const base = 'http://localhost:3000';
const here = path.dirname(new URL(import.meta.url).pathname);
const shots = path.join(here, 'shots', 'live');
await mkdir(shots, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
// The study dates come from the browser; fix today so the run does not depend on the calendar.
await context.addInitScript(() => { window.__tricertToday = '2026-11-18'; });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });

let passed = 0;
async function check(name, fn) { await fn(); passed += 1; console.log(`ok - ${name}`); }

await check('Fresh database shows onboarding, with the self-hosted font applied', async () => {
  await page.goto(base);
  await page.waitForSelector('.onboard-form');
  const family = await page.evaluate(() => getComputedStyle(document.querySelector('h2')).fontFamily);
  assert.match(family, /^Geist,/);
  await page.evaluate(() => document.fonts.ready);
  assert.equal(await page.evaluate(() => document.fonts.check('600 16px "Geist"')), true);
  const note = await page.evaluate(() => getComputedStyle(document.querySelector('.onboard-note')).fontFamily);
  assert.match(note, /^Geist,/);
  await page.screenshot({ path: path.join(shots, 'live-onboarding.png'), fullPage: true });
});

await check('Setup writes the profile and the start date to D1 and lands on ITIL morning 1', async () => {
  await page.fill('#displayName', 'Moye');
  await page.fill('#motivation', 'Four certifications, one programme.');
  await page.click('button:has-text("Continue")');
  await page.fill('input[name="pmMonths"]', '22');
  await page.fill('input[name="cyberMonths"]', '30');
  await page.click('.tickbox');
  await page.click('button:has-text("Continue")');
  await page.fill('#startDate', '2026-11-16');
  await page.click('button:has-text("Create my plan")');
  await page.waitForSelector('.hero-session');
  assert.match(await page.textContent('.hero-when'), /ITIL, morning 1 of 12/);
  let state = await (await fetch(`${base}/api/state`)).json();
  for (let wait = 0; wait < 50 && state.records.plan.startDate !== '2026-11-16'; wait += 1) { await page.waitForTimeout(100); state = await (await fetch(`${base}/api/state`)).json(); }
  assert.equal(state.records.plan.startDate, '2026-11-16');
  assert.equal(state.profile.pm_months, 22);
  assert.equal(state.profile.pm_training_complete, 1);
  assert.equal(state.profile.display_name, 'Moye');
  assert.match(await page.textContent('.hello h1'), /, Moye$/);
});

await check('Make it yours saves name and why to D1; colour stays on the device', async () => {
  await page.click('.me');
  await page.fill('#yours-name', 'Moye A');
  await page.fill('#yours-why', 'Lead the projects I used to support.');
  await page.click('.swatch:has-text("Wild rose")');
  await page.click('.yours .primary');
  await page.waitForSelector('.yours', { state: 'detached' });
  const state = await (await fetch(`${base}/api/state`)).json();
  assert.equal(state.profile.display_name, 'Moye A');
  assert.equal(state.profile.motivation, 'Lead the projects I used to support.');
  await page.reload();
  await page.waitForSelector('.hero-session');
  assert.equal(await page.evaluate(() => document.documentElement.dataset.accent), 'rose');
  assert.equal(await page.textContent('.me .avatar'), 'MA');
  const bad = await fetch(`${base}/api/state`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'save-personal', displayName: 'x'.repeat(90), motivation: 'y'.repeat(400) }) });
  const after = await bad.json();
  assert.equal(bad.status, 400);
  assert.match(after.error, /Your name is 90 characters, over the limit of 40/);
  await fetch(`${base}/api/state`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'save-personal', displayName: 'Moye', motivation: 'Lead the projects I used to support.' }) });
  await page.click('.me');
  await page.click('.swatch:has-text("Beacon")');
  await page.keyboard.press('Escape');
  await page.reload();
  await page.waitForSelector('.hero-session');
});

await check('A whole morning saves cards, answers, progress and the log to D1; Today moves to morning 2 after a reload', async () => {
  await page.click('.hero-session .play');
  await page.waitForSelector('.morning');
  for (let step = 0; step < 60; step += 1) {
    const label = (await page.textContent('.morning-foot .primary')).trim();
    if (label === 'Show answer') { await page.click('.morning-foot .primary'); await page.waitForSelector('.m-card-back'); continue; }
    if (label === 'Good') { await page.click('.morning-foot .primary'); await page.waitForSelector('.m-card-back', { state: 'detached' }); continue; }
    break;
  }
  await page.click('.morning-foot .primary'); // to Learn
  await page.click('.morning-foot .primary'); // the lesson
  await page.waitForSelector('.morning .lesson');
  await page.click('.morning-foot .primary'); // the step
  await page.fill('#build-answer', 'Outputs: the dashboard. Outcomes: decisions made at the 08:00 meeting.');
  await page.click('.morning-foot .primary'); // recall
  await page.click('.morning-foot .primary'); // questions
  let answered = 0;
  while (await page.locator('.q-head').count()) {
    await page.click('.answer >> nth=0');
    await page.click('.sure label:has-text("Sure")');
    await page.click('.morning-foot .primary');
    await page.waitForSelector('.sheet');
    answered += 1;
    const before = await page.textContent('#morning-title');
    await page.click('.morning-foot .primary');
    await page.waitForFunction((text) => document.querySelector('#morning-title')?.textContent !== text, before);
  }
  await page.click('.morning-foot .primary'); // Finish morning
  await page.waitForSelector('.celebrate');
  await page.click('.celebrate .primary');
  await page.reload();
  await page.waitForSelector('.hero-session');
  assert.match(await page.textContent('.hero-when'), /ITIL, morning 2 of 12/);
  const state = await (await fetch(`${base}/api/state`)).json();
  assert.ok(state.progress.some((row) => row.item_key === 'itil-m1' && row.status === 'complete'));
  assert.equal(Object.keys(state.records.srs.cards).length, 8);
  assert.equal(Object.keys(state.records.srs.questions).length, answered);
  assert.equal(state.attempts.length, answered);
  assert.equal(state.records.log.length, 1);
  assert.equal(state.records.log[0].key, 'itil-m1');
  await page.screenshot({ path: path.join(shots, 'live-home.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: path.join(shots, 'live-home-phone.png') });
  await page.setViewportSize({ width: 1440, height: 900 });
});

await check('Artifact draft persists in D1 and reopens on reload', async () => {
  await page.click('.nav button:has(.nav-label:text-is("Learn"))');
  await page.click('.segmented button:has-text("Documents")');
  await page.click('.releases .release >> nth=0');
  await page.waitForSelector('.doc-list');
  await page.click('.doc-list li >> nth=1 >> button');
  await page.fill('#work', 'Coverage map draft written in the live run. '.repeat(4));
  await page.click('button:has-text("Save draft")');
  await page.waitForSelector('.toast:not(.is-error)');
  await page.reload();
  await page.waitForSelector('.doc-list');
  await page.click('.doc-list li >> nth=1 >> button');
  await page.waitForSelector('.doc');
  assert.match(await page.textContent('#doc-title'), /Exam-to-project coverage map/);
  assert.match(await page.inputValue('#work'), /Coverage map draft written in the live run/);
  assert.equal(new URL(page.url()).hash, '#projects');
  await page.screenshot({ path: path.join(shots, 'live-projects.png'), fullPage: true });
});

await check('Practice and Progress: scenarios across exams save nothing; Ready to book shows its four checks', async () => {
  const before = await (await fetch(`${base}/api/state`)).json();
  await page.click('.nav button:has(.nav-label:text-is("Practice"))');
  await page.waitForSelector('.review-card');
  await page.click('.tile-cross');
  await page.waitForSelector('.quiz');
  await page.click('.answer >> nth=0');
  await page.click('button:has-text("Check")');
  await page.waitForSelector('.sheet');
  await page.click('.quiz .close');
  await page.waitForSelector('.review-card');
  const after = await (await fetch(`${base}/api/state`)).json();
  assert.equal(after.attempts.length, before.attempts.length);
  await page.click('.tile-exam');
  await page.waitForSelector('.exam-locked');
  await page.click('.nav button:has(.nav-label:text-is("Progress"))');
  await page.waitForSelector('.book-checks');
  assert.equal(await page.locator('.book-checks .checklist li').count(), 4);
  await page.screenshot({ path: path.join(shots, 'live-progress.png'), fullPage: true });
});

assert.deepEqual(errors, [], `console errors: ${errors.join(' | ')}`);
console.log(`\n${passed} live checks passed against the real server, no console errors`);
await browser.close();
