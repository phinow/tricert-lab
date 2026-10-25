# TriCert Lab system design

## Product outcome

TriCert Lab is a single-learner, local-first study and portfolio workspace for a 13-week PMP, PL-300, CISSP, and ITIL Foundation (Version 5) program. Learning is organized around one fictional programme, Project Beacon at Kestrel Health Network (Alberta), so that exam objectives are practised through decisions and artifacts rather than isolated notes.

The first product slice includes eligibility onboarding, the Week 1 plan, the Secure BI project, a project-charter artifact, a deliberately imperfect project dataset, one scenario quiz, durable learner progress, and a readiness visualization.

## Assumptions and constraints

- One learner, approximately 18-20 hours per week.
- Power BI Desktop and Microsoft Project remain external authoring tools.
- The site supplies lab instructions, datasets, rubrics, questions, and progress tracking; it does not pretend to generate `.pbix` or `.mpp` files.
- All Kestrel data is synthetic and safe to publish.
- Certification readiness is advisory and never an eligibility or pass guarantee.
- The MVP has no sign-in. A hosted owner-only site plus a single logical learner record provides the initial access boundary.

## Architecture

```text
Browser
  |  onboarding, curriculum, artifacts, quiz, readiness
  v
React client surface
  |  JSON over same-origin route handlers
  v
Study service / repository
  |  prepared statements, validation, deterministic scoring
  v
Cloudflare D1 (SQLite)
  learner profile | progress | quiz attempts | artifacts

Static curriculum and synthetic lab datasets
  domains | weeks | projects | questions | downloadable CSV
```

The curriculum is versioned with the source because it is authored content. Learner-owned state is stored in D1 because it must survive sessions and requires relational queries. Browser storage is limited to non-authoritative interface preferences if introduced later.

## Main components

1. **Eligibility and baseline gate** collects education, project leadership, training, cybersecurity experience, domain exposure, Power BI and ITIL skill baselines, study capacity, and target dates. It produces a checklist rather than a formal eligibility ruling.
2. **Curriculum engine** connects weeks, activities, projects, artifacts, and certification objectives.
3. **Project workspace** presents Beacon's three releases and 66 documents, each with a writing guide, a finished example, a template and a completion rubric.
4. **Study engine** records answers and confidence, explains outcomes, and directs weak concepts back to relevant artifacts.
5. **Readiness engine** calculates separate PMP, PL-300, CISSP, and ITIL advisory scores from coverage, completed evidence, and question performance. It applies a domain floor so a high aggregate cannot hide a severe gap.
6. **Portfolio export** will provide a case-study checklist and safe publishing guidance in the complete product.

## Data model

- `learner_profiles`: singleton learner settings and eligibility inputs, plus `display_name` and `motivation` (version 6).
- `progress_items`: completion state for activities and deliverables, uniquely keyed by learner and curriculum item.
- `quiz_attempts`: answer, correctness, confidence, certification, domain, and timestamp.
- `artifact_evidence`: artifact status, evidence note, reflection, and update time.

Indexes support the real access patterns: progress by learner and status, attempts by learner and certification/domain, and artifacts by learner and status.

## API contracts

### `GET /api/state`

Returns the learner profile, progress records, quiz attempts, and artifact evidence. The repository ensures required tables exist for local preview.

### `PUT /api/state`

Accepts a discriminated action:

- `save-profile`
- `save-personal` (display name and the one-line reason for studying, added in version 6)
- `set-progress`
- `record-attempt`
- `save-artifact`

Every action is validated server-side. Unknown fields are ignored and bounded strings and numeric ranges are enforced before persistence.

## Reliability and security

- All SQL uses prepared statements.
- Runtime initialization uses one statement per prepared call and batches related schema statements.
- Writes use deterministic identifiers or SQLite-generated integer keys.
- The client shows recoverable save errors and preserves the current form state.
- No secrets or confidential data are required.
- Content is output as React text nodes; learner text is never rendered as raw HTML.
- Owner-only deployment is the default. Multi-user hosting would require authentication and per-record ownership checks.
- Generated migrations remain in source and are inspected before deployment.

## Trade-offs

- **D1 instead of browser-only storage:** more setup, but learner state survives sessions and is ready for filtered progress history.
- **Static curriculum plus persistent state:** avoids needless database administration for authored content while keeping learner records durable.
- **Single-page workspace first:** makes the daily workflow fast and recognizable; multi-route deep dives can be added when content volume warrants it.
- **External Power BI Desktop:** avoids insecure public embedding and keeps the lab faithful to PL-300 authoring tasks.
- **No authentication in the MVP:** appropriate for an owner-only site, but it must be revisited before shared or multi-user access.

## Growth path

If the product grows, revisit authentication, per-user ownership, R2 artifact uploads, curriculum authoring tools, question versioning, richer spaced repetition, background export generation, audit-log retention, and shared instructor review.
