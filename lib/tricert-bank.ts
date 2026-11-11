/* The question bank and card list for version 8, connected to the study engine.
   Pure data and functions: no React, no clock. Dates are passed in as YYYY-MM-DD.
   Imports carry .ts so node --test can load this file directly. */
import { flashcards, scenarioBank, type Certification, type ScenarioQuestion } from './tricert-content.ts';
import { examQuestions, extraFlashcards } from './tricert-library.ts';
import { examBlocks, type ExamBlock } from './tricert-plan.ts';
import {
  areaOf,
  cardId,
  cardsForToday,
  dailySet,
  drawExam,
  formQuestions,
  isUsable,
  poolForm,
  type CardPick,
  type DailyMode,
  type ExamResult,
  type SrsRecord,
} from './tricert-study.ts';

export const certifications: Certification[] = ['ITIL', 'PL-300', 'PMP', 'CISSP'];

/* ---------- Questions ---------- */

/** Every exam question of the four exams, in bank order. The 16 cross-exam
    scenarios are not in here: they live in `crossExamScenarios`. */
export const bankQuestions: ScenarioQuestion[] = examQuestions;

/** The 16 cross-exam scenarios (certification 'Intersection'), kept apart from
    the exam banks. They are used only by Practice, Scenarios across exams. */
export const crossExamScenarios: ScenarioQuestion[] = scenarioBank;

/** The question bank of one exam, in bank order. */
export const questionBank: Record<Certification, ScenarioQuestion[]> = {
  ITIL: bankQuestions.filter((question) => question.certification === 'ITIL'),
  'PL-300': bankQuestions.filter((question) => question.certification === 'PL-300'),
  PMP: bankQuestions.filter((question) => question.certification === 'PMP'),
  CISSP: bankQuestions.filter((question) => question.certification === 'CISSP'),
};

const byId = new Map<string, ScenarioQuestion>([...bankQuestions, ...crossExamScenarios].map((question) => [question.id, question]));

/** Any exam question or cross-exam scenario by id. */
export function questionById(id: string): ScenarioQuestion | undefined {
  return byId.get(id);
}

/** The questions a lesson teaches, in bank order. With `takenForms`, questions
    from a practice exam form not yet taken are left out; without it, all are
    returned (daily and both forms). */
export function questionsForLesson(lesson: string, takenForms?: string[]): ScenarioQuestion[] {
  return bankQuestions.filter((question) => question.lesson === lesson && (!takenForms || isUsable(question, takenForms)));
}

/** The exam block of a certification. */
export function blockFor(exam: Certification): ExamBlock {
  const block = examBlocks.find((item) => item.cert === exam);
  if (!block) throw new Error(`No exam block for ${exam}.`);
  return block;
}

/** The fixed questions of a practice exam form ('A' or 'B'), in bank order. */
export function practiceForm(exam: Certification, form: string): ScenarioQuestion[] {
  return formQuestions(questionBank[exam], exam, form);
}

/** Questions per area in form A, the mix every drawn exam follows. Empty when
    the exam has no form A yet. */
export function areaMix(exam: Certification): Record<string, number> {
  const mix: Record<string, number> = {};
  practiceForm(exam, 'A').forEach((question) => {
    const area = areaOf(question.domain);
    mix[area] = (mix[area] ?? 0) + 1;
  });
  return mix;
}

/** Form letters already taken for this exam, from the `mocks` record. */
export function takenForms(mocks: Pick<ExamResult, 'exam' | 'form'>[], exam: Certification): string[] {
  const forms = mocks.filter((result) => result.exam === exam && /^[A-Z]$/.test(result.form)).map((result) => result.form);
  return [...new Set(forms)].sort();
}

/** The next practice exam: form A, then form B, then a random draw by area
    from questions not answered in the last 14 days. A form with no questions
    is skipped. `seed` makes the draw repeatable (use the mock's id). */
export function nextPracticeExam(input: {
  exam: Certification;
  mocks: Pick<ExamResult, 'exam' | 'form'>[];
  srs: SrsRecord;
  today: string;
  seed: string | number;
}): { form: string; questions: ScenarioQuestion[] } {
  const { exam, mocks, srs, today, seed } = input;
  const taken = takenForms(mocks, exam);
  for (const form of ['A', 'B']) {
    if (taken.includes(form)) continue;
    const questions = practiceForm(exam, form);
    if (questions.length) return { form, questions };
  }
  const mix = areaMix(exam);
  const questions = drawExam({
    questions: questionBank[exam].filter((question) => isUsable(question, taken)),
    states: srs.questions,
    exam,
    count: blockFor(exam).exam.questions,
    today,
    seed,
    mix: Object.keys(mix).length ? mix : undefined,
  });
  return { form: `draw-${seed}`, questions };
}

/** Today's questions for a morning: due reviews of any exam first, then new
    questions from the lesson, then other new daily questions of this exam.
    `mocks` is the mocks record, so form questions join once their form is
    taken. With `taught` (lesson keys of learn mornings done), new questions
    from lessons not taught yet are left out; without it they can fill the set. */
export function todaysQuestions(input: {
  exam: Certification;
  srs: SrsRecord;
  today: string;
  lesson?: string;
  mode?: DailyMode;
  mocks?: Pick<ExamResult, 'exam' | 'form'>[];
  taught?: Iterable<string>;
}): ScenarioQuestion[] {
  const mocks = input.mocks ?? [];
  const taught = input.taught ? new Set(input.taught) : undefined;
  if (taught && input.lesson) taught.add(input.lesson);
  const usable = bankQuestions.filter((question) => {
    // Each exam's forms are judged by that exam's own taken forms.
    const form = poolForm(question.pool);
    if (form !== undefined && !takenForms(mocks, question.certification as Certification).includes(form)) return false;
    if (!taught || !question.lesson || input.srs.questions[question.id]) return true;
    return taught.has(question.lesson);
  });
  return dailySet({
    questions: usable,
    states: input.srs.questions,
    exam: input.exam,
    today: input.today,
    lesson: input.lesson,
    mode: input.mode,
    // Forms are already filtered per exam above, so every form left is usable.
    takenForms: [...new Set(usable.map((question) => poolForm(question.pool)).filter((form): form is string => Boolean(form)))],
  });
}

/* ---------- Cards ---------- */

/** A flashcard with its engine id. `lesson` is the learn morning that teaches
    it; cards with no lesson leave it out. */
export type BankCard = {
  id: string;
  exam: Certification | 'Intersection';
  front: string;
  back: string;
  lesson?: string;
  source: 'built-in' | 'mine';
};

/** A card he writes in Mistakes, as stored in the `usercards` record
    (append-record with this item; the id is the engine's card id). */
export type UserCard = {
  id: string;
  exam: Certification;
  front: string;
  back: string;
  lesson?: string;
  question?: string;
  created: string;
};

function builtIn(exam: Certification | 'Intersection', front: string, back: string, lesson?: string): BankCard {
  return { id: cardId(exam, front), exam, front, back, ...(lesson ? { lesson } : {}), source: 'built-in' };
}

/** The built-in cards: the original deck, then the library cards (ITIL block
    cards carry a lesson). Ids come from the engine's cardId. */
export const bankCards: BankCard[] = [
  ...flashcards.map(([exam, front, back]) => builtIn(exam, front, back)),
  ...extraFlashcards.map(([exam, front, back, lesson]) => builtIn(exam, front, back, lesson || undefined)),
];

/** Make the usercards item for a rule he wrote in Mistakes. The front is the
    rule's prompt (or the question it came from) and the back is his rule. */
export function makeUserCard(input: { exam: Certification; front: string; back: string; today: string; lesson?: string; question?: string }): UserCard {
  const front = input.front.trim().replace(/\s+/g, ' ');
  return {
    id: cardId(input.exam, front),
    exam: input.exam,
    front,
    back: input.back.trim(),
    ...(input.lesson ? { lesson: input.lesson } : {}),
    ...(input.question ? { question: input.question } : {}),
    created: input.today,
  };
}

/** Built-in cards plus his own, with his own last. A card of his with the
    same id as a built-in card replaces nothing; the built-in card is kept. */
export function allCards(usercards: UserCard[] = []): BankCard[] {
  const known = new Set(bankCards.map((card) => card.id));
  const mine = usercards
    .filter((card) => !known.has(card.id))
    .map((card): BankCard => ({ id: card.id, exam: card.exam, front: card.front, back: card.back, ...(card.lesson ? { lesson: card.lesson } : {}), source: 'mine' }));
  return [...bankCards, ...mine];
}

/** The built-in cards a lesson teaches, in bank order. */
export function cardsForLesson(lesson: string): BankCard[] {
  return bankCards.filter((card) => card.lesson === lesson);
}

/** The cards of one exam (built-in and his own). */
export function cardsForExam(exam: Certification | 'Intersection', usercards: UserCard[] = []): BankCard[] {
  return allCards(usercards).filter((card) => card.exam === exam);
}

/** Today's cards: due cards of any exam first, then up to 8 new cards from
    the lesson. His own cards are due from the day after he writes them, once
    the screen saves startCard(today) for them in srs.cards. */
export function todaysCards(input: { srs: SrsRecord; today: string; lesson?: string; usercards?: UserCard[] }): CardPick<BankCard>[] {
  return cardsForToday({ cards: allCards(input.usercards), states: input.srs.cards, today: input.today, lesson: input.lesson });
}
