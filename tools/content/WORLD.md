# The Kestrel Health world (single source of truth for every writer)

Everything here is fictional. Kestrel Health Network is not a real organization and must never be presented as, or compared to, a real health authority. All data is synthetic. Patients are never named; visits use pseudonymous IDs.

## The organization

Kestrel Health Network (KHN) is a fictional regional health network in Alberta, Canada. It is a public body and a custodian of health information. It runs four sites in three zones:

| site_code | Site | Zone | Type |
|---|---|---|---|
| KGH | Kestrel General Hospital | Central | Urban referral hospital, busiest emergency department |
| ARH | Aspen Ridge Hospital | North | Community hospital |
| CVH | Coulee Valley Hospital | South | Community hospital |
| PGH | Prairie Gate Health Centre | Central | Rural health centre, small emergency department |

Inpatient units (for the bed census): KGH Medicine 4A, KGH Surgery 5B, KGH ICU, ARH Medicine, ARH Surgery, CVH Medicine, PGH Medicine.

## The programme: Project Beacon

One programme, one charter, one budget, one schedule, one change-control board, run from 1 September 2026 to 17 December 2026. The learner is the Programme Manager. It is delivered in three releases, and every release uses all four exams:

| Release | Weeks of study | Scope | Exam gate |
|---|---|---|---|
| Release 1: Patient-flow analytics service | 1 to 6 | Power BI dashboards for emergency department flow and bed occupancy, built on de-identified data with privacy and security designed in, launched as a supported service with the service desk | PL-300 and ITIL Foundation (week 6, day 4) |
| Release 2: Clinician identity and access | 6 (day 5) to 10 (day 3) | Role-based access to clinical systems and the dashboards, joiner-mover-leaver linked to HR, MFA and single sign-on, privileged access, access reviews, the access-request value stream through the service desk | PMP (week 10, day 3) |
| Release 3: Cyber resilience | 10 (day 4) to 13 | Ransomware readiness: business impact analysis, recovery targets for clinical systems, downtime procedures, incident response, vulnerability remediation, security-operations dashboard, major-incident review, programme closure | CISSP (week 13, day 4) |

The problem Beacon solves:
- Emergency and patient-flow leaders work from Excel extracts emailed every morning. Numbers disagree between sites, nobody trusts them, and the extracts contain more patient detail than anyone needs.
- Clinicians wait days for access; agency nurses and vendor engineers keep accounts long after they leave; nobody can prove who can see what.
- A ransomware attack on another hospital (fictional) made the board ask whether Kestrel could keep caring for patients if its clinical systems went down. Nobody has tested a restore of the clinical information system in over a year.

## People

| ID | Name | Role in Beacon |
|---|---|---|
| E-001 | Dr. Helen Marchetti | VP Clinical Operations; executive sponsor |
| E-002 | Marcus Bell | Chief Information Officer; chairs the change-control board |
| E-003 | Priya Raman | Chief Privacy Officer; approves the privacy impact assessment |
| E-004 | Daniel Osei | Chief Information Security Officer; security owner and risk acceptance advisor |
| E-005 | Grace Liu | IT Service Desk Manager; owner of the support service |
| E-006 | Tomás Rivera | Clinical Analytics Lead; builds the semantic model, data steward |
| E-007 | Dr. Sarah Whitford | Emergency Medical Director, KGH; business owner of emergency data |
| E-008 | Janelle Cardinal | Director of Patient Flow; business owner of bed data, main consumer of the dashboards |
| E-009 | Kevin Park | Systems Administrator; can provision accounts, approve access requests and administer audit logs (a segregation-of-duties conflict) |
| E-010 | Aisha Mahmoud | Emergency Charge Nurse, KGH; frontline user |
| E-011 | Ben Kowalski | Unit Clerk, KGH Medicine 4A |
| E-012 | Dr. Liam O'Connor | Emergency Physician, ARH |
| E-013 | Mei Tanaka | Clinical Analyst |
| E-014 | Olivia Grant | Agency Nurse supplied by ClearPath Staffing |
| E-015 | Raj Patel | Support engineer at Meridian Clinical Systems (vendor) |
| E-016 | Chloe Dubois | Business Continuity Lead |
| E-017 | Ahmed Haddad | Network Engineer |
| E-018 | Nora Lindqvist | HR Business Partner; HR is the source of joiner, mover and leaver events |
| E-020 | Sam Okafor | Security Analyst; liaison to the managed security operations centre |

The learner is the Programme Manager (no employee ID needed in prose; in data use E-019 "Programme Manager").

## Systems (assets)

| ID | System | Tier | Notes |
|---|---|---|---|
| A-001 | Clinical Information System (CIS) | 1 | Electronic health record; vendor Meridian Clinical Systems |
| A-002 | Emergency Department Tracking Board | 1 | Source of emergency visit timestamps |
| A-003 | Laboratory Information System | 1 | |
| A-004 | Picture Archiving and Communication System (PACS) | 2 | Imaging |
| A-005 | Pharmacy System | 1 | |
| A-006 | Bed Management System | 2 | Source of the bed census |
| A-007 | Identity Directory | 1 | Accounts, groups, single sign-on |
| A-008 | Virtual Desktop Service | 1 | How clinicians reach the CIS from shared workstations |
| A-009 | Power BI service and Beacon semantic model | 3 | Release 1 output |
| A-010 | Clinical Data Warehouse | 2 | Staging for analytics |
| A-011 | IT Service Management Platform | 2 | Service desk tickets |
| A-012 | Backup Platform | 1 | Hosted by NorthArc Cloud |
| A-013 | Email and Collaboration | 2 | |
| A-014 | Clinical Paging and Secure Messaging | 1 | |
| A-015 | HR and Payroll System | 3 | Feeds joiner-mover-leaver events |

Classification scheme (Kestrel policy): Public, Internal, Confidential, Restricted. Restricted = individually identifying health information. Beacon dashboards use de-identified, aggregated data and are classified Confidential. Kestrel's own reporting rule (a Kestrel policy, not a law): suppress counts under 5 in any report shared outside the care team.

## Vendors

| ID | Vendor | Service | Notes |
|---|---|---|---|
| V-01 | Meridian Clinical Systems | CIS software and remote support | Remote support accounts |
| V-02 | NorthArc Cloud | Hosting and backup | Data held in Canada |
| V-03 | ClearPath Staffing | Agency nurses | Their nurses need CIS accounts |
| V-04 | Sentinel SOC Services | Managed security monitoring | Security log data processed in the United States; needs privacy review |
| V-05 | Lumen Analytics Partners | Power BI consulting for Release 1 | Fixed-price contract |

## Key dates and as-of date

- Programme start 2026-09-01; Release 1 go-live gate 2026-10-23; Release 2 acceptance gate 2026-11-26; programme acceptance 2026-12-17.
- Baseline data period: 1 July to 30 September 2026.
- Unless a lesson says otherwise, every calculation uses the as-of date 2026-10-01.

## Words to use

Programme (Canadian spelling), Release 1/2/3, Project Beacon or Beacon, Kestrel or KHN, emergency department (ED), physician initial assessment (PIA), length of stay (LOS), left without being seen (LWBS), alternate level of care (ALC), Canadian Triage and Acuity Scale (CTAS), semantic model, row-level security (RLS).

Abbreviation rule: "PIA" means physician initial assessment only. Always write "privacy impact assessment" in full, never "PIA", so the two never get confused. Define every abbreviation the first time it appears in a lesson or document.

## How the programme is organized in the app

- Release 1 documents start with r1-, Release 2 with r2-, Release 3 with r3-. Programme-wide documents (charter, schedule, RAID log, change control) live in Release 1 and are updated by later releases.
- Each of the 65 study sessions reads one lesson and builds part of one or more documents. The session-to-document map is the `docs` list on each task in after/lib/tricert-content.ts.

## Programme canon (shared facts every document must agree on)

Figures marked (data) come from datasets/out/truth.json. Figures marked (agreed) are Beacon decisions recorded in the charter or by the change-control board; present them as agreed targets or decisions, never as data.

Money
- Budget at completion (data): CAD 1,200,000 across 15 work packages (Release 1 CAD 420,000; Release 2 CAD 460,000; Release 3 CAD 320,000).
- Management reserve (agreed, held by the sponsor, outside the register): CAD 120,000. Total authorized: CAD 1,320,000.
- Status at 2026-10-01 (data): PV 278,900; EV 224,000; AC 250,600; CPI 0.89; SPI 0.80; EAC 1,342,500; VAC -142,500.

Success measures in the charter (baseline from data, target agreed with the sponsor, measured three months after each release)
| Measure | Baseline (data) | Target (agreed) |
|---|---|---|
| Median minutes from arrival to physician initial assessment, KGH | 80.5 | 60 |
| Left without being seen rate, all sites | 5.7% | 4.5% |
| Access requests resolved within 72 hours | 27.3% | 80% |
| Median days to fulfil an access request | 4.26 | 1 |
| Missed leavers (accounts enabled after termination or contract end) | 2 | 0 |
| Privileged accounts with MFA | 66.7% | 100% |
| Q3 access reviews completed on time | 66.7% | 100% |
| Clinical Information System restore within its 4-hour RTO | Failed (9.0 h and 13.5 h; last test 2025-08-14) | Pass |
| Security awareness, agency and vendor workers | 48% | 90% |

Key dates (data, from the schedule): programme 2026-09-01 to 2026-12-17 (78 working days); Release 1 go-live gate 2026-10-23; Release 2 acceptance 2026-11-26; programme acceptance 2026-12-17. The schedule uses a Monday to Friday calendar with no holidays; pointing out that Thanksgiving (2026-10-12) and Remembrance Day (2026-11-11) may need to be added to Kestrel's calendar is a fair teaching point.

Programme risks (RAID log IDs; owners are agreed)
- R-01 Data quality in the emergency extract undermines trust in the dashboards. Owner: Tomás Rivera (E-006).
- R-02 Small counts at Prairie Gate Health Centre (PGH, 55 valid visits in Q3) could identify patients. Owner: Priya Raman (E-003). Response: Kestrel's rule to suppress counts under 5 outside the care team.
- R-03 MFA prompts slow clinicians at shared workstations. Owner: Janelle Cardinal (E-008).
- R-04 The Clinical Information System cannot be restored within its 4-hour RTO. Owner: Daniel Osei (E-004).
- R-05 Sentinel SOC Services (V-04) processes security logs in the United States and needs privacy review and contract safeguards. Owner: Priya Raman (E-003).
- R-06 Key-person dependency on Tomás Rivera for the semantic model. Owner: Programme Manager.
- R-07 Lumen Analytics Partners' (V-05) contract ends 2026-11-30, before Release 3 dashboards. Owner: Programme Manager.
- R-08 Cost performance (CPI 0.89 at 2026-10-01) could exhaust the management reserve. Owner: Marcus Bell (E-002).
Issues: I-01 Kevin Park (E-009) holds provision, approve and audit-log rights (segregation-of-duties conflict). I-02 Missed leavers E-014 and E-027 still enabled. I-03 CIS restore tests failed twice.

Decisions and events (agreed)
- D-01 Charter approved by Dr. Helen Marchetti on 2026-09-01.
- D-02 Release 1 go-live approved 2026-10-23 with one condition: small-count suppression for PGH verified in the RLS test pack.
- CR-01 (change-control board, 2026-10-29, chaired by Marcus Bell): Janelle Cardinal asked for a patient-level list of alternate level of care patients (names and bed numbers) on the bed dashboard. Decision: not approved as asked, because the Health Information Act requires the least amount of information and the highest degree of anonymity; approved alternative: unit-level ALC counts and days on the dashboard, with the care team using the Clinical Information System for patient detail. Impact: 3 days of model work, no change to the Release 2 gate.
- Team conflict (week 9): Tomás Rivera and Ahmed Haddad disagree about the timing of the firewall change the on-premises data gateway needs; resolved by the Programme Manager through a facilitated session and an agreed change window.
- Major incident for the reviews (data): SEC-004, a Critical ransomware precursor on the Virtual Desktop Service (A-008), occurred 2026-08-11 02:20, detected 03:05, contained 05:45, recovered 2026-08-13 18:30.
- Tabletop exercise (week 12): a hypothetical ransomware attack that encrypts the Clinical Information System (A-001) on a weekday at 07:00.
