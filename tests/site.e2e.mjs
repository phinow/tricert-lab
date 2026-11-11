import assert from 'node:assert/strict';
import test from 'node:test';

const baseUrl = process.env.TRICERT_BASE_URL || 'http://localhost:3000';

test('application, persistent state API, and lab downloads respond', async () => {
  const [page, state, dataset, itilTemplate] = await Promise.all([
    fetch(`${baseUrl}/`),
    fetch(`${baseUrl}/api/state`),
    fetch(`${baseUrl}/datasets/khn_ed_visits.csv`),
    fetch(`${baseUrl}/datasets/itil-value-stream-template.md`),
  ]);
  assert.equal(page.status, 200);
  assert.match(page.headers.get('content-type') || '', /text\/html/);
  assert.equal(state.status, 200);
  const body = await state.json();
  assert.ok(Array.isArray(body.progress));
  assert.ok(Array.isArray(body.attempts));
  assert.ok(Array.isArray(body.artifacts));
  assert.equal(dataset.status, 200);
  assert.match(await dataset.text(), /^visit_id,site_code/);
  assert.equal(itilTemplate.status, 200);
  assert.match(await itilTemplate.text(), /value stream worksheet \(ITIL Version 5\)/i);
});

test('unsupported mutations fail closed', async () => {
  const response = await fetch(`${baseUrl}/api/state`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action: 'unapproved-operation' }),
  });
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: 'Unsupported study action.' });
});

const put = async (body) => {
  const response = await fetch(`${baseUrl}/api/state`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: response.status, data: await response.json() };
};

test('state carries records with empty defaults', async () => {
  const body = await (await fetch(`${baseUrl}/api/state`)).json();
  assert.ok(body.records, 'records are returned');
  for (const key of ['mocks', 'log', 'usercards']) assert.ok(Array.isArray(body.records[key]), key);
  assert.equal(typeof body.records.plan, 'object');
  assert.equal(typeof body.records.srs.cards, 'object');
  assert.equal(typeof body.records.srs.questions, 'object');
});

test('patch-record merges to three levels and null removes a key', async () => {
  const stamp = `e2e-${Date.now()}`;
  assert.equal((await put({ action: 'patch-record', key: 'plan', patch: { startDate: '2026-11-16' } })).status, 200);
  assert.equal((await put({ action: 'patch-record', key: 'srs', patch: { cards: { [`card:${stamp}`]: { stage: 1, due: '2026-11-17' }, [`card:${stamp}-gone`]: { stage: 0, due: '2026-11-17' } } } })).status, 200);
  const { status, data } = await put({ action: 'patch-record', key: 'srs', patch: { cards: { [`card:${stamp}`]: { stage: 2 }, [`card:${stamp}-gone`]: null } } });
  assert.equal(status, 200);
  assert.equal(data.records.plan.startDate, '2026-11-16');
  assert.deepEqual(data.records.srs.cards[`card:${stamp}`], { stage: 2, due: '2026-11-17' });
  assert.equal(data.records.srs.cards[`card:${stamp}-gone`], undefined);
  const wrong = await put({ action: 'patch-record', key: 'log', patch: {} });
  assert.equal(wrong.status, 400);
  assert.match(wrong.data.error, /patch-record works on plan or srs/);
});

test('append-record adds by id and replaces an item with the same id', async () => {
  const id = `e2e-${Date.now()}`;
  assert.equal((await put({ action: 'append-record', key: 'log', item: { id, kind: 'learn', minutes: 80 } })).status, 200);
  const { status, data } = await put({ action: 'append-record', key: 'log', item: { id, kind: 'learn', minutes: 90 } });
  assert.equal(status, 200);
  const rows = data.records.log.filter((item) => item.id === id);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].minutes, 90);
  const missing = await put({ action: 'append-record', key: 'log', item: { kind: 'learn' } });
  assert.equal(missing.status, 400);
  assert.match(missing.data.error, /an id/);
});

test('size limits are refused with a clear error, not cut short', async () => {
  const before = await (await fetch(`${baseUrl}/api/state`)).json();
  const big = await put({ action: 'append-record', key: 'usercards', item: { id: 'too-big', back: 'a'.repeat(200001) } });
  assert.equal(big.status, 400);
  assert.match(big.data.error, /over the limit of 200,000\. Nothing was saved\./);
  const work = await put({ action: 'save-artifact', artifactKey: 'e2e-limit', status: 'draft', evidenceText: 'w'.repeat(20001), reflection: '' });
  assert.equal(work.status, 400);
  assert.match(work.data.error, /Your work is 20,001 characters, over the limit of 20,000/);
  const explain = await put({ action: 'save-artifact', artifactKey: 'e2e-limit', status: 'draft', evidenceText: 'ok', reflection: 'r'.repeat(6001) });
  assert.equal(explain.status, 400);
  assert.match(explain.data.error, /Your explanation is 6,001 characters, over the limit of 6,000/);
  const after = await (await fetch(`${baseUrl}/api/state`)).json();
  assert.deepEqual(after.records.usercards, before.records.usercards);
  assert.ok(!after.artifacts.some((row) => row.artifact_key === 'e2e-limit'));
});

test('attempts are the latest row per question, with no row limit', async () => {
  const stamp = Date.now();
  for (let index = 0; index < 105; index += 1) {
    const { status } = await put({ action: 'record-attempt', questionId: `e2e-${stamp}-${index}`, certification: 'ITIL', domain: 'Value', answer: 'A', correct: true, confidence: 'high' });
    assert.equal(status, 200);
  }
  const { data } = await put({ action: 'record-attempt', questionId: `e2e-${stamp}-0`, certification: 'ITIL', domain: 'Value', answer: 'B', correct: false, confidence: 'low' });
  const mine = data.attempts.filter((row) => String(row.question_id).startsWith(`e2e-${stamp}-`));
  assert.equal(mine.length, 105);
  const first = mine.find((row) => row.question_id === `e2e-${stamp}-0`);
  assert.equal(first.answer, 'B');
  assert.equal(first.tries, 2);
  assert.ok(first.first_at <= first.created_at);
});
