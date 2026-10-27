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

Run `test:e2e` while the development server is active. Set `TRICERT_BASE_URL` to test another deployment.

## Demonstration walkthrough

The app has five places: Today, Plan, Learn, Practice and Progress. On a laptop they sit in the left sidebar; on a phone they are the tabs at the bottom, with your initial at the top right for "Make it yours".

1. Complete the five setup steps (your name and why, leadership, security, skills, exam dates). The PMP and CISSP eligibility notes are advisory.
2. On Today, press Start session. Focus mode keeps the timer, the lesson and the session's documents in one place. Finish the session, or use Mark done.
3. Open Plan to see the 13 weeks and the three exam gates. Open a week to jump to any session or to write that week's reflection.
4. Open Learn. Lessons holds the 65 lessons; Documents holds the 66 Beacon documents by release. Open a document to read how to write it and the finished example, then save your own draft with a teach-back explanation. Exams and Glossary hold the four exam guides and 242 terms.
5. In a document, use Check yourself to answer five decisions about it, choosing how sure you are before you check.
6. Open Practice for scenarios, a timed set for one exam, flashcards, labs with the Kestrel datasets, and Review for wrong or guessed answers.
7. Open Progress. Readiness starts with the five checks for your next exam gate (completion alone cannot mark an exam ready), then each exam's evidence score. Portfolio tracks the handover package and holds the demonstration script, the disclosure and the logo.

## Architecture

- React and TypeScript interface built with the Sites scaffold
- D1/SQLite-compatible storage behind a server repository boundary
- Parameterized queries and validated mutation actions
- Static CSV, SQL, Markdown, and Microsoft Project-compatible lab exports
- No paid cloud service, Power BI embedding, or real company data required

Detailed decisions are in [docs/system-design.md](docs/system-design.md), with security assumptions in [docs/security.md](docs/security.md).
