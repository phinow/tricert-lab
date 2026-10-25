"""Validate Project Beacon content JSON: schema plus style rules.
Usage: python3 -I check2.py file.json [more.json ...]"""
import json, re, sys

import os
CONTENT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'lib', 'tricert-content.ts')
src = open(CONTENT, encoding='utf-8').read()

SESSION_KEYS = {f'w{w}-s{s}' for w in range(1, 14) for s in range(1, 6)}
DELIVERABLE_KEYS = set()
for prefix in ('r1', 'r2', 'r3'):
    for title in re.findall(rf"\b{prefix}\('([^']+)'", src):
        slug = re.sub(r'[^a-z0-9]+', '-', title.lower()).strip('-')
        DELIVERABLE_KEYS.add(f'{prefix}-{slug}')
# Sessions with no documents (gates, mocks, repair days) must carry their own model answer.
NO_DOC_SESSIONS = set()
for week_block in re.finditer(r"makeTasks\((\d+), \[(.*?)\]\),\n  \}", src, re.S):
    week = int(week_block.group(1))
    for index, docs in enumerate(re.findall(r"\], \[([^\]]*)\]\],", week_block.group(2))):
        if not docs.strip():
            NO_DOC_SESSIONS.add(f'w{week}-s{index + 1}')

CERTS = {'PMP', 'PL-300', 'CISSP', 'ITIL'}
BANNED = ['delve', 'delves', 'delving', 'tapestry', 'landscape', 'landscapes', 'spearhead', 'spearheaded', 'seamless', 'seamlessly', 'navigating', 'fostering', 'foster', 'comprehensive', 'comprehensively', 'transformative', 'pivotal', 'successfully', 'effectively', 'carefully', 'strategically', 'proactively']
BANNED_RE = re.compile(r'\b(' + '|'.join(BANNED) + r')\b', re.I)
FILLER_RE = re.compile(r"it is important to note|in today's|it's worth noting|worth noting", re.I)
# The learner must never be sent away to find material.
RESEARCH_RE = re.compile(r"\bresearch\b|\blook (it |this |them |these |that )?up\b|\bsearch (for|online|the web)\b|\bgoogle\b|\bbrowse\b|\bvisit (the|pmi|isc2|microsoft|peoplecert|itil)|check the official|official (web)?site|pmi\.org|isc2\.org|learn\.microsoft|peoplecert\.org|itil\.com|\bnorthstar\b", re.I)
PIA_PRIVACY_RE = re.compile(r'privacy impact assessment \(PIA\)|\bPIA\b[^.]{0,40}privacy', re.I)

problems = []

def walk(value, path):
    if isinstance(value, str):
        if '—' in value:
            problems.append(f'{path}: em dash')
        for m in re.finditer('–', value):
            before = value[m.start() - 1] if m.start() else ''
            after = value[m.end()] if m.end() < len(value) else ''
            if not (before.isdigit() and after.isdigit()):
                problems.append(f'{path}: en dash used as a dash')
        for regex, label in ((BANNED_RE, 'banned word'), (FILLER_RE, 'filler phrase'), (RESEARCH_RE, 'sends the learner away or names the old case'), (PIA_PRIVACY_RE, 'PIA used for privacy impact assessment')):
            hit = regex.search(value)
            if hit:
                problems.append(f'{path}: {label} "{hit.group(0)}"')
        if value.strip().lower().startswith('note:'):
            problems.append(f'{path}: starts with Note:')
        if not value.strip():
            problems.append(f'{path}: empty string')
    elif isinstance(value, list):
        for i, item in enumerate(value):
            walk(item, f'{path}[{i}]')
    elif isinstance(value, dict):
        for k, item in value.items():
            walk(item, f'{path}.{k}')

def need(cond, msg):
    if not cond:
        problems.append(msg)

def strs(v, lo, hi, path, minlen=1):
    need(isinstance(v, list) and lo <= len(v) <= hi and all(isinstance(x, str) and len(x) >= minlen for x in v), f'{path}: expected {lo}-{hi} strings of at least {minlen} chars')

def check_item(kind, it, p):
    if kind == 'lessons':
        key = it.get('key')
        need(key in SESSION_KEYS, f'{p}.key invalid: {key}')
        need(isinstance(it.get('summary'), str) and 60 <= len(it['summary']) <= 400, f'{p}.summary 60-400 chars')
        read = it.get('read')
        ok = isinstance(read, list) and 4 <= len(read) <= 8 and all(isinstance(x, dict) and isinstance(x.get('heading'), str) and isinstance(x.get('body'), str) and len(x['body']) >= 300 for x in read)
        need(ok, f'{p}.read: 4-8 sections of {{heading, body>=300}}')
        if ok:
            need(sum(len(x['body']) for x in read) >= 3500, f'{p}.read: total teaching text must be >= 3500 chars (is {sum(len(x["body"]) for x in read)})')
        terms = it.get('keyTerms')
        need(isinstance(terms, list) and 3 <= len(terms) <= 8 and all(isinstance(x, dict) and isinstance(x.get('term'), str) and isinstance(x.get('definition'), str) and len(x['definition']) >= 40 for x in terms), f'{p}.keyTerms: 3-8 of {{term, definition>=40}}')
        build = it.get('build')
        need(isinstance(build, dict), f'{p}.build missing')
        if isinstance(build, dict):
            need(isinstance(build.get('goal'), str) and len(build['goal']) >= 60, f'{p}.build.goal >= 60 chars')
            strs(build.get('steps'), 4, 8, f'{p}.build.steps', 30)
            answer = build.get('modelAnswer')
            if key in NO_DOC_SESSIONS:
                need(isinstance(answer, str) and len(answer) >= 800, f'{p}.build.modelAnswer >= 800 chars required (this session builds no document)')
            else:
                need(answer is None or (isinstance(answer, str) and len(answer) >= 200), f'{p}.build.modelAnswer optional, but >= 200 chars if present')
        t = it.get('examTips')
        need(isinstance(t, list) and 2 <= len(t) <= 4 and all(isinstance(x, dict) and x.get('cert') in CERTS and isinstance(x.get('tip'), str) and len(x['tip']) >= 60 for x in t), f'{p}.examTips: 2-4 of {{cert, tip>=60}}')
        strs(it.get('pitfalls'), 2, 4, f'{p}.pitfalls', 30)
        c = it.get('check')
        need(isinstance(c, list) and len(c) == 3 and all(isinstance(x, dict) and isinstance(x.get('q'), str) and isinstance(x.get('a'), str) and len(x['a']) >= 60 for x in c), f'{p}.check: exactly 3 of {{q, a>=60}}')
    elif kind == 'docguides':
        need(it.get('key') in DELIVERABLE_KEYS, f'{p}.key invalid: {it.get("key")}')
        need(isinstance(it.get('purpose'), str) and len(it['purpose']) >= 80, f'{p}.purpose >= 80')
        s = it.get('sections')
        need(isinstance(s, list) and 5 <= len(s) <= 9 and all(isinstance(x, dict) and isinstance(x.get('heading'), str) and isinstance(x.get('guidance'), str) and len(x['guidance']) >= 80 for x in s), f'{p}.sections: 5-9 of {{heading, guidance>=80}}')
        md = it.get('modelDocument')
        need(isinstance(md, str) and len(md) >= 1500, f'{p}.modelDocument >= 1500 chars')
        if isinstance(md, str):
            need(md.count('## ') >= 4, f'{p}.modelDocument should use at least 4 "## " section headings')
        strs(it.get('mistakes'), 2, 4, f'{p}.mistakes', 30)
    elif kind == 'glossary':
        need(isinstance(it.get('term'), str) and it.get('cert') in CERTS | {'General'} and isinstance(it.get('definition'), str) and len(it['definition']) >= 40, f'{p}: {{term, cert, definition>=40}}')
    elif kind == 'flashcards':
        need(it.get('cert') in CERTS and isinstance(it.get('front'), str) and isinstance(it.get('back'), str), f'{p}: {{cert, front, back}}')
    elif kind == 'questions':
        need(isinstance(it.get('id'), str) and it['id'].startswith('q-'), f'{p}.id must start with q-')
        need(it.get('certification') in CERTS | {'Intersection'}, f'{p}.certification')
        need(isinstance(it.get('domain'), str), f'{p}.domain')
        need(isinstance(it.get('prompt'), str) and len(it['prompt']) >= 60, f'{p}.prompt')
        o = it.get('options')
        need(isinstance(o, list) and [x[0] for x in o] == ['A', 'B', 'C', 'D'] and all(isinstance(x[1], str) for x in o), f'{p}.options must be [[A,..],[B,..],[C,..],[D,..]]')
        need(it.get('correct') in ('A', 'B', 'C', 'D'), f'{p}.correct')
        need(isinstance(it.get('explanation'), str) and len(it['explanation']) >= 60, f'{p}.explanation')
        inc = it.get('incorrect')
        need(isinstance(inc, dict) and set(inc) == {'A', 'B', 'C', 'D'} - {it.get('correct')}, f'{p}.incorrect must cover the three wrong letters')
        need(it.get('artifactKey') in DELIVERABLE_KEYS, f'{p}.artifactKey invalid: {it.get("artifactKey")}')

for path in sys.argv[1:]:
    try:
        data = json.load(open(path, encoding='utf-8'))
    except Exception as error:
        problems.append(f'{path}: invalid JSON: {error}')
        continue
    kind = data.get('type')
    items = data.get('items')
    if kind not in ('lessons', 'docguides', 'glossary', 'flashcards', 'questions') or not isinstance(items, list):
        problems.append(f'{path}: top level must be {{"type": lessons|docguides|glossary|flashcards|questions, "items": [...]}}')
        continue
    keys = [it.get('key') or it.get('id') or it.get('term') or it.get('front') for it in items]
    dupes = {k for k in keys if keys.count(k) > 1}
    if dupes:
        problems.append(f'{path}: duplicate keys {sorted(dupes)[:5]}')
    for i, it in enumerate(items):
        check_item(kind, it, f'{path}#{i}({keys[i]})')
    walk(items, path)

if problems:
    print('\n'.join(problems[:200]))
    print(f'{len(problems)} problem(s)')
    sys.exit(1)
print('OK')
