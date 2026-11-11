# TriCert Lab handoff

Written 2026-10-24 for the move to Claude Code in the cloud and a private GitHub repo, and brought up to date for version 8.0 on 2026-11-11 (branch `v8-rebuild`). Everything below was checked against the files in this folder on those dates. `docs/v8-rebuild-spec.md` is the plan for version 8 and wins over older documents. Where something is not known, it says "unknown".

**Run in the cloud only.** Moye's instruction: this project runs strictly in the cloud. Do every install, build, server, test and script inside the cloud session. Never use tools that reach his computer, and never ask him to run commands there. Anything in section 9 is skipped. The same rule is in `CLAUDE.md`, which Claude Code loads automatically.

## 1. Name and purpose

TriCert Lab is a private study and portfolio web app for one learner, Moye, who is preparing for four exams: ITIL Foundation (Version 5), Microsoft PL-300, PMP and CISSP, studied one exam at a time in that order (version 8). He studies about 90 minutes each weekday morning before work plus one 3 to 4 hour weekend block, about 11 hours a week. He learns through one fictional programme, Project Beacon at Kestrel Health Network (a made-up Alberta health network): a library of 65 Kestrel lessons, 66 documents with finished examples, and for each exam block a set of lessons, questions, flashcards, labs and timed practice exams with a Ready to book check.

## 2. Status

### What works (all re-run on 2026-11-11 unless marked otherwise)

- Version 8.0 ("One exam at a time", branch `v8-rebuild`, not pushed; the lead will push it as `release/v8.0.0`). Notes for Moye are at the top of `CHANGES.md`. The look is version 7.1 (dark first, Geist, one accent, five places).
- The ITIL Foundation (Version 5) block is built: 8 learn mornings (`itil-m1` to `itil-m8`), 2 review mornings (`itil-r1`, `itil-r2`), 2 repair mornings (`itil-p1`, `itil-p2`), a lab (`itil-w1`, Jira Service Management Free plan), and practice exams A and B (`itil-w2`, `itil-w3`, B at least 7 days after A). Exam settings: 40 questions, 60 minutes, 90 seconds a question, going back allowed, target 80 (the real pass mark is 65%, 26 of 40).
- PL-300, PMP and CISSP have `status: 'building'` in `lib/tricert-plan.ts`. The app shows "Being built" for them on Plan and Progress.
- Screens: Today (one card for the next morning or weekend block, a Short morning link, "Waiting on you"), the morning in four parts (Cards 10, Learn 35, Questions 30, Mistakes 15 minutes) in focus mode with a saved place so a reload or leaving returns to the same part, the short morning (8, 25, 10), the review morning (cards, a quiz of 30, mistakes, weekly reflection saved as `retrospective-<key>`), Today's review (mode `due`, log key `due-review`), the weekend lab (ticks kept in the browser), the timed practice exam and its result, Plan with estimated dates, Learn (block lessons, Kestrel lessons, Documents, Exams, Glossary), Progress (Ready to book, practice exam history, delayed-review score, Portfolio), Setup in three steps.
- Study engine `lib/tricert-study.ts` (pure, tested), bank `lib/tricert-bank.ts`, plan `lib/tricert-plan.ts`. Rules are in `docs/system-design.md` and `docs/v8-rebuild-spec.md`.
- Saving: local copy has a `study_records` table (migration `drizzle/0003_study_records.sql`) and the actions `patch-record` and `append-record`; the hosted copy keeps one document per part (`state`, `attempts`, `rec-<key>`, `doc-<key>`). Text over a limit is refused (400), not cut. See `docs/system-design.md` (Records, Size limits, Hosted copy).
- Content counts: 65 Kestrel lessons plus 8 ITIL block lessons, 66 document guides with finished examples, 216 questions (144 in a pool: ITIL has 144 in total, 24 of the older ones plus 120 new, split as daily 64, mockA 40, mockB 40; PL-300, PMP and CISSP have 24 each; 16 cross-exam scenarios are kept apart), 164 flashcards (18 original plus 146 from the library, 66 of them ITIL cards tied to a lesson), 242 glossary terms, 4 exam guides, 22 dataset files. ITIL facts were checked against PeopleCert's Foundation (Version 5) page on 11 November 2026; other exam facts on 18 October 2026.
- Checks run on 2026-11-11: `npm test` 50 of 50, lint 0 errors and 1 warning, build completes, `check2.py` OK, `build-library.py` leaves the `lib/` files unchanged, harness typecheck clean, 43 flow checks, 7 save checks, artifact builds. Details in section 5.
- A hosted copy runs as a private claude.ai artifact (see section 6). It still runs the version 6 or 7.1.1 build until republished.

### What is half done

- PL-300, PMP and CISSP blocks are not built. Each needs: mornings and weekend blocks in `lib/tricert-plan.ts` (set `status: 'ready'`), lessons for each learn morning in `tools/content/parts2/lessons-<exam>.json`, about 120 questions in a `daily`, `mockA` and `mockB` pool, flashcards with lesson tags, and the exam facts and booking list. `check2.py` and `build-library.py` already accept the keys. The PL-300 block needs a Windows PC with a work account for Power BI (open question, section 8).
- The 120 new ITIL questions have passed `check2.py` and the content fixes of 11 November, but no second reader has answered them blind (the spec requires this). `tools/content/` has no record of it.
- Repair mornings (`itil-p1`, `itil-p2`) use the review mix of 30 questions. They do not yet target the weakest area of practice exam A, because the engine has no area-targeted daily set.
- `tools/harness/export-logo.mjs` still draws the old 13-week track for the share image `public/og.png`. Redraw it for the block plan.
- `npm run live` and `npm run live-reading` were not run in the final pass: they need `npm run dev` on a fresh database, and the shared `.wrangler` database was not fresh. `live.mjs` has 7 checks and passes `node --check`. `npm run test:e2e` (7 tests) also needs the dev server and was not run in the final pass. Run both before release.
- Five older Kestrel lessons were found out of date by the ITIL fact check and left unchanged, because the 65 Kestrel lessons stay as they are: w1-s2 and w6-s3 (the eight-stage lifecycle replaces the value chain), w9-s4 (case item wording), w10-s1 (1 December advice) and w13-s4 (adaptive testing applies to all languages). Fixing them needs a decision from Moye and a change to the unchanged-content check in `tests/library.test.ts`.
- `tools/content/verified-facts.md` needs three additions from the ITIL content fixes. (1) PeopleCert's Foundation (Version 5) page, opened 11 November 2026, says "how products and services are managed across their lifecycle" and "Embrace a 'lifecycle mindset' to make smarter decisions, anticipate changes, reduce technical debt, improve service continuity, and keep teams aligned while leaving silo mentality behind"; it says nothing about marking or reviewing questions during the exam. (2) The ITIL 4 carry-over terms used in the questions, labelled "ITIL 4 term, assumed unchanged in Version 5": evaluate, direct and monitor; impact and urgency; event types; known error; confidentiality, integrity and availability; service offering parts; user, customer and sponsor; service relationship parts; standard change and change authority; percent complete and accurate, flow efficiency and lead time; PESTLE. (3) Version 5's own definitions of the lifecycle activities are unconfirmed (itil.com refused connections), so lessons and questions call them "our plain-word reading".
- Version 7.1 and 7 history: Moye said "i love it" about version 7. 7.1 added soft surfaces, big numerals and phone pill buttons; version 8 keeps that look.
- Design review screenshots: `tools/harness/shoot.mjs` (not committed).
- `docs/implementation-backlog.md` is still out of date.

### What is broken or known to be imperfect

- `npx tsc --noEmit -p .` in the root reports 18 errors (counted 2026-11-11): `.ts` import paths in `lib/tricert-bank.ts` (4) and `tests/*.ts` (13), and `r2` missing from `.openai/hosting.json` typing in `vite.config.ts` (1). The `.ts` extensions are needed so `node --test` can load the files; the harness `tsconfig.check.json` allows them. The build, lint and tests do not run this check, so they still pass.
- Lint warning: `@next/next/no-img-element` for the logo `<img>` on the Progress, Portfolio tab.
- `npm run start` (production server) was not tested. Result unknown.
- The hosted artifact is built from `tools/harness/entry-artifact.tsx` and keeps progress in the artifact's own storage. Progress there and in a local copy do not sync. The new hosted layout has been checked against a stand-in store (`npm run save`) and has not been watched inside claude.ai.
- Engine choices not yet confirmed by Moye: practice exam answers count toward the delayed-review score; a guessed answer counts as not right; the 7-day gap between exams A and B is enforced by the Plan and Practice screens (`practiceExamGate`), not by the engine; `estimateDates` only knows which items are done, not when, so a morning finished today still leaves today open for the next one.
- The estimate dates and the exam pass rule use right x 100 / total >= target with no rounding.

## 3. Files

Generated files are marked GENERATED. Nothing in the project holds a secret. Nothing is near GitHub's file size limits; the largest file is `lib/tricert-reading.ts` at about 1.6 MB.

### Root

| Path | What it does |
|---|---|
| `HANDOFF.md` | This file. |
| `CLAUDE.md` | Standing instructions Claude Code loads in every session: run in the cloud only, writing rules, how to edit content, checks to run before calling work done. |
| `README.md` | Project overview, run commands and a walkthrough of the five places (version 8). |
| `CHANGES.md` | Release notes for versions 8, 7.1.1, 7.1, 7, 6, 5 and 4, and earlier redesign notes. Version 8.0 is at the top, written for Moye. |
| `VERSIONS.md` | One line per version with its release branch. |
| `LOCAL_COPY_README.txt` | Plain-text run guide written for Moye's own computer (Windows and macOS), including how to keep version 5 progress. |
| `package.json` | App scripts and dependencies. The package name is `sites-project`, left from the original scaffold. |
| `package-lock.json` | GENERATED by npm. Exact dependency versions; `npm ci` uses it. |
| `.gitignore` | Ignores node_modules, build output, `.wrangler`, `.env*`, `next-env.d.ts`, and (added 2026-10-24) the harness `node_modules`, `out` and `shots` folders, `__pycache__` and `*.tsbuildinfo`. |
| `.openai/hosting.json` | Says the D1 database binding is named `DB`. Read by `vite.config.ts`. Not a secret. |
| `vite.config.ts` | Build setup: vinext, the OpenAI Sites Vite plugin, the Cloudflare Vite plugin, Tailwind through PostCSS, and a local D1 binding with a placeholder database id. |
| `next.config.ts` | Empty Next.js config. |
| `tsconfig.json` | TypeScript settings. `tools` was added to `exclude` on 2026-10-24 so the harness files are not type-checked with the app. |
| `eslint.config.mjs` | ESLint with the Next.js core-web-vitals and TypeScript rules. Ignores generated output (including `tools/harness/out`) and `.claude`, where Claude Code keeps worktrees (other checkouts of this repository). |
| `drizzle.config.ts` | drizzle-kit settings: schema in `db/schema.ts`, migrations in `drizzle/`. |
| `next-env.d.ts` | GENERATED Next.js type stub. Listed in `.gitignore`, so git will not track it. |

### `app/`

| Path | What it does |
|---|---|
| `app/page.tsx` | Renders the app component. |
| `app/layout.tsx` | Page shell: title, icons, share image, font preload, and a small inline script that applies the saved colour and light or night setting before the first paint. |
| `app/globals.css` | All styling (about 1,500 lines): colour tokens, the type scale, night (default) and light themes, four accent colours, and every screen. The version 8 sections are at the end. |
| `app/tricert-app.tsx` | The whole interface (about 3,500 lines): Today, the morning runner (state kept in localStorage `tricert.morning.v1`), weekend labs, the practice exam runner (`tricert.exam.v1`), Plan, Learn, Practice, Progress with Ready to book, Setup, "Make it yours" and the logo mark. |
| `app/api/state/route.ts` | The one API endpoint. `GET` returns `{ profile, progress, attempts, artifacts, records }`; `PUT` accepts `save-profile`, `save-personal`, `set-progress`, `record-attempt`, `save-artifact`, `patch-record` and `append-record`. |

### `lib/`

| Path | What it does |
|---|---|
| `lib/tricert-content.ts` | The Kestrel curriculum (kept for the lesson library and documents): 13 weeks, 65 sessions and the documents each builds, 3 releases with 66 documents, labs, flashcards, coverage map, official exam links. The block of 16 cross-exam scenarios inside it is GENERATED by `tools/content/inject-scenarios.py`. |
| `lib/tricert-exams.ts` | The four exam guides (format, domains and weights, eligibility, technique, renewal). Hand written. |
| `lib/tricert-library.ts` | GENERATED by `tools/content/build-library.py`. Small content loaded at start: lesson and guide indexes, glossary, extra flashcards, exam questions. Do not edit by hand; edit `tools/content/parts2/*.json`. |
| `lib/tricert-reading.ts` | GENERATED by the same script. The long reading (65 Kestrel lessons, then the exam block lessons such as `itil-m1`, and 66 finished documents), loaded on demand. Do not edit by hand. |
| `lib/tricert-plan.ts` | Version 8 plan: the four exam blocks, their mornings, weekend blocks, exam settings and booking lists. Hand written. |
| `lib/tricert-study.ts` | Version 8 study engine: cards, spaced question review, the daily set, practice exams, Ready to book and estimated dates. Pure functions. |
| `lib/tricert-bank.ts` | Connects the engine to the content: question bank per exam, cross-exam scenarios kept apart, cards with engine ids, helpers per lesson and practice exam form. |
| `lib/tricert-repository.ts` | Database code: creates tables and adds missing columns on start, and the validated save functions for each API action. |

### `db/` and `drizzle/`

| Path | What it does |
|---|---|
| `db/schema.ts` | Drizzle table definitions, used by drizzle-kit, including `study_records` and the attempts index. |
| `db/index.ts` | A Drizzle client helper. Not imported anywhere in `app/` or `lib/`. |
| `db/env.d.ts` | Type for the `DB` binding. |
| `drizzle/0000_cooing_brother_voodoo.sql`, `0001_bizarre_millenium_guard.sql`, `0002_personal_touch.sql`, `0003_study_records.sql` | GENERATED by drizzle-kit. Database migrations. 0002 adds `display_name` and `motivation` (version 6); 0003 adds `study_records` and an attempts index (version 8). The app also adds these itself on start. |
| `drizzle/meta/_journal.json`, `0000_snapshot.json`, `0001_snapshot.json`, `0002_snapshot.json`, `0003_snapshot.json` | GENERATED by drizzle-kit. Migration history. |

### `public/`

| Path | What it does |
|---|---|
| `public/favicon.svg`, `tricert-mark.svg`, `apple-touch-icon.png`, `icon-512.png`, `og.png`, `tricert-lab-logo.png` | GENERATED by `tools/harness/export-logo.mjs`. Logo set: one flame on a dark tile, with a Geist wordmark. |
| `public/fonts/geist-latin-wght-normal.woff2`, `geist-latin-ext-wght-normal.woff2` | Geist, the interface and reading font, self-hosted (from `@fontsource-variable/geist` 5.3.0). |
| `public/fonts/geist-mono-latin-wght-normal.woff2` | Geist Mono, for code blocks in lessons only (from `@fontsource-variable/geist-mono` 5.3.0). |
| `public/fonts/LICENSE-Geist-OFL.txt`, `LICENSE-GeistMono-OFL.txt` | Font licences (SIL Open Font License). |
| `public/datasets/` (22 files) | GENERATED by `tools/content/datasets/generate.py`, then copied here. Synthetic Kestrel data the learner downloads in Labs: `khn_ed_visits.csv`, `khn_bed_census.csv`, `khn_sites.csv`, `khn_units.csv`, `khn_service_desk.csv`, `khn_programme_register.csv`, `khn_schedule.csv`, `khn_identity.csv`, `khn_role_permissions.csv`, `khn_user_permissions.csv`, `khn_access_reviews.csv`, `khn_security_events.csv`, `khn_assets.csv`, `khn_controls.csv`, `khn_vendors.csv`, `khn_lab.sql`, `data-dictionary.csv`, `source-to-target.csv`, `quality-and-reconciliation.md`, `dax-measure-starters.md`, `itil-value-stream-template.md`, `security-architecture-template.md`. All are byte-identical to the copies in `tools/content/datasets/out/`. |

### `tests/` and `docs/`

| Path | What it does |
|---|---|
| `tests/content.test.ts` | 4 tests on the curriculum: 13 weeks and 65 sessions, every session builds a real document, 3 releases, enough practice content (the 16 cross-exam scenarios stay Intersection with no pool). |
| `tests/library.test.ts` | 10 tests on the reading content: every lesson and document complete, block lessons sized as the plan says, questions well formed with real documents or mornings, the ITIL pools and form area mix, card lessons, indexes match, no duplicates, exam guide weights add up, no em dashes. |
| `tests/study.test.ts`, `tests/plan.test.ts`, `tests/bank.test.ts` | The study engine (25 tests), the plan data (6) and the bank (5). |
| `tests/site.e2e.mjs` | 7 tests against a running server: page, API and dataset downloads respond; unknown API actions are refused; records, merge rules, size limits and full attempts. |
| `docs/system-design.md` | Architecture, data model, records, size limits, API notes and the hosted layout (version 8). |
| `docs/v8-rebuild-spec.md` | The plan for version 8. Wins over older documents. |
| `docs/security.md` | Security assumptions, controls (size limits, record keys, read before write) and remaining risks. |
| `docs/implementation-backlog.md` | Original backlog. Out of date. |

### `tools/content/` (how the learning content is made and checked)

| Path | What it does |
|---|---|
| `parts2/lessons-w01-02.json`, `lessons-w03.json`, `lessons-w04.json`, `lessons-w05-06.json`, `lessons-w07-08.json`, `lessons-w09.json`, `lessons-w10.json`, `lessons-w11-12.json`, `lessons-w13.json` | Source of truth for the 65 lessons. |
| `parts2/docguides-g1.json` to `docguides-g6.json` | Source of truth for the 66 document guides and finished examples. |
| `parts2/glossary.json`, `flashcards.json`, `questions-a.json`, `questions-b.json` | Source of truth for the glossary, extra flashcards and practice questions (the 96 older exam questions and the 16 cross-exam scenarios). |
| `parts2/lessons-itil.json`, `flashcards-itil.json`, `questions-itil-1.json` (daily), `questions-itil-2.json` (mockA), `questions-itil-3.json` (mockB) | Version 8 ITIL block: 8 lessons `itil-m1` to `itil-m8`, 66 cards tagged by lesson, and 120 questions with ids from `q-itil-025`. |
| `build-library.py` | Builds `lib/tricert-library.ts` and `lib/tricert-reading.ts` from `parts2`: Kestrel lessons by week and session, then block lessons in plan order. Keeps `pool` and `lesson` on questions and writes flashcards as `[cert, front, back, lesson]`. |
| `inject-scenarios.py` | Copies the 16 cross-exam scenarios from `parts2/questions-*.json` into `lib/tricert-content.ts`. Safe to re-run; output is identical. |
| `check2.py` | Checks a content file's structure and house style (banned words, no em dashes, formatting rules), and for block lessons the plan sizes (4 to 6 sections, 1,000 to 1,400 words, 6 to 10 key terms, a model answer of at least 800 characters, 3 to 5 exam tips, 3 pitfalls) and that `pool` and `lesson` are valid. |
| `datasets/generate.py` | Generates every Kestrel dataset with a fixed seed (20261001) and cross-checks 604 figures. Writes to `datasets/out/`. |
| `datasets/out/` (23 files) | GENERATED. The 22 dataset files plus `truth.json`, the figure answer key used when writing and checking content. `truth.json` is not in `public/`. |
| `WORLD.md` | The Kestrel world: sites, people with IDs, systems, vendors, dates, programme figures. Every lesson and document must agree with it. |
| `BRIEF2.md` | Writing brief for content: accuracy rules, style rules, formatting the app can render, how the app works. Its sentence about "four readiness rings" describes version 5; version 7 shows readiness as one score and one bar per exam. |
| `DECISIONS.md` | Final values for facts that different writers had set differently. |
| `FACTCHECK.md` | The brief used for the independent fact-check. |
| `verified-facts.md` | The checked source for exam facts (counts, weights, domains, eligibility, ITIL Version 5 terms). |
| `verified-alberta.md` | The checked source for Alberta privacy law, CTAS and CIHI definitions. |
| `consistency-notes.md`, `fixup-list.md` | Cross-document conflicts found after the fact-check and the fixes. Spot checks on 2026-10-24 found all 9 fix-up items in place. |

### `tools/harness/` (browser checks, screenshots, hosted build, logo)

| Path | What it does |
|---|---|
| `package.json`, `package-lock.json` | Harness tools: esbuild, Tailwind CLI, Playwright, TypeScript. Uses the app's own React from the root `node_modules`. |
| `build.mjs` | Bundles the app with a fake API into `out/<name>/` for fast browser checks. |
| `entry.tsx` | Fake API for the harness with four sample states chosen by `?state=`: `midway` (default: itil-m1 to m4 and itil-r1 done, 7 cards and 8 questions due on 2026-11-18), `ready` (all mornings to r2 and the lab done, so exam A is open), `booked` (whole block done, A 34/40 on 11-07, B 33/40 on 11-15, delayed 23/26) and `fresh` (no profile). `?today=YYYY-MM-DD` sets the date (default 2026-11-18, a Wednesday). `?keep=1` keeps the fake server's state across reloads. The sample name "Moye" and the sample why line are placeholders, not Moye's words. |
| `flows.mjs` | 43 browser checks of the main flows on the harness build: the morning through its four parts, the short and review mornings, Today's review, weekend labs, the practice exam (ending on time with unanswered marked wrong, reload, result), Plan and its blocks, Learn, a document page, Ready to book, setup, Make it yours, an error shown as an alert, browser Back, phone widths with 44px targets, a tab left open across midnight, and two tabs. |
| `shoot.mjs` | Design review screenshots of every screen: after `node build.mjs after ../..`, run `node shoot.mjs after [views] [outDir]`. Writes `<view>-<desktop|phone>-<light|dark>.png` (desktop 1440x900 full page, phone 390x844 viewport; night as well for Today, Plan, lesson, Practice, an answered scenario, Progress, focus mode and Make it yours). `PHONE_FULL=<dir>` adds full-page phone shots. Reports console errors and sideways scrolling. |
| `theme-shots.mjs`, `final-shots.mjs` | Quick screenshots of the colour choices and of the main screens. Write to `shots/`. |
| `live.mjs` | 7 browser checks against the real dev server and database, including that a practice exam saves its result, schedule and weekend block, and that over-long text is refused. Needs a fresh database. |
| `live-reading.mjs` | Checks that lessons and document guides load on demand on the real server. |
| `tsconfig.check.json` | Strict typecheck of `app/tricert-app.tsx`. |
| `build-artifact.mjs`, `entry-artifact.tsx` | Builds the single-file hosted version (`out/artifact/index.html`) that keeps progress in the claude.ai artifact's own storage. |
| `save.mjs` | 7 browser checks that the hosted build saves: progress survives a reload, a failed read never leads to a write, two devices keep each other's progress and records, a morning's records survive a reload and a save writes only what it changes, a 7.1.1 document is split without loss, and a change over a size limit shows an error and writes nothing. |
| `export-logo.mjs` | Regenerates the logo files in `public/`. |

## 4. How to run it

- Language: TypeScript (React 19 on vinext, a Vite-based Next.js-style framework). It builds for Cloudflare Workers with a D1 database. Whether it is deployed anywhere besides the claude.ai artifact: unknown.
- Node.js: 22.13.0 or newer (from `engines` in `package.json`). Tested with Node 22.22.0 and npm 10.9.4.
- Python 3, standard library only, for `tools/content`. Tested with Python 3.13.16. The minimum version is unknown.

### Run the app

```bash
npm ci
npm run dev
```

Open http://localhost:3000. The first start creates a local database under `.wrangler/state`. To start fresh, stop the server and delete `.wrangler/state`.

Production build:

```bash
npm run build
npm run start
```

`npm run start` was not tested in this handoff.

### Run the tools

```bash
# root first: the harness uses the app's React
npm ci
cd tools/harness
npm ci
npx playwright install chromium   # only if no Chromium is installed
```

Content tools, from the repo root:

```bash
python3 -I tools/content/check2.py tools/content/parts2/*.json
python3 -I tools/content/build-library.py
python3 -I tools/content/inject-scenarios.py
python3 -I tools/content/datasets/generate.py
```

After `generate.py`, copy changed dataset files from `tools/content/datasets/out/` to `public/datasets/` by hand (do not copy `truth.json`).

### App dependencies (declared range, locked version)

| Package | Declared | Locked |
|---|---|---|
| drizzle-orm | 0.45.2 | 0.45.2 |
| next | ^16.3.3 | 16.3.3 |
| react | ^19.2.8 | 19.2.8 |
| react-dom | ^19.2.8 | 19.2.8 |
| @cloudflare/vite-plugin (dev) | ^1.54.2 | 1.54.2 |
| @cloudflare/workers-types (dev) | ^5.20260829.1 | 5.20260829.1 |
| @openai/sites-vite-plugin (dev) | ^0.1.0 or ^0.2.0 | 0.2.0 |
| @tailwindcss/postcss (dev) | 4.2.1 | 4.2.1 |
| @types/node (dev) | 22.19.19 | 22.19.19 |
| @types/react (dev) | 19.2.14 | 19.2.14 |
| @types/react-dom (dev) | 19.2.3 | 19.2.3 |
| @vitejs/plugin-react (dev) | 6.0.2 | 6.0.2 |
| @vitejs/plugin-rsc (dev) | ^0.5.34 | 0.5.34 |
| drizzle-kit (dev) | 0.31.10 | 0.31.10 |
| eslint (dev) | 9.39.4 | 9.39.4 |
| eslint-config-next (dev) | 16.2.6 | 16.2.6 |
| react-server-dom-webpack (dev) | ^19.2.8 | 19.2.8 |
| tailwindcss (dev) | 4.2.1 | 4.2.1 |
| typescript (dev) | 5.9.3 | 5.9.3 |
| vinext (dev) | ^1.0.0-beta.8 | 1.0.0-beta.8 |
| vite (dev) | ^8.2.2 | 8.2.2 |
| wrangler (dev) | ^4.114.0 | 4.114.0 |

### Harness dependencies (`tools/harness`, all exact)

@tailwindcss/cli 4.2.1, esbuild 0.25.4, playwright 1.56.0, tailwindcss 4.2.1, typescript 5.9.3.

## 5. How to test it

Results below were recorded on 2026-11-11 on branch `v8-rebuild`, except where marked "not run".

| Command (where) | Expected result |
|---|---|
| `npm test` (root) | `# tests 50`, `# pass 50`, `# fail 0` (content 4, library 10, study 25, plan 6, bank 5) |
| `npm run lint` (root) | `1 problem (0 errors, 1 warning)`; the warning is the logo `<img>` |
| `npm run build` (root) | `Build complete.` |
| `npm run test:e2e` (root, with `npm run dev` running) | `# pass 7`, `# fail 0` (not run in the final pass) |
| `npm run typecheck` (tools/harness) | No output, exit code 0 |
| `npm run flows` (tools/harness) | `43 flow checks passed, no console errors` |
| `npm run live` (tools/harness, with `npm run dev` running on a fresh database) | 7 live checks against the real server, no console errors, then the live reading check (not run in the final pass) |
| `npm run artifact` (tools/harness) | `html bytes 2721886 font inlined true abs datasets left 0` (the byte count moves with content) |
| `npm run save` (tools/harness) | `7 save checks passed` |
| `python3 -I tools/content/check2.py tools/content/parts2/*.json` | `OK` |
| `python3 -I tools/content/build-library.py` | `lessons 65/65 + block 8, guides 66/66, glossary 242, flashcards 146 (66 by lesson), questions 216 (144 in a pool) -> library 459 KB, reading 1680 KB`, and the `lib/` files unchanged (`git status` clean) |
| `python3 -I tools/content/datasets/generate.py` | `Figures cross-checked: 604` and `SELF-CHECK OK`, and datasets unchanged (not run in the final pass) |
| `npx tsc --noEmit -p .` (root) | 18 known errors (see Status). Not part of the passing checks. |

`npm run flows` and `npm run save` rebuild their own bundles under `tools/harness/out/`. Do not run two harness builds at once in the same checkout. For `live`, stop any dev server, delete `.wrangler/state` and start `npm run dev` again so the database is fresh.

## 6. Secrets and accounts

- API keys: none. No `.env` file exists. No passwords or tokens are in the code.
- Cloudflare D1: the app uses a D1 binding named `DB`. Locally it runs through Wrangler and Miniflare with a placeholder database id, so no Cloudflare account is needed to run it. Whether the app is deployed to a Cloudflare account: unknown.
- OpenAI Sites: the project was first scaffolded with OpenAI's Sites tooling (`@openai/sites-vite-plugin`, `.openai/hosting.json`, package name `sites-project`). `README.md` mentions a "hosted version" with "the platform's private owner access". Where that hosted version lives and which account owns it: unknown.
- claude.ai artifact: the hosted copy Moye uses is the private artifact https://claude.ai/artifact/GPeDwtK5stmbqQHyzHTTGE, owned by his claude.ai account. It uses the artifact capabilities `db` (his saved progress), `downloads` and `user`. Whether Claude Code in the cloud can publish to it: unknown.
- GitHub: the new private repo. Name and owner: unknown.
- npm: public registry only, no login.
- Paid services: none known.

## 7. Decisions Moye made

In order, with his words where they exist.

1. The redesign goal (first message): "make sure that you know users don't lose track and users can easily focus on the day-to-day activities involved in this project ... in terms of the font, in terms of the design, in terms of the sections of everything, everything should be very smooth and very coherent ... users are not distracted."
2. Run it in the cloud, not on his PC, after `npm ci` failed in a folder without `package.json`: "fam just run it here", then "Run it here".
3. Turned down the first redesign: "I think you can still do better. This is not impressive. Um, it's still very generic ... it doesn't feel like AI slop or random stuff, you know."
4. Turned down the second redesign (light grey-green, one plain font, teal, a 65-square strip, dense dashboard): "still laughable". In follow-up questions he chose the problems "Looks cheap or plain", "Too much on screen", "Feels like a template" and "Doesn't feel like studying"; the reference "Apple Fitness / Headspace"; and said he judged it on "The live page".
5. Approved the third design (dark, rings, bold): "The design in is fireee." Asked: "Come up with a logo that is fire as well."
6. Content must be complete in the app: "I actualluy want content for everything. Update content so I will ready everything here and i do not have to research else where. ensure that all the information is accurate".
7. No research left to the learner, and one project for all four exams: "it's telling me to do research on the, you know, the course material and everything. I don't want to have to do that ... I want you to have done that for me. Then all I need to do is to read through and see how it is." And: "I want you to build a project um, for the Canada region or North America region that encompasses not just PMP skills, um, but I also need you to imbibe uh, CISSP, like security principles, as well as the ITIL and the Power BI principles as well ... So as I'm learning, I'm also building."
8. Chose the case "Alberta health network" and chose to "Keep current gates": PL-300 and ITIL in week 6 (day 4), PMP in week 10 (day 3), CISSP in week 13 (day 4). Replaced by item 15: the 13-week plan and its gates are gone.
9. Turned down the Apple look of versions 3 to 5: "I like the design, but it looks too much like an Apple product ... think of a creative way to kind of make it more personalized ... look into other ways to make it simpler ... it basically looks like the Apple Watch".
10. Version 6 (beacons, light by default, name and why, four colours, new fonts, flame logo) was my answer to item 9. He turned it down on 2026-10-27 (item 13).
11. His standing writing rules, applied to all app content: no em dashes, and never the words Delve, Tapestry, Landscape, Spearheaded, Seamless, Navigating, Fostering, Comprehensive, Transformative, Pivotal, Successfully, Effectively, Carefully, Strategically, Proactively. `tests/library.test.ts` checks em dashes; `tools/content/check2.py` checks both.

12. Run strictly in the cloud (2026-10-24): "I hope you have set an instruction for this to be run strictly in the cloud so that the usage credits can be used from there. Please set that". Recorded at the top of this file and in `CLAUDE.md`.

13. Turned down version 6 (2026-10-27): "in terms of UI, it's not still looking too good. I want something that's very modern, but it's still very usable. And very, very simple. This does not provide that." Version 7 ("Modern night", branch `v7-redesign`) is the answer; see item 14. Keep the name and why line, light and night, and "Make it yours".

14. Version 7 was loved: "i love it" (CHANGES.md, 7.1). Version 8 keeps that look.

15. Approved the version 8 rebuild after the review of 10 November 2026 (2026-11-11): the 13-week plan needs 14.5 hours a week in sessions that average 174 minutes, and he studies about 11 hours a week (90 minutes each weekday morning plus one 3 to 4 hour weekend block). The app had no real practice exams and its readiness score rewarded finishing things. Decisions in `docs/v8-rebuild-spec.md`: one exam in learning mode at a time (ITIL Foundation Version 5, PL-300, PMP, CISSP), earlier exams stay alive through spaced review, the old readiness score and timed set are removed, and Ready to book needs two practice exams at or above 80%, no weak area and delayed-review accuracy.

Content rules that follow from items 6 and 7 (set while building, recorded in `tools/content/BRIEF2.md` and `DECISIONS.md`): every lesson teaches in full and never tells the learner to look things up; every build has a finished example; exam facts come only from `verified-facts.md`; Alberta law only from `verified-alberta.md`; data figures only from the datasets; ITIL Version 5 terms only; "PIA" means physician initial assessment only.

## 8. Next tasks

In priority order.

1. Run `npm run test:e2e` and `npm run live` (with `npm run live-reading`) on a fresh dev server before release. They were not run in the final pass of 2026-11-11.
2. Push `v8-rebuild` as `release/v8.0.0` (the lead does this) and show Moye version 8. Change what he asks for. Serves: the approved rebuild (decision 15).
3. Get a second reader to answer the 120 new ITIL questions blind with `tools/content/` helpers or the scratchpad `blind.py`, and resolve every disagreement. Serves: the spec's "Every new question answered blind by a second agent".
4. Build the PL-300 block, then PMP, then CISSP, each like the ITIL block: mornings and weekend blocks in `lib/tricert-plan.ts`, lessons, 120 questions in three pools, flashcards, exam facts, booking list. The PL-300 block needs an answer on a Windows PC with a work account (Power BI Desktop). The PMP block needs the 35 training hours and his background answers.
5. Add an area-targeted daily set to the engine so repair mornings use the weakest area of practice exam A.
6. Redraw `tools/harness/export-logo.mjs` for the block plan, then regenerate `public/og.png`.
7. Add the three notes in Status to `tools/content/verified-facts.md`, and decide with Moye what to do about the five out-of-date Kestrel lessons.
8. After any change, rebuild the hosted copy (`cd tools/harness && npm run artifact`) and republish `tools/harness/out/artifact/index.html` to https://claude.ai/artifact/GPeDwtK5stmbqQHyzHTTGE, if the tools allow it. The hosted copy still runs an older build.
9. Before Moye books each exam, recheck the exam facts in `lib/tricert-exams.ts` and `tools/content/verified-facts.md` against PMI, Microsoft Learn, ISC2 and PeopleCert (ITIL last checked 11 November 2026, the others 18 October 2026).
10. Bring `docs/implementation-backlog.md` and the "readiness rings" line in `tools/content/BRIEF2.md` up to date.

### Questions Moye has not answered yet

- His education (used for the PMP and CISSP eligibility notes).
- How many months he has led projects.
- Whether he will use Eagle Eye (the speech tool in `/home/user/eagle-eye`) in real services, which affects how soon the weekend blocks can be moved.
- Whether he has a Windows PC with a work account, needed for the PL-300 labs (Power BI Desktop).
- What to do about the five out-of-date Kestrel lessons (Status).

The 18 root TypeScript errors are not tied to any request of Moye's; they are listed in Status so nobody mistakes them for a new break.

## 9. Needs my computer

Skip everything in this section. The project runs in the cloud only (see the note at the top and `CLAUDE.md`).

- Moye's local copy on his Windows PC under `C:\Users\moyea\OneDrive\Desktop\Certs\`. The exact folder he extracted version 6 into is unknown. His local progress lives in that folder's `.wrangler` database and only on that machine.
- His progress in the hosted copy is stored in the claude.ai artifact under his own sign-in.
- The labs use Power BI Desktop and Microsoft Project, which run on his computer. The app only supplies the files.
- His exam dates, and his name and why line if he has entered them, are in his own saved data (local or hosted), not in this folder. Unknown here.
- Booking and sitting the exams uses his own PMI, Microsoft, ISC2 and PeopleCert accounts. Which accounts exist: unknown.

## Changes made for version 8.0 (2026-11-11)

- New: `lib/tricert-plan.ts`, `lib/tricert-study.ts`, `lib/tricert-bank.ts`, `drizzle/0003_study_records.sql`, `tests/study.test.ts`, `tests/plan.test.ts`, `tests/bank.test.ts`, the ITIL files in `tools/content/parts2/`, and `docs/v8-rebuild-spec.md`.
- Rewritten: Today, Plan, Learn, Practice, Progress and Setup in `app/tricert-app.tsx`; `tools/harness/flows.mjs`; the saving code in `lib/tricert-repository.ts`, `app/api/state/route.ts` and `tools/harness/entry-artifact.tsx`.
- Removed: the 13-week track on Today, the old readiness score, the gate checks, the timed set and the old Review.
- ITIL content fixes (2026-11-11): the lifecycle is no longer presented as the Version 5 view of the value chain; PeopleCert's page was opened and its wording recorded; unconfirmed items are labelled "our plain-word reading" or "ITIL 4 background"; 85 lesson edits, and fixes to 12 flashcards and to the daily, mock A and mock B questions.

## Changes made while preparing the first handoff (2026-10-24)

- Moved the content pipeline into `tools/content` and the browser harness into `tools/harness`, and the logo script into `tools/harness/export-logo.mjs`. Repointed their paths to the repo root. Every tool was re-run afterwards (results in section 5).
- Cleaned `tools/harness/package.json`: removed unused font packages and its own React copy (so the app's React is used), and declared Playwright 1.56.0, which was installed before but not listed.
- Added `CLAUDE.md` with Moye's cloud-only instruction.
- `tsconfig.json`: excluded `tools`. `.gitignore`: added the harness output folders, `__pycache__` and `*.tsbuildinfo`. `docs/system-design.md`: added `save-personal` and the two new profile columns.

## Left out of the zip

- `node_modules/` (root) and `tools/harness/node_modules/`: dependencies. Recreate with `npm ci`.
- `dist/`, `.next/`, `.vinext/`: build and dev output. `dist/` also held a build-generated `prerenderSecret`.
- `.wrangler/`: the local D1 database and Wrangler state from test runs. Only test data.
- `tools/harness/out/` and `tools/harness/shots/`: harness builds and screenshots.
- `*.tsbuildinfo`: TypeScript cache.
- `.env` files and secrets: none existed.
- Not part of the current project, left in the old working area: earlier version folders and packages (versions 1 to 5), content backups, the version 4 content and brief, one-off scripts that first generated the content (the JSON in `parts2` was edited after they ran, so re-running them would undo the fact-check and later fixes), obsolete check scripts written for the version 2 interface, the version 5 logo scripts, earlier delivery zips and screenshots, and the version 2 design plan.
