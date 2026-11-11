# TriCert Lab, version 8.0: one exam at a time

You study about 90 minutes each weekday morning before work and one 3 to 4 hour block at the weekend, about 11 hours a week. The 13-week plan asked for 14.5 hours a week, so it could not be kept. Version 8 replaces it with one exam at a time, in this order: ITIL Foundation (Version 5), PL-300, PMP, CISSP. Earlier exams stay alive through spaced review.

## What you do each morning

1. Open Today. One card shows the next item, for example "ITIL, morning 6 of 12", with one button: Start morning.
2. The morning has four parts, each with one main button:
   - Cards, 10 minutes. Flashcards that are due, one at a time. Show answer, then Again or Good. Again brings the card back once more today.
   - Learn, 35 minutes. A short brief from a named Kestrel person, the lesson, one task you do yourself with a model answer you can reveal, then three recall prompts you answer from memory before you reveal them.
   - Questions, 30 minutes. Up to 20 questions at the exam's real pace. Pick an answer, mark Sure or Guess, then read the explanation, including why each wrong option is wrong.
   - Mistakes, 15 minutes. Every wrong or guessed question is listed. Write one line for each: the rule you missed. Each line becomes a flashcard.
3. Press Finish morning. You can leave in the middle and come back to the same part.
4. Short on time? Use the Short morning link on Today: cards (8 minutes), questions that are due (25) and mistakes (10). It does not count as a morning.
5. On a review morning there is no new lesson. You get cards, a mixed quiz of 30 questions, mistakes and a weekly reflection.
6. At the weekend, Today shows the weekend block: a lab in a real tool, or a full practice exam.

## What is new

- **Today, Plan, Learn, Practice, Progress and Setup were rebuilt around this.** The look is the same as 7.1.
- **Plan** shows the four exam blocks in order with estimated dates from your start date: five mornings and one weekend block a week. The current block lists its mornings and weekend blocks.
- **Learn** starts with the block's lessons, then the library as before: the 65 Kestrel lessons, the 66 documents, the exam guides and the glossary.
- **Practice** starts with Today's review: the flashcards and questions that are due. Below it are Practice exam, Flashcards, Scenarios across exams and Labs. The old Timed set and the old Review are gone.
- **Practice exam.** 40 questions, 60 minutes, no feedback until the end. Unanswered questions count as wrong. It ends when the clock reaches zero, and a reload puts you back in it with the clock still running. The result shows your score, your score by area, and every question with your answer, the right answer and the explanation. Forms A and B are fixed. After both, a new exam is drawn at random by area from questions you have not seen in the last 14 days.
- **Spaced review.** A flashcard comes back after 1, 3, 7, 16 and 35 days, then retires. A question you get right and Sure on the first try comes back once, after 21 days. A miss or a guess comes back after 2, 7 and 21 days, and a miss starts again at 2.
- **Ready to book?** on Progress replaces the old readiness score. All four must be true:
  1. Every learning morning of the exam is done.
  2. Two different practice exams are at or above 80%, at least 7 days apart.
  3. Across those two exams, no area (with 5 or more questions) is more than 10 points under your overall score.
  4. Of the review answers you give 7 or more days after your first try, at least 80% are right. This needs at least 20 such answers; until then it says "Not enough reviews yet".
  When all four are met, the booking checklist appears.
- **Setup** is three short steps: you (name and why), your background (education, months leading projects, months of security work, whether the 35 PMP training hours are done) and your rhythm (start date).
- **Saving.** Your plan start date, review schedule, practice exam results, morning log and your own cards are now saved in both the local copy and the hosted copy. Text that is too long is refused with a clear message and nothing is saved. Before, it was cut short without telling you. Written documents are also kept in the browser every two seconds and come back after a reload. The hosted copy keeps one small document per part, so a phone and a laptop changing different things no longer overwrite each other. Progress saved in version 7.1.1 is split into the new layout on first load and nothing is lost.

## What is ready and what is still being built

- **Ready: ITIL Foundation (Version 5).**
  - 8 learning mornings, each with a lesson of 1,000 to 1,400 words, a task and three recall prompts.
  - 2 review mornings and 2 repair mornings, so 12 mornings in all.
  - 3 weekend blocks: a lab (run a small service desk in Jira Service Management on the Free plan), practice exam A and practice exam B.
  - 144 ITIL questions: 24 from before and 120 new (40 daily, 40 for exam A, 40 for exam B). Both exam forms have the same mix by area: value and value co-creation 7, the four dimensions 4, the ITIL Value System 5, the seven guiding principles 8, the product and service lifecycle 6, practices, improvement and value streams 10. That mix is our choice, because PeopleCert's weights were not available to us.
  - 66 new ITIL flashcards tied to the lessons.
- **Being built: PL-300, PMP and CISSP.** They show "Being built" on Plan and Progress. Each will get the same kind of block in a later stage.
- **Unchanged:** the 65 Kestrel lessons, the 66 documents, the glossary, the exam guides and the datasets.

## Things you should know

- ITIL Version 5 wording: PeopleCert's page confirms the "lifecycle mindset" wording but does not say how the lifecycle activities relate to the value chain, and nothing about marking or going back in the exam. Where the lessons and questions explain these, they say "our plain-word reading" or "ITIL 4 background". The lessons no longer claim that the lifecycle is the Version 5 view of the value chain.
- The exam pass mark is 65% (26 of 40). The app's target is 80% because practice should be harder than the real thing.
- Repair mornings use the mixed quiz of 30 questions. They do not yet target your weakest area from practice exam A.
- Every new question has been checked by the content checks, but a second reader answering the 120 new questions blind has not been recorded yet.
- Not pushed and not yet published to the hosted copy. The hosted copy still runs version 7.1.1 until it is republished.

## What I still need from you

- Your education, for the PMP and CISSP notes.
- How many months you have led projects.
- Whether you will use Eagle Eye in real services, and how soon.
- Whether you will have a Windows PC with a work account for the PL-300 labs.
- A decision on five older Kestrel lessons that the fact check found out of date (w1-s2, w6-s3, w9-s4, w10-s1, w13-s4). They were left as they are.

# TriCert Lab, version 7.1.1: the hosted copy now saves

- The hosted copy kept progress only until the page was reloaded. The address it saved to broke the store's rules, and the error was hidden. It now saves to a valid address.
- If saved progress cannot be read, the app says so and writes nothing, so a bad connection cannot wipe it.
- A phone and a laptop open at the same time no longer overwrite each other. Every save starts from what is stored.
- New check: `npm run save` in `tools/harness` (3 checks).

# TriCert Lab, version 7.1: Modern night, polished

Moye said "i love it" about version 7, so nothing he loves moved: dark first, Geist, one orange accent, five places, the sidebar on a laptop and the docked tabs on a phone. Four other designs were tried against it and none beat it, so version 7 stays and this pass takes the best ideas from them.

## What changed

- **Fewer lines, softer surfaces.** Lists, cards and tiles are soft filled planes instead of outlined boxes, so Progress, Plan and Waiting on you look calmer. Fields, ticks, answers and chosen tabs keep their edge. Light mode uses a faint shadow, a slightly warmer grey page and a darker grey for small text so it stays easy to read.
- **Bigger numbers.** Sessions done (27/65), days to the exam, each exam score out of 100 and the gate count (0 of 5) are large, tight figures over small quiet labels. Sessions done has a small bar under it.
- **One memorable moment on Today.** On a laptop the Up next card carries the week number as a large faded numeral, kept off the title. Phones do not show it.
- **Start session sits higher on a phone.** Your why line moved under the session card, so the first button is closer to your thumb.
- **Full pill main buttons on a phone.** Start session, Start scenarios, Continue, Finish session and Save are 56 pixels tall and fully rounded. The tab bar stays docked at the bottom so it never covers what you read.
- **Focus mode.** The clock has a thicker bar growing under it with "of 3 h" below. The description is cut at three lines with a proper ellipsis. No ring: it looked too much like a watch.
- **Make it yours** is a bottom sheet on a phone, with a grab handle, and its choices (Night, Light, Match this device, colours) are pills.
- **Calmer motion.** Screens rise in once, bars grow into place, buttons press in slightly. All of it stops when your device asks for reduced motion.
- **No data changes.** The API, database and learning content are unchanged.

# TriCert Lab, version 7: Modern night

Moye's verdict on version 6: "I want something that's very modern, but it's still very usable. And very, very simple." Version 7 answers that with a calm, dark study desk where every screen has one job and one bright button.

## What changed

- **Night first, light when you want it.** A near-black window with the page on one slightly lighter panel. Lists are drawn with fine lines instead of boxes inside boxes, so the only filled card on a screen is the thing to act on. Light uses the same layout. "Make it yours" offers Night, Light or Match this device; Night is the default.
- **One colour, one meaning.** Your colour (Beacon orange by default, or Wild rose, Canola or Glacier) marks only the next action and your progress. The four exam colour dots are gone: exams are plain outlined tags (PMP, PL-300, CISSP, ITIL V5). Green and red still mean right and wrong.
- **Today is the session and nothing else.** Your greeting and why, two numbers (sessions done and days to your next exam), then the session card: "Up next", the session title in large type, Start session, Read the lesson and Mark done, and the five days of the week. Below it, only what is waiting on you: answers to review, drafts, and the reflection for a week you have finished. The 13-week track moved to Plan and the weekly reflection moved into its week on Plan.
- **Plan is the map, and the one list of weeks.** The 13 weeks as one row of bars with a small diamond under each exam gate. Tap a week to open its five sessions and its reflection. Each session opens its lesson, which has Start this session and takes you back to Plan. On a phone the row wraps into seven and six so every week is a full-size target. Finished weeks say "Done"; others say "2 of 5". The reflection of any week you have started or written stays open to you, even if an earlier session is not done.
- **Progress leads with the next gate.** "Your next gate is PL-300 and ITIL V5. 0 of 5 checks met." Then the five checks, then one row per exam with its score out of 100, one bar, and the four parts as plain numbers. The 16 small bars are gone.
- **Five places instead of six.** Today, Plan, Learn, Practice and Progress. Learn is the library: Documents (the 66 project documents, opening straight into the writing page), Exams and Glossary. The lessons are not listed twice: they open from their session on Plan or Today.
- **Lessons read like a book.** Larger reading text at a comfortable line length, clear section headings, quiet tables and code. On a laptop, long lessons have an "On this page" list in the right margin that follows where you are and jumps to any section.
- **Practice.** One "Start scenarios" button at the top, then Timed set, Review, Flashcards and Labs as a short list. Labs are one list too: open a lab for its steps, its file and Mark done. In a scenario, the verdict appears under your answer so you can still see what you picked, with Continue right under it (on a phone it stays in reach above the tabs). Each run names itself at the top: Scenarios, Timed set, PL-300, or Check yourself.
- **Phone and tablet.** A slim top bar on every screen with your initial (Make it yours) and, while a session runs, its timer; during a scenario run the timer sits beside the question count. Tabs at the bottom have icons and labels, and the review count sits on the icon so it never covers a word. On a tablet or small laptop the left rail keeps a small label under each icon. Touch screens get 44 pixel targets at every width.
- **Type.** Geist for everything, with even-width figures for counts and timers (no more code-style zeros). Seven sizes and the focus clock, used the same way everywhere: one title size for the five main screens, one for lessons and exam guides. Geist Mono is kept only for code in lessons. Both SIL Open Font License and self-hosted.
- **One look for each kind of thing.** Done, started and not started are always a small mark and a word. Anything that opens in place has the same chevron, which turns over when open; a chevron pointing right always means "go there". Tabs are a segmented control; every other choice (filters, releases, answers, appearance, colour) shows as a tint of your colour with a coloured edge.
- **Small fixes.** Exam codes such as PL-300 never split across lines, and document names keep their capitals ("Write MFA and SSO recommendation"). Keyboard focus is visible everywhere, including inside lists, and moves in the order you see; on a phone a focused row never hides under the tabs. Focus mode, Session complete and Make it yours keep keyboard focus inside while open and hand it back when they close. Fields, ticks and checkboxes have edges you can see in both appearances. Messages appear at the bottom of the screen, clear of the headings. Disabled buttons look disabled. Every phone target is at least 44 pixels.
- **Logo.** The flame on a dark tile stays. The share image now shows the 13-week track as Plan draws it.
- **No data changes.** The API, database and learning content are unchanged.

# TriCert Lab, version 6: Beacon design

## What changed

- **No more Apple Watch look.** The black screen, activity rings and neon colours are gone. The app is light by default, with a night mode, and uses its own visual idea instead of a fitness tracker's.
- **Your 13 weeks as beacons.** Today, Plan and onboarding show your programme as 13 signal fires on a line of Alberta foothills, the same Beacon the project is named after. Each session you finish feeds that week's beacon; five sessions light it. The three tall towers are your exam gates (PL-300 and ITIL in week 6, PMP in week 10, CISSP in week 13). Click a beacon to open that week.
- **Made for you.** Today greets you by name, says how many sessions are left before your next gate, and shows your own line about why you are doing this. "Make it yours" (your name in the sidebar, or your initials on a phone) sets your name, your why, your colour (Beacon orange, Wild rose, Canola or Glacier) and light, night or match-your-device. Name and why are saved with your plan in the database; colour and appearance stay on the device.
- **Simpler Today.** One column: greeting, the beacons, today's session with its five days, anything waiting, and the weekly reflection. Readiness scores live on Progress.
- **Reading feels like studying.** Lessons, finished examples, explanations and your own writing use Literata, a typeface designed for long reading on screens. The interface uses Bricolage Grotesque. Both are SIL Open Font License and self-hosted.
- **Focus mode and finishing a session.** Focus mode shows a flame that burns while the timer runs and dims when you pause, with a simple time bar. Finishing a week's fifth session shows "Week N beacon lit".
- **New logo.** A beacon flame on a night ridge. Favicon, touch icon, share image and the downloadable lockup are updated.
- **Database.** Two profile fields, `display_name` and `motivation`, added by `drizzle/0002_personal_touch.sql`; the app also adds them on start to an existing database, so your progress is kept. New API action `save-personal`.

# TriCert Lab, version 5: Project Beacon

## What changed

- **One project for all four exams.** The course is now built around Project Beacon at Kestrel Health Network, a fictional Alberta health network. Beacon is one programme (one charter, budget, schedule and change-control board) delivered in three releases, and every release uses all four exams:
  - Release 1, weeks 1 to 6: patient-flow analytics service (Power BI dashboards for emergency waits and beds, privacy designed in, run as a supported service). Ends at the PL-300 and ITIL gate.
  - Release 2, weeks 6 to 10: clinician identity and access (roles, joiner-mover-leaver, MFA and SSO, privileged access, access reviews, the access-request value stream). Ends at the PMP gate.
  - Release 3, weeks 10 to 13: cyber resilience (incident response, ransomware readiness, recovery targets, restore tests, supplier risk, major-incident review, programme closure). Ends at the CISSP gate.
- **Lessons you read, not research.** Each of the 65 lessons teaches the topic in full (about 6,000 to 9,000 characters with tables, worked calculations and DAX, Power Query M and SQL), lists key terms, gives today's build steps, shows what good looks like or the full model answer, gives exam tips, mistakes to avoid, and three check questions with answers.
- **Finished examples for every document.** All 66 Beacon documents have a writing guide and a complete finished Kestrel version, shown under the lesson that builds it and inside the document page ("See the finished example").
- **New synthetic data.** 15 Kestrel CSV files (emergency visits, bed census, service desk, programme register and schedule, identities and permissions, access reviews, security events, assets, controls, vendors), a SQL lab, a data dictionary, source-to-target rules, DAX starters, worksheets, and a reconciliation answer key in quality-and-reconciliation.md. Deliberate data problems are listed with row IDs.
- **Practice.** 96 exam-style questions (24 per exam) and 16 cross-discipline scenarios, all set in Beacon; 80 new flashcards; a 242-term glossary.
- **Exam gates.** The five readiness checks on Progress now apply to the next gate only: its sessions, the releases up to it, and practice for its own exams.
- **Accuracy.** Exam facts checked against PMI, Microsoft Learn, ISC2 and PeopleCert; Alberta privacy law (Health Information Act and the Protection of Privacy Act), CTAS and CIHI definitions checked against oipc.ab.ca, alberta.ca, CTAS and CIHI sources. Every lesson, document and question was checked by an independent reviewer who recomputed every figure from the data.
- **Faster start.** The long reading loads on demand, so the app opens quickly.

# Version 4


## What is new in version 4

- **Logo.** A ring in the four exam colours that the lime tick breaks out of. Used in the sidebar, loading screen, favicon, Apple touch icon, share image (`public/og.png`) and the downloadable lockup (`public/tricert-lab-logo.png`). Source: `public/tricert-mark.svg`.
- **Learn tab.** Everything to read, inside the app:
  - 65 lessons, one per session: key ideas, steps, a worked NorthStar example, exam tips, mistakes to avoid and three self-check questions. Open one from Today ("Read the lesson"), from focus mode while the timer runs, or from Learn.
  - 4 exam guides: format, every domain or skill area with its weight, eligibility, answering technique, where it sits in the plan, and renewal. Checked against PMI, Microsoft Learn, ISC2 and PeopleCert on 18 October 2026.
  - 55 writing guides, one per document, also shown at the top of each document as "How to write it".
  - A searchable glossary of 209 terms, filterable by exam.
- **Practice.** 64 new exam-style questions (16 per exam), so Scenarios has 80 decisions and each Timed set uses questions for the exam you pick. 60 new flashcards (78 in total) with an exam filter.
- **Accuracy fixes.** ITIL content now uses the Version 5 lifecycle (Discover, Design, Acquire, Build, Transition, Operate, Deliver, Support), including the value-stream worksheet. PMP eligibility notes include the 48-month associate tier and the 10-year window. CISSP eligibility applies the one-year degree waiver. Dataset fixes: the budget control in `source-to-target.csv` (418,000, not 413,000), the project row count (15), and explicit incident, vulnerability and control-test controls in `quality-and-reconciliation.md`.
- **Content source.** Lessons, guides, glossary, cards and questions live in `lib/tricert-library.ts`; exam guides in `lib/tricert-exams.ts`. `tests/library.test.ts` checks coverage and structure.

# Version 3 redesign

Direction: a training app for exams in the spirit of Apple Fitness and Headspace. Less on each screen, bold visuals, rings you can feel close, and a focus mode for studying.

## Run it

Extract outside OneDrive, then in the `TriCert Lab` folder run `npm ci` and `npm run dev`, and open http://localhost:3000. Requires Node.js 22.13 or newer.

## Screens

- **Today**: today's session (start, or mark done), the week's five days as small rings, your four readiness rings, and anything waiting. Two columns on wide screens, one on phones.
- **Focus mode**: full screen. A timer ring fills toward the planned minutes, with what to do, the output to finish with, and links to the session's document, lab or practice. Pause, minimise (the timer keeps running in the sidebar), finish. Finishing shows a completion screen.
- **Plan**: all 65 sessions in one strip, then each project's weeks with a progress ring, ending at its exam-gate card.
- **Projects**: pick a project, pick a document, write in a full-page editor with a "Done when" self-check. "Check yourself" runs five questions about that document.
- **Practice**: tiles for Scenarios, Timed set, Review, Flashcards and Labs. Questions run one per screen with a progress bar; after Check, a green or red panel rises with the explanation. Keyboard: A to D, Enter.
- **Progress**: the four rings large, a card per exam with its four score parts, the five exam checks, eligibility, and a Portfolio tab with the handover checklist.
- **Setup**: four short steps.

## Visual system

Black background. Nunito for headings and numbers, Nunito Sans for reading (both SIL Open Font License, self-hosted). One colour per exam, used everywhere: PMP coral, PL-300 yellow, CISSP cyan, ITIL violet. Lime means done.

## Unchanged

Database, API, curriculum content, datasets and tests.

## Verified

- `npm run lint`: 0 errors (one existing `<img>` warning). `npm test`: 9 of 9. `npm run build`: clean. `npm run test:e2e` on the live server: 2 of 2.
- 5 live checks on the real server and database, and 14 browser flow checks of the new screens. No console errors.
