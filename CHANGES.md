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
