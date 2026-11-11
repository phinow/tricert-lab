import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { projects, studyWeeks } from '../lib/tricert-content.ts';
import { examQuestions, extraFlashcards, glossary, guideIndex, lessonIndex } from '../lib/tricert-library.ts';
import { docGuides, lessons } from '../lib/tricert-reading.ts';
import { examGuides } from '../lib/tricert-exams.ts';
import { examBlocks, itilAreas } from '../lib/tricert-plan.ts';

const sessionKeys = studyWeeks.flatMap((week) => week.tasks.map((task) => task.key));
const deliverableKeys = projects.flatMap((project) => project.deliverables.map((item) => item.key));
const learnMornings = examBlocks.flatMap((block) => block.mornings.filter((morning) => morning.kind === 'learn').map((morning) => ({ block, morning })));
const blockLessonKeys = learnMornings.map(({ morning }) => morning.lesson!);
const blockOfLesson = new Map(learnMornings.map(({ block, morning }) => [morning.lesson!, block]));
const words = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;

test('every one of the 65 sessions has a full lesson', () => {
  assert.equal(sessionKeys.length, 65);
  assert.deepEqual(Object.keys(lessons).filter((key) => /^w\d+-s\d+$/.test(key)), sessionKeys, 'the 65 Kestrel lessons, in week and session order');
  assert.deepEqual(Object.keys(lessons).sort(), [...sessionKeys, ...blockLessonKeys].sort(), 'no lesson outside the sessions and the learn mornings');
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

test('every learn morning in the plan has a lesson sized for 35 minutes', () => {
  assert.ok(learnMornings.length >= 8);
  assert.deepEqual(Object.keys(lessons).slice(sessionKeys.length), blockLessonKeys, 'block lessons follow the Kestrel lessons in plan order');
  learnMornings.forEach(({ block, morning }) => {
    const lesson = lessons[morning.lesson!];
    assert.ok(lesson, `${morning.key} has a lesson`);
    const reading = lesson.read.reduce((total, section) => total + words(section.body), 0);
    assert.ok(lesson.read.length >= 4 && lesson.read.length <= 6, `${morning.key}: 4 to 6 sections`);
    assert.ok(reading >= 1000 && reading <= 1400, `${morning.key}: 1,000 to 1,400 words of reading (has ${reading})`);
    assert.ok(lesson.keyTerms.length >= 6 && lesson.keyTerms.length <= 10, `${morning.key}: 6 to 10 key terms`);
    assert.ok(lesson.build.steps.length >= 4, `${morning.key}: a build of at least 4 steps`);
    assert.ok((lesson.build.modelAnswer || '').length >= 800, `${morning.key}: a model answer`);
    assert.ok(lesson.examTips.length >= 3 && lesson.examTips.length <= 5, `${morning.key}: 3 to 5 exam tips`);
    lesson.examTips.forEach((tip) => assert.equal(tip.cert, block.cert, `${morning.key}: tips are for ${block.cert}`));
    assert.equal(lesson.pitfalls.length, 3, `${morning.key}: 3 pitfalls`);
    assert.equal(lesson.check.length, 3, `${morning.key}: 3 recall prompts`);
  });
});

test('every one of the 66 documents has a writing guide and a finished example', () => {
  assert.deepEqual(Object.keys(docGuides).sort(), [...deliverableKeys].sort());
  Object.values(docGuides).forEach((guide) => {
    assert.ok(guide.sections.length >= 5);
    assert.ok(guide.modelDocument.length >= 1500);
  });
});

test('exam questions are well formed and point at real documents or real mornings', () => {
  assert.equal(new Set(examQuestions.map((question) => question.id)).size, examQuestions.length);
  for (const cert of ['PMP', 'PL-300', 'CISSP', 'ITIL']) assert.ok(examQuestions.filter((question) => question.certification === cert).length >= 20);
  examQuestions.forEach((question) => {
    assert.notEqual(question.certification, 'Intersection');
    assert.deepEqual(question.options.map(([key]) => key), ['A', 'B', 'C', 'D']);
    assert.ok(['A', 'B', 'C', 'D'].includes(question.correct));
    assert.deepEqual(Object.keys(question.incorrect).sort(), ['A', 'B', 'C', 'D'].filter((key) => key !== question.correct));
    if (question.artifactKey !== undefined || !question.pool) assert.ok(deliverableKeys.includes(question.artifactKey!), `${question.id} points at a real document`);
    if (question.pool || question.lesson) {
      assert.ok(['daily', 'mockA', 'mockB'].includes(question.pool!), `${question.id} has a pool`);
      assert.ok(blockLessonKeys.includes(question.lesson!), `${question.id}: lesson ${question.lesson} is a real learn morning`);
      assert.equal(blockOfLesson.get(question.lesson!)!.cert, question.certification, `${question.id}: lesson of its own exam`);
    }
  });
});

test('ITIL has a daily bank and two practice exam forms with the planned area mix', () => {
  const itil = examQuestions.filter((question) => question.certification === 'ITIL');
  assert.ok(itil.length >= 144, `at least 144 ITIL questions (has ${itil.length})`);
  itil.forEach((question) => {
    assert.ok(question.pool && question.lesson, `${question.id} has a pool and a lesson`);
    assert.ok(itilAreas.includes(question.domain.split(' · ')[0]), `${question.id}: domain starts with a plan area`);
  });
  assert.ok(itil.filter((question) => question.pool === 'daily').length >= 64);
  const block = examBlocks.find((item) => item.cert === 'ITIL')!;
  assert.deepEqual(block.exam.areas, itilAreas);
  const mix = [7, 4, 5, 8, 6, 10];
  assert.equal(mix.reduce((sum, count) => sum + count, 0), block.exam.questions);
  for (const pool of ['mockA', 'mockB']) {
    const form = itil.filter((question) => question.pool === pool);
    assert.equal(form.length, 40, `${pool} has 40 questions`);
    assert.deepEqual(itilAreas.map((area) => form.filter((question) => question.domain.split(' · ')[0] === area).length), mix, `${pool} area mix`);
    assert.equal(new Set(form.map((question) => question.lesson)).size, 8, `${pool} draws on all eight lessons`);
  }
  for (const key of blockLessonKeys.filter((lesson) => lesson.startsWith('itil-'))) {
    assert.ok(itil.filter((question) => question.pool === 'daily' && question.lesson === key).length >= 5, `${key} has at least 5 daily questions`);
  }
});

test('the always-loaded index matches the on-demand reading', () => {
  assert.deepEqual(Object.keys(lessonIndex).sort(), Object.keys(lessons).sort());
  assert.deepEqual(Object.keys(guideIndex).sort(), Object.keys(docGuides).sort());
});

test('glossary and flashcards are unique', () => {
  assert.equal(new Set(glossary.map((term) => `${term.cert}:${term.term.toLowerCase()}`)).size, glossary.length);
  assert.equal(new Set(extraFlashcards.map(([, front]) => front)).size, extraFlashcards.length);
});

test('every ITIL block card has a real lesson', () => {
  const file = JSON.parse(readFileSync(new URL('../tools/content/parts2/flashcards-itil.json', import.meta.url), 'utf8')) as { items: { cert: string; front: string; lesson: string }[] };
  assert.ok(file.items.length >= 50);
  const byFront = new Map(extraFlashcards.map((card) => [card[1], card]));
  file.items.forEach((item) => {
    const card = byFront.get(item.front);
    assert.ok(card, `built: ${item.front}`);
    assert.equal(card[0], 'ITIL');
    assert.equal(card[3], item.lesson);
    assert.ok(blockLessonKeys.includes(card[3]) && blockOfLesson.get(card[3])!.cert === 'ITIL', `${item.front}: lesson ${card[3]} is an ITIL learn morning`);
  });
  extraFlashcards.forEach(([cert, front, , lesson]) => {
    if (lesson) assert.equal(blockOfLesson.get(lesson)?.cert, cert, `${front}: lesson of its own exam`);
  });
  for (const key of blockLessonKeys.filter((lesson) => lesson.startsWith('itil-'))) assert.ok(extraFlashcards.filter((card) => card[3] === key).length >= 6, `${key} has cards`);
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
