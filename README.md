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

1. Complete the eligibility baseline and review the advisory PMP/CISSP paths.
2. Open Roadmap, choose a week, and complete one daily session.
3. Open Project, pick a Beacon release and a document, read its guide and finished example, and save your own draft with a teach-back reflection. ITIL evidence includes value propositions, value streams, service measures, incident/problem workflows, and continual improvement.
4. Answer one artifact scenario and record confidence before reading the explanation.
5. Open Practice to use flashcards, download a lab, start a timed mock, and inspect the wrong-answer queue.
6. Open Readiness to review the five evidence gates; completion alone cannot mark an exam ready.
7. Open Portfolio to track export evidence and download the demonstration script.

## Architecture

- React and TypeScript interface built with the Sites scaffold
- D1/SQLite-compatible storage behind a server repository boundary
- Parameterized queries and validated mutation actions
- Static CSV, SQL, Markdown, and Microsoft Project-compatible lab exports
- No paid cloud service, Power BI embedding, or real company data required

Detailed decisions are in [docs/system-design.md](docs/system-design.md), with security assumptions in [docs/security.md](docs/security.md).
