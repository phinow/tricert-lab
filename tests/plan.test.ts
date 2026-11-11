import assert from 'node:assert/strict';
import test from 'node:test';
import { examBlocks, itilAreas } from '../lib/tricert-plan.ts';

const words = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;

test('four blocks in the planned order, ITIL ready and the rest building', () => {
  assert.deepEqual(examBlocks.map((b) => b.key), ['itil', 'pl300', 'pmp', 'cissp']);
  assert.deepEqual(examBlocks.map((b) => b.cert), ['ITIL', 'PL-300', 'PMP', 'CISSP']);
  assert.deepEqual(examBlocks.map((b) => b.status), ['ready', 'building', 'building', 'building']);
  for (const block of examBlocks) {
    assert.ok(block.title.length > 0 && block.summary.length > 0, `${block.key} has a title and summary`);
    if (block.status === 'building') {
      assert.equal(block.mornings.length, 0, `${block.key} mornings empty`);
      assert.equal(block.weekends.length, 0, `${block.key} weekends empty`);
      assert.equal(block.booking.length, 0, `${block.key} booking empty`);
    }
  }
});

test('morning and weekend keys are unique across all blocks', () => {
  const keys = examBlocks.flatMap((b) => [...b.mornings.map((m) => m.key), ...b.weekends.map((w) => w.key)]);
  assert.equal(new Set(keys).size, keys.length);
  for (const block of examBlocks) {
    for (const item of [...block.mornings, ...block.weekends]) {
      assert.ok(item.key.startsWith(`${block.key}-`), `${item.key} starts with its block key`);
    }
  }
});

test('every weekend block waits for a real morning of its block', () => {
  for (const block of examBlocks) {
    const mornings = new Set(block.mornings.map((m) => m.key));
    const weekends = new Set(block.weekends.map((w) => w.key));
    for (const w of block.weekends) {
      assert.ok(mornings.has(w.after), `${w.key}.after ${w.after} is a morning`);
      if (w.minDaysAfter) {
        assert.ok(weekends.has(w.minDaysAfter.key) && w.minDaysAfter.key !== w.key, `${w.key}.minDaysAfter names another weekend block`);
        assert.ok(w.minDaysAfter.days > 0);
      }
      assert.ok(w.minutes >= 60 && w.minutes <= 240, `${w.key} fits a weekend block`);
      if (w.kind === 'mock') assert.ok(w.form === 'A' || w.form === 'B', `${w.key} has a form`);
      if (w.kind === 'lab') assert.ok(w.steps.length >= 4, `${w.key} has steps`);
    }
  }
});

test('ITIL has eight learn mornings in order, each with its lesson and a brief', () => {
  const itil = examBlocks.find((b) => b.key === 'itil')!;
  const learn = itil.mornings.filter((m) => m.kind === 'learn');
  assert.deepEqual(learn.map((m) => m.key), ['itil-m1', 'itil-m2', 'itil-m3', 'itil-m4', 'itil-m5', 'itil-m6', 'itil-m7', 'itil-m8']);
  for (const m of learn) {
    assert.equal(m.lesson, m.key);
    assert.ok(m.brief, `${m.key} has a brief`);
    const n = words(m.brief!.text);
    assert.ok(n >= 40 && n <= 70, `${m.key} brief is ${n} words`);
    assert.ok(m.brief!.from && m.brief!.role && m.brief!.ask, `${m.key} brief names a person, a role and an ask`);
  }
  const order = itil.mornings.map((m) => m.key);
  assert.ok(order.indexOf('itil-r1') === order.indexOf('itil-m4') + 1, 'r1 follows m4');
  assert.ok(order.indexOf('itil-r2') === order.indexOf('itil-m8') + 1, 'r2 follows m8');
  for (const m of itil.mornings.filter((x) => x.kind !== 'learn')) {
    assert.equal(m.lesson, undefined, `${m.key} has no lesson`);
  }
  const weekends = Object.fromEntries(itil.weekends.map((w) => [w.key, w]));
  assert.equal(weekends['itil-w1'].kind, 'lab');
  assert.equal(weekends['itil-w1'].after, 'itil-r1');
  assert.equal(weekends['itil-w2'].form, 'A');
  assert.equal(weekends['itil-w2'].after, 'itil-r2');
  assert.equal(weekends['itil-w3'].form, 'B');
  assert.deepEqual(weekends['itil-w3'].minDaysAfter, { key: 'itil-w2', days: 7 });
  assert.ok(order.indexOf(weekends['itil-w3'].after) > order.indexOf('itil-r2'), 'exam B comes after the repair mornings');
  assert.ok(itil.booking.length >= 5);
});

test('exam settings are sane', () => {
  for (const block of examBlocks) {
    const e = block.exam;
    assert.ok(Number.isInteger(e.questions) && e.questions > 0, `${block.key} questions`);
    assert.ok(Number.isInteger(e.minutes) && e.minutes > 0, `${block.key} minutes`);
    assert.ok(Math.abs(e.secondsPerQuestion * e.questions - e.minutes * 60) <= e.secondsPerQuestion, `${block.key} pace matches the time`);
    assert.ok(e.target >= 65 && e.target <= 100, `${block.key} target`);
    assert.ok(e.areas.length > 0 && new Set(e.areas).size === e.areas.length, `${block.key} areas unique`);
  }
  const by = Object.fromEntries(examBlocks.map((b) => [b.key, b.exam]));
  assert.deepEqual([by.itil.questions, by.itil.minutes, by.itil.secondsPerQuestion, by.itil.allowBack, by.itil.target], [40, 60, 90, true, 80]);
  assert.deepEqual([by.pl300.questions, by.pl300.minutes, by.pl300.allowBack, by.pl300.target], [55, 100, true, 80]);
  assert.deepEqual([by.pmp.questions, by.pmp.minutes, by.pmp.allowBack, by.pmp.target], [180, 240, true, 75]);
  assert.deepEqual([by.cissp.questions, by.cissp.minutes, by.cissp.allowBack, by.cissp.target], [125, 180, false, 75]);
  assert.equal(by.itil.areas, itilAreas);
  assert.equal(itilAreas.length, 6);
});

test('plan text has no em dash and none of the banned words', () => {
  const text = JSON.stringify(examBlocks);
  assert.ok(!text.includes('—'));
  const banned = /\b(delve|tapestry|landscape|spearheaded|seamless|navigating|fostering|comprehensive|transformative|pivotal|successfully|effectively|carefully|strategically|proactively)\b/i;
  assert.equal(text.match(banned), null);
});
