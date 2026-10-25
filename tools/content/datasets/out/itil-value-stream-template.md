# Access-request value stream worksheet (ITIL Version 5)

All Kestrel information is synthetic. Use this worksheet in Release 2 to map, measure and improve how a clinician gets access to the Clinical Information System (A-001), the Virtual Desktop Service (A-008) and the Beacon dashboards (A-009) through the service desk.

## 1. The service and its value

- Service: clinician access (joiner, mover, leaver and ad hoc access requests).
- Service owner: Grace Liu (E-005), IT Service Desk Manager.
- Consumers: new and moving clinicians, agency nurses supplied by ClearPath Staffing (V-03), vendor support staff such as Meridian Clinical Systems (V-01), and the managers who request access for them.
- Other stakeholders: HR (Nora Lindqvist, E-018) as the source of joiner, mover and leaver events; the Chief Information Security Officer (Daniel Osei, E-004); the Chief Privacy Officer (Priya Raman, E-003).
- Outcome the consumer wants: the right access on the first shift, and no access after the last one.
- Utility (fit for purpose): ________________________________
- Warranty (fit for use: availability, capacity, security, continuity): ________________________________
- Costs and risks removed for the consumer: ________________________________
- Costs and risks introduced (for example, approval steps, training before access): ________________________________

### Baseline from khn_service_desk.csv (August and September 2026)

| Measure | Baseline |
|---|---|
| Access requests logged | 49 |
| Access requests resolved (used for the median) | 44 |
| Median access request days | 4.26 |
| Resolved within 3 days (72 hours) | 27.3% |
| SLA met for access requests (recomputed) | 15.2% |

Related evidence: missed leavers in khn_identity.csv (E-014, E-027) and the access reviews still overdue on 2026-10-01 (AR-002, AR-004, AR-006, AR-012, AR-014, AR-016).

## 2. Product and service lifecycle

Record what each of the eight lifecycle stages means for the access service. Fill every cell; an empty cell is a gap to raise.

| Lifecycle stage | What to record for the access service | Owner | Output or evidence | Measure | Feedback to |
|---|---|---|---|---|---|
| Discover | Demand and pain points: who waits for access, how long, and what it costs care |  |  |  |  |
| Design | Role catalogue, approval rules, segregation-of-duties rules, request form |  |  |  |  |
| Acquire | What you obtain from partners: tooling, vendor and agency agreements, HR data feed |  |  |  |  |
| Build | Configured roles, workflows, HR integration, knowledge articles |  |  |  |  |
| Transition | Testing, change approval, training, cut-over into live use |  |  |  |  |
| Operate | Running the directory, the HR feed and provisioning jobs day to day |  |  |  |  |
| Deliver | Fulfilling each request so the clinician has working access |  |  |  |  |
| Support | Help when access fails: incidents, questions, password resets |  |  |  |  |

## 3. Four dimensions check

| Dimension | Question to answer | Kestrel answer |
|---|---|---|
| Organizations and People | Who approves, who provisions, and is anyone doing both? (See Kevin Park, E-009.) |  |
| Information and Technology | Which systems hold the truth for roles and status (A-015 HR, A-007 Identity Directory, A-011 IT Service Management Platform)? |  |
| Partners and Suppliers | How do ClearPath Staffing (V-03) and Meridian Clinical Systems (V-01) tell you when a worker starts or leaves? |  |
| Value Streams and Processes | Which steps add value for the clinician, and which only add waiting? |  |

## 4. Value-stream steps

Walk one real request from trigger to working access. Time each step from tickets and interviews, not from memory.

| Step | Activity | Trigger or input | Role | Information and technology | Work time (h) | Wait time (h) | % complete and accurate | Rework or failure | Value test |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Manager submits access request | New start, move or new duty | Unit manager | Portal form (A-011) |  |  |  |  |  |
| 2 | Service desk logs and checks the request | Ticket created | Service Desk Analyst | A-011 |  |  |  |  |  |
| 3 | Confirm identity and employment | HR record | Service Desk Analyst | A-015 HR and Payroll System |  |  |  |  |  |
| 4 | Business owner approves clinical access | Approval task | System business owner | A-011 approval workflow |  |  |  |  |  |
| 5 | Confirm CIS training is complete | Training record | Clinical educator | Training records |  |  |  |  |  |
| 6 | Provision account and role | Approved ticket | Identity and Access | A-007 Identity Directory, A-001 |  |  |  |  |  |
| 7 | Enrol MFA and issue credentials | Account created | Service Desk Analyst | A-007 |  |  |  |  |  |
| 8 | Clinician signs in and tests access | Credentials received | Clinician | A-008 Virtual Desktop Service, A-001 |  |  |  |  |  |
| 9 | Close ticket and confirm with requester | Access working | Service Desk Analyst | A-011 |  |  |  |  |  |

Calculate for the whole stream:

- Lead time = total work time + total wait time.
- Flow efficiency = total work time / lead time.
- Rolled % complete and accurate = the product of each step's % complete and accurate.
- SLA attainment and median days, compared with the baseline above.

## 5. Guiding principles check

| Guiding principle | How it applies to this value stream | Action |
|---|---|---|
| Focus on value | Measure access ready for the first shift, not tickets closed |  |
| Start where you are | Use the baseline above before redesigning |  |
| Progress iteratively with feedback | Pilot with one unit (Medicine 4A) before all sites |  |
| Collaborate and promote visibility | Show managers the queue and the wait at each step |  |
| Think and work holistically | Joiners, movers and leavers are one stream, not three |  |
| Keep it simple and practical | Remove approval steps that never reject anything |  |
| Optimize and automate | Automate provisioning from HR events only after the steps are simple |  |

## 6. Continual improvement record

ITIL 4 framed continual improvement as seven questions, and Version 5 refines that model. Use the questions as prompts:

- What is the vision?
- Where are we now? (baseline above)
- Where do we want to be? (target median days and SLA met %)
- How do we get there?
- Take action: owner, due date, dependencies.
- Did we get there? Measure and review date.
- How do we keep the momentum going?
