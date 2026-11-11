import assert from 'node:assert/strict';
import test from 'node:test';
import {
  addDays,
  afterExam,
  allChecksMet,
  answerCard,
  areaOf,
  cardId,
  cardQueue,
  cardsForToday,
  dailySet,
  daysBetween,
  drawExam,
  emptySrs,
  estimateDates,
  formQuestions,
  gradeCard,
  gradeQuestion,
  isCardRetired,
  isDelayedReview,
  isQuestionRetired,
  isStudyDate,
  isUsable,
  readyToBook,
  recordQuestionAnswer,
  scoreExam,
  startCard,
  weekday,
  type BookingBlockLike,
  type CardState,
  type ExamResult,
  type QuestionState,
  type StudyCard,
  type StudyQuestionLike,
} from '../lib/tricert-study.ts';

/* ---------- Dates ---------- */

test('dates add and count across month and year ends', () => {
  assert.equal(addDays('2026-11-30', 1), '2026-12-01');
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(addDays('2028-02-28', 1), '2028-02-29');
  assert.equal(addDays('2026-03-01', -1), '2026-02-28');
  assert.equal(addDays('2026-10-31', 35), '2026-12-05');
  assert.equal(daysBetween('2026-11-25', '2026-12-02'), 7);
  assert.equal(daysBetween('2026-12-02', '2026-11-25'), -7);
  assert.equal(daysBetween('2026-12-31', '2027-01-21'), 21);
  assert.equal(weekday('2026-11-11'), 3);
  assert.equal(weekday('2026-11-15'), 0);
  assert.ok(isStudyDate('2026-02-28'));
  assert.ok(!isStudyDate('2026-02-30'));
  assert.ok(!isStudyDate('11/11/2026'));
  assert.throws(() => addDays('2026-13-01', 1));
});

/* ---------- Cards ---------- */

test('card ids are stable, tidy spaces and depend on exam and front', () => {
  const id = cardId('ITIL', 'What is a service?');
  assert.match(id, /^card:[0-9a-z]+$/);
  assert.equal(cardId('ITIL', '  What is a   service? '), id);
  assert.notEqual(cardId('PMP', 'What is a service?'), id);
  assert.notEqual(cardId('ITIL', 'What is a product?'), id);
});

test('a card runs through 1, 3, 7, 16 and 35 days to retirement', () => {
  let state = gradeCard(undefined, 'good', '2026-01-30');
  assert.deepEqual(state, { stage: 1, due: '2026-01-31', first: '2026-01-30' });
  const path: [string, number, string][] = [
    ['2026-01-31', 2, '2026-02-03'],
    ['2026-02-03', 3, '2026-02-10'],
    ['2026-02-10', 4, '2026-02-26'],
    ['2026-02-26', 5, '2026-04-02'],
  ];
  path.forEach(([today, stage, due]) => {
    state = gradeCard(state, 'good', today);
    assert.equal(state.stage, stage);
    assert.equal(state.due, due);
    assert.ok(!isCardRetired(state));
  });
  state = gradeCard(state, 'good', '2026-04-02');
  assert.ok(isCardRetired(state));
  assert.equal(state.first, '2026-01-30');
});

test('Again resets a card to stage 0, due tomorrow, from any stage', () => {
  const late: CardState = { stage: 4, due: '2026-11-30', first: '2026-10-01' };
  assert.deepEqual(gradeCard(late, 'again', '2026-11-30'), { stage: 0, due: '2026-12-01', first: '2026-10-01' });
  const restarted = gradeCard(gradeCard(late, 'again', '2026-11-30'), 'good', '2026-12-01');
  assert.deepEqual(restarted, { stage: 1, due: '2026-12-02', first: '2026-10-01' });
  assert.deepEqual(startCard('2026-12-31'), { stage: 0, due: '2027-01-01' });
});

test('Again shows the card once more today without changing its saved state again', () => {
  const today = '2026-11-30';
  const a = cardId('ITIL', 'A');
  const b = cardId('ITIL', 'B');
  let run = { queue: cardQueue([{ id: a }, { id: b }]), states: {} as Record<string, CardState> };
  run = answerCard(run.queue, run.states, 'again', today);
  assert.deepEqual(run.queue, [{ id: b, repeat: false }, { id: a, repeat: true }]);
  assert.deepEqual(run.states[a], { stage: 0, due: '2026-12-01', first: today });
  run = answerCard(run.queue, run.states, 'good', today);
  assert.equal(run.states[b].stage, 1);
  run = answerCard(run.queue, run.states, 'again', today);
  assert.deepEqual(run.queue, []);
  assert.deepEqual(run.states[a], { stage: 0, due: '2026-12-01', first: today });
  assert.deepEqual(answerCard([], run.states, 'good', today).queue, []);
});

test('cards for today: due first (oldest first), then up to 8 new from the lesson', () => {
  const today = '2026-12-01';
  const cards: StudyCard[] = [
    ...Array.from({ length: 12 }, (_, index) => ({ exam: 'ITIL', front: `new ${index}`, lesson: 'itil-m2' })),
    { exam: 'ITIL', front: 'other lesson', lesson: 'itil-m3' },
    { exam: 'ITIL', front: 'due late', lesson: 'itil-m1' },
    { exam: 'ITIL', front: 'due early', lesson: 'itil-m1' },
    { exam: 'ITIL', front: 'not due', lesson: 'itil-m1' },
    { exam: 'ITIL', front: 'retired', lesson: 'itil-m1' },
    { exam: 'ITIL', front: 'due early', lesson: 'itil-m1' },
  ];
  const id = (front: string) => cardId('ITIL', front);
  const states: Record<string, CardState> = {
    [id('due late')]: { stage: 2, due: '2026-12-01' },
    [id('due early')]: { stage: 1, due: '2026-11-28' },
    [id('not due')]: { stage: 1, due: '2026-12-02' },
    [id('retired')]: { stage: 6, due: '2026-11-01' },
  };
  const picks = cardsForToday({ cards, states, today, lesson: 'itil-m2' });
  assert.deepEqual(picks.map((pick) => pick.card.front), [
    'due early', 'due late', 'new 0', 'new 1', 'new 2', 'new 3', 'new 4', 'new 5', 'new 6', 'new 7',
  ]);
  assert.deepEqual(picks.map((pick) => pick.isNew), [false, false, true, true, true, true, true, true, true, true]);

  // Cards already started today count toward the 8.
  const started = { ...states, [id('new 0')]: gradeCard(undefined, 'good', today), [id('new 1')]: gradeCard(undefined, 'again', today) };
  const later = cardsForToday({ cards, states: started, today, lesson: 'itil-m2' });
  assert.deepEqual(later.filter((pick) => pick.isNew).map((pick) => pick.card.front), ['new 2', 'new 3', 'new 4', 'new 5', 'new 6', 'new 7']);

  // No lesson: due cards only.
  assert.deepEqual(cardsForToday({ cards, states, today }).map((pick) => pick.card.front), ['due early', 'due late']);
});

/* ---------- Questions ---------- */

test('right and sure on first sight: one check after 21 days, then retired', () => {
  const first = gradeQuestion(undefined, 'right', '2026-12-20');
  assert.deepEqual(first, { stage: 3, due: '2027-01-10', last: '2026-12-20', first: '2026-12-20' });
  const retired = gradeQuestion(first, 'right', '2027-01-10');
  assert.ok(isQuestionRetired(retired));
  assert.equal(retired.first, '2026-12-20');
  const missed = gradeQuestion(first, 'wrong', '2027-01-10');
  assert.deepEqual(missed, { stage: 1, due: '2027-01-12', last: '2027-01-10', first: '2026-12-20' });
});

test('wrong or guessed comes back after 2, 7 and 21 days, and a miss restarts at 2', () => {
  let state = gradeQuestion(undefined, 'wrong', '2026-12-30');
  assert.deepEqual(state, { stage: 1, due: '2027-01-01', last: '2026-12-30', first: '2026-12-30' });
  state = gradeQuestion(state, 'right', '2027-01-01');
  assert.deepEqual([state.stage, state.due], [2, '2027-01-08']);
  state = gradeQuestion(state, 'guess', '2027-01-08');
  assert.deepEqual([state.stage, state.due], [1, '2027-01-10']);
  state = gradeQuestion(state, 'right', '2027-01-10');
  assert.deepEqual([state.stage, state.due], [2, '2027-01-17']);
  state = gradeQuestion(state, 'right', '2027-01-17');
  assert.deepEqual([state.stage, state.due], [3, '2027-02-07']);
  assert.ok(!isQuestionRetired(state));
  state = gradeQuestion(state, 'right', '2027-02-07');
  assert.ok(isQuestionRetired(state));
  assert.equal(state.first, '2026-12-30');
  assert.deepEqual(gradeQuestion(undefined, 'guess', '2026-11-30').due, '2026-12-02');
});

test('delayed reviews count answers 7 or more days after the first answer, per exam', () => {
  const question = { id: 'q-itil-025', certification: 'ITIL' as const };
  let srs = emptySrs();
  srs = recordQuestionAnswer(srs, question, 'wrong', '2026-11-28');
  assert.deepEqual(srs.delayed, {});
  srs = recordQuestionAnswer(srs, question, 'right', '2026-11-30');
  assert.deepEqual(srs.delayed, {});
  assert.ok(!isDelayedReview(srs.questions[question.id], '2026-12-04'));
  assert.ok(isDelayedReview(srs.questions[question.id], '2026-12-05'));
  srs = recordQuestionAnswer(srs, question, 'right', '2026-12-05');
  srs = recordQuestionAnswer(srs, question, 'guess', '2026-12-07');
  srs = recordQuestionAnswer(srs, { id: 'q-pmp-1', certification: 'PMP' }, 'right', '2026-12-07');
  assert.deepEqual(srs.delayed, { ITIL: { total: 2, right: 1 } });
  assert.equal(srs.questions[question.id].first, '2026-11-28');
  assert.equal(srs.questions[question.id].last, '2026-12-07');
});

/* ---------- Daily set ---------- */

const q = (id: string, extra: Partial<StudyQuestionLike> = {}): StudyQuestionLike => ({
  id,
  certification: 'ITIL',
  domain: 'Value · outcomes',
  correct: 'A',
  pool: 'daily',
  ...extra,
});

test('daily set: due reviews oldest first, then 6 from the lesson, then other daily questions, 20 in all', () => {
  const today = '2026-12-01';
  const questions: StudyQuestionLike[] = [
    ...Array.from({ length: 10 }, (_, index) => q(`m2-${index}`, { lesson: 'itil-m2' })),
    ...Array.from({ length: 30 }, (_, index) => q(`m1-${index}`, { lesson: 'itil-m1' })),
    q('old-pmp', { certification: 'PMP', pool: undefined }),
    q('due-new', { lesson: 'itil-m1' }),
    q('due-old', { lesson: 'itil-m1' }),
    q('retired', { lesson: 'itil-m1' }),
    q('later', { lesson: 'itil-m1' }),
    q('form-a', { pool: 'mockA', lesson: 'itil-m2' }),
    q('pmp-new', { certification: 'PMP', pool: undefined }),
  ];
  const states: Record<string, QuestionState> = {
    'due-new': { stage: 1, due: '2026-12-01', last: '2026-11-29', first: '2026-11-29' },
    'due-old': { stage: 2, due: '2026-11-28', last: '2026-11-21', first: '2026-11-19' },
    'old-pmp': { stage: 3, due: '2026-11-30', last: '2026-11-09', first: '2026-11-09' },
    retired: { stage: 4, due: '2026-11-01', last: '2026-11-01', first: '2026-10-01' },
    later: { stage: 1, due: '2026-12-02', last: '2026-11-30', first: '2026-11-30' },
  };
  const set = dailySet({ questions, states, exam: 'ITIL', today, lesson: 'itil-m2' });
  assert.equal(set.length, 20);
  assert.deepEqual(set.slice(0, 3).map((item) => item.id), ['due-old', 'old-pmp', 'due-new']);
  assert.deepEqual(set.slice(3, 9).map((item) => item.id), ['m2-0', 'm2-1', 'm2-2', 'm2-3', 'm2-4', 'm2-5']);
  assert.deepEqual(set.slice(9, 13).map((item) => item.id), ['m2-6', 'm2-7', 'm2-8', 'm2-9']);
  assert.deepEqual(set.slice(13).map((item) => item.id), ['m1-0', 'm1-1', 'm1-2', 'm1-3', 'm1-4', 'm1-5', 'm1-6']);
  assert.ok(!set.some((item) => ['retired', 'later', 'form-a', 'pmp-new'].includes(item.id)));
  assert.equal(new Set(set.map((item) => item.id)).size, 20);

  const review = dailySet({ questions, states, exam: 'ITIL', today, mode: 'review' });
  assert.equal(review.length, 30);
  assert.deepEqual(review.slice(0, 3).map((item) => item.id), ['due-old', 'old-pmp', 'due-new']);

  const short = dailySet({ questions, states, exam: 'ITIL', today, lesson: 'itil-m2', mode: 'short' });
  assert.deepEqual(short.map((item) => item.id), ['due-old', 'old-pmp', 'due-new']);

  const tiny = dailySet({ questions, states, exam: 'ITIL', today, lesson: 'itil-m2', size: 2 });
  assert.deepEqual(tiny.map((item) => item.id), ['due-old', 'old-pmp']);
});

test('a practice exam form is held back from daily use until it is taken', () => {
  const today = '2026-12-01';
  const questions = [q('a1', { pool: 'mockA', lesson: 'itil-m1' }), q('b1', { pool: 'mockB', lesson: 'itil-m1' }), q('d1', { lesson: 'itil-m1' })];
  assert.ok(!isUsable(questions[0], []));
  assert.ok(isUsable(questions[0], ['A']));
  assert.ok(isUsable(questions[2], []));
  const states: Record<string, QuestionState> = {
    a1: { stage: 1, due: '2026-11-30', last: '2026-11-28', first: '2026-11-28' },
    b1: { stage: 1, due: '2026-11-30', last: '2026-11-28', first: '2026-11-28' },
  };
  assert.deepEqual(dailySet({ questions, states, exam: 'ITIL', today, lesson: 'itil-m1' }).map((item) => item.id), ['d1']);
  assert.deepEqual(
    dailySet({ questions, states, exam: 'ITIL', today, lesson: 'itil-m1', takenForms: ['A'] }).map((item) => item.id),
    ['a1', 'd1'],
  );
  // A taken form's unseen question can come from the lesson, but never as an "other daily" question.
  const fresh = dailySet({ questions, states: {}, exam: 'ITIL', today, lesson: 'itil-m1', takenForms: ['A', 'B'] });
  assert.deepEqual(fresh.map((item) => item.id), ['a1', 'b1', 'd1']);
  assert.deepEqual(dailySet({ questions, states: {}, exam: 'ITIL', today, takenForms: ['A', 'B'] }).map((item) => item.id), ['d1']);
});

/* ---------- Practice exams ---------- */

test('forms are the fixed mockA and mockB questions of the exam', () => {
  const bank = [q('a1', { pool: 'mockA' }), q('b1', { pool: 'mockB' }), q('a2', { pool: 'mockA' }), q('p1', { pool: 'mockA', certification: 'PMP' })];
  assert.deepEqual(formQuestions(bank, 'ITIL', 'A').map((item) => item.id), ['a1', 'a2']);
  assert.deepEqual(formQuestions(bank, 'ITIL', 'B').map((item) => item.id), ['b1']);
});

test('scoring counts every question, unanswered as wrong, and splits by area', () => {
  assert.equal(areaOf('Guiding principles · focus on value'), 'Guiding principles');
  assert.equal(areaOf('Practices'), 'Practices');
  const questions = [
    q('1', { domain: 'Value · outcomes', correct: 'A' }),
    q('2', { domain: 'Value · costs', correct: 'B' }),
    q('3', { domain: 'Practices · incident', correct: 'C' }),
    q('4', { domain: 'Practices · problem', correct: 'D' }),
    q('5', { domain: 'Practices · change', correct: 'A' }),
    q('6', { domain: 'Value · risks', correct: 'A' }),
  ];
  const score = scoreExam(questions, { 1: 'A', 2: 'C', 3: 'C', 4: undefined, 6: 'A' });
  assert.deepEqual(score, {
    total: 6,
    right: 3,
    percent: 50,
    areas: [
      { area: 'Value', total: 3, right: 2, percent: 66.7 },
      { area: 'Practices', total: 3, right: 1, percent: 33.3 },
    ],
  });
  assert.deepEqual(scoreExam(questions, {}).right, 0);
  assert.deepEqual(scoreExam([], {}), { total: 0, right: 0, percent: 0, areas: [] });
});

test('after an exam: misses and unanswered due in 2 days, the rest seen today', () => {
  const today = '2026-12-19';
  const questions = [q('miss', { correct: 'A' }), q('blank', { correct: 'B' }), q('new-right', { correct: 'C' }), q('known-right', { correct: 'D' })];
  const srs = emptySrs();
  srs.questions['known-right'] = { stage: 2, due: '2026-12-24', last: '2026-12-10', first: '2026-12-01' };
  srs.questions.miss = { stage: 3, due: '2026-12-30', last: '2026-12-09', first: '2026-12-09' };
  const next = afterExam(srs, questions, { miss: 'B', 'new-right': 'C', 'known-right': 'D' }, today);
  assert.deepEqual(next.questions.miss, { stage: 1, due: '2026-12-21', last: today, first: '2026-12-09' });
  assert.deepEqual(next.questions.blank, { stage: 1, due: '2026-12-21', last: today, first: today });
  assert.deepEqual(next.questions['new-right'], { stage: 3, due: '2027-01-09', last: today, first: today });
  assert.deepEqual(next.questions['known-right'], { stage: 2, due: '2026-12-24', last: today, first: '2026-12-01' });
  assert.deepEqual(next.delayed, { ITIL: { total: 2, right: 1 } });
  assert.deepEqual(srs.questions['known-right'].last, '2026-12-10');
});

test('a later exam draws by area from questions not seen in 14 days, the same for the same seed', () => {
  const today = '2027-01-20';
  const bank: StudyQuestionLike[] = [];
  ['Value', 'Practices', 'Principles'].forEach((area) => {
    for (let index = 0; index < 10; index += 1) bank.push(q(`${area}-${index}`, { domain: `${area} · part`, pool: index < 5 ? 'mockA' : 'daily' }));
  });
  bank.push(q('pmp', { certification: 'PMP', domain: 'People · team' }));
  const states: Record<string, QuestionState> = {
    'Value-0': { stage: 1, due: '2027-01-22', last: '2027-01-07', first: '2026-12-01' },
    'Value-1': { stage: 1, due: '2027-01-22', last: '2027-01-06', first: '2026-12-01' },
  };
  const draw = drawExam({ questions: bank, states, exam: 'ITIL', count: 12, today, seed: 42 });
  assert.equal(draw.length, 12);
  assert.ok(!draw.some((item) => item.id === 'Value-0'));
  assert.ok(draw.every((item) => item.certification === 'ITIL'));
  assert.equal(new Set(draw.map((item) => item.id)).size, 12);
  const byArea = (items: StudyQuestionLike[]) =>
    items.reduce<Record<string, number>>((all, item) => ({ ...all, [areaOf(item.domain)]: (all[areaOf(item.domain)] ?? 0) + 1 }), {});
  // 29 candidates (Value-0 seen 13 days ago): 9, 10, 10 shares of 12 give 4, 4, 4.
  assert.deepEqual(byArea(draw), { Value: 4, Practices: 4, Principles: 4 });
  assert.deepEqual(drawExam({ questions: bank, states, exam: 'ITIL', count: 12, today, seed: 42 }).map((item) => item.id), draw.map((item) => item.id));
  assert.notDeepEqual(drawExam({ questions: bank, states, exam: 'ITIL', count: 12, today, seed: 7 }).map((item) => item.id), draw.map((item) => item.id));

  const mixed = drawExam({ questions: bank, states, exam: 'ITIL', count: 12, today, seed: 'week 9', mix: { Value: 2, Practices: 6, Principles: 4 } });
  assert.deepEqual(byArea(mixed), { Value: 2, Practices: 6, Principles: 4 });
  const short = drawExam({ questions: bank, states, exam: 'ITIL', count: 12, today, seed: 3, mix: { Value: 20 } });
  assert.equal(short.length, 12);
  assert.equal(byArea(short).Value, 9);
  // Too few not seen in 14 days: the rest come from those seen longest ago.
  const all = drawExam({ questions: bank, states, exam: 'ITIL', count: 50, today, seed: 1 });
  assert.equal(all.length, 30);
  assert.ok(all.some((item) => item.id === 'Value-0'));
  const recent: Record<string, QuestionState> = Object.fromEntries(bank.map((item, index) => [item.id, { stage: 1, due: today, last: `2027-01-${String(10 + (index % 9)).padStart(2, '0')}`, first: '2026-12-01' }]));
  const filled = drawExam({ questions: bank, states: recent, exam: 'ITIL', count: 12, today, seed: 5 });
  assert.equal(filled.length, 12);
  assert.ok(filled.every((item) => recent[item.id].last <= '2027-01-12'));
});

test('a practice exam shorter than the exam size does not count toward Ready to book', () => {
  const sized = { ...block, exam: { target: 80, questions: 40 } };
  const short = { ...result('draw-1', '2027-01-01', 14, even(14)), total: 15 };
  const checks = readyToBook({ block: sized, done: [], results: [short, result('A', '2027-01-10', 36, even(36))], today: '2027-01-20' });
  assert.equal(checks[1].met, false);
});

test('a question answered a second time on the same day is not graded again', () => {
  const question = q('same-day');
  const once = recordQuestionAnswer({ cards: {}, questions: {} }, question, 'wrong', '2026-11-28');
  const twice = recordQuestionAnswer(once, question, 'right', '2026-11-28');
  assert.deepEqual(twice, once);
  assert.equal(twice.questions['same-day'].due, '2026-11-30');
});

test('a review morning tops up to 30 with questions already seen, not retired first, oldest answered first', () => {
  const today = '2026-12-10';
  const bank: StudyQuestionLike[] = [];
  for (let index = 0; index < 40; index += 1) bank.push(q(`r-${index}`));
  const states: Record<string, QuestionState> = {};
  bank.forEach((item, index) => {
    if (index < 35) states[item.id] = { stage: index < 5 ? 4 : 3, due: '2026-12-30', last: `2026-12-${String(1 + (index % 9)).padStart(2, '0')}`, first: '2026-11-20' };
  });
  states['r-34'] = { ...states['r-34'], last: today };
  const set = dailySet({ questions: bank, states, exam: 'ITIL', today, mode: 'review' });
  assert.equal(set.length, 30);
  assert.ok(!set.some((item) => item.id === 'r-34'));
  assert.equal(set.filter((item) => !states[item.id]).length, 5);
  // 29 seen and not retired (r-5 to r-33); 25 are needed, so no retired one.
  assert.ok(!set.some((item) => ['r-0', 'r-1', 'r-2', 'r-3', 'r-4'].includes(item.id)));
  assert.equal(dailySet({ questions: bank, states, exam: 'ITIL', today, mode: 'learn' }).length, 5);
});

/* ---------- Ready to book ---------- */

const block: BookingBlockLike = {
  cert: 'ITIL',
  mornings: [
    { key: 'itil-m1', kind: 'learn' },
    { key: 'itil-m2', kind: 'learn' },
    { key: 'itil-r1', kind: 'review' },
    { key: 'itil-p1', kind: 'repair' },
  ],
  exam: { target: 80 },
};

const result = (form: string, date: string, right: number, areas: [string, number, number][], exam = 'ITIL'): ExamResult => ({
  exam,
  form,
  date,
  total: 40,
  right,
  areas: areas.map(([area, total, rightInArea]) => ({ area, total, right: rightInArea, percent: (rightInArea * 100) / total })),
});
const even = (right: number): [string, number, number][] => [
  ['Value', 20, right / 2],
  ['Practices', 20, right / 2],
];

test('booking check 1: every learn morning done', () => {
  const base = { block, results: [], today: '2027-01-20' };
  const notYet = readyToBook({ ...base, done: ['itil-m1', 'itil-r1', 'itil-p1'] })[0];
  assert.deepEqual(notYet, { key: 'mornings', met: false, title: 'Every learn morning done', detail: '1 of 2 learn mornings done.' });
  const met = readyToBook({ ...base, done: new Set(['itil-m1', 'itil-m2']) })[0];
  assert.equal(met.met, true);
  assert.equal(met.detail, '2 of 2 learn mornings done.');
});

test('booking check 2: two different forms at the target, 7 days apart', () => {
  const today = '2027-01-20';
  const check = (results: ExamResult[]) => readyToBook({ block, done: [], results, today })[1];
  assert.equal(check([]).met, false);
  assert.match(check([]).detail, /No practice exam yet/);
  assert.equal(check([result('A', '2027-01-02', 30, even(30))]).met, false);
  // Same form twice does not count.
  assert.equal(check([result('A', '2027-01-02', 34, even(34)), result('A', '2027-01-12', 36, even(36))]).met, false);
  // Different forms only 6 days apart.
  const close = check([result('A', '2027-01-02', 34, even(34)), result('B', '2027-01-08', 36, even(36))]);
  assert.equal(close.met, false);
  assert.match(close.detail, /on or after 2027-01-09/);
  // One under the target.
  assert.equal(check([result('A', '2027-01-02', 31, even(30)), result('B', '2027-01-09', 36, even(36))]).met, false);
  // A result dated after today, or for another exam, is ignored.
  assert.equal(check([result('A', '2027-01-02', 34, even(34)), result('B', '2027-01-25', 36, even(36))]).met, false);
  assert.equal(check([result('A', '2027-01-02', 34, even(34)), result('B', '2027-01-09', 36, even(36), 'PMP')]).met, false);
  const met = check([result('A', '2026-12-30', 32, even(32)), result('B', '2027-01-06', 36, even(36))]);
  assert.equal(met.met, true);
  assert.equal(met.detail, 'Form A 80% on 2026-12-30 and form B 90% on 2027-01-06, 7 days apart.');
  // A random draw counts as a different form.
  assert.equal(check([result('B', '2027-01-02', 34, even(34)), result('draw-1', '2027-01-09', 34, even(34))]).met, true);
});

test('booking check 3: no area of 5 or more questions over 10 points under overall', () => {
  const today = '2027-01-20';
  const check = (results: ExamResult[]) => readyToBook({ block, done: [], results, today })[2];
  assert.equal(check([]).met, 'not-enough-data');
  // Pooled: 68 of 80 = 85%. Practices 28/40 = 70%: 15 under. A 4-question area at 0% is ignored.
  const weak = check([
    result('A', '2027-01-02', 34, [['Value', 20, 20], ['Practices', 20, 14]]),
    result('B', '2027-01-09', 34, [['Value', 16, 16], ['Practices', 20, 14], ['Tiny', 4, 4]]),
  ]);
  assert.equal(weak.met, false);
  assert.match(weak.detail, /^Practices is at 70%/);
  const fine = check([
    result('A', '2027-01-02', 34, [['Value', 20, 18], ['Practices', 16, 16], ['Tiny', 4, 0]]),
    result('B', '2027-01-09', 34, [['Value', 20, 17], ['Practices', 20, 17]]),
  ]);
  assert.equal(fine.met, true);
  // With several passing pairs, a pair with no weak area is used.
  const pick = readyToBook({
    block,
    done: [],
    today,
    results: [
      result('A', '2027-01-02', 34, [['Value', 20, 20], ['Practices', 20, 14]]),
      result('B', '2027-01-09', 34, [['Value', 20, 20], ['Practices', 20, 14]]),
      result('A', '2026-12-20', 34, [['Value', 20, 17], ['Practices', 20, 17]]),
      result('B', '2026-12-28', 34, [['Value', 20, 17], ['Practices', 20, 17]]),
    ],
  });
  assert.equal(pick[1].met, true);
  assert.equal(pick[2].met, true);
});

test('booking check 4: delayed reviews at 80%, after at least 20', () => {
  const check = (delayed?: { total: number; right: number }) => readyToBook({ block, done: [], results: [], delayed, today: '2027-01-20' })[3];
  assert.equal(check().met, 'not-enough-data');
  assert.match(check({ total: 19, right: 19 }).detail, /^Not enough reviews yet: 19 of 20/);
  assert.equal(check({ total: 19, right: 19 }).met, 'not-enough-data');
  assert.equal(check({ total: 20, right: 16 }).met, true);
  assert.equal(check({ total: 25, right: 19 }).met, false);
  assert.equal(check({ total: 25, right: 19 }).detail, '19 of 25 right (76%) on questions seen 7 or more days earlier.');
});

test('all four checks together', () => {
  const checks = readyToBook({
    block,
    done: ['itil-m1', 'itil-m2'],
    results: [result('A', '2026-12-30', 32, even(32)), result('B', '2027-01-06', 36, even(36))],
    delayed: { total: 30, right: 27 },
    today: '2027-01-20',
  });
  assert.deepEqual(checks.map((item) => item.key), ['mornings', 'exams', 'areas', 'reviews']);
  assert.ok(allChecksMet(checks));
  checks.forEach((item) => assert.ok(item.title && item.detail && !/\u2014/.test(item.detail)));
  assert.ok(!allChecksMet(readyToBook({ block, done: ['itil-m1', 'itil-m2'], results: [], today: '2027-01-20' })));
});

/* ---------- Estimated dates ---------- */

const planBlocks = [
  {
    key: 'itil',
    mornings: [
      { key: 'itil-m1', kind: 'learn' },
      { key: 'itil-m2', kind: 'learn' },
      { key: 'itil-r1', kind: 'review' },
      { key: 'itil-m3', kind: 'learn' },
      { key: 'itil-r2', kind: 'review' },
      { key: 'itil-p1', kind: 'repair' },
    ],
    weekends: [
      { key: 'itil-w1', kind: 'lab', after: 'itil-r1' },
      { key: 'itil-w2', kind: 'mock', after: 'itil-r2' },
      { key: 'itil-w3', kind: 'mock', after: 'itil-p1' },
    ],
  },
  { key: 'pl300', mornings: [], weekends: [] },
  { key: 'pmp', mornings: [{ key: 'pmp-m1', kind: 'learn' }], weekends: [] },
];

const asMap = (items: ReturnType<typeof estimateDates>) => Object.fromEntries(items.map((item) => [item.key, item.date]));

test('estimated dates: 5 mornings and one weekend block a week from the start date', () => {
  // Start Thursday 26 November 2026; today is earlier.
  const estimate = estimateDates({ blocks: planBlocks, startDate: '2026-11-26', done: [], today: '2026-11-20' });
  assert.deepEqual(asMap(estimate), {
    'itil-m1': '2026-11-26',
    'itil-m2': '2026-11-27',
    'itil-r1': '2026-11-30',
    'itil-m3': '2026-12-01',
    'itil-r2': '2026-12-02',
    'itil-w1': '2026-12-05',
    // The weekend of 5 December is taken, so practice exam A waits a week.
    'itil-w2': '2026-12-12',
    // The repair morning waits for practice exam A.
    'itil-p1': '2026-12-14',
    'itil-w3': '2026-12-19',
    'itil-exam': '2026-12-21',
    'pl300-exam': null,
    'pmp-m1': '2026-12-22',
    'pmp-exam': '2026-12-23',
  });
  assert.deepEqual(estimate.map((item) => item.kind).slice(0, 10), [
    'morning', 'morning', 'morning', 'morning', 'morning', 'morning', 'weekend', 'weekend', 'weekend', 'exam',
  ]);
  estimate.filter((item) => item.kind === 'morning' && item.date).forEach((item) => assert.ok(![0, 6].includes(weekday(item.date as string))));
});

test('estimated dates start from today when the start date has passed, and skip done items', () => {
  // Today is Saturday 28 November 2026.
  const estimate = estimateDates({ blocks: planBlocks, startDate: '2026-11-02', done: ['itil-m1', 'itil-m2'], today: '2026-11-28' });
  const map = asMap(estimate);
  assert.equal(map['itil-m1'], null);
  assert.ok(estimate.find((item) => item.key === 'itil-m1')?.done);
  assert.equal(map['itil-r1'], '2026-11-30');
  assert.equal(map['itil-w1'], '2026-12-05');
  assert.equal(map['itil-exam'], '2026-12-21');

  // A weekend block whose morning is done can be today.
  const weekendNow = estimateDates({
    blocks: [{ key: 'b', mornings: [{ key: 'b-m1', kind: 'learn' }], weekends: [{ key: 'b-w1', kind: 'lab', after: 'b-m1' }] }],
    startDate: '2026-11-02',
    done: ['b-m1'],
    today: '2026-11-28',
  });
  assert.deepEqual(asMap(weekendNow), { 'b-m1': null, 'b-w1': '2026-11-28', 'b-exam': '2026-11-30' });
});
