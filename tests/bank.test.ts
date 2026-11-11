import assert from 'node:assert/strict';
import test from 'node:test';
import {
  allCards,
  areaMix,
  bankCards,
  bankQuestions,
  blockFor,
  cardsForExam,
  cardsForLesson,
  crossExamScenarios,
  makeUserCard,
  nextPracticeExam,
  practiceForm,
  questionBank,
  questionById,
  questionsForLesson,
  takenForms,
  todaysCards,
  todaysQuestions,
} from '../lib/tricert-bank.ts';
import { flashcards } from '../lib/tricert-content.ts';
import { extraFlashcards } from '../lib/tricert-library.ts';
import { itilAreas } from '../lib/tricert-plan.ts';
import { areaOf, cardId, emptySrs, gradeQuestion, startCard } from '../lib/tricert-study.ts';

const today = '2026-11-16';

test('the bank keeps each exam apart and the 16 cross-exam scenarios on their own', () => {
  assert.equal(crossExamScenarios.length, 16);
  crossExamScenarios.forEach((question) => assert.equal(question.certification, 'Intersection'));
  assert.ok(bankQuestions.every((question) => question.certification !== 'Intersection'));
  const total = Object.values(questionBank).reduce((sum, list) => sum + list.length, 0);
  assert.equal(total, bankQuestions.length);
  for (const [exam, list] of Object.entries(questionBank)) list.forEach((question) => assert.equal(question.certification, exam));
  assert.ok(questionBank.ITIL.length >= 144);
  assert.equal(questionById('q-itil-025')?.lesson, 'itil-m1');
  assert.equal(questionById(crossExamScenarios[0].id)?.certification, 'Intersection');
  assert.equal(questionById('no-such-question'), undefined);
});

test('lesson questions and practice exam forms', () => {
  const m1 = questionsForLesson('itil-m1');
  assert.ok(m1.length >= 5 && m1.every((question) => question.lesson === 'itil-m1'));
  const before = questionsForLesson('itil-m1', []);
  assert.ok(before.every((question) => question.pool === 'daily'));
  assert.ok(before.length < m1.length, 'form questions stay out until the form is taken');
  assert.equal(questionsForLesson('itil-m1', ['A', 'B']).length, m1.length);
  const formA = practiceForm('ITIL', 'A');
  const formB = practiceForm('ITIL', 'B');
  assert.equal(formA.length, 40);
  assert.equal(formB.length, 40);
  assert.ok(formA.every((question) => question.pool === 'mockA'));
  assert.deepEqual(Object.values(areaMix('ITIL')), [7, 4, 5, 8, 6, 10]);
  assert.deepEqual(Object.keys(areaMix('ITIL')), itilAreas);
  assert.deepEqual(areaMix('PMP'), {});
  assert.equal(blockFor('ITIL').key, 'itil');
});

test('the next practice exam is form A, then B, then a draw by area', () => {
  const srs = emptySrs();
  assert.deepEqual(takenForms([{ exam: 'ITIL', form: 'B' }, { exam: 'PMP', form: 'A' }, { exam: 'ITIL', form: 'draw-1' }], 'ITIL'), ['B']);
  assert.equal(nextPracticeExam({ exam: 'ITIL', mocks: [], srs, today, seed: 1 }).form, 'A');
  assert.equal(nextPracticeExam({ exam: 'ITIL', mocks: [{ exam: 'ITIL', form: 'A' }], srs, today, seed: 1 }).form, 'B');
  const mocks = [{ exam: 'ITIL', form: 'A' }, { exam: 'ITIL', form: 'B' }];
  const one = nextPracticeExam({ exam: 'ITIL', mocks, srs, today, seed: 'mock-3' });
  const two = nextPracticeExam({ exam: 'ITIL', mocks, srs, today, seed: 'mock-3' });
  assert.equal(one.form, 'draw-mock-3');
  assert.equal(one.questions.length, 40);
  assert.deepEqual(one.questions.map((question) => question.id), two.questions.map((question) => question.id));
  const counts = itilAreas.map((area) => one.questions.filter((question) => areaOf(question.domain) === area).length);
  assert.deepEqual(counts, [7, 4, 5, 8, 6, 10]);
});

test('today\'s questions use the bank, the forms taken and what has been taught', () => {
  const srs = emptySrs();
  const first = todaysQuestions({ exam: 'ITIL', srs, today, lesson: 'itil-m1' });
  assert.equal(first.length, 20);
  assert.ok(first.every((question) => question.pool === 'daily'));
  assert.equal(first.filter((question) => question.lesson === 'itil-m1').length, 6);
  const taught = todaysQuestions({ exam: 'ITIL', srs, today, lesson: 'itil-m2', taught: ['itil-m1'] });
  assert.ok(taught.every((question) => ['itil-m1', 'itil-m2'].includes(question.lesson!)));
  srs.questions[formAFirst()] = gradeQuestion(undefined, 'wrong', '2026-11-10');
  const withForm = todaysQuestions({ exam: 'ITIL', srs, today, mode: 'short', mocks: [{ exam: 'ITIL', form: 'A' }] });
  assert.deepEqual(withForm.map((question) => question.id), [formAFirst()], 'a form question comes due once its form is taken');
  assert.deepEqual(todaysQuestions({ exam: 'ITIL', srs, today, mode: 'short' }), [], 'and not before');
});

function formAFirst() {
  return practiceForm('ITIL', 'A')[0].id;
}

test('cards carry engine ids, lessons, and his own cards', () => {
  assert.equal(bankCards.length, flashcards.length + extraFlashcards.length);
  assert.equal(new Set(bankCards.map((card) => card.id)).size, bankCards.length);
  bankCards.forEach((card) => assert.equal(card.id, cardId(card.exam, card.front)));
  assert.ok(cardsForLesson('itil-m1').length >= 6);
  assert.ok(cardsForLesson('itil-m1').every((card) => card.exam === 'ITIL' && card.source === 'built-in'));
  const mine = makeUserCard({ exam: 'ITIL', front: '  Normal  change   or standard? ', back: 'Pre-authorized and low risk means standard. ', today, lesson: 'itil-m7', question: 'q-itil-055' });
  assert.equal(mine.front, 'Normal change or standard?');
  assert.equal(mine.id, cardId('ITIL', 'Normal change or standard?'));
  assert.equal(mine.created, today);
  const all = allCards([mine]);
  assert.equal(all.length, bankCards.length + 1);
  assert.equal(all.at(-1)!.source, 'mine');
  assert.equal(allCards([{ ...mine, id: bankCards[0].id }]).length, bankCards.length, 'a duplicate of a built-in card is ignored');
  assert.ok(cardsForExam('ITIL', [mine]).some((card) => card.id === mine.id));
  const srs = emptySrs();
  const picks = todaysCards({ srs, today, lesson: 'itil-m1', usercards: [mine] });
  assert.equal(picks.length, 8);
  assert.ok(picks.every((pick) => pick.isNew && pick.card.lesson === 'itil-m1'));
  srs.cards[mine.id] = startCard('2026-11-15');
  const next = todaysCards({ srs, today, usercards: [mine] });
  assert.deepEqual(next.map((pick) => pick.id), [mine.id]);
});
