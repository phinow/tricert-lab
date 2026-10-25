# Instructions for Claude Code: TriCert Lab

Read `HANDOFF.md` before doing anything else.

## Run in the cloud only

Moye's instruction (2026-10-24): this project runs strictly in the cloud.

- Do all work inside this cloud session's own environment: installs, builds, the dev server, tests, screenshots, content scripts and zips.
- Never use tools that reach Moye's computer. That means no remote device shell, no staging or writing his files, no computer use, no browser on his machine, and no requests for folder access.
- Never ask Moye to run commands on his own computer. Run them here and give him the result.
- If a task can only happen on his computer (see `HANDOFF.md` section 9), skip it and tell him in one line.
- To show him the app, run it here and send screenshots, or republish the hosted artifact if this session's tools allow it.
- Push to the private GitHub repo only when he asks.

## House rules

- Writing in the app and in replies: no em dashes, and never these words: Delve, Tapestry, Landscape, Spearheaded, Seamless, Navigating, Fostering, Comprehensive, Transformative, Pivotal, Successfully, Effectively, Carefully, Strategically, Proactively.
- Learning content: edit `tools/content/parts2/*.json`, then run `python3 -I tools/content/check2.py <file>` and `python3 -I tools/content/build-library.py`. Never edit `lib/tricert-library.ts` or `lib/tricert-reading.ts` by hand.
- Before calling work done, run `npm test`, `npm run lint` and `npm run build` in the root, and `npm run flows` in `tools/harness`. Expected results are in `HANDOFF.md` section 5.
