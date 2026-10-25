# Independent fact-check and consistency brief

You did not write this content. Your job is to find and fix errors and inconsistencies, not to restyle it. The learner relies on this content instead of any other source, so every claim must be true.

Read first:
- tools/content/BRIEF2.md (style rules, formatting subset, app behaviour)
- tools/content/WORLD.md (the case and its programme canon)
- tools/content/DECISIONS.md (final values that override any writer's choice)
- tools/content/verified-facts.md and verified-alberta.md (the authority for exam facts and Alberta law, CTAS, CIHI and Power BI time intelligence)
- Data: tools/content/datasets/out/ (CSV files, quality-and-reconciliation.md, truth.json)
- Curriculum: lib/tricert-content.ts (sessions, `docs` each session builds, document keys)

Check every claim in your files:
1. Exam facts against verified-facts.md; Alberta law, CTAS and CIHI definitions against verified-alberta.md (including its "How writers must use this file" rules). No invented counts, fees, pass marks, section numbers or rules.
2. Every Kestrel number: recompute it with Python from the CSVs using the cleaning rules in quality-and-reconciliation.md, or find it in truth.json. Fix any that do not match. A value that is a plan, target or estimate must be labelled proposed, agreed, estimate or example.
3. Technical correctness: DAX, Power Query M and SQL must be syntactically valid and correct for the real tables and columns; Power BI behaviour must be current; project management, security and ITIL Version 5 concepts must be right. Verify anything you are unsure of with WebSearch or WebFetch against a primary source (Microsoft Learn, PMI, ISC2, NIST, FIRST, PeopleCert or itil.com, oipc.ab.ca, alberta.ca, cihi.ca). If you still cannot confirm a claim, remove or soften it.
4. Consistency: apply DECISIONS.md everywhere. For a lesson, the finished documents it builds are in parts2/docguides-*.json under the keys in that session's `docs`; the lesson's build steps, figures, names and IDs must agree with those documents (change the lesson, unless the document is wrong, then report it). Within your files, the same fact must be stated the same way.
5. Style: no em dashes, no banned words, nothing that sends the learner to look things up elsewhere, "PIA" only for physician initial assessment.

Edit the JSON with Python (load, change, json.dump(data, f, ensure_ascii=False, indent=1)). Keep the schema. After editing run:
  python3 -I tools/content/check2.py <file>
until it prints OK. Before editing, copy each file you will change to tools/content/fc-backup/ (a scratch folder; do not commit it) (create it).

Report back: every change (file, key or id, what was wrong, what it says now, source or computation), any document problem you found but did not fix (if you only check lessons), and any claim left in that you could not fully verify.
