import assert from 'node:assert/strict';
import test from 'node:test';
import { projects, studyWeeks } from '../lib/tricert-content.ts';
import { examQuestions, extraFlashcards, glossary, guideIndex, lessonIndex } from '../lib/tricert-library.ts';
import { docGuides, lessons } from '../lib/tricert-reading.ts';
import { examGuides } from '../lib/tricert-exams.ts';

const sessionKeys = studyWeeks.flatMap((week) => week.tasks.map((task) => task.key));
const deliverableKeys = projects.flatMap((project) => project.deliverables.map((item) => item.key));

test('every one of the 65 sessions has a full lesson', () => {
  assert.deepEqual(Object.keys(lessons).sort(), [...sessionKeys].sort());
  Object.values(lessons).forEach((lesson) => {
    assert.ok(lesson.read.length >= 4);
    assert.ok(lesson.read.reduce((total, section) => total + section.body.length, 0) >= 3500);
    assert.ok(lesson.build.steps.length >= 4);
    assert.ok(lesson.examTips.length >= 2);
    assert.equal(lesson.check.length, 3);
    lesson.check.forEach((item) => assert.ok(item.a.length >= 60));
  });
  studyWeeks.flatMap((week) => week.tasks).filter((task) => task.docs.length === 0).forEach((task) => assert.ok((lessons[task.key].build.modelAnswer || '').length >= 800, `${task.key} needs a model answer`));
});

test('every one of the 66 documents has a writing guide and a finished example', () => {
  assert.deepEqual(Object.keys(docGuides).sort(), [...deliverableKeys].sort());
  Object.values(docGuides).forEach((guide) => {
    assert.ok(guide.sections.length >= 5);
    assert.ok(guide.modelDocument.length >= 1500);
  });
});

test('exam questions are well formed and point at real documents', () => {
  assert.equal(new Set(examQuestions.map((question) => question.id)).size, examQuestions.length);
  for (const cert of ['PMP', 'PL-300', 'CISSP', 'ITIL']) assert.ok(examQuestions.filter((question) => question.certification === cert).length >= 20);
  examQuestions.forEach((question) => {
    assert.deepEqual(question.options.map(([key]) => key), ['A', 'B', 'C', 'D']);
    assert.ok(['A', 'B', 'C', 'D'].includes(question.correct));
    assert.deepEqual(Object.keys(question.incorrect).sort(), ['A', 'B', 'C', 'D'].filter((key) => key !== question.correct));
    assert.ok(deliverableKeys.includes(question.artifactKey));
  });
});

test('the always-loaded index matches the on-demand reading', () => {
  assert.deepEqual(Object.keys(lessonIndex).sort(), Object.keys(lessons).sort());
  assert.deepEqual(Object.keys(guideIndex).sort(), Object.keys(docGuides).sort());
});

test('glossary and flashcards are unique', () => {
  assert.equal(new Set(glossary.map((term) => `${term.cert}:${term.term.toLowerCase()}`)).size, glossary.length);
  assert.equal(new Set(extraFlashcards.map(([, front]) => front)).size, extraFlashcards.length);
});

test('exam guides match the published outlines', () => {
  assert.deepEqual(examGuides.map((guide) => guide.cert), ['PMP', 'PL-300', 'CISSP', 'ITIL']);
  const sum = (cert: string) => examGuides.find((guide) => guide.cert === cert)!.areas.reduce((total, area) => total + Number(area.weight.replace('%', '')), 0);
  assert.equal(sum('PMP'), 100);
  assert.equal(sum('CISSP'), 100);
  const pmp = examGuides.find((guide) => guide.cert === 'PMP')!;
  assert.deepEqual(pmp.areas.map((area) => area.covers.length), [8, 10, 8]);
  const itil = examGuides.find((guide) => guide.cert === 'ITIL')!;
  assert.deepEqual(itil.areas.find((area) => area.name === 'The product and service lifecycle')!.covers, ['Discover', 'Design', 'Acquire', 'Build', 'Transition', 'Operate', 'Deliver', 'Support']);
});

test('reading content keeps the house style', () => {
  const text = JSON.stringify({ lessons, docGuides, glossary, extraFlashcards, examQuestions, examGuides });
  assert.ok(!text.includes('—'), 'no em dashes');
  assert.ok(!/obtain\s*\/\s*build/i.test(text.replace(/ITIL 4[^."]{0,200}/g, '')), 'no ITIL 4 value chain names presented as current');
});
