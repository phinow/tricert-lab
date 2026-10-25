# Project Beacon content brief (read fully before writing)

TriCert Lab is a 13-week study app for four certifications: PMP, PL-300, CISSP and ITIL Foundation (Version 5). The learner studies by building ONE project: Project Beacon at Kestrel Health Network, a fictional Alberta health network. Every session the learner reads a lesson and builds part of Beacon.

The learner's exact words: "I don't want to have to do research. I want you to have done that for me. Then all I need to do is to read through and see how it is." So:
- Teach everything the session needs, in full, inside the lesson. Never tell the learner to look something up, read an official outline, visit a website, or research anything. The content IS the material.
- Show the finished result. Every build comes with a complete model version so the learner can see how it should look.

## Files you must read first
- tools/content/WORLD.md: the organization, programme, releases, people (E-IDs), systems (A-IDs), vendors (V-IDs), dates and the abbreviation rule. Use these names and IDs exactly.
- lib/tricert-content.ts: the 65 sessions (title, minutes, exams, and the `docs` each session builds) and the 66 deliverables (key = r1-/r2-/r3- plus the title lowercased with non-alphanumerics replaced by single hyphens).
- tools/content/verified-facts.md: the ONLY source for exam numbers, weights, task and domain names, eligibility, ITIL Version 5 terms.
- tools/content/verified-alberta.md: the ONLY source for Alberta privacy law (Health Information Act and others), CTAS levels and targets, and CIHI emergency definitions.
- tools/content/datasets/out/: the synthetic data files. quality-and-reconciliation.md and truth.json there are the ONLY source for numbers about Kestrel's data. Every figure you show (counts, medians, rates, budgets, earned value, critical path, overdue reviews, restore results) must come from truth.json or be computed by you with Python from the CSVs. Never invent a data figure. If you show a value that is a proposal or target rather than data (for example a target RTO the business agrees), label it as proposed or agreed.

## Accuracy rules
- Teach established professional knowledge correctly. If you are not certain of a detail, leave it out.
- Exam facts must match verified-facts.md exactly. Do not state fees, question counts or rules that are not there.
- Alberta law must match verified-alberta.md exactly, with the act named. If it is not in that file, do not state it as law; you may describe it as Kestrel policy.
- ITIL: Version 5 terms only (the eight lifecycle stages Discover, Design, Acquire, Build, Transition, Operate, Deliver, Support; value system; seven guiding principles; four dimensions). Never present ITIL 4 value chain activity names as current. The seven continual-improvement questions are the ITIL 4 model that Version 5 refines.
- PMP: July 2026 domains and task names from verified-facts.md.
- PL-300: current terms (semantic model, Import, DirectQuery, Direct Lake; Performance Analyzer; DAX query view; sensitivity labels; workspace roles; RLS applies to Viewers). DAX, Power Query M and SQL must be syntactically valid and use the real table and column names from the datasets and source-to-target.csv.
- CISSP: name the official domain when giving a tip.
- Abbreviation rule: "PIA" means physician initial assessment only; always write "privacy impact assessment" in full.

## Writing style (checked by script)
- Plain, direct, friendly. Second person ("you"). Short sentences. Canadian spelling (colour, centre, programme for Beacon, licence as a noun) except official exam terms, which stay exactly as published.
- No em dashes or en dashes used as dashes (a number range like 25–30% is fine). Use commas, colons or full stops.
- Never use: delve, tapestry, landscape, spearheaded, seamless, navigating, fostering, comprehensive, transformative, pivotal, successfully, effectively, carefully, strategically, proactively. No filler, no hype, no emoji. Do not start an item with "Note:".
- Never use the words research, look up, google, browse, visit, "official website", or any URL. Never mention NorthStar (the old case).

## Formatting inside text fields (the app renders this small markdown subset)
- Blank line between paragraphs.
- Lines starting "- " become bullets; lines starting "1. ", "2. " become a numbered list.
- A table is consecutive lines starting and ending with "|", with a separator line like "|---|---|" after the header row. Keep tables to 6 columns or fewer.
- Code (DAX, Power Query M, SQL) goes in a fenced block: a line ``` then the code then a line ```.
- In model documents only, "## Heading" starts a document section and "### Subheading" a subsection.
- No bold, italics, links or images.

## Output
Build your JSON with a Python script using json.dump(data, f, ensure_ascii=False, indent=1). Then run:
  python3 -I tools/content/check2.py <your-json-file>
and fix every problem until it prints OK. Report back only: the file path, the number of items, any data figure you computed yourself (with the method), and any fact you were unsure about and left out.

## How the app works (describe it exactly like this when a lesson refers to the app)
- Today shows the session; Start opens focus mode with a timer and this lesson; Mark done completes the session.
- Learn holds every lesson, the four exam guides, the writing guide and finished example for every document, and the glossary.
- Project shows Project Beacon's three releases and every document; each document has "How to write it", "See the finished example", a "Done when" checklist, a writing area, "Explain it in your own words", and "Check yourself" (five questions).
- Practice has Scenarios (all questions at your own pace), Timed set (15 minutes, questions for the exam you choose, recorded as evidence), Review (wrong or guessed answers), Flashcards (filter by exam) and Labs (with the Kestrel datasets).
- Progress shows four readiness rings (coverage 30, documents 35, judgment 25, recall 10) and, for the next exam gate, five checks: (1) every session before the gate is done; (2) every document in the releases up to the gate is complete; (3) two timed sets for that exam at 80% or better; (4) at least 24 decisions recorded for that exam with under 30% wrong; (5) no open wrong answers and at least 6 written explanations of 80 characters or more. Sit the exam only when all five are met.
