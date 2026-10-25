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
