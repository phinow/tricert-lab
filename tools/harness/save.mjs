// Checks that the hosted build (out/artifact) really saves progress.
// The claude.ai runtime is replaced by a stand-in that follows the store's own rules:
// a document path needs an even number of segments, and a document holds at most 256 KiB.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const here = path.dirname(new URL(import.meta.url).pathname);
const root = path.join(here, 'out', 'artifact');
const server = http.createServer(async (req, res) => {
  try {
    const body = await readFile(path.join(root, 'index.html'));
    res.writeHead(req.url === '/' ? 200 : 404, { 'Content-Type': 'text/html' });
    res.end(req.url === '/' ? body : '');
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((resolve) => server.listen(0, resolve));
const base = `http://localhost:${server.address().port}`;
const browser = await chromium.launch();

// One browser context is one device. Contexts given the same store share saved progress.
async function device(store, failReads = 0) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const seen = { writes: 0, badPaths: [], failReads };
  await context.exposeFunction('__storeGet', (key) => {
    if (seen.failReads > 0) { seen.failReads -= 1; throw new Error('network'); }
    return store.has(key) ? JSON.parse(store.get(key)) : null;
  });
  await context.exposeFunction('__storeSet', (key, body) => {
    const text = JSON.stringify(body);
    if (text.length > 262144) throw new Error('invalid_argument: document over 256 KiB');
    seen.writes += 1;
    store.set(key, text);
  });
  await context.exposeFunction('__badPath', (key) => { seen.badPaths.push(key); });
  await context.addInitScript(() => {
    window.claude = { use: async (name) => {
      if (name === 'user') return { id: async () => 'u_test' };
      if (name === 'downloads') return { save: async () => ({}) };
      if (name !== 'db') return null;
      return { doc(key) {
        if (key.split('/').length % 2) { window.__badPath(key); throw new TypeError(`A document path needs an even number of segments: ${key}`); }
        return {
          get: async () => { const value = await window.__storeGet(key); return { exists: value !== null, data: () => value ?? undefined }; },
          set: async (body) => { await window.__storeSet(key, body); },
        };
      } };
    } };
  });
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  return { context, page, seen };
}
const put = (page, body) => page.evaluate(async (payload) => {
  const response = await fetch('/api/state', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  return { status: response.status, data: await response.json() };
}, body);
const stored = (store) => JSON.parse([...store.values()][0]);
let checks = 0;
const ok = (name) => { checks += 1; console.log(`ok - ${name}`); };

// 1. A plan made on this device is still there after a reload.
{
  const store = new Map();
  const { context, page, seen } = await device(store);
  await page.goto(base);
  await page.waitForSelector('#displayName');
  await page.fill('#displayName', 'Tester');
  for (let step = 0; step < 4; step += 1) await page.click('button[type=submit]:has-text("Continue")');
  await page.click('button[type=submit]:has-text("Create my plan")');
  await page.waitForSelector('.hero-session');
  assert.deepEqual(seen.badPaths, [], 'the store refused the document path');
  assert.equal(store.size, 1, 'one document is saved');
  assert.equal([...store.keys()][0].split('/').length % 2, 0, 'the document path has an even number of segments');
  await page.reload();
  await page.waitForSelector('.hero-session');
  assert.equal(await page.locator('#displayName').count(), 0, 'setup does not come back after a reload');
  await context.close();
  ok('A plan is saved and survives a reload');
}

// 2. When saved progress cannot be read, nothing is written, and stored progress is kept.
{
  const store = new Map();
  const first = await device(store);
  await first.page.goto(base);
  await first.page.waitForSelector('#displayName');
  assert.equal((await put(first.page, { action: 'save-profile', displayName: 'Tester', weeklyHours: 11 })).status, 200);
  assert.equal((await put(first.page, { action: 'set-progress', itemKey: 'w1-s1', status: 'complete' })).status, 200);
  await first.context.close();

  const second = await device(store, 1);
  await second.page.goto(base);
  await second.page.waitForSelector('#displayName');
  await second.page.waitForSelector('.toast.is-error, [role=alert]');
  assert.equal(second.seen.writes, 0, 'no write while saved progress is unread');
  // Setting up again after the failed read must not wipe the stored progress.
  assert.equal((await put(second.page, { action: 'save-profile', displayName: 'Again', weeklyHours: 11 })).status, 200);
  assert.equal(stored(store).progress.length, 1, 'stored progress is kept');

  const third = await device(store, 99);
  await third.page.goto(base);
  await third.page.waitForSelector('#displayName');
  const refused = await put(third.page, { action: 'set-progress', itemKey: 'w1-s2', status: 'complete' });
  assert.equal(refused.status, 503);
  assert.equal(third.seen.writes, 0, 'no write when the store cannot be read');
  await second.context.close();
  await third.context.close();
  ok('A failed read never leads to a write, and stored progress is kept');
}

// 3. Two devices open at once do not overwrite each other.
{
  const store = new Map();
  const phone = await device(store);
  const laptop = await device(store);
  await phone.page.goto(base);
  await phone.page.waitForSelector('#displayName');
  assert.equal((await put(phone.page, { action: 'save-profile', displayName: 'Tester', weeklyHours: 11 })).status, 200);
  await laptop.page.goto(base);
  await laptop.page.waitForSelector('.hero-session');
  assert.equal((await put(phone.page, { action: 'set-progress', itemKey: 'w1-s1', status: 'complete' })).status, 200);
  assert.equal((await put(laptop.page, { action: 'set-progress', itemKey: 'w1-s2', status: 'complete' })).status, 200);
  assert.deepEqual(stored(store).progress.map((row) => row.item_key).sort(), ['w1-s1', 'w1-s2']);
  await phone.context.close();
  await laptop.context.close();
  ok('Two devices keep each other\'s progress');
}

await browser.close();
server.close();
console.log(`${checks} save checks passed`);
