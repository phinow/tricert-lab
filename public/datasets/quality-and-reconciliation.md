# Kestrel data-quality rules and approved reconciliation figures

Everything in this pack is synthetic. Kestrel Health Network, its people, systems and vendors are fictional, no visit belongs to a real patient, and patients are never named.

The script `generate.py` (seed 20261001) wrote every file, re-read it, and computed each figure on this page. The same figures are in `truth.json`. Unless a line says otherwise, every calculation uses the as-of date 2026-10-01.

How to use this page: profile each file yourself first. Then compare your findings with the file checks below. Then build the model and compare your measures with the approved figures. If your number differs, find the rule you applied differently before you change anything.

## Emergency department definitions

Kestrel uses these definitions, which follow the Canadian Institute for Health Information (CIHI) approach. In this pack, PIA always means physician initial assessment.

- The ED clock starts at arrival_datetime (registration). In every valid row triage_datetime is at or after arrival_datetime.
- Time to PIA = pia_datetime minus arrival_datetime, in whole minutes.
- ED length of stay (LOS) = departure_datetime minus arrival_datetime, for every disposition. For an admitted patient, departure is when the patient physically left the ED for a bed.
- LWBS (left without being seen) = disposition LWBS: the patient left before a physician initial assessment, so an LWBS row has no pia_datetime.
- % PIA within CTAS target uses the objectives CTAS 1 immediate (0 minutes), CTAS 2 within 15, CTAS 3 within 30, CTAS 4 within 60 and CTAS 5 within 120 minutes. A visit is within target when its time to PIA is at or under the objective, so a CTAS 1 visit counts only when its time to PIA is 0 minutes. CTAS 1 is also reported on its own row in the CTAS table below. The denominator is visits with a valid time to PIA; LWBS visits are not in it.

## Kestrel data-quality rules

| Rule | What it says | Handling |
|---|---|---|
| DQ-01 | Rows identical in every column are exact duplicates. | Keep the first copy, remove the rest, log the count. |
| DQ-02 | Business keys (visit_id, ticket_id, wp_id, record_id and so on) must be present and unique after DQ-01. | Same key with different content: quarantine both rows and ask the data owner. |
| DQ-03 | Codes and categories must match the governed list. Case and spaces do not change meaning. | Trim and map case-insensitively (kgh to KGH, hIGH to High). A value that still does not map is quarantined. |
| DQ-04 | Dates and date/times must be real calendar values in ISO form. | A bad value in a field that places the record in time (arrival, census date, opened) quarantines the row. A bad planning date is set to null and repaired from its authoritative source. |
| DQ-05 | Values must sit in their allowed range: CTAS 1 to 5, percentages 0 to 100, CVSS 0.0 to 10.0, counts and money 0 or more. | A bad classifying field (CTAS) quarantines the row. A bad measure is nulled, or corrected only with a recorded owner decision. |
| DQ-06 | Timestamps must follow a possible order (for example arrival, triage, PIA, departure). | Keep the record for counts. Null every duration that depends on the bad timestamps. |
| DQ-07 | Two fields must not contradict each other (an LWBS visit cannot have a PIA). | Quarantine: you cannot tell which field is wrong. |
| DQ-08 | Derived flags such as sla_met must agree with the data they come from. | Recompute the flag from the timestamps. Never trust a stored flag over the evidence. |
| DQ-09 | Snapshot tables need one row per unit per day. | Report missing snapshots; do not invent them. Never add snapshot values across days. |
| DQ-10 | Foreign keys must match a reference table. | Load against an Unknown member so the row stays visible, and send it to the owner. |
| DQ-11 | Unusual but possible values (occupied beds above staffed beds) are not errors. | Load them, flag them, and ask the owner to confirm. |
| DQ-12 | Identity rows are effective-dated: one current row per worker; Agency and Vendor rows need an end date. | Overlaps and missing end dates go to the HR Business Partner (E-018) for review. |
| DQ-13 | Quarantined rows are evidence. | Keep them in an exception table with the rule ID; never delete them. |
| DQ-14 | Kestrel reporting rule: suppress counts under 5 in any report shared outside the care team. | Applies to outputs, not to these reconciliation figures. |

## File checks

### khn_sites.csv and khn_units.csv

- Sites: 4 rows, all codes unique. Units: 7 rows, every unit maps to a site.
- No deliberate problems. These are your reference tables for DQ-03 and DQ-10.

### khn_ed_visits.csv

- Source rows: 480. Exact duplicate rows: 2. Unique rows: 478. Rows loaded to FactEDVisit: 474. Rows quarantined: 4.

| Problem | Row IDs | Rule | Correct handling |
|---|---|---|---|
| Exact duplicate rows (the August and September extracts overlapped) | V0315, V0318 | DQ-01 | Remove the second copy of each. |
| Site code in lower case ("kgh") | V0140, V0309 | DQ-03 | Convert to KGH and keep. Both visits count for KGH. |
| CTAS level outside 1 to 5 | V0070 (ctas_level 6), V0222 (ctas_level 0) | DQ-05 | Quarantine. Ask the ED data owner, Dr. Sarah Whitford (E-007), to correct from the triage record. |
| PIA before triage | V0385 | DQ-06 | Keep in visit counts and LWBS rate. Null MinutesToPIA and EDLOSMinutes. |
| PIA before arrival | V0421 | DQ-06 | Keep in visit counts and LWBS rate. Null MinutesToPIA and EDLOSMinutes. |
| Departure missing for a visit that is not LWBS | V0268 | DQ-06 | Keep in visit counts and PIA measures. Null EDLOSMinutes. |
| Invalid date (2026-09-31 does not exist) | V0476 | DQ-04 | Quarantine. The visit cannot be placed in time. |
| LWBS visit with a PIA time (contradiction) | V0075 | DQ-07 | Quarantine. Either the disposition or the PIA is wrong. |

### khn_bed_census.csv

- Source rows: 644. Expected unit-days: 644 (7 units by 92 days). Exact duplicates: 1. Rows loaded: 643.
- This is a snapshot table. Beds are semi-additive: add across units on one day, never across days.

| Problem | Rows (unit_id and census_date) | Rule | Correct handling |
|---|---|---|---|
| Missing day for one unit | ARH-SUR 2026-08-16 | DQ-09 | Report the gap and ask Janelle Cardinal (E-008) for the snapshot from the Bed Management System (A-006). Do not impute. Approved figures use the rows present, so ARH has one day with only ARH Medicine. |
| Exact duplicate row | KGH-ICU 2026-07-15 | DQ-01 | Remove the second copy. |
| Occupied beds above staffed beds | KGH-MED4A 2026-09-08 (34 occupied, 32 staffed) | DQ-11 | Review item, not an error: surge beds in a hallway are possible. Keep the row and set OverCapacityFlag. |
| Negative ALC count | CVH-MED 2026-07-22 (-1) | DQ-05 | Set ALCPatients to null for that row and keep its bed counts. Ask the unit to confirm the real value. |

### khn_programme_register.csv

- Source rows: 16. Exact duplicates: 1 (WP-104). Unique work packages: 15.

| Problem | Row IDs | Rule | Correct handling |
|---|---|---|---|
| Exact duplicate | WP-104 | DQ-01 | Remove the second copy before any total. |
| Negative budget | WP-113 -60000 | DQ-05 | Finance confirmed a sign error, so the approved correction is the absolute value. Record the decision. |
| Inconsistent status and risk casing | WP-103 status 'in progress' to 'In progress', WP-104 risk_rating 'high' to 'High', WP-110 status 'NOT STARTED' to 'Not started', WP-112 risk_rating 'HIGH' to 'High' | DQ-03 | Map to Not started, In progress, Complete, On hold and Low, Medium, High. |
| Missing owner | WP-108 | DQ-02 | Keep the budget in totals. The sponsor assigns an owner; until then the work package has no accountable person. |
| Invalid date | WP-109 planned_finish '2026-11-31' | DQ-04 | Set to null and repair from khn_schedule.csv: task 16 finishes on 2026-11-04. |
| Percent complete over 100 | WP-101 110 (status Complete) | DQ-05 | The status is Complete, so cap at 100. Any other status would be quarantined until the owner confirms. |

### khn_schedule.csv

- Rows: 28 (row 1 is the programme summary, then 27 tasks). Milestones: 2, 12, 20, 28.
- No deliberate problems. Calendar: Monday to Friday, no holidays (a simplification; a real Kestrel plan would add statutory holidays). Links are finish-to-start with no lag.
- Set the project start date to 2026-09-01 before you import. Only row 1 carries a Start date; every other date comes from the links.
- Row 1 imports as an ordinary task. Indent rows 2 to 28 beneath it to make it a summary; its duration should then match the file.

### khn_service_desk.csv

- Source rows: 220. Exact duplicates: 1. Unique tickets: 219. Open at the extract (2026-10-01 00:00, blank resolved_at): 9; this is normal, not a problem.

| Problem | Row IDs | Rule | Correct handling |
|---|---|---|---|
| Exact duplicate | SD-10210 | DQ-01 | Remove the second copy. |
| resolved_at before opened_at | SD-10089 | DQ-06 | Keep in ticket counts. Null ResolutionHours and leave SLAMet blank, so it is outside SLA Met %. Ask the service desk (E-005) to correct the time. |
| Missing priority | SD-10057 | DQ-02 | Keep in ticket counts. With no priority there is no target, so it is outside SLA Met % until the desk sets one. |
| sla_met contradicts the times | SD-10011 file 'Y' recomputed 'N' | DQ-08 | Recompute every SLA flag from the timestamps; this one becomes N. |

### khn_identity.csv

- Source rows: 43. Distinct workers: 42. The current row for each worker is the row with the latest effective_from.

| Problem | Row IDs | Rule | Correct handling |
|---|---|---|---|
| Terminated worker whose account is still Enabled (missed leaver) | E-027 | DQ-12 | Disable the account today, remove permissions, check activity after the termination date, and ask HR (E-018) why the leaver event did not reach IT. |
| Agency nurse past contract end still Enabled | E-014 | DQ-12 | Disable the account and remove permissions. Agree with ClearPath Staffing (V-03) how end dates reach Kestrel. |
| Mover with two overlapping current rows | E-028 | DQ-12 | Close the old Unit Clerk row with effective_to 2026-08-16 and remove the old role's permissions. |
| privileged value "Maybe" | E-031 'Maybe' | DQ-03 | Treat as unknown, not Yes or No. Check the account in the Identity Directory (A-007) and confirm with the manager (E-005). |
| manager_id that does not exist | E-037 -> E-099 | DQ-10 | Load against an Unknown manager and ask HR to correct it. Reviews for this worker need a named reviewer meanwhile. |
| Vendor account with no effective_to | E-015 | DQ-12 | Set an end date no later than the vendor contract end and have the business owner of the Clinical Information System (A-001, E-001) confirm it is still needed. |

### khn_role_permissions.csv and khn_user_permissions.csv

- Role permission rows: 39 across 11 roles. User permission rows: 171.
- An excess grant is a user permission that the worker's current role (from the latest identity row) does not include.
- Kestrel segregation-of-duties rule: on the Identity Directory (A-007) no one may hold two or more of provision accounts, approve access and administer audit logs.

| Finding | Rows | Correct handling |
|---|---|---|
| Segregation-of-duties conflict | E-009: administer audit logs, approve access, provision accounts | Remove approve access and administer audit logs from E-009. Approval belongs to business owners; audit-log administration belongs to security (E-020). |
| Excess grants | E-009 A-007 administer audit logs, E-009 A-007 approve access, E-013 A-009 view all sites, E-014 A-001 order entry, E-015 A-001 view chart, E-028 A-001 view chart, E-028 A-006 update bed status, E-028 A-008 virtual desktop access | Remove each one or record an approved exception. E-028 keeps old Unit Clerk access after the move. |
| Self-granted permissions | E-009 A-007 administer audit logs, E-009 A-007 approve access | A person must never approve their own access. Re-approve through E-004. |

### khn_access_reviews.csv

- Rows: 24. Due by 2026-09-30: 18. Not yet due (due 2026-10-15): 6.

| Problem | Row IDs | Correct handling |
|---|---|---|
| Review for an employee_id not in khn_identity.csv | AR-018 | An account exists in the CIS for someone HR does not know. The Remove decision is right; confirm the account is gone and find out how it was created. |
| Completed before it was assigned | AR-006 | Not valid evidence. Treat as not completed and repeat the review. |
| Overdue as of 2026-10-01 (due, not validly completed) | AR-002, AR-004, AR-006, AR-012, AR-014, AR-016 | Escalate to each reviewer's manager. |
| Reviewer reviewed their own access | AR-001 | Not independent. Re-review by E-004. |
| Remove decision not carried out (account still Enabled) | AR-003 (E-014) | A review only works if the decision is actioned. Disable the account. |

### khn_security_events.csv

- Source rows: 21. Exact duplicates: 1. Unique records: 20 (10 incidents, 10 vulnerabilities).
- Sequence rule for incidents: occurred_at, detected_at, contained_at, recovered_at must not go backwards. opened_at may fall before or after detection, because a person can report something before the SOC confirms it.

| Problem | Row IDs | Rule | Correct handling |
|---|---|---|---|
| Duplicate incident row | SEC-005 | DQ-01 | Remove the second copy. |
| contained_at before detected_at (impossible sequence) | SEC-008 | DQ-06 | Keep in incident counts; leave out of MTTD, MTTC and MTTR. Ask the SOC liaison (E-020) for the true times. |
| CVSS score above 10.0 | SEC-017 11.5 | DQ-05 | Not a valid vulnerability record until rescored. Keep it on the open-risk list: a Critical remote code execution finding must not disappear because its score is wrong. |
| asset_id not in khn_assets.csv | SEC-016 A-021 | DQ-10 | Load against an Unknown asset. An unregistered system is itself a finding for the asset owner. |
| Severity in odd casing | SEC-019 'hIGH' to 'High' | DQ-03 | Map to High. |
| Opened before detected (allowed, not an error) | SEC-007 |  | No action. |

### khn_assets.csv

- Source rows: 16. Exact duplicates: 1. Unique systems: 15.

| Problem | Row IDs | Correct handling |
|---|---|---|
| Exact duplicate | A-008 | Remove the second copy. |
| Missing business owner | A-005 | A tier 1 system with no accountable owner. Escalate to the sponsor (E-001) to name one. |
| End of support already passed | A-014 2026-06-30 | Unsupported tier 1 system. Raise a risk, plan replacement, and add compensating controls (see SEC-015). |
| Review item: vendor-hosted with no vendor_id | A-009 | The Power BI service is software as a service outside the Beacon vendor list. Record its provider in the vendor register. |

### khn_controls.csv

- Rows: 13. Well-formed: no duplicates or bad values. Status counts: Pass 4, Fail 8, Not tested 1.

### khn_vendors.csv

- Rows: 5. No data errors; findings are listed in the approved figures below.

### khn_lab.sql

- Tables: sites 4, staff 42, assets 15, security_events 20, service_tickets 30 rows.
- Orphans by design: staff manager E-037 -> E-099; security event asset SEC-016 A-021; service ticket SD-10113 keyed with site_code PGC in the lab copy only.

## Approved reconciliation figures

### Emergency department (FactEDVisit)

Cleaning rule: remove exact duplicates; upper-case site codes; quarantine rows with an invalid date, a CTAS level outside 1 to 5, or LWBS with a PIA. Minutes to PIA run from arrival_datetime to pia_datetime. Rows with out-of-order timestamps stay in counts but are left out of time measures; the row with no departure is left out of LOS only.

- Valid visits: 474 (from 480 source rows, less 2 duplicates and 4 quarantined).
- LWBS: 27 visits, LWBS rate 5.7% of valid visits.
- Median minutes to PIA: 64.0 across 445 visits with a valid PIA.
- % PIA within CTAS target: 28.3% (126 of 445). Targets: CTAS 1 immediate (0 minutes), 2 within 15, 3 within 30, 4 within 60, 5 within 120.
- Median ED LOS: admitted 11.96 hours (n = 58); discharged 3.61 hours (n = 362); transferred 4.72 hours (n = 24); all visits with a valid LOS 3.82 hours (n = 471).
- Evening arrivals (17:00 to 23:59): 34.0% of valid visits.

| Site | Valid visits | LWBS rate | Median minutes to PIA | % PIA within target | Median LOS admitted (h) | Median LOS discharged (h) |
|---|---|---|---|---|---|---|
| KGH | 213 | 7.5% | 80.5 | 12.8% | 15.14 | 4.30 |
| ARH | 105 | 4.8% | 54.5 | 34.0% | 9.45 | 3.30 |
| CVH | 101 | 4.0% | 54.0 | 39.2% | 8.58 | 3.02 |
| PGH | 55 | 3.6% | 45.5 | 55.8% | 8.33 | 2.91 |

| CTAS level | Valid visits | Visits with valid PIA | Within target | % within target | Median minutes to PIA |
|---|---|---|---|---|---|
| 1 | 7 | 7 | 3 | 42.9% | 1.0 |
| 2 | 46 | 45 | 15 | 33.3% | 27.0 |
| 3 | 192 | 186 | 29 | 15.6% | 55.0 |
| 4 | 158 | 151 | 46 | 30.5% | 76.0 |
| 5 | 71 | 56 | 33 | 58.9% | 100.0 |

### Bed census (FactBedCensus)

Cleaning rule: remove the exact duplicate; keep the overcapacity row; set the negative ALC value to null; do not impute the missing unit-day. Average daily occupancy = for each census date, occupied beds divided by staffed beds summed across the units in scope, then the average of those daily ratios.

- Average daily occupancy, all units: 87.0%.
- Last snapshot (2026-09-30): 121 occupied of 144 staffed, 84.0%.
- ALC patient-days (sum of alc_patients over all loaded rows, negative value excluded): 2,075, which is 18.4% of occupied bed-days on the same rows.
- The semi-additive trap: adding staffed_beds over every row gives 12,952. That is staffed bed-days, not beds. Kestrel has 144 staffed beds on the last date.
- Ratio of sums (total occupied bed-days divided by total staffed bed-days): 87.0%. It weights busy days with more beds more heavily, so it differs slightly from the average of daily ratios. Kestrel reports the average of daily ratios.

| Site | Average daily occupancy | Occupancy on 2026-09-30 | Staffed beds on 2026-09-30 | ALC patient-days |
|---|---|---|---|---|
| KGH | 89.3% | 84.7% | 72 | 835 |
| ARH | 84.8% | 82.5% | 40 | 561 |
| CVH | 87.9% | 86.4% | 22 | 377 |
| PGH | 76.8% | 80.0% | 10 | 302 |

| Unit | Average daily occupancy |
|---|---|
| KGH-MED4A | 94.7% |
| KGH-SUR5B | 86.3% |
| KGH-ICU | 81.3% |
| ARH-MED | 88.2% |
| ARH-SUR | 79.2% |
| CVH-MED | 87.9% |
| PGH-MED | 76.8% |

### Programme budget and earned value (khn_programme_register.csv, as of 2026-10-01)

Cleaning rule: remove the duplicate; use the absolute value of the negative budget (confirmed sign error); cap the over-100 percent at 100 because the work package is Complete. PV = budget x planned_pct_as_of. EV = budget x pct_complete. AC = actual_cost_cad. CPI = EV / AC. SPI = EV / PV. EAC = BAC / CPI (unrounded CPI).

- Budget at completion (BAC), approved: CAD 1,200,000. By release: Release 1 CAD 420,000; Release 2 CAD 460,000; Release 3 CAD 320,000.
- Management reserve, held by the sponsor outside the register: CAD 120,000. Total authorized funding: CAD 1,320,000.
- Common wrong totals: summing every source row gives CAD 1,220,000; removing only the duplicate gives CAD 1,080,000.
- Planned value (PV): CAD 278,900. Earned value (EV): CAD 224,000. Actual cost (AC): CAD 250,600.
- Cost variance (EV minus AC): CAD -26,600. Schedule variance (EV minus PV): CAD -54,900.
- CPI: 0.89. SPI: 0.80. EAC: CAD 1,342,500. Variance at completion (BAC minus EAC): CAD -142,500.
- Release 1 only: PV CAD 211,400, EV CAD 188,000, AC CAD 211,000, CPI 0.89, SPI 0.89.

### Schedule (khn_schedule.csv)

Rule: forward and backward pass on a Monday to Friday calendar, finish-to-start links, row 1 excluded from the network. Total float = late start minus early start, in working days.

- Programme start 2026-09-01, finish 2026-12-17, 78 working days (row 1 duration 78d).
- Gates from the forward pass: Release 1 go-live 2026-10-23; Release 2 acceptance 2026-11-26; programme acceptance 2026-12-17.
- Critical path (task IDs): 2 > 3 > 4 > 6 > 8 > 9 > 11 > 12 > 14 > 17 > 19 > 20 > 21 > 22 > 26 > 27 > 28.
- Largest float: 14 working days.

| ID | Task | Duration | Early start | Early finish | Late start | Late finish | Total float | Free float |
|---|---|---|---|---|---|---|---|---|
| 2 | Charter approved | 0d | 2026-09-01 | 2026-09-01 | 2026-09-01 | 2026-09-01 | 0 | 0 |
| 3 | Confirm requirements and KPI definitions | 6d | 2026-09-01 | 2026-09-08 | 2026-09-01 | 2026-09-08 | 0 | 0 |
| 4 | Complete privacy impact assessment | 12d | 2026-09-09 | 2026-09-24 | 2026-09-09 | 2026-09-24 | 0 | 0 |
| 5 | Profile and clean ED and bed census sources | 10d | 2026-09-09 | 2026-09-22 | 2026-09-11 | 2026-09-24 | 2 | 2 |
| 6 | Build warehouse staging and de-identified views | 8d | 2026-09-25 | 2026-10-06 | 2026-09-25 | 2026-10-06 | 0 | 0 |
| 7 | Threat model the analytics architecture | 7d | 2026-09-09 | 2026-09-17 | 2026-09-29 | 2026-10-07 | 14 | 0 |
| 8 | Build semantic model and DAX measures | 7d | 2026-10-07 | 2026-10-15 | 2026-10-07 | 2026-10-15 | 0 | 0 |
| 9 | Configure RLS and sensitivity labels | 3d | 2026-10-16 | 2026-10-20 | 2026-10-16 | 2026-10-20 | 0 | 0 |
| 10 | Prepare service desk support and knowledge articles | 4d | 2026-10-16 | 2026-10-21 | 2026-10-20 | 2026-10-23 | 2 | 2 |
| 11 | User acceptance testing with ED and patient-flow leaders | 3d | 2026-10-21 | 2026-10-23 | 2026-10-21 | 2026-10-23 | 0 | 0 |
| 12 | Release 1 go-live gate | 0d | 2026-10-23 | 2026-10-23 | 2026-10-23 | 2026-10-23 | 0 | 0 |
| 13 | Design role catalogue and RBAC model | 12d | 2026-09-18 | 2026-10-05 | 2026-10-08 | 2026-10-23 | 14 | 14 |
| 14 | Integrate joiner-mover-leaver events from HR | 12d | 2026-10-26 | 2026-11-10 | 2026-10-26 | 2026-11-10 | 0 | 0 |
| 15 | Roll out MFA and single sign-on | 10d | 2026-10-26 | 2026-11-06 | 2026-10-30 | 2026-11-12 | 4 | 0 |
| 16 | Implement privileged access and SoD controls | 8d | 2026-10-26 | 2026-11-04 | 2026-11-03 | 2026-11-12 | 6 | 2 |
| 17 | Redesign the access-request value stream | 8d | 2026-11-11 | 2026-11-20 | 2026-11-11 | 2026-11-20 | 0 | 0 |
| 18 | Run Q3 access review and recertification | 6d | 2026-11-09 | 2026-11-16 | 2026-11-13 | 2026-11-20 | 4 | 4 |
| 19 | Release 2 pilot and acceptance testing | 4d | 2026-11-23 | 2026-11-26 | 2026-11-23 | 2026-11-26 | 0 | 0 |
| 20 | Release 2 acceptance gate | 0d | 2026-11-26 | 2026-11-26 | 2026-11-26 | 2026-11-26 | 0 | 0 |
| 21 | Complete business impact analysis and recovery targets | 5d | 2026-11-27 | 2026-12-03 | 2026-11-27 | 2026-12-03 | 0 | 0 |
| 22 | Test CIS restore and downtime procedures | 6d | 2026-12-04 | 2026-12-11 | 2026-12-04 | 2026-12-11 | 0 | 0 |
| 23 | Update incident response plan and run tabletop exercise | 5d | 2026-12-04 | 2026-12-10 | 2026-12-07 | 2026-12-11 | 1 | 1 |
| 24 | Remediate priority vulnerabilities | 7d | 2026-11-27 | 2026-12-07 | 2026-12-01 | 2026-12-09 | 2 | 0 |
| 25 | Build security operations dashboard | 4d | 2026-12-08 | 2026-12-11 | 2026-12-10 | 2026-12-15 | 2 | 2 |
| 26 | Hold major-incident review | 2d | 2026-12-14 | 2026-12-15 | 2026-12-14 | 2026-12-15 | 0 | 0 |
| 27 | Close programme and record lessons learned | 2d | 2026-12-16 | 2026-12-17 | 2026-12-16 | 2026-12-17 | 0 | 0 |
| 28 | Programme acceptance | 0d | 2026-12-17 | 2026-12-17 | 2026-12-17 | 2026-12-17 | 0 | 0 |

### Service desk (FactServiceTicket)

Cleaning rule: remove the duplicate; recompute every SLA flag from the timestamps (resolved: Y if resolution hours are at or under the target; open at the extract: N if the target has already passed, otherwise blank); leave the reversed-time ticket and the no-priority ticket out of SLA and duration measures. SLA Met % = Y / (Y + N).

- Unique tickets: 219. By type: Incident 113; Service request 57; Access request 49.
- SLA met: 64.6% (137 of 212 with a known outcome; 5 still inside target at the extract). By type: Incident 76.4%; Service request 82.1%; Access request 15.2%.
- SLA met by priority: P1 100.0%; P2 76.0%; P3 62.8%; P4 61.8%.
- Median access-request days: 4.26 (resolved access requests, n = 44). Only 27.3% were resolved within 72 hours.
- Median resolution hours by type: Incident 14.4; Service request 4.6; Access request 102.3.
- Reopened: 5.9%. Average CSAT: 3.50 from 88 responses.

### Identity and access (as of 2026-10-01)

Rule: use each worker's latest row. A missed leaver is an Enabled account whose hr_status is Terminated or whose effective_to is before 2026-10-01.

- Enabled accounts: 40. Disabled: 2. Workers by type: Employee 38; Agency 2; Vendor 2.
- Missed leavers: 2 (E-014, E-027).
- Enabled privileged accounts (privileged = Yes): 6 (E-009, E-015, E-017, E-020, E-033, E-039). One more value is unknown: E-031 'Maybe'.
- Privileged accounts without MFA: 2 (E-009, E-015); privileged MFA coverage 66.7%.
- All enabled accounts without MFA: 23; MFA coverage 42.5%.
- Excess permission grants: 8. Segregation-of-duties conflicts: 1. Share of user permissions granted by E-009: 62.6%.
- Q3 access reviews: 14 of 24 validly completed (58.3%). Of the 18 due by 2026-09-30, 12 were done (66.7%) and 6 are overdue.

### Security operations (khn_security_events.csv)

Rule: remove the duplicate. MTTD = mean of detected_at minus occurred_at. MTTC = mean of contained_at minus detected_at. MTTR = mean of recovered_at minus detected_at. All in hours, over incidents with a possible sequence; MTTR uses only recovered incidents.

- Unique incidents: 10; valid for time measures: 9. Unique vulnerabilities: 10; valid: 9.
- MTTD 25.29 hours (n = 9); MTTC 1.93 hours (n = 9); MTTR 28.33 hours (n = 8).
- Not yet recovered: SEC-009.
- Open vulnerabilities: 8. Past remediation_due on 2026-10-01: 3 (SEC-012, SEC-015, SEC-017). Remediation policy from detection: Critical 7 days, High 30, Medium 60, Low 90.

### Assets, recovery and controls

- Unique systems: 15. Tier 1: 8; tier 2: 5; tier 3: 2.
- Restore tests against RTO (Pass when restore_hours is at or under rto_target_hours): CT-001 A-001 Fail (9.0 h against 4 h), CT-002 A-001 Fail (13.5 h against 4 h), CT-003 A-007 Pass (1.5 h against 2 h), CT-004 A-005 Not tested.
- The CIS (A-001) has failed 2 restore tests. Its last test was 2025-08-14 (413 days before 2026-10-01) and took 13.5 hours against a 4-hour RTO.
- Awareness training groups below the 90% target: Agency and vendor workers, Nursing, Physicians.

### Vendors

- Data held or processed outside Canada: V-04 United States; needs privacy review.
- No assurance report on file: V-03.
- Assurance report older than 12 months on 2026-10-01: V-05 2025-06-30.
- Contracts ending within 90 days: V-05 2026-11-30.

### SQL lab (khn_lab.sql)

The four reconciliation queries and their exact results are written as comments at the end of `khn_lab.sql`. Summary:

- Q1 Staff whose manager_id has no matching staff row (orphan manager): E-037 | E-099.
- Q2 Security events whose asset_id has no matching asset (orphan asset): SEC-016 | A-021.
- Q3 Service tickets whose site_code has no matching site (orphan site): SD-10113 | PGC.
- Q4 Tickets per site with an Unknown member, so the rows add back to the table total: ARH | 6; CVH | 8; KGH | 13; PGH | 2; Unknown | 1.
