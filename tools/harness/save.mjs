// Checks that the hosted build (out/artifact) really saves progress.
// The claude.ai runtime is replaced by a stand-in that follows the store's own rules:
// a document path needs an even number of segments, a collection path an odd number,
// segments use letters, digits and _ - . ~ : @ + only, and a document holds at most 256 KiB.
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
  const seen = { writes: 0, reads: 0, listings: 0, written: [], badPaths: [], failReads };
  await context.exposeFunction('__storeGet', (key) => {
    if (seen.failReads > 0) { seen.failReads -= 1; throw new Error('network'); }
    seen.reads += 1;
    return store.has(key) ? JSON.parse(store.get(key)) : null;
  });
  await context.exposeFunction('__storeList', (key) => {
    if (seen.failReads > 0) { seen.failReads -= 1; throw new Error('network'); }
    seen.listings += 1;
    const depth = key.split('/').length + 1;
    return [...store.entries()]
      .filter(([name]) => name.startsWith(`${key}/`) && name.split('/').length === depth)
      .map(([name, text]) => ({ id: name.split('/').pop(), data: JSON.parse(text) }));
  });
  await context.exposeFunction('__storeSet', (key, body) => {
    const text = JSON.stringify(body);
    if (Buffer.byteLength(text) > 262144) throw new Error('invalid_argument: document over 256 KiB');
    seen.writes += 1;
    seen.written.push(key.split('/').pop());
    store.set(key, text);
  });
  await context.exposeFunction('__badPath', (key) => { seen.badPaths.push(key); });
  await context.addInitScript(() => {
    window.claude = { use: async (name) => {
      if (name === 'user') return { id: async () => 'u_test' };
      if (name === 'downloads') return { save: async () => ({}) };
      if (name !== 'db') return null;
      const grammar = (key) => key.split('/').every((part) => /^[A-Za-z0-9_\-.~:@+]{1,200}$/.test(part) && part !== '.' && part !== '..');
      const doc = (key) => {
        if (key.split('/').length % 2 || !grammar(key)) { window.__badPath(key); throw new TypeError(`Not a document path: ${key}`); }
        return {
          id: key.split('/').pop(),
          get: async () => { const value = await window.__storeGet(key); return { id: key.split('/').pop(), exists: value !== null, data: () => value ?? undefined }; },
          set: async (body) => { await window.__storeSet(key, body); },
        };
      };
      const collection = (key) => {
        if (key.split('/').length % 2 === 0 || !grammar(key)) { window.__badPath(key); throw new TypeError(`Not a collection path: ${key}`); }
        return {
          doc: (id) => doc(`${key}/${id}`),
          get: async () => {
            const found = await window.__storeList(key);
            const docs = found.map(({ id, data }) => ({ id, exists: true, data: () => data }));
            return { docs, size: docs.length, empty: docs.length === 0 };
          },
        };
      };
      return { doc, collection };
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
const prefix = 'data/users/u_test/';
const stored = (store, name = 'state') => (store.has(prefix + name) ? JSON.parse(store.get(prefix + name)) : null);
const getState = (page) => page.evaluate(async () => (await fetch('/api/state')).json());
let checks = 0;
const ok = (name) => { checks += 1; console.log(`ok - ${name}`); };

// 1. A plan made on this device is still there after a reload.
{
  const store = new Map();
  const { context, page, seen } = await device(store);
  await page.goto(base);
  await page.waitForSelector('#displayName');
  await page.fill('#displayName', 'Tester');
  // Setup has three steps; the last one saves the start date in the plan record.
  for (let step = 0; step < 2; step += 1) await page.click('button[type=submit]:has-text("Continue")');
  await page.click('button[type=submit]:has-text("Create my plan")');
  await page.waitForSelector('.hero-session');
  for (let wait = 0; wait < 50 && !store.has(`${prefix}rec-plan`); wait += 1) await page.waitForTimeout(100);
  assert.deepEqual(seen.badPaths, [], 'the store refused the document path');
  assert.deepEqual([...store.keys()].sort(), [`${prefix}rec-plan`, `${prefix}state`], 'the profile is saved in the state document and the start date in the plan record');
  assert.match(stored(store, 'rec-plan').value.startDate, /^\d{4}-\d{2}-\d{2}$/);
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
  assert.equal(stored(store).profile.display_name, 'Again');

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

// 4. A morning's records survive a reload, with the merge rules of patch-record and append-record.
{
  const store = new Map();
  const { context, page, seen } = await device(store);
  await page.goto(base);
  await page.waitForSelector('#displayName');
  assert.equal((await put(page, { action: 'save-profile', displayName: 'Tester', weeklyHours: 11 })).status, 200);
  const steps = [
    { action: 'patch-record', key: 'plan', patch: { startDate: '2026-11-16' } },
    { action: 'patch-record', key: 'srs', patch: { cards: { 'card:a1': { stage: 1, due: '2026-11-17' }, 'card:b2': { stage: 0, due: '2026-11-17' } } } },
    { action: 'patch-record', key: 'srs', patch: { cards: { 'card:a1': { stage: 2 }, 'card:b2': null }, questions: { 'q-itil-025': { stage: 0, due: '2026-11-18', last: '2026-11-16' } } } },
    { action: 'append-record', key: 'log', item: { id: 'itil-m1', key: 'itil-m1', kind: 'learn', date: '2026-11-16', minutes: 88, cards: 8, questions: 20, right: 14 } },
    { action: 'append-record', key: 'usercards', item: { id: 'u1', front: 'Utility', back: 'Fit for purpose' } },
    { action: 'append-record', key: 'usercards', item: { id: 'u1', front: 'Utility', back: 'What the service does: fit for purpose' } },
    { action: 'append-record', key: 'mocks', item: { id: 'mockA-1', form: 'A', score: 82, answers: { 'q-itil-065': 'B' } } },
    { action: 'record-attempt', questionId: 'q-itil-025', certification: 'ITIL', domain: 'Value', answer: 'A', correct: false, confidence: 'low' },
    { action: 'record-attempt', questionId: 'q-itil-025', certification: 'ITIL', domain: 'Value', answer: 'B', correct: true, confidence: 'high' },
    { action: 'set-progress', itemKey: 'itil-m1', status: 'complete' },
  ];
  for (const body of steps) assert.equal((await put(page, body)).status, 200, `${body.action} ${body.key || ''}`);
  await page.reload();
  await page.waitForSelector('.hero-session');
  const state = await getState(page);
  assert.deepEqual(state.records.plan, { startDate: '2026-11-16' });
  assert.deepEqual(state.records.srs.cards, { 'card:a1': { stage: 2, due: '2026-11-17' } }, 'cards merge three levels deep and null removes a card');
  assert.deepEqual(Object.keys(state.records.srs.questions), ['q-itil-025']);
  assert.equal(state.records.log.length, 1);
  assert.equal(state.records.log[0].right, 14);
  assert.equal(state.records.usercards.length, 1, 'an item with the same id is replaced');
  assert.match(state.records.usercards[0].back, /What the service does/);
  assert.equal(state.records.mocks[0].score, 82);
  assert.equal(state.attempts.length, 1, 'one row per question');
  assert.equal(state.attempts[0].answer, 'B');
  assert.equal(state.attempts[0].tries, 2);
  assert.ok(state.progress.some((row) => row.item_key === 'itil-m1' && row.status === 'complete'));
  const names = [...store.keys()].map((key) => key.slice(prefix.length)).sort();
  assert.deepEqual(names, ['attempts', 'rec-log', 'rec-mocks', 'rec-plan', 'rec-srs', 'rec-usercards', 'state']);
  assert.deepEqual(seen.badPaths, []);
  // A save writes only the document it changes.
  const before = seen.written.length;
  assert.equal((await put(page, { action: 'patch-record', key: 'srs', patch: { cards: { 'card:c3': { stage: 0, due: '2026-11-18' } } } })).status, 200);
  assert.deepEqual(seen.written.slice(before), ['rec-srs']);
  // Empty defaults on a new learner.
  const fresh = await device(new Map());
  await fresh.page.goto(base);
  await fresh.page.waitForSelector('#displayName');
  assert.deepEqual((await getState(fresh.page)).records, { plan: {}, srs: { cards: {}, questions: {} }, mocks: [], log: [], usercards: [] });
  assert.equal(fresh.seen.listings, 1, 'load reads the collection once');
  assert.equal(fresh.seen.reads, 0, 'load reads no single documents');
  await fresh.context.close();
  await context.close();
  ok('A morning\'s records survive a reload, and a save writes only what it changes');
}

// 5. A version 7.1.1 document (attempts and artifacts inside state) is split on first load.
{
  const store = new Map();
  const old = {
    profile: { education: 'bachelor', display_name: 'Moye', weekly_hours: 11, motivation: 'Lead the work' },
    progress: [{ item_key: 'w1-s1', status: 'complete' }, { item_key: 'w1-s2', status: 'complete' }],
    attempts: [
      { question_id: 'q-itil-01', certification: 'ITIL', domain: 'Guiding principles', answer: 'A', correct: 1, confidence: 'high', created_at: '2026-10-20T08:00:00.000Z' },
      { question_id: 'q-pmp-02', certification: 'PMP', domain: 'People', answer: 'C', correct: 0, confidence: 'low', created_at: '2026-10-19T08:00:00.000Z' },
    ],
    artifacts: [
      { artifact_key: 'charter', status: 'complete', evidence_text: 'Charter text', reflection: 'Why', updated_at: '2026-10-18T08:00:00.000Z' },
      { artifact_key: 'mock pl300/1759900000000', status: 'complete', evidence_text: '{"score":75}', reflection: '', updated_at: '2026-10-17T08:00:00.000Z' },
    ],
  };
  store.set(`${prefix}state`, JSON.stringify(old));
  const { context, page, seen } = await device(store);
  await page.goto(base);
  await page.waitForSelector('.hero-session');
  assert.deepEqual(seen.badPaths, []);
  const main = stored(store);
  assert.equal(main.attempts, undefined, 'attempts moved out of state');
  assert.equal(main.artifacts, undefined, 'artifacts moved out of state');
  assert.deepEqual(main.profile, old.profile);
  assert.deepEqual(main.progress, old.progress);
  assert.deepEqual(stored(store, 'attempts').rows.map((row) => row.question_id), ['q-itil-01', 'q-pmp-02']);
  const docNames = [...store.keys()].filter((key) => key.startsWith(`${prefix}doc-`));
  assert.equal(docNames.length, 2, 'one document per written document');
  const state = await getState(page);
  assert.deepEqual(state.artifacts.map((row) => row.artifact_key).sort(), ['charter', 'mock pl300/1759900000000']);
  assert.equal(state.artifacts.find((row) => row.artifact_key === 'charter').evidence_text, 'Charter text');
  assert.equal(state.attempts.length, 2);
  const writes = seen.writes;
  await page.reload();
  await page.waitForSelector('.hero-session');
  assert.equal(seen.writes, writes, 'a second load writes nothing');
  assert.deepEqual((await getState(page)).artifacts.length, 2);
  await context.close();
  ok('A version 7.1.1 document is split into the new documents without losing anything');
}

// 6. Two devices changing different records keep both, and the same record merges.
{
  const store = new Map();
  const phone = await device(store);
  const laptop = await device(store);
  await phone.page.goto(base);
  await phone.page.waitForSelector('#displayName');
  assert.equal((await put(phone.page, { action: 'save-profile', displayName: 'Tester', weeklyHours: 11 })).status, 200);
  await laptop.page.goto(base);
  await laptop.page.waitForSelector('.hero-session');
  assert.equal((await put(phone.page, { action: 'patch-record', key: 'srs', patch: { cards: { 'card:p': { stage: 1, due: '2026-11-17' } } } })).status, 200);
  assert.equal((await put(laptop.page, { action: 'append-record', key: 'log', item: { id: 'itil-w1', kind: 'lab', minutes: 200 } })).status, 200);
  assert.equal((await put(laptop.page, { action: 'patch-record', key: 'srs', patch: { cards: { 'card:l': { stage: 0, due: '2026-11-17' } } } })).status, 200);
  assert.equal((await put(phone.page, { action: 'append-record', key: 'log', item: { id: 'itil-m2', kind: 'learn', minutes: 90 } })).status, 200);
  assert.deepEqual(Object.keys(stored(store, 'rec-srs').value.cards).sort(), ['card:l', 'card:p']);
  assert.deepEqual(stored(store, 'rec-log').value.map((item) => item.id), ['itil-w1', 'itil-m2']);
  const fresh = await device(store);
  await fresh.page.goto(base);
  await fresh.page.waitForSelector('.hero-session');
  const state = await getState(fresh.page);
  assert.equal(state.records.log.length, 2);
  assert.equal(Object.keys(state.records.srs.cards).length, 2);
  await Promise.all([phone.context.close(), laptop.context.close(), fresh.context.close()]);
  ok('Two devices changing different records keep both');
}

// 7. Over a size limit: a clear error, shown on screen, and nothing written.
{
  const store = new Map();
  const { context, page, seen } = await device(store);
  await page.goto(base);
  await page.waitForSelector('#displayName');
  assert.equal((await put(page, { action: 'save-profile', displayName: 'Tester', weeklyHours: 11 })).status, 200);
  const snapshot = new Map(store);
  const writes = seen.writes;
  const big = await put(page, { action: 'append-record', key: 'log', item: { id: 'x', note: 'a'.repeat(200001) } });
  assert.equal(big.status, 400);
  assert.match(big.data.error, /over the limit of 200,000.*Nothing was saved/);
  const wide = await put(page, { action: 'append-record', key: 'log', item: { id: 'y', note: 'é'.repeat(150000) } });
  assert.equal(wide.status, 400);
  assert.match(wide.data.error, /over the store's limit of 256 KB/);
  const work = await put(page, { action: 'save-artifact', artifactKey: 'charter', status: 'draft', evidenceText: 'w'.repeat(20001), reflection: '' });
  assert.equal(work.status, 400);
  assert.match(work.data.error, /Your work is 20,001 characters, over the limit of 20,000/);
  // The same refusal through the app's own Save draft button shows an alert.
  await page.goto(`${base}/#projects`);
  await page.reload();
  await page.waitForSelector('.releases .release');
  await page.click('.releases .release >> nth=0');
  await page.click('.doc-list li >> nth=0 >> button');
  await page.waitForSelector('#work');
  await page.fill('#work', 'w'.repeat(20001));
  await page.click('button:has-text("Save draft")');
  await page.waitForSelector('[role=alert]:has-text("over the limit of 20,000")');
  assert.equal(seen.writes, writes, 'nothing was written');
  assert.deepEqual(store, snapshot, 'the store is unchanged');
  await context.close();
  ok('A change over a size limit shows an error and writes nothing');
}

await browser.close();
server.close();
console.log(`${checks} save checks passed`);
