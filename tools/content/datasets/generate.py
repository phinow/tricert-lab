#!/usr/bin/env python3
"""Kestrel Health Network synthetic datasets for TriCert Lab.

Everything in these files is fictional. Kestrel Health Network, its people,
systems and vendors are invented (see ../WORLD.md). No real patient data is
used and patients are never named.

Run:  python3 generate.py
The script writes every file into ./out, re-reads the files it wrote,
computes the ground truth from them (no ground-truth number is typed by hand),
writes the documentation from that truth, and then runs a self-check.
A fixed seed makes every run identical.
"""
import csv
import json
import math
import os
import random
import re
import sqlite3
import statistics
import sys
from datetime import date, datetime, timedelta

SEED = 20261001
rng = random.Random(SEED)

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True)

AS_OF = date(2026, 10, 1)
AS_OF_DT = datetime(2026, 10, 1, 0, 0)
DT = '%Y-%m-%d %H:%M'
D = '%Y-%m-%d'
PERIOD_START = date(2026, 7, 1)
PERIOD_DAYS = 92
GATES = {12: date(2026, 10, 23), 20: date(2026, 11, 26), 28: date(2026, 12, 17)}
MANAGEMENT_RESERVE_CAD = 120000      # charter input, held outside the register
TRAINING_TARGET_PCT = 90             # Kestrel awareness-training target
SLA_HOURS = {'P1': 4, 'P2': 8, 'P3': 24, 'P4': 72}
REMEDIATION_DAYS = {'Critical': 7, 'High': 30, 'Medium': 60, 'Low': 90}
INJECTED = {}                        # what we broke on purpose, used by the self-check


# --------------------------------------------------------------------------- helpers
def fdt(x):
    return x.strftime(DT) if x else ''


def fd(x):
    return x.strftime(D) if x else ''


def lognorm(median, sigma):
    return median * math.exp(rng.gauss(0.0, sigma))


def wchoice(items, weights):
    return rng.choices(list(items), weights=weights, k=1)[0]


def write_csv(name, header, rows):
    with open(os.path.join(OUT, name), 'w', newline='', encoding='utf-8') as f:
        w = csv.writer(f, lineterminator='\n')
        w.writerow(header)
        for r in rows:
            w.writerow(['' if v is None else v for v in r])


def write_text(name, text):
    with open(os.path.join(OUT, name), 'w', encoding='utf-8') as f:
        f.write(text)


def read_rows(name):
    with open(os.path.join(OUT, name), newline='', encoding='utf-8') as f:
        data = list(csv.reader(f))
    return data[0], data[1:]


def dedup(rows):
    seen, uniq, dups = set(), [], []
    for r in rows:
        k = tuple(r)
        if k in seen:
            dups.append(r)
        else:
            seen.add(k)
            uniq.append(r)
    return uniq, dups


INVALID = 'INVALID'


def pdt(s):
    if s == '':
        return None
    try:
        return datetime.strptime(s, DT)
    except ValueError:
        return INVALID


def pdate(s):
    if s == '':
        return None
    try:
        return datetime.strptime(s, D).date()
    except ValueError:
        return INVALID


def pct(a, b):
    return round(100.0 * a / b, 1) if b else None


def med1(xs):
    return float(round(statistics.median(xs), 1)) if xs else None


def hours_between(a, b):
    return (b - a).total_seconds() / 3600.0


def minutes_between(a, b):
    return int(round((b - a).total_seconds() / 60.0))


# --------------------------------------------------------------------------- reference data
SITES = [
    ('KGH', 'Kestrel General Hospital', 'Central', 'Urban referral hospital'),
    ('ARH', 'Aspen Ridge Hospital', 'North', 'Community hospital'),
    ('CVH', 'Coulee Valley Hospital', 'South', 'Community hospital'),
    ('PGH', 'Prairie Gate Health Centre', 'Central', 'Rural health centre'),
]
SITE_CODES = [s[0] for s in SITES]
SITE_NAME = {s[0]: s[1] for s in SITES}
UNITS = [
    # unit_id, site, unit_name, unit_type, base staffed beds, mean occupancy, base ALC
    ('KGH-MED4A', 'KGH', 'KGH Medicine 4A', 'Medicine', 32, 0.95, 7),
    ('KGH-SUR5B', 'KGH', 'KGH Surgery 5B', 'Surgery', 28, 0.88, 2),
    ('KGH-ICU', 'KGH', 'KGH ICU', 'Intensive care', 12, 0.83, 0),
    ('ARH-MED', 'ARH', 'ARH Medicine', 'Medicine', 24, 0.90, 5),
    ('ARH-SUR', 'ARH', 'ARH Surgery', 'Surgery', 16, 0.82, 1),
    ('CVH-MED', 'CVH', 'CVH Medicine', 'Medicine', 22, 0.87, 4),
    ('PGH-MED', 'PGH', 'PGH Medicine', 'Medicine', 10, 0.76, 3),
]
UNIT_IDS = [u[0] for u in UNITS]
UNIT_SITE = {u[0]: u[1] for u in UNITS}
CTAS_REF = [(1, 'Resuscitation', 0), (2, 'Emergent', 15), (3, 'Urgent', 30),
            (4, 'Less urgent', 60), (5, 'Non-urgent', 120)]
CTAS_TARGET = {c: t for c, _, t in CTAS_REF}
DISPOSITIONS = ['Admitted', 'Discharged', 'LWBS', 'Transferred']
ED_TS = ['arrival_datetime', 'triage_datetime', 'pia_datetime', 'departure_datetime']


def gen_sites_units():
    write_csv('khn_sites.csv', ['site_code', 'site_name', 'zone', 'site_type'], SITES)
    write_csv('khn_units.csv', ['unit_id', 'site_code', 'unit_name', 'unit_type'],
              [u[:4] for u in UNITS])


# --------------------------------------------------------------------------- 2. ED visits
def gen_ed():
    counts = {'KGH': 215, 'ARH': 106, 'CVH': 102, 'PGH': 55}
    hour_w = [2, 1.5, 1.2, 1, 1, 1.2, 2, 3, 4.5, 5.5, 6, 6, 5.5, 5.5, 5, 5, 5.5, 6, 6.5, 6.5, 6, 5, 4, 3]
    start = datetime(2026, 7, 1)
    arrivals = []
    for site, n in counts.items():
        for _ in range(n):
            arrivals.append((start + timedelta(days=rng.randrange(PERIOD_DAYS),
                                               hours=wchoice(range(24), hour_w),
                                               minutes=rng.randrange(60)), site))
    arrivals.sort()
    site_wait = {'KGH': 1.45, 'ARH': 1.0, 'CVH': 0.95, 'PGH': 0.75}
    site_tri = {'KGH': 1.4, 'ARH': 1.0, 'CVH': 1.0, 'PGH': 0.8}
    board = {'KGH': 540, 'ARH': 240, 'CVH': 200, 'PGH': 120}
    disp_w = {1: [0.6, 0.1, 0.0, 0.3], 2: [0.38, 0.52, 0.0, 0.10], 3: [0.15, 0.78, 0.03, 0.04],
              4: [0.04, 0.87, 0.07, 0.02], 5: [0.01, 0.89, 0.10, 0.0]}
    age_w = {1: [8, 42, 50], 2: [8, 42, 50], 3: [15, 55, 30], 4: [25, 62, 13], 5: [27, 62, 11]}
    pia_med = {2: 16, 3: 45, 4: 70, 5: 80}
    disch_med = {1: 200, 2: 240, 3: 170, 4: 95, 5: 60}
    visits = []
    for i, (arr, site) in enumerate(arrivals, 1):
        ctas = wchoice([1, 2, 3, 4, 5], [1, 12, 42, 31, 14])
        age = wchoice(['0-17', '18-64', '65+'], age_w[ctas])
        p_amb = {1: 0.9, 2: 0.55, 3: 0.25, 4: 0.08, 5: 0.03}[ctas] + (0.1 if age == '65+' else 0.0)
        mode = 'Ambulance' if rng.random() < p_amb else 'Walk-in'
        hr = arr.hour
        eve = 1.25 if hr >= 17 else (0.85 if hr <= 6 else 1.0)
        if ctas == 1:
            tri = rng.choice([0, 0, 1])
            pia = tri + rng.choice([0, 0, 1, 2]) + (rng.choice([0, 0, 2]) if site == 'KGH' else 0)
        else:
            tri = max(1, round(lognorm(7 * site_tri[site] * eve, 0.5)))
            pia = max(tri + 2, round(lognorm(pia_med[ctas] * site_wait[site] * eve, 0.55)))
        w = list(disp_w[ctas])
        if ctas >= 3:
            w[2] *= min(2.0, max(0.4, pia / pia_med[ctas]))
        if site == 'KGH':
            w[2] *= 1.15
        if site == 'PGH':
            w[0] *= 0.5
            w[3] *= 3
        disp = wchoice(DISPOSITIONS, w)
        tri_dt = arr + timedelta(minutes=tri)
        if disp == 'LWBS':
            pia_dt = None
            dep_dt = tri_dt + timedelta(minutes=round(rng.uniform(40, 240)))
        else:
            pia_dt = arr + timedelta(minutes=pia)
            if disp == 'Discharged':
                post = lognorm(disch_med[ctas] * (1.2 if site == 'KGH' else 1.0), 0.5)
            elif disp == 'Admitted':
                post = lognorm(300, 0.35) + lognorm(board[site], 0.6)
            else:
                post = lognorm(280, 0.4)
            dep_dt = pia_dt + timedelta(minutes=max(20, round(post)))
        visits.append(dict(visit_id=f'V{i:04d}', site=site, arr=arr, ctas=ctas, tri=tri_dt, tri_min=tri,
                           pia=pia_dt, disp=disp, dep=dep_dt, age=age, mode=mode))

    def row(v):
        return [v['visit_id'], v['site'], fdt(v['arr']), str(v['ctas']), fdt(v['tri']), fdt(v['pia']),
                v['disp'], fdt(v['dep']), v['age'], v['mode']]

    rows = {v['visit_id']: row(v) for v in visits}
    used = set()

    def pick(cond):
        c = [v for v in visits if v['visit_id'] not in used and cond(v)]
        v = rng.choice(c)
        used.add(v['visit_id'])
        return v

    def pick_on_or_before(day, extra=lambda v: True):
        d = day
        while not [v for v in visits if v['visit_id'] not in used and v['arr'].date() == d and extra(v)]:
            d -= timedelta(days=1)
        return pick(lambda v: v['arr'].date() == d and extra(v))

    inj = {}
    dup_src = [pick_on_or_before(date(2026, 8, 31)) for _ in range(2)]
    inj['duplicates'] = sorted(v['visit_id'] for v in dup_src)
    lower = [pick(lambda v: v['site'] == 'KGH') for _ in range(2)]
    for v in lower:
        rows[v['visit_id']][1] = 'kgh'
    inj['lowercase'] = sorted(v['visit_id'] for v in lower)
    c0 = pick(lambda v: v['ctas'] == 3 and v['disp'] != 'LWBS')
    rows[c0['visit_id']][3] = '0'
    c6 = pick(lambda v: v['ctas'] == 4)
    rows[c6['visit_id']][3] = '6'
    inj['ctas'] = sorted([c0['visit_id'], c6['visit_id']])
    pbt = pick(lambda v: v['disp'] != 'LWBS' and v['ctas'] >= 2 and v['tri_min'] >= 8)
    rows[pbt['visit_id']][5] = fdt(pbt['tri'] - timedelta(minutes=5))
    pba = pick(lambda v: v['disp'] != 'LWBS' and v['ctas'] >= 2)
    rows[pba['visit_id']][5] = fdt(pba['arr'] - timedelta(minutes=20))
    inj['pia_before_triage'] = pbt['visit_id']
    inj['pia_before_arrival'] = pba['visit_id']
    mdp = pick(lambda v: v['disp'] == 'Discharged')
    rows[mdp['visit_id']][7] = ''
    inj['missing_departure'] = mdp['visit_id']
    inv = pick_on_or_before(date(2026, 9, 30))
    rows[inv['visit_id']][2] = '2026-09-31' + fdt(inv['arr'])[10:]
    inj['invalid_date'] = inv['visit_id']
    lp = pick(lambda v: v['disp'] == 'LWBS' and (v['dep'] - v['tri']) >= timedelta(minutes=60))
    rows[lp['visit_id']][5] = fdt(lp['tri'] + timedelta(minutes=30))
    inj['lwbs_with_pia'] = lp['visit_id']
    INJECTED['ed'] = inj

    out = []
    last_dup_day = max(v['arr'].date() for v in dup_src)
    inserted = False
    for idx, v in enumerate(visits):
        out.append(rows[v['visit_id']])
        nxt = visits[idx + 1]['arr'].date() if idx + 1 < len(visits) else None
        if not inserted and v['arr'].date() == last_dup_day and nxt != last_dup_day:
            for s in sorted(dup_src, key=lambda x: x['visit_id']):
                out.append(list(rows[s['visit_id']]))
            inserted = True
    write_csv('khn_ed_visits.csv', ['visit_id', 'site_code', 'arrival_datetime', 'ctas_level', 'triage_datetime',
                                    'pia_datetime', 'disposition', 'departure_datetime', 'age_band',
                                    'arrival_mode'], out)


# --------------------------------------------------------------------------- 3. bed census
def gen_beds():
    rows = []
    noise = {u[0]: 0.0 for u in UNITS}
    alc = {u[0]: u[6] for u in UNITS}
    for i in range(PERIOD_DAYS):
        d = PERIOD_START + timedelta(days=i)
        weekend = d.weekday() >= 5
        for (uid, site, name, utype, base, mean, alc_base) in UNITS:
            staffed = base
            if uid == 'KGH-SUR5B' and weekend:
                staffed -= 4
            if uid == 'ARH-SUR' and weekend:
                staffed -= 2
            if uid == 'CVH-MED' and date(2026, 8, 1) <= d <= date(2026, 8, 31):
                staffed -= 2
            if uid == 'PGH-MED' and date(2026, 7, 15) <= d <= date(2026, 8, 15):
                staffed -= 2
            noise[uid] = 0.7 * noise[uid] + rng.gauss(0, 0.035)
            m = mean - (0.06 if utype == 'Surgery' and weekend else 0.0)
            rate = min(1.0, max(0.55, m + noise[uid]))
            occ = min(staffed, round(staffed * rate))
            if uid == 'KGH-ICU':
                a = 1 if rng.random() < 0.06 else 0
            else:
                cur = alc[uid]
                step = wchoice([-1, 0, 1], [1, 3, 2] if cur < alc_base else ([2, 3, 1] if cur > alc_base else [1, 3, 1]))
                a = min(alc_base + 3, max(0, cur + step))
                alc[uid] = a
            a = min(a, occ)
            rows.append([fd(d), uid, staffed, occ, a])
    inj = {'missing': ('ARH-SUR', '2026-08-16'), 'duplicate': ('KGH-ICU', '2026-07-15'),
           'overcapacity': ('KGH-MED4A', '2026-09-08'), 'negative_alc': ('CVH-MED', '2026-07-22')}
    INJECTED['beds'] = inj
    out = []
    for r in rows:
        key = (r[1], r[0])
        if key == inj['missing']:
            continue
        if key == inj['overcapacity']:
            r[3] = r[2] + 2
        if key == inj['negative_alc']:
            r[4] = -1
        out.append(r)
        if key == inj['duplicate']:
            out.append(list(r))
    write_csv('khn_bed_census.csv', ['census_date', 'unit_id', 'staffed_beds', 'occupied_beds', 'alc_patients'], out)


# --------------------------------------------------------------------------- 5. schedule (needed by the register)
CAL = []
_d = date(2026, 9, 1)
while len(CAL) < 300:
    if _d.weekday() < 5:
        CAL.append(_d)
    _d += timedelta(days=1)

TASKS = [
    # id, name, duration (working days), predecessors, resource names, release
    (2, 'Charter approved', 0, [], 'Executive Sponsor;Programme Manager', 'Programme'),
    (3, 'Confirm requirements and KPI definitions', 6, [2], 'Programme Manager;Director of Patient Flow;Emergency Medical Director', 'Release 1'),
    (4, 'Complete privacy impact assessment', 12, [3], 'Chief Privacy Officer;Clinical Analytics Lead', 'Release 1'),
    (5, 'Profile and clean ED and bed census sources', 10, [3], 'Clinical Analyst;Clinical Analytics Lead', 'Release 1'),
    (6, 'Build warehouse staging and de-identified views', 8, [4, 5], 'Clinical Analytics Lead;Systems Administrator', 'Release 1'),
    (7, 'Threat model the analytics architecture', 7, [3], 'Chief Information Security Officer;Security Analyst', 'Release 1'),
    (8, 'Build semantic model and DAX measures', 7, [6], 'Clinical Analytics Lead;Power BI Consultant', 'Release 1'),
    (9, 'Configure RLS and sensitivity labels', 3, [7, 8], 'Clinical Analytics Lead;Security Analyst', 'Release 1'),
    (10, 'Prepare service desk support and knowledge articles', 4, [8], 'Service Desk Manager;Clinical Analyst', 'Release 1'),
    (11, 'User acceptance testing with ED and patient-flow leaders', 3, [9], 'Director of Patient Flow;Emergency Medical Director;Clinical Analyst', 'Release 1'),
    (12, 'Release 1 go-live gate', 0, [10, 11], 'Executive Sponsor;Chief Information Officer', 'Release 1'),
    (13, 'Design role catalogue and RBAC model', 12, [7], 'Chief Information Security Officer;HR Business Partner', 'Release 2'),
    (14, 'Integrate joiner-mover-leaver events from HR', 12, [12, 13], 'HR Business Partner;Systems Administrator', 'Release 2'),
    (15, 'Roll out MFA and single sign-on', 10, [12], 'Network Engineer;Systems Administrator', 'Release 2'),
    (16, 'Implement privileged access and SoD controls', 8, [12, 13], 'Chief Information Security Officer;Systems Administrator', 'Release 2'),
    (17, 'Redesign the access-request value stream', 8, [14], 'Service Desk Manager;Programme Manager', 'Release 2'),
    (18, 'Run Q3 access review and recertification', 6, [15, 16], 'Chief Information Security Officer;Service Desk Manager', 'Release 2'),
    (19, 'Release 2 pilot and acceptance testing', 4, [17, 18], 'Emergency Charge Nurse;Unit Clerk;Service Desk Manager', 'Release 2'),
    (20, 'Release 2 acceptance gate', 0, [19], 'Executive Sponsor;Chief Information Security Officer', 'Release 2'),
    (21, 'Complete business impact analysis and recovery targets', 5, [20], 'Business Continuity Lead;Executive Sponsor', 'Release 3'),
    (22, 'Test CIS restore and downtime procedures', 6, [21], 'Business Continuity Lead;Systems Administrator;CIS Vendor Support', 'Release 3'),
    (23, 'Update incident response plan and run tabletop exercise', 5, [21], 'Chief Information Security Officer;Security Analyst', 'Release 3'),
    (24, 'Remediate priority vulnerabilities', 7, [20], 'Security Analyst;Systems Administrator', 'Release 3'),
    (25, 'Build security operations dashboard', 4, [24], 'Clinical Analytics Lead;Security Analyst', 'Release 3'),
    (26, 'Hold major-incident review', 2, [22, 23], 'Chief Information Security Officer;Service Desk Manager', 'Release 3'),
    (27, 'Close programme and record lessons learned', 2, [25, 26], 'Programme Manager', 'Release 3'),
    (28, 'Programme acceptance', 0, [27], 'Executive Sponsor;Programme Manager', 'Programme'),
]


def cpm(tasks):
    """Critical path method on working-day boundaries.
    tasks: {id: {'dur': int, 'preds': [ids]}}. Boundary b = start of working day b."""
    order, placed = [], set()
    while len(order) < len(tasks):
        progressed = False
        for t in sorted(tasks):
            if t not in placed and all(p in placed for p in tasks[t]['preds']):
                order.append(t)
                placed.add(t)
                progressed = True
        if not progressed:
            raise ValueError('schedule has a loop or a missing predecessor')
    ES, EF = {}, {}
    for t in order:
        ES[t] = max((EF[p] for p in tasks[t]['preds']), default=0)
        EF[t] = ES[t] + tasks[t]['dur']
    finish = max(EF.values())
    succ = {t: [] for t in tasks}
    for t in tasks:
        for p in tasks[t]['preds']:
            succ[p].append(t)
    LS, LF = {}, {}
    for t in reversed(order):
        LF[t] = min((LS[s] for s in succ[t]), default=finish)
        LS[t] = LF[t] - tasks[t]['dur']
    TF = {t: LS[t] - ES[t] for t in tasks}
    FF = {t: min((ES[s] for s in succ[t]), default=finish) - EF[t] for t in tasks}
    return ES, EF, LS, LF, TF, FF, finish


def show_finish(ef):
    return CAL[ef - 1] if ef > 0 else CAL[0]


def show_start(es, ef, dur):
    return show_finish(ef) if dur == 0 else CAL[es]


SCHED = {}


def gen_schedule():
    tasks = {t[0]: {'dur': t[2], 'preds': t[3]} for t in TASKS}
    ES, EF, LS, LF, TF, FF, finish = cpm(tasks)
    for tid, gate in GATES.items():
        assert show_finish(EF[tid]) == gate, (tid, show_finish(EF[tid]), gate)
    SCHED.update(ES=ES, EF=EF, finish=finish)
    rows = [[1, 'Project Beacon programme', f'{finish}d', fd(CAL[0]), '', 'Programme Manager', 'No', 'Programme']]
    for tid, name, dur, preds, res, rel in TASKS:
        rows.append([tid, name, f'{dur}d', '', ','.join(str(p) for p in preds), res,
                     'Yes' if dur == 0 else 'No', rel])
    write_csv('khn_schedule.csv', ['ID', 'Name', 'Duration', 'Start', 'Predecessors', 'Resource Names',
                                   'Milestone', 'Release'], rows)


# --------------------------------------------------------------------------- 4. programme register
WPS = [
    # wp_id, release, work package, owner, schedule tasks, budget, actual %, actual cost, status, risk
    ('WP-101', 1, 'Programme mobilization and charter', 'E-019', [2, 3], 40000, 100, 41200, 'Complete', 'Low'),
    ('WP-102', 1, 'Privacy impact assessment and threat model', 'E-003', [4, 7], 70000, 90, 68500, 'In progress', 'Medium'),
    ('WP-103', 1, 'Source profiling, data quality and warehouse staging', 'E-013', [5, 6], 130000, 60, 92300, 'In progress', 'High'),
    ('WP-104', 1, 'Semantic model, dashboards and row-level security', 'E-006', [8, 9, 11], 140000, 5, 9000, 'In progress', 'High'),
    ('WP-105', 1, 'Service transition and service desk readiness', 'E-005', [10], 40000, 0, 0, 'Not started', 'Medium'),
    ('WP-106', 2, 'Role catalogue and RBAC design', 'E-004', [13], 90000, 40, 39600, 'In progress', 'Medium'),
    ('WP-107', 2, 'Joiner-mover-leaver integration with HR', 'E-018', [14], 110000, 0, 0, 'Not started', 'High'),
    ('WP-108', 2, 'MFA and single sign-on rollout', 'E-017', [15], 130000, 0, 0, 'Not started', 'High'),
    ('WP-109', 2, 'Privileged access and segregation of duties', 'E-004', [16], 70000, 0, 0, 'Not started', 'High'),
    ('WP-110', 2, 'Access-request value stream and access reviews', 'E-005', [17, 18, 19], 60000, 0, 0, 'Not started', 'Medium'),
    ('WP-111', 3, 'Business impact analysis and recovery targets', 'E-016', [21], 55000, 0, 0, 'Not started', 'Medium'),
    ('WP-112', 3, 'CIS restore testing and downtime procedures', 'E-016', [22], 85000, 0, 0, 'Not started', 'High'),
    ('WP-113', 3, 'Incident response plan and tabletop exercise', 'E-004', [23], 60000, 0, 0, 'Not started', 'Medium'),
    ('WP-114', 3, 'Vulnerability remediation and security operations dashboard', 'E-020', [24, 25], 80000, 0, 0, 'Not started', 'High'),
    ('WP-115', 3, 'Major-incident review and programme closure', 'E-019', [26, 27], 40000, 0, 0, 'Not started', 'Low'),
]
WP_TASKS = {w[0]: w[4] for w in WPS}


def gen_register():
    dur = {t[0]: t[2] for t in TASKS}
    ES, EF = SCHED['ES'], SCHED['EF']
    as_of_idx = CAL.index(AS_OF)
    rows = []
    for wp, rel, name, owner, tids, budget, act, cost, status, risk in WPS:
        start = min(show_start(ES[t], EF[t], dur[t]) for t in tids)
        finish = max(show_finish(EF[t]) for t in tids)
        total = sum(dur[t] for t in tids)
        done = sum(min(dur[t], max(0, as_of_idx - ES[t])) for t in tids if dur[t] > 0)
        planned = int(round(100.0 * done / total)) if total else 0
        rows.append([wp, rel, name, owner, fd(start), fd(finish), budget, planned, act, cost, status, risk])
    byid = {r[0]: r for r in rows}
    inj = {}
    byid['WP-101'][8] = 110
    inj['pct_over_100'] = 'WP-101'
    byid['WP-103'][10] = 'in progress'
    byid['WP-110'][10] = 'NOT STARTED'
    byid['WP-104'][11] = 'high'
    byid['WP-112'][11] = 'HIGH'
    inj['casing'] = ['WP-103', 'WP-104', 'WP-110', 'WP-112']
    byid['WP-108'][3] = ''
    inj['missing_owner'] = 'WP-108'
    inj['invalid_date_correct_value'] = byid['WP-109'][5]
    byid['WP-109'][5] = '2026-11-31'
    inj['invalid_date'] = 'WP-109'
    byid['WP-113'][6] = -byid['WP-113'][6]
    inj['negative_budget'] = 'WP-113'
    inj['duplicate'] = 'WP-104'
    INJECTED['register'] = inj
    out = []
    for r in rows:
        out.append(r)
        if r[0] == inj['duplicate']:
            out.append(list(r))
    write_csv('khn_programme_register.csv', ['wp_id', 'release', 'work_package', 'owner_id', 'planned_start',
                                             'planned_finish', 'budget_cad', 'planned_pct_as_of', 'pct_complete',
                                             'actual_cost_cad', 'status', 'risk_rating'], out)


# --------------------------------------------------------------------------- 6. service desk
def gen_desk():
    days = [date(2026, 8, 1) + timedelta(days=i) for i in range(61)]
    day_w = [1.0 if d.weekday() < 5 else 0.35 for d in days]
    hour_w = [0.2] * 6 + [0.8, 2, 4, 5, 5, 4.5, 3.5, 4.5, 4.5, 4, 3, 2, 1, 0.8, 0.6, 0.5, 0.4, 0.3]
    opened = sorted(datetime.combine(wchoice(days, day_w), datetime.min.time())
                    + timedelta(hours=wchoice(range(24), hour_w), minutes=rng.randrange(60)) for _ in range(219))
    cats = {
        'Incident': (['CIS issue', 'Virtual desktop', 'Printing', 'Network', 'Hardware', 'Power BI'], [28, 20, 18, 14, 12, 8]),
        'Service request': (['Password reset', 'Hardware', 'Printing', 'Power BI'], [45, 25, 15, 15]),
        'Access request': (['CIS access', 'Power BI', 'Virtual desktop'], [70, 20, 10]),
    }
    group = {'CIS access': 'Identity and Access', 'CIS issue': 'Clinical Applications', 'Power BI': 'Analytics Support',
             'Virtual desktop': 'End User Computing', 'Printing': 'End User Computing', 'Network': 'Network Services',
             'Password reset': 'Service Desk', 'Hardware': 'End User Computing'}
    tickets = []
    for i, op in enumerate(opened):
        tid = f'SD-{10001 + i}'
        ttype = wchoice(['Incident', 'Service request', 'Access request'], [52, 26, 22])
        cat = wchoice(*cats[ttype])
        if ttype == 'Incident':
            pr = wchoice(['P1', 'P2', 'P3', 'P4'], [6, 30, 48, 16] if cat == 'CIS issue' else [3, 14, 50, 33])
        else:
            pr = wchoice(['P3', 'P4'], [40, 60])
        site = wchoice(SITE_CODES, [50, 20, 20, 10])
        chan = wchoice(['Phone', 'Portal', 'Walk-up'], [70, 20, 10] if cat == 'Password reset' else [40, 45, 15])
        if ttype == 'Access request':
            hrs = lognorm(110, 0.5)
        elif cat == 'Password reset':
            hrs = lognorm(0.6, 0.6)
        elif ttype == 'Service request':
            hrs = lognorm(20 if pr == 'P3' else 50, 0.6)
        else:
            hrs = lognorm({'P1': 2.8, 'P2': 6.5, 'P3': 16, 'P4': 40}[pr], {'P1': 0.45, 'P2': 0.5, 'P3': 0.7, 'P4': 0.7}[pr])
        res = op + timedelta(minutes=max(5, round(hrs * 60)))
        if res >= AS_OF_DT:
            res = None
        target = SLA_HOURS[pr]
        if res:
            met = 'Y' if hours_between(op, res) <= target else 'N'
        else:
            met = 'N' if hours_between(op, AS_OF_DT) > target else ''
        reopened = 'Y' if rng.random() < (0.08 if ttype == 'Incident' else 0.03) else 'N'
        csat = ''
        if res and rng.random() < 0.4:
            csat = str(wchoice([5, 4, 3, 2, 1], [40, 35, 15, 6, 4] if met == 'Y' else [8, 17, 30, 25, 20]))
        tickets.append(dict(id=tid, type=ttype, op=op, res=res, pr=pr, cat=cat, site=site,
                            grp='Identity and Access' if ttype == 'Access request' else group[cat],
                            chan=chan, target=target, met=met, reopened=reopened, csat=csat))

    def row(t):
        return [t['id'], t['type'], fdt(t['op']), fdt(t['res']), t['pr'], t['cat'], t['site'], t['grp'], t['chan'],
                t['target'], t['met'], t['reopened'], t['csat']]

    rows = {t['id']: row(t) for t in tickets}
    used = set()

    def pick(cond):
        c = [t for t in tickets if t['id'] not in used and cond(t)]
        t = rng.choice(c)
        used.add(t['id'])
        return t

    inj = {}
    rbo = pick(lambda t: t['type'] == 'Incident' and t['res'] is not None and hours_between(t['op'], t['res']) < 20)
    rows[rbo['id']][3] = fdt(rbo['res'] - timedelta(days=1))
    inj['resolved_before_opened'] = rbo['id']
    mp = pick(lambda t: t['type'] == 'Service request' and t['res'] is not None)
    rows[mp['id']][4] = ''
    rows[mp['id']][9] = ''
    rows[mp['id']][10] = ''
    inj['missing_priority'] = mp['id']
    con = pick(lambda t: t['type'] == 'Access request' and t['pr'] == 'P4' and t['res'] is not None
               and hours_between(t['op'], t['res']) > 72)
    rows[con['id']][10] = 'Y'
    inj['sla_contradiction'] = con['id']
    dup = pick(lambda t: t['type'] == 'Incident' and t['res'] is not None)
    inj['duplicate'] = dup['id']
    INJECTED['desk'] = inj
    out = []
    for t in tickets:
        out.append(rows[t['id']])
        if t['id'] == dup['id']:
            out.append(list(rows[t['id']]))
    write_csv('khn_service_desk.csv', ['ticket_id', 'ticket_type', 'opened_at', 'resolved_at', 'priority', 'category',
                                       'site_code', 'assignment_group', 'channel', 'sla_target_hours', 'sla_met',
                                       'reopened', 'csat'], out)


# --------------------------------------------------------------------------- 7. identity
IDENTITY = [
    # employee_id, full_name, job_role, department, site, manager, worker_type, hr_status, account, privileged, mfa, from, to, last_login
    ('E-001', 'Dr. Helen Marchetti', 'Executive', 'Clinical Operations', 'KGH', '', 'Employee', 'Active', 'Enabled', 'No', 'Yes', '2019-04-01', '', None),
    ('E-002', 'Marcus Bell', 'Executive', 'Information Technology', 'KGH', '', 'Employee', 'Active', 'Enabled', 'No', 'Yes', '2021-01-11', '', None),
    ('E-003', 'Priya Raman', 'Executive', 'Privacy Office', 'KGH', '', 'Employee', 'Active', 'Enabled', 'No', 'Yes', '2020-06-15', '', None),
    ('E-004', 'Daniel Osei', 'Executive', 'Information Security', 'KGH', 'E-002', 'Employee', 'Active', 'Enabled', 'No', 'Yes', '2022-02-07', '', None),
    ('E-005', 'Grace Liu', 'Service Desk Analyst', 'IT Service Desk', 'KGH', 'E-002', 'Employee', 'Active', 'Enabled', 'No', 'Yes', '2018-09-04', '', None),
    ('E-006', 'Tomás Rivera', 'Clinical Analyst', 'Clinical Analytics', 'KGH', 'E-001', 'Employee', 'Active', 'Enabled', 'No', 'Yes', '2020-10-19', '', None),
    ('E-007', 'Dr. Sarah Whitford', 'Physician', 'Emergency Department', 'KGH', 'E-001', 'Employee', 'Active', 'Enabled', 'No', 'No', '2017-07-01', '', None),
    ('E-008', 'Janelle Cardinal', 'Executive', 'Patient Flow', 'KGH', 'E-001', 'Employee', 'Active', 'Enabled', 'No', 'Yes', '2021-05-03', '', None),
    ('E-009', 'Kevin Park', 'System Administrator', 'Information Technology', 'KGH', 'E-002', 'Employee', 'Active', 'Enabled', 'Yes', 'No', '2016-03-14', '', None),
    ('E-010', 'Aisha Mahmoud', 'Registered Nurse', 'Emergency Department', 'KGH', 'E-021', 'Employee', 'Active', 'Enabled', 'No', 'No', '2019-11-25', '', None),
    ('E-011', 'Ben Kowalski', 'Unit Clerk', 'Medicine 4A', 'KGH', 'E-022', 'Employee', 'Active', 'Enabled', 'No', 'No', '2023-01-09', '', None),
    ('E-012', "Dr. Liam O'Connor", 'Physician', 'Emergency Department', 'ARH', 'E-007', 'Employee', 'Active', 'Enabled', 'No', 'No', '2022-08-29', '', None),
    ('E-013', 'Mei Tanaka', 'Clinical Analyst', 'Clinical Analytics', 'CVH', 'E-006', 'Employee', 'Active', 'Enabled', 'No', 'Yes', '2024-04-15', '', None),
    ('E-014', 'Olivia Grant', 'Agency Nurse', 'Emergency Department', 'KGH', 'E-021', 'Agency', 'Active', 'Enabled', 'No', 'No', '2026-06-01', '2026-08-31', '2026-08-29 14:02'),
    ('E-015', 'Raj Patel', 'Vendor Support', 'Vendor: Meridian Clinical Systems', 'KGH', 'E-009', 'Vendor', 'Active', 'Enabled', 'Yes', 'No', '2025-02-03', '', '2026-09-26 21:40'),
    ('E-016', 'Chloe Dubois', 'Corporate Staff', 'Business Continuity', 'KGH', 'E-004', 'Employee', 'Active', 'Enabled', 'No', 'Yes', '2023-06-12', '', None),
    ('E-017', 'Ahmed Haddad', 'System Administrator', 'Infrastructure', 'KGH', 'E-002', 'Employee', 'Active', 'Enabled', 'Yes', 'Yes', '2019-02-18', '', None),
    ('E-018', 'Nora Lindqvist', 'Corporate Staff', 'Human Resources', 'KGH', 'E-026', 'Employee', 'Active', 'Enabled', 'No', 'Yes', '2021-09-07', '', None),
    ('E-019', 'Programme Manager', 'Corporate Staff', 'Project Beacon Programme Office', 'KGH', 'E-002', 'Employee', 'Active', 'Enabled', 'No', 'Yes', '2026-08-24', '', None),
    ('E-020', 'Sam Okafor', 'Security Analyst', 'Information Security', 'KGH', 'E-004', 'Employee', 'Active', 'Enabled', 'Yes', 'Yes', '2022-11-14', '', None),
    ('E-021', 'Hannah Brooks', 'Registered Nurse', 'Emergency Department', 'KGH', 'E-001', 'Employee', 'Active', 'Enabled', 'No', 'No', '2015-05-04', '', None),
    ('E-022', 'Marc Tremblay', 'Registered Nurse', 'Medicine 4A', 'KGH', 'E-001', 'Employee', 'Active', 'Enabled', 'No', 'No', '2018-01-15', '', None),
    ('E-023', 'Fatima Noorani', 'Registered Nurse', 'Nursing Administration', 'ARH', 'E-001', 'Employee', 'Active', 'Enabled', 'No', 'No', '2017-10-02', '', None),
    ('E-024', 'Gareth Lewis', 'Registered Nurse', 'Nursing Administration', 'CVH', 'E-001', 'Employee', 'Active', 'Enabled', 'No', 'No', '2016-04-11', '', None),
    ('E-025', 'Rosa Delgado', 'Registered Nurse', 'Nursing Administration', 'PGH', 'E-001', 'Employee', 'Active', 'Enabled', 'No', 'No', '2020-03-02', '', None),
    ('E-026', 'Owen MacLeod', 'Executive', 'Human Resources', 'KGH', '', 'Employee', 'Active', 'Enabled', 'No', 'Yes', '2019-08-19', '', None),
    ('E-027', 'Jason Kim', 'Registered Nurse', 'Emergency Department', 'KGH', 'E-021', 'Employee', 'Terminated', 'Enabled', 'No', 'No', '2021-03-29', '2026-08-14', '2026-08-13 19:20'),
    ('E-028', 'Chantal Roy', 'Unit Clerk', 'ARH Medicine', 'ARH', 'E-023', 'Employee', 'Active', 'Enabled', 'No', 'No', '2022-03-14', '', 'MOVER'),
    ('E-028', 'Chantal Roy', 'Clinical Analyst', 'Clinical Analytics', 'KGH', 'E-006', 'Employee', 'Active', 'Enabled', 'No', 'No', '2026-08-17', '', 'MOVER'),
    ('E-029', 'Dr. Ethan Wright', 'Physician', 'Emergency Department', 'CVH', 'E-007', 'Employee', 'Active', 'Enabled', 'No', 'No', '2023-07-04', '', None),
    ('E-030', 'Isabel Ferreira', 'Registered Nurse', 'CVH Medicine', 'CVH', 'E-024', 'Employee', 'Active', 'Enabled', 'No', 'No', '2022-05-30', '', None),
    ('E-031', 'Noah Bergstrom', 'Service Desk Analyst', 'IT Service Desk', 'KGH', 'E-005', 'Employee', 'Active', 'Enabled', 'Maybe', 'No', '2024-09-03', '', None),
    ('E-032', 'Zainab Yusuf', 'Service Desk Analyst', 'IT Service Desk', 'KGH', 'E-005', 'Employee', 'Active', 'Enabled', 'No', 'Yes', '2023-02-27', '', None),
    ('E-033', 'Lucas Girard', 'System Administrator', 'Infrastructure', 'KGH', 'E-002', 'Employee', 'Active', 'Enabled', 'Yes', 'Yes', '2020-07-13', '', None),
    ('E-034', 'Maya Singh', 'Registered Nurse', 'PGH Medicine', 'PGH', 'E-025', 'Employee', 'Active', 'Enabled', 'No', 'No', '2021-11-08', '', None),
    ('E-035', 'Connor Walsh', 'Agency Nurse', 'Emergency Department', 'CVH', 'E-024', 'Agency', 'Active', 'Enabled', 'No', 'No', '2026-07-06', '2026-12-31', None),
    ('E-036', 'Dr. Elena Petrova', 'Physician', 'Medicine', 'KGH', 'E-001', 'Employee', 'Active', 'Enabled', 'No', 'No', '2018-06-25', '', None),
    ('E-037', 'Tyler Bouchard', 'Unit Clerk', 'Surgery 5B', 'KGH', 'E-099', 'Employee', 'Active', 'Enabled', 'No', 'No', '2024-02-12', '', None),
    ('E-038', 'Julia Novak', 'Registered Nurse', 'ARH Surgery', 'ARH', 'E-023', 'Employee', 'Active', 'Enabled', 'No', 'No', '2019-09-16', '', None),
    ('E-039', 'Arjun Mehta', 'Vendor Support', 'Vendor: NorthArc Cloud', 'KGH', 'E-033', 'Vendor', 'Active', 'Enabled', 'Yes', 'Yes', '2026-01-05', '2026-12-31', None),
    ('E-040', 'Sienna Clarke', 'Registered Nurse', 'KGH ICU', 'KGH', 'E-022', 'Employee', 'Leave', 'Disabled', 'No', 'No', '2020-02-03', '', '2026-07-31 15:10'),
    ('E-041', 'Dr. Victor Leblanc', 'Physician', 'Emergency Department', 'PGH', 'E-007', 'Employee', 'Active', 'Enabled', 'No', 'No', '2021-04-19', '', None),
    ('E-042', 'Rebecca Stone', 'Registered Nurse', 'Emergency Department', 'KGH', 'E-021', 'Employee', 'Terminated', 'Disabled', 'No', 'No', '2017-03-06', '2026-06-30', '2026-06-30 16:45'),
]
IDENTITY_HEADER = ['employee_id', 'full_name', 'job_role', 'department', 'site_code', 'manager_id', 'worker_type',
                   'hr_status', 'account_status', 'privileged', 'mfa_enrolled', 'effective_from', 'effective_to',
                   'last_login']


def gen_identity():
    mover_login = fdt(datetime(2026, 9, 29, 10, 4))
    rows = []
    for p in IDENTITY:
        p = list(p)
        if p[13] == 'MOVER':
            p[13] = mover_login
        elif p[13] is None:
            p[13] = fdt(datetime(2026, 9, 21) + timedelta(days=rng.randrange(9), hours=rng.randint(6, 20), minutes=rng.randrange(60)))
        rows.append(p)
    INJECTED['identity'] = {'missed_leaver_terminated': 'E-027', 'agency_expired': 'E-014', 'mover_overlap': 'E-028',
                            'privileged_maybe': 'E-031', 'orphan_manager': ('E-037', 'E-099'),
                            'vendor_no_end': 'E-015'}
    write_csv('khn_identity.csv', IDENTITY_HEADER, rows)


# --------------------------------------------------------------------------- 8. permissions
ROLE_PERMS = {
    'Registered Nurse': [('A-001', 'view chart'), ('A-001', 'document care'), ('A-002', 'view tracking board'),
                         ('A-008', 'virtual desktop access'), ('A-013', 'email')],
    'Agency Nurse': [('A-001', 'view chart'), ('A-001', 'document care'), ('A-008', 'virtual desktop access')],
    'Physician': [('A-001', 'view chart'), ('A-001', 'document care'), ('A-001', 'order entry'),
                  ('A-002', 'view tracking board'), ('A-008', 'virtual desktop access'),
                  ('A-009', 'view site dashboards'), ('A-013', 'email')],
    'Unit Clerk': [('A-001', 'view chart'), ('A-006', 'update bed status'), ('A-008', 'virtual desktop access'),
                   ('A-013', 'email')],
    'Clinical Analyst': [('A-009', 'view site dashboards'), ('A-009', 'build'), ('A-010', 'query de-identified data'),
                         ('A-013', 'email')],
    'Executive': [('A-009', 'view all sites'), ('A-007', 'approve access'), ('A-013', 'email')],
    'System Administrator': [('A-007', 'provision accounts'), ('A-008', 'administer virtual desktops'),
                             ('A-013', 'email')],
    'Service Desk Analyst': [('A-011', 'manage tickets'), ('A-007', 'reset passwords'), ('A-013', 'email')],
    'Security Analyst': [('A-007', 'administer audit logs'), ('A-011', 'manage tickets'), ('A-013', 'email')],
    'Vendor Support': [('A-001', 'remote support'), ('A-012', 'remote support')],
    'Corporate Staff': [('A-013', 'email'), ('A-011', 'submit tickets')],
}
VENDOR_SYSTEM = {'E-015': 'A-001', 'E-039': 'A-012'}
EXCESS = [
    ('E-009', 'A-007', 'approve access', '2025-11-03', 'E-009'),
    ('E-009', 'A-007', 'administer audit logs', '2026-02-17', 'E-009'),
    ('E-013', 'A-009', 'view all sites', '2026-08-24', 'E-006'),
    ('E-014', 'A-001', 'order entry', '2026-06-15', 'E-009'),
    ('E-015', 'A-001', 'view chart', '2025-06-09', 'E-009'),
]
SOD_SET = ('provision accounts', 'approve access', 'administer audit logs')


def gen_permissions():
    rp = []
    for role, perms in ROLE_PERMS.items():
        for s, p in perms:
            rp.append([role, s, p])
    write_csv('khn_role_permissions.csv', ['job_role', 'system_id', 'permission'], rp)
    up, seen = [], set()
    for p in IDENTITY:
        emp, role, start, hr = p[0], p[2], datetime.strptime(p[11], D).date(), p[7]
        if emp == 'E-042':          # leaver correctly deprovisioned: no rows remain
            continue
        for s, perm in ROLE_PERMS[role]:
            if role == 'Vendor Support' and s != VENDOR_SYSTEM[emp]:
                continue
            if (emp, s, perm) in seen:
                continue
            seen.add((emp, s, perm))
            g = start + timedelta(days=rng.randint(1, 5))
            if s == 'A-009':
                g = max(g, date(2026, 8, 17) + timedelta(days=rng.randint(0, 10)))
            g = min(g, AS_OF - timedelta(days=1))
            by = 'E-009'
            if s == 'A-009':
                by = 'E-006'
            elif s in ('A-011', 'A-013'):
                by = 'E-032'
            if by == emp:               # nobody approves their own access (only the deliberate EXCESS rows do)
                by = {'E-006': 'E-008', 'E-032': 'E-005', 'E-009': 'E-002'}[emp]
            up.append([emp, s, perm, fd(g), by])
    for e in EXCESS:
        up.append(list(e))
    up.sort(key=lambda r: (r[0], r[1], r[2]))
    write_csv('khn_user_permissions.csv', ['employee_id', 'system_id', 'permission', 'granted_date', 'granted_by'], up)


# --------------------------------------------------------------------------- 9. access reviews
REVIEWS = [
    # review_id, employee, system, reviewer, assigned, due, completed, decision, exception
    ('AR-001', 'E-009', 'A-007', 'E-009', '2026-09-01', '2026-09-30', '2026-09-12', 'Keep', 'N'),
    ('AR-002', 'E-015', 'A-001', 'E-009', '2026-09-01', '2026-09-30', '', '', 'N'),
    ('AR-003', 'E-014', 'A-001', 'E-021', '2026-09-01', '2026-09-30', '2026-09-25', 'Remove', 'N'),
    ('AR-004', 'E-027', 'A-001', 'E-021', '2026-09-01', '2026-09-30', '', '', 'N'),
    ('AR-005', 'E-013', 'A-009', 'E-006', '2026-09-01', '2026-09-30', '2026-09-18', 'Modify', 'N'),
    ('AR-006', 'E-028', 'A-001', 'E-006', '2026-09-01', '2026-09-30', '2026-08-28', 'Keep', 'N'),
    ('AR-007', 'E-017', 'A-007', 'E-002', '2026-09-01', '2026-09-30', '2026-09-10', 'Keep', 'N'),
    ('AR-008', 'E-033', 'A-007', 'E-002', '2026-09-01', '2026-09-30', '2026-09-11', 'Keep', 'N'),
    ('AR-009', 'E-020', 'A-007', 'E-004', '2026-09-01', '2026-09-30', '2026-09-09', 'Keep', 'N'),
    ('AR-010', 'E-039', 'A-012', 'E-033', '2026-09-01', '2026-09-30', '2026-09-22', 'Keep', 'Y'),
    ('AR-011', 'E-010', 'A-001', 'E-021', '2026-09-01', '2026-09-30', '2026-09-16', 'Keep', 'N'),
    ('AR-012', 'E-011', 'A-006', 'E-022', '2026-09-01', '2026-09-30', '', '', 'N'),
    ('AR-013', 'E-012', 'A-001', 'E-007', '2026-09-01', '2026-09-30', '2026-09-29', 'Keep', 'N'),
    ('AR-014', 'E-029', 'A-001', 'E-007', '2026-09-01', '2026-09-30', '', '', 'N'),
    ('AR-015', 'E-036', 'A-001', 'E-001', '2026-09-01', '2026-09-30', '2026-09-30', 'Keep', 'N'),
    ('AR-016', 'E-031', 'A-007', 'E-005', '2026-09-01', '2026-09-30', '', '', 'N'),
    ('AR-017', 'E-032', 'A-007', 'E-005', '2026-09-01', '2026-09-30', '2026-09-19', 'Keep', 'N'),
    ('AR-018', 'E-045', 'A-001', 'E-023', '2026-09-01', '2026-09-30', '2026-09-24', 'Remove', 'N'),
    ('AR-019', 'E-035', 'A-001', 'E-024', '2026-09-15', '2026-10-15', '', '', 'N'),
    ('AR-020', 'E-030', 'A-001', 'E-024', '2026-09-15', '2026-10-15', '', '', 'N'),
    ('AR-021', 'E-034', 'A-001', 'E-025', '2026-09-15', '2026-10-15', '2026-09-28', 'Keep', 'N'),
    ('AR-022', 'E-041', 'A-001', 'E-007', '2026-09-15', '2026-10-15', '', '', 'N'),
    ('AR-023', 'E-038', 'A-001', 'E-023', '2026-09-15', '2026-10-15', '', '', 'N'),
    ('AR-024', 'E-037', 'A-006', 'E-022', '2026-09-15', '2026-10-15', '2026-09-30', 'Keep', 'N'),
]


def gen_reviews():
    INJECTED['reviews'] = {'orphan': 'AR-018', 'completed_before_assigned': 'AR-006', 'self_review': 'AR-001'}
    write_csv('khn_access_reviews.csv', ['review_id', 'employee_id', 'system_id', 'reviewer_id', 'assigned_date',
                                         'due_date', 'completed_date', 'decision', 'exception'], REVIEWS)


# --------------------------------------------------------------------------- 11. assets
ASSETS = [
    # asset_id, system_name, tier, owner, custodian, classification, hosting, vendor, depends_on, rto, rpo, end_of_support
    ('A-001', 'Clinical Information System (CIS)', 1, 'E-001', 'E-009', 'Restricted', 'On premises', 'V-01', 'A-007', 4, 1, '2029-03-31'),
    ('A-002', 'Emergency Department Tracking Board', 1, 'E-007', 'E-009', 'Restricted', 'On premises', 'V-01', 'A-001;A-007', 4, 1, '2029-03-31'),
    ('A-003', 'Laboratory Information System', 1, 'E-001', 'E-009', 'Restricted', 'On premises', '', 'A-007', 4, 1, '2028-09-30'),
    ('A-004', 'Picture Archiving and Communication System (PACS)', 2, 'E-001', 'E-017', 'Restricted', 'On premises', '', 'A-007', 24, 4, '2027-12-31'),
    ('A-005', 'Pharmacy System', 1, '', 'E-009', 'Restricted', 'On premises', '', 'A-001;A-007', 4, 1, '2028-06-30'),
    ('A-006', 'Bed Management System', 2, 'E-008', 'E-009', 'Restricted', 'On premises', '', 'A-001;A-007', 8, 4, '2028-03-31'),
    ('A-007', 'Identity Directory', 1, 'E-002', 'E-009', 'Confidential', 'On premises', '', '', 2, 1, '2030-01-31'),
    ('A-008', 'Virtual Desktop Service', 1, 'E-002', 'E-017', 'Internal', 'On premises', '', 'A-007', 4, 24, '2027-10-31'),
    ('A-009', 'Power BI service and Beacon semantic model', 3, 'E-008', 'E-006', 'Confidential', 'Vendor hosted', '', 'A-007;A-010', 72, 24, ''),
    ('A-010', 'Clinical Data Warehouse', 2, 'E-006', 'E-009', 'Restricted', 'On premises', '', 'A-001;A-002;A-006', 24, 24, '2029-06-30'),
    ('A-011', 'IT Service Management Platform', 2, 'E-005', 'E-009', 'Internal', 'NorthArc Cloud', 'V-02', 'A-007', 24, 4, '2028-12-31'),
    ('A-012', 'Backup Platform', 1, 'E-002', 'E-009', 'Restricted', 'NorthArc Cloud', 'V-02', 'A-007', 8, 24, '2030-06-30'),
    ('A-013', 'Email and Collaboration', 2, 'E-002', 'E-017', 'Confidential', 'NorthArc Cloud', 'V-02', 'A-007', 24, 4, '2029-12-31'),
    ('A-014', 'Clinical Paging and Secure Messaging', 1, 'E-001', 'E-017', 'Restricted', 'On premises', '', 'A-007', 2, 1, '2026-06-30'),
    ('A-015', 'HR and Payroll System', 3, 'E-018', 'E-009', 'Confidential', 'NorthArc Cloud', 'V-02', '', 72, 24, '2028-12-31'),
]


def gen_assets():
    INJECTED['assets'] = {'duplicate': 'A-008', 'missing_owner': 'A-005', 'end_of_support_passed': 'A-014'}
    out = []
    for a in ASSETS:
        out.append(list(a))
        if a[0] == 'A-008':
            out.append(list(a))
    write_csv('khn_assets.csv', ['asset_id', 'system_name', 'tier', 'business_owner_id', 'custodian_id',
                                 'classification', 'hosting', 'vendor_id', 'depends_on', 'rto_target_hours',
                                 'rpo_target_hours', 'end_of_support_date'], out)


# --------------------------------------------------------------------------- 10. security events
INCIDENTS = [
    # id, category, severity, asset, occurred, detected, opened, contained, recovered, status
    ('SEC-001', 'Phishing', 'High', 'A-013', '2026-07-06 08:50', '2026-07-06 09:32', '2026-07-06 09:45', '2026-07-06 11:20', '2026-07-07 09:15', 'Closed'),
    ('SEC-002', 'Malware', 'Medium', 'A-008', '2026-07-14 13:05', '2026-07-15 07:40', '2026-07-15 08:05', '2026-07-15 10:30', '2026-07-16 16:00', 'Closed'),
    ('SEC-003', 'Unauthorized access', 'High', 'A-001', '2026-07-29 22:10', '2026-08-02 10:15', '2026-08-02 10:40', '2026-08-02 13:00', '2026-08-05 12:00', 'Closed'),
    ('SEC-004', 'Ransomware precursor', 'Critical', 'A-008', '2026-08-11 02:20', '2026-08-11 03:05', '2026-08-11 03:20', '2026-08-11 05:45', '2026-08-13 18:30', 'Closed'),
    ('SEC-005', 'Lost device', 'Low', 'A-013', '2026-08-18 17:30', '2026-08-19 08:10', '2026-08-19 08:25', '2026-08-19 09:00', '2026-08-19 11:30', 'Closed'),
    ('SEC-006', 'Misconfiguration', 'Medium', 'A-009', '2026-08-25 10:00', '2026-08-28 14:20', '2026-08-28 14:40', '2026-08-28 15:10', '2026-08-29 10:00', 'Closed'),
    ('SEC-007', 'Phishing', 'Medium', 'A-013', '2026-09-03 07:55', '2026-09-03 08:20', '2026-09-03 08:10', '2026-09-03 09:40', '2026-09-03 15:30', 'Closed'),
    ('SEC-008', 'Malware', 'Medium', 'A-008', '2026-09-09 11:00', '2026-09-09 14:30', '2026-09-09 14:45', '2026-09-09 13:10', '2026-09-10 09:00', 'Closed'),
    ('SEC-009', 'Unauthorized access', 'High', 'A-007', '2026-09-17 01:15', '2026-09-18 09:05', '2026-09-18 09:20', '2026-09-18 12:40', '', 'Contained'),
    ('SEC-010', 'Phishing', 'Low', 'A-013', '2026-09-24 10:30', '2026-09-24 10:45', '2026-09-24 11:00', '2026-09-24 11:30', '2026-09-24 14:00', 'Closed'),
]
VULNS = [
    # id, category, severity (as recorded), asset, detected, opened, status, cvss
    ('SEC-011', 'Remote code execution', 'Critical', 'A-008', '2026-08-12 06:00', '2026-08-12 09:10', 'Remediated', '9.8'),
    ('SEC-012', 'Missing patch', 'High', 'A-001', '2026-08-26 06:00', '2026-08-26 10:20', 'Open', '8.1'),
    ('SEC-013', 'Weak cipher', 'Medium', 'A-013', '2026-09-02 06:00', '2026-09-02 11:00', 'Open', '5.9'),
    ('SEC-014', 'Excessive permission', 'High', 'A-007', '2026-09-15 06:00', '2026-09-15 13:30', 'Open', '7.5'),
    ('SEC-015', 'End-of-support software', 'High', 'A-014', '2026-07-20 06:00', '2026-07-20 09:45', 'Open', '8.6'),
    ('SEC-016', 'Missing patch', 'Medium', 'A-021', '2026-09-08 06:00', '2026-09-08 10:05', 'Open', '6.5'),
    ('SEC-017', 'Remote code execution', 'Critical', 'A-004', '2026-09-21 06:00', '2026-09-21 08:50', 'Open', '11.5'),
    ('SEC-018', 'Weak cipher', 'Low', 'A-011', '2026-09-22 06:00', '2026-09-22 14:15', 'Open', '3.7'),
    ('SEC-019', 'Missing patch', 'hIGH', 'A-005', '2026-08-05 06:00', '2026-08-05 09:30', 'Remediated', '7.8'),
    ('SEC-020', 'Excessive permission', 'Medium', 'A-010', '2026-09-29 06:00', '2026-09-29 11:40', 'Open', '5.4'),
]
SEC_HEADER = ['record_id', 'record_type', 'occurred_at', 'opened_at', 'detected_at', 'contained_at', 'recovered_at',
              'severity', 'category', 'asset_id', 'status', 'remediation_due', 'cvss_score']


def gen_security():
    rows = []
    for rid, cat, sev, asset, occ, det, opn, con, rec, status in INCIDENTS:
        rows.append([rid, 'Incident', occ, opn, det, con, rec, sev, cat, asset, status, '', ''])
        if rid == 'SEC-005':
            rows.append(list(rows[-1]))
    for rid, cat, sev, asset, det, opn, status, cvss in VULNS:
        due = datetime.strptime(det, DT).date() + timedelta(days=REMEDIATION_DAYS[sev.capitalize()])
        rows.append([rid, 'Vulnerability', '', opn, det, '', '', sev, cat, asset, status, fd(due), cvss])
    INJECTED['security'] = {'duplicate': 'SEC-005', 'impossible_sequence': 'SEC-008', 'cvss_out_of_range': 'SEC-017',
                            'orphan_asset': ('SEC-016', 'A-021'), 'odd_severity': 'SEC-019'}
    write_csv('khn_security_events.csv', SEC_HEADER, rows)


# --------------------------------------------------------------------------- 13. vendors
VENDORS = [
    ('V-01', 'Meridian Clinical Systems', 'CIS software and remote support', 'Canada', 'Yes', '2026-03-31', '2029-03-31', 'High'),
    ('V-02', 'NorthArc Cloud', 'Hosting and backup', 'Canada', 'Yes', '2026-05-15', '2028-06-30', 'High'),
    ('V-03', 'ClearPath Staffing', 'Agency nurses', 'Canada', 'No', '', '2027-03-31', 'Medium'),
    ('V-04', 'Sentinel SOC Services', 'Managed security monitoring', 'United States', 'Yes', '2025-11-30', '2027-12-31', 'High'),
    ('V-05', 'Lumen Analytics Partners', 'Power BI consulting for Release 1', 'Canada', 'Yes', '2025-06-30', '2026-11-30', 'Medium'),
]


def gen_vendors():
    write_csv('khn_vendors.csv', ['vendor_id', 'vendor_name', 'service', 'data_location', 'has_remote_access',
                                  'last_assurance_report', 'contract_end', 'risk_rating'], VENDORS)


# =========================================================================== truth from the files
def compute_ed():
    h, rows = read_rows('khn_ed_visits.csv')
    uniq, dups = dedup(rows)
    recs = [dict(zip(h, r)) for r in uniq]
    t = {'source_rows': len(rows), 'exact_duplicate_rows': len(dups), 'duplicate_ids': sorted(r[0] for r in dups),
         'unique_rows': len(recs)}
    ids = [r['visit_id'] for r in recs]
    t['duplicate_keys_after_dedup'] = len(ids) - len(set(ids))
    t['lowercase_site_ids'] = sorted(r['visit_id'] for r in recs if r['site_code'] != r['site_code'].strip().upper())
    q = {'invalid_date': [], 'ctas_out_of_range': [], 'lwbs_with_pia': [], 'other': []}
    ctas_raw = {}
    loaded = []
    for r in recs:
        r['site_code'] = r['site_code'].strip().upper()
        ts = {k: pdt(r[k]) for k in ED_TS}
        if any(v == INVALID for v in ts.values()):
            q['invalid_date'].append(r['visit_id'])
            continue
        if r['ctas_level'] not in ('1', '2', '3', '4', '5'):
            q['ctas_out_of_range'].append(r['visit_id'])
            ctas_raw[r['visit_id']] = r['ctas_level']
            continue
        if r['disposition'] == 'LWBS' and ts['pia_datetime'] is not None:
            q['lwbs_with_pia'].append(r['visit_id'])
            continue
        if r['site_code'] not in SITE_CODES or r['disposition'] not in DISPOSITIONS or ts['arrival_datetime'] is None:
            q['other'].append(r['visit_id'])
            continue
        r.update(ts)
        r['ctas'] = int(r['ctas_level'])
        loaded.append(r)
    t['quarantined'] = {k: sorted(v) for k, v in q.items()}
    t['quarantined_count'] = sum(len(v) for v in q.values())
    t['ctas_raw_values'] = ctas_raw
    timing_bad, timing_detail, missing_dep = [], {}, []
    for r in loaded:
        a, tr, p, dp = r['arrival_datetime'], r['triage_datetime'], r['pia_datetime'], r['departure_datetime']
        ok = tr is not None and tr >= a
        if p is not None and (tr is None or p < tr or p < a):
            ok = False
            timing_detail[r['visit_id']] = 'PIA before arrival' if p < a else 'PIA before triage'
        if dp is not None and (dp < a or (tr is not None and dp < tr) or (p is not None and dp < p)):
            ok = False
            timing_detail.setdefault(r['visit_id'], 'departure before an earlier step')
        if not ok:
            timing_bad.append(r['visit_id'])
        if dp is None and r['disposition'] != 'LWBS':
            missing_dep.append(r['visit_id'])
        r['min_to_pia'] = minutes_between(a, p) if (ok and p is not None) else None
        r['los_min'] = minutes_between(a, dp) if (ok and dp is not None) else None
    t['timing_invalid_ids'] = sorted(timing_bad)
    t['timing_invalid_detail'] = timing_detail
    t['missing_departure_ids'] = sorted(missing_dep)
    t['valid_visits'] = len(loaded)
    t['visits_by_site'] = {s: sum(1 for r in loaded if r['site_code'] == s) for s in SITE_CODES}
    t['visits_by_ctas'] = {str(c): sum(1 for r in loaded if r['ctas'] == c) for c in range(1, 6)}
    t['visits_by_disposition'] = {d: sum(1 for r in loaded if r['disposition'] == d) for d in DISPOSITIONS}
    t['ambulance_arrivals'] = sum(1 for r in loaded if r['arrival_mode'] == 'Ambulance')
    t['lwbs_count'] = t['visits_by_disposition']['LWBS']
    t['lwbs_rate_pct'] = pct(t['lwbs_count'], len(loaded))
    t['lwbs_rate_pct_by_site'] = {s: pct(sum(1 for r in loaded if r['site_code'] == s and r['disposition'] == 'LWBS'),
                                         t['visits_by_site'][s]) for s in SITE_CODES}
    pia = [r for r in loaded if r['min_to_pia'] is not None]
    t['pia_n'] = len(pia)
    t['median_min_to_pia'] = med1([r['min_to_pia'] for r in pia])
    t['median_min_to_pia_by_site'] = {s: med1([r['min_to_pia'] for r in pia if r['site_code'] == s]) for s in SITE_CODES}
    t['pia_n_by_site'] = {s: sum(1 for r in pia if r['site_code'] == s) for s in SITE_CODES}
    t['median_min_to_pia_by_ctas'] = {str(c): med1([r['min_to_pia'] for r in pia if r['ctas'] == c]) for c in range(1, 6)}
    t['pia_n_by_ctas'] = {str(c): sum(1 for r in pia if r['ctas'] == c) for c in range(1, 6)}
    within = [r for r in pia if r['min_to_pia'] <= CTAS_TARGET[r['ctas']]]
    t['pia_within_target_count'] = len(within)
    t['pct_pia_within_target'] = pct(len(within), len(pia))
    t['pia_within_target_by_ctas'] = {str(c): sum(1 for r in within if r['ctas'] == c) for c in range(1, 6)}
    t['pct_pia_within_target_by_ctas'] = {str(c): pct(t['pia_within_target_by_ctas'][str(c)], t['pia_n_by_ctas'][str(c)])
                                          for c in range(1, 6)}
    t['pct_pia_within_target_by_site'] = {s: pct(sum(1 for r in within if r['site_code'] == s), t['pia_n_by_site'][s])
                                          for s in SITE_CODES}
    los = [r for r in loaded if r['los_min'] is not None]
    t['los_n'] = len(los)

    def mlos(rs):
        return round(statistics.median([r['los_min'] for r in rs]) / 60.0, 2) if rs else None
    t['median_los_hours_all'] = mlos(los)
    for d in DISPOSITIONS:
        sub = [r for r in los if r['disposition'] == d]
        t[f'median_los_hours_{d.lower()}'] = mlos(sub)
        t[f'los_n_{d.lower()}'] = len(sub)
    t['median_los_hours_admitted_by_site'] = {s: mlos([r for r in los if r['disposition'] == 'Admitted' and r['site_code'] == s])
                                              for s in SITE_CODES}
    t['median_los_hours_discharged_by_site'] = {s: mlos([r for r in los if r['disposition'] == 'Discharged' and r['site_code'] == s])
                                                for s in SITE_CODES}
    t['visits_by_arrival_date_min'] = fd(min(r['arrival_datetime'] for r in loaded).date())
    t['visits_by_arrival_date_max'] = fd(max(r['arrival_datetime'] for r in loaded).date())
    t['evening_share_pct'] = pct(sum(1 for r in loaded if 17 <= r['arrival_datetime'].hour <= 23), len(loaded))
    return t


def compute_beds():
    h, rows = read_rows('khn_bed_census.csv')
    uniq, dups = dedup(rows)
    recs = [dict(zip(h, r)) for r in uniq]
    t = {'source_rows': len(rows), 'exact_duplicate_rows': len(dups),
         'duplicate_keys': sorted(f'{r[1]} {r[0]}' for r in dups), 'loaded_rows': len(recs)}
    keys = [(r['unit_id'], r['census_date']) for r in recs]
    t['duplicate_keys_after_dedup'] = len(keys) - len(set(keys))
    expected = {(u, fd(PERIOD_START + timedelta(days=i))) for u in UNIT_IDS for i in range(PERIOD_DAYS)}
    t['expected_unit_days'] = len(expected)
    t['missing_unit_days'] = sorted(f'{u} {d}' for u, d in expected - set(keys))
    t['unexpected_unit_days'] = sorted(f'{u} {d}' for u, d in set(keys) - expected)
    over, neg = [], []
    for r in recs:
        r['staffed'] = int(r['staffed_beds'])
        r['occ'] = int(r['occupied_beds'])
        a = int(r['alc_patients'])
        if a < 0:
            neg.append(f"{r['unit_id']} {r['census_date']} ({a})")
            a = None
        r['alc'] = a
        r['site'] = UNIT_SITE[r['unit_id']]
        if r['occ'] > r['staffed']:
            over.append(f"{r['unit_id']} {r['census_date']} ({r['occ']} occupied, {r['staffed']} staffed)")
    t['overcapacity_rows'] = over
    t['negative_alc_rows'] = neg

    def avg_daily(units):
        by_date = {}
        for r in recs:
            if r['unit_id'] in units:
                s = by_date.setdefault(r['census_date'], [0, 0])
                s[0] += r['occ']
                s[1] += r['staffed']
        ratios = [o / s for o, s in by_date.values() if s > 0]
        return round(100.0 * sum(ratios) / len(ratios), 1)

    def snapshot(units, day):
        o = sum(r['occ'] for r in recs if r['unit_id'] in units and r['census_date'] == day)
        s = sum(r['staffed'] for r in recs if r['unit_id'] in units and r['census_date'] == day)
        return round(100.0 * o / s, 1), o, s

    site_units = {s: [u for u in UNIT_IDS if UNIT_SITE[u] == s] for s in SITE_CODES}
    t['avg_daily_occupancy_pct'] = avg_daily(UNIT_IDS)
    t['avg_daily_occupancy_pct_by_site'] = {s: avg_daily(site_units[s]) for s in SITE_CODES}
    t['avg_daily_occupancy_pct_by_unit'] = {u: avg_daily([u]) for u in UNIT_IDS}
    last = max(r['census_date'] for r in recs)
    t['last_census_date'] = last
    sp = snapshot(UNIT_IDS, last)
    t['last_snapshot_occupancy_pct'] = sp[0]
    t['last_snapshot_occupied_beds'] = sp[1]
    t['last_snapshot_staffed_beds'] = sp[2]
    t['last_snapshot_occupancy_pct_by_site'] = {s: snapshot(site_units[s], last)[0] for s in SITE_CODES}
    t['last_snapshot_staffed_beds_by_site'] = {s: snapshot(site_units[s], last)[2] for s in SITE_CODES}
    t['alc_patient_days'] = sum(r['alc'] for r in recs if r['alc'] is not None)
    t['alc_patient_days_by_site'] = {s: sum(r['alc'] for r in recs if r['alc'] is not None and r['site'] == s)
                                     for s in SITE_CODES}
    occ_valid = sum(r['occ'] for r in recs if r['alc'] is not None)
    t['alc_share_of_occupied_bed_days_pct'] = pct(t['alc_patient_days'], occ_valid)
    t['sum_staffed_beds_all_rows'] = sum(r['staffed'] for r in recs)
    t['sum_occupied_beds_all_rows'] = sum(r['occ'] for r in recs)
    t['ratio_of_sums_occupancy_pct'] = pct(t['sum_occupied_beds_all_rows'], t['sum_staffed_beds_all_rows'])
    return t


STATUS_MAP = {'not started': 'Not started', 'in progress': 'In progress', 'complete': 'Complete', 'on hold': 'On hold'}
RISK_MAP = {'low': 'Low', 'medium': 'Medium', 'high': 'High'}


def compute_register():
    h, rows = read_rows('khn_programme_register.csv')
    uniq, dups = dedup(rows)
    recs = [dict(zip(h, r)) for r in uniq]
    t = {'source_rows': len(rows), 'exact_duplicate_rows': len(dups), 'duplicate_ids': sorted(r[0] for r in dups),
         'unique_rows': len(recs)}
    t['bac_sum_as_loaded_no_cleaning'] = int(sum(float(r[h.index('budget_cad')]) for r in rows))
    t['bac_sum_after_dedup_before_sign_fix'] = int(sum(float(r['budget_cad']) for r in recs))
    casing, missing_owner, bad_dates, negative, over100 = [], [], [], [], []
    pv = ev = ac = 0.0
    bac = 0.0
    by_rel = {}
    status_counts = {}
    for r in recs:
        st = STATUS_MAP.get(r['status'].strip().lower())
        rk = RISK_MAP.get(r['risk_rating'].strip().lower())
        if st != r['status']:
            casing.append(f"{r['wp_id']} status '{r['status']}' to '{st}'")
        if rk != r['risk_rating']:
            casing.append(f"{r['wp_id']} risk_rating '{r['risk_rating']}' to '{rk}'")
        status_counts[st] = status_counts.get(st, 0) + 1
        if not r['owner_id'].strip():
            missing_owner.append(r['wp_id'])
        for f in ('planned_start', 'planned_finish'):
            if pdate(r[f]) == INVALID:
                bad_dates.append(f"{r['wp_id']} {f} '{r[f]}'")
        b = float(r['budget_cad'])
        if b < 0:
            negative.append(f"{r['wp_id']} {int(b)}")
            b = abs(b)
        pc = float(r['pct_complete'])
        if pc > 100:
            over100.append(f"{r['wp_id']} {int(pc)} (status {st})")
            pc = 100.0 if st == 'Complete' else None
        bac += b
        rel = r['release']
        by_rel.setdefault(rel, {'bac': 0.0, 'pv': 0.0, 'ev': 0.0, 'ac': 0.0})
        by_rel[rel]['bac'] += b
        p_v = b * float(r['planned_pct_as_of']) / 100.0
        e_v = b * (pc or 0.0) / 100.0
        a_c = float(r['actual_cost_cad'])
        by_rel[rel]['pv'] += p_v
        by_rel[rel]['ev'] += e_v
        by_rel[rel]['ac'] += a_c
        pv += p_v
        ev += e_v
        ac += a_c
    t.update(casing_fixes=casing, missing_owner_ids=missing_owner, invalid_dates=bad_dates,
             negative_budgets=negative, pct_over_100=over100, status_counts=status_counts)
    t['bac_approved_cad'] = int(round(bac))
    t['bac_by_release_cad'] = {k: int(round(v['bac'])) for k, v in sorted(by_rel.items())}
    t['management_reserve_cad'] = MANAGEMENT_RESERVE_CAD
    t['total_budget_with_reserve_cad'] = t['bac_approved_cad'] + MANAGEMENT_RESERVE_CAD
    t['pv_cad'] = int(round(pv))
    t['ev_cad'] = int(round(ev))
    t['ac_cad'] = int(round(ac))
    t['cv_cad'] = t['ev_cad'] - t['ac_cad']
    t['sv_cad'] = t['ev_cad'] - t['pv_cad']
    t['cpi'] = round(ev / ac, 2)
    t['spi'] = round(ev / pv, 2)
    t['eac_cad'] = int(round(bac / (ev / ac)))
    t['vac_cad'] = t['bac_approved_cad'] - t['eac_cad']
    t['pct_spent_of_bac'] = pct(ac, bac)
    t['pct_complete_of_bac'] = pct(ev, bac)
    r1 = by_rel['1']
    t['release1_pv_cad'] = int(round(r1['pv']))
    t['release1_ev_cad'] = int(round(r1['ev']))
    t['release1_ac_cad'] = int(round(r1['ac']))
    t['release1_cpi'] = round(r1['ev'] / r1['ac'], 2)
    t['release1_spi'] = round(r1['ev'] / r1['pv'], 2)
    return t


def compute_schedule():
    h, rows = read_rows('khn_schedule.csv')
    recs = [dict(zip(h, r)) for r in rows]
    summary = [r for r in recs if r['Start']]
    assert len(summary) == 1
    s = summary[0]
    start = pdate(s['Start'])
    assert start == CAL[0]
    tasks = {}
    for r in recs:
        if r is s:
            continue
        preds = [int(x) for x in r['Predecessors'].split(',') if x.strip()]
        tasks[int(r['ID'])] = {'dur': int(re.fullmatch(r'(\d+)d', r['Duration']).group(1)), 'preds': preds,
                               'name': r['Name'], 'milestone': r['Milestone']}
    ES, EF, LS, LF, TF, FF, finish = cpm(tasks)
    t = {'rows': len(recs), 'tasks_excluding_summary': len(tasks),
         'milestones': sorted(k for k, v in tasks.items() if v['dur'] == 0),
         'summary_duration_in_file': s['Duration'], 'summary_duration_computed': f'{finish}d',
         'programme_start': fd(start), 'programme_finish': fd(show_finish(finish)),
         'working_days': finish}
    t['milestone_flags_consistent'] = all((v['milestone'] == 'Yes') == (v['dur'] == 0) for v in tasks.values())
    table = {}
    for k in sorted(tasks):
        d = tasks[k]['dur']
        table[str(k)] = {'name': tasks[k]['name'], 'duration_days': d,
                         'early_start': fd(show_start(ES[k], EF[k], d)), 'early_finish': fd(show_finish(EF[k])),
                         'late_start': fd(show_start(LS[k], LF[k], d)), 'late_finish': fd(show_finish(LF[k])),
                         'total_float_days': TF[k], 'free_float_days': FF[k]}
    t['tasks'] = table
    t['critical_path_ids'] = [k for k in sorted(tasks) if TF[k] == 0]
    t['critical_path'] = ' > '.join(str(k) for k in t['critical_path_ids'])
    t['non_critical_float'] = {str(k): TF[k] for k in sorted(tasks) if TF[k] > 0}
    t['gate_release1'] = table['12']['early_finish']
    t['gate_release2'] = table['20']['early_finish']
    t['gate_programme'] = table['28']['early_finish']
    t['max_total_float_days'] = max(TF.values())
    return t


def compute_desk():
    h, rows = read_rows('khn_service_desk.csv')
    uniq, dups = dedup(rows)
    recs = [dict(zip(h, r)) for r in uniq]
    t = {'source_rows': len(rows), 'exact_duplicate_rows': len(dups), 'duplicate_ids': sorted(r[0] for r in dups),
         'unique_tickets': len(recs)}
    ids = [r['ticket_id'] for r in recs]
    t['duplicate_keys_after_dedup'] = len(ids) - len(set(ids))
    seq_bad, missing_pr, contra, target_mismatch, open_ids = [], [], [], [], []
    for r in recs:
        o, rs = pdt(r['opened_at']), pdt(r['resolved_at'])
        assert o not in (None, INVALID) and rs != INVALID
        bad = rs is not None and rs < o
        if bad:
            seq_bad.append(r['ticket_id'])
        target = SLA_HOURS.get(r['priority'])
        if r['priority'] == '':
            missing_pr.append(r['ticket_id'])
        if target is not None and r['sla_target_hours'] != str(target):
            target_mismatch.append(r['ticket_id'])
        if rs is None:
            open_ids.append(r['ticket_id'])
        if target is None or bad:
            sla = ''
        elif rs is not None:
            sla = 'Y' if hours_between(o, rs) <= target else 'N'
        else:
            sla = 'N' if hours_between(o, AS_OF_DT) > target else ''
        if target is not None and not bad and r['sla_met'] != sla:
            contra.append(f"{r['ticket_id']} file '{r['sla_met']}' recomputed '{sla}'")
        r['sla'] = sla
        r['res_hours'] = hours_between(o, rs) if (rs is not None and not bad) else None
    t.update(resolved_before_opened_ids=seq_bad, missing_priority_ids=missing_pr, sla_flag_corrections=contra,
             sla_target_mismatches=target_mismatch)
    types = ['Incident', 'Service request', 'Access request']
    t['tickets_by_type'] = {k: sum(1 for r in recs if r['ticket_type'] == k) for k in types}
    t['tickets_by_priority'] = {k: sum(1 for r in recs if r['priority'] == k) for k in ['P1', 'P2', 'P3', 'P4', '']}
    t['tickets_by_site'] = {s: sum(1 for r in recs if r['site_code'] == s) for s in SITE_CODES}
    t['open_at_extract'] = len(open_ids)
    t['open_at_extract_ids'] = open_ids
    sla_rows = [r for r in recs if r['sla'] in ('Y', 'N')]
    t['sla_evaluated'] = len(sla_rows)
    t['sla_met_count'] = sum(1 for r in sla_rows if r['sla'] == 'Y')
    t['sla_pending'] = sum(1 for r in recs if r['sla'] == '' and r['priority'] and r['ticket_id'] not in seq_bad)
    t['sla_met_pct'] = pct(t['sla_met_count'], len(sla_rows))
    t['sla_met_pct_by_type'] = {k: pct(sum(1 for r in sla_rows if r['ticket_type'] == k and r['sla'] == 'Y'),
                                       sum(1 for r in sla_rows if r['ticket_type'] == k)) for k in types}
    t['sla_met_pct_by_priority'] = {k: pct(sum(1 for r in sla_rows if r['priority'] == k and r['sla'] == 'Y'),
                                           sum(1 for r in sla_rows if r['priority'] == k)) for k in ['P1', 'P2', 'P3', 'P4']}
    ar = [r['res_hours'] for r in recs if r['ticket_type'] == 'Access request' and r['res_hours'] is not None]
    t['access_requests_resolved_n'] = len(ar)
    t['median_access_request_days'] = round(statistics.median(ar) / 24.0, 2)
    t['access_requests_within_3_days_pct'] = pct(sum(1 for x in ar if x <= 72), len(ar))
    t['median_resolution_hours_by_type'] = {k: round(statistics.median([r['res_hours'] for r in recs if r['ticket_type'] == k
                                                                         and r['res_hours'] is not None]), 1) for k in types}
    t['reopened_pct'] = pct(sum(1 for r in recs if r['reopened'] == 'Y'), len(recs))
    cs = [int(r['csat']) for r in recs if r['csat']]
    t['csat_responses'] = len(cs)
    t['csat_average'] = round(sum(cs) / len(cs), 2)
    return t


def compute_identity():
    h, rows = read_rows('khn_identity.csv')
    recs = [dict(zip(h, r)) for r in rows]
    t = {'source_rows': len(rows)}
    by = {}
    for r in recs:
        by.setdefault(r['employee_id'], []).append(r)
    t['distinct_employees'] = len(by)
    latest = {e: max(rs, key=lambda r: r['effective_from']) for e, rs in by.items()}
    overlaps = []
    for e, rs in by.items():
        for i in range(len(rs)):
            for j in range(i + 1, len(rs)):
                a, b = rs[i], rs[j]
                a_to = a['effective_to'] or '9999-12-31'
                b_to = b['effective_to'] or '9999-12-31'
                if a['effective_from'] <= b_to and b['effective_from'] <= a_to:
                    overlaps.append(e)
    t['overlapping_assignment_ids'] = sorted(set(overlaps))
    old_rows = [r for e in t['overlapping_assignment_ids'] for r in by[e] if r is not latest[e]]
    t['mover_old_row_close_date'] = {e: fd(pdate(latest[e]['effective_from']) - timedelta(days=1))
                                     for e in t['overlapping_assignment_ids']}
    t['mover_old_role'] = {r['employee_id']: r['job_role'] for r in old_rows}
    cur = list(latest.values())
    enabled = [r for r in cur if r['account_status'] == 'Enabled']
    t['enabled_accounts'] = len(enabled)
    t['disabled_accounts'] = len(cur) - len(enabled)
    missed = [r['employee_id'] for r in enabled if r['hr_status'] == 'Terminated'
              or (r['effective_to'] and pdate(r['effective_to']) < AS_OF)]
    t['missed_leaver_ids'] = sorted(missed)
    t['missed_leavers'] = len(missed)
    t['privileged_value_invalid'] = sorted(f"{r['employee_id']} '{r['privileged']}'" for r in recs
                                           if r['privileged'] not in ('Yes', 'No'))
    priv = [r for r in enabled if r['privileged'] == 'Yes']
    t['privileged_enabled'] = len(priv)
    t['privileged_enabled_ids'] = sorted(r['employee_id'] for r in priv)
    gap = [r['employee_id'] for r in priv if r['mfa_enrolled'] != 'Yes']
    t['privileged_without_mfa_ids'] = sorted(gap)
    t['privileged_without_mfa'] = len(gap)
    t['privileged_mfa_pct'] = pct(len(priv) - len(gap), len(priv))
    t['enabled_without_mfa'] = sum(1 for r in enabled if r['mfa_enrolled'] != 'Yes')
    t['enabled_mfa_pct'] = pct(sum(1 for r in enabled if r['mfa_enrolled'] == 'Yes'), len(enabled))
    ids = set(by)
    t['orphan_manager_rows'] = sorted(f"{r['employee_id']} -> {r['manager_id']}" for r in recs
                                      if r['manager_id'] and r['manager_id'] not in ids)
    t['agency_vendor_without_end_ids'] = sorted(r['employee_id'] for r in cur if r['worker_type'] in ('Agency', 'Vendor')
                                                and not r['effective_to'])
    t['workers_by_type'] = {k: sum(1 for r in cur if r['worker_type'] == k) for k in ('Employee', 'Agency', 'Vendor')}
    t['roles_in_use'] = sorted({r['job_role'] for r in recs})
    return t, latest


def compute_permissions(latest):
    h, rows = read_rows('khn_role_permissions.csv')
    role = {}
    for r in rows:
        role.setdefault(r[0], set()).add((r[1], r[2]))
    h2, rows2 = read_rows('khn_user_permissions.csv')
    recs = [dict(zip(h2, r)) for r in rows2]
    t = {'role_permission_rows': len(rows), 'roles': len(role), 'user_permission_rows': len(recs)}
    excess = []
    held = {}
    for r in recs:
        e = r['employee_id']
        held.setdefault(e, set()).add((r['system_id'], r['permission']))
        cur_role = latest[e]['job_role'] if e in latest else None
        if cur_role is None or (r['system_id'], r['permission']) not in role[cur_role]:
            excess.append(f"{e} {r['system_id']} {r['permission']}")
    t['excess_grants'] = excess
    t['excess_grant_count'] = len(excess)
    sod = []
    for e, ps in sorted(held.items()):
        s = sorted(p for sys_, p in ps if sys_ == 'A-007' and p in SOD_SET)
        if len(s) >= 2:
            sod.append(f"{e}: {', '.join(s)}")
    t['sod_conflicts'] = sod
    t['sod_conflict_count'] = len(sod)
    t['self_granted'] = sorted(f"{r['employee_id']} {r['system_id']} {r['permission']}" for r in recs
                               if r['granted_by'] == r['employee_id'])
    t['granted_by_e009_pct'] = pct(sum(1 for r in recs if r['granted_by'] == 'E-009'), len(recs))
    return t


def compute_reviews(latest):
    h, rows = read_rows('khn_access_reviews.csv')
    recs = [dict(zip(h, r)) for r in rows]
    t = {'rows': len(recs)}
    orphan = [r['review_id'] for r in recs if r['employee_id'] not in latest]
    before = [r['review_id'] for r in recs if r['completed_date'] and r['completed_date'] < r['assigned_date']]
    valid_done = [r for r in recs if r['completed_date'] and r['completed_date'] >= r['assigned_date'] and r['decision']]
    due_by = [r for r in recs if pdate(r['due_date']) < AS_OF]
    done_ids = {r['review_id'] for r in valid_done}
    overdue = [r['review_id'] for r in due_by if r['review_id'] not in done_ids]
    self_rev = [r['review_id'] for r in recs if r['reviewer_id'] == r['employee_id']]
    not_actioned = [f"{r['review_id']} ({r['employee_id']})" for r in recs if r['decision'] == 'Remove'
                    and r['employee_id'] in latest and latest[r['employee_id']]['account_status'] == 'Enabled']
    t.update(orphan_employee_review_ids=orphan, completed_before_assigned_ids=before,
             completed_valid=len(valid_done), completion_pct_all=pct(len(valid_done), len(recs)),
             due_by_as_of=len(due_by), completed_valid_of_due=sum(1 for r in due_by if r['review_id'] in done_ids),
             overdue_ids=overdue, overdue=len(overdue), self_review_ids=self_rev,
             remove_not_actioned=not_actioned,
             not_yet_due=len(recs) - len(due_by),
             decisions={k: sum(1 for r in valid_done if r['decision'] == k) for k in ('Keep', 'Modify', 'Remove')},
             exceptions=sum(1 for r in recs if r['exception'] == 'Y'))
    t['completion_pct_of_due'] = pct(t['completed_valid_of_due'], len(due_by))
    return t


SEV_CANON = {'critical': 'Critical', 'high': 'High', 'medium': 'Medium', 'low': 'Low'}


def compute_security(asset_ids):
    h, rows = read_rows('khn_security_events.csv')
    uniq, dups = dedup(rows)
    recs = [dict(zip(h, r)) for r in uniq]
    t = {'source_rows': len(rows), 'exact_duplicate_rows': len(dups), 'duplicate_ids': sorted(r[0] for r in dups),
         'unique_records': len(recs)}
    inc = [r for r in recs if r['record_type'] == 'Incident']
    vul = [r for r in recs if r['record_type'] == 'Vulnerability']
    t['unique_incidents'] = len(inc)
    t['unique_vulnerabilities'] = len(vul)
    t['severity_casing_fixes'] = sorted(f"{r['record_id']} '{r['severity']}' to '{SEV_CANON[r['severity'].lower()]}'"
                                        for r in recs if r['severity'] != SEV_CANON.get(r['severity'].lower()))
    t['orphan_asset_rows'] = sorted(f"{r['record_id']} {r['asset_id']}" for r in recs if r['asset_id'] not in asset_ids)
    bad_seq, opened_before_detected = [], []
    mttd, mttc, mttr = [], [], []
    for r in inc:
        o, d, c, v, op = (pdt(r['occurred_at']), pdt(r['detected_at']), pdt(r['contained_at']),
                          pdt(r['recovered_at']), pdt(r['opened_at']))
        seq = [x for x in (o, d, c, v) if x is not None]
        ok = all(seq[i] <= seq[i + 1] for i in range(len(seq) - 1)) and op is not None and op >= o
        if op is not None and d is not None and op < d:
            opened_before_detected.append(r['record_id'])
        if not ok:
            bad_seq.append(r['record_id'])
            continue
        if o and d:
            mttd.append(hours_between(o, d))
        if d and c:
            mttc.append(hours_between(d, c))
        if d and v:
            mttr.append(hours_between(d, v))
    t['impossible_sequence_ids'] = bad_seq
    t['opened_before_detected_ids'] = opened_before_detected
    t['valid_incidents_for_timing'] = len(inc) - len(bad_seq)
    t['mttd_hours'] = round(sum(mttd) / len(mttd), 2)
    t['mttd_n'] = len(mttd)
    t['mttc_hours'] = round(sum(mttc) / len(mttc), 2)
    t['mttc_n'] = len(mttc)
    t['mttr_hours'] = round(sum(mttr) / len(mttr), 2)
    t['mttr_n'] = len(mttr)
    t['incidents_not_recovered_ids'] = sorted(r['record_id'] for r in inc if not r['recovered_at'])
    t['incidents_by_severity'] = {k: sum(1 for r in inc if SEV_CANON[r['severity'].lower()] == k)
                                  for k in ('Critical', 'High', 'Medium', 'Low')}
    bad_cvss = []
    for r in vul:
        try:
            s = float(r['cvss_score'])
            if not 0.0 <= s <= 10.0:
                bad_cvss.append(f"{r['record_id']} {r['cvss_score']}")
        except ValueError:
            bad_cvss.append(f"{r['record_id']} '{r['cvss_score']}'")
    t['cvss_out_of_range'] = bad_cvss
    t['valid_vulnerabilities'] = len(vul) - len(bad_cvss)
    open_v = [r for r in vul if r['status'] == 'Open']
    t['open_vulnerabilities'] = len(open_v)
    t['overdue_vulnerability_ids'] = sorted(r['record_id'] for r in open_v if pdate(r['remediation_due']) < AS_OF)
    t['overdue_vulnerabilities'] = len(t['overdue_vulnerability_ids'])
    t['vulnerabilities_by_severity'] = {k: sum(1 for r in vul if SEV_CANON[r['severity'].lower()] == k)
                                        for k in ('Critical', 'High', 'Medium', 'Low')}
    return t


def compute_assets(identity_ids):
    h, rows = read_rows('khn_assets.csv')
    uniq, dups = dedup(rows)
    recs = [dict(zip(h, r)) for r in uniq]
    t = {'source_rows': len(rows), 'exact_duplicate_rows': len(dups), 'duplicate_ids': sorted(r[0] for r in dups),
         'unique_assets': len(recs)}
    t['missing_owner_ids'] = sorted(r['asset_id'] for r in recs if not r['business_owner_id'])
    t['end_of_support_passed'] = sorted(f"{r['asset_id']} {r['end_of_support_date']}" for r in recs
                                        if r['end_of_support_date'] and pdate(r['end_of_support_date']) < AS_OF)
    t['tier_counts'] = {k: sum(1 for r in recs if r['tier'] == k) for k in ('1', '2', '3')}
    t['owner_or_custodian_not_in_identity'] = sorted(f"{r['asset_id']} {x}" for r in recs
                                                     for x in (r['business_owner_id'], r['custodian_id'])
                                                     if x and x not in identity_ids)
    ids = {r['asset_id'] for r in recs}
    t['dependency_orphans'] = sorted(f"{r['asset_id']} {d}" for r in recs for d in r['depends_on'].split(';')
                                     if d and d not in ids)
    t['rto_by_asset'] = {r['asset_id']: float(r['rto_target_hours']) for r in recs}
    return t, ids


def compute_controls():
    h, rows = read_rows('khn_controls.csv')
    recs = [dict(zip(h, r)) for r in rows]
    t = {'rows': len(recs)}
    restore = [r for r in recs if r['backup_job_id']]
    res = []
    inconsistent = []
    for r in restore:
        if r['restore_hours']:
            ok = float(r['restore_hours']) <= float(r['rto_target_hours'])
            status = 'Pass' if ok else 'Fail'
        else:
            status = 'Not tested'
        if status != r['status']:
            inconsistent.append(r['control_test_id'])
        res.append(f"{r['control_test_id']} {r['asset_id']} {status}"
                   + (f" ({r['restore_hours']} h against {r['rto_target_hours']} h)" if r['restore_hours'] else ''))
    t['restore_tests'] = res
    t['restore_status_inconsistent'] = inconsistent
    t['cis_restore_tests_failed'] = sum(1 for r in restore if r['asset_id'] == 'A-001' and r['status'] == 'Fail')
    cis = [r for r in restore if r['asset_id'] == 'A-001' and r['restore_test_date']]
    t['cis_last_restore_test_date'] = max(r['restore_test_date'] for r in cis)
    t['cis_last_restore_hours'] = float([r for r in cis if r['restore_test_date'] == t['cis_last_restore_test_date']][0]['restore_hours'])
    t['cis_days_since_last_restore_test'] = (AS_OF - pdate(t['cis_last_restore_test_date'])).days
    train = [r for r in recs if r['training_group']]
    t['training_groups'] = {r['training_group']: float(r['training_complete_pct']) for r in train}
    t['training_below_target'] = sorted(r['training_group'] for r in train
                                        if float(r['training_complete_pct']) < TRAINING_TARGET_PCT)
    t['training_status_inconsistent'] = [r['control_test_id'] for r in train if
                                         ('Pass' if float(r['training_complete_pct']) >= TRAINING_TARGET_PCT else 'Fail') != r['status']]
    t['status_counts'] = {k: sum(1 for r in recs if r['status'] == k) for k in ('Pass', 'Fail', 'Not tested')}
    return t


def compute_vendors():
    h, rows = read_rows('khn_vendors.csv')
    recs = [dict(zip(h, r)) for r in rows]
    t = {'rows': len(recs)}
    t['data_outside_canada'] = sorted(f"{r['vendor_id']} {r['data_location']}" for r in recs if r['data_location'] != 'Canada')
    t['no_assurance_report'] = sorted(r['vendor_id'] for r in recs if not r['last_assurance_report'])
    t['assurance_older_than_12_months'] = sorted(f"{r['vendor_id']} {r['last_assurance_report']}" for r in recs
                                                 if r['last_assurance_report']
                                                 and pdate(r['last_assurance_report']) < date(AS_OF.year - 1, AS_OF.month, AS_OF.day))
    t['remote_access_vendors'] = sum(1 for r in recs if r['has_remote_access'] == 'Yes')
    t['contracts_ending_within_90_days'] = sorted(f"{r['vendor_id']} {r['contract_end']}" for r in recs
                                                  if (pdate(r['contract_end']) - AS_OF).days <= 90)
    return t


# --------------------------------------------------------------------------- 12. controls (needs identity and review truth)
def gen_controls(idt, rvt):
    pe = idt['privileged_enabled']
    pm = pe - idt['privileged_without_mfa']
    rows = [
        ['CT-001', 'CIS restore test', 'A-001', '2025-03-20', 'Full CIS restore completes within the 4-hour RTO',
         'Restore completed in 9.0 hours; database rebuild step ran long', 'Fail', 'BK-A001-DAILY', '2025-03-20', 4, 9.0, '', '', ''],
        ['CT-002', 'CIS restore test', 'A-001', '2025-08-14', 'Full CIS restore completes within the 4-hour RTO',
         'Restore completed in 13.5 hours; restore runbook out of date', 'Fail', 'BK-A001-DAILY', '2025-08-14', 4, 13.5, '', '', ''],
        ['CT-003', 'Identity Directory restore test', 'A-007', '2026-09-10', 'Directory restore completes within the 2-hour RTO',
         'Restore completed in 1.5 hours', 'Pass', 'BK-A007-DAILY', '2026-09-10', 2, 1.5, '', '', ''],
        ['CT-004', 'Pharmacy System restore test', 'A-005', '', 'Pharmacy restore completes within the 4-hour RTO',
         'No restore test on record', 'Not tested', 'BK-A005-DAILY', '', 4, '', '', '', ''],
        ['CT-005', 'Immutable backup copy check', 'A-012', '2026-09-24', 'Latest CIS backup has an immutable copy held in Canada',
         'Immutable copy confirmed at NorthArc Cloud, Canadian region', 'Pass', '', '', '', '', '', '', ''],
        ['CT-006', 'MFA enrolment for privileged accounts', 'A-007', '2026-10-01',
         '100% of enabled privileged accounts enrolled in MFA',
         f"{pm} of {pe} enrolled ({idt['privileged_mfa_pct']}%); not enrolled: {', '.join(idt['privileged_without_mfa_ids'])}",
         'Fail' if pm < pe else 'Pass', '', '', '', '', '', '', ''],
        ['CT-007', 'Q3 access review completion', 'A-007', '2026-10-01',
         '100% of reviews due by 2026-09-30 completed with a decision',
         f"{rvt['completed_valid_of_due']} of {rvt['due_by_as_of']} completed ({rvt['completion_pct_of_due']}%); {rvt['overdue']} overdue",
         'Fail' if rvt['overdue'] else 'Pass', '', '', '', '', '', '', ''],
        ['CT-008', 'Leaver accounts disabled', 'A-007', '2026-10-01',
         'No enabled account for a terminated or expired worker',
         f"{idt['missed_leavers']} found: {', '.join(idt['missed_leaver_ids'])}",
         'Fail' if idt['missed_leavers'] else 'Pass', '', '', '', '', '', '', ''],
    ]
    groups = [('Nursing', 86), ('Physicians', 71), ('IT staff', 96), ('Agency and vendor workers', 48),
              ('Executives and leaders', 100)]
    for i, (g, p) in enumerate(groups):
        rows.append([f'CT-{9 + i:03d}', 'Privacy and security awareness training', '', '2026-10-01',
                     f'At least {TRAINING_TARGET_PCT}% of the group complete by the due date',
                     f'{p}% complete', 'Pass' if p >= TRAINING_TARGET_PCT else 'Fail', '', '', '', '', g, '2026-09-30', p])
    write_csv('khn_controls.csv', ['control_test_id', 'control_name', 'asset_id', 'test_date', 'expected_result',
                                   'actual_result', 'status', 'backup_job_id', 'restore_test_date', 'rto_target_hours',
                                   'restore_hours', 'training_group', 'training_due', 'training_complete_pct'], rows)


# --------------------------------------------------------------------------- 14. SQL lab
def sql_lit(v):
    if v is None or v == '':
        return 'NULL'
    if isinstance(v, (int, float)):
        return repr(v)
    return "'" + str(v).replace("'", "''") + "'"


SQL_QUERIES = [
    ('Q1', 'Staff whose manager_id has no matching staff row (orphan manager)',
     "SELECT s.employee_id, s.manager_id\nFROM staff AS s\nLEFT JOIN staff AS m ON m.employee_id = s.manager_id\n"
     "WHERE s.manager_id IS NOT NULL AND m.employee_id IS NULL\nORDER BY s.employee_id;"),
    ('Q2', 'Security events whose asset_id has no matching asset (orphan asset)',
     "SELECT e.record_id, e.asset_id\nFROM security_events AS e\nLEFT JOIN assets AS a ON a.asset_id = e.asset_id\n"
     "WHERE a.asset_id IS NULL\nORDER BY e.record_id;"),
    ('Q3', 'Service tickets whose site_code has no matching site (orphan site)',
     "SELECT t.ticket_id, t.site_code\nFROM service_tickets AS t\nLEFT JOIN sites AS s ON s.site_code = t.site_code\n"
     "WHERE s.site_code IS NULL\nORDER BY t.ticket_id;"),
    ('Q4', 'Tickets per site with an Unknown member, so the rows add back to the table total',
     "SELECT COALESCE(s.site_code, 'Unknown') AS site, COUNT(*) AS tickets\nFROM service_tickets AS t\n"
     "LEFT JOIN sites AS s ON s.site_code = t.site_code\nGROUP BY COALESCE(s.site_code, 'Unknown')\nORDER BY site;"),
]


def gen_sql(latest):
    sites = SITES
    staff_cols = ['employee_id', 'full_name', 'job_role', 'department', 'site_code', 'manager_id', 'worker_type',
                  'hr_status', 'account_status', 'privileged', 'mfa_enrolled', 'effective_from', 'effective_to']
    staff = [[latest[e][c] for c in staff_cols] for e in sorted(latest)]
    h, rows = read_rows('khn_assets.csv')
    assets_u, _ = dedup(rows)
    asset_cols = ['asset_id', 'system_name', 'tier', 'business_owner_id', 'custodian_id', 'classification', 'hosting',
                  'vendor_id', 'rto_target_hours', 'rpo_target_hours', 'end_of_support_date']
    assets = []
    for r in assets_u:
        d = dict(zip(h, r))
        row = [d[c] for c in asset_cols]
        row[2] = int(row[2])
        row[8] = float(row[8])
        row[9] = float(row[9])
        assets.append(row)
    h, rows = read_rows('khn_security_events.csv')
    sec_u, _ = dedup(rows)
    sec = []
    for r in sec_u:
        d = dict(zip(h, r))
        row = [d[c] for c in SEC_HEADER]
        row[-1] = float(row[-1]) if row[-1] else ''
        sec.append(row)
    h, rows = read_rows('khn_service_desk.csv')
    desk_u, _ = dedup(rows)
    tick_cols = ['ticket_id', 'ticket_type', 'opened_at', 'resolved_at', 'priority', 'category', 'site_code',
                 'assignment_group', 'sla_target_hours', 'sla_met']
    subset = [dict(zip(h, r)) for r in desk_u if r[2] >= '2026-09-01'][:30]
    orphan_ticket = rng.choice([d for d in subset if d['site_code'] == 'PGH'])['ticket_id']
    tickets = []
    for d in subset:
        row = [d[c] for c in tick_cols]
        if d['ticket_id'] == orphan_ticket:
            row[6] = 'PGC'
        row[8] = float(row[8]) if row[8] else ''
        tickets.append(row)
    INJECTED['sql'] = {'orphan_ticket': orphan_ticket, 'orphan_ticket_original_site':
                       [d['site_code'] for d in subset if d['ticket_id'] == orphan_ticket][0]}
    lines = [
        '-- Kestrel Health Network SQL lab seed (SQLite). All data is synthetic; patients are never named.',
        '-- Generated by generate.py (seed 20261001). Load with:  sqlite3 kestrel_lab.db < khn_lab.sql',
        '-- Logical foreign keys (deliberately NOT enforced, so you can find the orphans):',
        '--   staff.manager_id -> staff.employee_id',
        '--   staff.site_code -> sites.site_code',
        '--   security_events.asset_id -> assets.asset_id',
        '--   service_tickets.site_code -> sites.site_code',
        '-- staff holds the latest assignment row per employee from khn_identity.csv.',
        '-- service_tickets holds the first 30 unique tickets opened from 2026-09-01. In this lab copy, '
        f"{orphan_ticket} was keyed with site_code 'PGC' (a typing error for "
        f"{INJECTED['sql']['orphan_ticket_original_site']}) so the table has an orphan site.",
        '',
        'DROP TABLE IF EXISTS service_tickets;', 'DROP TABLE IF EXISTS security_events;', 'DROP TABLE IF EXISTS assets;',
        'DROP TABLE IF EXISTS staff;', 'DROP TABLE IF EXISTS sites;', '',
        'CREATE TABLE sites (\n  site_code TEXT PRIMARY KEY,\n  site_name TEXT NOT NULL,\n  zone TEXT NOT NULL,\n  site_type TEXT NOT NULL\n);',
        'CREATE TABLE staff (\n  employee_id TEXT PRIMARY KEY,\n  full_name TEXT NOT NULL,\n  job_role TEXT,\n  department TEXT,\n'
        '  site_code TEXT,\n  manager_id TEXT,\n  worker_type TEXT,\n  hr_status TEXT,\n  account_status TEXT,\n'
        '  privileged TEXT,\n  mfa_enrolled TEXT,\n  effective_from TEXT,\n  effective_to TEXT\n);',
        'CREATE TABLE assets (\n  asset_id TEXT PRIMARY KEY,\n  system_name TEXT NOT NULL,\n  tier INTEGER,\n'
        '  business_owner_id TEXT,\n  custodian_id TEXT,\n  classification TEXT,\n  hosting TEXT,\n  vendor_id TEXT,\n'
        '  rto_target_hours REAL,\n  rpo_target_hours REAL,\n  end_of_support_date TEXT\n);',
        'CREATE TABLE security_events (\n  record_id TEXT PRIMARY KEY,\n  record_type TEXT NOT NULL,\n  occurred_at TEXT,\n'
        '  opened_at TEXT,\n  detected_at TEXT,\n  contained_at TEXT,\n  recovered_at TEXT,\n  severity TEXT,\n'
        '  category TEXT,\n  asset_id TEXT,\n  status TEXT,\n  remediation_due TEXT,\n  cvss_score REAL\n);',
        'CREATE TABLE service_tickets (\n  ticket_id TEXT PRIMARY KEY,\n  ticket_type TEXT NOT NULL,\n  opened_at TEXT NOT NULL,\n'
        '  resolved_at TEXT,\n  priority TEXT,\n  category TEXT,\n  site_code TEXT,\n  assignment_group TEXT,\n'
        '  sla_target_hours REAL,\n  sla_met TEXT\n);', '']

    def inserts(table, cols, data):
        for r in data:
            lines.append(f"INSERT INTO {table} ({', '.join(cols)}) VALUES ({', '.join(sql_lit(v) for v in r)});")
        lines.append('')
    inserts('sites', ['site_code', 'site_name', 'zone', 'site_type'], sites)
    inserts('staff', staff_cols, staff)
    inserts('assets', asset_cols, assets)
    inserts('security_events', SEC_HEADER, sec)
    inserts('service_tickets', tick_cols, tickets)
    body = '\n'.join(lines)
    con = sqlite3.connect(':memory:')
    con.executescript(body)
    results = {}
    for qid, title, sql in SQL_QUERIES:
        cur = con.execute(sql)
        cols = [c[0] for c in cur.description]
        results[qid] = {'title': title, 'columns': cols, 'rows': [list(r) for r in cur.fetchall()]}
    counts = {tb: con.execute(f'SELECT COUNT(*) FROM {tb}').fetchone()[0]
              for tb in ('sites', 'staff', 'assets', 'security_events', 'service_tickets')}
    con.close()
    tail = ['-- =====================================================================',
            '-- Reconciliation queries and their exact expected results.',
            '-- Computed by generate.py by running this file with Python sqlite3.',
            f"-- Row counts: {', '.join(f'{k} {v}' for k, v in counts.items())}.", '--']
    for qid, title, sql in SQL_QUERIES:
        tail.append(f'-- {qid}. {title}')
        for ln in sql.split('\n'):
            tail.append(f'--   {ln}')
        tail.append('-- Expected result:')
        tail.append('--   ' + ' | '.join(results[qid]['columns']))
        for r in results[qid]['rows']:
            tail.append('--   ' + ' | '.join(str(v) for v in r))
        tail.append(f"--   ({len(results[qid]['rows'])} row{'s' if len(results[qid]['rows']) != 1 else ''})")
        tail.append('--')
    write_text('khn_lab.sql', body + '\n' + '\n'.join(tail) + '\n')
    return {'row_counts': counts, 'results': results, 'orphan_ticket': orphan_ticket}


# =========================================================================== documentation
TRUTH = {}
REG = []


def getp(d, path):
    for k in path.split('.'):
        d = d[k]
    return d


def fmt(v, kind):
    if kind == 'int':
        return f'{v:,}'
    if kind == 'cad':
        return f'CAD {v:,}'
    if kind == 'pct':
        return f'{v:.1f}%'
    if kind == 'n1':
        return f'{v:.1f}'
    if kind == 'n2':
        return f'{v:.2f}'
    if kind == 'list':
        return ', '.join(str(x) for x in v) if v else 'none'
    return str(v)


def F(path, kind='int'):
    s = fmt(getp(TRUTH, path), kind)
    REG.append((path, kind, s))
    return s


def table(header, rows):
    out = ['| ' + ' | '.join(header) + ' |', '|' + '|'.join('---' for _ in header) + '|']
    for r in rows:
        out.append('| ' + ' | '.join(str(x) for x in r) + ' |')
    return '\n'.join(out)


DATA_DICTIONARY = {
    'khn_sites.csv': [
        ('site_code', 'Kestrel site code; primary key', 'text', 'Public', 'KGH; ARH; CVH; PGH'),
        ('site_name', 'Site name', 'text', 'Public', 'Kestrel General Hospital; Aspen Ridge Hospital; Coulee Valley Hospital; Prairie Gate Health Centre'),
        ('zone', 'Kestrel zone the site belongs to', 'text', 'Public', 'Central; North; South'),
        ('site_type', 'Type of site', 'text', 'Public', 'Urban referral hospital; Community hospital; Rural health centre'),
    ],
    'khn_units.csv': [
        ('unit_id', 'Inpatient unit code; primary key', 'text', 'Internal', '; '.join(UNIT_IDS)),
        ('site_code', 'Site of the unit; foreign key to khn_sites.csv', 'text', 'Internal', 'KGH; ARH; CVH; PGH'),
        ('unit_name', 'Unit name as used on the bed board', 'text', 'Internal', ''),
        ('unit_type', 'Kind of inpatient unit', 'text', 'Internal', 'Medicine; Surgery; Intensive care'),
    ],
    'khn_ed_visits.csv': [
        ('visit_id', 'Pseudonymous emergency department visit identifier; primary key; not linked to any person outside the warehouse', 'text', 'Confidential', 'V0001 onward'),
        ('site_code', 'Site of the emergency department', 'text', 'Confidential', 'KGH; ARH; CVH; PGH (upper case)'),
        ('arrival_datetime', 'Arrival and registration time; the start of every ED clock at Kestrel', 'datetime', 'Confidential', 'YYYY-MM-DD HH:MM from 2026-07-01 to 2026-09-30'),
        ('ctas_level', 'Canadian Triage and Acuity Scale (CTAS) level assigned at triage', 'whole number', 'Confidential', '1 to 5'),
        ('triage_datetime', 'Time triage was completed', 'datetime', 'Confidential', 'YYYY-MM-DD HH:MM; not before arrival'),
        ('pia_datetime', 'Physician initial assessment (PIA) time; blank when the patient left without being seen', 'datetime', 'Confidential', 'YYYY-MM-DD HH:MM; not before triage; blank only for LWBS'),
        ('disposition', 'How the ED visit ended', 'text', 'Confidential', 'Admitted; Discharged; LWBS; Transferred'),
        ('departure_datetime', 'Time the patient physically left the ED; for admitted patients, when they left the ED for an inpatient bed', 'datetime', 'Confidential', 'YYYY-MM-DD HH:MM; not before arrival'),
        ('age_band', 'Age group at arrival (bands, not dates of birth, to reduce re-identification risk)', 'text', 'Confidential', '0-17; 18-64; 65+'),
        ('arrival_mode', 'How the patient arrived', 'text', 'Confidential', 'Ambulance; Walk-in'),
    ],
    'khn_bed_census.csv': [
        ('census_date', 'Date of the midnight snapshot', 'date', 'Confidential', '2026-07-01 to 2026-09-30, one row per unit per day'),
        ('unit_id', 'Inpatient unit; foreign key to khn_units.csv', 'text', 'Confidential', '; '.join(UNIT_IDS)),
        ('staffed_beds', 'Beds open and staffed at the snapshot; semi-additive (add across units, never across days)', 'whole number', 'Confidential', '0 or more'),
        ('occupied_beds', 'Beds with a patient in them at the snapshot; semi-additive', 'whole number', 'Confidential', '0 or more; above staffed_beds is possible overcapacity and needs review'),
        ('alc_patients', 'Patients in a bed who no longer need acute care and wait for an alternate level of care (ALC); summing across days gives ALC patient-days', 'whole number', 'Confidential', '0 to occupied_beds'),
    ],
    'khn_programme_register.csv': [
        ('wp_id', 'Work package identifier; primary key', 'text', 'Internal', 'WP-101 to WP-115'),
        ('release', 'Beacon release the work package belongs to', 'whole number', 'Internal', '1; 2; 3'),
        ('work_package', 'Work package name', 'text', 'Internal', ''),
        ('owner_id', 'Accountable owner; foreign key to khn_identity.csv', 'text', 'Internal', 'E-001 to E-020; required'),
        ('planned_start', 'Baseline start date from the schedule', 'date', 'Internal', 'YYYY-MM-DD'),
        ('planned_finish', 'Baseline finish date from the schedule', 'date', 'Internal', 'YYYY-MM-DD; not before planned_start'),
        ('budget_cad', 'Budget at completion (BAC) for the work package, Canadian dollars', 'whole number', 'Internal', '0 or more'),
        ('planned_pct_as_of', 'Planned percent complete as of 2026-10-01 (baseline), used for planned value', 'whole number', 'Internal', '0 to 100'),
        ('pct_complete', 'Actual percent complete as of 2026-10-01, used for earned value', 'whole number', 'Internal', '0 to 100'),
        ('actual_cost_cad', 'Actual cost to 2026-10-01, Canadian dollars', 'whole number', 'Internal', '0 or more'),
        ('status', 'Work package status', 'text', 'Internal', 'Not started; In progress; Complete; On hold'),
        ('risk_rating', 'Overall risk rating', 'text', 'Internal', 'Low; Medium; High'),
    ],
    'khn_schedule.csv': [
        ('ID', 'Task ID in Microsoft Project import order; row 1 is the programme summary', 'whole number', 'Internal', '1 to 28'),
        ('Name', 'Task or milestone name', 'text', 'Internal', ''),
        ('Duration', 'Working-day duration; milestones are 0d', 'text', 'Internal', 'Nd'),
        ('Start', 'Start date, given only for row 1; every other date comes from the links', 'date', 'Internal', '2026-09-01 on row 1, blank elsewhere'),
        ('Predecessors', 'Finish-to-start predecessor IDs, comma separated', 'text', 'Internal', 'IDs from 2 to 27'),
        ('Resource Names', 'Role names, semicolon separated', 'text', 'Internal', ''),
        ('Milestone', 'Yes for 0d milestones', 'text', 'Internal', 'Yes; No'),
        ('Release', 'Release or programme level', 'text', 'Internal', 'Programme; Release 1; Release 2; Release 3'),
    ],
    'khn_service_desk.csv': [
        ('ticket_id', 'Service desk ticket; primary key', 'text', 'Internal', 'SD-10001 onward'),
        ('ticket_type', 'Kind of ticket', 'text', 'Internal', 'Incident; Service request; Access request'),
        ('opened_at', 'Time the ticket was logged', 'datetime', 'Internal', 'YYYY-MM-DD HH:MM from 2026-08-01 to 2026-09-30'),
        ('resolved_at', 'Time the ticket was resolved; blank when still open at the extract (2026-10-01 00:00)', 'datetime', 'Internal', 'YYYY-MM-DD HH:MM; not before opened_at'),
        ('priority', 'Priority; access and service requests are P3 or P4', 'text', 'Internal', 'P1; P2; P3; P4'),
        ('category', 'Ticket category', 'text', 'Internal', 'CIS access; CIS issue; Power BI; Virtual desktop; Printing; Network; Password reset; Hardware'),
        ('site_code', 'Site of the requester; foreign key to khn_sites.csv', 'text', 'Internal', 'KGH; ARH; CVH; PGH'),
        ('assignment_group', 'Resolver group', 'text', 'Internal', 'Service Desk; Clinical Applications; Analytics Support; End User Computing; Network Services; Identity and Access'),
        ('channel', 'How the ticket arrived', 'text', 'Internal', 'Phone; Portal; Walk-up'),
        ('sla_target_hours', 'Resolution target in clock hours for the priority', 'whole number', 'Internal', 'P1 4; P2 8; P3 24; P4 72'),
        ('sla_met', 'Stored SLA flag; recompute it from the timestamps before use', 'Y/N', 'Internal', 'Y; N; blank while the clock is still running'),
        ('reopened', 'Ticket was reopened after resolution', 'Y/N', 'Internal', 'Y; N'),
        ('csat', 'Customer satisfaction score from the closure survey', 'whole number', 'Internal', '1 to 5; blank when no response'),
    ],
    'khn_identity.csv': [
        ('employee_id', 'Worker identifier; one current row expected per worker', 'text', 'Confidential', 'E-001 onward'),
        ('full_name', 'Worker name (synthetic)', 'text', 'Confidential', ''),
        ('job_role', 'Role used for role-based access control', 'text', 'Internal', 'Registered Nurse; Physician; Unit Clerk; Clinical Analyst; System Administrator; Executive; Agency Nurse; Vendor Support; Service Desk Analyst; Security Analyst; Corporate Staff'),
        ('department', 'Department or unit; vendor workers show their company', 'text', 'Internal', ''),
        ('site_code', 'Home site; foreign key to khn_sites.csv', 'text', 'Internal', 'KGH; ARH; CVH; PGH'),
        ('manager_id', 'Manager; foreign key to employee_id; blank only for the top of the reporting line', 'text', 'Confidential', 'an existing employee_id'),
        ('worker_type', 'Employment relationship', 'text', 'Internal', 'Employee; Agency; Vendor'),
        ('hr_status', 'Status in the HR and Payroll System (A-015)', 'text', 'Confidential', 'Active; Leave; Terminated'),
        ('account_status', 'Status of the account in the Identity Directory (A-007)', 'text', 'Confidential', 'Enabled; Disabled'),
        ('privileged', 'Account holds administrative rights', 'Yes/No', 'Confidential', 'Yes; No'),
        ('mfa_enrolled', 'Enrolled in multifactor authentication', 'Yes/No', 'Confidential', 'Yes; No'),
        ('effective_from', 'Start of this assignment row', 'date', 'Confidential', 'YYYY-MM-DD'),
        ('effective_to', 'End of this assignment row; blank while current; required for Agency and Vendor workers', 'date', 'Confidential', 'YYYY-MM-DD or blank'),
        ('last_login', 'Last successful sign-in to the Identity Directory', 'datetime', 'Confidential', 'YYYY-MM-DD HH:MM'),
    ],
    'khn_role_permissions.csv': [
        ('job_role', 'RBAC role', 'text', 'Internal', 'values of khn_identity.csv job_role'),
        ('system_id', 'System; foreign key to khn_assets.csv', 'text', 'Internal', 'A-001 to A-015'),
        ('permission', 'Permission the role grants on the system', 'text', 'Internal', ''),
    ],
    'khn_user_permissions.csv': [
        ('employee_id', 'Worker holding the permission', 'text', 'Confidential', 'an existing employee_id'),
        ('system_id', 'System', 'text', 'Confidential', 'A-001 to A-015'),
        ('permission', 'Permission actually assigned', 'text', 'Confidential', ''),
        ('granted_date', 'Date the permission was granted', 'date', 'Confidential', 'YYYY-MM-DD'),
        ('granted_by', 'Who granted it; must not be the same person as employee_id', 'text', 'Confidential', 'an existing employee_id'),
    ],
    'khn_access_reviews.csv': [
        ('review_id', 'Access review item; primary key', 'text', 'Confidential', 'AR-001 onward'),
        ('employee_id', 'Worker whose access is reviewed', 'text', 'Confidential', 'an existing employee_id'),
        ('system_id', 'System reviewed', 'text', 'Confidential', 'A-001 to A-015'),
        ('reviewer_id', 'Manager or owner who must decide; must not review their own access', 'text', 'Confidential', 'an existing employee_id'),
        ('assigned_date', 'Date the item was assigned to the reviewer', 'date', 'Confidential', 'YYYY-MM-DD'),
        ('due_date', 'Date the decision is due', 'date', 'Confidential', 'YYYY-MM-DD'),
        ('completed_date', 'Date the decision was recorded; blank if not done', 'date', 'Confidential', 'YYYY-MM-DD, not before assigned_date, or blank'),
        ('decision', 'Reviewer decision', 'text', 'Confidential', 'Keep; Remove; Modify; blank'),
        ('exception', 'Access kept under an approved exception', 'Y/N', 'Confidential', 'Y; N'),
    ],
    'khn_security_events.csv': [
        ('record_id', 'Security record; primary key', 'text', 'Confidential', 'SEC-001 onward'),
        ('record_type', 'Incident or vulnerability', 'text', 'Confidential', 'Incident; Vulnerability'),
        ('occurred_at', 'Incidents only: start of the malicious or faulty activity, from the investigation timeline', 'datetime', 'Confidential', 'YYYY-MM-DD HH:MM; blank for vulnerabilities'),
        ('opened_at', 'Time the record was opened in the IT Service Management Platform; may be before or after detection', 'datetime', 'Confidential', 'YYYY-MM-DD HH:MM'),
        ('detected_at', 'Time the event or weakness was first detected', 'datetime', 'Confidential', 'YYYY-MM-DD HH:MM; not before occurred_at'),
        ('contained_at', 'Incidents only: time the threat was contained', 'datetime', 'Confidential', 'not before detected_at'),
        ('recovered_at', 'Incidents only: time normal service was restored', 'datetime', 'Confidential', 'not before contained_at; blank while open'),
        ('severity', 'Severity', 'text', 'Confidential', 'Critical; High; Medium; Low'),
        ('category', 'Category', 'text', 'Confidential', 'Incidents: Phishing; Malware; Ransomware precursor; Unauthorized access; Misconfiguration; Lost device. Vulnerabilities: Remote code execution; Missing patch; Weak cipher; Excessive permission; End-of-support software'),
        ('asset_id', 'Affected system; foreign key to khn_assets.csv', 'text', 'Confidential', 'A-001 to A-015'),
        ('status', 'Record status', 'text', 'Confidential', 'Incidents: Contained; Closed. Vulnerabilities: Open; Remediated'),
        ('remediation_due', 'Vulnerabilities only: due date from detection (Critical 7, High 30, Medium 60, Low 90 days)', 'date', 'Confidential', 'YYYY-MM-DD; blank for incidents'),
        ('cvss_score', 'Vulnerabilities only: CVSS base score', 'decimal', 'Confidential', '0.0 to 10.0; blank for incidents'),
    ],
    'khn_assets.csv': [
        ('asset_id', 'System identifier; primary key', 'text', 'Internal', 'A-001 to A-015'),
        ('system_name', 'System name', 'text', 'Internal', ''),
        ('tier', 'Criticality tier (1 is most critical)', 'whole number', 'Internal', '1; 2; 3'),
        ('business_owner_id', 'Accountable business owner; required', 'text', 'Internal', 'an existing employee_id'),
        ('custodian_id', 'Technical custodian', 'text', 'Internal', 'an existing employee_id'),
        ('classification', 'Highest classification of data the system holds (Kestrel policy)', 'text', 'Internal', 'Public; Internal; Confidential; Restricted'),
        ('hosting', 'Where the system runs', 'text', 'Confidential', 'On premises; NorthArc Cloud; Vendor hosted'),
        ('vendor_id', 'Main vendor; foreign key to khn_vendors.csv', 'text', 'Internal', 'V-01 to V-05 or blank'),
        ('depends_on', 'Systems this one needs to run, semicolon separated', 'text', 'Confidential', 'asset IDs'),
        ('rto_target_hours', 'Recovery time objective in hours', 'decimal', 'Internal', 'greater than 0'),
        ('rpo_target_hours', 'Recovery point objective in hours', 'decimal', 'Internal', 'greater than 0'),
        ('end_of_support_date', 'Date vendor support ends; blank for evergreen software as a service', 'date', 'Confidential', 'YYYY-MM-DD or blank'),
    ],
    'khn_controls.csv': [
        ('control_test_id', 'Control test; primary key', 'text', 'Confidential', 'CT-001 onward'),
        ('control_name', 'Control tested', 'text', 'Confidential', ''),
        ('asset_id', 'System the test covers; blank for people controls', 'text', 'Confidential', 'A-001 to A-015 or blank'),
        ('test_date', 'Date of the test or measurement; blank when never tested', 'date', 'Confidential', 'YYYY-MM-DD or blank'),
        ('expected_result', 'What a pass looks like', 'text', 'Confidential', ''),
        ('actual_result', 'What the test found', 'text', 'Confidential', ''),
        ('status', 'Test outcome', 'text', 'Confidential', 'Pass; Fail; Not tested'),
        ('backup_job_id', 'Backup job used for a restore test', 'text', 'Confidential', 'BK-... or blank'),
        ('restore_test_date', 'Date of the restore test', 'date', 'Confidential', 'YYYY-MM-DD or blank'),
        ('rto_target_hours', 'Recovery time objective for the system', 'decimal', 'Confidential', 'greater than 0 or blank'),
        ('restore_hours', 'Measured restore time', 'decimal', 'Confidential', 'greater than 0 or blank'),
        ('training_group', 'Workforce group for awareness training', 'text', 'Confidential', 'Nursing; Physicians; IT staff; Agency and vendor workers; Executives and leaders'),
        ('training_due', 'Training due date', 'date', 'Confidential', 'YYYY-MM-DD or blank'),
        ('training_complete_pct', 'Percent of the group complete', 'decimal', 'Confidential', '0 to 100 or blank'),
    ],
    'khn_vendors.csv': [
        ('vendor_id', 'Vendor; primary key', 'text', 'Internal', 'V-01 to V-05'),
        ('vendor_name', 'Vendor name (fictional)', 'text', 'Internal', ''),
        ('service', 'Service supplied', 'text', 'Internal', ''),
        ('data_location', 'Country where the vendor stores or processes Kestrel data', 'text', 'Internal', 'Canada; United States'),
        ('has_remote_access', 'Vendor staff can reach Kestrel systems remotely', 'Yes/No', 'Internal', 'Yes; No'),
        ('last_assurance_report', 'Date of the last SOC 2 Type II or equivalent report; blank if none', 'date', 'Confidential', 'YYYY-MM-DD or blank'),
        ('contract_end', 'Contract end date', 'date', 'Internal', 'YYYY-MM-DD'),
        ('risk_rating', 'Third-party risk rating', 'text', 'Internal', 'Low; Medium; High'),
    ],
}


def write_data_dictionary():
    rows = []
    for f, cols in DATA_DICTIONARY.items():
        h, _ = read_rows(f)
        assert h == [c[0] for c in cols], (f, h)
        for c in cols:
            rows.append([f[:-4]] + list(c))
    write_csv('data-dictionary.csv', ['table', 'column', 'description', 'type', 'classification', 'allowed_values'], rows)


def write_source_to_target(ed, beds, desk):
    T = TRUTH
    site_counts = '; '.join(f"{s} {F('ed.visits_by_site.' + s)}" for s in SITE_CODES)
    ctas_counts = '; '.join(f"CTAS {c} {F('ed.visits_by_ctas.' + str(c))}" for c in range(1, 6))
    rows = [
        ['khn_sites.csv', 'site_code', 'DimSite', 'SiteCode', 'Trim and upper case; primary key',
         f"{F('dims.dim_site_rows')} rows; {F('dims.dim_site_rows')} distinct SiteCode values"],
        ['khn_sites.csv', 'site_name', 'DimSite', 'SiteName', 'Trim', 'No blanks'],
        ['khn_sites.csv', 'zone', 'DimSite', 'Zone', 'Trim', 'Central, North, South only'],
        ['khn_sites.csv', 'site_type', 'DimSite', 'SiteType', 'Trim', 'No blanks'],
        ['khn_units.csv', 'unit_id', 'DimUnit', 'UnitID', 'Trim and upper case; primary key',
         f"{F('dims.dim_unit_rows')} rows"],
        ['khn_units.csv', 'site_code', 'DimUnit', 'SiteCode', 'Relate DimSite[SiteCode] 1 to many DimUnit[SiteCode]',
         f"{F('dims.dim_unit_unmatched_sites')} unmatched site codes"],
        ['khn_units.csv', 'unit_name', 'DimUnit', 'UnitName', 'Trim', 'No blanks'],
        ['khn_units.csv', 'unit_type', 'DimUnit', 'UnitType', 'Trim', 'Medicine, Surgery, Intensive care only'],
        ['(generated in Power Query)', '(none)', 'DimDate', 'Date', 'Continuous calendar for the full year 2026-01-01 to 2026-12-31 (full years, as Microsoft recommends); mark as date table',
         f"{F('dims.dim_date_rows')} rows; every ArrivalDate, CensusDate and OpenedDate found"],
        ['(generated in Power Query)', '(none)', 'DimDate', 'Year', 'Date.Year([Date])', 'All rows 2026'],
        ['(generated in Power Query)', '(none)', 'DimDate', 'MonthNumber', 'Date.Month([Date])', '1 to 12; sort key for MonthName'],
        ['(generated in Power Query)', '(none)', 'DimDate', 'MonthName', 'Date.MonthName([Date])', 'Sort by MonthNumber'],
        ['(generated in Power Query)', '(none)', 'DimDate', 'DayOfWeek', 'Date.DayOfWeekName([Date])', 'Seven distinct values'],
        ['(Kestrel CTAS reference)', 'CTAS level', 'DimCTAS', 'CTASLevel', 'Whole number 1 to 5; primary key',
         f"{F('dims.dim_ctas_rows')} rows"],
        ['(Kestrel CTAS reference)', 'level name', 'DimCTAS', 'CTASDescription',
         '1 Resuscitation; 2 Emergent; 3 Urgent; 4 Less urgent; 5 Non-urgent', 'Five distinct values'],
        ['(Kestrel CTAS reference)', 'target', 'DimCTAS', 'TargetMinutes',
         'Minutes from arrival to PIA: 1 = 0 (immediate); 2 = 15; 3 = 30; 4 = 60; 5 = 120', 'Five rows, no blanks'],
        ['khn_ed_visits.csv', '(whole row)', 'FactEDVisit', '(all)', 'Remove exact duplicate rows (DQ-01)',
         f"{F('ed.source_rows')} source rows; {F('ed.exact_duplicate_rows')} exact duplicates removed; {F('ed.unique_rows')} unique"],
        ['khn_ed_visits.csv', 'visit_id', 'FactEDVisit', 'VisitID',
         'Text; unique after DQ-01; quarantine rows failing DQ-04, DQ-05 or DQ-07',
         f"{F('ed.valid_visits')} rows loaded; {F('ed.quarantined_count')} quarantined"],
        ['khn_ed_visits.csv', 'site_code', 'FactEDVisit', 'SiteCode',
         'Trim and upper case (DQ-03); relate to DimSite', f"{site_counts}; 0 unmatched"],
        ['khn_ed_visits.csv', 'arrival_datetime', 'FactEDVisit', 'ArrivalDateTime',
         'Parse as date/time; a value that does not parse quarantines the row (DQ-04)',
         f"Quarantined for an invalid date: {F('ed.quarantined.invalid_date', 'list')}"],
        ['khn_ed_visits.csv', 'arrival_datetime', 'FactEDVisit', 'ArrivalDate',
         'DateTime.Date([ArrivalDateTime]); relate to DimDate[Date]',
         f"{F('ed.valid_visits')} rows match DimDate; first {F('ed.visits_by_arrival_date_min', 'str')}, last {F('ed.visits_by_arrival_date_max', 'str')}"],
        ['khn_ed_visits.csv', 'ctas_level', 'FactEDVisit', 'CTASLevel',
         'Whole number; outside 1 to 5 quarantines the row (DQ-05); relate to DimCTAS',
         f"{ctas_counts}; quarantined {F('ed.quarantined.ctas_out_of_range', 'list')}"],
        ['khn_ed_visits.csv', 'triage_datetime', 'FactEDVisit', 'TriageDateTime', 'Parse as date/time', 'No blanks'],
        ['khn_ed_visits.csv', 'pia_datetime', 'FactEDVisit', 'PIADateTime',
         'Parse as date/time; blank allowed only for LWBS; LWBS with a PIA quarantines the row (DQ-07)',
         f"Quarantined: {F('ed.quarantined.lwbs_with_pia', 'list')}"],
        ['khn_ed_visits.csv', 'pia_datetime', 'FactEDVisit', 'MinutesToPIA',
         'Whole minutes from ArrivalDateTime to PIADateTime; null when PIA is blank or the timestamps are out of order (DQ-06)',
         f"{F('ed.pia_n')} non-null; median {F('ed.median_min_to_pia', 'n1')} minutes; nulled for order problems: {F('ed.timing_invalid_ids', 'list')}"],
        ['khn_ed_visits.csv', 'disposition', 'FactEDVisit', 'Disposition', 'Trim; Admitted, Discharged, LWBS, Transferred',
         f"LWBS {F('ed.lwbs_count')} ({F('ed.lwbs_rate_pct', 'pct')})"],
        ['khn_ed_visits.csv', 'departure_datetime', 'FactEDVisit', 'DepartureDateTime',
         'Parse as date/time; blank for a non-LWBS visit is flagged, not quarantined',
         f"Blank departure: {F('ed.missing_departure_ids', 'list')}"],
        ['khn_ed_visits.csv', 'departure_datetime', 'FactEDVisit', 'EDLOSMinutes',
         'Whole minutes from ArrivalDateTime to DepartureDateTime; null when departure is blank or the timestamps are out of order',
         f"{F('ed.los_n')} non-null; median admitted {F('ed.median_los_hours_admitted', 'n2')} h; median discharged {F('ed.median_los_hours_discharged', 'n2')} h"],
        ['khn_ed_visits.csv', 'age_band', 'FactEDVisit', 'AgeBand', 'Text; 0-17, 18-64, 65+', 'No other values'],
        ['khn_ed_visits.csv', 'arrival_mode', 'FactEDVisit', 'ArrivalMode', 'Text; Ambulance, Walk-in',
         f"Ambulance {F('ed.ambulance_arrivals')}"],
        ['khn_bed_census.csv', '(whole row)', 'FactBedCensus', '(all)',
         'Remove exact duplicates (DQ-01); check one row per unit per day (DQ-09)',
         f"{F('beds.source_rows')} source rows; {F('beds.exact_duplicate_rows')} duplicate removed; {F('beds.loaded_rows')} loaded; expected {F('beds.expected_unit_days')}; missing {F('beds.missing_unit_days', 'list')}"],
        ['khn_bed_census.csv', 'census_date', 'FactBedCensus', 'CensusDate', 'Parse as date; relate to DimDate[Date]',
         f"Last snapshot {F('beds.last_census_date', 'str')}"],
        ['khn_bed_census.csv', 'unit_id', 'FactBedCensus', 'UnitID', 'Relate DimUnit[UnitID] 1 to many FactBedCensus[UnitID]',
         '0 unmatched'],
        ['khn_bed_census.csv', 'staffed_beds', 'FactBedCensus', 'StaffedBeds',
         'Whole number 0 or more; semi-additive: add across units, never across dates',
         f"Average daily occupancy {F('beds.avg_daily_occupancy_pct', 'pct')}; staffed beds on the last date {F('beds.last_snapshot_staffed_beds')}"],
        ['khn_bed_census.csv', 'occupied_beds', 'FactBedCensus', 'OccupiedBeds',
         'Whole number 0 or more; above StaffedBeds is kept and flagged for review (DQ-11)',
         f"Occupancy on {F('beds.last_census_date', 'str')}: {F('beds.last_snapshot_occupancy_pct', 'pct')}"],
        ['khn_bed_census.csv', 'occupied_beds', 'FactBedCensus', 'OverCapacityFlag', '[OccupiedBeds] > [StaffedBeds]',
         f"TRUE for {F('beds.overcapacity_rows', 'list')}"],
        ['khn_bed_census.csv', 'alc_patients', 'FactBedCensus', 'ALCPatients',
         'Whole number 0 or more; a negative value is set to null (DQ-05)',
         f"ALC patient-days {F('beds.alc_patient_days')}; nulled {F('beds.negative_alc_rows', 'list')}"],
        ['khn_service_desk.csv', '(whole row)', 'FactServiceTicket', '(all)', 'Remove exact duplicates (DQ-01)',
         f"{F('desk.source_rows')} source rows; {F('desk.exact_duplicate_rows')} duplicate removed; {F('desk.unique_tickets')} loaded"],
        ['khn_service_desk.csv', 'ticket_id', 'FactServiceTicket', 'TicketID', 'Text; unique after DQ-01', '0 duplicate keys'],
        ['khn_service_desk.csv', 'ticket_type', 'FactServiceTicket', 'TicketType', 'Trim',
         '; '.join(f"{k} {F('desk.tickets_by_type.' + k)}" for k in ['Incident', 'Service request', 'Access request'])],
        ['khn_service_desk.csv', 'opened_at', 'FactServiceTicket', 'OpenedAt', 'Parse as date/time', 'No blanks'],
        ['khn_service_desk.csv', 'opened_at', 'FactServiceTicket', 'OpenedDate', 'DateTime.Date([OpenedAt]); relate to DimDate[Date]',
         'All rows match DimDate'],
        ['khn_service_desk.csv', 'resolved_at', 'FactServiceTicket', 'ResolvedAt', 'Parse as date/time; blank means open at the extract',
         f"Open at extract {F('desk.open_at_extract')}"],
        ['khn_service_desk.csv', 'resolved_at', 'FactServiceTicket', 'ResolutionHours',
         'Decimal hours from OpenedAt to ResolvedAt; null when open or when resolved before opened (DQ-06)',
         f"Median access request {F('desk.median_access_request_days', 'n2')} days (n = {F('desk.access_requests_resolved_n')}); nulled {F('desk.resolved_before_opened_ids', 'list')}"],
        ['khn_service_desk.csv', 'priority', 'FactServiceTicket', 'Priority', 'P1 to P4; blank kept and flagged',
         f"Blank priority {F('desk.missing_priority_ids', 'list')}"],
        ['khn_service_desk.csv', 'category', 'FactServiceTicket', 'Category', 'Trim', 'Eight governed values'],
        ['khn_service_desk.csv', 'site_code', 'FactServiceTicket', 'SiteCode', 'Trim and upper case; relate to DimSite',
         '; '.join(f"{s} {F('desk.tickets_by_site.' + s)}" for s in SITE_CODES)],
        ['khn_service_desk.csv', 'assignment_group', 'FactServiceTicket', 'AssignmentGroup', 'Trim', 'Six governed values'],
        ['khn_service_desk.csv', 'channel', 'FactServiceTicket', 'Channel', 'Trim', 'Phone, Portal, Walk-up only'],
        ['khn_service_desk.csv', 'sla_target_hours', 'FactServiceTicket', 'SLATargetHours', 'P1 4; P2 8; P3 24; P4 72',
         f"{len(T['desk']['sla_target_mismatches'])} mismatches with priority"],
        ['khn_service_desk.csv', 'sla_met', 'FactServiceTicket', 'SLAMet',
         'Recompute from timestamps (DQ-08): Y or N; blank when the clock is still running, the priority is blank or the times are out of order',
         f"SLA Met % {F('desk.sla_met_pct', 'pct')} ({F('desk.sla_met_count')} of {F('desk.sla_evaluated')}); corrected {F('desk.sla_flag_corrections', 'list')}"],
        ['khn_service_desk.csv', 'reopened', 'FactServiceTicket', 'Reopened', 'Y or N', f"Reopened {F('desk.reopened_pct', 'pct')}"],
        ['khn_service_desk.csv', 'csat', 'FactServiceTicket', 'CSAT', 'Whole number 1 to 5; blank means no response',
         f"Average {F('desk.csat_average', 'n2')} from {F('desk.csat_responses')} responses"],
    ]
    write_csv('source-to-target.csv', ['source_file', 'source_column', 'target_table', 'target_column', 'rule',
                                       'reconciliation_check'], rows)


DAX_BLOCK = r'''```DAX
ED Visits =
COUNTROWS ( FactEDVisit )

Median Minutes to PIA =
MEDIANX (
    FILTER ( FactEDVisit, NOT ISBLANK ( FactEDVisit[MinutesToPIA] ) ),
    FactEDVisit[MinutesToPIA]
)

% PIA Within CTAS Target =
DIVIDE (
    COUNTROWS (
        FILTER (
            FactEDVisit,
            NOT ISBLANK ( FactEDVisit[MinutesToPIA] )
                && FactEDVisit[MinutesToPIA] <= RELATED ( DimCTAS[TargetMinutes] )
        )
    ),
    COUNTROWS (
        FILTER ( FactEDVisit, NOT ISBLANK ( FactEDVisit[MinutesToPIA] ) )
    )
)

LWBS Rate =
DIVIDE (
    CALCULATE ( [ED Visits], FactEDVisit[Disposition] = "LWBS" ),
    [ED Visits]
)

Median ED LOS Hours =
DIVIDE (
    MEDIANX (
        FILTER ( FactEDVisit, NOT ISBLANK ( FactEDVisit[EDLOSMinutes] ) ),
        FactEDVisit[EDLOSMinutes]
    ),
    60
)

Median ED LOS Hours Admitted =
CALCULATE ( [Median ED LOS Hours], FactEDVisit[Disposition] = "Admitted" )

Median ED LOS Hours Discharged =
CALCULATE ( [Median ED LOS Hours], FactEDVisit[Disposition] = "Discharged" )

Occupancy % (Average Daily) =
AVERAGEX (
    FILTER (
        VALUES ( DimDate[Date] ),
        CALCULATE ( SUM ( FactBedCensus[StaffedBeds] ) ) > 0
    ),
    DIVIDE (
        CALCULATE ( SUM ( FactBedCensus[OccupiedBeds] ) ),
        CALCULATE ( SUM ( FactBedCensus[StaffedBeds] ) )
    )
)

Occupancy % (Last Snapshot) =
VAR LastCensusDate =
    MAX ( FactBedCensus[CensusDate] )
RETURN
    CALCULATE (
        DIVIDE ( SUM ( FactBedCensus[OccupiedBeds] ), SUM ( FactBedCensus[StaffedBeds] ) ),
        DimDate[Date] = LastCensusDate
    )

ALC Days =
SUM ( FactBedCensus[ALCPatients] )

Tickets =
COUNTROWS ( FactServiceTicket )

SLA Met % =
DIVIDE (
    CALCULATE ( [Tickets], FactServiceTicket[SLAMet] = "Y" ),
    CALCULATE ( [Tickets], FactServiceTicket[SLAMet] IN { "Y", "N" } )
)

Median Access Request Days =
DIVIDE (
    CALCULATE (
        MEDIANX (
            FILTER ( FactServiceTicket, NOT ISBLANK ( FactServiceTicket[ResolutionHours] ) ),
            FactServiceTicket[ResolutionHours]
        ),
        FactServiceTicket[TicketType] = "Access request"
    ),
    24
)
```'''


def write_dax():
    L = ['# Kestrel DAX measure starters (Release 1 semantic model)', '',
         'All Kestrel data is synthetic. These measures use the exact table and column names in `source-to-target.csv`. '
         'Load the cleaned tables first (the rules are in `quality-and-reconciliation.md`), then create the measures in a measure table.', '',
         '## Model this code expects', '',
         'Star schema with single-direction, one-to-many relationships:', '',
         '- DimDate[Date] to FactEDVisit[ArrivalDate]',
         '- DimDate[Date] to FactBedCensus[CensusDate]',
         '- DimDate[Date] to FactServiceTicket[OpenedDate]',
         '- DimSite[SiteCode] to FactEDVisit[SiteCode]',
         '- DimSite[SiteCode] to FactServiceTicket[SiteCode]',
         '- DimSite[SiteCode] to DimUnit[SiteCode], then DimUnit[UnitID] to FactBedCensus[UnitID] (a site filter reaches the census through DimUnit)',
         '- DimCTAS[CTASLevel] to FactEDVisit[CTASLevel]', '',
         'Mark DimDate as the date table. MinutesToPIA and EDLOSMinutes are whole-number columns built in Power Query; '
         'they are null when the source timestamps are missing or out of order, so every measure below ignores those rows on purpose.', '',
         '## Measures', '', DAX_BLOCK, '',
         '## Why each measure is written this way', '',
         '- **ED Visits** counts rows in the cleaned fact table, so duplicates and quarantined rows are already gone.',
         '- **Median Minutes to PIA** uses MEDIANX over the visits that have a valid MinutesToPIA. LWBS visits have no PIA and drop out. '
         'Kestrel measures from arrival because registration happens at arrival; some organizations measure from triage, so always say which clock you used.',
         '- **% PIA Within CTAS Target** compares each visit with the target of its own CTAS level through RELATED, which works because FILTER iterates FactEDVisit rows on the many side of the DimCTAS relationship. '
         'CTAS 1 has a target of 0 minutes, so only a PIA in the same minute as arrival counts. The denominator is visits with a valid PIA (Kestrel rule); an LWBS visit is not counted as a miss.',
         '- **LWBS Rate** divides LWBS visits by all valid visits in the current filter.',
         '- **Median ED LOS Hours** takes the median in minutes and divides by 60. Use the Admitted and Discharged versions side by side: admitted patients wait for a bed, so their stay is far longer.',
         '- **Occupancy % (Average Daily)** is semi-additive. Beds add up across units on the same day, but not across days: 30 days of 32 staffed beds is not 960 beds. '
         'The measure works out occupancy for each day (occupied divided by staffed, summed across the units in the filter) and then averages those daily ratios. '
         'The FILTER skips dates with no census rows, such as calendar days after 30 September.',
         '- **Occupancy % (Last Snapshot)** answers "how full were we at the end of the period?" It finds the latest census date in the current filter and calculates occupancy for that date only. '
         'Use it on cards and for "as at" reporting. Use the average version for trends and period comparisons.',
         '- **ALC Days** is a plain SUM, and that is correct: one ALC patient in a bed for one day is one ALC patient-day, so adding daily counts gives patient-days, not patients.',
         '- **SLA Met %** divides tickets with SLAMet = "Y" by tickets with a known outcome (Y or N). Tickets still inside their target, tickets with no priority and tickets with impossible times are left out of both parts.',
         '- **Median Access Request Days** keeps only access requests and resolved tickets with valid times, takes the median of ResolutionHours, and divides by 24.', '',
         '## Expected results with no filters', '',
         'Check your model against these figures from `truth.json`. Power BI shows more decimals; round before comparing.', '',
         table(['Measure', 'Expected'], [
             ['ED Visits', F('ed.valid_visits')],
             ['Median Minutes to PIA', F('ed.median_min_to_pia', 'n1')],
             ['% PIA Within CTAS Target', F('ed.pct_pia_within_target', 'pct')],
             ['LWBS Rate', F('ed.lwbs_rate_pct', 'pct')],
             ['Median ED LOS Hours', F('ed.median_los_hours_all', 'n2')],
             ['Median ED LOS Hours Admitted', F('ed.median_los_hours_admitted', 'n2')],
             ['Median ED LOS Hours Discharged', F('ed.median_los_hours_discharged', 'n2')],
             ['Occupancy % (Average Daily)', F('beds.avg_daily_occupancy_pct', 'pct')],
             ['Occupancy % (Last Snapshot)', F('beds.last_snapshot_occupancy_pct', 'pct')],
             ['ALC Days', F('beds.alc_patient_days')],
             ['Tickets', F('desk.unique_tickets')],
             ['SLA Met %', F('desk.sla_met_pct', 'pct')],
             ['Median Access Request Days', F('desk.median_access_request_days', 'n2')],
         ]), '',
         '## Expected results by site', '',
         table(['Site', 'ED Visits', 'Median Minutes to PIA', '% PIA Within CTAS Target', 'LWBS Rate',
                'Median ED LOS Hours Admitted', 'Occupancy % (Average Daily)', 'Occupancy % (Last Snapshot)'],
               [[s, F('ed.visits_by_site.' + s), F('ed.median_min_to_pia_by_site.' + s, 'n1'),
                 F('ed.pct_pia_within_target_by_site.' + s, 'pct'), F('ed.lwbs_rate_pct_by_site.' + s, 'pct'),
                 F('ed.median_los_hours_admitted_by_site.' + s, 'n2'), F('beds.avg_daily_occupancy_pct_by_site.' + s, 'pct'),
                 F('beds.last_snapshot_occupancy_pct_by_site.' + s, 'pct')] for s in SITE_CODES]), '',
         '## Expected % PIA Within CTAS Target by CTAS level', '',
         table(['CTAS level', 'Target minutes', 'Visits with a valid PIA', 'Within target', '% PIA Within CTAS Target', 'Median Minutes to PIA'],
               [[c, CTAS_TARGET[c], F(f'ed.pia_n_by_ctas.{c}'), F(f'ed.pia_within_target_by_ctas.{c}'),
                 F(f'ed.pct_pia_within_target_by_ctas.{c}', 'pct'), F(f'ed.median_min_to_pia_by_ctas.{c}', 'n1')]
                for c in range(1, 6)]), '',
         'For every measure, record the business definition, owner, format, how blanks behave, the expected result and your reconciliation evidence.', '']
    write_text('dax-measure-starters.md', '\n'.join(L))


def write_itil():
    L = ['# Access-request value stream worksheet (ITIL Version 5)', '',
         'All Kestrel information is synthetic. Use this worksheet in Release 2 to map, measure and improve how a clinician gets access '
         'to the Clinical Information System (A-001), the Virtual Desktop Service (A-008) and the Beacon dashboards (A-009) through the service desk.', '',
         '## 1. The service and its value', '',
         '- Service: clinician access (joiner, mover, leaver and ad hoc access requests).',
         '- Service owner: Grace Liu (E-005), IT Service Desk Manager.',
         '- Consumers: new and moving clinicians, agency nurses supplied by ClearPath Staffing (V-03), vendor support staff such as Meridian Clinical Systems (V-01), and the managers who request access for them.',
         '- Other stakeholders: HR (Nora Lindqvist, E-018) as the source of joiner, mover and leaver events; the Chief Information Security Officer (Daniel Osei, E-004); the Chief Privacy Officer (Priya Raman, E-003).',
         '- Outcome the consumer wants: the right access on the first shift, and no access after the last one.',
         '- Utility (fit for purpose): ________________________________',
         '- Warranty (fit for use: availability, capacity, security, continuity): ________________________________',
         '- Costs and risks removed for the consumer: ________________________________',
         '- Costs and risks introduced (for example, approval steps, training before access): ________________________________', '',
         '### Baseline from khn_service_desk.csv (August and September 2026)', '',
         table(['Measure', 'Baseline'], [
             ['Access requests logged', F('desk.tickets_by_type.Access request')],
             ['Access requests resolved (used for the median)', F('desk.access_requests_resolved_n')],
             ['Median access request days', F('desk.median_access_request_days', 'n2')],
             ['Resolved within 3 days (72 hours)', F('desk.access_requests_within_3_days_pct', 'pct')],
             ['SLA met for access requests (recomputed)', F('desk.sla_met_pct_by_type.Access request', 'pct')],
         ]), '',
         'Related evidence: missed leavers in khn_identity.csv (' + F('identity.missed_leaver_ids', 'list') + ') and the access reviews still overdue on 2026-10-01 (' + F('reviews.overdue_ids', 'list') + ').', '',
         '## 2. Product and service lifecycle', '',
         'Record what each of the eight lifecycle stages means for the access service. Fill every cell; an empty cell is a gap to raise.', '',
         table(['Lifecycle stage', 'What to record for the access service', 'Owner', 'Output or evidence', 'Measure', 'Feedback to'],
               [['Discover', 'Demand and pain points: who waits for access, how long, and what it costs care', '', '', '', ''],
                ['Design', 'Role catalogue, approval rules, segregation-of-duties rules, request form', '', '', '', ''],
                ['Acquire', 'What you obtain from partners: tooling, vendor and agency agreements, HR data feed', '', '', '', ''],
                ['Build', 'Configured roles, workflows, HR integration, knowledge articles', '', '', '', ''],
                ['Transition', 'Testing, change approval, training, cut-over into live use', '', '', '', ''],
                ['Operate', 'Running the directory, the HR feed and provisioning jobs day to day', '', '', '', ''],
                ['Deliver', 'Fulfilling each request so the clinician has working access', '', '', '', ''],
                ['Support', 'Help when access fails: incidents, questions, password resets', '', '', '', '']]), '',
         '## 3. Four dimensions check', '',
         table(['Dimension', 'Question to answer', 'Kestrel answer'],
               [['Organizations and People', 'Who approves, who provisions, and is anyone doing both? (See Kevin Park, E-009.)', ''],
                ['Information and Technology', 'Which systems hold the truth for roles and status (A-015 HR, A-007 Identity Directory, A-011 IT Service Management Platform)?', ''],
                ['Partners and Suppliers', 'How do ClearPath Staffing (V-03) and Meridian Clinical Systems (V-01) tell you when a worker starts or leaves?', ''],
                ['Value Streams and Processes', 'Which steps add value for the clinician, and which only add waiting?', '']]), '',
         '## 4. Value-stream steps', '',
         'Walk one real request from trigger to working access. Time each step from tickets and interviews, not from memory.', '',
         table(['Step', 'Activity', 'Trigger or input', 'Role', 'Information and technology', 'Work time (h)', 'Wait time (h)',
                '% complete and accurate', 'Rework or failure', 'Value test'],
               [[1, 'Manager submits access request', 'New start, move or new duty', 'Unit manager', 'Portal form (A-011)', '', '', '', '', ''],
                [2, 'Service desk logs and checks the request', 'Ticket created', 'Service Desk Analyst', 'A-011', '', '', '', '', ''],
                [3, 'Confirm identity and employment', 'HR record', 'Service Desk Analyst', 'A-015 HR and Payroll System', '', '', '', '', ''],
                [4, 'Business owner approves clinical access', 'Approval task', 'System business owner', 'A-011 approval workflow', '', '', '', '', ''],
                [5, 'Confirm CIS training is complete', 'Training record', 'Clinical educator', 'Training records', '', '', '', '', ''],
                [6, 'Provision account and role', 'Approved ticket', 'Identity and Access', 'A-007 Identity Directory, A-001', '', '', '', '', ''],
                [7, 'Enrol MFA and issue credentials', 'Account created', 'Service Desk Analyst', 'A-007', '', '', '', '', ''],
                [8, 'Clinician signs in and tests access', 'Credentials received', 'Clinician', 'A-008 Virtual Desktop Service, A-001', '', '', '', '', ''],
                [9, 'Close ticket and confirm with requester', 'Access working', 'Service Desk Analyst', 'A-011', '', '', '', '', '']]), '',
         'Calculate for the whole stream:', '',
         '- Lead time = total work time + total wait time.',
         '- Flow efficiency = total work time / lead time.',
         '- Rolled % complete and accurate = the product of each step\'s % complete and accurate.',
         '- SLA attainment and median days, compared with the baseline above.', '',
         '## 5. Guiding principles check', '',
         table(['Guiding principle', 'How it applies to this value stream', 'Action'],
               [['Focus on value', 'Measure access ready for the first shift, not tickets closed', ''],
                ['Start where you are', 'Use the baseline above before redesigning', ''],
                ['Progress iteratively with feedback', 'Pilot with one unit (Medicine 4A) before all sites', ''],
                ['Collaborate and promote visibility', 'Show managers the queue and the wait at each step', ''],
                ['Think and work holistically', 'Joiners, movers and leavers are one stream, not three', ''],
                ['Keep it simple and practical', 'Remove approval steps that never reject anything', ''],
                ['Optimize and automate', 'Automate provisioning from HR events only after the steps are simple', '']]), '',
         '## 6. Continual improvement record', '',
         'ITIL 4 framed continual improvement as seven questions, and Version 5 refines that model. Use the questions as prompts:', '',
         '- What is the vision?',
         '- Where are we now? (baseline above)',
         '- Where do we want to be? (target median days and SLA met %)',
         '- How do we get there?',
         '- Take action: owner, due date, dependencies.',
         '- Did we get there? Measure and review date.',
         '- How do we keep the momentum going?', '']
    write_text('itil-value-stream-template.md', '\n'.join(L))


def write_security_template():
    L = ['# Beacon analytics security architecture worksheet', '',
         'All Kestrel information is synthetic. Use this worksheet in Release 1 to show how emergency and bed data travel from clinical systems '
         'to the Power BI service, where they cross trust boundaries, and which controls protect them. Owner: Daniel Osei (E-004), Chief Information Security Officer. '
         'Privacy review: Priya Raman (E-003), Chief Privacy Officer.', '',
         '## 1. Components', '',
         table(['Component', 'Asset', 'Business owner', 'Custodian', 'Hosting', 'Highest data classification held'],
               [['ED Tracking Board (source)', 'A-002', 'E-007', 'E-009', 'On premises', 'Restricted'],
                ['Bed Management System (source)', 'A-006', 'E-008', 'E-009', 'On premises', 'Restricted'],
                ['Clinical Information System (source of record)', 'A-001', 'E-001', 'E-009', 'On premises', 'Restricted'],
                ['Clinical Data Warehouse: staging and de-identified views', 'A-010', 'E-006', 'E-009', 'On premises', 'Restricted in staging; Confidential in views'],
                ['On-premises data gateway (part of the Beacon service)', 'A-009', 'E-008', 'E-006', 'On premises server', 'Confidential (passes data through)'],
                ['Power BI service and Beacon semantic model', 'A-009', 'E-008', 'E-006', 'Vendor hosted', 'Confidential'],
                ['Identity Directory (sign-in, groups, RLS membership)', 'A-007', 'E-002', 'E-009', 'On premises', 'Confidential'],
                ['Users: ED and patient-flow leaders, analysts, executives', '', '', '', 'Kestrel devices and mobile', 'Confidential (aggregated views)']]), '',
         '## 2. Data flows', '',
         table(['Flow', 'From', 'To', 'Data', 'Classification', 'Protection in transit', 'Notes'],
               [['F1', 'A-002', 'A-010 staging', 'Visit timestamps, CTAS, disposition', 'Restricted', '', ''],
                ['F2', 'A-006', 'A-010 staging', 'Daily bed census by unit', 'Restricted', '', ''],
                ['F3', 'A-010 staging', 'A-010 de-identified views', 'Pseudonymous visit IDs, age bands, no names or health numbers', 'Confidential', '', ''],
                ['F4', 'A-010 views', 'Gateway, then Power BI service', 'Scheduled refresh of the semantic model', 'Confidential', '', 'The gateway makes outbound connections only'],
                ['F5', 'Power BI service', 'Users', 'Dashboards filtered by RLS', 'Confidential', '', ''],
                ['F6', 'A-007', 'Power BI service', 'Sign-in and group membership for RLS', 'Confidential', '', ''],
                ['F7', 'Lumen Analytics Partners (V-05)', 'Power BI workspace', 'Build access during Release 1', 'Confidential', '', 'Time-limited']]), '',
         '## 3. Trust boundaries', '',
         table(['Boundary', 'Between', 'Flows crossing it', 'What must be true at the boundary'],
               [['TB1', 'Clinical systems zone and analytics zone', 'F1, F2', ''],
                ['TB2', 'Kestrel network and the Power BI cloud service', 'F4, F6', ''],
                ['TB3', 'Power BI service and user devices, inside or outside the network', 'F5', ''],
                ['TB4', 'Kestrel and third parties (V-05 build access; V-04 security log monitoring in the United States)', 'F7', '']]), '',
         '## 4. Classification and handling', '',
         '- Restricted (individually identifying health information) stays inside the warehouse staging area and never crosses TB2.',
         '- Confidential (de-identified, aggregated) is the highest class allowed in the semantic model. Apply the Confidential sensitivity label to the semantic model and reports.',
         '- Kestrel reporting rule: suppress counts under 5 in any report shared outside the care team. Prairie Gate Health Centre (PGH) has small counts, so test it first.', '',
         '## 5. Controls', '',
         table(['Control', 'Type', 'Where', 'Owner', 'Evidence', 'Status'],
               [['De-identification in warehouse views (no names, health numbers or exact birth dates)', 'Preventive', 'A-010', 'E-006', '', ''],
                ['Small-count suppression in shared reports', 'Preventive', 'A-009', 'E-006', '', ''],
                ['Row-level security by site, with membership from A-007 groups', 'Preventive', 'A-009', 'E-006', '', ''],
                ['Workspace roles: report readers get Viewer or app access only', 'Preventive', 'A-009', 'E-006', '', ''],
                ['Confidential sensitivity label on the semantic model and reports', 'Preventive', 'A-009', 'E-003', '', ''],
                ['Export to Excel and CSV limited to approved groups', 'Preventive', 'A-009', 'E-004', '', ''],
                ['Gateway service account with read-only access to the views', 'Preventive', 'Gateway, A-010', 'E-009', '', ''],
                ['MFA for all dashboard users (Release 2)', 'Preventive', 'A-007', 'E-004', '', ''],
                ['Audit and activity logs sent to the managed SOC', 'Detective', 'A-009, A-007', 'E-020', '', ''],
                ['Quarterly access review of workspace and RLS membership', 'Detective', 'A-009', 'E-005', '', ''],
                ['Restore of the semantic model and warehouse from backup', 'Corrective', 'A-010, A-012', 'E-016', '', '']]), '',
         '## 6. Misuse cases', '',
         'For each misuse case, name the STRIDE category (Spoofing, Tampering, Repudiation, Information disclosure, Denial of service, Elevation of privilege), the control that stops or detects it, and what is left.', '',
         table(['Misuse case', 'STRIDE', 'Control', 'Residual concern'],
               [['An analyst given the Member workspace role sees every site because RLS does not apply to people who can edit the content', '', '', ''],
                ['A user exports visit-level rows and emails them outside Kestrel', '', '', ''],
                ['Someone works out who a patient is from a count of 1 to 4 at PGH on a given night', '', '', ''],
                ['A stolen gateway credential is used to read warehouse staging tables', '', '', ''],
                ['A former agency nurse whose account was never disabled opens the dashboards', '', '', ''],
                ['Consultant (V-05) access stays active after the contract ends', '', '', ''],
                ['A scheduled refresh fails silently and leaders act on stale numbers', '', '', '']]), '',
         '## 7. Residual risk register', '',
         table(['Risk', 'Inherent rating', 'Controls applied', 'Residual rating', 'Owner', 'Decision (accept, treat, transfer, avoid)', 'Approved by and date'],
               [['', '', '', '', '', '', ''], ['', '', '', '', '', '', ''], ['', '', '', '', '', '', '']]), '',
         'Residual risk above Kestrel\'s appetite needs a documented decision by the accountable executive, advised by the Chief Information Security Officer (E-004). '
         'A privacy risk also needs the Chief Privacy Officer (E-003).', '',
         '## 8. Sign-off', '',
         '- Security architecture reviewed by: ______________ Date: __________',
         '- Privacy impact assessment reference: ______________',
         '- Business owner acceptance (Janelle Cardinal, E-008): ______________ Date: __________', '']
    write_text('security-architecture-template.md', '\n'.join(L))


def write_quality():
    T = TRUTH
    I = INJECTED
    ed, bd, rg, sc, dk, idt, pm, rv, sx, asx, ct, vd, sq = (T['ed'], T['beds'], T['register'], T['schedule'], T['desk'],
                                                          T['identity'], T['permissions'], T['reviews'], T['security'],
                                                          T['assets'], T['controls'], T['vendors'], T['sql_lab'])
    L = ['# Kestrel data-quality rules and approved reconciliation figures', '',
         'Everything in this pack is synthetic. Kestrel Health Network, its people, systems and vendors are fictional, no visit belongs to a real patient, and patients are never named.', '',
         'The script `generate.py` (seed 20261001) wrote every file, re-read it, and computed each figure on this page. The same figures are in `truth.json`. '
         'Unless a line says otherwise, every calculation uses the as-of date 2026-10-01.', '',
         'How to use this page: profile each file yourself first. Then compare your findings with the file checks below. Then build the model and compare your measures with the approved figures. '
         'If your number differs, find the rule you applied differently before you change anything.', '',
         '## Emergency department definitions', '',
         'Kestrel uses these definitions, which follow the Canadian Institute for Health Information (CIHI) approach. '
         'In this pack, PIA always means physician initial assessment.', '',
         '- The ED clock starts at arrival_datetime (registration). In every valid row triage_datetime is at or after arrival_datetime.',
         '- Time to PIA = pia_datetime minus arrival_datetime, in whole minutes.',
         '- ED length of stay (LOS) = departure_datetime minus arrival_datetime, for every disposition. For an admitted patient, departure is when the patient physically left the ED for a bed.',
         '- LWBS (left without being seen) = disposition LWBS: the patient left before a physician initial assessment, so an LWBS row has no pia_datetime.',
         '- % PIA within CTAS target uses the objectives CTAS 1 immediate (0 minutes), CTAS 2 within 15, CTAS 3 within 30, CTAS 4 within 60 and CTAS 5 within 120 minutes. '
         'A visit is within target when its time to PIA is at or under the objective, so a CTAS 1 visit counts only when its time to PIA is 0 minutes. '
         'CTAS 1 is also reported on its own row in the CTAS table below. The denominator is visits with a valid time to PIA; LWBS visits are not in it.', '',
         '## Kestrel data-quality rules', '',
         table(['Rule', 'What it says', 'Handling'], [
             ['DQ-01', 'Rows identical in every column are exact duplicates.', 'Keep the first copy, remove the rest, log the count.'],
             ['DQ-02', 'Business keys (visit_id, ticket_id, wp_id, record_id and so on) must be present and unique after DQ-01.', 'Same key with different content: quarantine both rows and ask the data owner.'],
             ['DQ-03', 'Codes and categories must match the governed list. Case and spaces do not change meaning.', 'Trim and map case-insensitively (kgh to KGH, hIGH to High). A value that still does not map is quarantined.'],
             ['DQ-04', 'Dates and date/times must be real calendar values in ISO form.', 'A bad value in a field that places the record in time (arrival, census date, opened) quarantines the row. A bad planning date is set to null and repaired from its authoritative source.'],
             ['DQ-05', 'Values must sit in their allowed range: CTAS 1 to 5, percentages 0 to 100, CVSS 0.0 to 10.0, counts and money 0 or more.', 'A bad classifying field (CTAS) quarantines the row. A bad measure is nulled, or corrected only with a recorded owner decision.'],
             ['DQ-06', 'Timestamps must follow a possible order (for example arrival, triage, PIA, departure).', 'Keep the record for counts. Null every duration that depends on the bad timestamps.'],
             ['DQ-07', 'Two fields must not contradict each other (an LWBS visit cannot have a PIA).', 'Quarantine: you cannot tell which field is wrong.'],
             ['DQ-08', 'Derived flags such as sla_met must agree with the data they come from.', 'Recompute the flag from the timestamps. Never trust a stored flag over the evidence.'],
             ['DQ-09', 'Snapshot tables need one row per unit per day.', 'Report missing snapshots; do not invent them. Never add snapshot values across days.'],
             ['DQ-10', 'Foreign keys must match a reference table.', 'Load against an Unknown member so the row stays visible, and send it to the owner.'],
             ['DQ-11', 'Unusual but possible values (occupied beds above staffed beds) are not errors.', 'Load them, flag them, and ask the owner to confirm.'],
             ['DQ-12', 'Identity rows are effective-dated: one current row per worker; Agency and Vendor rows need an end date.', 'Overlaps and missing end dates go to the HR Business Partner (E-018) for review.'],
             ['DQ-13', 'Quarantined rows are evidence.', 'Keep them in an exception table with the rule ID; never delete them.'],
             ['DQ-14', 'Kestrel reporting rule: suppress counts under 5 in any report shared outside the care team.', 'Applies to outputs, not to these reconciliation figures.'],
         ]), '',
         '## File checks', '',
         '### khn_sites.csv and khn_units.csv', '',
         f"- Sites: {F('files.khn_sites.rows')} rows, all codes unique. Units: {F('files.khn_units.rows')} rows, every unit maps to a site.",
         '- No deliberate problems. These are your reference tables for DQ-03 and DQ-10.', '',
         '### khn_ed_visits.csv', '',
         f"- Source rows: {F('ed.source_rows')}. Exact duplicate rows: {F('ed.exact_duplicate_rows')}. Unique rows: {F('ed.unique_rows')}. "
         f"Rows loaded to FactEDVisit: {F('ed.valid_visits')}. Rows quarantined: {F('ed.quarantined_count')}.", '',
         table(['Problem', 'Row IDs', 'Rule', 'Correct handling'], [
             ['Exact duplicate rows (the August and September extracts overlapped)', F('ed.duplicate_ids', 'list'), 'DQ-01', 'Remove the second copy of each.'],
             ['Site code in lower case ("kgh")', F('ed.lowercase_site_ids', 'list'), 'DQ-03', 'Convert to KGH and keep. Both visits count for KGH.'],
             ['CTAS level outside 1 to 5', ', '.join(f"{k} (ctas_level {v})" for k, v in sorted(ed['ctas_raw_values'].items())), 'DQ-05',
              'Quarantine. Ask the ED data owner, Dr. Sarah Whitford (E-007), to correct from the triage record.'],
             ['PIA before triage', I['ed']['pia_before_triage'], 'DQ-06', 'Keep in visit counts and LWBS rate. Null MinutesToPIA and EDLOSMinutes.'],
             ['PIA before arrival', I['ed']['pia_before_arrival'], 'DQ-06', 'Keep in visit counts and LWBS rate. Null MinutesToPIA and EDLOSMinutes.'],
             ['Departure missing for a visit that is not LWBS', F('ed.missing_departure_ids', 'list'), 'DQ-06', 'Keep in visit counts and PIA measures. Null EDLOSMinutes.'],
             ['Invalid date (2026-09-31 does not exist)', F('ed.quarantined.invalid_date', 'list'), 'DQ-04', 'Quarantine. The visit cannot be placed in time.'],
             ['LWBS visit with a PIA time (contradiction)', F('ed.quarantined.lwbs_with_pia', 'list'), 'DQ-07', 'Quarantine. Either the disposition or the PIA is wrong.'],
         ]), '',
         '### khn_bed_census.csv', '',
         f"- Source rows: {F('beds.source_rows')}. Expected unit-days: {F('beds.expected_unit_days')} (7 units by 92 days). Exact duplicates: {F('beds.exact_duplicate_rows')}. Rows loaded: {F('beds.loaded_rows')}.",
         '- This is a snapshot table. Beds are semi-additive: add across units on one day, never across days.', '',
         table(['Problem', 'Rows (unit_id and census_date)', 'Rule', 'Correct handling'], [
             ['Missing day for one unit', F('beds.missing_unit_days', 'list'), 'DQ-09', 'Report the gap and ask Janelle Cardinal (E-008) for the snapshot from the Bed Management System (A-006). Do not impute. Approved figures use the rows present, so ARH has one day with only ARH Medicine.'],
             ['Exact duplicate row', F('beds.duplicate_keys', 'list'), 'DQ-01', 'Remove the second copy.'],
             ['Occupied beds above staffed beds', F('beds.overcapacity_rows', 'list'), 'DQ-11', 'Review item, not an error: surge beds in a hallway are possible. Keep the row and set OverCapacityFlag.'],
             ['Negative ALC count', F('beds.negative_alc_rows', 'list'), 'DQ-05', 'Set ALCPatients to null for that row and keep its bed counts. Ask the unit to confirm the real value.'],
         ]), '',
         '### khn_programme_register.csv', '',
         f"- Source rows: {F('register.source_rows')}. Exact duplicates: {F('register.exact_duplicate_rows')} ({F('register.duplicate_ids', 'list')}). Unique work packages: {F('register.unique_rows')}.", '',
         table(['Problem', 'Row IDs', 'Rule', 'Correct handling'], [
             ['Exact duplicate', F('register.duplicate_ids', 'list'), 'DQ-01', 'Remove the second copy before any total.'],
             ['Negative budget', F('register.negative_budgets', 'list'), 'DQ-05', 'Finance confirmed a sign error, so the approved correction is the absolute value. Record the decision.'],
             ['Inconsistent status and risk casing', F('register.casing_fixes', 'list'), 'DQ-03', 'Map to Not started, In progress, Complete, On hold and Low, Medium, High.'],
             ['Missing owner', F('register.missing_owner_ids', 'list'), 'DQ-02', 'Keep the budget in totals. The sponsor assigns an owner; until then the work package has no accountable person.'],
             ['Invalid date', F('register.invalid_dates', 'list'), 'DQ-04', f"Set to null and repair from khn_schedule.csv: task 16 finishes on {F('injected.register_invalid_date_correct_value', 'str')}."],
             ['Percent complete over 100', F('register.pct_over_100', 'list'), 'DQ-05', 'The status is Complete, so cap at 100. Any other status would be quarantined until the owner confirms.'],
         ]), '',
         '### khn_schedule.csv', '',
         f"- Rows: {F('schedule.rows')} (row 1 is the programme summary, then {F('schedule.tasks_excluding_summary')} tasks). Milestones: {F('schedule.milestones', 'list')}.",
         '- No deliberate problems. Calendar: Monday to Friday, no holidays (a simplification; a real Kestrel plan would add statutory holidays). Links are finish-to-start with no lag.',
         '- Set the project start date to 2026-09-01 before you import. Only row 1 carries a Start date; every other date comes from the links.',
         '- Row 1 imports as an ordinary task. Indent rows 2 to 28 beneath it to make it a summary; its duration should then match the file.', '',
         '### khn_service_desk.csv', '',
         f"- Source rows: {F('desk.source_rows')}. Exact duplicates: {F('desk.exact_duplicate_rows')}. Unique tickets: {F('desk.unique_tickets')}. "
         f"Open at the extract (2026-10-01 00:00, blank resolved_at): {F('desk.open_at_extract')}; this is normal, not a problem.", '',
         table(['Problem', 'Row IDs', 'Rule', 'Correct handling'], [
             ['Exact duplicate', F('desk.duplicate_ids', 'list'), 'DQ-01', 'Remove the second copy.'],
             ['resolved_at before opened_at', F('desk.resolved_before_opened_ids', 'list'), 'DQ-06', 'Keep in ticket counts. Null ResolutionHours and leave SLAMet blank, so it is outside SLA Met %. Ask the service desk (E-005) to correct the time.'],
             ['Missing priority', F('desk.missing_priority_ids', 'list'), 'DQ-02', 'Keep in ticket counts. With no priority there is no target, so it is outside SLA Met % until the desk sets one.'],
             ['sla_met contradicts the times', F('desk.sla_flag_corrections', 'list'), 'DQ-08', 'Recompute every SLA flag from the timestamps; this one becomes N.'],
         ]), '',
         '### khn_identity.csv', '',
         f"- Source rows: {F('identity.source_rows')}. Distinct workers: {F('identity.distinct_employees')}. The current row for each worker is the row with the latest effective_from.", '',
         table(['Problem', 'Row IDs', 'Rule', 'Correct handling'], [
             ['Terminated worker whose account is still Enabled (missed leaver)', I['identity']['missed_leaver_terminated'], 'DQ-12', 'Disable the account today, remove permissions, check activity after the termination date, and ask HR (E-018) why the leaver event did not reach IT.'],
             ['Agency nurse past contract end still Enabled', I['identity']['agency_expired'], 'DQ-12', 'Disable the account and remove permissions. Agree with ClearPath Staffing (V-03) how end dates reach Kestrel.'],
             ['Mover with two overlapping current rows', F('identity.overlapping_assignment_ids', 'list'), 'DQ-12', f"Close the old {idt['mover_old_role']['E-028']} row with effective_to {F('identity.mover_old_row_close_date.E-028', 'str')} and remove the old role's permissions."],
             ['privileged value "Maybe"', F('identity.privileged_value_invalid', 'list'), 'DQ-03', 'Treat as unknown, not Yes or No. Check the account in the Identity Directory (A-007) and confirm with the manager (E-005).'],
             ['manager_id that does not exist', F('identity.orphan_manager_rows', 'list'), 'DQ-10', 'Load against an Unknown manager and ask HR to correct it. Reviews for this worker need a named reviewer meanwhile.'],
             ['Vendor account with no effective_to', F('identity.agency_vendor_without_end_ids', 'list'), 'DQ-12', 'Set an end date no later than the vendor contract end and have the business owner of the Clinical Information System (A-001, E-001) confirm it is still needed.'],
         ]), '',
         '### khn_role_permissions.csv and khn_user_permissions.csv', '',
         f"- Role permission rows: {F('permissions.role_permission_rows')} across {F('permissions.roles')} roles. User permission rows: {F('permissions.user_permission_rows')}.",
         '- An excess grant is a user permission that the worker\'s current role (from the latest identity row) does not include.',
         '- Kestrel segregation-of-duties rule: on the Identity Directory (A-007) no one may hold two or more of provision accounts, approve access and administer audit logs.', '',
         table(['Finding', 'Rows', 'Correct handling'], [
             ['Segregation-of-duties conflict', F('permissions.sod_conflicts', 'list'), 'Remove approve access and administer audit logs from E-009. Approval belongs to business owners; audit-log administration belongs to security (E-020).'],
             ['Excess grants', F('permissions.excess_grants', 'list'), 'Remove each one or record an approved exception. E-028 keeps old Unit Clerk access after the move.'],
             ['Self-granted permissions', F('permissions.self_granted', 'list'), 'A person must never approve their own access. Re-approve through E-004.'],
         ]), '',
         '### khn_access_reviews.csv', '',
         f"- Rows: {F('reviews.rows')}. Due by 2026-09-30: {F('reviews.due_by_as_of')}. Not yet due (due 2026-10-15): {F('reviews.not_yet_due')}.", '',
         table(['Problem', 'Row IDs', 'Correct handling'], [
             ['Review for an employee_id not in khn_identity.csv', F('reviews.orphan_employee_review_ids', 'list'), 'An account exists in the CIS for someone HR does not know. The Remove decision is right; confirm the account is gone and find out how it was created.'],
             ['Completed before it was assigned', F('reviews.completed_before_assigned_ids', 'list'), 'Not valid evidence. Treat as not completed and repeat the review.'],
             ['Overdue as of 2026-10-01 (due, not validly completed)', F('reviews.overdue_ids', 'list'), 'Escalate to each reviewer\'s manager.'],
             ['Reviewer reviewed their own access', F('reviews.self_review_ids', 'list'), 'Not independent. Re-review by E-004.'],
             ['Remove decision not carried out (account still Enabled)', F('reviews.remove_not_actioned', 'list'), 'A review only works if the decision is actioned. Disable the account.'],
         ]), '',
         '### khn_security_events.csv', '',
         f"- Source rows: {F('security.source_rows')}. Exact duplicates: {F('security.exact_duplicate_rows')}. Unique records: {F('security.unique_records')} "
         f"({F('security.unique_incidents')} incidents, {F('security.unique_vulnerabilities')} vulnerabilities).",
         '- Sequence rule for incidents: occurred_at, detected_at, contained_at, recovered_at must not go backwards. opened_at may fall before or after detection, because a person can report something before the SOC confirms it.', '',
         table(['Problem', 'Row IDs', 'Rule', 'Correct handling'], [
             ['Duplicate incident row', F('security.duplicate_ids', 'list'), 'DQ-01', 'Remove the second copy.'],
             ['contained_at before detected_at (impossible sequence)', F('security.impossible_sequence_ids', 'list'), 'DQ-06', 'Keep in incident counts; leave out of MTTD, MTTC and MTTR. Ask the SOC liaison (E-020) for the true times.'],
             ['CVSS score above 10.0', F('security.cvss_out_of_range', 'list'), 'DQ-05', 'Not a valid vulnerability record until rescored. Keep it on the open-risk list: a Critical remote code execution finding must not disappear because its score is wrong.'],
             ['asset_id not in khn_assets.csv', F('security.orphan_asset_rows', 'list'), 'DQ-10', 'Load against an Unknown asset. An unregistered system is itself a finding for the asset owner.'],
             ['Severity in odd casing', F('security.severity_casing_fixes', 'list'), 'DQ-03', 'Map to High.'],
             ['Opened before detected (allowed, not an error)', F('security.opened_before_detected_ids', 'list'), '', 'No action.'],
         ]), '',
         '### khn_assets.csv', '',
         f"- Source rows: {F('assets.source_rows')}. Exact duplicates: {F('assets.exact_duplicate_rows')}. Unique systems: {F('assets.unique_assets')}.", '',
         table(['Problem', 'Row IDs', 'Correct handling'], [
             ['Exact duplicate', F('assets.duplicate_ids', 'list'), 'Remove the second copy.'],
             ['Missing business owner', F('assets.missing_owner_ids', 'list'), 'A tier 1 system with no accountable owner. Escalate to the sponsor (E-001) to name one.'],
             ['End of support already passed', F('assets.end_of_support_passed', 'list'), 'Unsupported tier 1 system. Raise a risk, plan replacement, and add compensating controls (see SEC-015).'],
             ['Review item: vendor-hosted with no vendor_id', 'A-009', 'The Power BI service is software as a service outside the Beacon vendor list. Record its provider in the vendor register.'],
         ]), '',
         '### khn_controls.csv', '',
         f"- Rows: {F('controls.rows')}. Well-formed: no duplicates or bad values. Status counts: Pass {F('controls.status_counts.Pass')}, Fail {F('controls.status_counts.Fail')}, Not tested {F('controls.status_counts.Not tested')}.", '',
         '### khn_vendors.csv', '',
         f"- Rows: {F('vendors.rows')}. No data errors; findings are listed in the approved figures below.", '',
         '### khn_lab.sql', '',
         f"- Tables: {', '.join(f'{k} {F(chr(115) + 'ql_lab.row_counts.' + k)}' for k in sq['row_counts'])} rows.",
         f"- Orphans by design: staff manager {F('identity.orphan_manager_rows', 'list')}; security event asset {F('security.orphan_asset_rows', 'list')}; "
         f"service ticket {F('sql_lab.orphan_ticket', 'str')} keyed with site_code PGC in the lab copy only.", '',
         '## Approved reconciliation figures', '',
         '### Emergency department (FactEDVisit)', '',
         'Cleaning rule: remove exact duplicates; upper-case site codes; quarantine rows with an invalid date, a CTAS level outside 1 to 5, or LWBS with a PIA. '
         'Minutes to PIA run from arrival_datetime to pia_datetime. Rows with out-of-order timestamps stay in counts but are left out of time measures; the row with no departure is left out of LOS only.', '',
         f"- Valid visits: {F('ed.valid_visits')} (from {F('ed.source_rows')} source rows, less {F('ed.exact_duplicate_rows')} duplicates and {F('ed.quarantined_count')} quarantined).",
         f"- LWBS: {F('ed.lwbs_count')} visits, LWBS rate {F('ed.lwbs_rate_pct', 'pct')} of valid visits.",
         f"- Median minutes to PIA: {F('ed.median_min_to_pia', 'n1')} across {F('ed.pia_n')} visits with a valid PIA.",
         f"- % PIA within CTAS target: {F('ed.pct_pia_within_target', 'pct')} ({F('ed.pia_within_target_count')} of {F('ed.pia_n')}). Targets: CTAS 1 immediate (0 minutes), 2 within 15, 3 within 30, 4 within 60, 5 within 120.",
         f"- Median ED LOS: admitted {F('ed.median_los_hours_admitted', 'n2')} hours (n = {F('ed.los_n_admitted')}); discharged {F('ed.median_los_hours_discharged', 'n2')} hours (n = {F('ed.los_n_discharged')}); "
         f"transferred {F('ed.median_los_hours_transferred', 'n2')} hours (n = {F('ed.los_n_transferred')}); all visits with a valid LOS {F('ed.median_los_hours_all', 'n2')} hours (n = {F('ed.los_n')}).",
         f"- Evening arrivals (17:00 to 23:59): {F('ed.evening_share_pct', 'pct')} of valid visits.", '',
         table(['Site', 'Valid visits', 'LWBS rate', 'Median minutes to PIA', '% PIA within target', 'Median LOS admitted (h)', 'Median LOS discharged (h)'],
               [[s, F('ed.visits_by_site.' + s), F('ed.lwbs_rate_pct_by_site.' + s, 'pct'), F('ed.median_min_to_pia_by_site.' + s, 'n1'),
                 F('ed.pct_pia_within_target_by_site.' + s, 'pct'), F('ed.median_los_hours_admitted_by_site.' + s, 'n2'),
                 F('ed.median_los_hours_discharged_by_site.' + s, 'n2')] for s in SITE_CODES]), '',
         table(['CTAS level', 'Valid visits', 'Visits with valid PIA', 'Within target', '% within target', 'Median minutes to PIA'],
               [[c, F(f'ed.visits_by_ctas.{c}'), F(f'ed.pia_n_by_ctas.{c}'), F(f'ed.pia_within_target_by_ctas.{c}'),
                 F(f'ed.pct_pia_within_target_by_ctas.{c}', 'pct'), F(f'ed.median_min_to_pia_by_ctas.{c}', 'n1')] for c in range(1, 6)]), '',
         '### Bed census (FactBedCensus)', '',
         'Cleaning rule: remove the exact duplicate; keep the overcapacity row; set the negative ALC value to null; do not impute the missing unit-day. '
         'Average daily occupancy = for each census date, occupied beds divided by staffed beds summed across the units in scope, then the average of those daily ratios.', '',
         f"- Average daily occupancy, all units: {F('beds.avg_daily_occupancy_pct', 'pct')}.",
         f"- Last snapshot ({F('beds.last_census_date', 'str')}): {F('beds.last_snapshot_occupied_beds')} occupied of {F('beds.last_snapshot_staffed_beds')} staffed, {F('beds.last_snapshot_occupancy_pct', 'pct')}.",
         f"- ALC patient-days (sum of alc_patients over all loaded rows, negative value excluded): {F('beds.alc_patient_days')}, which is {F('beds.alc_share_of_occupied_bed_days_pct', 'pct')} of occupied bed-days on the same rows.",
         f"- The semi-additive trap: adding staffed_beds over every row gives {F('beds.sum_staffed_beds_all_rows')}. That is staffed bed-days, not beds. Kestrel has {F('beds.last_snapshot_staffed_beds')} staffed beds on the last date.",
         f"- Ratio of sums (total occupied bed-days divided by total staffed bed-days): {F('beds.ratio_of_sums_occupancy_pct', 'pct')}. It weights busy days with more beds more heavily, so it differs slightly from the average of daily ratios. Kestrel reports the average of daily ratios.", '',
         table(['Site', 'Average daily occupancy', f"Occupancy on {bd['last_census_date']}", f"Staffed beds on {bd['last_census_date']}", 'ALC patient-days'],
               [[s, F('beds.avg_daily_occupancy_pct_by_site.' + s, 'pct'), F('beds.last_snapshot_occupancy_pct_by_site.' + s, 'pct'),
                 F('beds.last_snapshot_staffed_beds_by_site.' + s), F('beds.alc_patient_days_by_site.' + s)] for s in SITE_CODES]), '',
         table(['Unit', 'Average daily occupancy'], [[u, F('beds.avg_daily_occupancy_pct_by_unit.' + u, 'pct')] for u in UNIT_IDS]), '',
         '### Programme budget and earned value (khn_programme_register.csv, as of 2026-10-01)', '',
         'Cleaning rule: remove the duplicate; use the absolute value of the negative budget (confirmed sign error); cap the over-100 percent at 100 because the work package is Complete. '
         'PV = budget x planned_pct_as_of. EV = budget x pct_complete. AC = actual_cost_cad. CPI = EV / AC. SPI = EV / PV. EAC = BAC / CPI (unrounded CPI).', '',
         f"- Budget at completion (BAC), approved: {F('register.bac_approved_cad', 'cad')}. By release: "
         + '; '.join(f"Release {k} {F('register.bac_by_release_cad.' + k, 'cad')}" for k in rg['bac_by_release_cad']) + '.',
         f"- Management reserve, held by the sponsor outside the register: {F('register.management_reserve_cad', 'cad')}. Total authorized funding: {F('register.total_budget_with_reserve_cad', 'cad')}.",
         f"- Common wrong totals: summing every source row gives {F('register.bac_sum_as_loaded_no_cleaning', 'cad')}; removing only the duplicate gives {F('register.bac_sum_after_dedup_before_sign_fix', 'cad')}.",
         f"- Planned value (PV): {F('register.pv_cad', 'cad')}. Earned value (EV): {F('register.ev_cad', 'cad')}. Actual cost (AC): {F('register.ac_cad', 'cad')}.",
         f"- Cost variance (EV minus AC): {F('register.cv_cad', 'cad')}. Schedule variance (EV minus PV): {F('register.sv_cad', 'cad')}.",
         f"- CPI: {F('register.cpi', 'n2')}. SPI: {F('register.spi', 'n2')}. EAC: {F('register.eac_cad', 'cad')}. Variance at completion (BAC minus EAC): {F('register.vac_cad', 'cad')}.",
         f"- Release 1 only: PV {F('register.release1_pv_cad', 'cad')}, EV {F('register.release1_ev_cad', 'cad')}, AC {F('register.release1_ac_cad', 'cad')}, CPI {F('register.release1_cpi', 'n2')}, SPI {F('register.release1_spi', 'n2')}.", '',
         '### Schedule (khn_schedule.csv)', '',
         'Rule: forward and backward pass on a Monday to Friday calendar, finish-to-start links, row 1 excluded from the network. Total float = late start minus early start, in working days.', '',
         f"- Programme start {F('schedule.programme_start', 'str')}, finish {F('schedule.programme_finish', 'str')}, {F('schedule.working_days')} working days (row 1 duration {F('schedule.summary_duration_computed', 'str')}).",
         f"- Gates from the forward pass: Release 1 go-live {F('schedule.gate_release1', 'str')}; Release 2 acceptance {F('schedule.gate_release2', 'str')}; programme acceptance {F('schedule.gate_programme', 'str')}.",
         f"- Critical path (task IDs): {F('schedule.critical_path', 'str')}.",
         f"- Largest float: {F('schedule.max_total_float_days')} working days.", '',
         table(['ID', 'Task', 'Duration', 'Early start', 'Early finish', 'Late start', 'Late finish', 'Total float', 'Free float'],
               [[k, v['name'], f"{v['duration_days']}d", F(f'schedule.tasks.{k}.early_start', 'str'), F(f'schedule.tasks.{k}.early_finish', 'str'),
                 F(f'schedule.tasks.{k}.late_start', 'str'), F(f'schedule.tasks.{k}.late_finish', 'str'),
                 F(f'schedule.tasks.{k}.total_float_days'), F(f'schedule.tasks.{k}.free_float_days')] for k, v in sc['tasks'].items()]), '',
         '### Service desk (FactServiceTicket)', '',
         'Cleaning rule: remove the duplicate; recompute every SLA flag from the timestamps (resolved: Y if resolution hours are at or under the target; open at the extract: N if the target has already passed, otherwise blank); '
         'leave the reversed-time ticket and the no-priority ticket out of SLA and duration measures. SLA Met % = Y / (Y + N).', '',
         f"- Unique tickets: {F('desk.unique_tickets')}. By type: " + '; '.join(f"{k} {F('desk.tickets_by_type.' + k)}" for k in dk['tickets_by_type']) + '.',
         f"- SLA met: {F('desk.sla_met_pct', 'pct')} ({F('desk.sla_met_count')} of {F('desk.sla_evaluated')} with a known outcome; {F('desk.sla_pending')} still inside target at the extract). By type: "
         + '; '.join(f"{k} {F('desk.sla_met_pct_by_type.' + k, 'pct')}" for k in dk['sla_met_pct_by_type']) + '.',
         '- SLA met by priority: ' + '; '.join(f"{k} {F('desk.sla_met_pct_by_priority.' + k, 'pct')}" for k in dk['sla_met_pct_by_priority']) + '.',
         f"- Median access-request days: {F('desk.median_access_request_days', 'n2')} (resolved access requests, n = {F('desk.access_requests_resolved_n')}). Only {F('desk.access_requests_within_3_days_pct', 'pct')} were resolved within 72 hours.",
         '- Median resolution hours by type: ' + '; '.join(f"{k} {F('desk.median_resolution_hours_by_type.' + k, 'n1')}" for k in dk['median_resolution_hours_by_type']) + '.',
         f"- Reopened: {F('desk.reopened_pct', 'pct')}. Average CSAT: {F('desk.csat_average', 'n2')} from {F('desk.csat_responses')} responses.", '',
         '### Identity and access (as of 2026-10-01)', '',
         'Rule: use each worker\'s latest row. A missed leaver is an Enabled account whose hr_status is Terminated or whose effective_to is before 2026-10-01.', '',
         f"- Enabled accounts: {F('identity.enabled_accounts')}. Disabled: {F('identity.disabled_accounts')}. Workers by type: "
         + '; '.join(f"{k} {F('identity.workers_by_type.' + k)}" for k in idt['workers_by_type']) + '.',
         f"- Missed leavers: {F('identity.missed_leavers')} ({F('identity.missed_leaver_ids', 'list')}).",
         f"- Enabled privileged accounts (privileged = Yes): {F('identity.privileged_enabled')} ({F('identity.privileged_enabled_ids', 'list')}). One more value is unknown: {F('identity.privileged_value_invalid', 'list')}.",
         f"- Privileged accounts without MFA: {F('identity.privileged_without_mfa')} ({F('identity.privileged_without_mfa_ids', 'list')}); privileged MFA coverage {F('identity.privileged_mfa_pct', 'pct')}.",
         f"- All enabled accounts without MFA: {F('identity.enabled_without_mfa')}; MFA coverage {F('identity.enabled_mfa_pct', 'pct')}.",
         f"- Excess permission grants: {F('permissions.excess_grant_count')}. Segregation-of-duties conflicts: {F('permissions.sod_conflict_count')}. Share of user permissions granted by E-009: {F('permissions.granted_by_e009_pct', 'pct')}.",
         f"- Q3 access reviews: {F('reviews.completed_valid')} of {F('reviews.rows')} validly completed ({F('reviews.completion_pct_all', 'pct')}). "
         f"Of the {F('reviews.due_by_as_of')} due by 2026-09-30, {F('reviews.completed_valid_of_due')} were done ({F('reviews.completion_pct_of_due', 'pct')}) and {F('reviews.overdue')} are overdue.", '',
         '### Security operations (khn_security_events.csv)', '',
         'Rule: remove the duplicate. MTTD = mean of detected_at minus occurred_at. MTTC = mean of contained_at minus detected_at. MTTR = mean of recovered_at minus detected_at. '
         'All in hours, over incidents with a possible sequence; MTTR uses only recovered incidents.', '',
         f"- Unique incidents: {F('security.unique_incidents')}; valid for time measures: {F('security.valid_incidents_for_timing')}. Unique vulnerabilities: {F('security.unique_vulnerabilities')}; valid: {F('security.valid_vulnerabilities')}.",
         f"- MTTD {F('security.mttd_hours', 'n2')} hours (n = {F('security.mttd_n')}); MTTC {F('security.mttc_hours', 'n2')} hours (n = {F('security.mttc_n')}); MTTR {F('security.mttr_hours', 'n2')} hours (n = {F('security.mttr_n')}).",
         f"- Not yet recovered: {F('security.incidents_not_recovered_ids', 'list')}.",
         f"- Open vulnerabilities: {F('security.open_vulnerabilities')}. Past remediation_due on 2026-10-01: {F('security.overdue_vulnerabilities')} ({F('security.overdue_vulnerability_ids', 'list')}). "
         'Remediation policy from detection: Critical 7 days, High 30, Medium 60, Low 90.', '',
         '### Assets, recovery and controls', '',
         f"- Unique systems: {F('assets.unique_assets')}. Tier 1: {F('assets.tier_counts.1')}; tier 2: {F('assets.tier_counts.2')}; tier 3: {F('assets.tier_counts.3')}.",
         '- Restore tests against RTO (Pass when restore_hours is at or under rto_target_hours): ' + F('controls.restore_tests', 'list') + '.',
         f"- The CIS (A-001) has failed {F('controls.cis_restore_tests_failed')} restore tests. Its last test was {F('controls.cis_last_restore_test_date', 'str')} "
         f"({F('controls.cis_days_since_last_restore_test')} days before 2026-10-01) and took {F('controls.cis_last_restore_hours', 'n1')} hours against a 4-hour RTO.",
         f"- Awareness training groups below the {TRAINING_TARGET_PCT}% target: {F('controls.training_below_target', 'list')}.", '',
         '### Vendors', '',
         f"- Data held or processed outside Canada: {F('vendors.data_outside_canada', 'list')}; needs privacy review.",
         f"- No assurance report on file: {F('vendors.no_assurance_report', 'list')}.",
         f"- Assurance report older than 12 months on 2026-10-01: {F('vendors.assurance_older_than_12_months', 'list')}.",
         f"- Contracts ending within 90 days: {F('vendors.contracts_ending_within_90_days', 'list')}.", '',
         '### SQL lab (khn_lab.sql)', '',
         'The four reconciliation queries and their exact results are written as comments at the end of `khn_lab.sql`. Summary:', '']
    for qid in ('Q1', 'Q2', 'Q3', 'Q4'):
        rows_ = sq['results'][qid]['rows']
        L.append(f"- {qid} {sq['results'][qid]['title']}: " + '; '.join(' | '.join(str(v) for v in r) for r in rows_) + '.')
    L.append('')
    write_text('quality-and-reconciliation.md', '\n'.join(L))


# =========================================================================== self-check
BANNED = ['delve', 'delves', 'delving', 'tapestry', 'landscape', 'landscapes', 'spearhead', 'spearheaded', 'seamless',
          'seamlessly', 'navigating', 'fostering', 'foster', 'comprehensive', 'comprehensively', 'transformative',
          'pivotal', 'successfully', 'effectively', 'carefully', 'strategically', 'proactively']
ITIL4 = ['design and transition', 'obtain/build', 'obtain or build', 'deliver and support', 'service value chain']


def self_check():
    problems = []
    csvs = sorted(f for f in os.listdir(OUT) if f.endswith('.csv'))
    counts = {}
    for f in csvs:
        with open(os.path.join(OUT, f), newline='', encoding='utf-8') as fh:
            data = list(csv.reader(fh))
        n = len(data[0])
        bad = [i + 2 for i, r in enumerate(data[1:]) if len(r) != n]
        if bad:
            problems.append(f'{f}: rows with wrong field count at lines {bad[:5]}')
        counts[f] = len(data) - 1
    # every ID mentioned in prose must exist in a data file
    cells = set()
    for f in csvs:
        if f in ('data-dictionary.csv', 'source-to-target.csv'):
            continue
        with open(os.path.join(OUT, f), newline='', encoding='utf-8') as fh:
            for r in csv.reader(fh):
                for c in r:
                    cells.add(c)
                    for part in re.split(r'[;,]', c):
                        cells.add(part.strip())
    pat = re.compile(r'\b(V\d{4}|SD-\d{5}|WP-\d{3}|E-\d{3}|A-\d{3}|V-\d{2}|SEC-\d{3}|AR-\d{3}|CT-\d{3}|'
                     r'(?:KGH|ARH|CVH|PGH)-[A-Z0-9]+)\b')
    prose = [f for f in os.listdir(OUT) if f.endswith('.md')] + ['source-to-target.csv', 'data-dictionary.csv', 'khn_lab.sql']
    for f in prose:
        text = open(os.path.join(OUT, f), encoding='utf-8').read()
        for m in set(pat.findall(text)):
            if m not in cells:
                problems.append(f'{f}: ID {m} not found in any data file')
    # figures equal truth.json
    tj = json.load(open(os.path.join(OUT, 'truth.json'), encoding='utf-8'))
    texts = {f: open(os.path.join(OUT, f), encoding='utf-8').read() for f in prose}
    alltext = '\n'.join(texts.values())
    for path, kind, shown in REG:
        if fmt(getp(tj, path), kind) != shown:
            problems.append(f'figure {path}: shown {shown!r}, truth.json {fmt(getp(tj, path), kind)!r}')
        if shown not in alltext:
            problems.append(f'figure {path} ({shown!r}) not found in any document')
    q = texts['quality-and-reconciliation.md']
    if '`truth.json`' not in q:
        problems.append('quality md does not point to truth.json')
    # injected problems must equal detected problems
    T = tj
    I = INJECTED
    checks = [
        (T['ed']['duplicate_ids'], I['ed']['duplicates']),
        (T['ed']['lowercase_site_ids'], I['ed']['lowercase']),
        (T['ed']['quarantined']['ctas_out_of_range'], I['ed']['ctas']),
        (T['ed']['quarantined']['invalid_date'], [I['ed']['invalid_date']]),
        (T['ed']['quarantined']['lwbs_with_pia'], [I['ed']['lwbs_with_pia']]),
        (T['ed']['timing_invalid_ids'], sorted([I['ed']['pia_before_triage'], I['ed']['pia_before_arrival']])),
        (T['ed']['missing_departure_ids'], [I['ed']['missing_departure']]),
        (T['ed']['quarantined']['other'], []),
        (T['beds']['missing_unit_days'], [' '.join(I['beds']['missing'])]),
        (T['beds']['duplicate_keys'], [' '.join(I['beds']['duplicate'])]),
        (len(T['beds']['overcapacity_rows']), 1), (len(T['beds']['negative_alc_rows']), 1),
        (T['register']['duplicate_ids'], [I['register']['duplicate']]),
        (T['register']['missing_owner_ids'], [I['register']['missing_owner']]),
        (len(T['register']['casing_fixes']), 4), (len(T['register']['invalid_dates']), 1),
        (len(T['register']['negative_budgets']), 1), (len(T['register']['pct_over_100']), 1),
        (T['desk']['duplicate_ids'], [I['desk']['duplicate']]),
        (T['desk']['resolved_before_opened_ids'], [I['desk']['resolved_before_opened']]),
        (T['desk']['missing_priority_ids'], [I['desk']['missing_priority']]),
        ([s.split()[0] for s in T['desk']['sla_flag_corrections']], [I['desk']['sla_contradiction']]),
        (T['desk']['sla_target_mismatches'], []),
        (T['identity']['missed_leaver_ids'], sorted(['E-014', 'E-027'])),
        (T['identity']['overlapping_assignment_ids'], ['E-028']),
        (T['identity']['agency_vendor_without_end_ids'], ['E-015']),
        (T['permissions']['sod_conflict_count'], 1),
        (T['reviews']['orphan_employee_review_ids'], ['AR-018']),
        (T['reviews']['completed_before_assigned_ids'], ['AR-006']),
        (T['security']['duplicate_ids'], ['SEC-005']),
        (T['security']['impossible_sequence_ids'], ['SEC-008']),
        (len(T['security']['cvss_out_of_range']), 1), (len(T['security']['orphan_asset_rows']), 1),
        (len(T['security']['severity_casing_fixes']), 1),
        (T['assets']['duplicate_ids'], ['A-008']), (T['assets']['missing_owner_ids'], ['A-005']),
        (T['controls']['restore_status_inconsistent'], []), (T['controls']['training_status_inconsistent'], []),
        (T['register']['bac_approved_cad'], 1200000),
        (T['schedule']['summary_duration_in_file'], T['schedule']['summary_duration_computed']),
        (T['schedule']['milestone_flags_consistent'], True),
        ([T['schedule']['gate_release1'], T['schedule']['gate_release2'], T['schedule']['gate_programme']],
         [fd(GATES[12]), fd(GATES[20]), fd(GATES[28])]),
    ]
    for i, (got, want) in enumerate(checks):
        if got != want:
            problems.append(f'injected-vs-detected check {i}: got {got!r}, want {want!r}')
    # style of the markdown files
    for f in [x for x in os.listdir(OUT) if x.endswith('.md')]:
        text = texts[f]
        if '—' in text:
            problems.append(f'{f}: em dash')
        for m in re.finditer('–', text):
            if not (text[m.start() - 1].isdigit() and text[m.end()].isdigit()):
                problems.append(f'{f}: en dash used as a dash')
        for w in BANNED:
            if re.search(r'\b' + w + r'\b', text, re.I):
                problems.append(f'{f}: banned word {w}')
        for w in ITIL4:
            if w in text.lower():
                problems.append(f'{f}: ITIL 4 value chain term "{w}"')
    for f in ('source-to-target.csv', 'data-dictionary.csv'):
        for w in BANNED:
            if re.search(r'\b' + w + r'\b', texts[f], re.I):
                problems.append(f'{f}: banned word {w}')
        if '—' in texts[f]:
            problems.append(f'{f}: em dash')
    lifecycle = ['Discover', 'Design', 'Acquire', 'Build', 'Transition', 'Operate', 'Deliver', 'Support']
    itil = texts['itil-value-stream-template.md']
    for s in lifecycle + ['Organizations and People', 'Information and Technology', 'Partners and Suppliers',
                          'Value Streams and Processes']:
        if f'| {s} |' not in itil:
            problems.append(f'itil template missing row {s}')
    # SQL file runs
    con = sqlite3.connect(':memory:')
    con.executescript(open(os.path.join(OUT, 'khn_lab.sql'), encoding='utf-8').read())
    con.close()
    return problems, counts


# =========================================================================== main
def main():
    gen_sites_units()
    gen_ed()
    gen_beds()
    gen_schedule()
    gen_register()
    gen_desk()
    gen_identity()
    gen_permissions()
    gen_reviews()
    gen_assets()
    gen_security()
    gen_vendors()

    TRUTH['meta'] = {'seed': SEED, 'as_of': fd(AS_OF), 'baseline_period': '2026-07-01 to 2026-09-30',
                     'note': 'All figures computed by generate.py from the CSV files it wrote. Synthetic data.'}
    TRUTH['ed'] = compute_ed()
    TRUTH['beds'] = compute_beds()
    TRUTH['register'] = compute_register()
    TRUTH['schedule'] = compute_schedule()
    TRUTH['desk'] = compute_desk()
    TRUTH['identity'], latest = compute_identity()
    TRUTH['permissions'] = compute_permissions(latest)
    TRUTH['reviews'] = compute_reviews(latest)
    TRUTH['assets'], asset_ids = compute_assets(set(latest))
    TRUTH['security'] = compute_security(asset_ids)
    TRUTH['vendors'] = compute_vendors()
    gen_controls(TRUTH['identity'], TRUTH['reviews'])
    TRUTH['controls'] = compute_controls()
    TRUTH['sql_lab'] = gen_sql(latest)
    TRUTH['injected'] = {'register_invalid_date_correct_value': INJECTED['register']['invalid_date_correct_value']}
    TRUTH['dims'] = {'dim_site_rows': len(read_rows('khn_sites.csv')[1]), 'dim_unit_rows': len(read_rows('khn_units.csv')[1]),
                     'dim_unit_unmatched_sites': sum(1 for r in read_rows('khn_units.csv')[1] if r[1] not in SITE_CODES),
                     'dim_date_rows': (date(2026, 12, 31) - date(2026, 1, 1)).days + 1, 'dim_ctas_rows': len(CTAS_REF)}
    files = {}
    for f in sorted(os.listdir(OUT)):
        if f.endswith('.csv'):
            h, r = read_rows(f)
            files[f[:-4]] = {'rows': len(r), 'columns': len(h)}
    TRUTH['files'] = files

    write_data_dictionary()
    write_source_to_target(TRUTH['ed'], TRUTH['beds'], TRUTH['desk'])
    write_dax()
    write_itil()
    write_security_template()
    write_quality()
    # refresh file row counts now that every CSV exists
    for f in sorted(os.listdir(OUT)):
        if f.endswith('.csv'):
            h, r = read_rows(f)
            TRUTH['files'][f[:-4]] = {'rows': len(r), 'columns': len(h)}
    with open(os.path.join(OUT, 'truth.json'), 'w', encoding='utf-8') as fh:
        json.dump(TRUTH, fh, ensure_ascii=False, indent=1, default=str)

    problems, counts = self_check()
    print('Files written to', OUT)
    for f in sorted(os.listdir(OUT)):
        p = os.path.join(OUT, f)
        extra = f'  {counts[f]} data rows' if f in counts else ''
        print(f'  {f:40s} {os.path.getsize(p):>8,d} bytes{extra}')
    print(f'Figures cross-checked: {len(REG)}')
    if problems:
        print('SELF-CHECK FAILED')
        for p in problems:
            print('  -', p)
        sys.exit(1)
    print('SELF-CHECK OK')


if __name__ == '__main__':
    main()
