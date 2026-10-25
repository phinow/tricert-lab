import assert from 'node:assert/strict';
import test from 'node:test';
import {
  coverageRows,
  portfolioChecklist,
  projects,
  questionsForDeliverable,
  scenarioBank,
  studyWeeks,
} from '../lib/tricert-content.ts';

test('curriculum has thirteen complete weeks and sixty-five daily sessions', () => {
  assert.equal(studyWeeks.length, 13);
  assert.equal(studyWeeks.flatMap((week) => week.tasks).length, 65);
  assert.deepEqual(studyWeeks.map((week) => week.number), Array.from({ length: 13 }, (_, index) => index + 1));
  studyWeeks.forEach((week) => assert.equal(week.tasks.length, 5));
  studyWeeks.forEach((week) => assert.ok(week.tasks.some((task) => task.certifications.includes('ITIL'))));
});

test('every session builds a real Beacon document, and every document is built', () => {
  const keys = new Set(projects.flatMap((project) => project.deliverables.map((item) => item.key)));
  const built = new Set<string>();
  studyWeeks.flatMap((week) => week.tasks).forEach((task) => task.docs.forEach((key) => { assert.ok(keys.has(key), `${task.key} builds unknown ${key}`); built.add(key); }));
  assert.equal(built.size, keys.size);
  const docless = studyWeeks.flatMap((week) => week.tasks).filter((task) => task.docs.length === 0).map((task) => task.key);
  assert.deepEqual(docless, ['w6-s4', 'w9-s4', 'w9-s5', 'w10-s2', 'w10-s3', 'w13-s2', 'w13-s3', 'w13-s4']);
});

test('Project Beacon has three releases with complete document definitions', () => {
  assert.equal(projects.length, 3);
  const deliverables = projects.flatMap((project) => project.deliverables);
  assert.equal(deliverables.length, 66);
  assert.equal(new Set(deliverables.map((item) => item.key)).size, deliverables.length);
  deliverables.forEach((item) => {
    assert.ok(item.concepts.length >= 3);
    assert.ok(item.domains.length >= 3);
    assert.ok(item.rubric.length >= 5);
    assert.ok(item.reflections.length >= 3);
    assert.equal(questionsForDeliverable(item).length, 5);
    assert.equal(new Set(questionsForDeliverable(item).map((question) => question.id)).size, 5);
  });
});

test('practice, intersection, and portfolio content are substantial', () => {
  assert.ok(scenarioBank.length >= 16);
  assert.ok(coverageRows.length >= 12);
  assert.ok(portfolioChecklist.length >= 12);
  scenarioBank.forEach((question) => {
    assert.equal(question.options.length, 4);
    assert.ok(question.options.some(([key]) => key === question.correct));
    assert.ok(question.explanation.length > 40);
  });
});
