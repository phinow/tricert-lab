/* The version 8 study plan: four exam blocks in the order Moye takes them.
   Hand written. ITIL Foundation (Version 5) is ready; PL-300, PMP and CISSP
   show as "Being built" until their stages land. See docs/v8-rebuild-spec.md. */
import type { Certification } from './tricert-content';

export type BlockKey = 'itil' | 'pl300' | 'pmp' | 'cissp';

export type Morning = {
  key: string; // 'itil-m1', 'itil-r1'
  kind: 'learn' | 'review' | 'repair';
  title: string;
  lesson?: string; // key in the reading library, same as key for learn mornings
  brief?: { from: string; role: string; text: string; ask: string };
};

export type WeekendBlock = {
  key: string; // 'itil-w1'
  kind: 'lab' | 'mock';
  title: string;
  minutes: number;
  form?: 'A' | 'B'; // for kind 'mock'
  steps: string[]; // for kind 'lab'; mocks carry a short checklist
  after: string; // morning key that must be done first
  minDaysAfter?: { key: string; days: number }; // another weekend block that must be at least this many days earlier
};

export type ExamBlock = {
  key: BlockKey;
  cert: Certification;
  title: string;
  summary: string;
  status: 'ready' | 'building';
  mornings: Morning[];
  weekends: WeekendBlock[];
  exam: { questions: number; minutes: number; secondsPerQuestion: number; allowBack: boolean; target: number; areas: string[] };
  booking: string[]; // checklist shown when the gate is met
};

/* The six ITIL areas. Question domains start with one of these names, then
   " · " and the topic. The mix per practice exam form is 7, 4, 5, 8, 6, 10. */
export const itilAreas = [
  'Value and value co-creation',
  'The four dimensions',
  'The ITIL Value System',
  'The seven guiding principles',
  'The product and service lifecycle',
  'Practices, improvement and value streams',
];

const itil: ExamBlock = {
  key: 'itil',
  cert: 'ITIL',
  title: 'ITIL Foundation (Version 5)',
  summary:
    'Eight learn mornings, two review mornings, a service desk lab in Jira Service Management and two timed 40-question practice exams before you book.',
  status: 'ready',
  mornings: [
    {
      key: 'itil-m1',
      kind: 'learn',
      title: 'Value, products and services',
      lesson: 'itil-m1',
      brief: {
        from: 'Janelle Cardinal',
        role: 'Director of Patient Flow',
        text:
          'Your team keeps telling me the dashboards are delivered. I do not care that a report exists. I care that my 08:00 bed meeting starts with numbers every site trusts and ends with decisions. Before we sign off the analytics service, tell me what we are actually getting from it, and what it costs us and risks for us.',
        ask: 'Separate the outputs of the analytics service from the outcomes, and name one cost it removes and one risk it adds for her team.',
      },
    },
    {
      key: 'itil-m2',
      kind: 'learn',
      title: 'Value co-creation',
      lesson: 'itil-m2',
      brief: {
        from: 'Grace Liu',
        role: 'IT Service Desk Manager',
        text:
          'My desk meets its response target most months, yet unit managers still say dashboard support is poor. They do not always do their part either: tickets arrive with no unit or page named. Value is meant to be something we make together. Help me see what each side should bring, and what the managers are really weighing when they judge us.',
        ask: 'List what the desk and the unit managers each contribute, and name one experience measure to report beside the response target.',
      },
    },
    {
      key: 'itil-m3',
      kind: 'learn',
      title: 'The four dimensions and the ITIL Value System',
      lesson: 'itil-m3',
      brief: {
        from: 'Marcus Bell',
        role: 'Chief Information Officer',
        text:
          'The launch plan from Lumen Analytics Partners covers the semantic model and the gateway, and nothing else. Nobody has said who trains the charge nurses, who answers calls at night, or what happens when the Lumen contract ends. Before I sign the go-live, show me we looked at the whole service, and who sets the rules it runs under.',
        ask: 'Check the launch plan against the four dimensions and say which part of the ITIL Value System sets the rules.',
      },
    },
    {
      key: 'itil-m4',
      kind: 'learn',
      title: 'The seven guiding principles',
      lesson: 'itil-m4',
      brief: {
        from: 'Dr. Helen Marchetti',
        role: 'VP Clinical Operations, executive sponsor',
        text:
          'Access requests take a median of 4.26 days to fulfil, and only 27.3% are resolved within 72 hours. Three ideas are on my desk: buy a new tool, redesign the process from a blank page, or automate the approvals we have now. Before we spend anything, I want each idea tested against the guiding principles.',
        ask: 'Say which guiding principle each of the three ideas follows or breaks, and what should happen first.',
      },
    },
    { key: 'itil-r1', kind: 'review', title: 'Review: mornings 1 to 4' },
    {
      key: 'itil-m5',
      kind: 'learn',
      title: 'The product and service lifecycle',
      lesson: 'itil-m5',
      brief: {
        from: 'Tomás Rivera',
        role: 'Clinical Analytics Lead',
        text:
          'After CR-01 we are adding unit-level ALC counts to the bed dashboard. My team keeps mixing up the work: one person calls the 05:00 refresh support, another calls user training operate. I need one shared list of what each piece of work is, from understanding the need to helping users, so we stop dropping steps.',
        ask: 'Place the work on the new ALC page into the eight lifecycle activities, from Discover to Support.',
      },
    },
    {
      key: 'itil-m6',
      kind: 'learn',
      title: 'Practices, part 1: the service desk practices',
      lesson: 'itil-m6',
      brief: {
        from: 'Aisha Mahmoud',
        role: 'Emergency Charge Nurse, KGH',
        text:
          'Three times this month the emergency flow page showed yesterday\'s numbers at the 08:00 huddle. Each time I called the desk, someone restarted something and it came back. Nobody has told me whether anyone is fixing the cause. I also asked for access for two new nurses, and that went into the same queue. Who handles what?',
        ask: 'Sort her calls into incidents, a service request and a problem, and name the practice that leads each.',
      },
    },
    {
      key: 'itil-m7',
      kind: 'learn',
      title: 'Practices, part 2: change, release and the rest',
      lesson: 'itil-m7',
      brief: {
        from: 'Ahmed Haddad',
        role: 'Network Engineer',
        text:
          'The data gateway needs a firewall change and a new gateway version before the ALC page goes live. Tomás wants both this week; I want an agreed change window. We also have no record of which servers the gateway depends on. Tell me how this should move from approval to live use, and what we should be keeping track of.',
        ask: 'Say which type of change each item is, how release and deployment differ here, and which practice keeps the gateway\'s records.',
      },
    },
    {
      key: 'itil-m8',
      kind: 'learn',
      title: 'Continual improvement and value streams',
      lesson: 'itil-m8',
      brief: {
        from: 'Nora Lindqvist',
        role: 'HR Business Partner',
        text:
          'HR sends a joiner event the day a contract is signed, yet new clinicians still wait days for a working login. I want the access-request stream mapped from my event to that login, with how long each step takes and how long work just sits. Then I want one improvement agreed, measured and checked, not another list of ideas.',
        ask: 'Map the access-request value stream with work and wait times, and plan one improvement with the continual improvement model.',
      },
    },
    { key: 'itil-r2', kind: 'review', title: 'Review: mornings 5 to 8' },
    { key: 'itil-p1', kind: 'repair', title: 'Repair: your weakest area in practice exam A' },
    { key: 'itil-p2', kind: 'repair', title: 'Repair: your second weakest area' },
  ],
  weekends: [
    {
      key: 'itil-w1',
      kind: 'lab',
      title: 'Lab: run a small service desk in Jira Service Management',
      minutes: 120,
      after: 'itil-r1',
      steps: [
        'Check the limits first. On Atlassian\'s pricing page (opened 11 November 2026) the Free plan is free forever for up to 3 agents, with unlimited customers, 2 GB of storage, Atlassian Community support only and 1,250 automation steps a month. Asset and configuration management starts at Standard; advanced incident and problem management is in Premium. Going over 3 agents or 2 GB moves the site to a 14-day Standard trial.',
        'Pick the service. Use a real group you help, such as a team, club or volunteer group, with at most three people answering requests. If you have none, use Kestrel\'s patient-flow analytics service, with Grace Liu\'s desk as the agents and unit managers as customers.',
        'Sign up for the Free plan with your own email and create one service project from the IT service management template. Name the project after the service.',
        'Set up the request types for the portal: at least two service requests (for example, new access and a how-to question) and one way to report that something is broken. Write each name and description in the words your users would use.',
        'Add one service level: a time to first response goal for incidents, such as 4 working hours, on a calendar of your working hours. Write one line on why you chose that target.',
        'Write three knowledge articles in the built-in knowledge base: one how-to, one answer to the most common question, and one workaround for a fault you expect. Link them to the request types so the portal suggests them.',
        'Act as a customer and raise two incidents with the same cause, for example a shared report that will not load. Then, as an agent, restore service on each with the workaround article and note what you did.',
        'Raise a problem and link both incidents to it. Write the suspected cause. If your project has no Problem work type, add it in the project settings.',
        'Turn the problem into a known error: record the cause you found and the workaround, and link the workaround article. Leave the problem open until a permanent fix is planned.',
        'Write five lines for your portfolio: the service, the request types, the service level and why, the three articles, and how one incident became a problem and then a known error. Save two screenshots.',
      ],
    },
    {
      key: 'itil-w2',
      kind: 'mock',
      title: 'Practice exam A',
      minutes: 120,
      form: 'A',
      after: 'itil-r2',
      steps: [
        'Clear the desk, close notes and keep one free hour: 40 questions in 60 minutes, as in the real exam.',
        'Answer every question. Unanswered questions count as wrong when time runs out.',
        'Then go through every question, right ones too, and write the rule for each miss.',
      ],
    },
    {
      key: 'itil-w3',
      kind: 'mock',
      title: 'Practice exam B',
      minutes: 120,
      form: 'B',
      after: 'itil-p2',
      minDaysAfter: { key: 'itil-w2', days: 7 },
      steps: [
        'Take this at least 7 days after practice exam A, with no notes: 40 questions in 60 minutes.',
        'Answer every question. Unanswered questions count as wrong when time runs out.',
        'Then go through every question and compare your score by area with exam A.',
      ],
    },
  ],
  exam: {
    questions: 40,
    minutes: 60,
    secondsPerQuestion: 90,
    allowBack: true,
    target: 80,
    areas: itilAreas,
  },
  booking: [
    'Buy the Exam bundle: US$690 on PeopleCert\'s page on 10 November 2026, with the exam voucher, the official eBook and the Learning Resource Kit. It is the cheapest option listed.',
    'Decide on a retake now. Take2 can only be bought before the exam, up to 15 minutes before the session, and never after a fail. It is valid for 6 months from the first exam date.',
    'Book an online proctored session on a Saturday or Sunday morning, when you are fresh and not coming off a work day.',
    'Rescheduling is free up to 48 hours before the exam. From 48 to 4 hours before it costs US$60, and after that US$120.',
    'The name on your booking must match the name on your photo ID exactly.',
    'On the day: 40 questions, 60 minutes, closed book. The pass mark is 65%, which is 26 of 40.',
  ],
};

const pl300: ExamBlock = {
  key: 'pl300',
  cert: 'PL-300',
  title: 'PL-300 Power BI Data Analyst',
  summary: 'Prepare, model, visualize and secure data in Power BI, built around Beacon\'s patient-flow dashboards.',
  status: 'building',
  mornings: [],
  weekends: [],
  exam: {
    questions: 55, // our practice size; Microsoft does not publish a fixed count
    minutes: 100,
    secondsPerQuestion: 109,
    allowBack: true,
    target: 80,
    areas: ['Prepare the data', 'Model the data', 'Visualize and analyze the data', 'Manage and secure Power BI'],
  },
  booking: [],
};

const pmp: ExamBlock = {
  key: 'pmp',
  cert: 'PMP',
  title: 'PMP Project Management Professional',
  summary: 'People, process and business environment, with Project Beacon as the programme you run.',
  status: 'building',
  mornings: [],
  weekends: [],
  exam: {
    questions: 180,
    minutes: 240,
    secondsPerQuestion: 80,
    allowBack: true,
    target: 75,
    areas: ['People', 'Process', 'Business Environment'],
  },
  booking: [],
};

const cissp: ExamBlock = {
  key: 'cissp',
  cert: 'CISSP',
  title: 'CISSP',
  summary: 'Security across eight domains, from risk and assets to operations, built on Beacon\'s access and resilience work.',
  status: 'building',
  mornings: [],
  weekends: [],
  exam: {
    questions: 125,
    minutes: 180,
    secondsPerQuestion: 86,
    allowBack: false,
    target: 75,
    areas: [
      'Security and Risk Management',
      'Asset Security',
      'Security Architecture and Engineering',
      'Communication and Network Security',
      'Identity and Access Management (IAM)',
      'Security Assessment and Testing',
      'Security Operations',
      'Software Development Security',
    ],
  },
  booking: [],
};

export const examBlocks: ExamBlock[] = [itil, pl300, pmp, cissp];
