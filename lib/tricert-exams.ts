import type { Certification } from './tricert-content';

/* Exam guides. Every number and name here was checked against the publisher's
   own page or outline on 2026-10-18 (see the source on each guide). */

export type ExamArea = { name: string; weight: string; covers: string[] };

export type ExamGuide = {
  cert: Certification;
  name: string;
  credential: string;
  summary: string;
  glance: string;
  facts: [string, string][];
  areas: ExamArea[];
  areasNote: string;
  eligibility: string[];
  technique: string[];
  inThisPlan: string[];
  keeping: string[];
  source: { label: string; url: string };
};

export const examGuides: ExamGuide[] = [
  {
    cert: 'PMP',
    name: 'Project Management Professional',
    credential: 'PMP, from the Project Management Institute (PMI)',
    summary: 'PMP tests how you lead projects in predictive, agile and hybrid settings. Most questions describe a situation and ask what the project manager should do. A new exam, built on the July 2026 Examination Content Outline, has been in effect since July 9, 2026.',
    glance: '180 questions · 240 minutes · People, Process, Business Environment',
    facts: [
      ['Questions', '180: 170 scored and 10 unscored pretest questions you cannot tell apart'],
      ['Time', '240 minutes'],
      ['Breaks', 'Two 10-minute breaks'],
      ['Question types', 'Case or scenario, graphic-based, multiple choice (single response) and multiple response. On computer you may also see enhanced matching, point and click, matching and pull-down list items.'],
      ['Where', 'A test centre (computer or paper) or online proctored'],
      ['Outline', 'Examination Content Outline, July 2026'],
    ],
    areasNote: 'Three domains. Each lists the tasks the exam samples from.',
    areas: [
      { name: 'People', weight: '33%', covers: ['Develop a common vision', 'Manage conflicts', 'Lead the project team', 'Engage stakeholders', 'Align stakeholder expectations', 'Manage stakeholder expectations', 'Help ensure knowledge transfer', 'Plan and manage communication'] },
      { name: 'Process', weight: '41%', covers: ['Develop an integrated project management plan and plan delivery', 'Develop and manage project scope', 'Help ensure value-based delivery', 'Plan and manage resources', 'Plan and manage procurement', 'Plan and manage finance', 'Plan and optimize quality of products/deliverables', 'Plan and manage schedule', 'Evaluate project status', 'Manage project closure'] },
      { name: 'Business Environment', weight: '26%', covers: ['Define and establish project governance', 'Plan and manage project compliance', 'Manage and control changes', 'Remove impediments and manage issues', 'Plan and manage risk', 'Continuous improvement', 'Support organizational change', 'Evaluate external business environment changes'] },
    ],
    eligibility: [
      'Experience leading projects within the last 10 years. Months that overlap count once.',
      'Secondary school diploma: 60 months. Associate’s degree or post-secondary vocational diploma: 48 months. Bachelor’s degree or equivalent: 36 months. Bachelor’s or postgraduate degree from a PMI GAC-accredited program: 24 months.',
      'Plus 35 contact hours of project management training. An active CAPM replaces the 35 hours.',
      'From 1 December 2026, live instructor-led training counts toward the 35 hours only if a PMI Authorized Training Partner, a China Registered Education Provider or an eligible accredited higher-education program delivers it.',
      'PMI can select any application for audit. Keep a contact for each project and your training certificates before you apply.',
    ],
    technique: [
      'Read the last sentence first. It tells you whether the question wants the first step, the next step, the best response or what to avoid.',
      'Name the situation before you read the options: is it a conflict, a change request, a risk that has happened (an issue), or a stakeholder who is not engaged?',
      'Favour answers where the project manager investigates, talks to the people involved and follows the agreed process before acting. Escalating, firing someone or changing the baseline alone is rarely the first move.',
      'Check the delivery approach in the stem. In an agile team the team and product owner decide scope and order; in a predictive project changes go through change control.',
      'For multiple response items, the question states how many to pick. Judge each option on its own.',
      'Pace: 240 minutes for 180 questions is 80 seconds each. Check your count at each break.',
    ],
    inThisPlan: [
      'You run Project Beacon as one programme from week 1 to week 13, so PMP work never stops.',
      'Weeks 1 and 2: business case, charter, scope, requirements, WBS, schedule, stakeholders, communication, RAID log and change control.',
      'Weeks 7 to 9: the Release 2 baseline, estimates, procurement, a change-control decision, a team conflict, an earned value status report, then two full mocks.',
      'Week 10, day 3: the PMP exam gate.',
    ],
    keeping: ['Earn 60 professional development units (PDUs) every 3 years.', 'PMI sets the exam and renewal fees, with lower prices for members. Check pmi.org for current amounts.'],
    source: { label: 'PMI: PMP certification and Examination Content Outline (July 2026)', url: 'https://www.pmi.org/certifications/project-management-pmp/' },
  },
  {
    cert: 'PL-300',
    name: 'Microsoft Power BI Data Analyst',
    credential: 'Microsoft Certified: Power BI Data Analyst Associate',
    summary: 'PL-300 tests whether you can take raw data to a secure, shared Power BI report: prepare it in Power Query, model it with DAX, build reports people can use, and manage workspaces, refresh and security. The skills below are current as of April 20, 2026.',
    glance: '100 minutes · pass at 700 · four skill areas',
    facts: [
      ['Time', '100 minutes'],
      ['Passing score', '700 (scaled)'],
      ['Questions', 'Microsoft does not publish a fixed count. The exam may include interactive components.'],
      ['Where', 'Proctored through Pearson VUE, at a test centre or online'],
      ['Retake', 'After a first failed attempt you can retake after 24 hours'],
      ['Skills measured', 'As of April 20, 2026'],
    ],
    areasNote: 'Four skill areas. Each range is the share of the exam.',
    areas: [
      { name: 'Prepare the data', weight: '25–30%', covers: ['Connect to data sources or a shared semantic model; change source settings, credentials and privacy levels', 'Choose between DirectLake, DirectQuery and Import; create and modify parameters', 'Profile data: column statistics and properties', 'Resolve inconsistencies, unexpected or null values, data quality issues and import errors', 'Set data types; create and transform columns; group and aggregate rows', 'Pivot, unpivot and transpose; convert semi-structured data to a table', 'Create fact and dimension tables; reference vs duplicate queries; merge and append', 'Identify keys for relationships; configure data loading'] },
      { name: 'Model the data', weight: '25–30%', covers: ['Table and column properties; role-playing dimensions', 'Relationship cardinality and cross-filter direction', 'A common date table', 'When to use calculated columns and calculated tables', 'Single aggregation measures and CALCULATE', 'Time intelligence, basic statistical functions and semi-additive measures', 'Quick measures and calculation groups', 'Optimize: remove unneeded rows and columns, find slow measures, relationships and visuals with Performance Analyzer and DAX query view, reduce granularity'] },
      { name: 'Visualize and analyze the data', weight: '25–30%', covers: ['Choose and format visuals; themes; conditional formatting; slicing and filtering', 'Copilot: narrative visual, new report page and suggestions, summarize the semantic model', 'Page setup; when to use a paginated report; visual calculations with DAX', 'Bookmarks, custom tooltips, interactions, navigation, sorting and sync slicers', 'Selection pane grouping and layering; drillthrough pages, filters and buttons', 'Export settings, mobile layout, personalization, accessibility, automatic page refresh', 'Analyze feature; grouping, binning and clustering; AI visuals', 'Reference lines, error bars and forecasting; outliers and anomalies'] },
      { name: 'Manage and secure Power BI', weight: '15–20%', covers: ['Create and configure a workspace; configure and update an app', 'Publish, import and update items; dashboards; choose a distribution method', 'Subscriptions and data alerts; promote or certify content', 'When a gateway is required; scheduled refresh', 'Workspace roles and item-level access; access to semantic models', 'Row-level security roles and group membership', 'Sensitivity labels'] },
    ],
    eligibility: [],
    technique: [
      'Expect tasks set in a business case: read what the report owner needs before you look at the options.',
      'For Power Query questions, ask which step fixes the problem at the source and keeps query folding where it can.',
      'For modelling questions, sketch the star: which table is the fact, which are dimensions, and which way the filter flows.',
      'For DAX questions, decide the filter context first, then the function. CALCULATE changes filter context; iterators such as SUMX work row by row.',
      'For security questions, separate who can open the workspace (roles) from which rows they see (RLS) and how data is labelled (sensitivity labels).',
      'Pace: 100 minutes in total. Flag long case items and return to them if the exam section allows review.',
    ],
    inThisPlan: [
      'Release 1, weeks 1 to 6: profile and clean Kestrel’s emergency, bed and service desk data, build the star schema and date table, write the patient-flow measures, secure each site with RLS, and publish the dashboards as an app.',
      'Release 2 and 3 keep the skills fresh: the access-governance dashboard in week 8 and the security-operations dashboard in week 11.',
      'Week 6: two timed mocks, then the PL-300 exam gate on day 4.',
    ],
    keeping: ['Renew every 12 months with a free online assessment on Microsoft Learn.'],
    source: { label: 'Microsoft Learn: PL-300 study guide', url: 'https://learn.microsoft.com/en-us/credentials/certifications/resources/study-guides/pl-300' },
  },
  {
    cert: 'CISSP',
    name: 'Certified Information Systems Security Professional',
    credential: 'CISSP, from ISC2',
    summary: 'CISSP tests whether you can design, run and govern a security programme. It is broad rather than deep, and it rewards the answer a risk advisor to senior management would give. The current outline took effect on April 15, 2024.',
    glance: '100 to 150 adaptive items · 3 hours · eight domains',
    facts: [
      ['Format', 'Computerized Adaptive Testing (CAT) for English exams'],
      ['Items', '100 to 150'],
      ['Time', '3 hours'],
      ['Passing score', '700 out of 1000'],
      ['Going back', 'Not possible. Each answer is final once you move on.'],
      ['Outline', 'Effective April 15, 2024'],
    ],
    areasNote: 'Eight domains. The headings under each are the outline’s own.',
    areas: [
      { name: 'Security and Risk Management', weight: '16%', covers: ['Professional ethics', 'Security concepts', 'Security governance principles', 'Legal, regulatory and compliance issues', 'Investigation types: administrative, criminal, civil, regulatory, industry standards', 'Policy, standards, procedures and guidelines', 'Business continuity requirements', 'Personnel security', 'Risk management concepts', 'Threat modelling', 'Supply chain risk management', 'Security awareness, education and training'] },
      { name: 'Asset Security', weight: '10%', covers: ['Identify and classify information and assets', 'Handling requirements', 'Provision information and assets securely', 'Manage the data lifecycle', 'Asset retention, including end of life and end of support', 'Data security controls and compliance requirements'] },
      { name: 'Security Architecture and Engineering', weight: '13%', covers: ['Secure design principles in engineering processes', 'Security models such as Bell-LaPadula and Biba', 'Select controls from system security requirements', 'Security capabilities of information systems: memory protection, TPM, encryption', 'Vulnerabilities in architectures, designs and solution elements', 'Cryptographic solutions and cryptanalytic attacks', 'Site and facility design and controls', 'The information system lifecycle'] },
      { name: 'Communication and Network Security', weight: '13%', covers: ['Secure design principles in network architectures', 'Secure network components', 'Secure communication channels'] },
      { name: 'Identity and Access Management (IAM)', weight: '13%', covers: ['Physical and logical access to assets', 'Identification and authentication strategy for people, devices and services', 'Federated identity with a third-party service', 'Authorization mechanisms', 'The identity and access provisioning lifecycle', 'Authentication systems'] },
      { name: 'Security Assessment and Testing', weight: '12%', covers: ['Assessment, test and audit strategies', 'Security control testing', 'Collect security process data', 'Analyze test output and report', 'Conduct or facilitate security audits'] },
      { name: 'Security Operations', weight: '13%', covers: ['Investigations', 'Logging and monitoring', 'Configuration management', 'Foundational security operations concepts and resource protection', 'Incident management', 'Detection and preventative measures', 'Patch and vulnerability management', 'Change management', 'Recovery strategies, disaster recovery processes and DR plan testing', 'Business continuity planning and exercises', 'Physical security; personnel safety and security'] },
      { name: 'Software Development Security', weight: '10%', covers: ['Security in the software development life cycle', 'Controls in software development ecosystems', 'Assess software security', 'Security impact of acquired software', 'Secure coding guidelines and standards'] },
    ],
    eligibility: [
      'At least five years of cumulative, full-time, paid work in two or more of the eight domains.',
      'A four-year degree (or regional equivalent) or an approved credential waives one year.',
      'Pass without the experience and you become an Associate of ISC2. You then have six years to gain it.',
      'After you pass, an ISC2-certified professional in good standing must endorse your application.',
    ],
    technique: [
      'Answer as a risk advisor to senior management, not as the technician at the keyboard. The best answer usually addresses risk, policy or process before a tool.',
      'Human safety comes first in every scenario.',
      'Watch for words that change the question: FIRST, BEST, MOST, PRIMARY, LEAST.',
      'When two options are both correct, pick the one that solves the cause, applies to the whole organization, or comes earlier in the process.',
      'CAT adapts to you. Hard questions often mean you are doing well, so do not read the difficulty as a signal.',
      'Pace: 3 hours for up to 150 items is 72 seconds each. You cannot skip or return, so commit and move on.',
    ],
    inThisPlan: [
      'Every release feeds CISSP: classification, the privacy impact assessment, threat modelling and RLS in Release 1; least privilege, segregation of duties, MFA and access reviews in Release 2; segmentation, incident response, vulnerability management, the business impact analysis and recovery in Release 3.',
      'Week 13: an eight-domain review through Beacon, mocks, and the CISSP exam gate on day 4.',
    ],
    keeping: ['Earn 120 continuing professional education (CPE) credits per 3-year cycle, at least 40 each year.', 'Pay the annual maintenance fee set by ISC2.'],
    source: { label: 'ISC2: CISSP exam outline', url: 'https://www.isc2.org/certifications/cissp/cissp-certification-exam-outline' },
  },
  {
    cert: 'ITIL',
    name: 'ITIL Foundation (Version 5)',
    credential: 'ITIL Foundation (Version 5), from PeopleCert',
    summary: 'ITIL Foundation tests the vocabulary and ideas of digital product and service management: how organizations co-create value with consumers, and how the ITIL Value System, the four dimensions and the product and service lifecycle fit together. Version 5 is described as AI-native and unifies product and service management.',
    glance: '40 questions · 60 minutes · pass at 26 of 40',
    facts: [
      ['Questions', '40 multiple choice'],
      ['Time', '60 minutes'],
      ['Pass mark', '65% (26 of 40)'],
      ['Book', 'Closed book'],
      ['Where', 'Online proctored exams are available'],
      ['Prerequisite', 'No mandatory training'],
    ],
    areasNote: 'PeopleCert lists learning objectives rather than weights. These are the topics the questions draw from.',
    areas: [
      { name: 'Value and value co-creation', weight: '', covers: ['Digital product and service management concepts', 'Value co-creation between providers and consumers', 'Utility (fit for purpose) and warranty (fit for use)'] },
      { name: 'The four dimensions', weight: '', covers: ['Organizations and People', 'Information and Technology', 'Partners and Suppliers', 'Value Streams and Processes'] },
      { name: 'The ITIL Value System', weight: '', covers: ['Guiding principles', 'Governance', 'Value chain activities', 'Management practices', 'Continual improvement'] },
      { name: 'The seven guiding principles', weight: '', covers: ['Focus on value', 'Start where you are', 'Progress iteratively with feedback', 'Collaborate and promote visibility', 'Think and work holistically', 'Keep it simple and practical', 'Optimize and automate'] },
      { name: 'The product and service lifecycle', weight: '', covers: ['Discover', 'Design', 'Acquire', 'Build', 'Transition', 'Operate', 'Deliver', 'Support'] },
      { name: 'Practices, improvement and value streams', weight: '', covers: ['ITIL’s management practices', 'Continual improvement', 'Value stream mapping and management'] },
    ],
    eligibility: ['Open to anyone. Holders of ITIL 4 Foundation can take the shorter Foundation Bridge (Version 5) instead.'],
    technique: [
      'Learn the exact names: the four dimensions, the seven guiding principles and the eight lifecycle stages. Many questions turn on one word.',
      'Match the principle to the behaviour in the stem. Reusing what already works is Start where you are; small releases with feedback is Progress iteratively with feedback.',
      'Do not answer with ITIL 4 value chain activity names. Version 5 organizes the work as the eight-stage product and service lifecycle.',
      'Pace: 60 minutes for 40 questions is 90 seconds each, which leaves time to review every answer.',
    ],
    inThisPlan: [
      'Release 1 runs the dashboards as a service: the value proposition, the catalogue entry and service levels, the support handover, the first service review and the continual-improvement register.',
      'Week 6, day 4: the ITIL exam gate, alongside PL-300. Release 2 maps the access-request value stream and Release 3 runs incident, problem and major-incident reviews, so the ideas stay in use.',
    ],
    keeping: ['Renew every 3 years, through continuing professional development or by retaking the exam.'],
    source: { label: 'PeopleCert: ITIL Foundation (Version 5)', url: 'https://www.peoplecert.org/browse-certifications/it-governance-and-service-management/ITIL-1/itil-5-foundation-version-50-4154' },
  },
];
