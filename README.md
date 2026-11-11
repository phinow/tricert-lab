# TriCert Lab

TriCert Lab is a private, local-first study and portfolio workspace that connects PMP delivery, Microsoft PL-300 analytics, CISSP security judgment, and ITIL Foundation (Version 5) service management through one fictional programme: Project Beacon at Kestrel Health Network, a fictional Alberta health network. You learn by building Beacon week by week: trusted patient-flow analytics, safe clinician access, and cyber resilience.

It does not guarantee an exam result, reproduce proprietary questions, or make binding eligibility decisions. Use the official PMI, Microsoft, ISC2, and PeopleCert links in the application to confirm current requirements.

## Run locally

Requirements: Node.js 22.13 or newer.

```bash
npm install
npm run dev
```

Open `http://localhost:3000`. No sample credentials are required for local use. The hosted version uses the platform’s private owner access instead of application-managed passwords.

Useful checks:

```bash
npm run lint
npm test
npm run build
npm run test:e2e
```

Browser checks run from `tools/harness` (`npm run flows`, `npm run save`, `npm run live`); see `HANDOFF.md` section 5. Run `test:e2e` while the development server is active. Set `TRICERT_BASE_URL` to test another deployment.

## Demonstration walkthrough

The app studies one exam at a time, in this order: ITIL Foundation (Version 5), PL-300, PMP, CISSP. Only the ITIL block is built (version 8.0); the others show "Being built". There are five places: Today, Plan, Learn, Practice and Progress. On a laptop they sit in the left sidebar; on a phone they are the tabs at the bottom, with your initial at the top right for "Make it yours".

1. Complete the three setup steps: you (name and why), your background (education, months leading projects, months of security work, whether the 35 PMP training hours are done) and your rhythm (start date). The PMP and CISSP eligibility notes are advisory.
2. On Today, press Start morning. A morning has four parts: Cards (due flashcards), Learn (a brief, the lesson, one task you do yourself and three recall prompts), Questions (up to 20, with Sure or Guess) and Mistakes (one line per miss, each becoming a flashcard). Finish morning saves it. The Short morning link does cards, due questions and mistakes only. On Saturday and Sunday, Today shows the weekend block: a lab, or a full practice exam.
3. Open Plan to see the four exam blocks with estimated dates from your start date, and the mornings and weekend blocks of the current block.
4. Open Learn. Lessons holds the block's lessons and the 65 Kestrel lessons. Documents holds the 66 Beacon documents by release; open one to read how to write it and the finished example, then save your own draft. Exams and Glossary hold the four exam guides and 242 terms.
5. Open Practice. Start with Today's review (flashcards and questions that are due). Practice exam is 40 questions in 60 minutes with no feedback until the end; unanswered questions count as wrong. Flashcards, Scenarios across exams and Labs are below.
6. Open Progress. "Ready to book?" shows four checks: all learning mornings done, two practice exams at or above 80% at least 7 days apart, no weak area, and 80% right on delayed reviews. Below are the practice exam history and the delayed-review score. Portfolio tracks the handover package and holds the demonstration script, the disclosure and the logo.

## Architecture

- React and TypeScript interface built with the Sites scaffold
- A pure study engine (`lib/tricert-study.ts`) for spaced review, daily sets, practice exams, Ready to book and estimated dates; it never reads the clock
- D1/SQLite-compatible storage behind a server repository boundary
- Parameterized queries and validated mutation actions
- Static CSV, SQL, Markdown, and Microsoft Project-compatible lab exports
- No paid cloud service, Power BI embedding, or real company data required

Detailed decisions are in [docs/system-design.md](docs/system-design.md), with security assumptions in [docs/security.md](docs/security.md).
