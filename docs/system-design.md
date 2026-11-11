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
- `study_records` (version 8, migration `drizzle/0003_study_records.sql`): one JSON value per learner and record key (`plan`, `srs`, `mocks`, `log`, `usercards`), with its update time. Created on start like the other tables.

Indexes support the real access patterns: progress by learner and status, attempts by learner and certification/domain and by learner and question, artifacts by learner and status, and one record per learner and key.

### Records (version 8)

| Key | Shape | Changed by |
| --- | --- | --- |
| `plan` | `{ startDate }` | `patch-record` |
| `srs` | `{ cards: { <card id>: { stage, due } }, questions: { <question id>: { stage, due, last } } }` | `patch-record` |
| `mocks` | list of practice exam results, each with an `id` and its answers | `append-record` |
| `log` | list, one item per morning or weekend block: `id`, key, kind, date, minutes, cards, questions, right | `append-record` |
| `usercards` | list of cards written in Mistakes, each with an `id` | `append-record` |

A finished morning is still a `progress` row with the morning key.

### Size limits

The local copy and the hosted copy use the same limits. A value over its limit is refused with a message that names the field, the length and the limit, and nothing is saved. Nothing is cut short.

| Field | Characters |
| --- | --- |
| Work (`evidenceText`) | 20,000 |
| Explanation (`reflection`) | 6,000 |
| One record, as JSON | 200,000 |
| Projects led | 4,000 |
| Name / reason | 40 / 140 |
| Item key / question id / document key | 120 / 160 / 160 |
| Exam / area / answer | 20 / 200 / 20 |
| Record item `id` | 200 |

The hosted store also refuses any document over 256 KB; the hosted copy checks this before writing.

## API contracts

### `GET /api/state`

Returns `{ profile, progress, attempts, artifacts, records }`. The repository ensures required tables exist for local preview.

- `attempts`: the latest answer to each question, newest first, with no row limit. Each row also has `first_at` (time of the first answer to that question) and `tries` (answers to it so far).
- `records`: always all five keys. Empty defaults: `plan: {}`, `srs: { cards: {}, questions: {} }`, `mocks: []`, `log: []`, `usercards: []`.

### `PUT /api/state`

Accepts a discriminated action:

- `save-profile`
- `save-personal` (display name and the one-line reason for studying, added in version 6)
- `set-progress`
- `record-attempt`
- `save-artifact`
- `patch-record` `{ key: 'plan' | 'srs', patch }` (version 8): deep-merges `patch` into the stored record. Objects merge to three levels (the record, its fields, and their fields: `srs`, then `cards`, then one card), so `{ cards: { 'card:x': { stage: 2 } } }` keeps that card's `due`. Deeper values and arrays are replaced whole. `null` removes a key.
- `append-record` `{ key: 'mocks' | 'log' | 'usercards', item }` (version 8): `item` is an object with a string `id`. It is added at the end, or replaces in place the item with the same `id`.

Every action is validated server-side. Unknown fields are ignored. Strings over their limit and records over 200,000 characters are refused with status 400 and `{ error }`; numeric ranges are clamped. Every successful `PUT` returns the whole state, as `GET` does.

The local copy changes a record by reading it, applying the change, and writing only if the stored value is still the one it read; otherwise it reads again (up to five times).

## Hosted copy

`tools/harness/entry-artifact.tsx` answers `/api/state` from the claude.ai artifact's private store, under the viewer's own collection `data/users/<id>/`. Every document path there has four segments.

| Document | Body |
| --- | --- |
| `state` | `{ profile, progress }` |
| `attempts` | `{ rows }`, the latest answer per question, newest first, with `first_at` and `tries` |
| `rec-<key>` | `{ key, value, updated_at }` for each record |
| `doc-<document key>` | one written document: `artifact_key`, `status`, `evidence_text`, `reflection`, `updated_at`. Characters a store segment does not allow (and `~`) are written as `~` and two hex digits per byte. |

- Load reads the collection once. Nothing is written before a successful read; a failed read shows a visible error and the next request tries again.
- Each save reads the documents it changes, applies the change, and writes only those, one save at a time. Two devices changing different documents keep both.
- A version 7.1.1 `state` document (attempts and artifacts inside it) is split on first load: each part is read again, the new documents are written first and `state` last, keeping the newer copy where both exist. An interrupted split finishes on the next load.
- `tools/harness/save.mjs` checks all of this against a stand-in store that follows the store's path and size rules.

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
