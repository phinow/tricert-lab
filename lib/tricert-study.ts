/* The study engine for version 8: flashcards, spaced question review, the
   daily question set, practice exams, the booking gate and estimated dates.
   Pure functions only. Nothing here imports React or reads the clock: every
   function that needs a date takes today as a local YYYY-MM-DD string. */
import type { ScenarioQuestion } from './tricert-content';

/* ---------- Dates ---------- */

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 86_400_000;

function toUtc(date: string): number {
  const match = DATE_PATTERN.exec(date);
  if (!match) throw new Error(`Not a YYYY-MM-DD date: ${date}`);
  const value = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  if (new Date(value).toISOString().slice(0, 10) !== date) throw new Error(`Not a real date: ${date}`);
  return value;
}

function fromUtc(value: number): string {
  return new Date(value).toISOString().slice(0, 10);
}

/** True when the text is a real YYYY-MM-DD date. */
export function isStudyDate(date: string): boolean {
  try {
    toUtc(date);
    return true;
  } catch {
    return false;
  }
}

/** The date a number of days after (or before, when negative) the given date. */
export function addDays(date: string, days: number): string {
  return fromUtc(toUtc(date) + days * DAY_MS);
}

/** Whole days from one date to another: positive when `to` is later. */
export function daysBetween(from: string, to: string): number {
  return Math.round((toUtc(to) - toUtc(from)) / DAY_MS);
}

/** Day of the week: 0 Sunday, 1 Monday, ... 6 Saturday. */
export function weekday(date: string): number {
  return new Date(toUtc(date)).getUTCDay();
}

function later(a: string, b: string): string {
  return a > b ? a : b;
}

/* ---------- Hashing and seeded random numbers ---------- */

/** A stable 53-bit hash of a text, written in base 36. */
export function stableHash(text: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    h1 = Math.imul(h1 ^ code, 2654435761);
    h2 = Math.imul(h2 ^ code, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

function seededRandom(seed: number | string): () => number {
  let state = typeof seed === 'number' ? seed >>> 0 : parseInt(stableHash(seed), 36) >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled<T>(items: T[], random: () => number): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const pick = Math.floor(random() * (index + 1));
    [copy[index], copy[pick]] = [copy[pick], copy[index]];
  }
  return copy;
}

/* ---------- Saved record shape ---------- */

/** Flashcard state. Stage 0 is learning (new or after Again); stages 1 to 5
    follow Good answers; stage 6 is retired. `first` is the day the card was
    first studied, used for the limit of 8 new cards a day. */
export type CardState = { stage: number; due: string; first?: string };

/** Question state. Stage 1, 2 and 3 wait 2, 7 and 21 days; stage 4 is
    retired. `last` is the day it was last answered, `first` the day of the
    first answer (used by the delayed-review check). */
export type QuestionState = { stage: number; due: string; last: string; first: string };

/** Review answers given 7 or more days after a question's first answer. */
export type DelayedCount = { total: number; right: number };

/** The `srs` record. `delayed` is keyed by exam (the question's certification). */
export type SrsRecord = {
  cards: Record<string, CardState>;
  questions: Record<string, QuestionState>;
  delayed?: Record<string, DelayedCount>;
};

export function emptySrs(): SrsRecord {
  return { cards: {}, questions: {}, delayed: {} };
}

/* ---------- Cards ---------- */

export const CARD_INTERVALS = [1, 3, 7, 16, 35] as const;
export const CARD_RETIRED = CARD_INTERVALS.length + 1;
export const NEW_CARDS_PER_DAY = 8;

export type CardGrade = 'again' | 'good';

/** A flashcard as the engine needs it. `lesson` is the morning key that teaches it. */
export type StudyCard = { exam: string; front: string; back?: string; lesson?: string };

export type CardPick<C extends StudyCard = StudyCard> = { id: string; card: C; isNew: boolean };

/** `card:` plus a stable hash of the exam and the front text (spaces tidied). */
export function cardId(exam: string, front: string): string {
  const tidy = front.trim().replace(/\s+/g, ' ');
  return `card:${stableHash(`${exam.trim()}\n${tidy}`)}`;
}

export function isCardRetired(state: CardState | undefined): boolean {
  return Boolean(state && state.stage >= CARD_RETIRED);
}

/** Good moves to the next stage (1, 3, 7, 16, 35 days, then retired).
    Again goes back to stage 0, due tomorrow. */
export function gradeCard(previous: CardState | undefined, grade: CardGrade, today: string): CardState {
  const first = previous?.first ?? (previous ? undefined : today);
  const keep = first ? { first } : {};
  if (grade === 'again') return { stage: 0, due: addDays(today, 1), ...keep };
  const stage = Math.min((previous?.stage ?? 0) + 1, CARD_RETIRED);
  if (stage >= CARD_RETIRED) return { stage: CARD_RETIRED, due: today, ...keep };
  return { stage, due: addDays(today, CARD_INTERVALS[stage - 1]), ...keep };
}

/** State for a card he writes himself in Mistakes: due tomorrow, and not
    counted against the 8 new cards a day. */
export function startCard(today: string): CardState {
  return { stage: 0, due: addDays(today, 1) };
}

/** Cards due today (oldest due first, then bank order), then new cards from
    the given lesson in bank order, up to 8 new a day counting cards already
    started today. */
export function cardsForToday<C extends StudyCard>(input: {
  cards: C[];
  states: Record<string, CardState>;
  today: string;
  lesson?: string;
  newLimit?: number;
}): CardPick<C>[] {
  const { cards, states, today, lesson } = input;
  const seen = new Set<string>();
  const unique: { id: string; card: C; index: number }[] = [];
  cards.forEach((card, index) => {
    const id = cardId(card.exam, card.front);
    if (seen.has(id)) return;
    seen.add(id);
    unique.push({ id, card, index });
  });
  const due = unique
    .filter(({ id }) => states[id] && !isCardRetired(states[id]) && states[id].due <= today)
    .sort((a, b) => (states[a.id].due < states[b.id].due ? -1 : states[a.id].due > states[b.id].due ? 1 : a.index - b.index))
    .map(({ id, card }) => ({ id, card, isNew: false }));
  const startedToday = Object.values(states).filter((state) => state.first === today).length;
  const room = Math.max(0, (input.newLimit ?? NEW_CARDS_PER_DAY) - startedToday);
  const fresh = lesson
    ? unique
        .filter(({ id, card }) => card.lesson === lesson && !states[id])
        .slice(0, room)
        .map(({ id, card }) => ({ id, card, isNew: true }))
    : [];
  return [...due, ...fresh];
}

/** One card waiting in today's run. `repeat` marks the extra showing after Again. */
export type CardQueueItem = { id: string; repeat: boolean };

export function cardQueue(picks: { id: string }[]): CardQueueItem[] {
  return picks.map(({ id }) => ({ id, repeat: false }));
}

/** Answer the card at the front of the queue. Again saves the reset and puts
    the card at the back once more for today; the repeat showing does not
    change the saved state. */
export function answerCard(
  queue: CardQueueItem[],
  states: Record<string, CardState>,
  grade: CardGrade,
  today: string,
): { queue: CardQueueItem[]; states: Record<string, CardState> } {
  const [head, ...rest] = queue;
  if (!head) return { queue, states };
  if (head.repeat) return { queue: rest, states };
  const nextStates = { ...states, [head.id]: gradeCard(states[head.id], grade, today) };
  const nextQueue = grade === 'again' ? [...rest, { id: head.id, repeat: true }] : rest;
  return { queue: nextQueue, states: nextStates };
}

/* ---------- Questions ---------- */

/** right: right and marked Sure. guess: marked Guess (counted as not right).
    wrong: the wrong option, or no answer. */
export type QuestionResult = 'right' | 'wrong' | 'guess';

export const QUESTION_INTERVALS = [2, 7, 21] as const;
export const QUESTION_RETIRED = QUESTION_INTERVALS.length + 1;
export const DELAYED_REVIEW_DAYS = 7;

/** The fields of a bank question the engine reads. */
export type StudyQuestionLike = Pick<ScenarioQuestion, 'id' | 'certification' | 'domain' | 'correct'> & {
  pool?: string;
  lesson?: string;
};

/** A bank question with the version 8 fields (`pool`, `lesson`). */
export type StudyQuestion = ScenarioQuestion & { pool?: string; lesson?: string };

export function isQuestionRetired(state: QuestionState | undefined): boolean {
  return Boolean(state && state.stage >= QUESTION_RETIRED);
}

/** Right and sure on first sight: one check after 21 days, then retired.
    Wrong or guessed: back after 2, 7 and 21 days; each step needs right and
    sure, and a miss restarts at 2. */
export function gradeQuestion(previous: QuestionState | undefined, result: QuestionResult, today: string): QuestionState {
  const first = previous?.first ?? today;
  if (result !== 'right') return { stage: 1, due: addDays(today, QUESTION_INTERVALS[0]), last: today, first };
  if (!previous) return { stage: 3, due: addDays(today, QUESTION_INTERVALS[2]), last: today, first };
  const stage = Math.min(previous.stage + 1, QUESTION_RETIRED);
  if (stage >= QUESTION_RETIRED) return { stage: QUESTION_RETIRED, due: today, last: today, first };
  return { stage, due: addDays(today, QUESTION_INTERVALS[stage - 1]), last: today, first };
}

/** True when an answer today is a delayed review: the question was first
    answered 7 or more days ago. */
export function isDelayedReview(previous: QuestionState | undefined, today: string): boolean {
  return Boolean(previous && daysBetween(previous.first, today) >= DELAYED_REVIEW_DAYS);
}

function countDelayed(
  delayed: Record<string, DelayedCount> | undefined,
  exam: string,
  previous: QuestionState | undefined,
  right: boolean,
  today: string,
): Record<string, DelayedCount> {
  const all = { ...(delayed ?? {}) };
  if (!isDelayedReview(previous, today)) return all;
  const count = all[exam] ?? { total: 0, right: 0 };
  all[exam] = { total: count.total + 1, right: count.right + (right ? 1 : 0) };
  return all;
}

/** Save one answer: the question's new state and the exam's delayed-review count. */
export function recordQuestionAnswer(
  srs: SrsRecord,
  question: Pick<StudyQuestionLike, 'id' | 'certification'>,
  result: QuestionResult,
  today: string,
): SrsRecord {
  const previous = srs.questions[question.id];
  return {
    ...srs,
    questions: { ...srs.questions, [question.id]: gradeQuestion(previous, result, today) },
    delayed: countDelayed(srs.delayed, question.certification, previous, result === 'right', today),
  };
}

/* ---------- Pools and the daily set ---------- */

/** The pool name of a practice exam form: 'A' gives 'mockA'. */
export function formPool(form: string): string {
  return `mock${form}`;
}

/** The form letter of a practice exam pool, or undefined for other pools. */
export function poolForm(pool: string | undefined): string | undefined {
  const match = pool ? /^mock([A-Z])$/.exec(pool) : null;
  return match ? match[1] : undefined;
}

/** A question can be used outside its practice exam once its form is taken. */
export function isUsable(question: Pick<StudyQuestionLike, 'pool'>, takenForms: string[]): boolean {
  const form = poolForm(question.pool);
  return form === undefined || takenForms.includes(form);
}

function isDailyPool(question: Pick<StudyQuestionLike, 'pool'>): boolean {
  return question.pool === undefined || question.pool === 'daily';
}

export type DailyMode = 'learn' | 'review' | 'short';
export const DAILY_SIZE: Record<DailyMode, number> = { learn: 20, review: 30, short: 20 };
export const NEW_FROM_LESSON = 6;

/** Today's questions: due reviews of any exam (oldest due first), then up to 6
    new questions from the lesson, then other new daily questions of this
    exam, up to the size (20 for a morning, 30 for a review morning). A short
    morning takes due reviews only. Questions in a practice exam form that has
    not been taken are never used. */
export function dailySet<Q extends StudyQuestionLike>(input: {
  questions: Q[];
  states: Record<string, QuestionState>;
  exam: string;
  today: string;
  lesson?: string;
  mode?: DailyMode;
  size?: number;
  takenForms?: string[];
}): Q[] {
  const { questions, states, exam, today, lesson } = input;
  const mode = input.mode ?? 'learn';
  const size = input.size ?? DAILY_SIZE[mode];
  const taken = input.takenForms ?? [];
  const usable = questions
    .map((question, index) => ({ question, index }))
    .filter(({ question }) => isUsable(question, taken));
  const due = usable
    .filter(({ question }) => {
      const state = states[question.id];
      return state && !isQuestionRetired(state) && state.due <= today;
    })
    .sort((a, b) => {
      const da = states[a.question.id].due;
      const db = states[b.question.id].due;
      return da < db ? -1 : da > db ? 1 : a.index - b.index;
    })
    .map(({ question }) => question);
  const picked = due.slice(0, size);
  if (mode === 'short') return picked;
  const fresh = usable
    .map(({ question }) => question)
    .filter((question) => question.certification === exam && !states[question.id]);
  if (lesson) {
    const lessonRoom = Math.min(NEW_FROM_LESSON, size - picked.length);
    picked.push(...fresh.filter((question) => question.lesson === lesson).slice(0, Math.max(0, lessonRoom)));
  }
  const chosen = new Set(picked.map((question) => question.id));
  const room = size - picked.length;
  if (room > 0) picked.push(...fresh.filter((question) => isDailyPool(question) && !chosen.has(question.id)).slice(0, room));
  return picked;
}

/* ---------- Practice exams ---------- */

export const NOT_SEEN_DAYS = 14;

/** The area of a question: the part of its domain before " · ". */
export function areaOf(domain: string): string {
  return domain.split(' · ')[0].trim();
}

/** The fixed questions of a practice exam form, in bank order. */
export function formQuestions<Q extends StudyQuestionLike>(questions: Q[], exam: string, form: string): Q[] {
  const pool = formPool(form);
  return questions.filter((question) => question.certification === exam && question.pool === pool);
}

/** A practice exam drawn at random by area from this exam's questions not
    answered in the last 14 days. With `mix` (area to count) each area gets
    its count where it can; without it, areas get a share in proportion to
    the questions available. Short areas are filled from the rest. The same
    seed gives the same exam. */
export function drawExam<Q extends StudyQuestionLike>(input: {
  questions: Q[];
  states: Record<string, QuestionState>;
  exam: string;
  count: number;
  today: string;
  seed: number | string;
  mix?: Record<string, number>;
}): Q[] {
  const { questions, states, exam, count, today } = input;
  const random = seededRandom(input.seed);
  const candidates = questions.filter((question) => {
    if (question.certification !== exam) return false;
    const state = states[question.id];
    return !state || daysBetween(state.last, today) >= NOT_SEEN_DAYS;
  });
  const byArea = new Map<string, Q[]>();
  candidates.forEach((question) => {
    const area = areaOf(question.domain);
    byArea.set(area, [...(byArea.get(area) ?? []), question]);
  });
  const areas = [...byArea.keys()].sort();
  const target = Math.min(count, candidates.length);
  const quota = new Map<string, number>();
  if (input.mix) {
    areas.forEach((area) => quota.set(area, Math.min(input.mix?.[area] ?? 0, byArea.get(area)?.length ?? 0)));
  } else {
    const shares = areas.map((area) => {
      const exact = (target * (byArea.get(area)?.length ?? 0)) / Math.max(1, candidates.length);
      return { area, whole: Math.floor(exact), rest: exact - Math.floor(exact) };
    });
    let left = target - shares.reduce((sum, share) => sum + share.whole, 0);
    [...shares].sort((a, b) => b.rest - a.rest || (a.area < b.area ? -1 : 1)).forEach((share) => {
      if (left > 0) {
        share.whole += 1;
        left -= 1;
      }
    });
    shares.forEach((share) => quota.set(share.area, share.whole));
  }
  const drawn: Q[] = [];
  const leftover: Q[] = [];
  areas.forEach((area) => {
    const mixed = shuffled(byArea.get(area) ?? [], random);
    const take = Math.min(quota.get(area) ?? 0, target - drawn.length);
    drawn.push(...mixed.slice(0, take));
    leftover.push(...mixed.slice(take));
  });
  drawn.push(...shuffled(leftover, random).slice(0, Math.max(0, target - drawn.length)));
  return shuffled(drawn, random);
}

/** Chosen option letter by question id; a missing answer is wrong. */
export type ExamAnswers = Record<string, string | undefined>;

export type AreaScore = { area: string; total: number; right: number; percent: number };
export type ExamScore = { total: number; right: number; percent: number; areas: AreaScore[] };

function percentOf(right: number, total: number): number {
  return total ? Math.round((right * 1000) / total) / 10 : 0;
}

/** Score every question; unanswered counts as wrong. Areas in first-seen order. */
export function scoreExam(questions: StudyQuestionLike[], answers: ExamAnswers): ExamScore {
  const areas = new Map<string, { total: number; right: number }>();
  let right = 0;
  questions.forEach((question) => {
    const area = areaOf(question.domain);
    const row = areas.get(area) ?? { total: 0, right: 0 };
    const correct = answers[question.id] === question.correct;
    row.total += 1;
    if (correct) {
      row.right += 1;
      right += 1;
    }
    areas.set(area, row);
  });
  return {
    total: questions.length,
    right,
    percent: percentOf(right, questions.length),
    areas: [...areas].map(([area, row]) => ({ area, ...row, percent: percentOf(row.right, row.total) })),
  };
}

/** After a practice exam: misses (and unanswered) restart at 2 days; right
    answers to new questions get their 21-day check; right answers to known
    questions are marked seen today. Delayed-review counts are kept too. */
export function afterExam(srs: SrsRecord, questions: StudyQuestionLike[], answers: ExamAnswers, today: string): SrsRecord {
  let next: SrsRecord = { ...srs, questions: { ...srs.questions }, delayed: { ...(srs.delayed ?? {}) } };
  questions.forEach((question) => {
    const right = answers[question.id] === question.correct;
    const previous = next.questions[question.id];
    if (!right || !previous) {
      next = recordQuestionAnswer(next, question, right ? 'right' : 'wrong', today);
      return;
    }
    next = {
      ...next,
      questions: { ...next.questions, [question.id]: { ...previous, last: today } },
      delayed: countDelayed(next.delayed, question.certification, previous, true, today),
    };
  });
  return next;
}

/* ---------- Ready to book ---------- */

/** One practice exam result. `form` is 'A', 'B' or a label for a random draw;
    two results with different labels count as different forms. */
export type ExamResult = {
  id?: string;
  exam?: string;
  form: string;
  date: string;
  total: number;
  right: number;
  areas: AreaScore[];
};

export type BookingBlockLike = {
  cert?: string;
  mornings: { key: string; kind: string }[];
  exam: { target: number };
};

export type CheckMet = boolean | 'not-enough-data';
export type BookingCheck = { key: 'mornings' | 'exams' | 'areas' | 'reviews'; met: CheckMet; title: string; detail: string };

export const BOOKING_GAP_DAYS = 7;
export const AREA_MIN_QUESTIONS = 5;
export const AREA_MAX_GAP = 10;
export const DELAYED_MIN_ANSWERS = 20;
export const DELAYED_TARGET = 80;

function formName(form: string): string {
  return /^[A-Z]$/.test(form) ? `Form ${form}` : 'A random exam';
}

function pooledAreas(results: ExamResult[]): { overall: number; areas: AreaScore[] } {
  const rows = new Map<string, { total: number; right: number }>();
  let total = 0;
  let right = 0;
  results.forEach((result) => {
    total += result.total;
    right += result.right;
    result.areas.forEach((area) => {
      const row = rows.get(area.area) ?? { total: 0, right: 0 };
      rows.set(area.area, { total: row.total + area.total, right: row.right + area.right });
    });
  });
  return {
    overall: total ? (right * 100) / total : 0,
    areas: [...rows].map(([area, row]) => ({ area, ...row, percent: row.total ? (row.right * 100) / row.total : 0 })),
  };
}

function weakAreas(pair: ExamResult[]): AreaScore[] {
  const { overall, areas } = pooledAreas(pair);
  return areas.filter((area) => area.total >= AREA_MIN_QUESTIONS && area.percent < overall - AREA_MAX_GAP);
}

/** The four checks before booking the real exam. Results dated after today
    are ignored. Results from other exams are ignored when both carry a cert. */
export function readyToBook(input: {
  block: BookingBlockLike;
  done: Iterable<string>;
  results: ExamResult[];
  delayed?: DelayedCount;
  today: string;
}): BookingCheck[] {
  const { block, today } = input;
  const done = new Set(input.done);
  const target = block.exam.target;

  const learn = block.mornings.filter((morning) => morning.kind === 'learn');
  const learnDone = learn.filter((morning) => done.has(morning.key)).length;
  const mornings: BookingCheck = {
    key: 'mornings',
    met: learn.length > 0 && learnDone === learn.length,
    title: 'Every learn morning done',
    detail: `${learnDone} of ${learn.length} learn mornings done.`,
  };

  const results = input.results.filter(
    (result) => result.date <= today && !(block.cert && result.exam && result.exam !== block.cert),
  );
  const passing = results.filter((result) => result.total > 0 && (result.right * 100) / result.total >= target);
  const pairs: ExamResult[][] = [];
  passing.forEach((a, i) => passing.slice(i + 1).forEach((b) => {
    if (a.form !== b.form && Math.abs(daysBetween(a.date, b.date)) >= BOOKING_GAP_DAYS) {
      pairs.push(a.date <= b.date ? [a, b] : [b, a]);
    }
  }));
  pairs.sort((x, y) => (x[1].date !== y[1].date ? (x[1].date < y[1].date ? 1 : -1) : x[0].date < y[0].date ? 1 : x[0].date > y[0].date ? -1 : 0));
  const pair = pairs.find((candidate) => weakAreas(candidate).length === 0) ?? pairs[0];

  let examsDetail: string;
  if (pair) {
    const [a, b] = pair;
    examsDetail = `${formName(a.form)} ${percentOf(a.right, a.total)}% on ${a.date} and ${formName(b.form).toLowerCase()} ${percentOf(b.right, b.total)}% on ${b.date}, ${daysBetween(a.date, b.date)} days apart.`;
  } else if (passing.length > 0) {
    const best = [...passing].sort((x, y) => (x.date < y.date ? -1 : 1))[0];
    examsDetail = `${formName(best.form)} reached ${percentOf(best.right, best.total)}% on ${best.date}. Pass a different form at ${target}% or more on or after ${addDays(best.date, BOOKING_GAP_DAYS)}.`;
  } else if (results.length > 0) {
    const best = [...results].sort((x, y) => y.right / Math.max(1, y.total) - x.right / Math.max(1, x.total))[0];
    examsDetail = `Best so far ${percentOf(best.right, best.total)}%. You need ${target}% or more on two different forms, 7 days apart.`;
  } else {
    examsDetail = `No practice exam yet. You need ${target}% or more on two different forms, 7 days apart.`;
  }
  const exams: BookingCheck = { key: 'exams', met: Boolean(pair), title: `Two practice exams at ${target}% or more`, detail: examsDetail };

  let areas: BookingCheck;
  if (!pair) {
    areas = { key: 'areas', met: 'not-enough-data', title: 'No weak area', detail: 'Checked once two practice exams pass.' };
  } else {
    const weak = weakAreas(pair).sort((x, y) => x.percent - y.percent);
    const { overall } = pooledAreas(pair);
    areas = weak.length
      ? {
          key: 'areas',
          met: false,
          title: 'No weak area',
          detail: `${weak[0].area} is at ${Math.round(weak[0].percent)}%, more than ${AREA_MAX_GAP} points under your ${Math.round(overall)}% overall.`,
        }
      : {
          key: 'areas',
          met: true,
          title: 'No weak area',
          detail: `Every area with ${AREA_MIN_QUESTIONS} or more questions is within ${AREA_MAX_GAP} points of your ${Math.round(overall)}% overall.`,
        };
  }

  const delayed = input.delayed ?? { total: 0, right: 0 };
  const delayedPercent = delayed.total ? (delayed.right * 100) / delayed.total : 0;
  const reviews: BookingCheck =
    delayed.total < DELAYED_MIN_ANSWERS
      ? {
          key: 'reviews',
          met: 'not-enough-data',
          title: `Delayed reviews at ${DELAYED_TARGET}% or more`,
          detail: `Not enough reviews yet: ${delayed.total} of ${DELAYED_MIN_ANSWERS} answers given 7 or more days after first seeing the question.`,
        }
      : {
          key: 'reviews',
          met: delayedPercent >= DELAYED_TARGET,
          title: `Delayed reviews at ${DELAYED_TARGET}% or more`,
          detail: `${delayed.right} of ${delayed.total} right (${Math.round(delayedPercent)}%) on questions seen 7 or more days earlier.`,
        };

  return [mornings, exams, areas, reviews];
}

/** True when all four checks are met. */
export function allChecksMet(checks: BookingCheck[]): boolean {
  return checks.length > 0 && checks.every((check) => check.met === true);
}

/* ---------- Estimated dates ---------- */

export type EstimateBlockLike = {
  key: string;
  mornings: { key: string; kind: string; after?: string }[];
  weekends: { key: string; kind: string; after: string }[];
};

export type DateEstimate = {
  block: string;
  key: string;
  kind: 'morning' | 'weekend' | 'exam';
  date: string | null;
  done: boolean;
};

function isWeekend(date: string): boolean {
  const day = weekday(date);
  return day === 0 || day === 6;
}

function weekKey(date: string): string {
  return addDays(date, -((weekday(date) + 6) % 7));
}

/** Estimated dates at 5 mornings (Monday to Friday) and one weekend block a
    week, counted from the later of the start date and today. Done items get
    `date: null`. A weekend block waits for its `after` item; a morning waits
    for its `after` item when it has one, and a repair morning waits for the
    block's first practice exam. The exam is the first weekday after the
    block's last item and takes that day's morning. A block with no mornings
    and no weekend blocks yet (being built) gets no exam date. */
export function estimateDates(input: {
  blocks: EstimateBlockLike[];
  startDate: string;
  done: Iterable<string>;
  today: string;
}): DateEstimate[] {
  const done = new Set(input.done);
  const begin = later(input.startDate, input.today);
  const floor = addDays(begin, -1);
  const usedWeeks = new Set<string>();
  const dates = new Map<string, string | null>();
  let lastMorning = floor;
  let lastWeekend = floor;
  const out: DateEstimate[] = [];

  const nextWeekday = (after: string) => {
    let day = addDays(after, 1);
    while (isWeekend(day)) day = addDays(day, 1);
    return day;
  };
  const nextWeekendSlot = (after: string) => {
    let day = addDays(after, 1);
    while (!isWeekend(day) || usedWeeks.has(weekKey(day))) day = addDays(day, 1);
    return day;
  };

  input.blocks.forEach((block) => {
    const keys = new Set([...block.mornings, ...block.weekends].map((item) => item.key));
    const dependencyDate = (key: string | undefined): string | undefined => {
      if (!key || !keys.has(key) || done.has(key)) return floor;
      const date = dates.get(key);
      return date === undefined ? undefined : (date ?? floor);
    };
    const weekendDates: DateEstimate[] = [];
    let nextWeekend = 0;
    const scheduleWeekends = (force: boolean) => {
      while (nextWeekend < block.weekends.length) {
        const weekend = block.weekends[nextWeekend];
        if (done.has(weekend.key)) {
          dates.set(weekend.key, null);
          weekendDates.push({ block: block.key, key: weekend.key, kind: 'weekend', date: null, done: true });
          nextWeekend += 1;
          continue;
        }
        const after = dependencyDate(weekend.after);
        if (after === undefined && !force) return;
        const date = nextWeekendSlot(later(later(after ?? floor, lastWeekend), floor));
        usedWeeks.add(weekKey(date));
        lastWeekend = date;
        dates.set(weekend.key, date);
        weekendDates.push({ block: block.key, key: weekend.key, kind: 'weekend', date, done: false });
        nextWeekend += 1;
      }
    };

    const firstMock = block.weekends.find((weekend) => weekend.kind === 'mock')?.key;
    const morningDates: DateEstimate[] = block.mornings.map((morning) => {
      if (done.has(morning.key)) {
        dates.set(morning.key, null);
        scheduleWeekends(false);
        return { block: block.key, key: morning.key, kind: 'morning', date: null, done: true };
      }
      const needs = morning.after ?? (morning.kind === 'repair' ? firstMock : undefined);
      let after = dependencyDate(needs);
      if (after === undefined) {
        scheduleWeekends(false);
        after = dependencyDate(needs) ?? floor;
      }
      const date = nextWeekday(later(lastMorning, after));
      lastMorning = date;
      dates.set(morning.key, date);
      scheduleWeekends(false);
      return { block: block.key, key: morning.key, kind: 'morning', date, done: false };
    });
    scheduleWeekends(true);
    out.push(...morningDates, ...weekendDates);

    if (keys.size === 0) {
      out.push({ block: block.key, key: `${block.key}-exam`, kind: 'exam', date: null, done: false });
      return;
    }
    const blockLast = [...morningDates, ...weekendDates].reduce(
      (latest, item) => (item.date ? later(latest, item.date) : latest),
      lastMorning,
    );
    const examDate = nextWeekday(blockLast);
    lastMorning = examDate;
    dates.set(`${block.key}-exam`, examDate);
    out.push({ block: block.key, key: `${block.key}-exam`, kind: 'exam', date: examDate, done: false });
  });
  return out;
}
