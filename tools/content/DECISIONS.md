# Beacon decisions that every lesson and document must use (consistency canon, adds to WORLD.md)

Different writers chose different values for these. These are now final. Where a text says something else, change the text to match.

## Release 1 analytics service
- Scheduled refresh runs daily at 05:00. Service level: dashboards show yesterday's data by 06:00. A refresh failure alerts the service desk (Analytics Support) within 1 hour. Never 04:30 or 07:00.
- Performance target (agreed): every visual renders in 3 seconds or less in Performance Analyzer. Never one second.
- Small-count rule (Kestrel policy): in any report shared outside the care team, suppress any count under 5 and blank any rate whose numerator is under 5. Medians are not suppressed by this rule. CVH LWBS (4) and PGH LWBS (2) and PGH admitted (4) are suppressed.
- Go-live decision D-02 on 2026-10-23: the Programme Manager recommends; business owners Dr. Sarah Whitford (E-007) and Janelle Cardinal (E-008) and service owner Grace Liu (E-005) accept; Dr. Helen Marchetti (E-001) decides. Priya Raman (E-003) verifies the PGH suppression condition in the RLS test pack.
- Benefits are measured three months after each gate: Release 1 on 2027-01-25 (2027-01-23 is a Saturday), Release 2 on 2027-02-26, programme on 2027-03-17.

## Release 2 identity and access
- The access-governance dashboard uses the Power Query import names khn_identity, khn_user_permissions, khn_role_permissions and khn_access_reviews (plus FactServiceTicket from Release 1). Lesson w8-s5 and the r2-access-governance-dashboard document must use the same table names and the same DAX.

## Release 3 cyber resilience
- The security-operations dashboard uses FactSecurityEvent (from khn_security_events.csv, with a SequenceValid column), FactControlTest (from khn_controls.csv) and DimAsset (from khn_assets.csv). Lesson w11-s5 and the r3-security-operations-dashboard document must use the same names.
- Recovery: service maximum tolerable downtime (MTD) from the business impact analysis: clinical communication 4 h; emergency care, inpatient care and laboratory 8 h; patient flow 24 h; imaging 48 h; analytics 120 h. System MTD inherits the shortest MTD of the services it supports: Clinical Information System (A-001) 8 h, Pharmacy System (A-005) 8 h, Identity Directory (A-007) 4 h. Work recovery time (WRT): A-001 2 h, A-005 2 h, A-007 0.5 h. RTO comes from khn_assets.csv (A-001 4 h). Check: RTO + WRT must not exceed MTD (A-001: 4 + 2 = 6, within 8).

## ITIL wording
- Do not use "change enablement" (an ITIL 4 practice name not confirmed for Version 5). Say "change control" or "the change practice".

## Document IDs
- Finished documents use BCN-R1-NN, BCN-R2-NN, BCN-R3-NN where NN is the document's position in its release list in tricert-content.ts (R1 has 28, R2 19, R3 19). Cross-references must use the same IDs.
