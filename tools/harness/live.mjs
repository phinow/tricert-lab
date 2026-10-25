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
  assert.match(family, /Bricolage Grotesque/);
  await page.evaluate(() => document.fonts.ready);
  assert.equal(await page.evaluate(() => document.fonts.check('16px "Bricolage Grotesque"')), true);
  const note = await page.evaluate(() => getComputedStyle(document.querySelector('.onboard-note')).fontFamily);
  assert.match(note, /Literata/);
  await page.screenshot({ path: path.join(shots, 'live-onboarding.png'), fullPage: true });
});

await check('Creating the profile writes to D1 and lands on Home, Week 1', async () => {
  await page.fill('#displayName', 'Moye');
  await page.fill('#motivation', 'Four certifications, one programme.');
  await page.click('button:has-text("Continue")');
  await page.fill('input[name="pmMonths"]', '22');
  await page.fill('input[name="pmTrainingHours"]', '35');
  await page.click('.tickbox');
  await page.click('button:has-text("Continue")');
  await page.fill('input[name="cyberMonths"]', '30');
  await page.click('.chip:has-text("Identity & access")');
  await page.click('.chip:has-text("Security operations")');
  await page.click('button:has-text("Continue")');
  await page.selectOption('select[name="powerBiLevel"]', 'intermediate');
  await page.click('button:has-text("Continue")');
  await page.fill('#pl300Target', '2026-12-10');
  await page.click('button:has-text("Create my plan")');
  await page.waitForSelector('.hero-session');
  assert.match(await page.textContent('.hero-when'), /Week 1, Day 1/);
  const state = await (await fetch(`${base}/api/state`)).json();
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
  assert.equal(after.profile.display_name.length, 40);
  assert.equal(after.profile.motivation.length, 140);
  await fetch(`${base}/api/state`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'save-personal', displayName: 'Moye', motivation: 'Lead the projects I used to support.' }) });
  await page.click('.me');
  await page.click('.swatch:has-text("Beacon")');
  await page.keyboard.press('Escape');
  await page.reload();
  await page.waitForSelector('.hero-session');
});

await check('Completing five sessions moves the current week to 2 after a full reload', async () => {
  for (let i = 0; i < 5; i += 1) {
    await page.click('.hero-actions .ghost');
    await page.waitForSelector('.celebrate');
    await page.click('.celebrate .primary');
    await page.waitForFunction((n) => document.querySelectorAll('.days .day-mark.is-done').length === n, i + 1);
  }
  await page.reload();
  await page.waitForSelector('.hero-session');
  assert.match(await page.textContent('.hero-when'), /Week 2, Day 1/);
  const state = await (await fetch(`${base}/api/state`)).json();
  assert.equal(state.progress.filter((row) => row.status === 'complete').length, 5);
  await page.screenshot({ path: path.join(shots, 'live-home.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: path.join(shots, 'live-home-phone.png') });
  await page.setViewportSize({ width: 1440, height: 900 });
});

await check('Artifact draft persists in D1 and reopens on reload', async () => {
  await page.click('.nav button:has(.nav-label:text-is("Project"))');
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

await check('Scenario attempt is recorded and shows in the review queue', async () => {
  await page.click('.nav button:has(.nav-label:text-is("Practice"))');
  await page.click('.tile-scenarios');
  await page.waitForSelector('.quiz');
  await page.click('.answer >> nth=0');
  await page.click('.sure label:has-text("Guessing")');
  await page.click('button:has-text("Check")');
  await page.waitForSelector('.sheet');
  await page.click('.quiz .close');
  await page.click('.tile-review');
  await page.waitForSelector('.review-list li');
  const state = await (await fetch(`${base}/api/state`)).json();
  assert.equal(state.attempts.length, 1);
  await page.screenshot({ path: path.join(shots, 'live-review.png'), fullPage: true });
});

assert.deepEqual(errors, [], `console errors: ${errors.join(' | ')}`);
console.log(`\n${passed} live checks passed against the real server, no console errors`);
await browser.close();
