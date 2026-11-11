# Version 8 rebuild: one exam at a time

Written 2026-11-11. Moye approved this rebuild after the review of 10 November 2026 (the review data is in the session scratchpad; the decisions are repeated here so this file stands alone).

## Why

- The 13-week plan needs 14.5 hours a week in sessions that average 174 minutes. Moye studies 90 minutes each weekday morning before work plus one 3 to 4 hour weekend block, about 11 hours a week.
- The app had no real practice exams and its readiness score rewarded finishing things.
- Order of exams, one in learning mode at a time: ITIL Foundation (Version 5), PL-300, PMP, CISSP. Earlier exams stay alive through spaced review.

This stage (8.0) builds the new study engine and the ITIL block. The PL-300, PMP and CISSP blocks come in later stages and show as "Being built" until then.

## What Moye sees

Keep the version 7.1 look (dark first, Geist, one accent, five places). One clear action per screen. No new decoration.

- **Today.** One card for the next item: "ITIL, morning 3 of 10", its title, and one button, Start morning. One quiet link below it: Short morning (45 minutes). On Saturday and Sunday the card shows the next weekend block instead, with a link to do a morning. "Waiting on you" stays.
- **A morning (focus mode) is four parts in order,** each with one main button. A step line at the top shows the four parts and the minutes planned for each.
  1. Cards, 10 minutes. Due flashcards one at a time: Show answer, then Again or Good.
  2. Learn, 35 minutes. A short brief from a named Kestrel person, the lesson, then one step he does himself with a model answer he can reveal, then three recall prompts answered from memory before revealing.
  3. Questions, 30 minutes. Up to 20 questions at the exam's real pace. He picks an answer and marks Sure or Guess, then sees the explanation.
  4. Mistakes, 15 minutes. Each wrong or guessed question is listed. He writes one line for each: the rule he missed. Each line becomes a flashcard. Then Finish morning.
- **A short morning** is cards (8 minutes), due questions only (25), mistakes (10). It does not complete the next morning.
- **A review morning** has no lesson: cards, a mixed quiz of 30 questions, mistakes, and a weekly reflection.
- **Weekend blocks** are a lab in a real tool, or a full practice exam.
- **Practice exam.** Exam-sized and timed. No feedback until the end. It ends when time runs out, and unanswered questions are wrong. The result shows the score, the score by area, and every question with its explanation.
- **Plan.** The four exam blocks in order with estimated dates from his start date and pace. The current block lists its mornings and weekend blocks. Blocks not built yet say "Being built".
- **Learn.** The block's lessons, then the library: the 65 Kestrel lessons, the 66 documents, the exam guides and the glossary, unchanged.
- **Practice.** Today's review (due cards and questions) first. Then Practice exam, Flashcards, Scenarios across exams, Labs. The old Timed set and the old Review are removed.
- **Progress.** For the current exam: "Ready to book?" with the four checks below, the practice exam history, and the delayed-review score. Other exams: Not started. The Portfolio tab stays.
- **Setup.** Three short steps: you (name, why); your background (education, months leading projects, months of security work, whether the 35 PMP training hours are done); your rhythm (start date). Fields that are no longer asked keep their defaults.

## Plan data: `lib/tricert-plan.ts` (hand written)

```ts
export type BlockKey = 'itil' | 'pl300' | 'pmp' | 'cissp';
export type Morning = {
  key: string;                 // 'itil-m1', 'itil-r1'
  kind: 'learn' | 'review' | 'repair';
  title: string;
  lesson?: string;             // key in the reading library, same as key for learn mornings
  brief?: { from: string; role: string; text: string; ask: string };
};
export type WeekendBlock = {
  key: string;                 // 'itil-w1'
  kind: 'lab' | 'mock';
  title: string;
  minutes: number;
  form?: 'A' | 'B';            // for kind 'mock'
  steps: string[];             // for kind 'lab'
  after: string;               // morning key that must be done first
};
export type ExamBlock = {
  key: BlockKey; cert: Certification; title: string; summary: string;
  status: 'ready' | 'building';
  mornings: Morning[]; weekends: WeekendBlock[];
  exam: { questions: number; minutes: number; secondsPerQuestion: number; allowBack: boolean; target: number; areas: string[] };
  booking: string[];           // checklist shown when the gate is met
};
export const examBlocks: ExamBlock[];
```

ITIL block: learn mornings `itil-m1` to `itil-m8`, review mornings `itil-r1` (after m4) and `itil-r2` (after m8), repair mornings `itil-p1` and `itil-p2` (after practice exam A). Weekends: `itil-w1` lab (after `itil-r1`), `itil-w2` practice exam A (after `itil-r2`), `itil-w3` practice exam B (at least 7 days after A). Exam config: 40 questions, 60 minutes, 90 seconds a question, going back allowed, target 80.

Topics of the eight ITIL learn mornings (lessons and questions follow this list):

1. `itil-m1` Value, products and services: service, product, value, outputs and outcomes, cost and risk, utility and warranty, the roles of provider and consumer (customer, user, sponsor), service offerings and service relationships.
2. `itil-m2` Value co-creation: how provider and consumer create value together by weighing outcomes, costs, risks, experience and sustainability; digital experience; a short note that Version 5 treats AI as part of normal service work.
3. `itil-m3` The four dimensions and the ITIL Value System, with governance.
4. `itil-m4` The seven guiding principles, applied to situations.
5. `itil-m5` The product and service lifecycle activities, and how they relate to value chain activities and value streams.
6. `itil-m6` Practices, part 1: the 34 practices in two groups; service desk, incident management, service request management, problem management, service level management, monitoring and event management.
7. `itil-m7` Practices, part 2: change enablement, release management, deployment management, service configuration management, IT asset management, information security management, relationship management, supplier management.
8. `itil-m8` Continual improvement and value streams: the improvement model, mapping and managing a value stream, measuring flow; exam technique.

## Study engine: `lib/tricert-study.ts` (pure functions, no React, unit tested)

Dates are local `YYYY-MM-DD` strings passed in. No use of the clock inside the functions.

- **Cards.** State per card `{ stage, due }`. Good moves to the next stage with intervals of 1, 3, 7, 16 and 35 days, then the card retires. Again resets to stage 0, due tomorrow, and shows the card once more today. New cards come from the lesson of the morning being done, at most 8 a day. Card id: `card:` plus a stable hash of exam and front text. Cards he writes in Mistakes are stored in the `usercards` record.
- **Questions.** State per question `{ stage, due, last }`. Right and sure on first sight: one check after 21 days, then retired. Wrong or guessed: comes back after 2, 7 and 21 days; each must be right and sure to move on, and a miss restarts at 2.
- **Daily set.** Due reviews first (oldest first), then up to 6 new questions from today's lesson, then other new `daily` questions of this exam, up to 20. Questions in a practice exam form are never used here until that form has been taken.
- **Practice exam.** Forms A and B are fixed sets tagged in the bank (`pool: 'mockA' | 'mockB'`). Score counts every question; unanswered is wrong. After a form is taken its questions join the spaced review, with misses due in 2 days. After both forms are used, a further exam draws at random, by area, from questions not seen in the last 14 days.
- **Ready to book** (per exam), all four:
  1. Every learn morning of the block is done.
  2. Two different practice exam forms at or above the target, at least 7 days apart.
  3. Over those two exams pooled, no area with 5 or more questions is more than 10 points under the overall score.
  4. Of review answers given 7 or more days after the first attempt, at least 80% are right (needs at least 20 such answers; until then the check shows "Not enough reviews yet").
- **Estimated dates.** From the start date: 5 mornings a week and one weekend block a week.

The old readiness score (coverage, documents, judgment, recall), the 15-minute timed set and the old gate checks are removed.

## Saving

State keeps `profile`, `progress`, `attempts`, `artifacts` and gains `records`.

- New actions on `PUT /api/state`:
  - `patch-record` `{ key: 'plan' | 'srs', patch }`: deep-merges the patch into the stored record (objects merged to three levels; `null` removes a key).
  - `append-record` `{ key: 'mocks' | 'log' | 'usercards', item }`: appends an item that has an `id`; an id already present replaces that item.
- Records: `plan` `{ startDate }`; `srs` `{ cards: {}, questions: {} }`; `mocks` (practice exam results with answers); `log` (one line per morning or weekend block: key, kind, date, minutes, cards, questions, right); `usercards`.
- A finished morning is a `progress` row with the morning key, as today.
- **Hosted copy** (`tools/harness/entry-artifact.tsx`): one small document per record under `data/users/<id>/`: `state` (profile and progress), `attempts`, `rec-<key>`, and `doc-<document key>` for each written document. Every document path must have an even number of segments. Load reads the whole collection once. Every save reads the documents it changes first, applies the change, and writes only those. No write before a successful read. A `state` document in the 7.1.1 shape (attempts and artifacts inside it) is split into the new documents on first load.
- **Local copy** (`lib/tricert-repository.ts`, `app/api/state/route.ts`): a `study_records` table (learner, key, JSON value, updated time) with the same merge rules, validated sizes, and attempts returned as the latest row per question (the 100-row limit goes).
- Drafts of written work are also kept in the browser every two seconds and restored with one quiet line.

## Content

All content rules in `tools/content/BRIEF2.md` still apply. Facts come only from `tools/content/verified-facts.md` and the exam owner's own pages. No em dashes. None of the banned words in `CLAUDE.md`.

- **Lessons** `tools/content/parts2/lessons-itil.json` (`type: "lessons"`, keys `itil-m1` to `itil-m8`), same shape as other lessons, sized for 35 minutes: 1,000 to 1,400 words of reading in 4 to 6 sections, 6 to 10 key terms, a `build` that is one 10-minute applied task with at least 4 steps and a `modelAnswer`, 3 to 5 exam tips with `cert: "ITIL"`, 3 pitfalls, and exactly 3 `check` prompts that test a principle, not a Kestrel name.
- **Questions** `questions-itil-1.json` (40, `pool: "daily"`), `-2.json` (40, `pool: "mockA"`), `-3.json` (40, `pool: "mockB"`), ids `q-itil-025` upward. Same fields as today plus `pool` and `lesson` (the morning that teaches it). `artifactKey` becomes optional. Foundation style: short stems, four options, one right answer, plain definitions and "which practice or principle" items, about half set outside Kestrel. The right option must not be the longest more often than chance, and the letters are balanced. Each practice exam form has the same mix by area: value and value co-creation 7; the four dimensions 4; the ITIL Value System 5; the seven guiding principles 8; the product and service lifecycle 6; practices, improvement and value streams 10. This mix is our choice: PeopleCert's weights were not available to us.
- The 24 existing ITIL questions get `pool: "daily"` and a `lesson`.
- **Flashcards** `flashcards-itil.json`: about 60 cards with a `lesson` tag.
- **Exam guide and facts**: update `lib/tricert-exams.ts` and `verified-facts.md` with what was confirmed on PeopleCert's pages on 10 November 2026 (prices by tier, Take2, rescheduling fees, three renewal routes, 34 practices in two groups, "lifecycle activities", experience and sustainability in value co-creation, ITIL 4 Foundation still sold and planned to end 31 December 2027).
- `tools/content/build-library.py` and the tests accept the new keys and fields. The 65 Kestrel lessons stay as they are.

## Checks before this stage is done

- `npm test` (the existing tests, updated, plus `tests/study.test.ts` and `tests/plan.test.ts`), `npm run lint`, `npm run build`.
- In `tools/harness`: `npm run typecheck`, `npm run flows` (rewritten for the new flows; at least as many checks as today, covering: start a morning and pass through the four parts, the short morning, a practice exam ending on time with unanswered marked wrong, spaced review coming due, the plan and its blocks, the library, a document page, Ready to book, setup, Make it yours, an error shown as an alert, browser Back), `npm run save` (extended for the new documents and for the 7.1.1 migration), `npm run artifact`, `npm run live`.
- `python3 -I tools/content/check2.py tools/content/parts2/*.json` and `python3 -I tools/content/build-library.py`.
- Every new question answered blind by a second agent; every disagreement resolved.
