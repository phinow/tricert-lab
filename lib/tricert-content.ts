export type Certification = 'PMP' | 'PL-300' | 'CISSP' | 'ITIL';

export type StudyTask = {
  key: string;
  day: string;
  title: string;
  meta: string;
  certifications: Certification[];
  docs: string[];
};

export type StudyWeek = {
  number: number;
  theme: string;
  outcome: string;
  tasks: StudyTask[];
};

export type Deliverable = {
  key: string;
  title: string;
  summary: string;
  concepts: string[];
  domains: string[];
  why: string;
  rubric: string[];
  reflections: string[];
  template: string;
};

export type Project = {
  key: string;
  number: number;
  title: string;
  objective: string;
  narrative: string;
  deliverables: Deliverable[];
};

export type ScenarioQuestion = {
  id: string;
  certification: Certification | 'Intersection';
  domain: string;
  prompt: string;
  options: [string, string][];
  correct: string;
  explanation: string;
  incorrect: Record<string, string>;
  artifactKey: string;
};

/* The case: Project Beacon at Kestrel Health Network, a fictional Alberta
   health network. One programme, three releases, all four exams in every
   release. Each session reads one lesson and builds one piece of Beacon. */
export const programme = {
  name: 'Project Beacon',
  organization: 'Kestrel Health Network',
  summary: 'One programme at a fictional Alberta health network: trusted patient-flow analytics, safe clinician access, and recovery from cyber attack, delivered as supported services.',
} as const;

const makeTasks = (
  week: number,
  items: Array<[string, string, string, Certification[], string[]]>,
): StudyTask[] => items.map(([day, title, meta, certifications, docs], index) => ({
  key: `w${week}-s${index + 1}`,
  day,
  title,
  meta,
  certifications,
  docs,
}));

export const studyWeeks: StudyWeek[] = [
  {
    number: 1,
    theme: 'Launch Project Beacon',
    outcome: 'Understand Kestrel Health, the four exams and the business case, and get the programme authorized.',
    tasks: makeTasks(1, [
      ['Day 1', 'Meet Kestrel Health and kick off Beacon', '90 min · programme brief', ['PMP', 'PL-300', 'CISSP', 'ITIL'], ['r1-programme-brief']],
      ['Day 2', 'Learn the four exam blueprints through Beacon', '120 min · exam-to-project coverage map', ['PMP', 'PL-300', 'CISSP', 'ITIL'], ['r1-exam-to-project-coverage-map']],
      ['Day 3', 'Profile the emergency department visit data', '150 min · first data-quality findings', ['PL-300', 'CISSP'], ['r1-power-query-data-quality-workbook']],
      ['Day 4', 'Write the Beacon business case', '150 min · options, benefits, risks', ['PMP', 'CISSP', 'ITIL'], ['r1-business-case']],
      ['Day 5', 'Draft and approve the programme charter', '180 min · authority, scope, success criteria', ['PMP', 'CISSP', 'ITIL'], ['r1-programme-charter']],
    ]),
  },
  {
    number: 2,
    theme: 'Plan the programme',
    outcome: 'Turn leaders’ needs into scope, requirements, a schedule, stakeholder plans and programme controls.',
    tasks: makeTasks(2, [
      ['Day 1', 'Elicit needs from emergency and patient-flow leaders', '120 min · needs and requirements', ['PMP', 'ITIL'], ['r1-requirements-and-traceability-register']],
      ['Day 2', 'Write the scope statement and traceable requirements', '180 min · acceptance criteria', ['PMP', 'PL-300'], ['r1-scope-statement', 'r1-requirements-and-traceability-register']],
      ['Day 3', 'Build the WBS and programme schedule', '210 min · dependencies and milestones', ['PMP'], ['r1-work-breakdown-structure', 'r1-microsoft-project-schedule']],
      ['Day 4', 'Build the stakeholder register and communication plan', '120 min · influence and audience needs', ['PMP', 'ITIL'], ['r1-stakeholder-register', 'r1-communication-plan']],
      ['Day 5', 'Open the RAID log and set up change control', '180 min · risks, issues, decisions', ['PMP', 'CISSP'], ['r1-raid-log', 'r1-change-control-process']],
    ]),
  },
  {
    number: 3,
    theme: 'Protect and prepare the data',
    outcome: 'Classify the health information, assess privacy, then clean and secure the data the dashboards will use.',
    tasks: makeTasks(3, [
      ['Day 1', 'Classify health information and assess privacy', '180 min · classification and privacy impact', ['CISSP', 'PMP'], ['r1-health-information-classification-register', 'r1-privacy-impact-assessment']],
      ['Day 2', 'Profile every source and log quality issues', '150 min · findings log', ['PL-300'], ['r1-power-query-data-quality-workbook']],
      ['Day 3', 'Build the Power Query cleaning pipeline', '210 min · types, nulls, errors, duplicates', ['PL-300'], ['r1-power-query-data-quality-workbook']],
      ['Day 4', 'Write source-to-target rules and the quality plan', '150 min · reconciliation controls', ['PL-300', 'CISSP', 'PMP'], ['r1-quality-plan']],
      ['Day 5', 'Threat-model and design the secure analytics architecture', '180 min · trust boundaries and controls', ['CISSP', 'ITIL'], ['r1-threat-model-and-architecture', 'r1-security-acceptance-criteria']],
    ]),
  },
  {
    number: 4,
    theme: 'Model the patient-flow service',
    outcome: 'Build the semantic model, measures and role-based security, and define the dashboards as a service.',
    tasks: makeTasks(4, [
      ['Day 1', 'Design the star schema', '180 min · grain, facts and dimensions', ['PL-300'], ['r1-star-schema-and-relationship-design']],
      ['Day 2', 'Build the date table and relationships', '150 min · cardinality and filter direction', ['PL-300'], ['r1-star-schema-and-relationship-design', 'r1-date-table-and-dax-catalogue']],
      ['Day 3', 'Write and test the patient-flow measures', '210 min · waits, length of stay, occupancy', ['PL-300'], ['r1-date-table-and-dax-catalogue']],
      ['Day 4', 'Design and test row-level security', '180 min · site roles and negative tests', ['PL-300', 'CISSP'], ['r1-rls-test-pack']],
      ['Day 5', 'Define the analytics service and its service levels', '150 min · value, catalogue entry, measures', ['ITIL', 'PL-300'], ['r1-service-value-proposition', 'r1-service-catalogue-entry-and-service-levels']],
    ]),
  },
  {
    number: 5,
    theme: 'Release the dashboards as a service',
    outcome: 'Build accessible reports, prove they are right and safe, and hand a supported service to operations.',
    tasks: makeTasks(5, [
      ['Day 1', 'Design the executive and site operations pages', '180 min · audience and task design', ['PL-300', 'PMP'], ['r1-executive-and-site-operations-reports']],
      ['Day 2', 'Add drillthrough, tooltips and bookmarks', '150 min · navigation that helps', ['PL-300'], ['r1-executive-and-site-operations-reports']],
      ['Day 3', 'Test accuracy, accessibility, performance and access', '180 min · test evidence', ['PL-300', 'PMP', 'CISSP'], ['r1-quality-plan', 'r1-rls-test-pack']],
      ['Day 4', 'Plan workspaces, refresh and deployment', '150 min · governed release', ['PL-300', 'CISSP', 'ITIL'], ['r1-workspace-refresh-and-deployment-plan']],
      ['Day 5', 'Decide Release 1 go-live and hand over to support', '180 min · readiness and handover', ['PMP', 'ITIL', 'PL-300'], ['r1-go-live-readiness-and-support-handover']],
    ]),
  },
  {
    number: 6,
    theme: 'Gate PL-300 and ITIL; open Release 2',
    outcome: 'Close Release 1, prove exam readiness for PL-300 and ITIL, then start the clinician-access release.',
    tasks: makeTasks(6, [
      ['Day 1', 'Close Release 1 and review PL-300 coverage', '120 min · lessons and weak areas', ['PL-300', 'PMP'], ['r1-lessons-learned-register']],
      ['Day 2', 'Timed PL-300 mock 1 and the improvement register', '150 min · mock and improvements', ['PL-300', 'ITIL'], ['r1-continual-improvement-register']],
      ['Day 3', 'PL-300 mock 2 and the first service review', '180 min · mock and service review', ['PL-300', 'ITIL'], ['r1-service-catalogue-entry-and-service-levels']],
      ['Day 4', 'Exam gate: PL-300 and ITIL Foundation', '180 min · sit only if the checks are met', ['PL-300', 'ITIL'], []],
      ['Day 5', 'Map the current clinician access process', '180 min · accounts, approvals, delays', ['PMP', 'CISSP', 'ITIL'], ['r2-current-state-clinician-access-process']],
    ]),
  },
  {
    number: 7,
    theme: 'Plan Release 2',
    outcome: 'Baseline the clinician-access release: schedule, cost, procurement, change and a controlled scope decision.',
    tasks: makeTasks(7, [
      ['Day 1', 'Build the Release 2 WBS and schedule', '210 min · critical path', ['PMP'], ['r2-release-2-schedule-and-cost-baseline']],
      ['Day 2', 'Estimate cost, resources and reserves', '150 min · cost baseline', ['PMP'], ['r2-release-2-schedule-and-cost-baseline']],
      ['Day 3', 'Plan procurement and vendor risk', '150 min · contract and supplier controls', ['PMP', 'CISSP', 'ITIL'], ['r2-procurement-and-vendor-risk-plan']],
      ['Day 4', 'Plan clinician change, communication and training', '150 min · adoption measures', ['PMP', 'ITIL'], ['r2-change-communication-and-training-plan']],
      ['Day 5', 'Decide a scope change through change control', '180 min · impact and decision record', ['PMP', 'CISSP', 'ITIL'], ['r1-change-control-process']],
    ]),
  },
  {
    number: 8,
    theme: 'Build and assure access',
    outcome: 'Design the future access process and controls, test them with clinicians, and measure them on a dashboard.',
    tasks: makeTasks(8, [
      ['Day 1', 'Map the access-request value stream and design joiner-mover-leaver', '180 min · flow and lifecycle', ['ITIL', 'CISSP', 'PMP'], ['r2-access-request-value-stream', 'r2-joiner-mover-leaver-workflow', 'r2-future-state-access-process']],
      ['Day 2', 'Build the role matrix and fix duty conflicts', '180 min · least privilege', ['CISSP'], ['r2-role-to-permission-matrix', 'r2-segregation-of-duties-analysis']],
      ['Day 3', 'Design MFA, single sign-on and privileged access', '180 min · assurance and recovery', ['CISSP'], ['r2-mfa-and-sso-recommendation', 'r2-privileged-account-process']],
      ['Day 4', 'Run UAT, access reviews and exceptions', '210 min · tests and attestations', ['PMP', 'CISSP', 'ITIL'], ['r2-user-acceptance-test-scripts', 'r2-quarterly-access-review-workflow', 'r2-access-exception-process']],
      ['Day 5', 'Build the access-governance dashboard', '210 min · eight access measures', ['PL-300', 'CISSP'], ['r2-access-governance-dashboard']],
    ]),
  },
  {
    number: 9,
    theme: 'Lead Release 2 under pressure',
    outcome: 'Practise PMP judgment on real Beacon situations, report status with earned value, and sit two full mocks.',
    tasks: makeTasks(9, [
      ['Day 1', 'People: resolve conflict and lead the release team', '180 min · team charter and conflict record', ['PMP'], ['r2-team-charter-and-conflict-record']],
      ['Day 2', 'Process: report status with earned value', '180 min · status report', ['PMP'], ['r2-earned-value-status-report']],
      ['Day 3', 'Business environment: compliance, change and support', '150 min · service desk knowledge model', ['PMP', 'ITIL'], ['r2-service-desk-knowledge-and-escalation-model']],
      ['Day 4', 'Timed PMP mock 1', '240 min · domain-balanced review', ['PMP'], []],
      ['Day 5', 'Timed PMP mock 2', '240 min · explain every correction', ['PMP'], []],
    ]),
  },
  {
    number: 10,
    theme: 'Gate PMP; open Release 3',
    outcome: 'Close Release 2, confirm PMP readiness, then plan the cyber-resilience release.',
    tasks: makeTasks(10, [
      ['Day 1', 'Close Release 2 and check your PMP application', '150 min · closure and benefits', ['PMP', 'ITIL'], ['r2-release-2-closure-report']],
      ['Day 2', 'Repair weak PMP areas', '180 min · teach-back without notes', ['PMP'], []],
      ['Day 3', 'Exam gate: PMP', '240 min · sit only if the checks are met', ['PMP'], []],
      ['Day 4', 'Plan Release 3 and the business impact analysis', '150 min · release plan', ['PMP', 'CISSP', 'ITIL'], ['r3-release-3-plan']],
      ['Day 5', 'Profile security events and build the system inventory', '180 min · inventory and data quality', ['PL-300', 'CISSP'], ['r3-critical-clinical-system-inventory']],
    ]),
  },
  {
    number: 11,
    theme: 'Detect and respond',
    outcome: 'Design visibility, classify incidents, prepare for ransomware, and measure security operations.',
    tasks: makeTasks(11, [
      ['Day 1', 'Design network segmentation and security logging', '180 min · zones and log sources', ['CISSP'], ['r3-network-segmentation-and-logging-design']],
      ['Day 2', 'Classify incidents and write the ransomware playbook', '180 min · triage through recovery', ['CISSP', 'ITIL'], ['r3-incident-classification-model', 'r3-ransomware-response-playbook', 'r3-incident-and-problem-management-workflow']],
      ['Day 3', 'Build the escalation and breach-notification matrix', '120 min · who is told, when', ['CISSP', 'PMP'], ['r3-escalation-and-breach-notification-matrix']],
      ['Day 4', 'Prioritize vulnerability remediation', '180 min · exploitability and impact', ['CISSP'], ['r3-vulnerability-remediation-plan']],
      ['Day 5', 'Build the security-operations dashboard', '210 min · incidents and control health', ['PL-300', 'CISSP'], ['r3-security-operations-dashboard']],
    ]),
  },
  {
    number: 12,
    theme: 'Recover and learn',
    outcome: 'Set recovery targets for clinical systems, test recovery, manage supplier risk, and learn from incidents.',
    tasks: makeTasks(12, [
      ['Day 1', 'Complete the business impact analysis', '180 min · clinical impact and priorities', ['CISSP', 'PMP', 'ITIL'], ['r3-business-impact-analysis']],
      ['Day 2', 'Set and test RTO and RPO for clinical systems', '150 min · targets and restore tests', ['CISSP'], ['r3-rto-and-rpo-recommendation', 'r3-control-testing-plan']],
      ['Day 3', 'Write the recovery and downtime plan and run the tabletop', '210 min · plan and exercise', ['CISSP', 'PMP'], ['r3-disaster-recovery-and-downtime-plan', 'r3-tabletop-exercise-scenario']],
      ['Day 4', 'Assess supplier and software risk', '180 min · contracts and secure development', ['CISSP', 'PMP'], ['r3-supplier-and-software-risk-assessment']],
      ['Day 5', 'Run the post-incident and major-incident reviews', '150 min · causes and improvements', ['ITIL', 'PMP', 'CISSP'], ['r3-post-incident-review', 'r3-major-incident-service-restoration-review']],
    ]),
  },
  {
    number: 13,
    theme: 'Prove readiness and close Beacon',
    outcome: 'Review all eight CISSP domains through Beacon, sit the final mocks and gate, then close the programme.',
    tasks: makeTasks(13, [
      ['Day 1', 'Review the eight CISSP domains through Beacon', '210 min · residual risk register', ['CISSP'], ['r3-residual-risk-register']],
      ['Day 2', 'Adaptive CISSP practice', '180 min · confidence calibration', ['CISSP'], []],
      ['Day 3', 'Two CISSP mocks', '240 min · every error reviewed', ['CISSP'], []],
      ['Day 4', 'Exam gate: CISSP', '180 min · sit only if the checks are met', ['CISSP'], []],
      ['Day 5', 'Close Beacon and publish your portfolio', '180 min · closure report', ['PMP', 'PL-300', 'CISSP', 'ITIL'], ['r3-programme-closure-report']],
    ]),
  },
];

const categoryProfiles = {
  pmp: {
    concepts: ['Value delivery', 'Requirements traceability', 'Tailoring and governance'],
    domains: ['PMP · People', 'PMP · Process', 'PMP · Business Environment'],
    rubric: ['Names an accountable owner', 'Uses measurable acceptance criteria', 'Records assumptions and constraints', 'Connects decisions to business value', 'Is versioned and reviewable'],
  },
  bi: {
    concepts: ['Data preparation', 'Semantic modelling', 'Analytical communication'],
    domains: ['PL-300 · Prepare the data', 'PL-300 · Model the data', 'PL-300 · Visualize and analyze'],
    rubric: ['States the grain and source', 'Documents transformation logic', 'Reconciles to expected totals', 'Uses accessible audience-led design', 'Records performance and security tests'],
  },
  security: {
    concepts: ['Risk-based control selection', 'Least privilege', 'Defense in depth'],
    domains: ['CISSP · Security and Risk Management', 'CISSP · Security Architecture', 'CISSP · Security Operations'],
    rubric: ['Identifies owner and protected asset', 'Links threats to justified controls', 'Defines testable acceptance criteria', 'Addresses lifecycle and recovery', 'Records residual risk and approval'],
  },
  integrated: {
    concepts: ['Governed delivery', 'Evidence-based analysis', 'Risk-informed design'],
    domains: ['PMP · Process', 'PL-300 · Analyze and manage', 'CISSP · Security assessment', 'ITIL · Value system and lifecycle'],
    rubric: ['Frames the business decision', 'Uses traceable and reconciled data', 'Protects access and sensitive assets', 'Includes test evidence', 'Explains trade-offs and residual risk'],
  },
  itil: {
    concepts: ['Value co-creation', 'Product and service lifecycle', 'Continual improvement'],
    domains: ['ITIL · Value system', 'ITIL · Product and service lifecycle', 'ITIL · Management practices'],
    rubric: ['Defines the service consumer and desired outcome', 'Maps the end-to-end value stream', 'Considers all four dimensions', 'Uses measurable service and experience indicators', 'Creates an owned continual-improvement action'],
  },
} as const;

function deliverable(
  projectKey: string,
  title: string,
  category: keyof typeof categoryProfiles,
  summary: string,
): Deliverable {
  const profile = categoryProfiles[category];
  const key = `${projectKey}-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}`;
  return {
    key,
    title,
    summary,
    concepts: [...profile.concepts],
    domains: [...profile.domains],
    why: `${title} turns a Beacon decision into evidence that delivery, analytics, privacy, security and service reviewers can inspect rather than assume.`,
    rubric: [...profile.rubric],
    reflections: [
      `Explain the most important decision in your ${title.toLowerCase()} without notes.`,
      'What evidence would change your recommendation?',
      'Who owns the remaining risk, and why?',
    ],
    template: `Decision or problem\n\nAccountable owner\n\nInputs and assumptions\n\nAnalysis or design\n\nAcceptance and test evidence\n\nSecurity and privacy considerations\n\nTrade-offs and residual risk\n\nRecommendation and next action`,
  };
}

const r1 = (title: string, category: keyof typeof categoryProfiles, summary: string) => deliverable('r1', title, category, summary);
const r2 = (title: string, category: keyof typeof categoryProfiles, summary: string) => deliverable('r2', title, category, summary);
const r3 = (title: string, category: keyof typeof categoryProfiles, summary: string) => deliverable('r3', title, category, summary);

export const projects: Project[] = [
  {
    key: 'r1',
    number: 1,
    title: 'Patient-flow analytics service',
    objective: 'Replace emailed Excel extracts with trusted, privacy-safe Power BI dashboards, run as a supported service.',
    narrative: 'Emergency and patient-flow leaders argue over numbers that disagree between sites, and the extracts carry more patient detail than anyone needs. Release 1 gives them one trusted, de-identified view of emergency waits and bed pressure, secured by site and supported by the service desk. Programme-level documents (charter, schedule, RAID log, change control) live here and are used by every release.',
    deliverables: [
      r1('Programme brief', 'integrated', 'One page that explains Beacon: the problem, the three releases, the people and how success is measured.'),
      r1('Exam-to-project coverage map', 'integrated', 'Every exam domain mapped to the Beacon document where you practise it.'),
      r1('Business case', 'pmp', 'Compare options and justify Beacon with measurable patient-flow, access and resilience benefits.'),
      r1('Programme charter', 'integrated', 'Authorize Beacon: sponsor, objectives, scope, budget, milestones, risks and privacy and security success criteria.'),
      r1('Scope statement', 'pmp', 'Define what Release 1 delivers, what it excludes, constraints and how it is accepted.'),
      r1('Requirements and traceability register', 'integrated', 'Trace each need from the emergency and patient-flow leaders to design, test and acceptance.'),
      r1('Work breakdown structure', 'pmp', 'Decompose the programme into releases and testable work packages.'),
      r1('Microsoft Project schedule', 'integrated', 'Sequence the programme, find the critical path, and set the release gates.'),
      r1('Stakeholder register', 'integrated', 'Map clinical, privacy, security and support stakeholders, their influence and engagement.'),
      r1('Communication plan', 'pmp', 'Match messages, channels, owners and cadence to each audience.'),
      r1('RAID log', 'integrated', 'Control risks, assumptions, issues and decisions across the programme.'),
      r1('Change-control process', 'integrated', 'Assess impacts and decide changes through the change-control board before baselines move.'),
      r1('Health information classification register', 'security', 'Classify every data source and report, name owners and custodians, and set handling and retention.'),
      r1('Privacy impact assessment', 'security', 'Show how Beacon collects, uses, protects and minimizes health information before it goes live.'),
      r1('Power Query data-quality workbook', 'bi', 'Profile and repair the emergency, bed and service desk data without hiding evidence.'),
      r1('Quality plan', 'integrated', 'Define data, model, report, performance, accessibility and security quality gates and how they are tested.'),
      r1('Threat model and architecture', 'security', 'Map trust boundaries, threats and controls for the analytics data flow.'),
      r1('Security acceptance criteria', 'integrated', 'Make privacy and security conditions observable before go-live.'),
      r1('Star schema and relationship design', 'bi', 'Define facts, dimensions, grain, keys and filter behaviour for the patient-flow model.'),
      r1('Date table and DAX catalogue', 'bi', 'Document every measure: wait times, length of stay, occupancy, service levels.'),
      r1('RLS test pack', 'integrated', 'Prove each site sees only its own data with positive and negative tests.'),
      r1('Service value proposition', 'itil', 'Define who the analytics service is for, the outcomes it supports, and its costs and risks.'),
      r1('Service catalogue entry and service levels', 'itil', 'Describe the service, its support model, utility, warranty and service-level measures.'),
      r1('Executive and site operations reports', 'bi', 'Accessible pages that answer the questions patient-flow leaders actually ask.'),
      r1('Workspace, refresh and deployment plan', 'integrated', 'Govern workspaces, the app, scheduled refresh, the gateway, monitoring and rollback.'),
      r1('Go-live readiness and support handover', 'integrated', 'Decide go-live on evidence and hand a supported service to the service desk.'),
      r1('Lessons-learned register', 'pmp', 'Capture what Release 1 taught the programme while it is fresh.'),
      r1('Continual-improvement register', 'itil', 'Prioritize measurable improvements to the analytics service after go-live.'),
    ],
  },
  {
    key: 'r2',
    number: 2,
    title: 'Clinician identity and access',
    objective: 'Give every clinician the right access on day one and remove it on the last day, with proof.',
    narrative: 'Nurses wait days for access while agency nurses and vendor engineers keep accounts long after they leave. Release 2 links access to HR events and roles, adds MFA and single sign-on, controls privileged accounts, reviews access every quarter, and runs access requests as a measured service through the service desk.',
    deliverables: [
      r2('Current-state clinician access process', 'integrated', 'Show how access is requested and removed today, where it waits, and where control fails.'),
      r2('Release 2 schedule and cost baseline', 'pmp', 'Sequence, estimate and baseline the release with reserves.'),
      r2('Procurement and vendor-risk plan', 'integrated', 'Choose the contract approach and the supplier controls for the identity platform and agency access.'),
      r2('Change, communication and training plan', 'pmp', 'Prepare clinicians for MFA, single sign-on and new request routes, and measure adoption.'),
      r2('Access-request value stream', 'itil', 'Map an access request across the ITIL lifecycle stages it touches and remove the waits.'),
      r2('Joiner-mover-leaver workflow', 'security', 'Drive provisioning, changes and removal from HR events.'),
      r2('Future-state access process', 'integrated', 'Design a governed, measurable authorization journey.'),
      r2('Role-to-permission matrix', 'security', 'Map each clinical and support role to least-privilege permissions.'),
      r2('Segregation-of-duties analysis', 'security', 'Find toxic permission combinations and fix or compensate them.'),
      r2('MFA and SSO recommendation', 'security', 'Balance identity assurance, clinical workflow speed, recovery and federation risk.'),
      r2('Privileged-account process', 'security', 'Control elevation, monitoring, emergency use and review of administrator access.'),
      r2('User-acceptance test scripts', 'integrated', 'Test access with real clinical roles, including what must be refused.'),
      r2('Quarterly access-review workflow', 'security', 'Make manager attestations timely, complete and auditable.'),
      r2('Access exception process', 'integrated', 'Time-bound, approved and monitored exceptions with a named risk owner.'),
      r2('Access-governance dashboard', 'integrated', 'Show enabled and disabled accounts, missed leavers, privileged accounts, MFA gaps, review completion, overdue reviews, duty conflicts and request time.'),
      r2('Team charter and conflict record', 'pmp', 'Agree how the release team works and record how a real conflict was resolved.'),
      r2('Earned value status report', 'pmp', 'Report Beacon status with planned value, earned value, actual cost and forecasts.'),
      r2('Service desk knowledge and escalation model', 'itil', 'Give the service desk reusable knowledge, escalation paths and targets for access issues.'),
      r2('Release 2 closure report', 'pmp', 'Confirm acceptance, benefits so far and handover of the access service.'),
    ],
  },
  {
    key: 'r3',
    number: 3,
    title: 'Cyber resilience',
    objective: 'Keep caring for patients through a cyber attack and recover clinical systems within agreed targets.',
    narrative: 'After a ransomware attack at another hospital, Kestrel’s board asked whether care could continue if the clinical systems went down. Nobody has tested a restore of the clinical information system in over a year. Release 3 sets recovery priorities with clinicians, prepares detection and response, tests recovery, manages supplier risk, and closes the programme.',
    deliverables: [
      r3('Release 3 plan', 'pmp', 'Scope, schedule, resources and approach for the cyber-resilience release.'),
      r3('Critical clinical system inventory', 'security', 'Every clinical system with owner, tier, dependencies, hosting and support status.'),
      r3('Network segmentation and logging design', 'security', 'Zones, allowed flows and the log sources the security operations centre needs.'),
      r3('Incident classification model', 'security', 'Consistent severity, priority and escalation for security incidents.'),
      r3('Ransomware response playbook', 'security', 'Preparation, detection, containment, eradication, recovery and lessons for ransomware.'),
      r3('Incident and problem management workflow', 'itil', 'Restore service fast while problem management removes causes.'),
      r3('Escalation and breach-notification matrix', 'integrated', 'Who is told, by whom, how fast, including privacy breach duties.'),
      r3('Vulnerability-remediation plan', 'security', 'Fix vulnerabilities in order of risk to patient care.'),
      r3('Security-operations dashboard', 'integrated', 'Show incidents by severity, detection, containment and recovery times, vulnerabilities by age, control results and restore performance.'),
      r3('Business impact analysis', 'integrated', 'Rank clinical services by patient-safety, operational, financial and legal impact over time.'),
      r3('RTO and RPO recommendation', 'security', 'Set business-approved recovery time and data-loss tolerances for each clinical system.'),
      r3('Control-testing plan', 'integrated', 'Define population, sample, evidence, expected result and remediation for key controls.'),
      r3('Disaster-recovery and downtime plan', 'security', 'Executable recovery steps plus paper downtime procedures for clinical areas.'),
      r3('Tabletop-exercise scenario', 'integrated', 'Test decisions and assumptions through a realistic ransomware scenario.'),
      r3('Supplier and software risk assessment', 'security', 'Assess vendors and software for security, privacy and continuity risk.'),
      r3('Post-incident review', 'integrated', 'Find systemic causes and assign corrective actions without blame.'),
      r3('Major-incident service restoration review', 'itil', 'Evaluate restoration, communication, workarounds and improvements after a major incident.'),
      r3('Residual risk register', 'security', 'The risks left after Beacon, with owners and acceptance decisions.'),
      r3('Programme closure report', 'pmp', 'Close Beacon: outcomes against the business case, handovers, lessons and acceptance.'),
    ],
  },
];

export const coverageRows = [
  ['Programme RAID log', 'Risk responses and issues', 'Risk trend and exposure analysis', 'Security risk management', 'Outcomes, costs, risks and value'],
  ['Stakeholder register', 'Stakeholder engagement', 'Audience and report design', 'Governance roles and accountability', 'Service relationships and value co-creation'],
  ['Privacy impact assessment', 'Compliance and governance', 'De-identified, aggregated model', 'Asset security and privacy', 'Information and technology dimension'],
  ['Row-level security by site', 'Requirements validation', 'Model security', 'IAM and least privilege', 'Information and technology dimension'],
  ['UAT, RLS and control testing', 'Quality and acceptance', 'Report validation', 'Security assessment and testing', 'Build and Transition stage assurance'],
  ['Change requests (CR-01)', 'Integrated change control', 'Deployment governance', 'Configuration and change management', 'Change control in the Transition stage'],
  ['Business impact analysis', 'Business value and priorities', 'Executive impact reporting', 'Business continuity planning', 'Service continuity and warranty'],
  ['Microsoft Project schedule', 'Schedule and resources', 'Milestone analysis', 'Security work packages', 'Value-stream flow and dependencies'],
  ['Star schema', 'Solution requirements', 'Semantic model design', 'Data integrity and asset handling', 'Information and technology dimension'],
  ['Access-governance dashboard', 'Benefits and stakeholder reporting', 'Prepare, model, visualize', 'Identity lifecycle and audit', 'Measure and improve service outcomes'],
  ['Ransomware playbook', 'Team roles and communications', 'Operational metrics', 'Incident response and recovery', 'Incident management and service restoration'],
  ['Procurement and vendor risk', 'Procurement and risk', 'Supplier performance analysis', 'Supply-chain security', 'Partners and Suppliers dimension'],
  ['Lessons learned and service review', 'Continuous improvement', 'Outcome analysis', 'Post-incident learning', 'Continual improvement'],
] as const;

export const labCards = [
  {
    key: 'lab-sql',
    title: 'SQL reconciliation lab',
    certification: 'PL-300 · CISSP',
    brief: 'Load the Kestrel SQL seed, find orphaned keys, and reconcile staff, asset, security-event and ticket counts.',
    steps: ['Run the seed in SQLite', 'Find staff, security-event and ticket orphans', 'Create clean analytical views', 'Compare results to the expected answers at the end of the file', 'Record each exception and its control owner'],
    download: '/datasets/khn_lab.sql',
  },
  {
    key: 'lab-power-query',
    title: 'Power Query repair lab',
    certification: 'PL-300',
    brief: 'Build a repeatable query that cleans the emergency visit extract without silently deleting evidence.',
    steps: ['Turn on column profiling for the entire data set', 'Set explicit data types', 'Quarantine invalid dates, impossible times and unexpected CTAS values', 'Remove exact duplicates using the visit ID', 'Reconcile the clean output to quality-and-reconciliation.md'],
    download: '/datasets/khn_ed_visits.csv',
  },
  {
    key: 'lab-dax',
    title: 'DAX patient-flow lab',
    certification: 'PL-300',
    brief: 'Create documented measures for waits, length of stay, occupancy and service levels, and test them.',
    steps: ['Create and mark a date table', 'Write visit, median wait and LWBS measures', 'Write the semi-additive occupancy measure', 'Use DIVIDE for every ratio', 'Test totals by site, CTAS level and month'],
    download: '/datasets/dax-measure-starters.md',
  },
  {
    key: 'lab-architecture',
    title: 'Security architecture lab',
    certification: 'CISSP · PMP',
    brief: 'Draw the Beacon analytics data flow and trust boundaries before choosing controls.',
    steps: ['Place sources, warehouse, gateway, Power BI service and users', 'Mark trust boundaries and classifications', 'Add identity, encryption, logging and backup controls', 'Write misuse cases', 'Record residual risks and who accepts them'],
    download: '/datasets/security-architecture-template.md',
  },
  {
    key: 'lab-ms-project',
    title: 'Microsoft Project schedule lab',
    certification: 'PMP · CISSP · PL-300 · ITIL',
    brief: 'Import the Beacon schedule, find the critical path and check the release gates.',
    steps: ['Import the CSV into Microsoft Project', 'Map task, duration, predecessor and resource fields', 'Set the project calendar', 'Find the critical path and float', 'Export a milestone snapshot for Power BI'],
    download: '/datasets/khn_schedule.csv',
  },
  {
    key: 'lab-itil-value-stream',
    title: 'ITIL value-stream lab',
    certification: 'ITIL · PMP · PL-300',
    brief: 'Map the clinician access-request value stream across the eight lifecycle stages and find where requests wait.',
    steps: ['Define the consumer and desired outcome', 'Place each step in its lifecycle stage', 'Check the four dimensions', 'Measure work time and wait time from the service desk data', 'Record the improvement with an owner and a measure'],
    download: '/datasets/itil-value-stream-template.md',
  },
] as const;

export const flashcards = [
  ['PMP', 'What makes a requirement traceable?', 'A unique source, owner, business rationale, acceptance criterion, status, and link to the delivered/tested outcome.'],
  ['PMP', 'Risk versus issue?', 'A risk is uncertain; an issue has occurred. Each needs an owner, but their response mechanics differ.'],
  ['PMP', 'What should happen before approving a change?', 'Assess effects on value, scope, schedule, cost, quality, resources, risk, security, and affected stakeholders.'],
  ['PL-300', 'Why define fact-table grain first?', 'It prevents mixed-level facts, ambiguous relationships, and misleading aggregation.'],
  ['PL-300', 'Measure versus calculated column?', 'A measure evaluates in filter context at query time; a calculated column is stored per row at refresh.'],
  ['PL-300', 'Why prefer a star schema?', 'It creates predictable filters, simpler DAX, understandable business dimensions, and efficient analysis.'],
  ['PL-300', 'What does RLS protect?', 'It filters model rows for a user or role; it does not replace source security, workspace governance, or object permissions.'],
  ['CISSP', 'Data owner versus custodian?', 'The owner decides classification and acceptable use; the custodian implements handling and operational controls.'],
  ['CISSP', 'RTO versus RPO?', 'RTO is tolerated service outage time; RPO is tolerated data loss measured backward in time.'],
  ['CISSP', 'Least privilege versus segregation of duties?', 'Least privilege limits access to need; segregation of duties prevents one identity from controlling incompatible steps.'],
  ['CISSP', 'Why test backups?', 'A successful backup job does not prove data can be restored within recovery objectives.'],
  ['ITIL', 'Utility versus warranty?', 'Utility is what the service does to support outcomes; warranty is assurance that it is available, secure, continuous, and capable enough for use.'],
  ['ITIL', 'What is value co-creation?', 'Providers, consumers, and other stakeholders collaborate through service relationships to realize outcomes rather than value being delivered one-way.'],
  ['ITIL', 'What are the four dimensions?', 'Organizations and people; information and technology; partners and suppliers; value streams and processes.'],
  ['ITIL', 'Incident versus problem?', 'Incident management restores normal service quickly; problem management reduces the likelihood and impact of incidents by addressing causes and known errors.'],
  ['ITIL', 'Why start where you are?', 'Use existing services, data, practices, and capabilities objectively before deciding what must change.'],
  ['ITIL', 'What makes continual improvement measurable?', 'A defined current state, target state, prioritized actions, owners, measures, and an evaluation of whether value improved.'],
  ['Intersection', 'Why tie controls to acceptance criteria?', 'It gives the sponsor and security owner observable evidence for authorization and project closure.'],
] as const;

export const scenarioBank: ScenarioQuestion[] = [
  {
    "id": "q-x-01",
    "certification": "Intersection",
    "domain": "PMP Manage and control changes · Health Information Act · PL-300 Model security",
    "prompt": "Janelle Cardinal, business owner of bed data, asks for the bed dashboard to list alternate level of care (ALC) patients by name and bed number so her team can chase discharges. The dashboard is classified Confidential and built on de-identified, aggregated data. What should you do first?",
    "options": [
      [
        "A",
        "Build the list, because Janelle is the business owner of the bed data and has the authority to decide which of her staff may see patient names."
      ],
      [
        "B",
        "Log it as a change request with an impact assessment, including Priya Raman's privacy review against the Health Information Act, for the board."
      ],
      [
        "C",
        "Add the list behind a row-level security (RLS) role so that only Janelle's own team can see the patient names and bed numbers."
      ],
      [
        "D",
        "Reject the request yourself, because the Health Information Act forbids patient names on any report or dashboard."
      ]
    ],
    "correct": "B",
    "explanation": "The request touches scope, privacy, security and the model at once, so it goes through change control with a privacy review. Under sections 57 and 58 of the Health Information Act, Kestrel must use the highest degree of anonymity possible and only the information essential to the purpose. That is why the board approved unit-level ALC counts and days instead (CR-01), with the care team using the Clinical Information System for patient detail.",
    "incorrect": {
      "A": "Owning the data does not override the Health Information Act or change control, and names would make the dashboard Restricted.",
      "C": "RLS limits who sees rows. It does not show that names are essential, and it skips the change and privacy decisions.",
      "D": "The Act requires the least information and highest anonymity for the purpose; it is not a blanket ban. The decision belongs to the board, informed by a privacy review."
    },
    "artifactKey": "r1-change-control-process"
  },
  {
    "id": "q-x-02",
    "certification": "Intersection",
    "domain": "PMP Plan and manage procurement · CISSP Security and Risk Management · ITIL Partners and Suppliers",
    "prompt": "For Release 3, Kestrel plans to have Sentinel SOC Services (V-04) monitor logs from the Identity Directory and the Clinical Information System. Sentinel processes security log data in the United States (risk R-05). The contract change is ready to sign. What should happen before any logs flow?",
    "options": [
      [
        "A",
        "Stop the change, because Alberta law bans storing or processing health information outside Canada, so a Canadian monitoring provider is needed instead."
      ],
      [
        "B",
        "Sign now, because security logs are technical records about systems and contain no personal or health information."
      ],
      [
        "C",
        "Sign now, and ask Sentinel to show evidence of its privacy and security safeguards at the first annual contract review next year."
      ],
      [
        "D",
        "Have Priya Raman review the personal and health information in the logs and the safeguards for use outside Alberta, and put them in the contract."
      ]
    ],
    "correct": "D",
    "explanation": "Supplier risk sits across procurement, privacy and security. Section 60 of the Health Information Act requires safeguards that protect health information stored or used outside Alberta, so the privacy review and the contract terms must come before the data moves. This is R-05's response: privacy review and contract safeguards, owned by Priya Raman.",
    "incorrect": {
      "A": "No Alberta statute bans this. The Health Information Act requires safeguards for health information used outside Alberta. A keep-in-Canada rule would be a Kestrel policy or contract term.",
      "B": "Logs carry user IDs and names, and access logs from a clinical system can identify the patients whose records were opened.",
      "C": "Evidence a year later does not put the required safeguards in place before the data moves."
    },
    "artifactKey": "r3-supplier-and-software-risk-assessment"
  },
  {
    "id": "q-x-03",
    "certification": "Intersection",
    "domain": "ITIL Change · CISSP Communication and Network Security · PMP Manage conflicts",
    "prompt": "After a facilitated session, Tomás Rivera and Ahmed Haddad agree what the firewall change for the on-premises data gateway must allow and when it should happen. What is the best next step?",
    "options": [
      [
        "A",
        "Raise a normal change allowing only the traffic the gateway needs, with a rollback plan, authorized for the agreed window."
      ],
      [
        "B",
        "Let Ahmed apply the firewall rule tonight, since the two people who disagreed now agree on exactly what it must allow."
      ],
      [
        "C",
        "Open a broad firewall rule now so refresh testing can continue, and narrow it to the minimum needed after go-live."
      ],
      [
        "D",
        "Install a personal-mode gateway on Tomás's workstation, so that no firewall change is needed and testing starts today."
      ]
    ],
    "correct": "A",
    "explanation": "The conflict is settled, but the change still needs control. A normal change is assessed, authorized and scheduled. Limiting the rule to the minimum traffic the gateway needs follows least privilege, and a tested rollback plan protects the network that carries clinical traffic if something goes wrong.",
    "incorrect": {
      "B": "Agreement between two people is not change authorization, and an unrecorded change is hard to review or roll back.",
      "C": "A broad rule breaks least privilege and exposes the clinical network, and temporary rules tend to stay.",
      "D": "This ties refresh to one person's computer (R-06) and bypasses the governed gateway design."
    },
    "artifactKey": "r1-workspace-refresh-and-deployment-plan"
  },
  {
    "id": "q-x-04",
    "certification": "Intersection",
    "domain": "CISSP Identity and Access Management · ITIL Problem management · PMP Remove impediments and manage issues",
    "prompt": "Profiling identity data for Release 2, Mei Tanaka finds that Olivia Grant (E-014), an agency nurse whose contract has ended, still has an enabled account with order-entry permission in the Clinical Information System. What should happen first?",
    "options": [
      [
        "A",
        "Leave the account for the joiner-mover-leaver automation that Release 2 will deliver, which will disable it along with all the others."
      ],
      [
        "B",
        "Delete the account and its whole audit history now, so that the identity record is clean before the quarterly access review begins."
      ],
      [
        "C",
        "Disable the account and remove its permissions now, check its use since the contract ended, and log the issue for a leaver-process fix."
      ],
      [
        "D",
        "Email Olivia Grant to ask whether she still needs access, and disable the account straight away if she says no."
      ]
    ],
    "correct": "C",
    "explanation": "Contain the exposure first by disabling the account and removing its permissions. Then check activity after the end date, because any use since then could be unauthorized access to health information that must be assessed under the Health Information Act's breach rules. Finally, log the issue (I-02) and remove the cause: how ClearPath end dates reach Kestrel.",
    "incorrect": {
      "A": "The exposure exists today. Waiting weeks leaves an active account with clinical permissions.",
      "B": "Deleting audit history destroys the evidence needed to see whether the account was used after the contract ended.",
      "D": "A former contractor cannot authorize her own access, and the account stays open while you wait."
    },
    "artifactKey": "r2-joiner-mover-leaver-workflow"
  },
  {
    "id": "q-x-05",
    "certification": "Intersection",
    "domain": "PL-300 Model the data · CISSP Identity and Access Management · PMP Plan and optimize quality of products/deliverables",
    "prompt": "A week before the Release 1 gate, the site operations page is slow for site users. A Lumen consultant suggests removing row-level security (RLS) from the semantic model, because pages load faster without it, and publishing a separate report for each site instead. What should you do?",
    "options": [
      [
        "A",
        "Keep RLS and use Performance Analyzer and DAX query view to find the slow visuals and measures, then fix and retest them."
      ],
      [
        "B",
        "Remove RLS as the consultant suggests, since one report per site gives each site the same protection with faster pages for everyone."
      ],
      [
        "C",
        "Accept the slow page for go-live and record the performance problem in the lessons-learned register for Release 2."
      ],
      [
        "D",
        "Switch every table to DirectQuery so the data stays in the warehouse and each page loads faster for site users."
      ]
    ],
    "correct": "A",
    "explanation": "Security controls are not a performance budget to spend. Performance Analyzer and DAX query view show which visuals and measures are slow, so the team can fix the cause while RLS keeps each site to its own data. Retest both performance and RLS before the gate.",
    "incorrect": {
      "B": "Separate reports are harder to govern and easy to share wrongly, and anyone with access to the shared model could still see every site.",
      "C": "Performance is a quality criterion. A page too slow to use damages adoption from day one.",
      "D": "DirectQuery usually makes visuals slower, not faster, and changing storage mode this late is an untested design change."
    },
    "artifactKey": "r1-rls-test-pack"
  },
  {
    "id": "q-x-06",
    "certification": "Intersection",
    "domain": "CISSP Security Operations · ITIL Incident management · PMP Plan and manage communication",
    "prompt": "In the Release 3 tabletop exercise, ransomware encrypts the Clinical Information System at 07:00 on a weekday. At 07:30 Kevin Park wants to restore from last night's backup at once to meet the 4-hour recovery time objective (RTO). The emergency department is already on downtime procedures. What is the best response?",
    "options": [
      [
        "A",
        "Restore from last night's backup at once, because meeting the 4-hour RTO is the top priority for patient care."
      ],
      [
        "B",
        "Hold all updates to clinical areas until the system is back, so that busy staff on downtime procedures are not confused by changing estimates."
      ],
      [
        "C",
        "Keep the system isolated until containment and a clean backup are confirmed, while the service desk updates clinical areas regularly."
      ],
      [
        "D",
        "Wipe and rebuild every server first, and decide how and when to communicate with clinical areas once recovery is under way."
      ]
    ],
    "correct": "C",
    "explanation": "Incident response contains the threat before recovery, and a restore is only safe from a backup known to be clean. Major-incident handling runs alongside: the service desk keeps clinical areas informed while they work on downtime procedures. The RTO matters, but not enough to justify restoring into an active attack.",
    "incorrect": {
      "A": "Restoring before containment, or from a backup not yet checked, can reinfect the system and lose more time than it saves.",
      "B": "Clinicians on downtime procedures need regular, honest updates to plan care. Silence leads to unsafe workarounds.",
      "D": "Eradication and recovery follow scoping and containment, and communication cannot wait for recovery."
    },
    "artifactKey": "r3-ransomware-response-playbook"
  },
  {
    "id": "q-x-07",
    "certification": "Intersection",
    "domain": "CISSP Security and Risk Management · ITIL Warranty · PMP Plan and manage risk",
    "prompt": "The Clinical Information System has a 4-hour recovery time objective (RTO), but its two restore tests took 9.0 and 13.5 hours, the last on 2025-08-14 (risk R-04). In a Release 3 meeting someone proposes setting the RTO to 14 hours so the next test passes. What is the best response?",
    "options": [
      [
        "A",
        "Set the RTO to 14 hours, because a recovery target the system cannot meet gives clinicians a false sense of safety."
      ],
      [
        "B",
        "Keep the 4-hour RTO and mark the restore control as passed, because the nightly backup jobs complete without errors and are monitored."
      ],
      [
        "C",
        "Ask Meridian Clinical Systems to set the RTO, since they supply the Clinical Information System and know its limits."
      ],
      [
        "D",
        "Keep the RTO as the clinical need, record the gap as a risk, plan fixes and a retest, and have the business accept any residual risk."
      ]
    ],
    "correct": "D",
    "explanation": "Recovery targets come from the business: how long care can tolerate an outage, confirmed through the business impact analysis. When capability falls short, you do not move the target. You treat the gap as a risk, plan improvements and stronger downtime procedures, retest, and have the business owner accept any residual risk. In ITIL terms this is warranty: continuity the consumer can rely on.",
    "incorrect": {
      "A": "The RTO reflects how long care can tolerate the outage. Changing it to fit current capability hides the risk to patients.",
      "B": "A finished backup job does not prove a restore within 4 hours. Both tests show it fails.",
      "C": "The vendor helps meet the target, but Kestrel's clinical leaders decide what outage care can tolerate."
    },
    "artifactKey": "r3-rto-and-rpo-recommendation"
  },
  {
    "id": "q-x-08",
    "certification": "Intersection",
    "domain": "CISSP Identity and Access Management · ITIL Value streams · PMP Remove impediments and manage issues",
    "prompt": "Issue I-01: Kevin Park (E-009) can provision accounts, approve access requests and administer the Identity Directory audit logs, and he granted 62.6% of current user permissions. Grace Liu worries that removing his approval rights will make access requests, already at a median of 4.26 days, even slower. What should you do?",
    "options": [
      [
        "A",
        "Leave Kevin's rights in place until the value-stream redesign is live, then separate the duties in a way that does not slow access for clinicians."
      ],
      [
        "B",
        "Separate the duties now, giving approval to business owners and audit logs to security, and speed up requests through the value stream."
      ],
      [
        "C",
        "Keep his rights, and ask him to sign a statement that he will never approve his own access or change the logs."
      ],
      [
        "D",
        "Remove only his audit-log rights, since approving and provisioning together is what keeps access requests moving for clinicians."
      ]
    ],
    "correct": "B",
    "explanation": "Segregation of duties stops one identity from controlling incompatible steps: here granting, approving and covering the trail. Kestrel's rule allows no one to hold two of these on the Identity Directory. Request speed is a real need, but the fix is to remove waits in the value stream, not to keep a toxic combination.",
    "incorrect": {
      "A": "One person who can grant, approve and change the evidence is a live control failure. Speed does not justify keeping it.",
      "C": "He has already approved his own rights. A promise is not a control, and he could still alter the logs.",
      "D": "Approving and provisioning are also incompatible under Kestrel's rule, so one person would still control the whole grant."
    },
    "artifactKey": "r2-segregation-of-duties-analysis"
  },
  {
    "id": "q-x-09",
    "certification": "Intersection",
    "domain": "PMP Plan and manage schedule · CISSP Legal, regulatory and compliance",
    "prompt": "Suppose the privacy impact assessment had slipped. On 2026-10-01 the programme register shows WP-102 (privacy impact assessment and threat model) at 90% complete against 100% planned, and schedule task 4, Complete privacy impact assessment, has zero total float. Dr. Helen Marchetti suggests starting the production data pipeline from the clinical systems now and submitting the assessment after go-live, to protect the 2026-10-23 go-live gate. What should you do as Programme Manager?",
    "options": [
      [
        "A",
        "Agree, and submit the assessment after go-live, because the delay is small."
      ],
      [
        "B",
        "Move the go-live gate quietly and tell stakeholders once the assessment is done."
      ],
      [
        "C",
        "Keep identifying data out of production until the assessment has been submitted to the Commissioner, let model work continue on test data, and take the schedule impact and recovery options to change control."
      ],
      [
        "D",
        "Take task 4 off the critical path by deleting its links in Microsoft Project."
      ]
    ],
    "correct": "C",
    "explanation": "Task 4 is on the critical path, so its delay threatens the gate unless time is recovered elsewhere. The answer combines PMP judgment (assess the impact and decide through change control) with the privacy duty in section 64 of the Health Information Act (no implementation before the Commissioner has the assessment). Building on synthetic or de-identified test data keeps work moving without breaking the law.",
    "incorrect": {
      "A": "Section 64 requires submission before implementation. A sponsor cannot waive a legal duty.",
      "B": "Silent baseline changes break governance. The board and the sponsor must see the impact and decide.",
      "D": "Deleting links hides the dependency on paper, but the work still depends on it."
    },
    "artifactKey": "r1-microsoft-project-schedule"
  },
  {
    "id": "q-x-10",
    "certification": "Intersection",
    "domain": "PL-300 Model the data · Kestrel small-count rule · Quality testing",
    "prompt": "D-02 approved go-live on condition that small-count suppression for PGH is verified in the RLS test pack. A new page for a regional planning group, outside the care team, shows ED visits by site and disposition in a matrix with totals, using the shared measure from the report specification:\n\n```\nED Visits (Shared) =\nVAR Visits = [ED Visits]\nRETURN\n    IF ( ISBLANK ( Visits ), BLANK (), IF ( Visits < 5, \"<5\", FORMAT ( Visits, \"#,0\" ) ) )\n```\n\nPGH's Admitted cell (4) shows \"<5\". The Admitted column shows KGH 31, ARH 15, CVH 9 and a total of 59. What problem remains, and what is the fix?",
    "options": [
      [
        "A",
        "The total is calculated from unsuppressed counts, so 59 - 31 - 15 - 9 reveals PGH's 4. Also suppress a second cell or the total wherever one suppressed cell could be worked out, and add a subtraction test to the RLS test pack."
      ],
      [
        "B",
        "Nothing remains, because the measure shows every count under 5 as \"<5\"."
      ],
      [
        "C",
        "Show a blank instead of \"<5\" so readers cannot tell that a value exists."
      ],
      [
        "D",
        "Rely on RLS, because the planning group cannot open PGH's site page."
      ]
    ],
    "correct": "A",
    "explanation": "Small-count suppression is a Kestrel policy, not a law, but D-02 made it a go-live condition. Primary suppression hides small cells; complementary suppression hides enough other cells or totals that no hidden cell can be recalculated. The PGH figures come from the cleaned Q3 data (Admitted 4, Discharged 40, LWBS 2, Transferred 9). A good test tries the subtraction, not just a check that small cells show \"<5\".",
    "incorrect": {
      "B": "Each small cell is hidden, but the totals still let anyone recalculate it by subtraction.",
      "C": "A blank does not stop the subtraction. PGH's 4 can still be worked out from the column total.",
      "D": "RLS decides which sites a user may see. It does not stop small counts appearing on a page the user is allowed to open."
    },
    "artifactKey": "r1-rls-test-pack"
  },
  {
    "id": "q-x-11",
    "certification": "Intersection",
    "domain": "PL-300 Secure and govern · CISSP IAM · ITIL Service request",
    "prompt": "Mei Tanaka (E-013, Clinical Analyst at CVH) holds \"view all sites\" on the Beacon semantic model (A-009), granted by Tomás Rivera on 2026-08-24. On A-009, the Clinical Analyst role allows only \"view site dashboards\" and \"build\". Mei says she needs all sites to check reconciliation. What is the best action?",
    "options": [
      [
        "A",
        "Keep it, because analysts need broad access to do their jobs."
      ],
      [
        "B",
        "Make her a workspace Member so RLS no longer limits her."
      ],
      [
        "C",
        "Ask Tomás to confirm the grant, since he gave it."
      ],
      [
        "D",
        "Treat it as an excess grant: remove it or, if the need is real, raise an access request for a time-bound exception that the model's business owner approves as risk owner, and update her RLS role membership and the test pack to match."
      ]
    ],
    "correct": "D",
    "explanation": "Least privilege (CISSP Identity and Access Management) says access follows the role unless an approved exception exists. The service desk request route (ITIL) records the request, approval and expiry, and RLS role membership in Power BI makes the decision real. Her reconciliation need may be met another way, such as a review session with an analyst who already holds all-site access.",
    "incorrect": {
      "A": "Need must be shown and approved. Kestrel's role matrix sets least privilege for analysts.",
      "B": "That removes the RLS boundary completely and adds edit rights, which widens the problem.",
      "C": "The person who granted access cannot independently approve it. The system's business owner approves an exception as risk owner."
    },
    "artifactKey": "r2-access-exception-process"
  },
  {
    "id": "q-x-12",
    "certification": "Intersection",
    "domain": "PL-300 Model the data · CISSP Security Operations",
    "prompt": "You are building the security-operations dashboard. SEC-008's contained time is earlier than its detected time, an impossible sequence. SEC-009 is contained but not yet recovered. How should the incident count, MTTD and MTTR measures handle these records?",
    "options": [
      [
        "A",
        "Delete SEC-008 from the table so every measure is clean."
      ],
      [
        "B",
        "Count both in the 10 incidents; leave SEC-008 out of MTTD, MTTC and MTTR until the SOC liaison confirms the true times; leave SEC-009 out of MTTR only; and show n beside each mean (MTTD 25.29 hours, n = 9; MTTR 28.33 hours, n = 8)."
      ],
      [
        "C",
        "Swap SEC-008's detected and contained times so the sequence works."
      ],
      [
        "D",
        "Treat SEC-009's missing recovery time as zero hours."
      ]
    ],
    "correct": "B",
    "explanation": "A measure must follow stated rules: records with untrustworthy timestamps stay in counts but not in durations, and unfinished incidents stay out of the measure they cannot yet support. Showing n tells Daniel Osei how many incidents each mean rests on, which matters with only 10 incidents in a quarter.",
    "incorrect": {
      "A": "SEC-008 was a real incident. Deleting it understates the incident count and destroys evidence.",
      "C": "That invents data. Only the SOC can say which time is wrong.",
      "D": "Zero would pull MTTR down for an incident that has not been recovered."
    },
    "artifactKey": "r3-security-operations-dashboard"
  },
  {
    "id": "q-x-13",
    "certification": "Intersection",
    "domain": "PMP Manage project closure · CISSP Security and Risk Management",
    "prompt": "At programme closure, suppose the restore retest in task 22 still misses the Clinical Information System's 4-hour RTO, and the fix needs a hardware purchase after Beacon ends. Risk R-04 is still open. What is the best way to deal with it at closure?",
    "options": [
      [
        "A",
        "Close R-04, because the programme is ending."
      ],
      [
        "B",
        "Have Dr. Helen Marchetti, the CIS business owner and sponsor, formally accept or reject the residual risk on Daniel Osei's advice, record it in the residual risk register with compensating measures and a review date, and hand the fix to an operational owner in the closure report."
      ],
      [
        "C",
        "Have Daniel Osei accept the risk, because he is the security owner."
      ],
      [
        "D",
        "Have Kevin Park accept it, because he is the CIS custodian."
      ]
    ],
    "correct": "B",
    "explanation": "Risk acceptance is a management decision by the accountable business owner, made with security advice and recorded with conditions. PMP closure hands open risks to operational owners, and CISSP expects explicit, owned acceptance. Tested downtime procedures are the obvious compensating measure while the restore cannot meet its target.",
    "incorrect": {
      "A": "Closing the programme does not close the risk. It moves to operations with an owner.",
      "C": "Daniel owns R-04 in the RAID log and advises on acceptance, but the business owner who lives with the impact makes the decision.",
      "D": "Custodians run controls. They do not accept risk on behalf of the business."
    },
    "artifactKey": "r3-residual-risk-register"
  },
  {
    "id": "q-x-14",
    "certification": "Intersection",
    "domain": "ITIL Incident and problem management · CISSP Security Operations",
    "prompt": "The Virtual Desktop Service (A-008) had three security incidents in Q3: SEC-002 (malware, July), SEC-004 (ransomware precursor, August) and SEC-008 (malware, September). Each was closed once service was restored. What should happen next?",
    "options": [
      [
        "A",
        "Reopen SEC-004 and keep it open until the cause is found."
      ],
      [
        "B",
        "Rebuild every desktop host again without further analysis."
      ],
      [
        "C",
        "Nothing more, because each incident was closed after service was restored."
      ],
      [
        "D",
        "Open a problem record for the recurring desktop incidents, run a blameless post-incident review of SEC-004, and track corrective actions with owners and due dates."
      ]
    ],
    "correct": "D",
    "explanation": "In ITIL, incident management restores normal service quickly, while problem management reduces the likelihood and impact of incidents by finding their causes. In CISSP Security Operations, lessons learned is the last phase of incident response. Together they turn three incidents into owned fixes such as segmentation and patching.",
    "incorrect": {
      "A": "Incident management restores service; cause analysis belongs to problem management. Mixing them distorts incident measures.",
      "B": "Rebuilding without knowing the cause invites a fourth incident.",
      "C": "Repeated incidents on one service are a sign that a cause remains."
    },
    "artifactKey": "r3-incident-and-problem-management-workflow"
  },
  {
    "id": "q-x-15",
    "certification": "Intersection",
    "domain": "PMP Manage conflicts · ITIL Change control · CISSP Communication and Network Security",
    "prompt": "In week 9, Tomás Rivera wants the firewall change that the on-premises data gateway needs made this week, to protect the refresh schedule. Ahmed Haddad refuses until a later window because the change touches the clinical network. Both escalate to you. What should you do?",
    "options": [
      [
        "A",
        "Bring them together in a facilitated session to agree the risk and the need, then raise the firewall change through change control with a risk assessment, test and back-out plan, scheduled in an agreed change window."
      ],
      [
        "B",
        "Tell Ahmed to make the change now, because the schedule comes first."
      ],
      [
        "C",
        "Escalate straight to Marcus Bell and let him decide."
      ],
      [
        "D",
        "Give Tomás temporary firewall rights so he can make the change himself."
      ]
    ],
    "correct": "A",
    "explanation": "The PMP answer is collaborative problem-solving, the ITIL answer is the change practice, which balances speed and risk, and the CISSP answer protects the clinical network. An agreed change window meets all three, which is how Beacon resolved this conflict.",
    "incorrect": {
      "B": "Forcing ends the argument but risks the clinical network and the team's trust.",
      "C": "Escalation is for conflicts the team cannot resolve. Try collaboration first.",
      "D": "That bypasses change control and segregation of duties on a clinical network."
    },
    "artifactKey": "r2-team-charter-and-conflict-record"
  },
  {
    "id": "q-x-16",
    "certification": "Intersection",
    "domain": "PMP Help ensure knowledge transfer · PL-300 Model documentation · ITIL Support",
    "prompt": "R-07: Lumen Analytics Partners' (V-05) contract ends 2026-11-30, before the Release 3 dashboards. R-06: only Tomás Rivera understands the semantic model. What is the best response?",
    "options": [
      [
        "A",
        "Extend Lumen's contract with no end date."
      ],
      [
        "B",
        "Ask Tomás to work extra hours to cover the gap."
      ],
      [
        "C",
        "Plan knowledge transfer now: finish the DAX catalogue and model design documents, keep the model and report files in Kestrel's own source control, pair Mei Tanaka with Lumen and Tomás on real changes, and make handover an acceptance condition before the contract ends."
      ],
      [
        "D",
        "Deal with it when Release 3 starts."
      ]
    ],
    "correct": "C",
    "explanation": "Knowledge transfer (PMP) needs time, documentation and practice before people leave. Documented measures and model design (PL-300) let a second analyst maintain the model, and the service desk gets knowledge it can use (ITIL). Making handover an acceptance condition uses the contract while it still exists.",
    "incorrect": {
      "A": "It defers the risk and adds cost while CPI is 0.89.",
      "B": "That deepens the key-person dependency instead of reducing it.",
      "D": "By then the contract has ended and the knowledge has left with Lumen."
    },
    "artifactKey": "r1-raid-log"
  }
];

export function questionsForDeliverable(item: Deliverable): ScenarioQuestion[] {
  const matching = scenarioBank.filter((question) => question.artifactKey === item.key);
  const angles = [
    ['ownership', 'The team has produced the artifact, but no accountable owner will approve its assumptions. What is the best next action?'],
    ['evidence', 'A reviewer challenges a major conclusion in this artifact. Which response creates the strongest assurance?'],
    ['change', 'A late operational change invalidates one documented assumption. What should happen first?'],
    ['security', 'The artifact satisfies the business request but omits handling of sensitive information. What is the best response?'],
    ['acceptance', 'Stakeholders disagree about whether this artifact is complete. Which step best resolves the disagreement?'],
  ] as const;
  const generated = angles.map(([angle, prompt], index): ScenarioQuestion => ({
    id: `${item.key}-${angle}`,
    certification: 'Intersection',
    domain: item.domains.join(' · '),
    artifactKey: item.key,
    prompt: `${item.title}: ${prompt}`,
    options: index === 0
      ? [['A', 'Proceed because the document already exists.'], ['B', 'Identify the accountable owner and obtain an evidence-based decision.'], ['C', 'Ask the analyst to approve their own work.'], ['D', 'Remove the disputed assumptions.']]
      : index === 1
        ? [['A', 'Show traceable source, analysis, test, and reconciliation evidence.'], ['B', 'Emphasize how long the work took.'], ['C', 'Add more decorative visuals.'], ['D', 'Ask the reviewer to trust the team.']]
        : index === 2
          ? [['A', 'Ignore it until project closure.'], ['B', 'Silently edit the baseline.'], ['C', 'Record it and assess value, delivery, data, and security impacts.'], ['D', 'Delete the original assumption.']]
          : index === 3
            ? [['A', 'Apply classification, least-privilege, retention, and test requirements before acceptance.'], ['B', 'Publish first and add controls later.'], ['C', 'Remove all useful data.'], ['D', 'Rely on a confidentiality footer.']]
            : [['A', 'Let the loudest stakeholder decide.'], ['B', 'Use approved, measurable acceptance criteria and record the decision.'], ['C', 'Count the number of pages.'], ['D', 'Mark it complete at the deadline.']],
    correct: index === 0 ? 'B' : index === 1 ? 'A' : index === 2 ? 'C' : index === 3 ? 'A' : 'B',
    explanation: index === 0
      ? 'Accountability and explicit approval turn analysis into an authorized organizational decision.'
      : index === 1
        ? 'Traceable evidence lets an independent reviewer reproduce the reasoning instead of relying on confidence or presentation.'
        : index === 2
          ? 'Material changes should be recorded, impact-assessed, and decided through the agreed governance path.'
          : index === 3
            ? 'Security and privacy requirements are part of quality and acceptance, not a post-release add-on.'
            : 'Pre-agreed measurable criteria make completion testable and reduce subjective acceptance disputes.',
    incorrect: index === 0
      ? { A: 'Existence is not approval.', C: 'Self-approval weakens independence.', D: 'Deleting assumptions removes traceability.' }
      : index === 1
        ? { B: 'Effort does not prove correctness.', C: 'Presentation does not prove the conclusion.', D: 'Assurance requires evidence.' }
        : index === 2
          ? { A: 'Waiting increases exposure.', B: 'Silent edits break control and traceability.', D: 'The original state should remain auditable.' }
          : index === 3
            ? { B: 'Deferred controls may expose data.', C: 'Eliminating business value is not proportionate control.', D: 'A footer is not a technical or procedural safeguard.' }
            : { A: 'Influence is not an acceptance standard.', C: 'Length does not demonstrate quality.', D: 'A date does not prove requirements were met.' },
  }));
  return [...matching, ...generated.filter((question) => !matching.some((existing) => existing.id === question.id))].slice(0, 5);
}

export const portfolioChecklist = [
  ['portfolio-executive-case', 'Executive case study', 'One-page problem, approach, outcomes, and leadership decisions.'],
  ['portfolio-architecture', 'Architecture diagram', 'Trust boundaries, identities, data flows, controls, and resilience.'],
  ['portfolio-screenshots', 'Power BI screenshots', 'Executive, operations, IAM, and security-operations pages.'],
  ['portfolio-model', 'Data model', 'Facts, dimensions, grain, relationships, and date table.'],
  ['portfolio-dax', 'DAX catalogue', 'Documented measures, business definitions, and test examples.'],
  ['portfolio-pm', 'Project-management package', 'Charter, scope, WBS, schedule, RAID, change, quality, and lessons.'],
  ['portfolio-security', 'Security package', 'Classification, threat model, IAM, IR, continuity, testing, and residual risk.'],
  ['portfolio-itil', 'ITIL service-management package', 'Value proposition, catalogue entry, value stream, service measures, incident/problem workflow, and improvement register.'],
  ['portfolio-dictionary', 'Data dictionary and mapping', 'Source-to-target logic, quality rules, and reconciliation.'],
  ['portfolio-testing', 'Testing evidence', 'Data, model, RLS, UAT, control, performance, and recovery tests.'],
  ['portfolio-tradeoffs', 'Decisions and trade-offs', 'Alternatives, rationale, constraints, and risk acceptance.'],
  ['portfolio-demo', 'Three-to-five-minute demo script', 'Problem, four intersecting decisions, evidence, outcome, and learning.'],
  ['portfolio-readme', 'GitHub README', 'Setup, architecture, datasets, screenshots, limitations, and next steps.'],
  ['portfolio-disclosure', 'Synthetic-data disclosure', 'State clearly that all confidential-looking data is fictional.'],
] as const;

export const officialSources = [
  ['PMP', 'https://www.pmi.org/certifications/project-management-pmp/'],
  ['PL-300', 'https://learn.microsoft.com/en-us/credentials/certifications/resources/study-guides/pl-300'],
  ['CISSP', 'https://www.isc2.org/certifications/cissp/cissp-certification-exam-outline'],
  ['ITIL V5', 'https://www.peoplecert.org/browse-certifications/it-governance-and-service-management/ITIL-1/itil-5-foundation-version-50-4154'],
] as const;
