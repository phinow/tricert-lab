# Beacon analytics security architecture worksheet

All Kestrel information is synthetic. Use this worksheet in Release 1 to show how emergency and bed data travel from clinical systems to the Power BI service, where they cross trust boundaries, and which controls protect them. Owner: Daniel Osei (E-004), Chief Information Security Officer. Privacy review: Priya Raman (E-003), Chief Privacy Officer.

## 1. Components

| Component | Asset | Business owner | Custodian | Hosting | Highest data classification held |
|---|---|---|---|---|---|
| ED Tracking Board (source) | A-002 | E-007 | E-009 | On premises | Restricted |
| Bed Management System (source) | A-006 | E-008 | E-009 | On premises | Restricted |
| Clinical Information System (source of record) | A-001 | E-001 | E-009 | On premises | Restricted |
| Clinical Data Warehouse: staging and de-identified views | A-010 | E-006 | E-009 | On premises | Restricted in staging; Confidential in views |
| On-premises data gateway (part of the Beacon service) | A-009 | E-008 | E-006 | On premises server | Confidential (passes data through) |
| Power BI service and Beacon semantic model | A-009 | E-008 | E-006 | Vendor hosted | Confidential |
| Identity Directory (sign-in, groups, RLS membership) | A-007 | E-002 | E-009 | On premises | Confidential |
| Users: ED and patient-flow leaders, analysts, executives |  |  |  | Kestrel devices and mobile | Confidential (aggregated views) |

## 2. Data flows

| Flow | From | To | Data | Classification | Protection in transit | Notes |
|---|---|---|---|---|---|---|
| F1 | A-002 | A-010 staging | Visit timestamps, CTAS, disposition | Restricted |  |  |
| F2 | A-006 | A-010 staging | Daily bed census by unit | Restricted |  |  |
| F3 | A-010 staging | A-010 de-identified views | Pseudonymous visit IDs, age bands, no names or health numbers | Confidential |  |  |
| F4 | A-010 views | Gateway, then Power BI service | Scheduled refresh of the semantic model | Confidential |  | The gateway makes outbound connections only |
| F5 | Power BI service | Users | Dashboards filtered by RLS | Confidential |  |  |
| F6 | A-007 | Power BI service | Sign-in and group membership for RLS | Confidential |  |  |
| F7 | Lumen Analytics Partners (V-05) | Power BI workspace | Build access during Release 1 | Confidential |  | Time-limited |

## 3. Trust boundaries

| Boundary | Between | Flows crossing it | What must be true at the boundary |
|---|---|---|---|
| TB1 | Clinical systems zone and analytics zone | F1, F2 |  |
| TB2 | Kestrel network and the Power BI cloud service | F4, F6 |  |
| TB3 | Power BI service and user devices, inside or outside the network | F5 |  |
| TB4 | Kestrel and third parties (V-05 build access; V-04 security log monitoring in the United States) | F7 |  |

## 4. Classification and handling

- Restricted (individually identifying health information) stays inside the warehouse staging area and never crosses TB2.
- Confidential (de-identified, aggregated) is the highest class allowed in the semantic model. Apply the Confidential sensitivity label to the semantic model and reports.
- Kestrel reporting rule: suppress counts under 5 in any report shared outside the care team. Prairie Gate Health Centre (PGH) has small counts, so test it first.

## 5. Controls

| Control | Type | Where | Owner | Evidence | Status |
|---|---|---|---|---|---|
| De-identification in warehouse views (no names, health numbers or exact birth dates) | Preventive | A-010 | E-006 |  |  |
| Small-count suppression in shared reports | Preventive | A-009 | E-006 |  |  |
| Row-level security by site, with membership from A-007 groups | Preventive | A-009 | E-006 |  |  |
| Workspace roles: report readers get Viewer or app access only | Preventive | A-009 | E-006 |  |  |
| Confidential sensitivity label on the semantic model and reports | Preventive | A-009 | E-003 |  |  |
| Export to Excel and CSV limited to approved groups | Preventive | A-009 | E-004 |  |  |
| Gateway service account with read-only access to the views | Preventive | Gateway, A-010 | E-009 |  |  |
| MFA for all dashboard users (Release 2) | Preventive | A-007 | E-004 |  |  |
| Audit and activity logs sent to the managed SOC | Detective | A-009, A-007 | E-020 |  |  |
| Quarterly access review of workspace and RLS membership | Detective | A-009 | E-005 |  |  |
| Restore of the semantic model and warehouse from backup | Corrective | A-010, A-012 | E-016 |  |  |

## 6. Misuse cases

For each misuse case, name the STRIDE category (Spoofing, Tampering, Repudiation, Information disclosure, Denial of service, Elevation of privilege), the control that stops or detects it, and what is left.

| Misuse case | STRIDE | Control | Residual concern |
|---|---|---|---|
| An analyst given the Member workspace role sees every site because RLS does not apply to people who can edit the content |  |  |  |
| A user exports visit-level rows and emails them outside Kestrel |  |  |  |
| Someone works out who a patient is from a count of 1 to 4 at PGH on a given night |  |  |  |
| A stolen gateway credential is used to read warehouse staging tables |  |  |  |
| A former agency nurse whose account was never disabled opens the dashboards |  |  |  |
| Consultant (V-05) access stays active after the contract ends |  |  |  |
| A scheduled refresh fails silently and leaders act on stale numbers |  |  |  |

## 7. Residual risk register

| Risk | Inherent rating | Controls applied | Residual rating | Owner | Decision (accept, treat, transfer, avoid) | Approved by and date |
|---|---|---|---|---|---|---|
|  |  |  |  |  |  |  |
|  |  |  |  |  |  |  |
|  |  |  |  |  |  |  |

Residual risk above Kestrel's appetite needs a documented decision by the accountable executive, advised by the Chief Information Security Officer (E-004). A privacy risk also needs the Chief Privacy Officer (E-003).

## 8. Sign-off

- Security architecture reviewed by: ______________ Date: __________
- Privacy impact assessment reference: ______________
- Business owner acceptance (Janelle Cardinal, E-008): ______________ Date: __________
