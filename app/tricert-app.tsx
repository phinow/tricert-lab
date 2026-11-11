'use client';

import { FormEvent, ReactNode, RefObject, useEffect, useMemo, useRef, useState } from 'react';
import {
  labCards,
  portfolioChecklist,
  projects,
  questionsForDeliverable,
  studyWeeks,
  type Certification,
  type Deliverable,
  type ScenarioQuestion,
  type StudyTask,
} from '@/lib/tricert-content';
import { glossary, guideIndex, lessonIndex, type DocGuide, type Lesson } from '@/lib/tricert-library';
import { examBlocks, type BlockKey, type ExamBlock, type Morning, type WeekendBlock } from '@/lib/tricert-plan';
import {
  addDays,
  afterExam,
  allChecksMet,
  answerCard,
  areaOf,
  cardQueue,
  daysBetween,
  estimateDates,
  isCardRetired,
  isQuestionRetired,
  isStudyDate,
  readyToBook,
  recordQuestionAnswer,
  scoreExam,
  startCard,
  weekday,
  type AreaScore,
  type BookingCheck,
  type CardGrade,
  type CardQueueItem,
  type DailyMode,
  type ExamAnswers,
  type ExamResult,
  type QuestionResult,
  type SrsRecord,
} from '@/lib/tricert-study';
import {
  allCards,
  cardsForExam,
  crossExamScenarios,
  makeUserCard,
  nextPracticeExam,
  questionBank,
  questionById,
  takenForms,
  todaysCards,
  todaysQuestions,
  type BankCard,
  type UserCard,
} from '@/lib/tricert-bank';

/* The long reading (65 lessons and 66 finished documents) loads on demand so
   the app opens fast. It starts loading as soon as the app mounts. */
type Reading = typeof import('@/lib/tricert-reading');
let readingCache: Reading | null = null;
let readingPromise: Promise<Reading> | null = null;
function loadReading() {
  if (!readingPromise) readingPromise = import('@/lib/tricert-reading').then((module) => { readingCache = module; return module; });
  return readingPromise;
}
function useReading() {
  const [reading, setReading] = useState<Reading | null>(readingCache);
  useEffect(() => {
    if (reading) return;
    let live = true;
    loadReading().then((module) => { if (live) setReading(module); }).catch(() => undefined);
    return () => { live = false; };
  }, [reading]);
  return reading;
}
import { examGuides, type ExamGuide } from '@/lib/tricert-exams';

/* ==========================================================================
   Types
   ========================================================================== */

type Profile = {
  education: string;
  projects_led: string;
  pm_months: number;
  pm_training_hours: number;
  pm_training_complete: number;
  cyber_months: number;
  cyber_domains: string;
  power_bi_level: string;
  power_query_level: string;
  dax_level: string;
  sql_level: string;
  itil_level: string;
  weekly_hours: number;
  pmp_target: string;
  pl300_target: string;
  cissp_target: string;
  itil_target: string;
  display_name?: string;
  motivation?: string;
};
type ProgressRow = { item_key: string; status: string; updated_at?: string };
type AttemptRow = { question_id: string; certification: string; domain: string; answer: string; correct: number; confidence: string; created_at: string; first_at?: string; tries?: number };
type ArtifactRow = { artifact_key: string; status: string; evidence_text: string; reflection: string; updated_at?: string };
/* One line per morning, short morning or weekend block (the log record). */
type LogRow = { id: string; key: string; kind: string; block?: string; date: string; minutes: number; cards: number; questions: number; right: number };
/* A practice exam result (the mocks record), with his answers so the
   result can be opened again from Progress. */
type MockRow = {
  id: string; exam?: string; form: string; date: string; total?: number; right?: number; areas?: AreaScore[]; weekend?: string;
  ids?: string[]; answers?: ExamAnswers; flags?: string[]; minutes?: number;
};
type Records = { plan: { startDate?: string }; srs: SrsRecord; mocks: MockRow[]; log: LogRow[]; usercards: UserCard[] };
type StudyState = { profile: Profile | null; progress: ProgressRow[]; attempts: AttemptRow[]; artifacts: ArtifactRow[]; records: Records };
type View = 'today' | 'plan' | 'learn' | 'projects' | 'practice' | 'progress';
type LearnTab = 'exams' | 'lessons' | 'documents' | 'glossary';
type PracticeScreen = 'hub' | 'run' | 'flashcards' | 'labs' | 'exam' | 'result';
type Notice = { text: string; kind: 'success' | 'error' } | null;
type Theme = 'system' | 'light' | 'dark';
type Accent = 'beacon' | 'rose' | 'canola' | 'glacier';
type UiPrefs = { v?: number; project?: string; artifact?: string; rubric?: Record<string, number[]>; theme?: Theme; accent?: Accent };
type Run = { kind: 'scenarios' | 'artifact'; title: string; questions: ScenarioQuestion[]; index: number; answered: number; correct: number };

/* A practice exam in progress. It lives in this browser (see examKey) so a
   reload returns to it; the clock always counts from startedAt. */
type ExamRun = {
  v: 1;
  id: string;
  exam: Certification;
  block: BlockKey;
  form: string; // 'A', 'B' or 'draw-<id>'
  ids: string[];
  answers: ExamAnswers;
  flags: string[];
  index: number;
  startedAt: number;
  minutes: number;
  allowBack: boolean;
  target: number;
  finishedAt?: number;
  date?: string;
  saved: string[]; // the saving steps already done: mock, srs, progress, log
};

/* A morning in progress. It lives in this browser (see morningKey) so a
   reload or a closed tab returns to the same part. Every answer is saved to
   the server as it is given; the run only keeps his place and his writing. */
type MorningMode = 'learn' | 'review' | 'repair' | 'short' | 'due';
type PartKey = 'cards' | 'learn' | 'questions' | 'mistakes' | 'reflect';
type LearnStage = 'brief' | 'lesson' | 'build' | 'recall';
type MorningAnswer = { choice: string; sure: boolean; correct: boolean; result: QuestionResult; seconds: number };
type MorningRun = {
  v: 1;
  key: string; // the morning key, short-<date> or due-<date> (Today's review)
  morning: string | null; // the morning it completes; null for a short morning or Today's review
  mode: MorningMode;
  block: BlockKey;
  exam: Certification;
  date: string;
  part: number;
  open: boolean;
  spentMs: number;
  cards: { queue: CardQueueItem[]; shown: boolean; reviewed: number; again: number };
  learn: { stage: LearnStage; build: string; model: boolean; recall: boolean[] };
  questions: { ids: string[]; index: number; answers: Record<string, MorningAnswer> };
  mistakes: Record<string, string>;
  savedCards: string[];
  reflection: string;
};
type Finished = { title: string; detail: string; kind: string; minutes: number; cards?: number; questions?: number; right?: number };

/* ==========================================================================
   The library. The 65 Kestrel lessons and the three releases of documents
   stay as reading; the plan itself is the exam blocks in lib/tricert-plan.ts.
   ========================================================================== */

const allTasks = studyWeeks.flatMap((week) => week.tasks);
const allDeliverables = projects.flatMap((project) => project.deliverables);
const releaseNumber = (projectKey: string) => projects.findIndex((item) => item.key === projectKey) + 1;
const docNumber = (projectKey: string, index: number) => `${releaseNumber(projectKey) ? `R${releaseNumber(projectKey)}` : 'NS'}-${String(index + 1).padStart(2, '0')}`;

/* The four exams. They are named with plain text tags, never colours: the
   learner's one colour is kept for the next action and for progress. */
const certs: Array<{ cert: Certification; label: string; field: keyof Profile; name: string }> = [
  { cert: 'PMP', label: 'PMP', field: 'pmp_target', name: 'Project management' },
  { cert: 'PL-300', label: 'PL-300', field: 'pl300_target', name: 'Power BI data analyst' },
  { cert: 'CISSP', label: 'CISSP', field: 'cissp_target', name: 'Information security' },
  { cert: 'ITIL', label: 'ITIL V5', field: 'itil_target', name: 'Service management' },
];
const examLabel = (cert: string) => (cert === 'ITIL' ? 'ITIL V5' : cert === 'Intersection' ? 'All four' : cert);
function Tag({ children }: { children: ReactNode }) {
  return <span className="tag">{children}</span>;
}

/* Personal colour choices, named for Alberta. One is used at a time. */
const accents: Array<[Accent, string, string]> = [
  ['beacon', 'Beacon', '#ff7a33'],
  ['rose', 'Wild rose', '#ff5c8f'],
  ['canola', 'Canola', '#f2cc3d'],
  ['glacier', 'Glacier', '#3fd0db'],
];

/* Five places. Project documents live in Learn, next to the lessons. */
const navItems: Array<[View, string]> = [
  ['today', 'Today'],
  ['plan', 'Plan'],
  ['learn', 'Learn'],
  ['practice', 'Practice'],
  ['progress', 'Progress'],
];

const conceptGlossary: Record<string, string> = {
  'Value delivery': 'Making sure the work produces a useful, measurable business result, not just a finished task.',
  'Requirements traceability': 'Connecting every need to the design, test, approval, and final result that addresses it.',
  'Tailoring and governance': 'Choosing the right amount of process and making it clear who can decide or approve.',
  'Data preparation': 'Cleaning and reshaping source data so it is accurate and ready to analyze.',
  'Semantic modelling': 'Organizing tables, relationships, and measures so reports answer questions correctly.',
  'Analytical communication': 'Presenting evidence so the audience can understand it and take the right action.',
  'Risk-based control selection': 'Choosing safeguards based on likelihood, impact, cost, and business priorities.',
  'Least privilege': 'Giving each person or system only the access needed to do its job.',
  'Defense in depth': 'Using several protective layers so one failed control does not expose everything.',
  'Governed delivery': 'Delivering work with clear ownership, approvals, controls, and evidence.',
  'Evidence-based analysis': 'Using checked, traceable data instead of assumptions or presentation alone.',
  'Risk-informed design': 'Designing the solution around the risks that matter most to the organization.',
  'Value co-creation': 'The provider and consumer work together to create outcomes neither could produce alone.',
  'Product and service lifecycle': 'Following a service from discovery and design through delivery, support, and improvement.',
  'Continual improvement': 'Making small, measured changes based on the current state and a clear target.',
};

const disclosure = 'Kestrel Health Network and Project Beacon are fictional. Every patient visit, account, incident and figure in this case study is synthetic and created for learning.';
const uiPrefsKey = 'tricert.ui.v3';
const morningKey = 'tricert.morning.v1';
const examKey = 'tricert.exam.v1';
const labPrefix = 'tricert.lab.';
const draftPrefix = 'tricert.draft.';
const emptyRecords = (): Records => ({ plan: {}, srs: { cards: {}, questions: {} }, mocks: [], log: [], usercards: [] });
const emptyState: StudyState = { profile: null, progress: [], attempts: [], artifacts: [], records: emptyRecords() };

/* The parts of each kind of morning, with the minutes planned for each. */
const morningParts: Record<MorningMode, Array<[PartKey, string, number]>> = {
  learn: [['cards', 'Cards', 10], ['learn', 'Learn', 35], ['questions', 'Questions', 30], ['mistakes', 'Mistakes', 15]],
  review: [['cards', 'Cards', 10], ['questions', 'Quiz', 40], ['mistakes', 'Mistakes', 20], ['reflect', 'Reflection', 20]],
  repair: [['cards', 'Cards', 10], ['questions', 'Questions', 60], ['mistakes', 'Mistakes', 20]],
  short: [['cards', 'Cards', 8], ['questions', 'Questions', 25], ['mistakes', 'Mistakes', 10]],
  // Today's review has no set length: it is whatever is due.
  due: [['cards', 'Cards', 0], ['questions', 'Questions', 0], ['mistakes', 'Mistakes', 0]],
};
const MAX_CARDS = 40;

/* ==========================================================================
   App
   ========================================================================== */

export default function TriCertApp() {
  const [state, setState] = useState<StudyState>(emptyState);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [view, setView] = useState<View>('today');
  const [selectedProject, setSelectedProject] = useState(projects[0].key);
  const [selectedArtifact, setSelectedArtifact] = useState(projects[0].deliverables[0].key);
  const [docOpen, setDocOpen] = useState(false);
  const [artifactText, setArtifactText] = useState('');
  const [artifactReflection, setArtifactReflection] = useState('');
  const [restoredNote, setRestoredNote] = useState('');
  const [rubricChecks, setRubricChecks] = useState<Record<string, number[]>>({});
  const [practiceScreen, setPracticeScreen] = useState<PracticeScreen>('hub');
  const [run, setRun] = useState<Run | null>(null);
  const [scenarioCursor, setScenarioCursor] = useState(0);
  const [flashIndex, setFlashIndex] = useState(0);
  const [flashRevealed, setFlashRevealed] = useState(false);
  const [progressTab, setProgressTab] = useState<'readiness' | 'portfolio'>('readiness');
  const [exam, setExam] = useState<ExamRun | null>(null);
  const [examOpen, setExamOpen] = useState(false);
  const [examRestored, setExamRestored] = useState(false);
  const [resultId, setResultId] = useState<string | null>(null);
  const [clock, setClock] = useState(0);
  const [morning, setMorning] = useState<MorningRun | null>(null);
  const [morningOpen, setMorningOpen] = useState(false);
  const [morningRestored, setMorningRestored] = useState(false);
  const [weekendOpen, setWeekendOpen] = useState<string | null>(null);
  const [finished, setFinished] = useState<Finished | null>(null);
  const [today] = useState(todayIso);
  const [learnTab, setLearnTab] = useState<LearnTab>('lessons');
  const [lessonFrom, setLessonFrom] = useState<LessonFrom>('learn');
  const [learnItem, setLearnItem] = useState<string | null>(null);
  const [flashCert, setFlashCert] = useState<Certification | 'All'>('All');
  const [labTicks, setLabTicks] = useState<Record<string, number[]>>({});
  const [theme, setTheme] = useState<Theme>(() => (typeof window === 'undefined' ? 'dark' : savedTheme(readPrefs())));
  const [accent, setAccent] = useState<Accent>(() => (typeof window === 'undefined' ? 'beacon' : readPrefs().accent || 'beacon'));
  const [settingsOpen, setSettingsOpen] = useState(false);
  const reading = useReading();
  /* Browser Back and Forward move between a lesson and the screen it came
     from. The popstate listener is set once, so it reads this ref. */
  const lessonNav = useRef<{ open: boolean; leave: () => void; show: (key: string, from: LessonFrom) => void }>({ open: false, leave: () => {}, show: () => {} });
  /* When the open morning was last brought to the front, for its minutes. */
  const openedAt = useRef<number | null>(null);
  const weekendStarted = useRef<number>(0);
  const morningRef = useRef<MorningRun | null>(null);
  /* The latest saved state and practice exam, for timers and chained saves. */
  const stateRef = useRef<StudyState>(emptyState);
  const examRef = useRef<ExamRun | null>(null);
  const examFinishing = useRef(false);

  useEffect(() => {
    // Colour and appearance are interface preferences: this device only.
    const root = document.documentElement;
    if (theme === 'system') delete root.dataset.theme; else root.dataset.theme = theme;
    root.dataset.accent = accent;
  }, [theme, accent]);

  useEffect(() => {
    // Interface preferences only. Learner data stays in the database.
    const prefs = readPrefs();
    const route = routeFromHash();
    const restoredProject = projects.find((item) => item.key === prefs.project) || projects[0];
    const restoredArtifact = restoredProject.deliverables.find((item) => item.key === prefs.artifact) || restoredProject.deliverables[0];

    fetch('/api/state')
      .then(async (response) => {
        const raw = await response.json();
        if (!response.ok) throw new Error(raw.error || 'Unable to load your study plan.');
        const data = normalizeState(raw);
        if (route) { setView(route.view); if (route.tab) setProgressTab(route.tab); if (route.learnTab) setLearnTab(route.learnTab); }
        // A reload on a lesson's history entry opens that lesson again.
        const entry = lessonEntry();
        if (entry && window.location.hash === `#${entry.from}`) { setLessonFrom(entry.from); setLearnTab('lessons'); setLearnItem(entry.lesson); setView('learn'); }
        setSelectedProject(restoredProject.key);
        setSelectedArtifact(restoredArtifact.key);
        if (prefs.rubric) setRubricChecks(prefs.rubric);
        setState(data);
        const saved = data.artifacts.find((row) => row.artifact_key === restoredArtifact.key);
        setArtifactText(saved?.evidence_text || restoredArtifact.template);
        setArtifactReflection(saved?.reflection || '');
        stateRef.current = data;
        // A practice exam comes back with its clock still running from the
        // start time. If the time ran out meanwhile, the timer finishes it.
        const examKept = data.profile ? readExam() : null;
        if (examKept) {
          examRef.current = examKept;
          setExam(examKept);
          if (examKept.finishedAt) { setResultId(examKept.id); setView('practice'); setPracticeScreen('result'); void saveExamResult(examKept, data); }
          else { setClock(Date.now()); setExamOpen(true); setExamRestored(true); }
        }
        // A morning left open comes back on the same part.
        const kept = data.profile ? readMorning() : null;
        if (kept) {
          setMorning(kept);
          setMorningRestored(true);
          if (kept.open && !(examKept && !examKept.finishedAt)) { openedAt.current = Date.now(); setMorningOpen(true); }
        }
      })
      .catch((error) => setNotice({ text: error.message, kind: 'error' }))
      .finally(() => setLoading(false));

    const onPopState = () => {
      const entry = lessonEntry();
      if (entry) { lessonNav.current.show(entry.lesson, entry.from); window.scrollTo({ top: 0 }); }
      else if (lessonNav.current.open) lessonNav.current.leave();
    };
    const onHashChange = () => {
      const next = routeFromHash();
      // Returning to a lesson's entry: the popstate listener has opened it.
      if (!next || lessonEntry()) return;
      setView(next.view);
      if (next.tab) setProgressTab(next.tab);
      if (next.learnTab) { setLearnTab(next.learnTab); setLearnItem(null); }
      else if (next.view === 'learn') setLearnItem(null);
    };
    window.addEventListener('popstate', onPopState);
    window.addEventListener('hashchange', onHashChange);
    return () => { window.removeEventListener('popstate', onPopState); window.removeEventListener('hashchange', onHashChange); };
    // Runs once on load; saveExamResult reads the latest state through refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    lessonNav.current = { open: view === 'learn' && learnTab === 'lessons' && Boolean(learnItem), leave: leaveLesson, show: showLesson };
    morningRef.current = morning;
    stateRef.current = state;
    examRef.current = exam;
  });

  /* The morning's place and writing are kept in this browser every two
     seconds, and when the page is hidden or closed. */
  useEffect(() => {
    const flush = () => { const current = morningRef.current; if (current) writeMorning(withSpent(current, openedAt.current)); };
    const handle = window.setInterval(flush, 2000);
    window.addEventListener('pagehide', flush);
    return () => { window.clearInterval(handle); window.removeEventListener('pagehide', flush); };
  }, []);

  useEffect(() => {
    if (!loading) writePrefs({ v: prefsVersion, project: selectedProject, artifact: selectedArtifact, rubric: rubricChecks, theme, accent });
  }, [loading, selectedProject, selectedArtifact, rubricChecks, theme, accent]);

  useEffect(() => {
    if (!notice || notice.kind !== 'success') return;
    const handle = window.setTimeout(() => setNotice(null), 4000);
    return () => window.clearTimeout(handle);
  }, [notice]);

  /* The practice exam clock. It counts from the start time, so a reload or
     a hidden tab does not stop it, and at 00:00 the exam finishes itself. */
  const examRunning = Boolean(exam && !exam.finishedAt);
  const examEndsAt = exam ? exam.startedAt + exam.minutes * 60000 : 0;
  useEffect(() => {
    if (!examRunning) return;
    const tick = () => {
      const at = Date.now();
      setClock(at);
      const current = examRef.current;
      if (current && !current.finishedAt && at >= examEndsAt) void finishExam(current);
    };
    tick();
    const handle = window.setInterval(tick, 1000);
    return () => window.clearInterval(handle);
    // finishExam reads the latest state through refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [examRunning, examEndsAt]);

  useEffect(() => {
    const locked = morningOpen || examOpen || Boolean(weekendOpen) || Boolean(finished) || settingsOpen;
    document.documentElement.style.overflow = locked ? 'hidden' : '';
    return () => { document.documentElement.style.overflow = ''; };
  }, [morningOpen, examOpen, weekendOpen, finished, settingsOpen]);

  const completed = useMemo(() => new Set(state.progress.filter((row) => row.status === 'complete').map((row) => row.item_key)), [state.progress]);
  const records = state.records;
  const srs = records.srs;
  const block = currentBlock(completed);
  /* The exam he is working on: the current block, or the last ready one
     once every ready block is done. Practice and Progress follow it. */
  const studyBlock = block || [...examBlocks].reverse().find((item) => item.status === 'ready');
  /* Exams he has started: the current block and any block with work done. */
  const startedCerts = examBlocks
    .filter((item) => item.status === 'ready' && (item.key === block?.key || [...item.mornings, ...item.weekends].some((entry) => completed.has(entry.key))))
    .map((item) => item.cert);
  const startedKey = startedCerts.join(',');
  /* Scenarios across exams: the 16 cross-exam scenarios, then the questions
     of exams not started yet. Free practice that counts toward nothing. */
  const freePractice = useMemo(() => {
    const started = startedKey.split(',');
    return [...crossExamScenarios, ...examBlocks.filter((item) => !started.includes(item.cert)).flatMap((item) => questionBank[item.cert])];
  }, [startedKey]);
  const estimates = useMemo(() => {
    const start = records.plan.startDate && isStudyDate(records.plan.startDate) ? records.plan.startDate : today;
    return new Map(estimateDates({ blocks: examBlocks, startDate: start, done: completed, today }).map((item) => [item.key, item.date]));
  }, [records.plan.startDate, completed, today]);
  const dueCards = Object.values(srs.cards).filter((card) => !isCardRetired(card) && card.due <= today).length;
  const dueQuestions = Object.values(srs.questions).filter((question) => !isQuestionRetired(question) && question.due <= today).length;
  const reviewsDue = dueCards + dueQuestions;

  const project = projects.find((item) => item.key === selectedProject) || projects[0];
  const deliverable = project.deliverables.find((item) => item.key === selectedArtifact) || project.deliverables[0];
  const deliverableIndex = project.deliverables.findIndex((item) => item.key === deliverable.key);
  const artifactStatus = (key: string) => state.artifacts.find((row) => row.artifact_key === key)?.status;
  const deliverableStatus = artifactStatus(deliverable.key);
  const savedDeliverable = state.artifacts.find((row) => row.artifact_key === deliverable.key);
  const projectDone = (key: string) => (projects.find((item) => item.key === key)?.deliverables || []).filter((item) => artifactStatus(item.key) === 'complete').length;
  const draftArtifacts = state.artifacts
    .filter((row) => row.status === 'draft')
    .map((row) => allDeliverables.find((item) => item.key === row.artifact_key))
    .filter((item): item is Deliverable => Boolean(item));

  /* Writing in a document is kept in this browser every two seconds until it is saved. */
  useDraftSaver(
    view === 'projects' && docOpen ? `doc:${deliverable.key}` : null,
    { work: artifactText, explain: artifactReflection },
    { work: savedDeliverable?.evidence_text || deliverable.template, explain: savedDeliverable?.reflection || '' },
  );

  function say(text: string) { setNotice({ text, kind: 'success' }); }

  function go(next: View) {
    if (next === 'projects') { openDocuments(); return; }
    // The Learn tab always opens the Learn index, on the section last used.
    if (next === 'learn') setLearnItem(null);
    setView(next);
    if (next === 'practice' && practiceScreen !== 'run') setPracticeScreen('hub');
    const hash = next === 'progress' && progressTab === 'portfolio' ? 'portfolio' : next;
    if (window.location.hash !== `#${hash}` || lessonEntry()) window.history.pushState(null, '', `#${hash}`);
    window.scrollTo({ top: 0, behavior: scrollBehavior() });
  }

  function openDocuments() {
    setDocOpen(false);
    openLearn('documents');
  }

  function openLearn(tab: LearnTab, item: string | null = null) {
    setLearnTab(tab);
    setLearnItem(item);
    setView('learn');
    if (window.location.hash !== '#learn') window.history.pushState(null, '', '#learn');
    window.scrollTo({ top: 0, behavior: scrollBehavior() });
  }

  /* Each lesson gets its own history entry on the address of the screen it
     came from, so browser Back returns there. */
  function openLesson(key: string, from: LessonFrom) {
    showLesson(key, from);
    window.history.pushState({ lesson: key, from } satisfies LessonEntry, '', `#${from}`);
    window.scrollTo({ top: 0, behavior: scrollBehavior() });
  }

  function showLesson(key: string, from: LessonFrom) {
    setLessonFrom(from);
    setLearnTab('lessons');
    setLearnItem(key);
    setView('learn');
  }

  // The lesson's back button steps back through history, so the browser and the app agree.
  function backFromLesson() {
    if (lessonEntry()) window.history.back(); else leaveLesson();
  }

  function leaveLesson() {
    setLearnItem(null);
    setLearnTab('lessons');
    setView(lessonFrom === 'plan' ? 'plan' : lessonFrom === 'today' ? 'today' : 'learn');
    window.scrollTo({ top: 0 });
  }

  async function update(body: Record<string, unknown>): Promise<StudyState | null> {
    setSaving(true);
    setNotice(null);
    try {
      const response = await fetch('/api/state', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to save your work.');
      const next = normalizeState(data);
      setState(next);
      return next;
    } catch (error) {
      setNotice({ text: error instanceof Error ? error.message : 'Unable to save your work.', kind: 'error' });
      return null;
    } finally {
      setSaving(false);
    }
  }

  /* Setup asks three short steps. Fields it no longer asks keep their defaults. */
  async function submitProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const trainingDone = form.get('pmTrainingComplete') === 'yes';
    const startDate = String(form.get('startDate') || '');
    const created = await update({
      action: 'save-profile',
      displayName: form.get('displayName'),
      motivation: form.get('motivation'),
      education: form.get('education'),
      projectsLed: '',
      pmMonths: form.get('pmMonths'),
      pmTrainingHours: trainingDone ? 35 : 0,
      pmTrainingComplete: trainingDone,
      cyberMonths: form.get('cyberMonths'),
      cyberDomains: [],
      powerBiLevel: 'beginner',
      powerQueryLevel: 'beginner',
      daxLevel: 'beginner',
      sqlLevel: 'beginner',
      itilLevel: 'beginner',
      weeklyHours: 11,
      pmpTarget: '',
      pl300Target: '',
      cisspTarget: '',
      itilTarget: '',
    });
    if (!created) return;
    if (isStudyDate(startDate)) await update({ action: 'patch-record', key: 'plan', patch: { startDate } });
    // The setup form is long on a phone: open the new plan at the top.
    window.scrollTo({ top: 0 });
  }

  async function savePersonal(name: string, why: string) {
    const saved = await update({ action: 'save-personal', displayName: name, motivation: why });
    if (saved) { setSettingsOpen(false); say(name.trim() ? `Saved. This plan is yours, ${name.trim().split(/\s+/)[0]}.` : 'Saved.'); }
  }

  async function toggleProgress(key: string) {
    return update({ action: 'set-progress', itemKey: key, status: completed.has(key) ? 'not_started' : 'complete' });
  }

  /* ---------------------------------------------------------- mornings */

  function changeMorning(change: (current: MorningRun) => MorningRun, keep = true) {
    setMorning((current) => {
      if (!current) return current;
      const next = change(current);
      if (keep) writeMorning(withSpent(next, openedAt.current));
      return next;
    });
  }

  function startMorning(item: Morning | null, mode: MorningMode) {
    const owner = item ? examBlocks.find((candidate) => candidate.mornings.some((entry) => entry.key === item.key)) : studyBlock;
    if (!owner) return;
    const key = item ? item.key : `${mode === 'due' ? 'due' : 'short'}-${today}`;
    if (morning && (morning.key === key || (!item && morning.mode === mode))) { resumeMorning(); return; }
    // Answers already given stay saved; only his place in the other morning is set aside.
    if (morning && (morning.part > 0 || Object.keys(morning.questions.answers).length > 0)) say('Your other morning was set aside. Its answers and cards are saved.');
    const taught = owner.mornings.filter((entry) => entry.kind === 'learn' && completed.has(entry.key)).map((entry) => entry.lesson || entry.key);
    const lesson = mode === 'learn' ? item?.lesson : undefined;
    const engineMode: DailyMode = mode === 'short' || mode === 'due' ? 'short' : mode === 'learn' ? 'learn' : 'review';
    const picks = todaysCards({ srs, today, lesson, usercards: records.usercards }).slice(0, MAX_CARDS);
    const questions = todaysQuestions({ exam: owner.cert, srs, today, lesson, mode: engineMode, mocks: records.mocks, taught });
    const next: MorningRun = {
      v: 1, key, morning: item ? item.key : null, mode, block: owner.key, exam: owner.cert, date: today, part: 0, open: true, spentMs: 0,
      cards: { queue: cardQueue(picks), shown: false, reviewed: 0, again: 0 },
      learn: { stage: 'brief', build: '', model: false, recall: [] },
      questions: { ids: questions.map((question) => question.id), index: 0, answers: {} },
      mistakes: {}, savedCards: [], reflection: '',
    };
    openedAt.current = Date.now();
    writeMorning(next);
    setMorning(next);
    setMorningRestored(false);
    setMorningOpen(true);
  }

  function resumeMorning() {
    if (!morning) return;
    openedAt.current = Date.now();
    changeMorning((current) => ({ ...current, open: true }));
    setMorningOpen(true);
  }

  function leaveMorning() {
    const spent = morning ? withSpent(morning, openedAt.current).spentMs : 0;
    openedAt.current = null;
    changeMorning((current) => ({ ...current, open: false, spentMs: spent }));
    setMorningOpen(false);
    setMorningRestored(false);
  }

  async function gradeMorningCard(grade: CardGrade) {
    if (!morning) return;
    const head = morning.cards.queue[0];
    if (!head) return;
    const result = answerCard(morning.cards.queue, srs.cards, grade, today);
    if (!head.repeat) {
      const saved = await update({ action: 'patch-record', key: 'srs', patch: { cards: { [head.id]: result.states[head.id] } } });
      if (!saved) return;
    }
    changeMorning((current) => ({
      ...current,
      cards: { queue: result.queue, shown: false, reviewed: current.cards.reviewed + (head.repeat ? 0 : 1), again: current.cards.again + (grade === 'again' && !head.repeat ? 1 : 0) },
    }));
  }

  async function answerMorningQuestion(question: ScenarioQuestion, choice: string, sure: boolean, seconds: number) {
    const correct = choice === question.correct;
    const result: QuestionResult = !correct ? 'wrong' : sure ? 'right' : 'guess';
    const recorded = await update({ action: 'record-attempt', questionId: question.id, certification: question.certification, domain: question.domain, answer: choice, correct, confidence: sure ? 'high' : 'low' });
    if (!recorded) return false;
    const next = recordQuestionAnswer(recorded.records.srs, question, result, today);
    const delayed = next.delayed?.[question.certification];
    const saved = await update({ action: 'patch-record', key: 'srs', patch: { questions: { [question.id]: next.questions[question.id] }, ...(delayed ? { delayed: { [question.certification]: delayed } } : {}) } });
    if (!saved) return false;
    changeMorning((current) => ({ ...current, questions: { ...current.questions, answers: { ...current.questions.answers, [question.id]: { choice, sure, correct, result, seconds } } } }));
    return true;
  }

  /* Each line he writes in Mistakes becomes one of his own cards, due tomorrow. */
  async function saveMistakeCards(current: MorningRun): Promise<MorningRun | null> {
    const pending = Object.entries(current.mistakes).filter(([id, line]) => line.trim() && !current.savedCards.includes(id));
    if (!pending.length) return current;
    const made: UserCard[] = [];
    for (const [id, line] of pending) {
      const question = questionById(id);
      if (!question || question.certification === 'Intersection') continue;
      const card = makeUserCard({ exam: question.certification, front: question.prompt, back: line, today, lesson: question.lesson, question: question.id });
      if (!(await update({ action: 'append-record', key: 'usercards', item: card }))) return null;
      made.push(card);
    }
    if (made.length && !(await update({ action: 'patch-record', key: 'srs', patch: { cards: Object.fromEntries(made.map((card) => [card.id, startCard(today)])) } }))) return null;
    const next = { ...current, savedCards: [...current.savedCards, ...pending.map(([id]) => id)] };
    writeMorning(withSpent(next, openedAt.current));
    setMorning(next);
    return next;
  }

  async function mistakesDone() {
    if (!morning) return;
    const next = await saveMistakeCards(morning);
    if (next) changeMorning((current) => ({ ...current, savedCards: next.savedCards, part: current.part + 1 }));
  }

  async function finishMorning() {
    if (!morning) return;
    const current = await saveMistakeCards(morning);
    if (!current) return;
    const owner = examBlocks.find((item) => item.key === current.block);
    const item = owner?.mornings.find((entry) => entry.key === current.morning);
    const title = item ? item.title : current.mode === 'due' ? 'Today’s review' : 'Short morning';
    if (current.mode === 'review' && current.reflection.trim()) {
      const saved = await update({ action: 'save-artifact', artifactKey: `retrospective-${current.key}`, status: 'complete', evidenceText: current.reflection, reflection: `${title}: weekly reflection recorded.` });
      if (!saved) return;
    }
    if (current.morning && !(await update({ action: 'set-progress', itemKey: current.morning, status: 'complete' }))) return;
    const answers = Object.values(current.questions.answers);
    const right = answers.filter((answer) => answer.correct).length;
    const minutes = Math.max(1, Math.round(withSpent(current, openedAt.current).spentMs / 60000));
    const logged = await update({
      action: 'append-record',
      key: 'log',
      item: { id: `log-${current.key}-${Date.now().toString(36)}`, key: current.morning || (current.mode === 'due' ? 'due-review' : 'short'), kind: current.mode, block: current.block, date: today, minutes, cards: current.cards.reviewed, questions: answers.length, right } satisfies LogRow,
    });
    if (!logged) return;
    clearMorning();
    morningRef.current = null;
    openedAt.current = null;
    setMorning(null);
    setMorningOpen(false);
    setMorningRestored(false);
    const where = owner && item ? `${owner.cert}, morning ${owner.mornings.indexOf(item) + 1} of ${owner.mornings.length}` : 'Due cards and questions only';
    const extra = current.mode === 'short' || current.mode === 'due';
    setFinished({ title: current.mode === 'due' ? 'Review done' : current.mode === 'short' ? 'Short morning done' : 'Morning done', detail: extra ? where : `${where}: ${title}`, kind: current.mode, minutes, cards: current.cards.reviewed, questions: answers.length, right });
  }

  /* ----------------------------------------------------- weekend blocks */

  function openWeekend(item: WeekendBlock) {
    if (item.kind === 'mock') { startPracticeExam(item); return; }
    weekendStarted.current = Date.now();
    setWeekendOpen(item.key);
  }

  /* A practice exam weekend block opens the practice exam's start screen. */
  function startPracticeExam(item: WeekendBlock) {
    void item;
    openPractice('exam');
  }

  function tickLab(key: string, index: number) {
    setLabTicks((current) => {
      const ticked = new Set(current[key] || readLab(key));
      if (ticked.has(index)) ticked.delete(index); else ticked.add(index);
      const next = [...ticked].sort((x, y) => x - y);
      writeLab(key, next);
      return { ...current, [key]: next };
    });
  }

  async function finishWeekend(item: WeekendBlock) {
    const owner = examBlocks.find((candidate) => candidate.weekends.some((entry) => entry.key === item.key));
    if (!(await update({ action: 'set-progress', itemKey: item.key, status: 'complete' }))) return;
    const minutes = Math.max(1, Math.round((Date.now() - (weekendStarted.current || Date.now())) / 60000));
    const logged = await update({ action: 'append-record', key: 'log', item: { id: `log-${item.key}-${Date.now().toString(36)}`, key: item.key, kind: item.kind, block: owner?.key, date: today, minutes, cards: 0, questions: 0, right: 0 } satisfies LogRow });
    if (!logged) return;
    clearLab(item.key);
    setWeekendOpen(null);
    setFinished({ title: 'Weekend block done', detail: item.title, kind: item.kind, minutes });
  }

  /* ---------------------------------------------------------- documents */

  async function saveArtifact(status: 'draft' | 'complete') {
    const saved = await update({ action: 'save-artifact', artifactKey: deliverable.key, status, evidenceText: artifactText, reflection: artifactReflection });
    if (saved) { clearDraft(`doc:${deliverable.key}`); setRestoredNote(''); say(status === 'complete' ? `${deliverable.title} marked complete.` : 'Draft saved.'); }
  }

  function chooseProject(key: string) {
    const next = projects.find((item) => item.key === key) || projects[0];
    setSelectedProject(next.key);
    setDocOpen(false);
  }

  function openArtifact(item: Deliverable) {
    const owner = projects.find((candidate) => candidate.deliverables.some((artifact) => artifact.key === item.key));
    if (owner) setSelectedProject(owner.key);
    setSelectedArtifact(item.key);
    const saved = state.artifacts.find((row) => row.artifact_key === item.key);
    const base = { work: saved?.evidence_text || item.template, explain: saved?.reflection || '' };
    const draft = readDraft(`doc:${item.key}`);
    if (draft && (draft.value.work !== base.work || draft.value.explain !== base.explain)) {
      setArtifactText(draft.value.work ?? base.work);
      setArtifactReflection(draft.value.explain ?? base.explain);
      setRestoredNote(`Restored your unsaved writing from ${formatTime(draft.at)}.`);
    } else {
      setArtifactText(base.work);
      setArtifactReflection(base.explain);
      setRestoredNote('');
    }
    setDocOpen(true);
    window.scrollTo({ top: 0, behavior: scrollBehavior() });
  }

  function openDocument(item: Deliverable) {
    setView('projects');
    window.history.pushState(null, '', '#projects');
    openArtifact(item);
  }

  function toggleRubric(index: number) {
    setRubricChecks((current) => {
      const ticked = new Set(current[deliverable.key] || []);
      if (ticked.has(index)) ticked.delete(index); else ticked.add(index);
      return { ...current, [deliverable.key]: [...ticked].sort() };
    });
  }

  function exportArtifact() {
    const content = `# ${deliverable.title}\n\n${artifactText}\n\n## Teach-back reflection\n\n${artifactReflection}\n\n---\nKestrel Health Network and Project Beacon are fictional. All data is synthetic.`;
    downloadFile(`${deliverable.key}.md`, content, 'text/markdown');
  }

  /* ------------------------------------------------------------ practice */

  function openPractice(screen: PracticeScreen = 'hub') {
    setPracticeScreen(screen);
    setView('practice');
    if (window.location.hash !== '#practice') window.history.pushState(null, '', '#practice');
    window.scrollTo({ top: 0, behavior: scrollBehavior() });
  }

  /* Scenarios across exams: free practice that counts toward nothing, so
     nothing is saved. */
  function startScenarios() {
    const ordered = [...freePractice.slice(scenarioCursor % freePractice.length), ...freePractice.slice(0, scenarioCursor % freePractice.length)];
    setRun({ kind: 'scenarios', title: 'Scenarios across exams', questions: ordered, index: 0, answered: 0, correct: 0 });
    setPracticeScreen('run');
    window.scrollTo({ top: 0 });
  }

  function startArtifactCheck() {
    setRun({ kind: 'artifact', title: deliverable.title, questions: questionsForDeliverable(deliverable), index: 0, answered: 0, correct: 0 });
    setPracticeScreen('run');
    setView('practice');
    window.history.pushState(null, '', '#practice');
    window.scrollTo({ top: 0 });
  }

  async function answer(question: ScenarioQuestion, choice: string) {
    if (!run) return false;
    const correct = choice === question.correct;
    if (run.kind === 'artifact') {
      const saved = await update({ action: 'record-attempt', questionId: question.id, certification: question.certification, domain: question.domain, answer: choice, correct, confidence: 'medium' });
      if (!saved) return false;
    }
    setRun({ ...run, answered: run.answered + 1, correct: run.correct + (correct ? 1 : 0) });
    return true;
  }

  function advance() {
    if (!run) return;
    if (run.kind === 'scenarios') setScenarioCursor((cursor) => cursor + 1);
    if (run.index < run.questions.length - 1) { setRun({ ...run, index: run.index + 1 }); return; }
    endRun();
  }

  function endRun() {
    if (!run) return;
    if (run.answered > 0) say(`${run.correct} of ${run.answered} right.`);
    setRun(null);
    setPracticeScreen('hub');
  }

  /* --------------------------------------------------- practice exams */

  function changeExam(change: (current: ExamRun) => ExamRun) {
    setExam((current) => {
      if (!current || current.finishedAt) return current;
      const next = change(current);
      writeExam(next);
      examRef.current = next;
      return next;
    });
  }

  function beginExam() {
    if (!studyBlock) return;
    if (exam && !exam.finishedAt) { setExamRestored(false); setExamOpen(true); return; }
    const gate = practiceExamGate(studyBlock, completed, records.mocks, today);
    if (!gate.open) return;
    const id = `mock-${studyBlock.key}-${Date.now().toString(36)}`;
    const next = nextPracticeExam({ exam: studyBlock.cert, mocks: records.mocks, srs, today, seed: id });
    if (!next.questions.length) { setNotice({ text: 'There are no questions for this practice exam yet.', kind: 'error' }); return; }
    const created: ExamRun = {
      v: 1, id, exam: studyBlock.cert, block: studyBlock.key, form: next.form, ids: next.questions.map((question) => question.id), answers: {}, flags: [], index: 0,
      startedAt: Date.now(), minutes: studyBlock.exam.minutes, allowBack: studyBlock.exam.allowBack, target: studyBlock.exam.target, saved: [],
    };
    writeExam(created);
    examRef.current = created;
    setExam(created);
    setClock(created.startedAt);
    setExamRestored(false);
    setExamOpen(true);
  }

  /* Finish: on his word, or by itself at 00:00. The result shows at once;
     saving follows and can be tried again if it fails. */
  async function finishExam(current: ExamRun) {
    if (examFinishing.current || current.finishedAt) return;
    examFinishing.current = true;
    const done: ExamRun = { ...current, finishedAt: Math.min(Date.now(), current.startedAt + current.minutes * 60000), date: today };
    writeExam(done);
    examRef.current = done;
    setExam(done);
    setExamOpen(false);
    setExamRestored(false);
    setResultId(done.id);
    setPracticeScreen('result');
    setView('practice');
    if (window.location.hash !== '#practice') window.history.pushState(null, '', '#practice');
    window.scrollTo({ top: 0 });
    await saveExamResult(done);
    examFinishing.current = false;
  }

  /* Saving a result: the mocks record (with his answers), the review
     schedules the engine returns, and for form A or B its weekend block
     (progress and a log line). Each step is noted so a retry never
     repeats one. */
  async function saveExamResult(run: ExamRun, base?: StudyState) {
    let current = run;
    let latest = base || stateRef.current;
    const questions = run.ids.map((id) => questionById(id)).filter((question): question is ScenarioQuestion => Boolean(question));
    const score = scoreExam(questions, run.answers);
    const owner = examBlocks.find((item) => item.key === run.block);
    const weekend = owner?.weekends.find((item) => item.kind === 'mock' && item.form === run.form)?.key;
    const date = run.date || today;
    const minutes = Math.max(1, Math.round(((run.finishedAt || Date.now()) - run.startedAt) / 60000));
    const steps: Array<[string, () => Record<string, unknown> | null]> = [
      ['mock', () => ({ action: 'append-record', key: 'mocks', item: { id: run.id, exam: run.exam, form: run.form, date, total: score.total, right: score.right, areas: score.areas, weekend, ids: run.ids, answers: run.answers, flags: run.flags, minutes } satisfies MockRow })],
      ['srs', () => {
        const after = afterExam(latest.records.srs, questions, run.answers, date);
        const delayed = after.delayed?.[run.exam];
        return { action: 'patch-record', key: 'srs', patch: { questions: Object.fromEntries(run.ids.filter((id) => after.questions[id]).map((id) => [id, after.questions[id]])), ...(delayed ? { delayed: { [run.exam]: delayed } } : {}) } };
      }],
      ['progress', () => (weekend && !latest.progress.some((row) => row.item_key === weekend && row.status === 'complete') ? { action: 'set-progress', itemKey: weekend, status: 'complete' } : null)],
      ['log', () => ({ action: 'append-record', key: 'log', item: { id: `log-${run.id}`, key: weekend || 'practice-exam', kind: 'mock', block: run.block, date, minutes, cards: 0, questions: score.total, right: score.right } satisfies LogRow })],
    ];
    for (const [name, body] of steps) {
      if (current.saved.includes(name)) continue;
      const request = body();
      if (request) {
        const next = await update(request);
        if (!next) return false;
        latest = next;
      }
      current = { ...current, saved: [...current.saved, name] };
      writeExam(current);
      examRef.current = current;
      setExam(current);
    }
    clearExam();
    examRef.current = null;
    setExam(null);
    return true;
  }

  function leaveExam() {
    setExamOpen(false);
    setExamRestored(false);
  }

  function openResult(id: string) {
    setResultId(id);
    openPractice('result');
  }

  if (loading) {
    return <main className="boot" aria-live="polite"><BrandMark size={44} /><p>Loading your plan</p></main>;
  }

  if (!state.profile) {
    return <Onboarding notice={notice} saving={saving} today={today} onSubmit={submitProfile} />;
  }

  const profile = state.profile;
  const profileDomains = safeDomains(profile.cyber_domains);
  const pmpNeeded = profile.education === 'secondary' ? 60 : profile.education === 'associate' ? 48 : profile.education === 'gac' ? 24 : 36;
  const pmpEligible = profile.pm_months >= pmpNeeded && (Boolean(profile.pm_training_complete) || profile.pm_training_hours >= 35);
  const cisspNeeded = profile.education === 'bachelor' || profile.education === 'gac' ? 48 : 60;
  const cisspEligible = profile.cyber_months >= cisspNeeded && profileDomains.length >= 2;
  const exams = certs.map((item) => ({ ...item, date: String(profile[item.field] || ''), days: daysUntil(String(profile[item.field] || ''), today) }));
  const nextExam = exams.filter((item) => item.days !== null && item.days >= 0).sort((a, b) => (a.days ?? 0) - (b.days ?? 0))[0];
  const ticked = new Set(rubricChecks[deliverable.key] || []);
  const workShort = Math.max(0, 120 - artifactText.trim().length);
  const explainShort = Math.max(0, 40 - artifactReflection.trim().length);
  const completeBlockers = [workShort ? `${workShort} more characters of work` : '', explainShort ? `${explainShort} more characters of explanation` : ''].filter(Boolean);
  const displayName = (profile.display_name || '').trim();
  const firstName = displayName.split(/\s+/)[0] || '';
  const initials = displayName.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join('');
  const hour = new Date().getHours();
  const greeting = `${hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'}${firstName ? `, ${firstName}` : ''}`;
  const readingLesson = view === 'learn' && learnTab === 'lessons' && Boolean(learnItem);
  const navActive: View = view === 'projects' ? 'learn' : readingLesson ? lessonFrom : view;
  const inRun = view === 'practice' && practiceScreen === 'run';

  /* Today: the next item of the current block. Weekdays get the next
     morning; Saturday and Sunday get the next weekend block when one is open. */
  const nextMorning = block ? block.mornings.find((item) => !completed.has(item.key) && morningGate(block, item, completed).open) : undefined;
  const nextWeekend = block ? block.weekends.find((item) => !completed.has(item.key)) : undefined;
  const weekendGate = block && nextWeekend ? weekendState(block, nextWeekend, completed, records, today) : null;
  const isWeekend = [0, 6].includes(weekday(today));
  const showWeekend = Boolean(block && nextWeekend && weekendGate?.open && (isWeekend || !nextMorning));
  const morningsDone = block ? block.mornings.filter((item) => completed.has(item.key)).length : 0;
  const examEstimate = block ? estimates.get(`${block.key}-exam`) : null;
  const shortRun = morning?.mode === 'short' ? morning : null;
  const standing = block
    ? `${block.title}. ${examEstimate ? `Exam about ${formatDate(examEstimate)} at five mornings and one weekend block a week.` : 'Every morning and weekend block is done.'}`
    : 'Every exam block that is ready is done. The next one is being built.';
  const openPlan = () => go('plan');

  /* Practice and Progress follow the exam he is working on. */
  const examGate = studyBlock ? practiceExamGate(studyBlock, completed, records.mocks, today) : null;
  const examLeft = exam && !exam.finishedAt ? Math.max(0, Math.ceil((examEndsAt - clock) / 1000)) : 0;
  const examResults: ExamResult[] = records.mocks
    .filter((row) => typeof row.total === 'number' && typeof row.right === 'number' && isStudyDate(row.date))
    .map((row) => ({ id: row.id, exam: row.exam, form: row.form, date: row.date, total: row.total as number, right: row.right as number, areas: row.areas || [] }));
  const bookingChecks: BookingCheck[] = studyBlock ? readyToBook({ block: studyBlock, done: completed, results: examResults, delayed: srs.delayed?.[studyBlock.cert], today }) : [];
  const bookingReady = bookingChecks.length > 0 && allChecksMet(bookingChecks);
  const checksMet = bookingChecks.filter((item) => item.met === true).length;
  const history = studyBlock ? records.mocks.filter((row) => row.exam === studyBlock.cert && typeof row.total === 'number').sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)) : [];
  const delayed = studyBlock ? srs.delayed?.[studyBlock.cert] : undefined;
  const resultRow = resultId ? records.mocks.find((row) => row.id === resultId) : undefined;
  const resultSource: ExamView | null = exam && exam.finishedAt && exam.id === resultId
    ? { id: exam.id, exam: exam.exam, form: exam.form, date: exam.date || today, ids: exam.ids, answers: exam.answers, target: exam.target, saved: false }
    : resultRow && resultRow.ids
      ? { id: resultRow.id, exam: (resultRow.exam || 'ITIL') as Certification, form: resultRow.form, date: resultRow.date, ids: resultRow.ids, answers: resultRow.answers || {}, target: examBlocks.find((item) => item.cert === resultRow.exam)?.exam.target ?? 80, saved: true }
      : null;
  const reviewRun = morning?.mode === 'due' ? morning : null;
  const flashExams = startedCerts.length ? startedCerts : studyBlock ? [studyBlock.cert] : [];

  /* Today keeps a short list of things already started: drafts and reviews due. */
  const waiting: Array<{ title: string; detail: string; go: () => void }> = [];
  draftArtifacts.slice(0, 2).forEach((item) => waiting.push({ title: item.title, detail: `Draft, ${docNumberFor(item)}`, go: () => openDocument(item) }));
  if (reviewsDue) waiting.push({ title: `${dueCards} ${dueCards === 1 ? 'card' : 'cards'} and ${dueQuestions} ${dueQuestions === 1 ? 'question' : 'questions'} due for review`, detail: 'Today’s review on Practice. A morning also starts with them.', go: () => openPractice('hub') });

  const documentsPanel = (
    <div className="projects">
      <div className="releases" role="tablist" aria-label="Releases">
        {projects.map((item, index) => {
          const done = projectDone(item.key);
          return (
            <button key={item.key} role="tab" aria-selected={item.key === project.key} className={item.key === project.key ? 'release active' : 'release'} onClick={() => chooseProject(item.key)}>
              <span className="release-no">Release {index + 1}</span>
              <strong>{item.title}</strong>
              <span className="release-meter"><Meter value={done / item.deliverables.length} /><span>{done} of {item.deliverables.length}</span></span>
            </button>
          );
        })}
      </div>
      <h2 className="release-title">{project.title}</h2>
      <p className="release-story">{keepTogether(project.narrative)}</p>
      <ul className="list doc-list" aria-label={`${project.title} documents`}>
        {project.deliverables.map((item, index) => {
          const status = artifactStatus(item.key);
          return (
            <li key={item.key}>
              <button onClick={() => { setView('projects'); window.history.pushState(null, '', '#projects'); openArtifact(item); }}>
                <span className="doc-no">{docNumber(project.key, index)}</span>
                <span className="doc-title"><strong>{item.title}</strong><small>{item.summary}</small></span>
                <DocStatus status={status} />
                <Chevron dir="right" />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );

  /* While an overlay is open the page behind it is inert, so keyboard focus
     stays inside the overlay. Messages sit outside and stay reachable. */
  const weekendItem = weekendOpen ? examBlocks.flatMap((item) => item.weekends).find((item) => item.key === weekendOpen) : undefined;
  const examShown = examOpen && exam && !exam.finishedAt ? exam : null;
  const overlayOpen = (morningOpen && Boolean(morning)) || Boolean(examShown) || Boolean(weekendItem) || Boolean(finished) || settingsOpen;
  const morningPart = morning ? morningParts[morning.mode][Math.min(morning.part, morningParts[morning.mode].length - 1)][1] : '';
  const examAway = exam && !exam.finishedAt && !examOpen;
  const morningChip = examAway ? (
    <button className="live-chip" onClick={beginExam} aria-label={`Back to your practice exam, ${formatCountdown(examLeft)} left`}>
      <span className="live-dot" aria-hidden="true" />
      <span><Digits value={formatCountdown(examLeft)} /></span>
    </button>
  ) : morning && !morningOpen ? (
    <button className="live-chip" onClick={resumeMorning} aria-label={`Back to your ${morning.mode === 'due' ? 'review' : 'morning'}, ${morningPart}`}>
      <span className="live-dot paused" aria-hidden="true" />
      <span>{morningPart}</span>
    </button>
  ) : null;
  const heroMain = (label: string, action: () => void) => (
    <button className="primary play" onClick={action}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z" fill="currentColor" /></svg>
      <span className="play-label">{label}</span>
    </button>
  );

  return (
    <>
      <div className="app" inert={overlayOpen}>
        <aside className="rail">
          <a className="brand" href="#today" aria-label="TriCert Lab, Today" title="TriCert Lab" onClick={(event) => { event.preventDefault(); go('today'); }}><BrandMark /><span className="brand-name">TriCert Lab</span></a>
          <nav className="nav" aria-label="Main navigation">
            {navItems.map(([key, label]) => {
              const badge = key === 'practice' && reviewsDue > 0 ? reviewsDue : 0;
              return (
                <button key={key} className={navActive === key ? 'active' : ''} aria-current={navActive === key ? 'page' : undefined} aria-label={badge ? `${label}, ${badge} due for review` : undefined} onClick={() => go(key)}>
                  <span className="nav-glyph"><NavIcon name={key} />{badge > 0 && <span className="nav-badge" aria-hidden="true">{badge > 99 ? '99+' : badge}</span>}</span>
                  <span className="nav-label">{label}</span>
                </button>
              );
            })}
          </nav>
          {examAway ? (
            <button className="live-pill" onClick={beginExam}>
              <span className="live-dot" aria-hidden="true" />
              <span className="live-text"><span className="live-clock"><Digits value={formatCountdown(examLeft)} /></span><span className="live-name">Back to your practice exam</span></span>
            </button>
          ) : morning && !morningOpen && (
            <button className="live-pill" onClick={resumeMorning}>
              <span className="live-dot paused" aria-hidden="true" />
              <span className="live-text"><span className="live-clock">{morningPart}</span><span className="live-name">{morning.mode === 'due' ? 'Back to your review' : 'Back to your morning'}</span></span>
            </button>
          )}
          <div className="rail-foot">
            {nextExam && view !== 'today' && <p className="rail-exam"><strong>{nextExam.days}</strong> {nextExam.days === 1 ? 'day' : 'days'} to {nextExam.label}</p>}
            <button className="me" title="Make it yours" onClick={() => setSettingsOpen(true)}>
              <span className="avatar" aria-hidden="true">{initials || <Flame size={16} />}</span>
              <span className="me-text"><strong>{firstName || 'You'}</strong><small>Make it yours</small></span>
            </button>
          </div>
        </aside>

        {!inRun && (
          <header className="topbar">
            <a className="brand" href="#today" aria-label="TriCert Lab, Today" onClick={(event) => { event.preventDefault(); go('today'); }}><BrandMark size={28} /><span className="brand-name">TriCert Lab</span></a>
            <span className="topbar-end">
              {morningChip}
              <button className="avatar-button" onClick={() => setSettingsOpen(true)} aria-label="Make it yours: your name, why, colour and appearance">
                <span className="avatar" aria-hidden="true">{initials || <Flame size={16} />}</span>
              </button>
            </span>
          </header>
        )}

        <main className={`stage view-${view}${inRun ? ' is-run' : ''}`} id="main" tabIndex={-1}>
          {view === 'today' && (
            <div className="today">
              <header className="hello">
                <div className="hello-text">
                  <h1>{greeting}</h1>
                  <p className="lede">{keepTogether(standing)}</p>
                  {profile.motivation
                    ? <p className="why">{profile.motivation}</p>
                    : <button className="text-link why-add" onClick={() => setSettingsOpen(true)}>Add why you are doing this</button>}
                </div>
                <dl className="tally" aria-label="Your progress">
                  {block && <div className="tally-main"><dt>Mornings done</dt><dd><strong>{morningsDone}</strong><span>/{block.mornings.length}</span></dd><span className="tally-bar" aria-hidden="true"><span style={{ width: `${Math.round((morningsDone / Math.max(1, block.mornings.length)) * 100)}%` }} /></span></div>}
                  <div><dt>Reviews due</dt><dd><strong>{reviewsDue}</strong></dd></div>
                </dl>
              </header>

              {!block && (
                <section className="hero-session is-done" aria-labelledby="session-title">
                  <h2 id="session-title">All ready blocks are done</h2>
                  <p className="hero-sub"><span>The next exam block is being built. Keep your reviews going in Practice.</span></p>
                  <div className="hero-actions">{heroMain('Open the plan', openPlan)}</div>
                </section>
              )}

              {block && showWeekend && nextWeekend && (
                <section className="hero-session" aria-labelledby="session-title">
                  <div className="hero-top">
                    <p className="hero-when-line"><span className="hero-label">{isWeekend ? 'This weekend' : 'Up next'}</span><span className="hero-when">{block.cert}, weekend block {block.weekends.indexOf(nextWeekend) + 1} of {block.weekends.length}</span></p>
                    <span className="hero-tags"><Tag>{nextWeekend.kind === 'lab' ? 'Lab' : 'Practice exam'}</Tag></span>
                  </div>
                  <h2 id="session-title">{keepTogether(nextWeekend.title)}</h2>
                  <p className="hero-sub"><span>{formatMinutes(nextWeekend.minutes)}</span><span>{nextWeekend.kind === 'lab' ? `${nextWeekend.steps.length} steps in a real tool` : `${block.exam.questions} questions in ${block.exam.minutes} minutes`}</span></p>
                  <div className="hero-actions">{heroMain(nextWeekend.kind === 'lab' ? 'Start lab' : 'Start practice exam', () => openWeekend(nextWeekend))}</div>
                  {nextMorning && <button className="text-link hero-link" onClick={() => startMorning(nextMorning, modeFor(nextMorning))}>{morning?.key === nextMorning.key ? 'Resume your morning instead' : 'Do a morning instead'}</button>}
                </section>
              )}

              {block && !showWeekend && nextMorning && (
                <section className="hero-session" aria-labelledby="session-title">
                  <div className="hero-top">
                    <p className="hero-when-line"><span className="hero-label">{morning?.key === nextMorning.key ? 'In progress' : 'Up next'}</span><span className="hero-when">{block.cert}, morning {block.mornings.indexOf(nextMorning) + 1} of {block.mornings.length}</span></p>
                    <span className="hero-tags"><Tag>{kindLabel(nextMorning.kind)}</Tag></span>
                  </div>
                  <h2 id="session-title">{keepTogether(nextMorning.title)}</h2>
                  <p className="hero-sub">
                    <span>{formatMinutes(morningParts[modeFor(nextMorning)].reduce((sum, [, , minutes]) => sum + minutes, 0))}</span>
                    <span>{morningParts[modeFor(nextMorning)].map(([, label]) => label).join(', ')}</span>
                    {nextMorning.brief && <span>Brief from {nextMorning.brief.from}</span>}
                  </p>
                  {isWeekend && weekendGate && !weekendGate.open && <p className="hint hero-note">No weekend block is open yet. The next one {lowerFirst(weekendGate.reason)}.</p>}
                  <div className="hero-actions">{heroMain(morning?.key === nextMorning.key ? `Resume morning, ${morningPart.toLowerCase()}` : 'Start morning', () => startMorning(nextMorning, modeFor(nextMorning)))}</div>
                  <button className="text-link hero-link" onClick={() => startMorning(null, 'short')}>{shortRun ? 'Resume the short morning' : 'Short morning (45 minutes)'}</button>
                </section>
              )}

              {block && !showWeekend && !nextMorning && (
                <section className="hero-session is-done" aria-labelledby="session-title">
                  <div className="hero-top">
                    <p className="hero-when-line"><span className="hero-label">Waiting</span><span className="hero-when">{block.cert}</span></p>
                  </div>
                  <h2 id="session-title">{nextWeekend ? keepTogether(nextWeekend.title) : 'Book your exam'}</h2>
                  <p className="hero-sub"><span>{nextWeekend && weekendGate ? `${weekendGate.reason}.` : 'Every morning and weekend block is done. Check Ready to book on Progress.'}</span></p>
                  <div className="hero-actions">{heroMain(shortRun ? 'Resume the short morning' : 'Short morning (45 minutes)', () => startMorning(null, 'short'))}</div>
                </section>
              )}

              {waiting.length > 0 && (
                <section className="waiting" aria-labelledby="waiting-title">
                  <h2 id="waiting-title" className="section-title">Waiting on you</h2>
                  <ul className="list">
                    {waiting.map((item) => <li key={item.title}><button className="row" onClick={item.go}><span className="row-text"><strong>{keepTogether(item.title)}</strong><small>{item.detail}</small></span><Chevron dir="right" /></button></li>)}
                  </ul>
                </section>
              )}
            </div>
          )}

          {view === 'plan' && (
            <PlanView
              completed={completed}
              records={records}
              estimates={estimates}
              today={today}
              current={block}
              runKey={morning?.key}
              nextMorning={nextMorning?.key}
              onMorning={(item) => startMorning(item, modeFor(item))}
              onWeekend={openWeekend}
            />
          )}

          {(view === 'learn' || (view === 'projects' && !docOpen)) && (
            <LearnView
              tab={view === 'projects' ? 'documents' : learnTab}
              item={view === 'projects' ? null : learnItem}
              lessonFrom={lessonFrom}
              block={block}
              onLeaveLesson={backFromLesson}
              onTab={(tab) => { setView('learn'); setLearnTab(tab); setLearnItem(null); if (window.location.hash !== '#learn') window.history.pushState(null, '', '#learn'); window.scrollTo({ top: 0 }); }}
              onOpenLesson={(key) => openLesson(key, 'learn')}
              onItem={(item) => {
                setLearnItem(item);
                // Previous and Next keep the lesson's history entry on the lesson shown.
                const entry = lessonEntry();
                if (entry && learnTab === 'lessons' && item) window.history.replaceState({ lesson: item, from: entry.from } satisfies LessonEntry, '');
                window.scrollTo({ top: 0 });
              }}
              completed={completed}
              documents={documentsPanel}
              onOpenDoc={openDocument}
            />
          )}

          {view === 'projects' && docOpen && (
            <article className="doc" aria-labelledby="doc-title">
              <button className="back" onClick={openDocuments}><Chevron dir="left" /> Documents</button>
              <header className="doc-head">
                <p className="eyebrow"><span>{docNumber(project.key, deliverableIndex)}</span><span>Release {releaseNumber(project.key)}</span><DocStatus status={deliverableStatus} /></p>
                <h1 id="doc-title">{deliverable.title}</h1>
                <p className="lede">{keepTogether(deliverable.summary)}</p>
              </header>
              {restoredNote && <p className="hint restored" role="status">{restoredNote}</p>}
              <div className="folds">
                {reading?.docGuides[deliverable.key] ? (
                  <>
                    <details className="brief guide-fold" open={!deliverableStatus}>
                      <summary className="row"><span className="row-text"><strong>How to write it</strong><small>{reading.docGuides[deliverable.key].sections.length} sections, with common mistakes</small></span><FoldMark /></summary>
                      <GuideBody guide={reading.docGuides[deliverable.key]} showModel={false} />
                    </details>
                    <details className="brief guide-fold finished-fold">
                      <summary className="row"><span className="row-text"><strong>See the finished example</strong><small>The Kestrel version, written in full</small></span><FoldMark /></summary>
                      <div className="lesson"><RichText text={reading.docGuides[deliverable.key].modelDocument} /></div>
                    </details>
                  </>
                ) : guideIndex[deliverable.key] ? <p className="hint loading-note">Loading the writing guide</p> : null}
                <details className="brief done-when">
                  <summary className="row"><span className="row-text"><strong>Done when</strong><small>{ticked.size} of {deliverable.rubric.length} checked</small></span><FoldMark /></summary>
                  <div className="brief-body">
                    <ul className="rubric">
                      {deliverable.rubric.map((item, index) => (
                        <li key={item}><label><input type="checkbox" checked={ticked.has(index)} onChange={() => toggleRubric(index)} /><span className="box" aria-hidden="true"><Check /></span><span>{item}</span></label></li>
                      ))}
                    </ul>
                    <p className="hint">{deliverable.why}</p>
                    <div className="ideas">{deliverable.concepts.map((concept) => <details key={concept}><summary>{concept}</summary><p>{conceptGlossary[concept] || 'A core idea that connects this document to the exams.'}</p></details>)}</div>
                  </div>
                </details>
              </div>
              <label className="field" htmlFor="work">Your work</label>
              <textarea id="work" className="writing" value={artifactText} onChange={(event) => setArtifactText(event.target.value)} />
              <label className="field" htmlFor="explain">Explain it in your own words</label>
              <ul className="hint field-hint" id="explain-prompts">{deliverable.reflections.map((prompt) => <li key={prompt}>{keepTogether(prompt)}</li>)}</ul>
              <textarea id="explain" aria-describedby="explain-prompts" value={artifactReflection} onChange={(event) => setArtifactReflection(event.target.value)} placeholder="Write your answers here" />
              <div className="doc-actions">
                <span className="hint">{completeBlockers.length ? `To mark complete: ${completeBlockers.join(' and ')}.` : deliverableStatus === 'complete' ? 'Complete. Saving again keeps it complete.' : 'Ready to mark complete.'}</span>
                <button className="ghost" onClick={exportArtifact}>Export</button>
                <button className="secondary" onClick={() => saveArtifact('draft')} disabled={saving}>Save draft</button>
                <button className="primary" onClick={() => saveArtifact('complete')} disabled={saving || completeBlockers.length > 0}>Mark complete</button>
              </div>
              <ul className="list doc-more">
                <li>
                  <button className="row check-yourself" onClick={startArtifactCheck}>
                    <span className="row-text"><strong>Check yourself</strong><small>Five decisions about this document</small></span>
                    <Chevron dir="right" />
                  </button>
                </li>
              </ul>
            </article>
          )}

          {view === 'practice' && practiceScreen === 'hub' && (
            <div className="practice">
              <header className="screen-head">
                <h1>Practice</h1>
                <p className="lede">Spaced review keeps what you learned. The practice exam tells you when to book.</p>
              </header>
              <section className={reviewsDue || reviewRun ? 'hero-session review-card' : 'hero-session review-card is-done'} aria-labelledby="review-title">
                <div className="hero-top">
                  <p className="hero-when-line"><span className="hero-label">{reviewRun ? 'In progress' : 'Today’s review'}</span>{reviewsDue > 0 && <span className="hero-when">{reviewsDue} due</span>}</p>
                </div>
                <h2 id="review-title">{reviewsDue ? `${dueCards} ${dueCards === 1 ? 'card' : 'cards'} and ${dueQuestions} ${dueQuestions === 1 ? 'question' : 'questions'} due` : 'Nothing due today'}</h2>
                <p className="hero-sub"><span>{reviewsDue || reviewRun ? 'Cards, then questions, then your mistakes. No lesson.' : 'Cards and questions come back here on the day they are due.'}</span></p>
                {(reviewsDue > 0 || reviewRun) && <div className="hero-actions">{heroMain(reviewRun ? 'Resume review' : 'Start review', () => (reviewRun ? resumeMorning() : startMorning(null, 'due')))}</div>}
              </section>
              <ul className="list practice-list" aria-label="More practice">
                <li>
                  <button className="row tile tile-exam" onClick={() => openPractice('exam')}>
                    <Glyph name="timed" />
                    <span className="row-text"><strong>Practice exam</strong><small>{exam && !exam.finishedAt ? `In progress, ${formatCountdown(examLeft)} left` : examGate && studyBlock ? (examGate.open ? `${formName(examGate.form)}: ${studyBlock.exam.questions} questions in ${studyBlock.exam.minutes} minutes` : examGate.reason) : 'Opens with the first exam block'}</small></span>
                    <Chevron dir="right" />
                  </button>
                </li>
                <li>
                  <button className="row tile tile-cards" onClick={() => { setFlashIndex(0); setFlashRevealed(false); setFlashCert('All'); setPracticeScreen('flashcards'); }}>
                    <Glyph name="cards" />
                    <span className="row-text"><strong>Flashcards</strong><small>{flashExams.reduce((sum, cert) => sum + cardsForExam(cert, records.usercards).length, 0)} cards from {flashExams.map(examLabel).join(', ') || 'your exams'}, to browse</small></span>
                    <Chevron dir="right" />
                  </button>
                </li>
                <li>
                  <button className="row tile tile-cross" onClick={startScenarios}>
                    <Glyph name="review" />
                    <span className="row-text"><strong>Scenarios across exams</strong><small>{freePractice.length} questions from all four exams. Free practice that counts toward nothing.</small></span>
                    <Chevron dir="right" />
                  </button>
                </li>
                <li>
                  <button className="row tile tile-labs" onClick={() => setPracticeScreen('labs')}>
                    <Glyph name="labs" />
                    <span className="row-text"><strong>Labs</strong><small>{labCards.filter((lab) => completed.has(lab.key)).length} of {labCards.length} Kestrel labs done, with datasets</small></span>
                    <Chevron dir="right" />
                  </button>
                </li>
              </ul>
            </div>
          )}

          {view === 'practice' && practiceScreen === 'run' && run && (
            <QuizRun
              key={`${run.kind}-${run.questions[run.index].id}-${run.index}`}
              run={run}
              saving={saving}
              timerChip={morningChip}
              onAnswer={answer}
              onNext={advance}
              onClose={endRun}
            />
          )}

          {view === 'practice' && practiceScreen === 'exam' && (
            <ExamStart
              block={studyBlock}
              gate={examGate}
              running={exam && !exam.finishedAt ? exam : null}
              left={examLeft}
              lastResult={history[0]}
              onBack={() => setPracticeScreen('hub')}
              onStart={beginExam}
              onResult={openResult}
            />
          )}

          {view === 'practice' && practiceScreen === 'result' && (
            resultSource
              ? <ExamResultView result={resultSource} saving={saving} onSave={() => { if (exam && exam.finishedAt) void saveExamResult(exam); }} onBack={() => setPracticeScreen('hub')} />
              : <div className="exam-result"><button className="back" onClick={() => setPracticeScreen('hub')}><Chevron dir="left" /> Practice</button><p className="lede">This result is no longer here.</p></div>
          )}

          {view === 'practice' && practiceScreen === 'flashcards' && (() => {
            const all = flashExams.flatMap((cert) => cardsForExam(cert, records.usercards));
            const deck = flashCert === 'All' ? all : all.filter((card) => card.exam === flashCert);
            if (!deck.length) {
              return <div className="flash"><button className="back" onClick={() => setPracticeScreen('hub')}><Chevron dir="left" /> Practice</button><header className="screen-head"><h1>Flashcards</h1><p className="lede">No cards yet for the exams you have started.</p></header></div>;
            }
            const index = Math.min(flashIndex, deck.length - 1);
            const card = deck[index];
            const move = (step: number) => { setFlashIndex((index + step + deck.length) % deck.length); setFlashRevealed(false); };
            return (
              <div className="flash">
                <button className="back" onClick={() => setPracticeScreen('hub')}><Chevron dir="left" /> Practice</button>
                <header className="screen-head"><h1>Flashcards</h1><p className="lede">The cards of {flashExams.map(examLabel).join(' and ')}, to browse. Say the answer out loud, then tap the card to check. Your spaced review is on Practice.</p></header>
                {flashExams.length > 1 && (
                  <div className="pills" role="group" aria-label="Deck">
                    {(['All', ...flashExams] as Array<Certification | 'All'>).map((cert) => (
                      <button key={cert} className={flashCert === cert ? 'pill active' : 'pill'} aria-pressed={flashCert === cert} onClick={() => { setFlashCert(cert); setFlashIndex(0); setFlashRevealed(false); }}>{cert === 'All' ? 'All' : examLabel(cert)}</button>
                    ))}
                  </div>
                )}
                <button className={flashRevealed ? 'flash-card revealed' : 'flash-card'} onClick={() => setFlashRevealed(!flashRevealed)} aria-label={flashRevealed ? 'Hide answer' : 'Show answer'}>
                  <span className="flash-top">
                    <span className="flash-cert">{examLabel(card.exam)}{card.source === 'mine' ? ', your card' : ''}, card {index + 1} of {deck.length}</span>
                    <span className="flash-progress" aria-hidden="true"><span style={{ width: `${((index + 1) / deck.length) * 100}%` }} /></span>
                  </span>
                  <span className="flash-q">{keepTogether(card.front)}</span>
                  {flashRevealed ? <span className="flash-a">{keepTogether(card.back)}</span> : <span className="flash-hint">Tap to reveal the answer</span>}
                </button>
                <div className="row-actions spread">
                  <button className="secondary" onClick={() => move(-1)}><Chevron dir="left" /> Previous</button>
                  <button className="primary" onClick={() => move(1)}>Next card <Chevron dir="right" /></button>
                </div>
              </div>
            );
          })()}

          {view === 'practice' && practiceScreen === 'labs' && (
            <div className="labs-screen">
              <button className="back" onClick={() => setPracticeScreen('hub')}><Chevron dir="left" /> Practice</button>
              <header className="screen-head"><h1>Labs</h1><p className="lede">{labCards.filter((lab) => completed.has(lab.key)).length} of {labCards.length} done. Each lab uses the synthetic Kestrel data listed at the end.</p></header>
              <div className="list labs">
                {labCards.map((lab) => (
                  <details className="lab" key={lab.key} id={`lab-${lab.key}`}>
                    <summary className="row">
                      <span className="row-text">
                        <strong>{lab.title}</strong>
                        <span className="lab-certs">{lab.certification.split(' · ').map((cert) => <Tag key={cert}>{cert}</Tag>)}</span>
                      </span>
                      <Status kind={completed.has(lab.key) ? 'done' : 'none'}>{completed.has(lab.key) ? 'Done' : 'Not started'}</Status>
                      <FoldMark />
                    </summary>
                    <div className="lab-body">
                      <p>{keepTogether(lab.brief)}</p>
                      <ol className="steps">{lab.steps.map((step) => <li key={step}>{keepTogether(step)}</li>)}</ol>
                      <div className="row-actions">
                        <a className="secondary" href={lab.download} download><DownloadIcon /> Download file</a>
                        <button className="ghost" onClick={() => toggleProgress(lab.key)} disabled={saving}>{completed.has(lab.key) ? 'Mark as not done' : <><Check /> Mark done</>}</button>
                      </div>
                    </div>
                  </details>
                ))}
              </div>
              <DatasetLibrary />
            </div>
          )}

          {view === 'progress' && (
            <div className="progress">
              <header className="screen-head">
                <h1>Progress</h1>
                <p className="lede">{studyBlock ? (bookingReady ? `${studyBlock.cert}: all four checks are met. You are ready to book.` : `${studyBlock.cert}: ${checksMet} of 4 checks met. Book when all four are met.`) : 'No exam block is ready yet.'}</p>
              </header>
              <div className="segmented" role="tablist" aria-label="Progress sections">
                <button role="tab" aria-selected={progressTab === 'readiness'} className={progressTab === 'readiness' ? 'active' : ''} onClick={() => { setProgressTab('readiness'); window.history.replaceState(null, '', '#progress'); }}>Readiness</button>
                <button role="tab" aria-selected={progressTab === 'portfolio'} className={progressTab === 'portfolio' ? 'active' : ''} onClick={() => { setProgressTab('portfolio'); window.history.replaceState(null, '', '#portfolio'); }}>Portfolio</button>
              </div>

              {progressTab === 'readiness' && studyBlock && (
                <>
                  <section className="card book-checks" aria-labelledby="book-title">
                    <div className="card-head">
                      <div className="book-head">
                        <p className="eyebrow">{keepTogether(studyBlock.title)}</p>
                        <h2 id="book-title">Ready to book?</h2>
                      </div>
                      <p className="gate-score" aria-label={`${checksMet} of 4 checks met`}><strong>{checksMet}</strong><span>/4</span></p>
                    </div>
                    <ul className="checklist">
                      {bookingChecks.map((item) => (
                        <li key={item.key}>
                          <span className={item.met === true ? 'tick is-done' : item.met === 'not-enough-data' ? 'tick is-wait' : 'tick'} aria-hidden="true">{item.met === true && <Check />}</span>
                          <span><strong>{item.title}</strong><small>{item.met === true ? 'Met. ' : item.met === 'not-enough-data' ? '' : 'Not yet. '}{keepTogether(item.detail.replace(/\d{4}-\d{2}-\d{2}/g, (date) => formatDate(date)))}</small></span>
                        </li>
                      ))}
                    </ul>
                  </section>

                  {bookingReady && studyBlock.booking.length > 0 && (
                    <section className="card" aria-labelledby="booking-title">
                      <h2 id="booking-title">Before you book</h2>
                      <ol className="steps booking-list">{studyBlock.booking.map((line) => <li key={line}>{keepTogether(line)}</li>)}</ol>
                    </section>
                  )}

                  <h2 className="section-title">Practice exams</h2>
                  {history.length ? (
                    <ul className="list history" aria-label="Practice exam history">
                      {history.map((row) => {
                        const percent = Math.round(((row.right || 0) * 1000) / Math.max(1, row.total || 0)) / 10;
                        const body = (
                          <>
                            <span className="row-text"><strong>{formName(row.form)}</strong><small>{formatDate(row.date)}</small></span>
                            <span className="history-score"><strong>{percent}%</strong><small>{row.right} of {row.total}{percent >= studyBlock.exam.target ? ', at target' : ''}</small></span>
                          </>
                        );
                        return <li key={row.id}>{row.ids ? <button className="row" onClick={() => openResult(row.id)}>{body}<Chevron dir="right" /></button> : <div className="row">{body}</div>}</li>;
                      })}
                    </ul>
                  ) : (
                    <p className="hint empty-line">No practice exam yet. {examGate && !examGate.open ? examGate.reason : `${formName(examGate?.form || 'A')} is open on Practice.`}</p>
                  )}

                  <h2 className="section-title">Delayed reviews</h2>
                  <section className="card delayed" aria-label="Delayed-review score">
                    {delayed && delayed.total >= 20
                      ? <p className="delayed-score"><strong>{Math.round((delayed.right * 100) / delayed.total)}%</strong><span>{delayed.right} of {delayed.total} right</span></p>
                      : <p className="delayed-score is-wait"><strong>{delayed?.total || 0}</strong><span>of 20 answers needed</span></p>}
                    <p className="hint">Answers given 7 days or more after you first saw the question. This shows what you keep, not what you just read. The target is 80% over at least 20 answers.</p>
                  </section>

                  <h2 className="section-title">Other exams</h2>
                  <ul className="list other-exams">
                    {examBlocks.filter((item) => item.key !== studyBlock.key).map((item) => {
                      const started = [...item.mornings, ...item.weekends].some((entry) => completed.has(entry.key));
                      const label = item.status === 'building' ? 'Being built' : blockFinished(item, completed) ? 'Done' : started ? 'Started' : 'Not started';
                      return <li key={item.key}><div className="row"><span className="row-text"><strong>{keepTogether(item.title)}</strong></span><span className="pi-state">{label}</span></div></li>;
                    })}
                  </ul>

                  <details className="fold">
                    <summary className="row"><span className="row-text"><strong>Eligibility</strong><small>PMI and ISC2 decide</small></span><FoldMark /></summary>
                    <div className="fold-body">
                      <ul className="checklist">
                        <li><span className={pmpEligible ? 'tick is-done' : 'tick'} aria-hidden="true">{pmpEligible && <Check />}</span><span><strong>PMP</strong><small>{pmpEligible ? 'Baseline appears satisfied. Verify application evidence.' : `${profile.pm_months} of ${pmpNeeded} leadership months, ${profile.pm_training_hours} of 35 training hours`}</small></span></li>
                        <li><span className={cisspEligible ? 'tick is-done' : 'tick'} aria-hidden="true">{cisspEligible && <Check />}</span><span><strong>CISSP</strong><small>{cisspEligible ? 'Baseline appears satisfied. Verify domain evidence.' : `${profile.cyber_months} of ${cisspNeeded} months${cisspNeeded === 48 ? ' (degree waiver applied)' : ''}, ${profileDomains.length} of 2 domains. The Associate of ISC2 route remains open.`}</small></span></li>
                        <li><span className="tick is-done" aria-hidden="true"><Check /></span><span><strong>ITIL V5 and PL-300</strong><small>No experience requirement.</small></span></li>
                      </ul>
                    </div>
                  </details>
                </>
              )}

              {progressTab === 'portfolio' && (
                <>
                  <section className="card" aria-labelledby="package-title">
                    <div className="card-head">
                      <h2 id="package-title">Handover package</h2>
                      <p className="gate-score small"><strong>{portfolioChecklist.filter(([key]) => completed.has(key)).length}</strong><span>/{portfolioChecklist.length}</span></p>
                    </div>
                    <p className="hint">{portfolioChecklist.filter(([key]) => completed.has(key)).length} of {portfolioChecklist.length} ready. Tap an item when it is done.</p>
                    <ul className="checklist interactive">
                      {portfolioChecklist.map(([key, title, detail]) => (
                        <li key={key}><button aria-pressed={completed.has(key)} onClick={() => toggleProgress(key)} disabled={saving}><span className={completed.has(key) ? 'tick is-done' : 'tick'} aria-hidden="true">{completed.has(key) && <Check />}</span><span><strong>{title}</strong><small>{detail}</small></span></button></li>
                      ))}
                    </ul>
                  </section>
                  <section className="card" aria-labelledby="demo-title">
                    <h2 id="demo-title">Demo script, 3 to 5 minutes</h2>
                    <ol className="steps"><li>State the disconnected-reporting problem.</li><li>Show the governed data model and quality evidence.</li><li>Explain one IAM and one resilience decision.</li><li>Demonstrate role-aware reporting and tests.</li><li>Close with value, trade-offs, and next action.</li></ol>
                    <button className="secondary" onClick={() => downloadFile('tricert-demo-script.md', demoScript, 'text/markdown')}><DownloadIcon /> Download script</button>
                  </section>
                  <section className="card" aria-labelledby="disclosure-title">
                    <h2 id="disclosure-title">Required disclosure</h2>
                    <blockquote>{disclosure}</blockquote>
                    <button className="secondary" onClick={() => navigator.clipboard.writeText(disclosure).then(() => say('Disclosure copied.'), () => setNotice({ text: 'Copy is blocked here. Select the text and copy it instead.', kind: 'error' }))}>Copy disclosure</button>
                  </section>
                  <section className="card logo-block" aria-labelledby="logo-title">
                    <h2 id="logo-title">Logo</h2>
                    <div className="logo-preview"><img src="/tricert-lab-logo.png" alt="TriCert Lab logo" /></div>
                    <a className="secondary" href="/tricert-lab-logo.png" download="tricert-lab-logo.png"><DownloadIcon /> Download PNG</a>
                  </section>
                </>
              )}
            </div>
          )}
        </main>
      </div>

      {notice && <div className={notice.kind === 'error' ? 'toast is-error' : 'toast'} role={notice.kind === 'error' ? 'alert' : 'status'}><span className="toast-icon" aria-hidden="true">{notice.kind === 'error' ? '!' : <Check />}</span><span>{notice.text}</span><button onClick={() => setNotice(null)} aria-label="Dismiss message">×</button></div>}

      {morningOpen && morning && !examShown && (
        <MorningFocus
          run={morning}
          restored={morningRestored}
          saving={saving}
          lesson={reading ? reading.lessons[examBlocks.find((item) => item.key === morning.block)?.mornings.find((entry) => entry.key === morning.morning)?.lesson || ''] || null : undefined}
          usercards={records.usercards}
          onChange={changeMorning}
          onLeave={leaveMorning}
          onGrade={gradeMorningCard}
          onAnswer={answerMorningQuestion}
          onMistakesDone={mistakesDone}
          onFinish={finishMorning}
        />
      )}

      {examShown && (
        <ExamFocus
          run={examShown}
          left={examLeft}
          restored={examRestored}
          onChange={changeExam}
          onLeave={leaveExam}
          onFinish={() => finishExam(examShown)}
        />
      )}

      {weekendItem && (
        <WeekendFocus
          item={weekendItem}
          block={examBlocks.find((candidate) => candidate.weekends.includes(weekendItem))}
          ticks={labTicks[weekendItem.key] || readLab(weekendItem.key)}
          saving={saving}
          onTick={(index) => tickLab(weekendItem.key, index)}
          onLeave={() => setWeekendOpen(null)}
          onFinish={() => finishWeekend(weekendItem)}
        />
      )}

      {finished && <FinishedScreen finished={finished} onDone={() => setFinished(null)} />}

      {settingsOpen && (
        <MakeItYours
          name={profile.display_name || ''}
          why={profile.motivation || ''}
          theme={theme}
          accent={accent}
          saving={saving}
          onTheme={setTheme}
          onAccent={setAccent}
          onSave={savePersonal}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </>
  );
}


/* ==========================================================================
   Overlays: focus moves in when one opens and goes back when it closes.
   ========================================================================== */

function useOverlayFocus(target: RefObject<HTMLElement | null>, fallbacks: string[], key?: unknown) {
  const opener = useRef<HTMLElement | null>(null);
  const places = useRef(fallbacks);
  useEffect(() => {
    const active = document.activeElement;
    if (!opener.current && active instanceof HTMLElement && active !== document.body) opener.current = active;
    const fallbackList = places.current;
    return () => {
      const back = opener.current;
      // Wait for the page behind to stop being inert, then return focus
      // unless something else already has it.
      window.setTimeout(() => {
        const lost = !document.activeElement || document.activeElement === document.body;
        if (!lost) return;
        if (back && back.isConnected && back.getClientRects().length) { back.focus(); return; }
        for (const selector of fallbackList) {
          const element = document.querySelector<HTMLElement>(selector);
          if (element && element.getClientRects().length) { element.focus({ preventScroll: true }); return; }
        }
      }, 0);
    };
  }, []);
  useEffect(() => {
    target.current?.focus({ preventScroll: true });
  }, [target, key]);
}

/* The completion screen: what the morning or weekend block added up to. */
function FinishedScreen({ finished, onDone }: { finished: Finished; onDone: () => void }) {
  const done = useRef<HTMLButtonElement>(null);
  useOverlayFocus(done, ['.hero-session .play', '#main']);
  const stats: Array<[string, number]> = finished.questions === undefined
    ? [['Minutes', finished.minutes]]
    : [['Cards', finished.cards ?? 0], ['Questions', finished.questions], ['Right', finished.right ?? 0], ['Minutes', finished.minutes]];
  return (
    <div className="celebrate" role="dialog" aria-modal="true" aria-labelledby="celebrate-title">
      <div className="celebrate-inner">
        <span className="celebrate-badge" aria-hidden="true"><Check /></span>
        <h2 id="celebrate-title">{finished.title}</h2>
        <p>{keepTogether(finished.detail)}</p>
        <dl className={`celebrate-stats count-${stats.length}`}>
          {stats.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
        </dl>
        <button ref={done} className="primary wide" onClick={onDone}>Done</button>
      </div>
    </div>
  );
}

/* ==========================================================================
   A morning, in focus mode: a step line, then one part at a time, each
   with one main button at the bottom.
   ========================================================================== */

type MorningChange = (change: (current: MorningRun) => MorningRun, keep?: boolean) => void;

function MorningFocus({ run, restored, saving, lesson, usercards, onChange, onLeave, onGrade, onAnswer, onMistakesDone, onFinish }: {
  run: MorningRun; restored: boolean; saving: boolean; lesson: Lesson | null | undefined; usercards: UserCard[];
  onChange: MorningChange; onLeave: () => void; onGrade: (grade: CardGrade) => void;
  onAnswer: (question: ScenarioQuestion, choice: string, sure: boolean, seconds: number) => Promise<boolean>;
  onMistakesDone: () => void; onFinish: () => void;
}) {
  const parts = morningParts[run.mode];
  const index = Math.min(run.part, parts.length - 1);
  const part = parts[index][0];
  const owner = examBlocks.find((item) => item.key === run.block);
  const item = owner?.mornings.find((entry) => entry.key === run.morning);
  const dialog = useRef<HTMLDivElement>(null);
  const step = `${index}-${run.learn.stage}-${run.questions.index}`;
  useOverlayFocus(dialog, ['.hero-session .play', '#main'], step);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onLeave(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onLeave]);
  const nextPart = () => onChange((current) => ({ ...current, part: current.part + 1 }));
  const nextLabel = parts[index + 1] ? `Continue to ${parts[index + 1][1].toLowerCase()}` : run.mode === 'due' ? 'Finish review' : 'Finish morning';
  const where = owner && item ? `${owner.cert}, morning ${owner.mornings.indexOf(item) + 1}` : run.mode === 'due' ? 'Today’s review' : `${run.exam}, short morning`;
  const shared = { run, restored: restored && index === run.part, saving, step };
  return (
    <div ref={dialog} tabIndex={-1} className="focus morning" role="dialog" aria-modal="true" aria-labelledby="morning-title">
      <header className="focus-bar">
        <span className="focus-where"><span className="live-dot" aria-hidden="true" />{where}</span>
        <button className="ghost" onClick={onLeave}>Leave</button>
      </header>
      <ol className="step-line" aria-label="Parts of this morning">
        {parts.map(([key, name, minutes], position) => (
          <li key={key} className={position < index ? 'is-done' : position === index ? 'is-now' : undefined} aria-current={position === index ? 'step' : undefined}>
            <span className="step-mark" aria-hidden="true">{position < index && <Check />}</span>
            <span className="step-name">{name}</span>
            <span className="step-min">{minutes ? `${minutes} min` : position < index ? 'Done' : position === index ? 'Now' : 'Next'}<span className="sr-only">{minutes && position < index ? ', done' : ''}</span></span>
          </li>
        ))}
      </ol>
      {part === 'cards' && <CardsPane {...shared} usercards={usercards} nextLabel={nextLabel} onChange={onChange} onGrade={onGrade} onNext={nextPart} />}
      {part === 'learn' && <LearnPane {...shared} item={item} lesson={lesson} nextLabel={nextLabel} onChange={onChange} onNext={nextPart} />}
      {part === 'questions' && <QuestionsPane {...shared} pace={owner?.exam.secondsPerQuestion || 90} nextLabel={nextLabel} onChange={onChange} onAnswer={onAnswer} onNext={nextPart} />}
      {part === 'mistakes' && <MistakesPane {...shared} finalLabel={run.mode === 'review' ? nextLabel : run.mode === 'due' ? 'Finish review' : 'Finish morning'} onChange={onChange} onDone={run.mode === 'review' ? onMistakesDone : onFinish} />}
      {part === 'reflect' && <ReflectPane {...shared} onChange={onChange} onFinish={onFinish} />}
    </div>
  );
}

/* One part's body (it scrolls) and its actions (they stay in reach). */
function Pane({ step, restored, children, foot }: { step: string; restored?: boolean; children: ReactNode; foot: ReactNode }) {
  const body = useRef<HTMLDivElement>(null);
  useEffect(() => { body.current?.scrollTo({ top: 0 }); }, [step]);
  return (
    <>
      <div className="morning-body" ref={body}>
        <div className="morning-col">
          {restored && <p className="hint restored" role="status">Back where you left off.</p>}
          {children}
        </div>
      </div>
      <footer className="morning-foot"><div className="morning-actions">{foot}</div></footer>
    </>
  );
}

type PaneProps = { run: MorningRun; restored: boolean; saving: boolean; step: string };

function CardsPane({ run, restored, saving, step, usercards, nextLabel, onChange, onGrade, onNext }: PaneProps & {
  usercards: UserCard[]; nextLabel: string; onChange: MorningChange; onGrade: (grade: CardGrade) => void; onNext: () => void;
}) {
  const cards = useMemo(() => new Map<string, BankCard>(allCards(usercards).map((card) => [card.id, card])), [usercards]);
  const head = run.cards.queue[0];
  const card = head ? cards.get(head.id) : undefined;
  const left = run.cards.queue.length;
  const skip = () => onChange((current) => ({ ...current, cards: { ...current.cards, queue: current.cards.queue.slice(1), shown: false } }));
  const foot = !head
    ? <button className="primary wide" onClick={onNext}>{nextLabel}</button>
    : !card
      ? <button className="primary wide" onClick={skip}>Skip this card</button>
      : !run.cards.shown
        ? <button className="primary wide" onClick={() => onChange((current) => ({ ...current, cards: { ...current.cards, shown: true } }))}>Show answer</button>
        : <><button className="secondary grade" onClick={() => onGrade('again')} disabled={saving}>Again</button><button className="primary grade" onClick={() => onGrade('good')} disabled={saving}>Good</button></>;
  return (
    <Pane step={`${step}-${head?.id || 'end'}-${left}`} restored={restored} foot={foot}>
      <p className="eyebrow">Cards</p>
      <h2 id="morning-title" className="m-title">{head ? 'Say the answer, then check it' : run.cards.reviewed ? 'Cards done' : 'No cards due'}</h2>
      <p className="hint" aria-live="polite">{head ? `${left} ${left === 1 ? 'card' : 'cards'} left${head.repeat ? '. This one comes back once after Again.' : ''}` : run.cards.reviewed ? `${run.cards.reviewed} reviewed, ${run.cards.again} to see again tomorrow.` : 'Nothing is due this morning and there are no new cards for it.'}</p>
      {head && card && (
        <div className={run.cards.shown ? 'm-card is-shown' : 'm-card'}>
          <p className="m-card-meta"><Tag>{examLabel(card.exam)}</Tag>{card.source === 'mine' && <span>Your card</span>}</p>
          <p className="m-card-front">{keepTogether(card.front)}</p>
          {run.cards.shown && <p className="m-card-back">{keepTogether(card.back)}</p>}
        </div>
      )}
      {head && !card && <p className="hint">This card is no longer in the deck.</p>}
    </Pane>
  );
}

function LearnPane({ run, restored, step, item, lesson, nextLabel, onChange, onNext }: PaneProps & {
  item: Morning | undefined; lesson: Lesson | null | undefined; nextLabel: string; onChange: MorningChange; onNext: () => void;
}) {
  const stage = run.learn.stage;
  const to = (next: LearnStage) => onChange((current) => ({ ...current, learn: { ...current.learn, stage: next } }));
  const brief = item?.brief;
  const missing = lesson === null ? <p className="hint">This lesson is not in the library yet.</p> : !lesson ? <p className="hint loading-note">Opening the lesson</p> : null;
  if (stage === 'brief') {
    return (
      <Pane step={step} restored={restored} foot={<button className="primary wide" onClick={() => to('lesson')}>Read the lesson</button>}>
        <p className="eyebrow">Learn, the brief</p>
        <h2 id="morning-title" className="m-title">{item?.title || 'Today’s lesson'}</h2>
        {brief && (
          <figure className="brief-note">
            <blockquote><p>{keepTogether(brief.text)}</p></blockquote>
            <figcaption><strong>{brief.from}</strong>, {brief.role}</figcaption>
            <p className="brief-ask"><span>Your task</span>{keepTogether(brief.ask)}</p>
          </figure>
        )}
      </Pane>
    );
  }
  if (stage === 'lesson') {
    return (
      <Pane step={step} restored={restored} foot={<button className="primary wide" onClick={() => to('build')} disabled={!lesson}>Do the step yourself</button>}>
        <p className="eyebrow">Learn, the lesson</p>
        <h2 id="morning-title" className="m-title">{item?.title || 'Today’s lesson'}</h2>
        {missing || (lesson && <LessonBody lesson={lesson} idPrefix="ml" parts="read" />)}
      </Pane>
    );
  }
  if (stage === 'build') {
    return (
      <Pane step={step} restored={restored} foot={<button className="primary wide" onClick={() => to('recall')}>Go to recall</button>}>
        <p className="eyebrow">Learn, your turn</p>
        <h2 id="morning-title" className="m-title">{lesson ? keepTogether(lesson.build.goal) : 'Your turn'}</h2>
        {missing || (lesson && (
          <>
            <ol className="steps">{lesson.build.steps.map((line) => <li key={line}>{keepTogether(line)}</li>)}</ol>
            <label className="field" htmlFor="build-answer">Your answer</label>
            <textarea id="build-answer" className="writing-short" value={run.learn.build} maxLength={6000} onChange={(event) => { const text = event.target.value; onChange((current) => ({ ...current, learn: { ...current.learn, build: text } }), false); }} placeholder="Write it before you look at the model answer" />
            {lesson.build.modelAnswer && (run.learn.model
              ? <section className="model-answer" aria-label="Model answer"><h3>Model answer</h3><RichText text={lesson.build.modelAnswer} /></section>
              : <button className="secondary reveal" onClick={() => onChange((current) => ({ ...current, learn: { ...current.learn, model: true } }))}>Reveal the model answer</button>)}
          </>
        ))}
      </Pane>
    );
  }
  const prompts = lesson ? lesson.check.slice(0, 3) : [];
  return (
    <Pane step={step} restored={restored} foot={<button className="primary wide" onClick={onNext}>{nextLabel}</button>}>
      <p className="eyebrow">Learn, recall</p>
      <h2 id="morning-title" className="m-title">Answer from memory, then reveal</h2>
      {missing || (
        <ol className="recall">
          {prompts.map((prompt, position) => (
            <li key={prompt.q}>
              <p className="recall-q">{keepTogether(prompt.q)}</p>
              {run.learn.recall[position]
                ? <div className="recall-a"><RichText text={prompt.a} /></div>
                : <button className="secondary reveal" onClick={() => onChange((current) => { const shown = [...current.learn.recall]; shown[position] = true; return { ...current, learn: { ...current.learn, recall: shown } }; })} aria-label={`Reveal answer ${position + 1}`}>Reveal</button>}
            </li>
          ))}
        </ol>
      )}
    </Pane>
  );
}

function QuestionsPane({ run, restored, saving, step, pace, nextLabel, onChange, onAnswer, onNext }: PaneProps & {
  pace: number; nextLabel: string; onChange: MorningChange; onAnswer: (question: ScenarioQuestion, choice: string, sure: boolean, seconds: number) => Promise<boolean>; onNext: () => void;
}) {
  const questions = run.questions.ids.map((id) => questionById(id)).filter((question): question is ScenarioQuestion => Boolean(question));
  const position = Math.min(run.questions.index, Math.max(0, questions.length - 1));
  const question = questions[position];
  if (!question) {
    return (
      <Pane step={step} restored={restored} foot={<button className="primary wide" onClick={onNext}>{nextLabel}</button>}>
        <p className="eyebrow">Questions</p>
        <h2 id="morning-title" className="m-title">No questions due</h2>
        <p className="lede">Nothing is due for review and there are no new questions for this morning.</p>
      </Pane>
    );
  }
  const last = position >= questions.length - 1;
  return (
    <QuestionStep
      key={question.id}
      question={question}
      number={position + 1}
      total={questions.length}
      pace={pace}
      saved={run.questions.answers[question.id]}
      saving={saving}
      restored={restored}
      nextLabel={last ? nextLabel : 'Next question'}
      onAnswer={onAnswer}
      onNext={() => (last ? onNext() : onChange((current) => ({ ...current, questions: { ...current.questions, index: position + 1 } })))}
    />
  );
}

/* One question at the exam's pace. The clock only informs. */
function QuestionStep({ question, number, total, pace, saved, saving, restored, nextLabel, onAnswer, onNext }: {
  question: ScenarioQuestion; number: number; total: number; pace: number; saved?: MorningAnswer; saving: boolean; restored: boolean; nextLabel: string;
  onAnswer: (question: ScenarioQuestion, choice: string, sure: boolean, seconds: number) => Promise<boolean>; onNext: () => void;
}) {
  const [choice, setChoice] = useState(saved?.choice ?? '');
  const [sure, setSure] = useState<'' | 'sure' | 'guess'>(saved ? (saved.sure ? 'sure' : 'guess') : '');
  const [started] = useState(nowMs);
  const [seconds, setSeconds] = useState(saved?.seconds ?? 0);
  useEffect(() => {
    if (saved) return;
    const handle = window.setInterval(() => setSeconds(Math.floor((nowMs() - started) / 1000)), 1000);
    return () => window.clearInterval(handle);
  }, [saved, started]);
  const answered = Boolean(saved);
  useEffect(() => {
    if (!answered) return;
    const handle = window.setTimeout(() => document.getElementById(`sheet-${question.id}`)?.scrollIntoView({ behavior: scrollBehavior(), block: 'nearest' }), 40);
    return () => window.clearTimeout(handle);
  }, [answered, question.id]);
  const shown = saved ? saved.seconds : seconds;
  const over = !saved && seconds > pace;
  async function check() {
    if (!choice || !sure || saved || saving) return;
    await onAnswer(question, choice, sure === 'sure', seconds);
  }
  const foot = saved
    ? <button className="primary wide" onClick={onNext} autoFocus>{nextLabel}</button>
    : <button className="primary wide" onClick={check} disabled={!choice || !sure || saving}>Check</button>;
  return (
    <Pane step={question.id} restored={restored} foot={foot}>
      <div className="q-head">
        <p className="quiz-meta"><span>Question {number} of {total}</span><span>{areaOf(question.domain)}</span></p>
        <p className={over ? 'q-clock is-over' : 'q-clock'}><Digits value={formatClock(shown)} /><span className="q-pace">of {formatClock(pace)}{over ? ', past the exam pace' : ''}</span></p>
      </div>
      <h2 id="morning-title" className="quiz-q">{keepTogether(question.prompt)}</h2>
      <div className="answers" role="radiogroup" aria-label="Answers">
        {question.options.map(([key, text]) => {
          const look = saved ? (key === question.correct ? 'is-right' : key === saved.choice ? 'is-wrong' : 'is-muted') : choice === key ? 'is-picked' : '';
          return (
            <label key={key} className={`answer ${look}`}>
              <input type="radio" name={`q-${question.id}`} value={key} checked={choice === key} disabled={Boolean(saved)} onChange={() => setChoice(key)} />
              <span className="answer-key" aria-hidden="true">{key}</span>
              <span>{keepTogether(text)}</span>
            </label>
          );
        })}
      </div>
      {!saved && (
        <fieldset className="sure">
          <legend>Sure or guess?</legend>
          <div className="sure-options">
            {([['sure', 'Sure'], ['guess', 'Guess']] as const).map(([key, label]) => (
              <label key={key} className={sure === key ? 'active' : ''}><input type="radio" name={`s-${question.id}`} value={key} checked={sure === key} onChange={() => setSure(key)} />{label}</label>
            ))}
          </div>
        </fieldset>
      )}
      {saved && (
        <section id={`sheet-${question.id}`} className={saved.correct ? 'sheet is-right' : 'sheet is-wrong'} role="status">
          <strong className="sheet-title"><span className="sheet-icon" aria-hidden="true">{saved.correct ? <Check /> : '×'}</span>{saved.correct ? (saved.sure ? 'Right' : 'Right, but a guess. It comes back in two days.') : `The answer is ${question.correct}`}</strong>
          <p>{keepTogether(question.explanation)}</p>
          <h3 className="sheet-sub">Why the other answers are wrong</h3>
          <ul className="why-wrong">
            {question.options.filter(([key]) => key !== question.correct).map(([key]) => (
              <li key={key}><span className="why-key" aria-hidden="true">{key}</span><span><span className="sr-only">{key}: </span>{keepTogether(question.incorrect[key] || 'It does not answer what the question asks.')}</span></li>
            ))}
          </ul>
        </section>
      )}
    </Pane>
  );
}

function MistakesPane({ run, restored, saving, step, finalLabel, onChange, onDone }: PaneProps & { finalLabel: string; onChange: MorningChange; onDone: () => void }) {
  const missed = run.questions.ids.filter((id) => run.questions.answers[id] && run.questions.answers[id].result !== 'right');
  return (
    <Pane step={step} restored={restored} foot={<button className="primary wide" onClick={onDone} disabled={saving}>{finalLabel}</button>}>
      <p className="eyebrow">Mistakes</p>
      <h2 id="morning-title" className="m-title">{missed.length ? `${missed.length} to write up` : 'Nothing to write up'}</h2>
      <p className="lede">{missed.length ? 'For each wrong or guessed question, write the rule you missed in one line. Each line becomes one of your flashcards, due tomorrow.' : 'Every answer this morning was right and sure.'}</p>
      {missed.length > 0 && (
        <ol className="mistakes">
          {missed.map((id) => {
            const question = questionById(id);
            const given = run.questions.answers[id];
            if (!question) return null;
            const saved = run.savedCards.includes(id);
            return (
              <li key={id}>
                <p className="mistake-q">{keepTogether(question.prompt)}</p>
                <p className="hint">{given.correct ? `Guessed. ${given.choice} was right.` : `You chose ${given.choice}. The answer is ${question.correct}.`}</p>
                <label className="field" htmlFor={`rule-${id}`}>The rule you missed</label>
                <input id={`rule-${id}`} value={run.mistakes[id] || ''} maxLength={300} disabled={saved} placeholder="One line, in your own words" onChange={(event) => { const text = event.target.value; onChange((current) => ({ ...current, mistakes: { ...current.mistakes, [id]: text } }), false); }} />
                {saved && <p className="hint">Saved as a card.</p>}
              </li>
            );
          })}
        </ol>
      )}
    </Pane>
  );
}

function ReflectPane({ run, restored, saving, step, onChange, onFinish }: PaneProps & { onChange: MorningChange; onFinish: () => void }) {
  const short = Math.max(0, 100 - run.reflection.trim().length);
  return (
    <Pane step={step} restored={restored} foot={<button className="primary wide" onClick={onFinish} disabled={saving || short > 0}>Finish morning</button>}>
      <p className="eyebrow">Reflection</p>
      <h2 id="morning-title" className="m-title">Your week</h2>
      <div className="reflect-body">
        <label className="field" htmlFor="reflection">What can you now explain without notes, what still needs notes, and what will you change next week?</label>
        <textarea id="reflection" value={run.reflection} maxLength={6000} onChange={(event) => { const text = event.target.value; onChange((current) => ({ ...current, reflection: text }), false); }} />
        <p className="hint" aria-live="polite">{short ? `${short} more characters` : 'Ready to save'}</p>
      </div>
    </Pane>
  );
}

/* A weekend lab: the steps in a real tool, a tick for each, then Finish block. */
function WeekendFocus({ item, block, ticks, saving, onTick, onLeave, onFinish }: {
  item: WeekendBlock; block?: ExamBlock; ticks: number[]; saving: boolean; onTick: (index: number) => void; onLeave: () => void; onFinish: () => void;
}) {
  const dialog = useRef<HTMLDivElement>(null);
  useOverlayFocus(dialog, ['.hero-session .play', '#main']);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onLeave(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onLeave]);
  const done = new Set(ticks);
  return (
    <div ref={dialog} tabIndex={-1} className="focus morning" role="dialog" aria-modal="true" aria-labelledby="weekend-title">
      <header className="focus-bar">
        <span className="focus-where"><span className="live-dot" aria-hidden="true" />{block ? `${block.cert}, weekend block ${block.weekends.indexOf(item) + 1}` : 'Weekend block'}</span>
        <button className="ghost" onClick={onLeave}>Leave</button>
      </header>
      <Pane step={item.key} foot={<button className="primary wide" onClick={onFinish} disabled={saving}>Finish block</button>}>
        <p className="eyebrow">Lab, {formatMinutes(item.minutes)}</p>
        <h2 id="weekend-title" className="m-title">{keepTogether(item.title)}</h2>
        <p className="hint" aria-live="polite">{done.size} of {item.steps.length} steps ticked. Ticks stay in this browser until you finish.</p>
        <ol className="rubric lab-steps">
          {item.steps.map((line, index) => (
            <li key={line}>
              <label>
                <input type="checkbox" checked={done.has(index)} onChange={() => onTick(index)} />
                <span className="box" aria-hidden="true"><Check /></span>
                <span><span className="lab-no">{index + 1}.</span> {keepTogether(line)}</span>
              </label>
            </li>
          ))}
        </ol>
      </Pane>
    </div>
  );
}

/* ==========================================================================
   Practice exam: a start screen, the exam itself in focus mode, and the
   result. No feedback until the end; unanswered questions are wrong.
   ========================================================================== */

type ExamView = { id: string; exam: Certification; form: string; date: string; ids: string[]; answers: ExamAnswers; target: number; saved: boolean };
type ExamGate = { open: boolean; form: string; reason: string };

function ExamStart({ block, gate, running, left, lastResult, onBack, onStart, onResult }: {
  block?: ExamBlock; gate: ExamGate | null; running: ExamRun | null; left: number; lastResult?: MockRow;
  onBack: () => void; onStart: () => void; onResult: (id: string) => void;
}) {
  const settings = block?.exam;
  return (
    <div className="exam-start">
      <button className="back" onClick={onBack}><Chevron dir="left" /> Practice</button>
      <header className="screen-head">
        <p className="eyebrow">{block ? keepTogether(block.title) : 'Practice exam'}</p>
        <h1>{running ? formName(running.form) : gate ? formName(gate.form) : 'Practice exam'}</h1>
        <p className="lede">Take it like the real exam. Your results feed Ready to book on Progress.</p>
      </header>
      {block && settings && (
        <section className={running || gate?.open ? 'hero-session exam-open' : 'hero-session exam-open is-done'} aria-labelledby="exam-start-title">
          <h2 id="exam-start-title">{settings.questions} questions, {settings.minutes} minutes</h2>
          <ul className="exam-rules">
            <li>No feedback until the end. Then you see your score, your score by area and every question with its explanation.</li>
            <li>Unanswered questions count as wrong. At 00:00 the exam finishes by itself.</li>
            <li>{settings.allowBack ? 'You can flag a question, go back, and jump to any question from the list.' : 'As in the real exam, you cannot go back to an earlier question.'}</li>
            <li>The clock keeps running if you leave or reload. Aim for {settings.target}% or more.</li>
          </ul>
          {running
            ? <div className="hero-actions"><button className="primary play" onClick={onStart}><span className="play-label">Resume practice exam, {formatCountdown(left)} left</span></button></div>
            : gate?.open
              ? <div className="hero-actions"><button className="primary play" onClick={onStart}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z" fill="currentColor" /></svg><span className="play-label">Start practice exam</span></button></div>
              : <p className="exam-locked" role="status"><strong>Not open yet.</strong> {gate?.reason}</p>}
        </section>
      )}
      {lastResult && lastResult.ids && (
        <ul className="list exam-last">
          <li><button className="row" onClick={() => onResult(lastResult.id)}><span className="row-text"><strong>Your last result: {formName(lastResult.form)}</strong><small>{formatDate(lastResult.date)}, {lastResult.right} of {lastResult.total}</small></span><Chevron dir="right" /></button></li>
        </ul>
      )}
    </div>
  );
}

function ExamFocus({ run, left, restored, onChange, onLeave, onFinish }: {
  run: ExamRun; left: number; restored: boolean; onChange: (change: (current: ExamRun) => ExamRun) => void; onLeave: () => void; onFinish: () => void;
}) {
  const [listOpen, setListOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const dialog = useRef<HTMLDivElement>(null);
  const questions = useMemo(() => run.ids.map((id) => questionById(id)), [run.ids]);
  const total = run.ids.length;
  const index = Math.min(run.index, total - 1);
  const question = questions[index];
  const id = run.ids[index];
  const answered = run.ids.filter((key) => run.answers[key]).length;
  const unanswered = total - answered;
  const flagged = run.flags.includes(id);
  const step = `${index}-${listOpen}-${confirming}`;
  useOverlayFocus(dialog, ['.exam-start .play', '#main'], step);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (confirming) setConfirming(false); else if (listOpen) setListOpen(false); else onLeave();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onLeave, confirming, listOpen]);
  const goTo = (position: number) => { onChange((current) => ({ ...current, index: position })); setListOpen(false); setConfirming(false); };
  const choose = (letter: string) => onChange((current) => ({ ...current, answers: { ...current.answers, [id]: letter } }));
  const toggleFlag = () => onChange((current) => ({ ...current, flags: current.flags.includes(id) ? current.flags.filter((key) => key !== id) : [...current.flags, id] }));
  const last = index >= total - 1;
  const low = left <= 300;
  let body: ReactNode;
  let foot: ReactNode;
  if (confirming) {
    body = (
      <>
        <p className="eyebrow">Finish</p>
        <h2 id="exam-title" className="m-title">Finish the exam?</h2>
        <p className="lede">{unanswered ? `${unanswered} of ${total} ${unanswered === 1 ? 'question is' : 'questions are'} unanswered. ${unanswered === 1 ? 'It counts' : 'They count'} as wrong.` : `All ${total} questions have an answer.`}{run.flags.length ? ` ${run.flags.length} ${run.flags.length === 1 ? 'is' : 'are'} flagged.` : ''} You have {formatCountdown(left)} left.</p>
      </>
    );
    foot = <><button className="secondary" onClick={() => setConfirming(false)}>Keep going</button><button className="primary" onClick={onFinish}>Finish exam</button></>;
  } else if (listOpen) {
    body = (
      <>
        <p className="eyebrow">All questions</p>
        <h2 id="exam-title" className="m-title">{answered} of {total} answered</h2>
        <p className="hint">Pick a number to go to that question. A ring marks a flag.</p>
        <ol className="exam-list">
          {run.ids.map((key, position) => {
            const states = [run.answers[key] ? 'answered' : 'unanswered', run.flags.includes(key) ? 'flagged' : ''].filter(Boolean).join(', ');
            return (
              <li key={key}>
                <button className={`exam-cell${run.answers[key] ? ' is-answered' : ''}${run.flags.includes(key) ? ' is-flagged' : ''}${position === index ? ' is-current' : ''}`} aria-current={position === index ? 'true' : undefined} aria-label={`Question ${position + 1}, ${states}`} onClick={() => goTo(position)}>{position + 1}</button>
              </li>
            );
          })}
        </ol>
      </>
    );
    foot = <button className="primary wide" onClick={() => setListOpen(false)}>Back to question {index + 1}</button>;
  } else {
    body = question ? (
      <>
        {restored && <p className="hint restored" role="status">Back in your practice exam. The clock kept running.</p>}
        <div className="q-head">
          <p className="quiz-meta"><span>Question {index + 1} of {total}</span><span>{areaOf(question.domain)}</span></p>
          <button className={flagged ? 'flag-toggle is-on' : 'flag-toggle'} aria-pressed={flagged} onClick={toggleFlag}>{flagged ? 'Flagged' : 'Flag'}</button>
        </div>
        <h2 id="exam-title" className="quiz-q">{keepTogether(question.prompt)}</h2>
        <div className="answers" role="radiogroup" aria-labelledby="exam-title">
          {question.options.map(([key, text]) => (
            <label key={key} className={`answer ${run.answers[id] === key ? 'is-picked' : ''}`}>
              <input type="radio" name={`exam-${id}`} value={key} checked={run.answers[id] === key} onChange={() => choose(key)} />
              <span className="answer-key" aria-hidden="true">{key}</span>
              <span>{keepTogether(text)}</span>
            </label>
          ))}
        </div>
      </>
    ) : <h2 id="exam-title" className="m-title">This question is no longer in the bank. It counts as wrong.</h2>;
    foot = (
      <>
        {run.allowBack && index > 0 && <button className="secondary" onClick={() => goTo(index - 1)}><Chevron dir="left" /> Previous</button>}
        {last ? <button className="primary" onClick={() => setConfirming(true)}>Finish exam</button> : <button className="primary" onClick={() => goTo(index + 1)}>Next <Chevron dir="right" /></button>}
      </>
    );
  }
  return (
    <div ref={dialog} tabIndex={-1} className="focus morning exam" role="dialog" aria-modal="true" aria-labelledby="exam-title">
      <header className="focus-bar">
        <span className="focus-where"><span className="live-dot" aria-hidden="true" />{run.exam === 'ITIL' ? 'ITIL' : run.exam}, {formName(run.form).toLowerCase()}</span>
        <span className={low ? 'exam-clock is-low' : 'exam-clock'} role="timer" aria-label={`${formatCountdown(left)} left`}><Digits value={formatCountdown(left)} /></span>
        <button className="ghost" onClick={onLeave}>Leave</button>
      </header>
      <div className="exam-bar">
        <span className="exam-count">{answered}/{total} answered{run.flags.length ? `, ${run.flags.length} flagged` : ''}</span>
        <span className="exam-tools">
          {run.allowBack && <button className="ghost" aria-expanded={listOpen} onClick={() => { setConfirming(false); setListOpen(!listOpen); }}>{listOpen ? 'Hide list' : 'Questions'}</button>}
          {!confirming && <button className="ghost" onClick={() => { setListOpen(false); setConfirming(true); }}>Finish exam</button>}
        </span>
      </div>
      <Pane step={step} foot={foot}>{body}</Pane>
    </div>
  );
}

function ExamResultView({ result, saving, onSave, onBack }: { result: ExamView; saving: boolean; onSave: () => void; onBack: () => void }) {
  const questions = result.ids.map((id) => questionById(id));
  const known = questions.filter((question): question is ScenarioQuestion => Boolean(question));
  const score = scoreExam(known, result.answers);
  const total = result.ids.length;
  const right = score.right;
  const percent = Math.round((right * 1000) / Math.max(1, total)) / 10;
  const met = (right * 100) / Math.max(1, total) >= result.target;
  const unanswered = result.ids.filter((id) => !result.answers[id]).length;
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus({ preventScroll: true }); }, [result.id]);
  return (
    <div className="exam-result">
      <button className="back" onClick={onBack}><Chevron dir="left" /> Practice</button>
      <header className="screen-head">
        <p className="eyebrow"><span>{result.exam === 'ITIL' ? 'ITIL' : result.exam}</span><span>{formName(result.form)}</span><span>{formatDate(result.date)}</span></p>
        <h1 ref={heading} tabIndex={-1}>{right} of {total}, {percent}%</h1>
        <p className="lede">{met ? `At or above your target of ${result.target}%.` : `Your target is ${result.target}%. That is ${Math.ceil((result.target * total) / 100) - right} more right ${Math.ceil((result.target * total) / 100) - right === 1 ? 'answer' : 'answers'}.`}{unanswered ? ` ${unanswered} unanswered ${unanswered === 1 ? 'question counts' : 'questions count'} as wrong.` : ''}</p>
      </header>
      {!result.saved && (
        <section className="card exam-unsaved" role="status">
          <p>{saving ? 'Saving your result.' : 'This result is not saved yet. Your answers are kept in this browser.'}</p>
          {!saving && <button className="primary" onClick={onSave}>Save the result</button>}
        </section>
      )}
      <h2 className="section-title">By area</h2>
      <ul className="list result-areas">
        {score.areas.map((area) => (
          <li key={area.area}>
            <div className="area-row">
              <span className="area-name">{area.area}</span>
              <span className="area-score"><strong>{area.right} of {area.total}</strong><small>{area.percent}%</small></span>
              <Meter value={area.total ? area.right / area.total : 0} />
            </div>
          </li>
        ))}
      </ul>
      <h2 className="section-title">Every question</h2>
      <ol className="exam-review">
        {result.ids.map((id, position) => {
          const question = questions[position];
          const given = result.answers[id];
          if (!question) return <li key={id}><p className="hint">Question {position + 1} is no longer in the bank.</p></li>;
          const correct = given === question.correct;
          const text = (letter: string) => question.options.find(([key]) => key === letter)?.[1] || '';
          return (
            <li key={id} className={correct ? 'is-right' : 'is-wrong'}>
              <p className="quiz-meta"><span className={correct ? 'mark is-right' : 'mark is-wrong'}>{correct ? 'Right' : given ? 'Wrong' : 'Unanswered'}</span><span>Question {position + 1}</span><span>{areaOf(question.domain)}</span></p>
              <p className="review-q">{keepTogether(question.prompt)}</p>
              <dl className="review-answers">
                <div><dt>Your answer</dt><dd>{given ? <><strong>{given}</strong> {keepTogether(text(given))}</> : 'None'}</dd></div>
                {!correct && <div><dt>Right answer</dt><dd><strong>{question.correct}</strong> {keepTogether(text(question.correct))}</dd></div>}
              </dl>
              <p className="review-why">{keepTogether(question.explanation)}</p>
              {given && !correct && question.incorrect[given] && <p className="review-why hint">Why {given} is wrong: {keepTogether(question.incorrect[given])}</p>}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/* ==========================================================================
   Plan: the four exam blocks in order, with estimated dates.
   ========================================================================== */

function PlanView({ completed, records, estimates, today, current, runKey, nextMorning, onMorning, onWeekend }: {
  completed: Set<string>; records: Records; estimates: Map<string, string | null>; today: string; current?: ExamBlock; runKey?: string; nextMorning?: string;
  onMorning: (item: Morning) => void; onWeekend: (item: WeekendBlock) => void;
}) {
  const start = records.plan.startDate && isStudyDate(records.plan.startDate) && records.plan.startDate > today ? records.plan.startDate : '';
  return (
    <div className="plan">
      <header className="screen-head">
        <h1>Plan</h1>
        <p className="lede">Four exams, one at a time. Dates are estimates at five mornings and one weekend block a week, counted from {start ? `your start date, ${formatDate(start)}` : 'today'}.</p>
      </header>
      <ol className="blocks">
        {examBlocks.map((item, position) => {
          const isCurrent = current?.key === item.key;
          const done = item.status === 'ready' && blockFinished(item, completed);
          const exam = estimates.get(`${item.key}-exam`);
          const status = item.status === 'building' ? 'Being built' : done ? 'Done' : isCurrent ? 'Now' : 'Ready';
          return (
            <li key={item.key} id={`block-${item.key}`} className={isCurrent ? 'block is-current' : 'block'}>
              <header className="block-head">
                <p className="eyebrow"><span>Exam {position + 1} of {examBlocks.length}</span><span className={isCurrent ? 'block-now' : undefined}>{status}</span></p>
                <h2>{keepTogether(item.title)}</h2>
                {exam && <p className="block-when">Exam about {formatDate(exam)}</p>}
              </header>
              {item.status === 'building' && <p className="block-line">Being built. {keepTogether(item.summary)}</p>}
              {item.status === 'ready' && !isCurrent && <p className="block-line">{done ? 'Every morning and weekend block is done.' : keepTogether(item.summary)}</p>}
              {isCurrent && (
                <div className="block-body">
                  <p className="block-line">{keepTogether(item.summary)}</p>
                  <h3 className="section-title">Mornings</h3>
                  <ul className="list plan-items" aria-label={`${item.cert} mornings`}>
                    {item.mornings.map((entry, number) => {
                      const isDone = completed.has(entry.key);
                      const gate = morningGate(item, entry, completed);
                      const date = estimates.get(entry.key);
                      const now = runKey === entry.key;
                      const next = !now && entry.key === nextMorning;
                      const state = now ? 'In progress' : isDone ? 'Done' : next ? 'Next' : !gate.open ? gate.reason : date ? shortDate(date) : '';
                      return <PlanRow key={entry.key} mark={isDone ? 'done' : now || next ? 'next' : 'none'} label={`Morning ${number + 1}, ${kindLabel(entry.kind).toLowerCase()}${(next || now) && date ? `, ${shortDate(date)}` : ''}`} title={entry.title} state={state} onOpen={gate.open || isDone ? () => onMorning(entry) : undefined} />;
                    })}
                  </ul>
                  <h3 className="section-title">Weekend blocks</h3>
                  <ul className="list plan-items" aria-label={`${item.cert} weekend blocks`}>
                    {item.weekends.map((entry, number) => {
                      const isDone = completed.has(entry.key);
                      const gate = weekendState(item, entry, completed, records, today);
                      const date = estimates.get(entry.key);
                      const state = isDone ? 'Done' : !gate.open ? gate.reason : date ? shortDate(date) : 'Open';
                      return <PlanRow key={entry.key} mark={isDone ? 'done' : gate.open ? 'next' : 'none'} label={`Weekend ${number + 1}, ${entry.kind === 'lab' ? 'lab' : 'practice exam'}, ${formatMinutes(entry.minutes)}`} title={entry.title} state={state} onOpen={gate.open ? () => onWeekend(entry) : undefined} />;
                    })}
                  </ul>
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function PlanRow({ mark, label, title, state, onOpen }: { mark: 'done' | 'next' | 'none'; label: string; title: string; state: string; onOpen?: () => void }) {
  const inner = (
    <>
      <span className={mark === 'done' ? 'tick is-done' : mark === 'next' ? 'tick is-next' : 'tick'} aria-hidden="true">{mark === 'done' && <Check />}</span>
      <span className="pi-text"><small>{label}</small><strong>{keepTogether(title)}</strong></span>
      <span className={mark === 'next' ? 'pi-state is-next' : 'pi-state'}>{state}</span>
      {onOpen ? <Chevron dir="right" /> : <span aria-hidden="true" />}
    </>
  );
  return <li>{onOpen ? <button className="plan-item" onClick={onOpen}>{inner}</button> : <div className="plan-item is-waiting">{inner}</div>}</li>;
}

/* ==========================================================================
   Learn: everything to read, inside the app.
   ========================================================================== */

const learnTabs: Array<[LearnTab, string]> = [['lessons', 'Lessons'], ['documents', 'Documents'], ['exams', 'Exams'], ['glossary', 'Glossary']];

function LearnView({ tab: chosenTab, item, lessonFrom, block, onLeaveLesson, onTab, onOpenLesson, onItem, completed, documents, onOpenDoc }: {
  tab: LearnTab; item: string | null; lessonFrom: LessonFrom; block?: ExamBlock; onLeaveLesson: () => void; onTab: (tab: LearnTab) => void;
  onOpenLesson: (key: string) => void; onItem: (item: string | null) => void; completed: Set<string>; documents: ReactNode; onOpenDoc: (item: Deliverable) => void;
}) {
  const [query, setQuery] = useState('');
  const [termCert, setTermCert] = useState<Certification | 'General' | 'All'>('All');
  const reading = useReading();
  const lessons = reading?.lessons;
  const backLabel = lessonFrom === 'plan' ? 'Plan' : lessonFrom === 'today' ? 'Today' : 'Learn';
  if (item && chosenTab === 'lessons' && !reading) {
    return <div className="reader"><button className="back" onClick={onLeaveLesson}><Chevron dir="left" /> {backLabel}</button><p className="hint loading-note">Opening the reading</p></div>;
  }
  const tab: LearnTab = chosenTab === 'lessons' && item && !lessons?.[item] ? 'lessons' : chosenTab;

  if (tab === 'lessons' && item && lessons?.[item]) {
    const owner = examBlocks.find((entry) => entry.mornings.some((morning) => morning.lesson === item));
    if (owner) {
      const taught = owner.mornings.filter((morning) => morning.kind === 'learn' && morning.lesson);
      const position = taught.findIndex((morning) => morning.lesson === item);
      const morning = taught[position];
      const prev = taught[position - 1];
      const next = taught[position + 1];
      return (
        <div className="reader-layout">
          <article className="reader" aria-labelledby="reader-title">
            <button className="back" onClick={onLeaveLesson}><Chevron dir="left" /> {backLabel}</button>
            <header className="reader-head">
              <p className="eyebrow">{owner.cert}, morning {owner.mornings.indexOf(morning) + 1} of {owner.mornings.length}{completed.has(morning.key) ? ', done' : ''}</p>
              <h1 id="reader-title">{keepTogether(morning.title)}</h1>
              <p className="reader-meta"><Tag>{examLabel(owner.cert)}</Tag><span className="meta-time">35 min</span></p>
            </header>
            <LessonBody lesson={lessons[item]} idPrefix="ls" />
            <nav className="reader-nav" aria-label="Other lessons">
              {prev?.lesson ? <button onClick={() => onItem(prev.lesson || null)}><small><Chevron dir="left" /> Previous</small><span>{prev.title}</span></button> : <span />}
              {next?.lesson ? <button className="next" onClick={() => onItem(next.lesson || null)}><small>Next <Chevron dir="right" /></small><span>{next.title}</span></button> : <span />}
            </nav>
          </article>
          <LessonToc key={item} lesson={lessons[item]} idPrefix="ls" />
        </div>
      );
    }
    const index = allTasks.findIndex((task) => task.key === item);
    const task = allTasks[index];
    if (task) {
      const prev = allTasks[index - 1];
      const next = allTasks[index + 1];
      const week = Math.floor(index / 5) + 1;
      const docs = task.docs.map((key) => allDeliverables.find((entry) => entry.key === key)).filter((entry): entry is Deliverable => Boolean(entry));
      return (
        <div className="reader-layout">
          <article className="reader" aria-labelledby="reader-title">
            <button className="back" onClick={onLeaveLesson}><Chevron dir="left" /> {backLabel}</button>
            <header className="reader-head">
              <p className="eyebrow">Kestrel library, week {week}, {task.day}</p>
              <h1 id="reader-title">{keepTogether(task.title)}</h1>
              <p className="reader-meta">{task.certifications.map((cert) => <Tag key={cert}>{examLabel(cert)}</Tag>)}<span className="meta-time">{formatMinutes(taskMinutes(task.meta))}</span></p>
            </header>
            <LessonBody lesson={lessons[item]} task={task} onOpenDoc={onOpenDoc} idPrefix="ls" />
            {docs.length > 0 && <div className="reader-actions">{docs.map((entry) => <button key={entry.key} className="secondary" onClick={() => onOpenDoc(entry)}>Write {lowerFirst(entry.title)}</button>)}</div>}
            <nav className="reader-nav" aria-label="Other lessons">
              {prev && lessonIndex[prev.key] ? <button onClick={() => onItem(prev.key)}><small><Chevron dir="left" /> Previous</small><span>{prev.title}</span></button> : <span />}
              {next && lessonIndex[next.key] ? <button className="next" onClick={() => onItem(next.key)}><small>Next <Chevron dir="right" /></small><span>{next.title}</span></button> : <span />}
            </nav>
          </article>
          <LessonToc key={item} lesson={lessons[item]} idPrefix="ls" />
        </div>
      );
    }
  }

  if (tab === 'exams' && item) {
    const guide = examGuides.find((entry) => entry.cert === item);
    if (guide) {
      return (
        <article className="reader" aria-labelledby="reader-title">
          <button className="back" onClick={() => onItem(null)}><Chevron dir="left" /> Exams</button>
          <ExamGuideBody guide={guide} />
        </article>
      );
    }
  }

  const needle = query.trim().toLowerCase();
  const terms = glossary.filter((term) => (termCert === 'All' || term.cert === termCert) && (!needle || term.term.toLowerCase().includes(needle) || term.definition.toLowerCase().includes(needle)));
  const blockLessons = block ? block.mornings.filter((morning) => morning.kind === 'learn' && morning.lesson && lessonIndex[morning.lesson]) : [];
  const kestrelCount = allTasks.filter((task) => lessonIndex[task.key]).length;

  return (
    <div className="learn">
      <header className="screen-head">
        <h1>Learn</h1>
        <p className="lede">{block ? `The lessons for ${block.title} first, then the Kestrel library: ` : 'The Kestrel library: '}{kestrelCount} lessons, {Object.keys(guideIndex).length} project documents with finished examples, {examGuides.length} exam guides and {glossary.length} terms.</p>
      </header>
      <div className="segmented" role="tablist" aria-label="Learn sections">
        {learnTabs.map(([key, label]) => <button key={key} role="tab" aria-selected={tab === key} className={tab === key ? 'active' : ''} onClick={() => onTab(key)}>{label}</button>)}
      </div>

      {tab === 'lessons' && (
        <div className="lesson-library">
          {block && blockLessons.length > 0 && (
            <section aria-labelledby="block-lessons">
              <h2 id="block-lessons" className="section-title">{block.title}</h2>
              <ul className="list block-lessons">
                {blockLessons.map((morning) => (
                  <li key={morning.key}>
                    <button className="row" onClick={() => onOpenLesson(morning.lesson || morning.key)}>
                      <span className="lesson-no" aria-hidden="true">{block.mornings.indexOf(morning) + 1}</span>
                      <span className="row-text"><strong>{keepTogether(morning.title)}</strong><small>Morning {block.mornings.indexOf(morning) + 1}{morning.brief ? `, brief from ${morning.brief.from}` : ''}</small></span>
                      <Status kind={completed.has(morning.key) ? 'done' : 'none'}>{completed.has(morning.key) ? 'Done' : 'Not yet'}</Status>
                      <Chevron dir="right" />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <section aria-labelledby="kestrel-lessons">
            <h2 id="kestrel-lessons" className="section-title">Kestrel library</h2>
            <p className="hint library-note">{kestrelCount} lessons from Project Beacon, by week. Open one when a document or a question sends you there.</p>
            <div className="list lesson-weeks">
              {studyWeeks.map((week) => (
                <details key={week.number} className="week-fold" id={`library-week-${week.number}`}>
                  <summary className="row"><span className="row-text"><strong>Week {week.number}</strong><small>{keepTogether(week.theme)}</small></span><FoldMark /></summary>
                  <ul className="week-lessons">
                    {week.tasks.filter((task) => lessonIndex[task.key]).map((task) => (
                      <li key={task.key}><button className="row" onClick={() => onOpenLesson(task.key)}><span className="row-text"><strong>{keepTogether(task.title)}</strong><small>{task.day}</small></span><Chevron dir="right" /></button></li>
                    ))}
                  </ul>
                </details>
              ))}
            </div>
          </section>
        </div>
      )}

      {tab === 'documents' && documents}

      {tab === 'exams' && (
        <div className="exam-cards">
          {examGuides.map((guide) => (
            <button key={guide.cert} className="exam-card" onClick={() => onItem(guide.cert)}>
              <span className="exam-code">{examLabel(guide.cert)}</span>
              <strong>{guide.name}</strong>
              <span className="exam-facts">{keepTogether(guide.glance)}</span>
              <Chevron dir="right" />
            </button>
          ))}
        </div>
      )}

      {tab === 'glossary' && (
        <div className="glossary">
          <label className="sr-only" htmlFor="term-search">Search terms</label>
          <input id="term-search" className="search" type="search" placeholder="Search a term or idea" value={query} onChange={(event) => setQuery(event.target.value)} />
          <div className="pills" role="group" aria-label="Filter by exam">
            {(['All', 'PMP', 'PL-300', 'CISSP', 'ITIL', 'General'] as const).map((cert) => (
              <button key={cert} className={termCert === cert ? 'pill active' : 'pill'} aria-pressed={termCert === cert} onClick={() => setTermCert(cert)}>{examLabel(cert)}</button>
            ))}
          </div>
          <p className="hint" aria-live="polite">{terms.length} {terms.length === 1 ? 'term' : 'terms'}</p>
          <dl className="list terms">
            {terms.map((term) => (
              <div key={`${term.cert}-${term.term}`}>
                <dt>{term.term}<Tag>{examLabel(term.cert)}</Tag></dt>
                <dd>{keepTogether(term.definition)}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </div>
  );
}

/* A lesson. In a morning only the reading parts show ("read"): the step he
   does himself and the recall prompts come after it, one at a time. */
function LessonBody({ lesson, task, onOpenDoc, idPrefix, parts = 'all' }: { lesson: Lesson; task?: StudyTask; onOpenDoc?: (item: Deliverable) => void; idPrefix: string; parts?: 'all' | 'read' }) {
  const docs = (task?.docs || []).map((key) => allDeliverables.find((entry) => entry.key === key)).filter((entry): entry is Deliverable => Boolean(entry));
  const docGuides = useReading()?.docGuides || {};
  const id = (part: string) => `${idPrefix}-${part}`;
  return (
    <div className="lesson">
      <p className="lesson-summary">{keepTogether(lesson.summary)}</p>
      {lesson.read.map((section, index) => (
        <section key={section.heading} className="read" id={id(`read-${index}`)}>
          <h2 className="read-heading">{section.heading}</h2>
          <RichText text={section.body} />
        </section>
      ))}
      <section aria-label="Key terms" id={id('terms')}>
        <h3>Key terms</h3>
        <dl className="key-terms">{lesson.keyTerms.map((term) => <div key={term.term}><dt>{keepTogether(term.term)}</dt><dd>{keepTogether(term.definition)}</dd></div>)}</dl>
      </section>
      {parts === 'all' && (
        <section className="build" aria-label="Build today" id={id('build')}>
          <h3>Build today</h3>
          <p className="build-goal">{keepTogether(lesson.build.goal)}</p>
          <ol className="steps">{lesson.build.steps.map((step) => <li key={step}>{keepTogether(step)}</li>)}</ol>
          {lesson.build.modelAnswer && (
            <details className="finished" open={docs.length === 0}>
              <summary>{docs.length ? 'What good looks like' : 'Model answer'}<FoldMark /></summary>
              <RichText text={lesson.build.modelAnswer} />
            </details>
          )}
          {docs.filter((entry) => docGuides[entry.key]).map((entry) => (
            <details key={entry.key} className="finished">
              <summary>See the finished {lowerFirst(entry.title)}<FoldMark /></summary>
              <RichText text={docGuides[entry.key].modelDocument} />
              {onOpenDoc && <button className="secondary" onClick={() => onOpenDoc(entry)}>Write your own version</button>}
            </details>
          ))}
        </section>
      )}
      <section aria-label="On the exam" id={id('exam')}>
        <h3>On the exam</h3>
        <ul className="tips">{lesson.examTips.map((tip) => <li key={tip.tip}><Tag>{examLabel(tip.cert)}</Tag><p>{keepTogether(tip.tip)}</p></li>)}</ul>
      </section>
      <section aria-label="Watch out for" id={id('watch')}>
        <h3>Watch out for</h3>
        <ul className="pitfalls">{lesson.pitfalls.map((pitfall) => <li key={pitfall}>{keepTogether(pitfall)}</li>)}</ul>
      </section>
      {parts === 'all' && (
        <section aria-label="Check yourself" id={id('check')}>
          <h3>Check yourself</h3>
          <ol className="self-check">
            {lesson.check.map((item) => (
              <li key={item.q}>
                <p>{keepTogether(item.q)}</p>
                <details><summary>Show the answer</summary><p>{keepTogether(item.a)}</p></details>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}

function GuideBody({ guide, showModel = true }: { guide: DocGuide; showModel?: boolean }) {
  return (
    <div className="lesson doc-guide">
      <p className="lesson-summary">{keepTogether(guide.purpose)}</p>
      <section aria-label="Sections">
        <h3>What goes in it</h3>
        <ol className="guide-sections">{guide.sections.map((section) => <li key={section.heading}><strong>{keepTogether(section.heading)}</strong><p>{keepTogether(section.guidance)}</p></li>)}</ol>
      </section>
      {showModel && (
        <section aria-label="Finished example">
          <h3>The finished Kestrel version</h3>
          <div className="model-doc"><RichText text={guide.modelDocument} /></div>
        </section>
      )}
      <section aria-label="Common mistakes">
        <h3>Common mistakes</h3>
        <ul className="pitfalls">{guide.mistakes.map((mistake) => <li key={mistake}>{keepTogether(mistake)}</li>)}</ul>
      </section>
    </div>
  );
}

/* A small, safe markdown subset: paragraphs, "- " and "1. " lists, pipe
   tables, fenced code, and "##"/"###" headings. No HTML is ever injected. */
function RichText({ text }: { text: string }) {
  const lines = text.replace(/\r/g, '').split('\n');
  const blocks: ReactNode[] = [];
  let index = 0;
  let paragraph: string[] = [];
  const flush = () => { if (paragraph.length) { blocks.push(<p key={`p${blocks.length}`}>{keepTogether(paragraph.join(' '))}</p>); paragraph = []; } };
  while (index < lines.length) {
    const line = lines[index];
    const trimmed = line.trim();
    if (trimmed.startsWith('```')) {
      flush();
      const code: string[] = [];
      index += 1;
      while (index < lines.length && !lines[index].trim().startsWith('```')) { code.push(lines[index]); index += 1; }
      index += 1;
      blocks.push(<pre key={`c${blocks.length}`} className="code"><code>{code.join('\n')}</code></pre>);
      continue;
    }
    if (!trimmed) { flush(); index += 1; continue; }
    if (trimmed.startsWith('### ')) { flush(); blocks.push(<h5 key={`h${blocks.length}`}>{trimmed.slice(4)}</h5>); index += 1; continue; }
    if (trimmed.startsWith('## ')) { flush(); blocks.push(<h4 key={`h${blocks.length}`}>{trimmed.slice(3)}</h4>); index += 1; continue; }
    if (trimmed.startsWith('|')) {
      flush();
      const rows: string[][] = [];
      while (index < lines.length && lines[index].trim().startsWith('|')) {
        const row = lines[index].trim();
        if (!/^\|[\s:|-]+\|$/.test(row)) rows.push(row.replace(/^\||\|$/g, '').split('|').map((cell) => cell.trim()));
        index += 1;
      }
      const [head, ...body] = rows;
      blocks.push(
        <div key={`t${blocks.length}`} className="table-scroll rich-table">
          <table>
            {head && <thead><tr>{head.map((cell, cellIndex) => <th key={cellIndex}>{cell}</th>)}</tr></thead>}
            <tbody>{body.map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>)}</tbody>
          </table>
        </div>,
      );
      continue;
    }
    const bullet = /^[-*] /;
    const numbered = /^\d+[.)] /;
    if (bullet.test(trimmed) || numbered.test(trimmed)) {
      flush();
      const ordered = numbered.test(trimmed);
      const items: string[] = [];
      while (index < lines.length && (ordered ? numbered : bullet).test(lines[index].trim())) { items.push(lines[index].trim().replace(ordered ? numbered : bullet, '')); index += 1; }
      const List = ordered ? 'ol' : 'ul';
      blocks.push(<List key={`l${blocks.length}`}>{items.map((item, itemIndex) => <li key={itemIndex}>{keepTogether(item)}</li>)}</List>);
      continue;
    }
    paragraph.push(trimmed);
    index += 1;
  }
  flush();
  return <div className="rich">{blocks}</div>;
}

function ExamGuideBody({ guide }: { guide: ExamGuide }) {
  return (
    <>
      <header className="reader-head">
        <p className="eyebrow">{guide.credential}</p>
        <h1 id="reader-title">{guide.name}</h1>
        <p className="lede">{keepTogether(guide.summary)}</p>
      </header>
      <dl className="exam-facts-grid">{guide.facts.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
      <section className="lesson" aria-label="What it covers">
        <h3>What it covers</h3>
        <p className="hint">{guide.areasNote}</p>
        <div className="list areas">
          {guide.areas.map((area) => {
            const top = area.weight ? Number(area.weight.split(/[–%]/).filter(Boolean).pop()) : 0;
            return (
              <details key={area.name} className="area">
                <summary>
                  <span className="area-name">{area.name}</span>
                  <span className="area-weight">{area.weight}</span>
                  <FoldMark />
                  {area.weight && <span className="area-bar" aria-hidden="true"><span style={{ width: `${Math.min(100, top * 2)}%` }} /></span>}
                </summary>
                <ul>{area.covers.map((line) => <li key={line}>{keepTogether(line)}</li>)}</ul>
              </details>
            );
          })}
        </div>
        {guide.eligibility.length > 0 && <><h3>Who can sit it</h3><ul className="pitfalls plain">{guide.eligibility.map((line) => <li key={line}>{keepTogether(line)}</li>)}</ul></>}
        <h3>How to answer</h3>
        <ol className="steps">{guide.technique.map((line) => <li key={line}>{keepTogether(line)}</li>)}</ol>
        <h3>Where it sits in your plan</h3>
        <ul className="pitfalls plain">{guide.inThisPlan.map((line) => <li key={line}>{keepTogether(line)}</li>)}</ul>
        <h3>After you pass</h3>
        <ul className="pitfalls plain">{guide.keeping.map((line) => <li key={line}>{keepTogether(line)}</li>)}</ul>
        <p className="hint source">Checked against <a href={guide.source.url} target="_blank" rel="noreferrer">{guide.source.label}</a> on 18 October 2026. Publishers update exams; confirm the date on the official page before you book.</p>
      </section>
    </>
  );
}

function DownloadIcon() {
  return <svg className="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19.5h14" /></svg>;
}

/* ==========================================================================
   Quiz run: one question per screen. The verdict appears under the answers
   and the next step stays in reach at the bottom.
   ========================================================================== */

function QuizRun({ run, saving, timerChip, onAnswer, onNext, onClose }: {
  run: Run; saving: boolean; timerChip?: ReactNode; onAnswer: (question: ScenarioQuestion, choice: string) => Promise<boolean>; onNext: () => void; onClose: () => void;
}) {
  const question = run.questions[run.index];
  const [choice, setChoice] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const correct = choice === question.correct;
  async function check() {
    if (!choice || submitted || saving) return;
    if (await onAnswer(question, choice)) setSubmitted(true);
  }
  useEffect(() => {
    if (!submitted) return;
    const handle = window.setTimeout(() => document.getElementById('verdict')?.scrollIntoView({ behavior: scrollBehavior(), block: 'nearest' }), 40);
    return () => window.clearTimeout(handle);
  }, [submitted]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (target.tagName === 'SELECT' || target.tagName === 'TEXTAREA' || (target.tagName === 'INPUT' && (target as HTMLInputElement).type !== 'radio')) return;
      const key = event.key.toUpperCase();
      if (!submitted && ['A', 'B', 'C', 'D'].includes(key)) { setChoice(key); event.preventDefault(); }
      else if (event.key === 'Enter') { event.preventDefault(); if (submitted) onNext(); else void check(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  return (
    <div className={submitted ? 'quiz is-answered' : 'quiz'}>
      <header className="quiz-bar">
        <button className="close" onClick={onClose} aria-label="End practice">×</button>
        <div className="quiz-progress" role="progressbar" aria-valuemin={0} aria-valuemax={run.questions.length} aria-valuenow={run.index + (submitted ? 1 : 0)} aria-label={`${run.title}, question ${run.index + 1} of ${run.questions.length}`}>
          <span style={{ width: `${((run.index + (submitted ? 1 : 0)) / run.questions.length) * 100}%` }} />
        </div>
        <span className="quiz-end">
          <span className="quiz-count">{run.index + 1}/{run.questions.length}</span>
          {timerChip}
        </span>
      </header>
      <div className="quiz-body">
        <p className="quiz-run">{run.kind === 'artifact' ? `Check yourself: ${run.title}` : `${run.title}, counts toward nothing`}</p>
        <p className="quiz-meta"><Tag>{examLabel(question.certification)}</Tag><span>{question.domain}</span></p>
        <h1 className="quiz-q">{keepTogether(question.prompt)}</h1>
        <div className="answers" role="radiogroup" aria-label="Answers">
          {question.options.map(([key, text]) => {
            const state = submitted ? (key === question.correct ? 'is-right' : key === choice ? 'is-wrong' : 'is-muted') : choice === key ? 'is-picked' : '';
            return (
              <label key={key} className={`answer ${state}`}>
                <input type="radio" name={`q-${question.id}`} value={key} checked={choice === key} disabled={submitted} onChange={() => setChoice(key)} />
                <span className="answer-key" aria-hidden="true">{key}</span>
                <span>{keepTogether(text)}</span>
              </label>
            );
          })}
        </div>
        {submitted && (
          <section id="verdict" className={correct ? 'sheet is-right' : 'sheet is-wrong'} role="status">
            <strong className="sheet-title"><span className="sheet-icon" aria-hidden="true">{correct ? <Check /> : '×'}</span>{correct ? 'Sound decision' : `The best answer is ${question.correct}`}</strong>
            <p>{keepTogether(correct ? question.explanation : `${question.incorrect[choice] || 'This option does not address the governing issue.'} ${question.explanation}`)}</p>
            {question.artifactKey && <p className="sheet-link">Taught in: {allDeliverables.find((item) => item.key === question.artifactKey)?.title || 'Integrated decision record'}</p>}
          </section>
        )}
      </div>
      <footer className="quiz-foot">
        {!submitted
          ? <button className="primary wide" onClick={check} disabled={!choice || saving}>Check</button>
          : <button className="primary wide sheet-next" onClick={onNext} autoFocus>{run.index < run.questions.length - 1 ? 'Continue' : 'Finish'}</button>}
      </footer>
    </div>
  );
}

/* ==========================================================================
   Make it yours: name, why, colour and appearance.
   ========================================================================== */

function MakeItYours({ name, why, theme, accent, saving, onTheme, onAccent, onSave, onClose }: {
  name: string; why: string; theme: Theme; accent: Accent; saving: boolean;
  onTheme: (theme: Theme) => void; onAccent: (accent: Accent) => void; onSave: (name: string, why: string) => void; onClose: () => void;
}) {
  const [draftName, setDraftName] = useState(name);
  const [draftWhy, setDraftWhy] = useState(why);
  const first = useRef<HTMLInputElement>(null);
  useOverlayFocus(first, ['#main']);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="sheet-backdrop" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <form className="yours" role="dialog" aria-modal="true" aria-labelledby="yours-title" onSubmit={(event) => { event.preventDefault(); onSave(draftName, draftWhy); }}>
        <span className="yours-grab" aria-hidden="true" />
        <header className="yours-head">
          <h2 id="yours-title">Make it yours</h2>
          <button type="button" className="close" onClick={onClose} aria-label="Close">×</button>
        </header>
        <label className="field" htmlFor="yours-name">Your name</label>
        <input ref={first} id="yours-name" value={draftName} maxLength={40} autoComplete="given-name" onChange={(event) => setDraftName(event.target.value)} />
        <label className="field" htmlFor="yours-why">Why you are doing this</label>
        <textarea id="yours-why" className="short" value={draftWhy} maxLength={140} onChange={(event) => setDraftWhy(event.target.value)} placeholder="One line you will see on Today" />
        <p className="hint">{140 - draftWhy.length} characters left</p>
        <fieldset className="appearance">
          <legend className="field">Appearance</legend>
          <div className="options">
            {([['dark', 'Night'], ['light', 'Light'], ['system', 'Match this device']] as Array<[Theme, string]>).map(([key, label]) => (
              <label key={key} className={theme === key ? 'chip-option active' : 'chip-option'}>
                <input type="radio" name="theme" value={key} checked={theme === key} onChange={() => onTheme(key)} />
                {label}
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset className="swatches">
          <legend className="field">Your colour</legend>
          <div className="options">
            {accents.map(([key, label, swatch]) => (
              <label key={key} className={accent === key ? 'swatch active' : 'swatch'}>
                <input type="radio" name="accent" value={key} checked={accent === key} onChange={() => onAccent(key)} />
                <span className="swatch-dot" style={{ background: swatch }} aria-hidden="true" />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <p className="hint">Colour and appearance change straight away and stay on this device. Your name and why are saved with your plan.</p>
        <div className="row-actions form-actions">
          <button className="primary wide" disabled={saving} type="submit">{saving ? 'Saving' : 'Save name and why'}</button>
        </div>
      </form>
    </div>
  );
}

/* ==========================================================================
   Setup: three short steps.
   ========================================================================== */

const onboardingSteps = ['You', 'Background', 'Rhythm'];

function Onboarding({ notice, saving, today, onSubmit }: { notice: Notice; saving: boolean; today: string; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  const [step, setStep] = useState(0);
  const last = step === onboardingSteps.length - 1;
  return (
    <main className="onboard">
      <section className="onboard-intro">
        <div className="brand"><BrandMark /><span className="brand-name">TriCert Lab</span></div>
        <div className="onboard-pitch">
          <h1><span>Four exams.</span> <span>One at a time.</span> <span>Ninety minutes a morning.</span></h1>
          <p className="onboard-note">Each weekday morning has four parts: cards, a short lesson, questions at the exam’s pace and your mistakes. One weekend block a week is a lab in a real tool or a full practice exam. Earlier exams stay fresh through spaced review.</p>
          <p className="onboard-short">Four exams, one at a time, ninety minutes a morning.</p>
          <ol className="onboard-blocks">
            {examBlocks.map((item, index) => <li key={item.key}><strong>{index + 1}. {examLabel(item.cert)}</strong><span>{item.status === 'ready' ? item.title : `${item.title}, being built`}</span></li>)}
          </ol>
        </div>
      </section>
      <section className="onboard-form" aria-labelledby="setup-title">
        <div className="steps-bar" aria-hidden="true">{onboardingSteps.map((name, index) => <span key={name} className={index <= step ? 'on' : ''} />)}</div>
        <p className="eyebrow">Step {step + 1} of {onboardingSteps.length}</p>
        <h2 id="setup-title">{['About you', 'Your background', 'Your rhythm'][step]}</h2>
        <p className="lede">{[
          'This is your plan. Tell it who it is for and why you are doing it. You can change both later.',
          'PMP and CISSP ask for experience. PMP needs 36 months leading projects with a bachelor’s degree (48 with an associate’s, 60 with secondary school) and 35 training hours. CISSP needs five years of paid security work.',
          'Five mornings a week and one weekend block. Plan estimates every date from the day you start.',
        ][step]}</p>
        <form onSubmit={(event) => { if (!last) { event.preventDefault(); setStep(step + 1); return; } onSubmit(event); }}>
          <fieldset hidden={step !== 0}>
            <legend className="sr-only">About you</legend>
            <div className="form-grid">
              <div className="wide"><label className="field" htmlFor="displayName">What should we call you?</label><input id="displayName" name="displayName" autoComplete="given-name" maxLength={40} placeholder="Your first name" /></div>
              <div className="wide"><label className="field" htmlFor="motivation">Why are you doing this?</label><p className="hint field-hint" id="motivation-hint">One line you will see on Today.</p><textarea id="motivation" name="motivation" className="short" maxLength={140} aria-describedby="motivation-hint" placeholder="For example: move into programme work by next summer" /></div>
            </div>
          </fieldset>
          <fieldset hidden={step !== 1}>
            <legend className="sr-only">Your background</legend>
            <div className="form-grid">
              <div className="wide"><label className="field" htmlFor="education">Highest education</label><select id="education" name="education" defaultValue="bachelor"><option value="secondary">Secondary school</option><option value="associate">Associate or vocational diploma</option><option value="bachelor">Bachelor’s or higher</option><option value="gac">PMI GAC-accredited degree</option></select></div>
              <div><label className="field" htmlFor="pmMonths">Months leading projects</label><input id="pmMonths" name="pmMonths" type="number" min="0" max="240" defaultValue="0" /></div>
              <div><label className="field" htmlFor="cyberMonths">Months of security work</label><input id="cyberMonths" name="cyberMonths" type="number" min="0" max="240" defaultValue="0" /></div>
              <label className="tickbox wide"><input name="pmTrainingComplete" type="checkbox" value="yes" /><span className="box" aria-hidden="true"><Check /></span><span>The 35 PMP training hours are done</span></label>
            </div>
          </fieldset>
          <fieldset hidden={step !== 2}>
            <legend className="sr-only">Your rhythm</legend>
            <div className="form-grid">
              <div><label className="field" htmlFor="startDate">Start date</label><input id="startDate" name="startDate" type="date" defaultValue={today} required={last} /></div>
            </div>
            <ul className="hint rhythm">
              <li>Monday to Friday: one 90-minute morning.</li>
              <li>Saturday or Sunday: one block of 2 to 4 hours, a lab or a practice exam.</li>
              <li>Short on time? A short morning takes 45 minutes and keeps your reviews going.</li>
            </ul>
          </fieldset>
          {notice && <p className="toast is-error" role="alert">{notice.text}</p>}
          <div className="row-actions form-actions">
            {step > 0 && <button type="button" className="ghost" onClick={() => setStep(step - 1)}>Back</button>}
            <button className="primary wide" disabled={saving} type="submit">{last ? (saving ? 'Creating your plan' : 'Create my plan') : 'Continue'}</button>
          </div>
        </form>
      </section>
    </main>
  );
}

/* ==========================================================================
   Visual pieces
   ========================================================================== */

/* The flame from the mark, used where there is no name to show. */
const FLAME_OUTER = 'M0 0C-12 0-16-9-14-18C-12-27-3-30 2-44C6-33 15-26 15-16C15-7 11 0 0 0Z';
const FLAME_INNER = 'M0 0C-6 0-8-5-7-10C-6-16-1-18 1-26C4-19 8-15 8-9C8-4 5 0 0 0Z';

function Flame({ size = 24 }: { size?: number }) {
  return (
    <svg className="flame" width={size} height={size} viewBox="-24 -50 48 56" aria-hidden="true">
      <path d={FLAME_OUTER} fill="currentColor" />
    </svg>
  );
}

function Meter({ value, label }: { value: number; label?: string }) {
  return <span className="meter" role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}><span style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }} /></span>;
}

/* "On this page" beside a long lesson on wide screens. It follows the
   section in view and jumps to a section without changing the address. */
function tocItems(lesson: Lesson, idPrefix: string): Array<[string, string]> {
  return [
    ...lesson.read.map((section, index): [string, string] => [`${idPrefix}-read-${index}`, section.heading]),
    [`${idPrefix}-terms`, 'Key terms'],
    [`${idPrefix}-build`, 'Build today'],
    [`${idPrefix}-exam`, 'On the exam'],
    [`${idPrefix}-watch`, 'Watch out for'],
    [`${idPrefix}-check`, 'Check yourself'],
  ];
}

function LessonToc({ lesson, idPrefix }: { lesson: Lesson; idPrefix: string }) {
  const items = tocItems(lesson, idPrefix);
  const [active, setActive] = useState(items[0][0]);
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const ids = tocItems(lesson, idPrefix).map(([id]) => id);
    const inView = new Map<string, boolean>();
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => inView.set(entry.target.id, entry.isIntersecting));
      const first = ids.find((id) => inView.get(id));
      if (first) setActive(first);
    }, { rootMargin: '-8% 0px -62% 0px' });
    ids.forEach((id) => { const element = document.getElementById(id); if (element) observer.observe(element); });
    return () => observer.disconnect();
  }, [lesson, idPrefix]);
  return (
    <nav className="toc" aria-label="On this page">
      <p className="toc-title">On this page</p>
      <ol>
        {items.map(([id, label]) => (
          <li key={id}>
            <button className={active === id ? 'is-active' : undefined} aria-current={active === id ? 'location' : undefined} onClick={() => { setActive(id); document.getElementById(id)?.scrollIntoView({ behavior: scrollBehavior(), block: 'start' }); }}>{label}</button>
          </li>
        ))}
      </ol>
    </nav>
  );
}

/* Proportional digits shift as a clock ticks; give each digit a fixed cell. */
function Digits({ value }: { value: string }) {
  return <span className="digits" aria-label={value}>{value.split('').map((char, index) => <span key={index} className={/\d/.test(char) ? 'dg' : 'sep'} aria-hidden="true">{char}</span>)}</span>;
}

/* The mark: one flame on a dark tile. The flame takes the learner's colour. */
function BrandMark({ size = 30 }: { size?: number }) {
  return (
    <svg className="brand-mark" width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" rx="18" className="bm-tile" />
      <g transform="translate(32 50) scale(0.82)"><path d={FLAME_OUTER} className="bm-flame" /><path d={FLAME_INNER} className="bm-core" /></g>
    </svg>
  );
}

function Check() {
  return <svg className="check" viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

/* One disclosure mark for everything that opens in place: a chevron that
   turns over when open. A right-pointing chevron means "go to". */
function FoldMark() {
  return <span className="fold-mark" aria-hidden="true"><svg viewBox="0 0 16 16"><path d="M3.5 6l4.5 4.5L12.5 6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg></span>;
}

/* One status mark everywhere: a filled tick for done, a half-filled ring
   for started, an empty ring for not started, then a word. */
type StatusKind = 'done' | 'progress' | 'none';
function Status({ kind, children }: { kind: StatusKind; children: ReactNode }) {
  return <span className={`status is-${kind}`}><span className="status-mark" aria-hidden="true">{kind === 'done' && <Check />}</span><span>{children}</span></span>;
}
function DocStatus({ status }: { status?: string }) {
  return <Status kind={status === 'complete' ? 'done' : status === 'draft' ? 'progress' : 'none'}>{statusLabel(status)}</Status>;
}

function Chevron({ dir }: { dir: 'left' | 'right' | 'up' | 'down' }) {
  const rotate = { right: 0, down: 90, left: 180, up: 270 }[dir];
  return <svg className="chev" viewBox="0 0 16 16" aria-hidden="true" style={{ transform: `rotate(${rotate}deg)` }}><path d="M6 3.5l4.5 4.5L6 12.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function NavIcon({ name }: { name: View }) {
  const paths: Record<View, ReactNode> = {
    today: <><circle cx="12" cy="12" r="4" /><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6" /></>,
    plan: <><rect x="3.5" y="5" width="17" height="15" rx="3" /><path d="M3.5 10h17M8 3v4M16 3v4" /></>,
    learn: <path d="M12 6.5C10 5 7 4.5 3.5 5v13c3.5-.5 6.5 0 8.5 1.5 2-1.5 5-2 8.5-1.5V5C17 4.5 14 5 12 6.5zM12 6.5v13" />,
    projects: <><path d="M6 3.5h8l4.5 4.5v12.5H6z" /><path d="M14 3.5V8h4.5M9 13h6M9 16.5h6" /></>,
    practice: <path d="M13 2.5 5 13.5h6l-1 8 8-11h-6z" />,
    progress: <path d="M4 20V13M9.5 20V8M15 20v-5M20.5 20V4" />,
  };
  return <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

function Glyph({ name }: { name: 'timed' | 'review' | 'cards' | 'labs' }) {
  const paths: Record<typeof name, ReactNode> = {
    timed: <><circle cx="12" cy="13.5" r="7" /><path d="M12 13.5V10M9.5 3h5" /></>,
    review: <><path d="M5 12a7 7 0 1 0 2.1-5" /><path d="M6.5 3.5V7.5h4" /></>,
    cards: <><rect x="3.5" y="7" width="13" height="10" rx="2" /><path d="M7.5 4h11a2 2 0 0 1 2 2v8" /></>,
    labs: <><path d="M9.5 3.5v6L4.8 17.6a2 2 0 0 0 1.7 2.9h11a2 2 0 0 0 1.7-2.9L14.5 9.5v-6" /><path d="M8 3.5h8M7.2 14h9.6" /></>,
  };
  return <span className="glyph" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg></span>;
}

/* ==========================================================================
   Lists
   ========================================================================== */

function DatasetLibrary() {
  const files: Array<[string, string, string]> = [
    ['Emergency department visits', '/datasets/khn_ed_visits.csv', 'CSV'],
    ['Daily bed census', '/datasets/khn_bed_census.csv', 'CSV'],
    ['Sites and units', '/datasets/khn_sites.csv', 'CSV'],
    ['Inpatient units', '/datasets/khn_units.csv', 'CSV'],
    ['Service desk tickets', '/datasets/khn_service_desk.csv', 'CSV'],
    ['Programme work packages and budget', '/datasets/khn_programme_register.csv', 'CSV'],
    ['Programme schedule (Microsoft Project)', '/datasets/khn_schedule.csv', 'CSV'],
    ['Staff identities and accounts', '/datasets/khn_identity.csv', 'CSV'],
    ['Role permissions', '/datasets/khn_role_permissions.csv', 'CSV'],
    ['Granted permissions', '/datasets/khn_user_permissions.csv', 'CSV'],
    ['Access reviews', '/datasets/khn_access_reviews.csv', 'CSV'],
    ['Security incidents and vulnerabilities', '/datasets/khn_security_events.csv', 'CSV'],
    ['Clinical systems and recovery targets', '/datasets/khn_assets.csv', 'CSV'],
    ['Control tests, restores and training', '/datasets/khn_controls.csv', 'CSV'],
    ['Vendors', '/datasets/khn_vendors.csv', 'CSV'],
    ['SQL lab seed', '/datasets/khn_lab.sql', 'SQL'],
    ['Data dictionary', '/datasets/data-dictionary.csv', 'CSV'],
    ['Source-to-target mapping', '/datasets/source-to-target.csv', 'CSV'],
    ['Quality rules and reconciliation answers', '/datasets/quality-and-reconciliation.md', 'Markdown'],
    ['DAX measure starters', '/datasets/dax-measure-starters.md', 'Markdown'],
    ['ITIL value-stream worksheet', '/datasets/itil-value-stream-template.md', 'Markdown'],
    ['Security architecture worksheet', '/datasets/security-architecture-template.md', 'Markdown'],
  ];
  return (
    <section className="datasets" aria-labelledby="datasets-title">
      <h2 id="datasets-title" className="section-title">Kestrel Health datasets</h2>
      <p className="hint">Synthetic and deliberately imperfect: duplicates, impossible times, invalid codes and orphaned keys are documented in the reconciliation answers, not hidden.</p>
      <ul className="list files">{files.map(([label, url, kind]) => <li key={url}><a href={url} download><span>{label}</span><small>{kind}</small></a></li>)}</ul>
    </section>
  );
}

function docNumberFor(item: Deliverable) {
  const owner = projects.find((candidate) => candidate.deliverables.some((artifact) => artifact.key === item.key));
  return owner ? docNumber(owner.key, owner.deliverables.findIndex((artifact) => artifact.key === item.key)) : 'Doc';
}

/* ==========================================================================
   Plan rules for the screens. Everything about what is due, grading,
   scheduling and dates comes from lib/tricert-study.ts.
   ========================================================================== */

/* The first block that is ready and not finished. */
function currentBlock(done: Set<string>) {
  return examBlocks.find((item) => item.status === 'ready' && !blockFinished(item, done));
}
function blockFinished(item: ExamBlock, done: Set<string>) {
  return [...item.mornings, ...item.weekends].every((entry) => done.has(entry.key));
}
function modeFor(item: Morning): MorningMode {
  return item.kind === 'learn' ? 'learn' : item.kind === 'review' ? 'review' : 'repair';
}
function kindLabel(kind: string) {
  return kind === 'learn' ? 'Learn' : kind === 'review' ? 'Review' : kind === 'repair' ? 'Repair' : kind === 'lab' ? 'Lab' : kind === 'mock' ? 'Practice exam' : kind;
}
function titleIn(item: ExamBlock, key: string) {
  return [...item.mornings, ...item.weekends].find((entry) => entry.key === key)?.title || key;
}
/* A repair morning waits for the block's first practice exam. */
function morningGate(item: ExamBlock, morning: Morning, done: Set<string>) {
  if (morning.kind === 'repair') {
    const mock = item.weekends.find((entry) => entry.kind === 'mock');
    if (mock && !done.has(mock.key)) return { open: false, reason: `Opens after ${mock.title}` };
  }
  return { open: true, reason: '' };
}
/* A weekend block opens once its morning is done, and practice exam B at
   least seven days after practice exam A (the plan's minDaysAfter). */
function weekendState(item: ExamBlock, weekend: WeekendBlock, done: Set<string>, records: Records, today: string) {
  if (done.has(weekend.key)) return { open: false, reason: 'Done' };
  if (!done.has(weekend.after)) return { open: false, reason: `Opens after ${titleIn(item, weekend.after)}` };
  if (weekend.minDaysAfter) {
    const { key, days } = weekend.minDaysAfter;
    if (!done.has(key)) return { open: false, reason: `Opens ${days} days after ${titleIn(item, key)}` };
    const on = [...records.log.filter((row) => row.key === key).map((row) => row.date), ...records.mocks.filter((row) => row.weekend === key).map((row) => row.date)].filter(isStudyDate).sort().pop();
    if (on && daysBetween(on, today) < days) return { open: false, reason: `Opens on ${formatDate(addDays(on, days))}` };
  }
  return { open: true, reason: '' };
}

/* Practice exam A opens when the block's learn mornings are done; B opens
   7 days after A (the plan's minDaysAfter); after both, a new draw. */
function practiceExamGate(item: ExamBlock, done: Set<string>, mocks: MockRow[], today: string): ExamGate {
  const taken = takenForms(mocks, item.cert);
  const learn = item.mornings.filter((entry) => entry.kind === 'learn');
  const learnDone = learn.filter((entry) => done.has(entry.key)).length;
  if (!taken.includes('A')) {
    if (!learn.length || learnDone < learn.length) return { open: false, form: 'A', reason: `Practice exam A opens when the ${learn.length} learn mornings are done. ${learnDone} of ${learn.length} are done.` };
    return { open: true, form: 'A', reason: '' };
  }
  if (!taken.includes('B')) {
    const gap = item.weekends.find((entry) => entry.form === 'B')?.minDaysAfter?.days ?? 7;
    const onA = mocks.filter((row) => row.exam === item.cert && row.form === 'A').map((row) => row.date).filter(isStudyDate).sort().pop();
    if (onA && daysBetween(onA, today) < gap) return { open: false, form: 'B', reason: `Practice exam B opens on ${formatDate(addDays(onA, gap))}, ${gap} days after exam A.` };
    return { open: true, form: 'B', reason: '' };
  }
  return { open: true, form: 'draw', reason: '' };
}
function formName(form: string) {
  return /^[A-Z]$/.test(form) ? `Practice exam ${form}` : 'Practice exam, new draw';
}

/* ==========================================================================
   Saved state, the morning in this browser, and drafts
   ========================================================================== */

function normalizeState(raw: unknown): StudyState {
  const data = (raw && typeof raw === 'object' ? raw : {}) as Partial<Omit<StudyState, 'records'>> & { records?: Partial<Records> };
  const kept = data.records && typeof data.records === 'object' ? data.records : {};
  const srs = (kept.srs && typeof kept.srs === 'object' ? kept.srs : {}) as Partial<SrsRecord>;
  const list = <T,>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);
  return {
    profile: data.profile ?? null,
    progress: list<ProgressRow>(data.progress),
    attempts: list<AttemptRow>(data.attempts),
    artifacts: list<ArtifactRow>(data.artifacts),
    records: {
      plan: kept.plan && typeof kept.plan === 'object' ? kept.plan : {},
      srs: { ...srs, cards: srs.cards || {}, questions: srs.questions || {} },
      mocks: list<MockRow>(kept.mocks),
      log: list<LogRow>(kept.log),
      usercards: list<UserCard>(kept.usercards),
    },
  };
}

function readExam(): ExamRun | null {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(examKey) || 'null') as ExamRun | null;
    return parsed && parsed.v === 1 && typeof parsed.id === 'string' && Array.isArray(parsed.ids) && typeof parsed.startedAt === 'number' && Array.isArray(parsed.saved) ? parsed : null;
  } catch { return null; }
}
function writeExam(value: ExamRun) {
  try { window.localStorage.setItem(examKey, JSON.stringify(value)); } catch { /* storage unavailable; the exam still runs */ }
}
function clearExam() {
  try { window.localStorage.removeItem(examKey); } catch { /* storage unavailable */ }
}
function readLab(key: string): number[] {
  try { const parsed = JSON.parse(window.localStorage.getItem(labPrefix + key) || '[]'); return Array.isArray(parsed) ? parsed.filter((value) => typeof value === 'number') : []; } catch { return []; }
}
function writeLab(key: string, value: number[]) {
  try { window.localStorage.setItem(labPrefix + key, JSON.stringify(value)); } catch { /* storage unavailable */ }
}
function clearLab(key: string) {
  try { window.localStorage.removeItem(labPrefix + key); } catch { /* storage unavailable */ }
}
function readMorning(): MorningRun | null {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(morningKey) || 'null') as MorningRun | null;
    return parsed && parsed.v === 1 && typeof parsed.key === 'string' && morningParts[parsed.mode] && parsed.cards && parsed.questions ? parsed : null;
  } catch { return null; }
}
function writeMorning(value: MorningRun) {
  try { window.localStorage.setItem(morningKey, JSON.stringify(value)); } catch { /* storage unavailable; the morning still runs */ }
}
function clearMorning() {
  try { window.localStorage.removeItem(morningKey); } catch { /* storage unavailable */ }
}
/* Minutes count only while the morning is on screen. */
function withSpent(value: MorningRun, openedAt: number | null): MorningRun {
  return value.open && openedAt ? { ...value, spentMs: value.spentMs + Math.max(0, nowMs() - openedAt) } : value;
}

type Draft = { value: Record<string, string>; at: number };
function readDraft(key: string): Draft | null {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(draftPrefix + key) || 'null') as Draft | null;
    return parsed && typeof parsed.at === 'number' && parsed.value && typeof parsed.value === 'object' ? parsed : null;
  } catch { return null; }
}
function writeDraft(key: string, value: Record<string, string>) {
  try { window.localStorage.setItem(draftPrefix + key, JSON.stringify({ value, at: nowMs() })); } catch { /* storage unavailable */ }
}
function clearDraft(key: string) {
  try { window.localStorage.removeItem(draftPrefix + key); } catch { /* storage unavailable */ }
}
/* Keeps unsaved writing in this browser every two seconds, and drops it once
   it matches what is saved. */
function useDraftSaver(key: string | null, value: Record<string, string>, saved: Record<string, string>) {
  const latest = useRef({ key, value, saved });
  const written = useRef('');
  useEffect(() => { latest.current = { key, value, saved }; });
  useEffect(() => {
    const flush = () => {
      const { key: current, value: text, saved: stored } = latest.current;
      if (!current) return;
      const body = JSON.stringify(text);
      if (body === JSON.stringify(stored)) {
        if (written.current !== `${current}|saved`) { clearDraft(current); written.current = `${current}|saved`; }
        return;
      }
      if (written.current === `${current}|${body}`) return;
      writeDraft(current, text);
      written.current = `${current}|${body}`;
    };
    const handle = window.setInterval(flush, 2000);
    window.addEventListener('pagehide', flush);
    return () => { window.clearInterval(handle); window.removeEventListener('pagehide', flush); };
  }, []);
}

/* ==========================================================================
   Helpers
   ========================================================================== */

/* Keep exam and document codes on one line: "PL-300" never splits at its
   hyphen. The text itself is unchanged. */
const unbroken = /(PL-300|ITIL V5|R\d-\d\d|CR-\d\d|Release \d|Week \d+)/;
function keepTogether(text: string): ReactNode {
  if (!unbroken.test(text)) return text;
  return text.split(unbroken).map((part, index) => (index % 2 ? <span key={index} className="nobr">{part}</span> : part));
}
/* "MFA and SSO recommendation" keeps its capitals; "Business case" reads
   "business case" mid-sentence. */
function lowerFirst(title: string) { return /^.[a-z]/.test(title) ? title.charAt(0).toLowerCase() + title.slice(1) : title; }
function safeDomains(value: string) { try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed : []; } catch { return []; } }
function nowMs() { return Date.now(); }
/* Today's date. The browser checks can set it (window.__tricertToday) so they
   do not depend on the real calendar. */
function todayIso() {
  const forced = (globalThis as { __tricertToday?: unknown }).__tricertToday;
  if (typeof forced === 'string' && isStudyDate(forced)) return forced;
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
function daysUntil(target: string, today: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(target)) return null;
  return Math.round((Date.parse(`${target}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000);
}
function formatDate(value: string) {
  const parsed = new Date(`${value}T12:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}
function formatClock(seconds: number) {
  const total = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}` : `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}
/* The practice exam clock: minutes and seconds, so 60 minutes reads 60:00. */
function formatCountdown(seconds: number) {
  const total = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}
function formatMinutes(minutes: number) {
  const whole = Math.round(minutes);
  const hours = Math.floor(whole / 60);
  const rest = whole % 60;
  return hours ? `${hours} h${rest ? ` ${rest} min` : ''}` : `${whole} min`;
}
function taskMinutes(meta: string) { const match = meta.match(/(\d+)\s*min/); return match ? Number(match[1]) : 60; }
function shortDate(value: string) {
  const parsed = new Date(`${value}T12:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
}
function formatTime(at: number) {
  const date = new Date(at);
  const sameDay = date.toDateString() === new Date().toDateString();
  return sameDay ? date.toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit' }) : date.toLocaleString('en-CA', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}
function statusLabel(status?: string) { return status === 'complete' ? 'Complete' : status === 'draft' ? 'Draft' : 'Not started'; }
function scrollBehavior(): ScrollBehavior {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
}
type LessonFrom = 'today' | 'plan' | 'learn';
type LessonEntry = { lesson: string; from: LessonFrom };
/* The lesson recorded on the current history entry, if any. */
function lessonEntry(): LessonEntry | null {
  const value: unknown = window.history.state;
  if (!value || typeof value !== 'object') return null;
  const { lesson, from } = value as Partial<LessonEntry>;
  return typeof lesson === 'string' && lessonIndex[lesson] && (from === 'today' || from === 'plan' || from === 'learn') ? { lesson, from } : null;
}
function routeFromHash(): { view: View; tab?: 'readiness' | 'portfolio'; learnTab?: LearnTab } | null {
  const hash = window.location.hash.replace('#', '');
  if (hash === 'home') return { view: 'today' };
  if (hash === 'projects') return { view: 'learn', learnTab: 'documents' };
  if (hash === 'portfolio') return { view: 'progress', tab: 'portfolio' };
  return navItems.some(([key]) => key === hash) ? { view: hash as View } : null;
}
/* Night is the default. Version 6 saved "system" for everyone who never
   chose, so a "system" saved before version 7 starts at night once. */
const prefsVersion = 7;
function savedTheme(prefs: UiPrefs): Theme {
  if (prefs.theme === 'light') return 'light';
  if (prefs.theme === 'system' && prefs.v === prefsVersion) return 'system';
  return 'dark';
}
function readPrefs(): UiPrefs {
  try { const parsed = JSON.parse(window.localStorage.getItem(uiPrefsKey) || '{}'); return parsed && typeof parsed === 'object' ? parsed : {}; } catch { return {}; }
}
function writePrefs(prefs: UiPrefs) {
  try { window.localStorage.setItem(uiPrefsKey, JSON.stringify(prefs)); } catch { /* storage unavailable; preferences are optional */ }
}
function downloadFile(name: string, content: string, type: string) { const url = URL.createObjectURL(new Blob([content], { type })); const link = document.createElement('a'); link.href = url; link.download = name; link.click(); URL.revokeObjectURL(url); }

const demoScript = `# Project Beacon portfolio demonstration\n\n## 0:00 to 0:30 · Problem\nKestrel Health Network (fictional) ran patient flow from emailed spreadsheets, clinicians waited days for access, and nobody had tested a restore of the clinical information system. All data in this case study is synthetic.\n\n## 0:30 to 1:30 · Release 1: trusted patient-flow analytics\nShow the data-quality findings, the star schema, the reconciliation to expected totals and the core measures. Explain why privacy and grain were settled before any visual.\n\n## 1:30 to 2:30 · Release 2: safe clinician access\nShow the role matrix, the RLS tests and the access-request value stream. Explain how least privilege, negative testing and service measures fit together.\n\n## 2:30 to 3:30 · Release 3: cyber resilience\nShow the security-operations dashboard and the restore tests. Explain how the business impact analysis set RTO and RPO and the recovery order.\n\n## 3:30 to 4:30 · Programme evidence\nShow the charter, schedule, RAID log, change decisions, earned value and service reviews. Name one trade-off and who accepted the remaining risk.\n\n## Close\nSummarize the measurable outcomes, the limits of the evidence and the next step.`;
