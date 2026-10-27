'use client';

import { FormEvent, ReactNode, RefObject, useEffect, useMemo, useRef, useState } from 'react';
import {
  coverageRows,
  flashcards,
  labCards,
  officialSources,
  portfolioChecklist,
  projects,
  questionsForDeliverable,
  scenarioBank,
  studyWeeks,
  type Certification,
  type Deliverable,
  type ScenarioQuestion,
  type StudyTask,
} from '@/lib/tricert-content';
import { examQuestions, extraFlashcards, glossary, guideIndex, lessonIndex, type DocGuide, type Lesson } from '@/lib/tricert-library';

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
type ProgressRow = { item_key: string; status: string };
type AttemptRow = { question_id: string; certification: string; domain: string; answer: string; correct: number; confidence: string; created_at: string };
type ArtifactRow = { artifact_key: string; status: string; evidence_text: string; reflection: string; updated_at?: string };
type StudyState = { profile: Profile | null; progress: ProgressRow[]; attempts: AttemptRow[]; artifacts: ArtifactRow[] };
type View = 'today' | 'plan' | 'learn' | 'projects' | 'practice' | 'progress';
type LearnTab = 'exams' | 'lessons' | 'documents' | 'glossary';
type PracticeScreen = 'hub' | 'run' | 'flashcards' | 'labs' | 'review';
type Notice = { text: string; kind: 'success' | 'error' } | null;
type Timer = { key: string; startedAt: number; pausedAt: number | null; pausedTotal: number };
type Theme = 'system' | 'light' | 'dark';
type Accent = 'beacon' | 'rose' | 'canola' | 'glacier';
type UiPrefs = { v?: number; project?: string; artifact?: string; timer?: Timer | null; rubric?: Record<string, number[]>; theme?: Theme; accent?: Accent };
type Lab = (typeof labCards)[number];
type WorkLink = { kind: 'artifact'; item: Deliverable } | { kind: 'lab'; lab: Lab } | { kind: 'practice' };
type ScoreParts = { coverage: number; evidence: number; judgment: number; recall: number; total: number };
type Run = { kind: 'scenarios' | 'timed' | 'artifact'; title: string; questions: ScenarioQuestion[]; index: number; answered: number; correct: number };
type Celebration = { task: StudyTask; week: number; minutes: number; weekDone: number };

/* ==========================================================================
   Programme structure: three projects, each ending at an exam gate.
   ========================================================================== */

const allTasks = studyWeeks.flatMap((week) => week.tasks);
const allDeliverables = projects.flatMap((project) => project.deliverables);
const allArtifactQuestions = allDeliverables.flatMap((item) => questionsForDeliverable(item));
const practiceBank: ScenarioQuestion[] = [...scenarioBank, ...examQuestions];
const allFlashcards = [...flashcards, ...extraFlashcards];
const timedQuestions = (cert: Certification) => practiceBank.filter((question) => question.certification === cert || question.certification === 'Intersection');
const sessionIndex = (week: number, day: number) => (week - 1) * 5 + (day - 1);

const phases = [
  { project: 'r1', code: 'R1', from: 0, to: sessionIndex(6, 4), gate: { at: sessionIndex(6, 4), label: 'PL-300 and ITIL V5', certs: ['PL-300', 'ITIL'] as Certification[] } },
  { project: 'r2', code: 'R2', from: sessionIndex(6, 5), to: sessionIndex(10, 3), gate: { at: sessionIndex(10, 3), label: 'PMP', certs: ['PMP'] as Certification[] } },
  { project: 'r3', code: 'R3', from: sessionIndex(10, 4), to: allTasks.length - 1, gate: { at: sessionIndex(13, 4), label: 'CISSP', certs: ['CISSP'] as Certification[] } },
];
const gateAt = new Map(phases.map((phase) => [phase.gate.at, phase.gate]));
const phaseFor = (index: number) => phases.find((phase) => index >= phase.from && index <= phase.to) || phases[0];
const docNumber = (projectKey: string, index: number) => `${phases.find((phase) => phase.project === projectKey)?.code || 'NS'}-${String(index + 1).padStart(2, '0')}`;

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

/* Five places. Project documents live in Learn, next to the lessons that
   teach them. */
const navItems: Array<[View, string]> = [
  ['today', 'Today'],
  ['plan', 'Plan'],
  ['learn', 'Learn'],
  ['practice', 'Practice'],
  ['progress', 'Progress'],
];

const cyberDomains = ['Security & risk', 'Asset security', 'Architecture', 'Network security', 'Identity & access', 'Assessment & testing', 'Security operations', 'Software security'];

const certificationGuide = [
  ['PMP', 'Plan and lead the work', 'People, timelines, risks, decisions, and business value.'],
  ['PL-300', 'Turn data into decisions', 'Clean data, build a reliable model, and explain insights in Power BI.'],
  ['CISSP', 'Protect the organization', 'Understand risk, secure access and systems, and prepare for incidents.'],
  ['ITIL', 'Run and improve services', 'Create useful services, support users, measure outcomes, and keep improving.'],
] as const;

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
const emptyState: StudyState = { profile: null, progress: [], attempts: [], artifacts: [] };

/* ==========================================================================
   App
   ========================================================================== */

export default function TriCertApp() {
  const [state, setState] = useState<StudyState>(emptyState);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [view, setView] = useState<View>('today');
  const [selectedWeek, setSelectedWeek] = useState(1);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [expandedWeek, setExpandedWeek] = useState(0);
  const [selectedProject, setSelectedProject] = useState(projects[0].key);
  const [selectedArtifact, setSelectedArtifact] = useState(projects[0].deliverables[0].key);
  const [docOpen, setDocOpen] = useState(false);
  const [artifactText, setArtifactText] = useState('');
  const [artifactReflection, setArtifactReflection] = useState('');
  const [rubricChecks, setRubricChecks] = useState<Record<string, number[]>>({});
  const [practiceScreen, setPracticeScreen] = useState<PracticeScreen>('hub');
  const [run, setRun] = useState<Run | null>(null);
  const [scenarioCursor, setScenarioCursor] = useState(0);
  const [mockCert, setMockCert] = useState<Certification>('PL-300');
  const [mockSeconds, setMockSeconds] = useState(15 * 60);
  const [flashIndex, setFlashIndex] = useState(0);
  const [flashRevealed, setFlashRevealed] = useState(false);
  const [progressTab, setProgressTab] = useState<'readiness' | 'portfolio'>('readiness');
  const [retroText, setRetroText] = useState(retroTemplate);
  const [reflectionOpen, setReflectionOpen] = useState(false);
  const [itilLevelDraft, setItilLevelDraft] = useState('beginner');
  const [itilTargetDraft, setItilTargetDraft] = useState('');
  const [timer, setTimer] = useState<Timer | null>(null);
  const [focusOpen, setFocusOpen] = useState(false);
  const [celebration, setCelebration] = useState<Celebration | null>(null);
  const [now, setNow] = useState(nowMs);
  const [today] = useState(todayIso);
  const [learnTab, setLearnTab] = useState<LearnTab>('documents');
  const [lessonFrom, setLessonFrom] = useState<'today' | 'plan'>('today');
  const [learnItem, setLearnItem] = useState<string | null>(null);
  const [flashCert, setFlashCert] = useState<Certification | 'All'>('All');
  const [theme, setTheme] = useState<Theme>(() => (typeof window === 'undefined' ? 'dark' : savedTheme(readPrefs())));
  const [accent, setAccent] = useState<Accent>(() => (typeof window === 'undefined' ? 'beacon' : readPrefs().accent || 'beacon'));
  const [settingsOpen, setSettingsOpen] = useState(false);
  const reading = useReading();

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
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Unable to load your study plan.');
        if (route) { setView(route.view); if (route.tab) setProgressTab(route.tab); if (route.learnTab) setLearnTab(route.learnTab); }
        setSelectedProject(restoredProject.key);
        setSelectedArtifact(restoredArtifact.key);
        if (prefs.timer && allTasks.some((task) => task.key === prefs.timer?.key)) setTimer(prefs.timer);
        if (prefs.rubric) setRubricChecks(prefs.rubric);
        setState(data);
        setItilLevelDraft(data.profile?.itil_level || 'beginner');
        setItilTargetDraft(data.profile?.itil_target || '');
        const saved = data.artifacts?.find((row: ArtifactRow) => row.artifact_key === restoredArtifact.key);
        setArtifactText(saved?.evidence_text || restoredArtifact.template);
        setArtifactReflection(saved?.reflection || '');
        const week = deriveCurrentWeek(data.progress || []);
        setSelectedWeek(week);
        setExpandedWeek(week);
        const savedRetro = data.artifacts?.find((row: ArtifactRow) => row.artifact_key === `retrospective-w${week}`);
        setRetroText(savedRetro?.evidence_text || retroTemplate);
      })
      .catch((error) => setNotice({ text: error.message, kind: 'error' }))
      .finally(() => setLoading(false));

    const onHashChange = () => {
      const next = routeFromHash();
      if (!next) return;
      setView(next.view);
      if (next.tab) setProgressTab(next.tab);
      if (next.learnTab) { setLearnTab(next.learnTab); setLearnItem(null); }
      else if (next.view === 'learn') { setLearnItem(null); setLearnTab((tab) => (tab === 'lessons' ? 'documents' : tab)); }
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  useEffect(() => {
    if (!loading) writePrefs({ v: prefsVersion, project: selectedProject, artifact: selectedArtifact, timer, rubric: rubricChecks, theme, accent });
  }, [loading, selectedProject, selectedArtifact, timer, rubricChecks, theme, accent]);

  useEffect(() => {
    if (!notice || notice.kind !== 'success') return;
    const handle = window.setTimeout(() => setNotice(null), 4000);
    return () => window.clearTimeout(handle);
  }, [notice]);

  useEffect(() => {
    if (!timer || timer.pausedAt) return;
    const handle = window.setInterval(() => setNow(nowMs()), 1000);
    return () => window.clearInterval(handle);
  }, [timer]);

  useEffect(() => {
    if (run?.kind !== 'timed' || mockSeconds <= 0) return;
    const handle = window.setInterval(() => setMockSeconds((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(handle);
  }, [run?.kind, mockSeconds]);

  useEffect(() => {
    const locked = focusOpen || Boolean(celebration) || settingsOpen;
    document.documentElement.style.overflow = locked ? 'hidden' : '';
    return () => { document.documentElement.style.overflow = ''; };
  }, [focusOpen, celebration, settingsOpen]);

  const completed = useMemo(() => new Set(state.progress.filter((row) => row.status === 'complete').map((row) => row.item_key)), [state.progress]);
  const currentWeek = useMemo(() => deriveCurrentWeek(state.progress), [state.progress]);
  const currentIndex = useMemo(() => {
    const index = allTasks.findIndex((task) => !completed.has(task.key));
    return index === -1 ? allTasks.length - 1 : index;
  }, [completed]);

  const latestAttempts = useMemo(() => {
    const map = new Map<string, AttemptRow>();
    state.attempts.forEach((attempt) => { if (!map.has(attempt.question_id)) map.set(attempt.question_id, attempt); });
    return [...map.values()];
  }, [state.attempts]);

  const readiness = useMemo(() => {
    const artifactComplete = new Set(state.artifacts.filter((row) => row.status === 'complete').map((row) => row.artifact_key));
    const teachBacks = state.artifacts.filter((row) => row.reflection.trim().length >= 80).length;
    const parts = (cert: Certification): ScoreParts => {
      const mappedTasks = allTasks.filter((task) => task.certifications.includes(cert));
      const coverage = ratio(mappedTasks.filter((task) => completed.has(task.key)).length, mappedTasks.length) * 30;
      const relevantArtifacts = allDeliverables.filter((item) => item.domains.some((domain) => domain.includes(cert === 'CISSP' ? 'CISSP' : cert)));
      const evidence = ratio(relevantArtifacts.filter((item) => artifactComplete.has(item.key)).length, relevantArtifacts.length) * 35;
      const attempts = latestAttempts.filter((attempt) => attempt.certification === cert || attempt.certification === 'Intersection' || attempt.certification === 'intersection');
      const judgment = ratio(attempts.filter((attempt) => Boolean(attempt.correct)).length, Math.max(8, attempts.length)) * 25;
      const recall = ratio(teachBacks, Math.max(6, relevantArtifacts.length)) * 10;
      return { coverage, evidence, judgment, recall, total: Math.round(coverage + evidence + judgment + recall) };
    };
    return { PMP: parts('PMP'), 'PL-300': parts('PL-300'), CISSP: parts('CISSP'), ITIL: parts('ITIL') } as Record<Certification, ScoreParts>;
  }, [completed, latestAttempts, state.artifacts]);

  const weekData = studyWeeks[selectedWeek - 1];
  const firstOpenDay = weekData.tasks.findIndex((task) => !completed.has(task.key));
  const activeDay = selectedDay ?? (firstOpenDay === -1 ? weekData.tasks.length - 1 : firstOpenDay);
  const activeTask = weekData.tasks[activeDay];
  const activeIndex = sessionIndex(selectedWeek, activeDay + 1);
  const project = projects.find((item) => item.key === selectedProject) || projects[0];
  const deliverable = project.deliverables.find((item) => item.key === selectedArtifact) || project.deliverables[0];
  const deliverableIndex = project.deliverables.findIndex((item) => item.key === deliverable.key);
  const artifactStatus = (key: string) => state.artifacts.find((row) => row.artifact_key === key)?.status;
  const deliverableStatus = artifactStatus(deliverable.key);
  const projectDone = (key: string) => (projects.find((item) => item.key === key)?.deliverables || []).filter((item) => artifactStatus(item.key) === 'complete').length;
  const wrongAnswers = latestAttempts.filter((attempt) => !attempt.correct);
  const reviewQueue = latestAttempts.filter((attempt) => !attempt.correct || attempt.confidence === 'low');
  const retroSaved = (week: number) => state.artifacts.some((row) => row.artifact_key === `retrospective-w${week}`);
  const draftArtifacts = state.artifacts
    .filter((row) => row.status === 'draft')
    .map((row) => allDeliverables.find((item) => item.key === row.artifact_key))
    .filter((item): item is Deliverable => Boolean(item));
  const timerTask = timer ? allTasks.find((task) => task.key === timer.key) : undefined;
  const timerIndex = timerTask ? allTasks.indexOf(timerTask) : -1;
  const elapsedSeconds = timer ? Math.max(0, ((timer.pausedAt ?? now) - timer.startedAt - timer.pausedTotal) / 1000) : 0;

  function say(text: string) { setNotice({ text, kind: 'success' }); }

  function go(next: View) {
    if (next === 'projects') { openDocuments(); return; }
    // The Learn tab always opens the Learn index, on the section last used.
    if (next === 'learn') { setLearnItem(null); if (learnTab === 'lessons') setLearnTab('documents'); }
    setView(next);
    if (next === 'practice' && practiceScreen !== 'run') setPracticeScreen('hub');
    const hash = next === 'progress' && progressTab === 'portfolio' ? 'portfolio' : next;
    if (window.location.hash !== `#${hash}`) window.history.pushState(null, '', `#${hash}`);
    window.scrollTo({ top: 0, behavior: scrollBehavior() });
  }

  function openDocuments() {
    setDocOpen(false);
    openLearn('documents');
  }

  function openLearn(tab: LearnTab, item: string | null = null) {
    setFocusOpen(false);
    setLearnTab(tab);
    setLearnItem(item);
    setView('learn');
    if (window.location.hash !== '#learn') window.history.pushState(null, '', '#learn');
    window.scrollTo({ top: 0, behavior: scrollBehavior() });
  }

  /* A lesson belongs to its session, so it opens from Plan or Today and
     its back button returns there. */
  function openLesson(key: string, from: 'today' | 'plan') {
    setFocusOpen(false);
    setLessonFrom(from);
    setLearnTab('lessons');
    setLearnItem(key);
    setView('learn');
    if (window.location.hash !== `#${from}`) window.history.pushState(null, '', `#${from}`);
    window.scrollTo({ top: 0, behavior: scrollBehavior() });
  }

  function leaveLesson() {
    const key = learnItem;
    setLearnItem(null);
    setLearnTab('documents');
    if (lessonFrom === 'plan' && key) {
      const index = allTasks.findIndex((task) => task.key === key);
      const week = Math.floor(Math.max(0, index) / 5) + 1;
      expandWeek(week);
      setView('plan');
      window.setTimeout(() => document.getElementById(`week-${week}`)?.scrollIntoView({ behavior: 'auto', block: 'start' }), 30);
      return;
    }
    setView('today');
    window.scrollTo({ top: 0 });
  }

  async function update(body: Record<string, unknown>) {
    setSaving(true);
    setNotice(null);
    try {
      const response = await fetch('/api/state', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to save your work.');
      setState(data);
      return true;
    } catch (error) {
      setNotice({ text: error instanceof Error ? error.message : 'Unable to save your work.', kind: 'error' });
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function submitProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const selectedDomains = cyberDomains.filter((domain) => form.getAll('cyberDomains').includes(domain));
    const created = await update({
      action: 'save-profile',
      displayName: form.get('displayName'),
      motivation: form.get('motivation'),
      education: form.get('education'),
      projectsLed: form.get('projectsLed'),
      pmMonths: form.get('pmMonths'),
      pmTrainingHours: form.get('pmTrainingHours'),
      pmTrainingComplete: form.get('pmTrainingComplete') === 'yes',
      cyberMonths: form.get('cyberMonths'),
      cyberDomains: selectedDomains,
      powerBiLevel: form.get('powerBiLevel'),
      powerQueryLevel: form.get('powerQueryLevel'),
      daxLevel: form.get('daxLevel'),
      sqlLevel: form.get('sqlLevel'),
      itilLevel: form.get('itilLevel'),
      weeklyHours: form.get('weeklyHours'),
      pmpTarget: form.get('pmpTarget'),
      pl300Target: form.get('pl300Target'),
      cisspTarget: form.get('cisspTarget'),
      itilTarget: form.get('itilTarget'),
    });
    // The setup form is long on a phone: open the new plan at the top.
    if (created) window.scrollTo({ top: 0 });
  }

  async function savePersonal(name: string, why: string) {
    const saved = await update({ action: 'save-personal', displayName: name, motivation: why });
    if (saved) { setSettingsOpen(false); say(name.trim() ? `Saved. This plan is yours, ${name.trim().split(/\s+/)[0]}.` : 'Saved.'); }
  }

  async function toggleProgress(key: string) {
    return update({ action: 'set-progress', itemKey: key, status: completed.has(key) ? 'not_started' : 'complete' });
  }

  function startSession(task: StudyTask) {
    if (timer?.key === task.key) { setFocusOpen(true); return; }
    const startedAt = nowMs();
    setNow(startedAt);
    setTimer({ key: task.key, startedAt, pausedAt: null, pausedTotal: 0 });
    setFocusOpen(true);
  }

  function togglePause() {
    if (!timer) return;
    const at = nowMs();
    setNow(at);
    setTimer(timer.pausedAt ? { ...timer, pausedAt: null, pausedTotal: timer.pausedTotal + (at - timer.pausedAt) } : { ...timer, pausedAt: at });
  }

  async function finishSession(task: StudyTask) {
    const minutes = timer?.key === task.key ? Math.max(1, Math.round(elapsedSeconds / 60)) : 0;
    const index = allTasks.indexOf(task);
    const week = Math.floor(index / 5) + 1;
    const saved = completed.has(task.key) ? true : await update({ action: 'set-progress', itemKey: task.key, status: 'complete' });
    if (!saved) return;
    if (timer?.key === task.key) setTimer(null);
    setFocusOpen(false);
    setSelectedDay(null);
    const weekTasks = studyWeeks[week - 1].tasks;
    const doneAfter = weekTasks.filter((item) => item.key === task.key || completed.has(item.key)).length;
    setCelebration({ task, week, minutes, weekDone: doneAfter });
  }

  async function saveItilBaseline() {
    if (!state.profile) return;
    const profile = state.profile;
    const saved = await update({
      action: 'save-profile',
      displayName: profile.display_name || '',
      motivation: profile.motivation || '',
      education: profile.education,
      projectsLed: profile.projects_led,
      pmMonths: profile.pm_months,
      pmTrainingHours: profile.pm_training_hours,
      pmTrainingComplete: Boolean(profile.pm_training_complete),
      cyberMonths: profile.cyber_months,
      cyberDomains: safeDomains(profile.cyber_domains),
      powerBiLevel: profile.power_bi_level,
      powerQueryLevel: profile.power_query_level,
      daxLevel: profile.dax_level,
      sqlLevel: profile.sql_level,
      itilLevel: itilLevelDraft,
      weeklyHours: profile.weekly_hours,
      pmpTarget: profile.pmp_target,
      pl300Target: profile.pl300_target,
      cisspTarget: profile.cissp_target,
      itilTarget: itilTargetDraft,
    });
    if (saved) say('ITIL V5 plan updated.');
  }

  async function saveArtifact(status: 'draft' | 'complete') {
    const saved = await update({ action: 'save-artifact', artifactKey: deliverable.key, status, evidenceText: artifactText, reflection: artifactReflection });
    if (saved) say(status === 'complete' ? `${deliverable.title} marked complete.` : 'Draft saved.');
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
    setArtifactText(saved?.evidence_text || item.template);
    setArtifactReflection(saved?.reflection || '');
    setDocOpen(true);
    window.scrollTo({ top: 0, behavior: scrollBehavior() });
  }

  function showWeek(number: number, day: number | null = null) {
    const bounded = Math.min(studyWeeks.length, Math.max(1, number));
    setSelectedWeek(bounded);
    setSelectedDay(day);
  }

  /* Plan opens one week at a time. Its reflection lives inside it. */
  function expandWeek(number: number, reflect = false) {
    setExpandedWeek(number);
    setReflectionOpen(reflect);
    const saved = state.artifacts.find((row) => row.artifact_key === `retrospective-w${number}`);
    setRetroText(saved?.evidence_text || retroTemplate);
  }

  function openReflection(week: number) {
    expandWeek(week, true);
    go('plan');
    window.setTimeout(() => document.getElementById(`reflection-${week}`)?.scrollIntoView({ behavior: scrollBehavior(), block: 'center' }), 60);
  }

  function openSession(index: number) {
    showWeek(Math.floor(index / 5) + 1, index % 5);
    go('today');
  }

  function openWork(link: WorkLink) {
    setFocusOpen(false);
    if (link.kind === 'artifact') { setView('projects'); window.history.pushState(null, '', '#projects'); openArtifact(link.item); return; }
    if (link.kind === 'lab') { setPracticeScreen('labs'); setView('practice'); window.history.pushState(null, '', '#practice'); window.setTimeout(() => { const fold = document.getElementById(`lab-${link.lab.key}`); if (fold instanceof HTMLDetailsElement) fold.open = true; fold?.scrollIntoView({ behavior: scrollBehavior(), block: 'start' }); }, 60); return; }
    setView('practice');
    window.history.pushState(null, '', '#practice');
    startScenarios();
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

  function startScenarios() {
    const ordered = [...practiceBank.slice(scenarioCursor), ...practiceBank.slice(0, scenarioCursor)];
    setRun({ kind: 'scenarios', title: 'Scenarios', questions: ordered, index: 0, answered: 0, correct: 0 });
    setPracticeScreen('run');
    window.scrollTo({ top: 0 });
  }

  function startTimed() {
    setMockSeconds(15 * 60);
    setRun({ kind: 'timed', title: `Timed set, ${mockCert}`, questions: timedQuestions(mockCert), index: 0, answered: 0, correct: 0 });
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

  async function answer(question: ScenarioQuestion, choice: string, confidence: string) {
    if (!run) return false;
    const prefix = run.kind === 'timed' ? `mock-${mockCert}-` : '';
    const saved = await update({
      action: 'record-attempt',
      questionId: `${prefix}${question.id}`,
      certification: prefix ? mockCert : question.certification,
      domain: question.domain,
      answer: choice,
      correct: choice === question.correct,
      confidence,
    });
    if (saved) setRun({ ...run, answered: run.answered + 1, correct: run.correct + (choice === question.correct ? 1 : 0) });
    return saved;
  }

  async function advance() {
    if (!run) return;
    if (run.kind === 'scenarios') setScenarioCursor((cursor) => (cursor + 1) % practiceBank.length);
    if (run.index < run.questions.length - 1) { setRun({ ...run, index: run.index + 1 }); return; }
    await endRun();
  }

  async function endRun() {
    if (!run) return;
    if (run.kind === 'timed' && run.answered > 0) {
      const score = Math.round((run.correct / Math.max(1, run.answered)) * 100);
      await update({
        action: 'save-artifact',
        artifactKey: mockArtifactKey(mockCert),
        status: 'complete',
        evidenceText: JSON.stringify({ certification: mockCert, score, answered: run.answered, durationMinutes: 15 }),
        reflection: 'Timed original scenario drill. Review the wrong-answer journal before counting this result toward readiness.',
      });
      say(`Timed set recorded at ${score}%.`);
    } else if (run.answered > 0) {
      say(`${run.correct} of ${run.answered} sound decisions.`);
    }
    setRun(null);
    setPracticeScreen('hub');
  }

  async function saveRetrospective() {
    const saved = await update({
      action: 'save-artifact',
      artifactKey: `retrospective-w${expandedWeek}`,
      status: 'complete',
      evidenceText: retroText,
      reflection: `Week ${expandedWeek} teach-back and improvement commitment recorded.`,
    });
    if (saved) say(`Week ${expandedWeek} reflection saved.`);
  }

  if (loading) {
    return <main className="boot" aria-live="polite"><BrandMark size={44} /><p>Loading your plan</p></main>;
  }

  if (!state.profile) {
    return <Onboarding notice={notice} saving={saving} onSubmit={submitProfile} />;
  }

  const profile = state.profile;
  const profileDomains = safeDomains(profile.cyber_domains);
  const pmpNeeded = profile.education === 'secondary' ? 60 : profile.education === 'associate' ? 48 : profile.education === 'gac' ? 24 : 36;
  const pmpEligible = profile.pm_months >= pmpNeeded && (Boolean(profile.pm_training_complete) || profile.pm_training_hours >= 35);
  const cisspNeeded = profile.education === 'bachelor' || profile.education === 'gac' ? 48 : 60;
  const cisspEligible = profile.cyber_months >= cisspNeeded && profileDomains.length >= 2;
  const exams = certs.map((item) => ({ ...item, date: String(profile[item.field] || ''), days: daysUntil(String(profile[item.field] || ''), today) }));
  const nextExam = exams.filter((exam) => exam.days !== null && exam.days >= 0).sort((a, b) => (a.days ?? 0) - (b.days ?? 0))[0];
  const nextPhase = phases.find((phase) => currentIndex <= phase.gate.at) || phases[phases.length - 1];
  const gates = gateResults(state, completed, latestAttempts, nextPhase);
  const ticked = new Set(rubricChecks[deliverable.key] || []);
  const workShort = Math.max(0, 120 - artifactText.trim().length);
  const explainShort = Math.max(0, 40 - artifactReflection.trim().length);
  const completeBlockers = [workShort ? `${workShort} more characters of work` : '', explainShort ? `${explainShort} more characters of explanation` : ''].filter(Boolean);
  const programmeDone = allTasks.filter((task) => completed.has(task.key)).length;
  const weeksDone = studyWeeks.map((week) => week.tasks.filter((task) => completed.has(task.key)).length);
  const displayName = (profile.display_name || '').trim();
  const firstName = displayName.split(/\s+/)[0] || '';
  const initials = displayName.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join('');
  const hour = new Date().getHours();
  const greeting = `${hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'}${firstName ? `, ${firstName}` : ''}`;
  const toGate = nextPhase.gate.at - currentIndex;
  const standing = programmeDone === allTasks.length
    ? 'All 65 sessions are done. Finish the handover package on Progress.'
    : `Week ${currentWeek} of 13. ${toGate === 0 ? `Your ${nextPhase.gate.label} gate is next.` : `${countWord(toGate)} ${toGate === 1 ? 'session' : 'sessions'}, then your ${nextPhase.gate.label} gate.`}`;
  const readingLesson = view === 'learn' && learnTab === 'lessons' && Boolean(learnItem);
  const navActive: View = view === 'projects' ? 'learn' : readingLesson ? lessonFrom : view;
  const gatesMet = gates.filter((gate) => gate.met).length;

  const isNext = activeIndex === currentIndex && !completed.has(activeTask.key);
  const activeGate = gateAt.has(activeIndex);
  const inRun = view === 'practice' && practiceScreen === 'run';
  const openTimer = () => { showWeek(Math.floor(timerIndex / 5) + 1, timerIndex % 5); setFocusOpen(true); };
  const nextGateWeek = Math.floor(nextPhase.gate.at / 5) + 1;
  const nextGateDay = (nextPhase.gate.at % 5) + 1;
  /* The newest finished week that still has no reflection. */
  const reflectWeek = [...studyWeeks].reverse().find((week) => weeksDone[week.number - 1] === 5 && !retroSaved(week.number))?.number ?? 0;

  /* Today keeps a short list of things already started: answers to review,
     drafts, and the reflection for a week that is finished. */
  const waiting: Array<{ title: string; detail: string; go: () => void }> = [];
  if (reviewQueue.length) waiting.push({ title: `Review ${reviewQueue.length} ${reviewQueue.length === 1 ? 'answer' : 'answers'}`, detail: 'Wrong or guessed', go: () => { setPracticeScreen('review'); setView('practice'); window.history.pushState(null, '', '#practice'); window.scrollTo({ top: 0 }); } });
  draftArtifacts.slice(0, 2).forEach((item) => waiting.push({ title: item.title, detail: `Draft, ${docNumberFor(item)}`, go: () => { setView('projects'); window.history.pushState(null, '', '#projects'); openArtifact(item); } }));
  if (reflectWeek >= 1) waiting.push({ title: `Week ${reflectWeek} reflection`, detail: 'The week is done. Write what you learned.', go: () => openReflection(reflectWeek) });

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
  const overlayOpen = (focusOpen && Boolean(timer && timerTask)) || Boolean(celebration) || settingsOpen;
  const timerChip = timer && timerTask && !focusOpen ? (
    <button className="live-chip" onClick={openTimer} aria-label={`${timer.pausedAt ? 'Paused' : 'In session'}, ${formatClock(elapsedSeconds)}. Back to your session`}>
      <span className={timer.pausedAt ? 'live-dot paused' : 'live-dot'} aria-hidden="true" />
      <Digits value={formatClock(elapsedSeconds)} />
    </button>
  ) : null;

  return (
    <>
      <div className="app" inert={overlayOpen}>
        <aside className="rail">
          <a className="brand" href="#today" aria-label="TriCert Lab, Today" title="TriCert Lab" onClick={(event) => { event.preventDefault(); go('today'); }}><BrandMark /><span className="brand-name">TriCert Lab</span></a>
          <nav className="nav" aria-label="Main navigation">
            {navItems.map(([key, label]) => {
              const badge = key === 'practice' && reviewQueue.length > 0 ? reviewQueue.length : 0;
              return (
                <button key={key} className={navActive === key ? 'active' : ''} aria-current={navActive === key ? 'page' : undefined} aria-label={badge ? `${label}, ${badge} to review` : undefined} onClick={() => go(key)}>
                  <span className="nav-glyph"><NavIcon name={key} />{badge > 0 && <span className="nav-badge" aria-hidden="true">{badge}</span>}</span>
                  <span className="nav-label">{label}</span>
                </button>
              );
            })}
          </nav>
          {timer && timerTask && !focusOpen && (
            <button className="live-pill" onClick={openTimer}>
              <span className={timer.pausedAt ? 'live-dot paused' : 'live-dot'} aria-hidden="true" />
              <span className="live-text"><span className="live-clock"><Digits value={formatClock(elapsedSeconds)} /></span><span className="live-name">{timer.pausedAt ? 'Paused, back to it' : 'Back to your session'}</span></span>
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
              {timerChip}
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
                  <div><dt>Sessions done</dt><dd><strong>{programmeDone}</strong><span>/{allTasks.length}</span></dd></div>
                  {nextExam && <div><dt>{nextExam.days === 1 ? 'Day' : 'Days'} to {nextExam.label}</dt><dd><strong>{nextExam.days}</strong></dd></div>}
                </dl>
              </header>

              <section className={completed.has(activeTask.key) ? 'hero-session is-done' : 'hero-session'} aria-labelledby="session-title">
                <div className="hero-top">
                  <p className="hero-when-line">
                    <span className="hero-label">{completed.has(activeTask.key) ? 'Done' : timer?.key === activeTask.key ? 'In session' : isNext ? 'Up next' : activeGate ? 'Exam gate' : 'Later'}</span>
                    <span className="hero-when">Week {selectedWeek}, {activeTask.day}{activeGate ? ', exam gate' : ''}</span>
                  </p>
                  <span className="hero-tags">{activeTask.certifications.map((cert) => <Tag key={cert}>{examLabel(cert)}</Tag>)}</span>
                </div>
                <h2 id="session-title">{keepTogether(activeTask.title)}</h2>
                <p className="hero-sub"><span>{formatMinutes(taskMinutes(activeTask.meta))}</span><span>{taskOutput(activeTask.meta)}</span></p>
                <div className="hero-actions">
                  {completed.has(activeTask.key)
                    ? <Status kind="done">Done</Status>
                    : (
                      <button className="primary play" onClick={() => startSession(activeTask)}>
                        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z" fill="currentColor" /></svg>
                        <span className="play-label">{timer?.key === activeTask.key ? <>Resume, <Digits value={formatClock(elapsedSeconds)} /></> : 'Start session'}</span>
                      </button>
                    )}
                  {lessonIndex[activeTask.key] && <button className="secondary hero-lesson" onClick={() => openLesson(activeTask.key, 'today')}><BookIcon /> Read the lesson</button>}
                  {completed.has(activeTask.key)
                    ? <button className="ghost push" onClick={() => toggleProgress(activeTask.key)} disabled={saving}>Mark as not done</button>
                    : <button className="ghost push" onClick={() => finishSession(activeTask)} disabled={saving}>Mark done</button>}
                </div>
                <div className="week-strip" aria-label={`Week ${selectedWeek}`}>
                  <div className="strip-head">
                    <button className="arrow" onClick={() => showWeek(selectedWeek - 1)} disabled={selectedWeek === 1} aria-label="Previous week"><Chevron dir="left" /></button>
                    <p className="strip-title"><strong>Week {selectedWeek}</strong> <span>{keepTogether(weekData.theme)}</span></p>
                    <button className="arrow" onClick={() => showWeek(selectedWeek + 1)} disabled={selectedWeek === studyWeeks.length} aria-label="Next week"><Chevron dir="right" /></button>
                  </div>
                  <ol className="days">
                    {weekData.tasks.map((task, index) => {
                      const done = completed.has(task.key);
                      const gate = gateAt.has(sessionIndex(selectedWeek, index + 1));
                      return (
                        <li key={task.key}>
                          <button className={index === activeDay ? 'day is-active' : 'day'} onClick={() => setSelectedDay(index)} aria-pressed={index === activeDay} aria-label={`${task.day}: ${task.title}${done ? ', done' : ''}${gate ? ', exam gate' : ''}`}>
                            <DayMark done={done} gate={gate} running={timer?.key === task.key} />
                            <span className="day-name">{task.day}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ol>
                  {selectedWeek !== currentWeek && <button className="text-link" onClick={() => showWeek(currentWeek)}>Back to this week</button>}
                </div>
              </section>

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
            <div className="plan">
              <header className="screen-head">
                <h1>Plan</h1>
                <p className="lede">Week {currentWeek} of 13. {programmeDone} of {allTasks.length} sessions done across three releases of Project Beacon, each ending at an exam gate.</p>
              </header>
              <section className="plan-track" aria-label="Your 13 weeks">
                <WeekTrack weeks={weeksDone} selected={expandedWeek || undefined} current={currentWeek} onSelect={(week) => { expandWeek(week); window.setTimeout(() => document.getElementById(`week-${week}`)?.scrollIntoView({ behavior: scrollBehavior(), block: 'start' }), 30); }} />
              </section>
              {phases.map((phase, phaseIndex) => {
                const phaseProject = projects.find((item) => item.key === phase.project) || projects[0];
                const weeks = studyWeeks.filter((week) => phaseFor(sessionIndex(week.number, 1)) === phase);
                const gateWeek = Math.floor(phase.gate.at / 5) + 1;
                const gateDay = (phase.gate.at % 5) + 1;
                const gateDates = phase.gate.certs.map((cert) => exams.find((exam) => exam.cert === cert)).filter((exam) => exam?.date).map((exam) => `${exam?.label} ${formatDate(exam?.date || '')}`).join(', ');
                return (
                  <section className="phase" key={phase.project} aria-labelledby={`phase-${phase.project}`}>
                    <header className="phase-head">
                      <span className="eyebrow"><span>Release {phaseIndex + 1}</span><span>Weeks {weeks[0].number} to {weeks[weeks.length - 1].number}</span></span>
                      <h2 id={`phase-${phase.project}`}>{phaseProject.title}</h2>
                    </header>
                    <ul className="list weeks">
                      {weeks.map((week) => {
                        const done = week.tasks.filter((task) => completed.has(task.key)).length;
                        const open = expandedWeek === week.number;
                        const current = week.number === currentWeek;
                        return (
                          <li key={week.number} id={`week-${week.number}`} className={[current ? 'is-current' : '', open ? 'is-open' : ''].filter(Boolean).join(' ') || undefined}>
                            <button className="week-row" aria-expanded={open} onClick={() => (open ? setExpandedWeek(0) : expandWeek(week.number))}>
                              <span className="week-text"><small>Week {week.number}{current ? ', this week' : ''}</small><strong>{keepTogether(week.theme)}</strong></span>
                              <Status kind={done === 5 ? 'done' : done > 0 ? 'progress' : 'none'}>{done === 5 ? 'Done' : `${done} of 5`}</Status>
                              <FoldMark />
                            </button>
                            {open && (
                              <div className="week-detail">
                                <p>{week.outcome}</p>
                                <ol>
                                  {week.tasks.map((task, index) => {
                                    const idx = sessionIndex(week.number, index + 1);
                                    return (
                                      <li key={task.key}>
                                        <button onClick={() => (lessonIndex[task.key] ? openLesson(task.key, 'plan') : openSession(idx))}>
                                          <span className={completed.has(task.key) ? 'tick is-done' : gateAt.has(idx) ? 'tick is-gate' : 'tick'} aria-hidden="true">{completed.has(task.key) && <Check />}</span>
                                          <span className="wd-title"><small>{task.day}{gateAt.has(idx) ? ', exam gate' : ''}</small><span>{keepTogether(task.title)}</span>{completed.has(task.key) && <span className="sr-only">, done</span>}</span>
                                          <span className="wd-time">{formatMinutes(taskMinutes(task.meta))}</span>
                                          <Chevron dir="right" />
                                        </button>
                                      </li>
                                    );
                                  })}
                                </ol>
                                {(week.number <= currentWeek || done > 0 || retroSaved(week.number)) && (
                                  <details id={`reflection-${week.number}`} className="reflect" open={reflectionOpen} onToggle={(event) => setReflectionOpen(event.currentTarget.open)}>
                                    <summary className="row"><span className="row-text"><strong>Week {week.number} reflection</strong><small>{retroSaved(week.number) ? 'Saved' : 'Not written yet'}</small></span><FoldMark /></summary>
                                    <div className="reflect-body">
                                      <label className="field" htmlFor={`retro-${week.number}`}>What can you now defend, what still needs notes, and what will you change?</label>
                                      <textarea id={`retro-${week.number}`} value={retroText} onChange={(event) => setRetroText(event.target.value)} />
                                      <div className="row-actions">
                                        <button className="primary" onClick={saveRetrospective} disabled={saving || retroText.trim().length < 100}>Save reflection</button>
                                        <span className="hint">{retroText.trim().length < 100 ? `${100 - retroText.trim().length} more characters` : 'Ready to save'}</span>
                                      </div>
                                    </div>
                                  </details>
                                )}
                              </div>
                            )}
                          </li>
                        );
                      })}
                      <li className="gate-row">
                        <span className="gate-mark" aria-hidden="true" />
                        <span className="gate-text"><small>Exam gate, week {gateWeek}, day {gateDay}</small><strong>{keepTogether(phase.gate.label)}</strong></span>
                        <span className="gate-when">{gateDates ? keepTogether(gateDates) : 'No date set'}</span>
                      </li>
                    </ul>
                  </section>
                );
              })}
              <details className="fold reference">
                <summary className="row"><span className="row-text"><strong>How the four certifications connect</strong><small>One project, four exams</small></span><FoldMark /></summary>
                <div className="reference-body">
                  <div className="guide">{certificationGuide.map(([name, title, copy]) => <div key={name}><Tag>{examLabel(name)}</Tag><strong>{title}</strong><p>{copy}</p></div>)}</div>
                  <div className="table-scroll"><table><thead><tr><th>Activity</th><th>PMP</th><th>PL-300</th><th>CISSP</th><th>ITIL V5</th></tr></thead><tbody>{coverageRows.map((row) => <tr key={row[0]}>{row.map((cell, index) => <td key={`${row[0]}-${index}`}>{cell}</td>)}</tr>)}</tbody></table></div>
                  <p className="hint">Official exam guides: {officialSources.map(([label, url], index) => <span key={label}>{index > 0 && ', '}<a href={url} target="_blank" rel="noreferrer">{label}</a></span>)}</p>
                </div>
              </details>
            </div>
          )}

          {(view === 'learn' || (view === 'projects' && !docOpen)) && (
            <LearnView
              tab={view === 'projects' ? 'documents' : learnTab}
              item={view === 'projects' ? null : learnItem}
              lessonFrom={lessonFrom}
              onLeaveLesson={leaveLesson}
              onTab={(tab) => { setView('learn'); setLearnTab(tab); setLearnItem(null); window.scrollTo({ top: 0 }); }}
              onItem={(item) => { setLearnItem(item); window.scrollTo({ top: 0 }); }}
              completed={completed}
              documents={documentsPanel}
              onStart={(task) => { showWeek(Math.floor(allTasks.indexOf(task) / 5) + 1, allTasks.indexOf(task) % 5); startSession(task); }}
              onOpenDoc={(item) => { setView('projects'); window.history.pushState(null, '', '#projects'); openArtifact(item); }}
            />
          )}

          {view === 'projects' && docOpen && (
            <article className="doc" aria-labelledby="doc-title">
              <button className="back" onClick={openDocuments}><Chevron dir="left" /> Documents</button>
              <header className="doc-head">
                <p className="eyebrow"><span>{docNumber(project.key, deliverableIndex)}</span><span>Release {phases.findIndex((phase) => phase.project === project.key) + 1}</span><DocStatus status={deliverableStatus} /></p>
                <h1 id="doc-title">{deliverable.title}</h1>
                <p className="lede">{keepTogether(deliverable.summary)}</p>
              </header>
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
              <textarea id="explain" value={artifactReflection} onChange={(event) => setArtifactReflection(event.target.value)} placeholder={deliverable.reflections.join('\n')} />
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
                <p className="lede">{latestAttempts.length} decisions recorded so far{reviewQueue.length ? `, ${reviewQueue.length} to review` : ''}.</p>
              </header>
              <div className="tiles">
                <button className="tile tile-scenarios" onClick={startScenarios}>
                  <span className="tile-text">
                    <strong>Scenarios</strong>
                    <small>{practiceBank.length} decisions across all four exams, at your own pace. You pick up where you left off.</small>
                  </span>
                  <span className="tile-go"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z" fill="currentColor" /></svg>Start scenarios</span>
                </button>
                <ul className="list practice-list">
                  <li>
                    <div className="row tile tile-timed">
                      <Glyph name="timed" />
                      <span className="row-text"><strong>Timed set</strong><small>{timedQuestions(mockCert).length} {examLabel(mockCert)} questions, 15 minutes</small></span>
                      <span className="tile-controls">
                        <label className="sr-only" htmlFor="lens">Exam</label>
                        <select id="lens" value={mockCert} onChange={(event) => setMockCert(event.target.value as Certification)}><option value="PMP">PMP</option><option value="PL-300">PL-300</option><option value="CISSP">CISSP</option><option value="ITIL">ITIL V5</option></select>
                        <button className="secondary start" onClick={startTimed}>Start</button>
                      </span>
                    </div>
                  </li>
                  <li>
                    <button className="row tile tile-review" onClick={() => setPracticeScreen('review')}>
                      <Glyph name="review" />
                      <span className="row-text"><strong>Review</strong><small>{reviewQueue.length ? 'Wrong or guessed answers to go over' : 'All clear'}</small></span>
                      {reviewQueue.length > 0 && <span className="count" aria-hidden="true">{reviewQueue.length}</span>}
                      <Chevron dir="right" />
                    </button>
                  </li>
                  <li>
                    <button className="row tile tile-cards" onClick={() => { setFlashRevealed(false); setPracticeScreen('flashcards'); }}>
                      <Glyph name="cards" />
                      <span className="row-text"><strong>Flashcards</strong><small>{allFlashcards.length} cards, filter by exam</small></span>
                      <Chevron dir="right" />
                    </button>
                  </li>
                  <li>
                    <button className="row tile tile-labs" onClick={() => setPracticeScreen('labs')}>
                      <Glyph name="labs" />
                      <span className="row-text"><strong>Labs</strong><small>{labCards.filter((lab) => completed.has(lab.key)).length} of {labCards.length} done, with datasets</small></span>
                      <Chevron dir="right" />
                    </button>
                  </li>
                </ul>
              </div>
            </div>
          )}

          {view === 'practice' && practiceScreen === 'run' && run && (
            <QuizRun
              key={`${run.kind}-${run.questions[run.index].id}-${run.index}`}
              run={run}
              saving={saving}
              seconds={run.kind === 'timed' ? mockSeconds : null}
              timerChip={timerChip}
              onAnswer={answer}
              onNext={advance}
              onClose={endRun}
            />
          )}

          {view === 'practice' && practiceScreen === 'flashcards' && (() => {
            const deck = flashCert === 'All' ? allFlashcards : allFlashcards.filter(([cert]) => cert === flashCert);
            const index = Math.min(flashIndex, deck.length - 1);
            const card = deck[index];
            const move = (step: number) => { setFlashIndex((index + step + deck.length) % deck.length); setFlashRevealed(false); };
            return (
              <div className="flash">
                <button className="back" onClick={() => setPracticeScreen('hub')}><Chevron dir="left" /> Practice</button>
                <header className="screen-head"><h1>Flashcards</h1><p className="lede">Say the answer out loud, then tap the card to check.</p></header>
                <div className="pills" role="group" aria-label="Deck">
                  {(['All', 'PMP', 'PL-300', 'CISSP', 'ITIL'] as const).map((cert) => (
                    <button key={cert} className={flashCert === cert ? 'pill active' : 'pill'} aria-pressed={flashCert === cert} onClick={() => { setFlashCert(cert); setFlashIndex(0); setFlashRevealed(false); }}>{examLabel(cert)}</button>
                  ))}
                </div>
                <button className={flashRevealed ? 'flash-card revealed' : 'flash-card'} onClick={() => setFlashRevealed(!flashRevealed)} aria-label={flashRevealed ? 'Hide answer' : 'Show answer'}>
                  <span className="flash-top">
                    <span className="flash-cert">{examLabel(card[0])}, card {index + 1} of {deck.length}</span>
                    <span className="flash-progress" aria-hidden="true"><span style={{ width: `${((index + 1) / deck.length) * 100}%` }} /></span>
                  </span>
                  <span className="flash-q">{keepTogether(card[1])}</span>
                  {flashRevealed ? <span className="flash-a">{keepTogether(card[2])}</span> : <span className="flash-hint">Tap to reveal the answer</span>}
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

          {view === 'practice' && practiceScreen === 'review' && (
            <div className="review">
              <button className="back" onClick={() => setPracticeScreen('hub')}><Chevron dir="left" /> Practice</button>
              <header className="screen-head">
                <h1>Review</h1>
                {reviewQueue.length > 0 && <p className="lede">{wrongAnswers.length} wrong, {reviewQueue.length - wrongAnswers.length} guessed. Restate the scenario, name the principle, say why your answer failed, then update the document.</p>}
              </header>
              <ReviewList queue={reviewQueue} onOpen={(key) => {
                const found = allDeliverables.find((item) => item.key === key);
                if (found) { setView('projects'); window.history.pushState(null, '', '#projects'); openArtifact(found); }
              }} />
            </div>
          )}

          {view === 'progress' && (
            <div className="progress">
              <header className="screen-head">
                <h1>Progress</h1>
                <p className="lede">{programmeDone === allTasks.length ? `All 65 sessions done. ${gatesMet} of ${gates.length} checks met for your last gate.` : <>Your next gate is {keepTogether(nextPhase.gate.label)}. {gatesMet} of {gates.length} checks met.</>}</p>
              </header>
              <div className="segmented" role="tablist" aria-label="Progress sections">
                <button role="tab" aria-selected={progressTab === 'readiness'} className={progressTab === 'readiness' ? 'active' : ''} onClick={() => { setProgressTab('readiness'); window.history.replaceState(null, '', '#progress'); }}>Readiness</button>
                <button role="tab" aria-selected={progressTab === 'portfolio'} className={progressTab === 'portfolio' ? 'active' : ''} onClick={() => { setProgressTab('portfolio'); window.history.replaceState(null, '', '#portfolio'); }}>Portfolio</button>
              </div>

              {progressTab === 'readiness' && (
                <>
                  <section className="card gate-checks" aria-labelledby="gates-title">
                    <div className="card-head">
                      <div className="gate-head">
                        <p className="eyebrow">Next gate, week {nextGateWeek}, day {nextGateDay}</p>
                        <h2 id="gates-title">Before you book {keepTogether(nextPhase.gate.label)}</h2>
                      </div>
                      <p className="gate-score" aria-label={`${gatesMet} of ${gates.length} checks met`}><strong>{gatesMet}</strong><span>/{gates.length}</span></p>
                    </div>
                    <p className="hint">Completion alone does not make you ready. Meet all five checks, then book.</p>
                    <ul className="checklist">{gates.map((gate) => <li key={gate.title}><span className={gate.met ? 'tick is-done' : 'tick'} aria-hidden="true">{gate.met && <Check />}</span><span><strong>{gate.title}</strong><small>{keepTogether(gate.detail)}</small></span></li>)}</ul>
                  </section>

                  <h2 className="section-title">Exam readiness</h2>
                  <ul className="list cert-scores">
                    {exams.map((exam) => {
                      const score = readiness[exam.cert];
                      return (
                        <li key={exam.cert}>
                          <div className="cs-top">
                            <span className="cs-id"><strong>{exam.label}</strong><small>{exam.name}</small></span>
                            <p className="cs-total"><strong>{score.total}</strong><small>/100</small></p>
                          </div>
                          <Meter value={score.total / 100} label={`${exam.label} readiness ${score.total} of 100`} />
                          <div className="cs-foot">
                            <ReadinessParts score={score} />
                            <span className="cs-date">{exam.date ? `${formatDate(exam.date)}${exam.days !== null && exam.days >= 0 ? `, in ${exam.days} ${exam.days === 1 ? 'day' : 'days'}` : ''}` : 'No exam date set'}</span>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                  <p className="hint cs-note">Each score adds evidence out of 100: coverage 30, documents 35, judgment 25 and recall 10. It guides you; it does not predict a pass.</p>

                  <details className="fold">
                    <summary className="row"><span className="row-text"><strong>Eligibility</strong><small>PMI and ISC2 decide</small></span><FoldMark /></summary>
                    <div className="fold-body">
                      <ul className="checklist">
                        <li><span className={pmpEligible ? 'tick is-done' : 'tick'} aria-hidden="true">{pmpEligible && <Check />}</span><span><strong>PMP</strong><small>{pmpEligible ? 'Baseline appears satisfied. Verify application evidence.' : `${profile.pm_months} of ${pmpNeeded} leadership months, ${profile.pm_training_hours} of 35 training hours`}</small></span></li>
                        <li><span className="tick is-done" aria-hidden="true"><Check /></span><span><strong>PL-300</strong><small>No experience requirement.</small></span></li>
                        <li><span className={cisspEligible ? 'tick is-done' : 'tick'} aria-hidden="true">{cisspEligible && <Check />}</span><span><strong>CISSP</strong><small>{cisspEligible ? 'Baseline appears satisfied. Verify domain evidence.' : `${profile.cyber_months} of ${cisspNeeded} months${cisspNeeded === 48 ? ' (degree waiver applied)' : ''}, ${profileDomains.length} of 2 domains. The Associate of ISC2 route remains open.`}</small></span></li>
                        <li><span className="tick is-done" aria-hidden="true"><Check /></span><span><strong>ITIL V5</strong><small>Entry credential: 40 questions, 60 minutes, 65% to pass.</small></span></li>
                      </ul>
                      <div className="inline-form">
                        <div><label className="field" htmlFor="itil-level">ITIL V5 level</label><select id="itil-level" value={itilLevelDraft} onChange={(event) => setItilLevelDraft(event.target.value)}><option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option></select></div>
                        <div><label className="field" htmlFor="itil-date">ITIL V5 exam date</label><input id="itil-date" type="date" value={itilTargetDraft} onChange={(event) => setItilTargetDraft(event.target.value)} /></div>
                        <button className="secondary" disabled={saving} onClick={saveItilBaseline}>Update</button>
                      </div>
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

      {focusOpen && timer && timerTask && (
        <FocusSession
          task={timerTask}
          index={timerIndex}
          timer={timer}
          elapsed={elapsedSeconds}
          links={workFor(timerTask)}
          artifactStatus={artifactStatus}
          saving={saving}
          onPause={togglePause}
          onMinimise={() => setFocusOpen(false)}
          onFinish={() => finishSession(timerTask)}
          onDiscard={() => { setTimer(null); setFocusOpen(false); }}
          onOpenWork={openWork}
          lesson={reading?.lessons[timerTask.key]}
        />
      )}

      {celebration && <Celebrate celebration={celebration} programmeDone={programmeDone} onDone={() => setCelebration(null)} />}

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

function Celebrate({ celebration, programmeDone, onDone }: { celebration: Celebration; programmeDone: number; onDone: () => void }) {
  const done = useRef<HTMLButtonElement>(null);
  useOverlayFocus(done, ['.hero-session .play', '.hero-session .hero-lesson', '#main']);
  return (
    <div className="celebrate" role="dialog" aria-modal="true" aria-labelledby="celebrate-title">
      <div className="celebrate-inner">
        <span className="celebrate-badge" aria-hidden="true"><Check /></span>
        <h2 id="celebrate-title">{celebration.weekDone === 5 ? `Week ${celebration.week} complete` : 'Session complete'}</h2>
        <p>Week {celebration.week}, {celebration.task.day}: {celebration.task.title}</p>
        <dl className="celebrate-stats">
          <div><dt>Studied</dt><dd>{celebration.minutes ? formatMinutes(celebration.minutes) : 'Not timed'}</dd></div>
          <div><dt>This week</dt><dd>{celebration.weekDone} of 5</dd><Pips done={celebration.weekDone} /></div>
          <div><dt>Programme</dt><dd>{programmeDone} of {allTasks.length}</dd></div>
        </dl>
        <button ref={done} className="primary wide" onClick={onDone}>Done</button>
      </div>
    </div>
  );
}

/* ==========================================================================
   Learn: everything to read, inside the app.
   ========================================================================== */

/* The 65 lessons live with their sessions on Plan and Today. Learn holds
   the rest of the library. */
const learnTabs: Array<[LearnTab, string]> = [['documents', 'Documents'], ['exams', 'Exams'], ['glossary', 'Glossary']];

function LearnView({ tab: chosenTab, item, lessonFrom, onLeaveLesson, onTab, onItem, completed, documents, onStart, onOpenDoc }: {
  tab: LearnTab; item: string | null; lessonFrom: 'today' | 'plan'; onLeaveLesson: () => void; onTab: (tab: LearnTab) => void; onItem: (item: string | null) => void;
  completed: Set<string>; documents: ReactNode;
  onStart: (task: StudyTask) => void; onOpenDoc: (item: Deliverable) => void;
}) {
  const [query, setQuery] = useState('');
  const [termCert, setTermCert] = useState<Certification | 'General' | 'All'>('All');
  const reading = useReading();
  const lessons = reading?.lessons;
  const backLabel = lessonFrom === 'plan' ? 'Plan' : 'Today';
  if (item && chosenTab === 'lessons' && !reading) {
    return <div className="reader"><button className="back" onClick={onLeaveLesson}><Chevron dir="left" /> {backLabel}</button><p className="hint loading-note">Opening the reading</p></div>;
  }
  const tab: LearnTab = chosenTab === 'lessons' && !(item && lessons?.[item]) ? 'documents' : chosenTab;

  if (tab === 'lessons' && item && lessons?.[item]) {
    const index = allTasks.findIndex((task) => task.key === item);
    const task = allTasks[index];
    const prev = allTasks[index - 1];
    const next = allTasks[index + 1];
    const week = Math.floor(index / 5) + 1;
    return (
      <div className="reader-layout">
        <article className="reader" aria-labelledby="reader-title">
          <button className="back" onClick={onLeaveLesson}><Chevron dir="left" /> {backLabel}</button>
          <header className="reader-head">
            <p className="eyebrow">Week {week}, {task.day}{completed.has(task.key) ? ', done' : ''}</p>
            <h1 id="reader-title">{keepTogether(task.title)}</h1>
            <p className="reader-meta">{task.certifications.map((cert) => <Tag key={cert}>{examLabel(cert)}</Tag>)}<span className="meta-time">{formatMinutes(taskMinutes(task.meta))}</span></p>
          </header>
          <LessonBody lesson={lessons[item]} task={task} onOpenDoc={onOpenDoc} idPrefix="ls" />
          <div className="reader-actions">
            {!completed.has(task.key) && <button className="primary" onClick={() => onStart(task)}><svg className="play-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z" fill="currentColor" /></svg>Start this session</button>}
            {task.docs.map((key) => allDeliverables.find((entry) => entry.key === key)).filter((entry): entry is Deliverable => Boolean(entry)).map((entry) => <button key={entry.key} className="secondary" onClick={() => onOpenDoc(entry)}>Write {lowerFirst(entry.title)}</button>)}
          </div>
          <nav className="reader-nav" aria-label="Other lessons">
            {prev && lessonIndex[prev.key] ? <button onClick={() => onItem(prev.key)}><small><Chevron dir="left" /> Previous</small><span>{prev.title}</span></button> : <span />}
            {next && lessonIndex[next.key] ? <button className="next" onClick={() => onItem(next.key)}><small>Next <Chevron dir="right" /></small><span>{next.title}</span></button> : <span />}
          </nav>
        </article>
        <LessonToc key={item} lesson={lessons[item]} idPrefix="ls" />
      </div>
    );
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

  return (
    <div className="learn">
      <header className="screen-head">
        <h1>Learn</h1>
        <p className="lede">The {Object.keys(guideIndex).length} project documents with finished examples, the {countWord(examGuides.length).toLowerCase()} exam guides and {glossary.length} terms. Each session’s lesson opens from Plan.</p>
      </header>
      <div className="segmented" role="tablist" aria-label="Learn sections">
        {learnTabs.map(([key, label]) => <button key={key} role="tab" aria-selected={tab === key} className={tab === key ? 'active' : ''} onClick={() => onTab(key)}>{label}</button>)}
      </div>

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

function LessonBody({ lesson, task, onOpenDoc, idPrefix }: { lesson: Lesson; task: StudyTask; onOpenDoc?: (item: Deliverable) => void; idPrefix: string }) {
  const docs = task.docs.map((key) => allDeliverables.find((entry) => entry.key === key)).filter((entry): entry is Deliverable => Boolean(entry));
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
      <section aria-label="On the exam" id={id('exam')}>
        <h3>On the exam</h3>
        <ul className="tips">{lesson.examTips.map((tip) => <li key={tip.tip}><Tag>{examLabel(tip.cert)}</Tag><p>{keepTogether(tip.tip)}</p></li>)}</ul>
      </section>
      <section aria-label="Watch out for" id={id('watch')}>
        <h3>Watch out for</h3>
        <ul className="pitfalls">{lesson.pitfalls.map((pitfall) => <li key={pitfall}>{keepTogether(pitfall)}</li>)}</ul>
      </section>
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

function BookIcon() {
  return <svg className="book-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 6.5C10 5 7 4.5 3.5 5v13c3.5-.5 6.5 0 8.5 1.5 2-1.5 5-2 8.5-1.5V5C17 4.5 14 5 12 6.5zM12 6.5v13" /></svg>;
}

/* ==========================================================================
   Focus session: full screen, one thing to do.
   ========================================================================== */

function FocusSession({ task, index, timer, elapsed, links, artifactStatus, saving, onPause, onMinimise, onFinish, onDiscard, onOpenWork, lesson }: {
  task: StudyTask; index: number; timer: Timer; elapsed: number; links: WorkLink[]; artifactStatus: (key: string) => string | undefined; saving: boolean;
  onPause: () => void; onMinimise: () => void; onFinish: () => void; onDiscard: () => void; onOpenWork: (link: WorkLink) => void; lesson?: Lesson;
}) {
  const [reading, setReading] = useState(false);
  const dialog = useRef<HTMLDivElement>(null);
  useOverlayFocus(dialog, ['#main'], reading);
  const planned = taskMinutes(task.meta) * 60;
  const fraction = Math.min(1, elapsed / planned);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') { if (reading) setReading(false); else onMinimise(); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onMinimise, reading]);
  if (reading && lesson) {
    return (
      <div ref={dialog} tabIndex={-1} className="focus focus-reading" role="dialog" aria-modal="true" aria-labelledby="focus-lesson-title">
        <header className="focus-bar">
          <button className="ghost" onClick={() => setReading(false)}><Chevron dir="left" /> Timer</button>
          <span className={timer.pausedAt ? 'focus-mini paused' : 'focus-mini'}><span className="live-dot" aria-hidden="true" /><Digits value={formatClock(elapsed)} /></span>
        </header>
        <div className="focus-read">
          <p className="eyebrow">Week {Math.floor(index / 5) + 1}, {task.day} lesson</p>
          <h2 id="focus-lesson-title">{keepTogether(task.title)}</h2>
          <LessonBody lesson={lesson} task={task} onOpenDoc={(item) => onOpenWork({ kind: 'artifact', item })} idPrefix="fl" />
          <button className="primary wide" onClick={() => setReading(false)}>Back to the timer</button>
        </div>
      </div>
    );
  }
  return (
    <div ref={dialog} tabIndex={-1} className={timer.pausedAt ? 'focus is-paused' : 'focus'} role="dialog" aria-modal="true" aria-labelledby="focus-title">
      <header className="focus-bar">
        <span className="focus-where"><span className="live-dot" aria-hidden="true" />Week {Math.floor(index / 5) + 1}, {task.day}</span>
        <button className="ghost" onClick={onMinimise}>Minimise</button>
      </header>
      <div className="focus-body">
        <div className="focus-top">
          <p className="focus-state">{timer.pausedAt ? 'Paused' : 'In session'}</p>
          <div className="focus-clock">
            <span className="clock"><Digits value={formatClock(elapsed)} /></span>
          </div>
          <div className="focus-meter">
            <Meter value={fraction} label={`${Math.round(fraction * 100)}% of the planned time`} />
            <span className="of">of {formatMinutes(planned / 60)}</span>
          </div>
        </div>
        <h2 id="focus-title">{keepTogether(task.title)}</h2>
        <p className="focus-explain">{keepTogether(lesson?.summary || plainTaskExplanation(task.title))}</p>
        <p className="focus-output"><span>Finish with</span> {taskOutput(task.meta).toLowerCase()}</p>
        {lesson && <button className="focus-lesson" onClick={() => setReading(true)}><BookIcon /> Read the lesson</button>}
        {links.length > 0 && (
          <ul className="focus-work">
            {links.map((link) => (
              <li key={workKey(link)}>
                <button onClick={() => onOpenWork(link)}>
                  <span className="fw-kind">{link.kind === 'artifact' ? docNumberFor(link.item) : link.kind === 'lab' ? 'Lab' : 'Practice'}</span>
                  <span className="fw-name">{link.kind === 'artifact' ? link.item.title : link.kind === 'lab' ? link.lab.title : 'Scenario practice'}</span>
                  <span className="fw-status">{link.kind === 'artifact' && <DocStatus status={artifactStatus(link.item.key)} />}</span>
                  <Chevron dir="right" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <footer className="focus-actions">
        <button className="round" onClick={onPause} aria-label={timer.pausedAt ? 'Resume timer' : 'Pause timer'}>
          {timer.pausedAt ? <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z" fill="currentColor" /></svg> : <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5h3v14H8zM13 5h3v14h-3z" fill="currentColor" /></svg>}
        </button>
        <button className="finish" onClick={onFinish} disabled={saving}>Finish session</button>
        <button className="ghost" onClick={onDiscard}>Discard timer</button>
      </footer>
    </div>
  );
}

/* ==========================================================================
   Quiz run: one question per screen. The verdict appears under the answers
   and the next step stays in reach at the bottom.
   ========================================================================== */

function QuizRun({ run, saving, seconds, timerChip, onAnswer, onNext, onClose }: {
  run: Run; saving: boolean; seconds: number | null; timerChip?: ReactNode; onAnswer: (question: ScenarioQuestion, choice: string, confidence: string) => Promise<boolean>; onNext: () => void; onClose: () => void;
}) {
  const question = run.questions[run.index];
  const [choice, setChoice] = useState('');
  const [confidence, setConfidence] = useState('medium');
  const [submitted, setSubmitted] = useState(false);
  const correct = choice === question.correct;
  async function check() {
    if (!choice || submitted || saving) return;
    if (await onAnswer(question, choice, confidence)) setSubmitted(true);
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
          {seconds !== null ? <span className={seconds < 60 ? 'quiz-time low' : 'quiz-time'}><Digits value={formatClock(seconds)} /></span> : <span className="quiz-count">{run.index + 1}/{run.questions.length}</span>}
          {timerChip}
        </span>
      </header>
      <div className="quiz-body">
        <p className="quiz-run">{run.kind === 'artifact' ? `Check yourself: ${run.title}` : run.title}</p>
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
        {!submitted && (
          <fieldset className="sure">
            <legend>How sure are you?</legend>
            <div className="sure-options">
              {(['low', 'medium', 'high'] as const).map((level) => <label key={level} className={confidence === level ? 'active' : ''}><input type="radio" name={`c-${question.id}`} value={level} checked={confidence === level} onChange={() => setConfidence(level)} />{level === 'low' ? 'Guessing' : level === 'medium' ? 'Fairly sure' : 'Certain'}</label>)}
            </div>
          </fieldset>
        )}
        {submitted && (
          <section id="verdict" className={correct ? 'sheet is-right' : 'sheet is-wrong'} role="status">
            <strong className="sheet-title"><span className="sheet-icon" aria-hidden="true">{correct ? <Check /> : '×'}</span>{correct ? 'Sound decision' : `The best answer is ${question.correct}`}</strong>
            <p>{keepTogether(correct ? question.explanation : `${question.incorrect[choice] || 'This option does not address the governing issue.'} ${question.explanation}`)}</p>
            <p className="sheet-link">Taught in: {allDeliverables.find((item) => item.key === question.artifactKey)?.title || 'Integrated decision record'}</p>
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
   Onboarding: five short steps.
   ========================================================================== */

const onboardingSteps = ['You', 'Leadership', 'Security', 'Skills', 'Dates'];

function Onboarding({ notice, saving, onSubmit }: { notice: Notice; saving: boolean; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  const [step, setStep] = useState(0);
  const last = step === onboardingSteps.length - 1;
  return (
    <main className="onboard">
      <section className="onboard-intro">
        <div className="brand"><BrandMark /><span className="brand-name">TriCert Lab</span></div>
        <div className="onboard-pitch">
          <h1><span>Four certifications.</span> <span>Thirteen weeks.</span> <span>One session at a time.</span></h1>
          <p className="onboard-note">You build one fictional programme, Project Beacon, and every session teaches the exams through it. Each bar below is a week of five sessions. The marked weeks are your exam gates.</p>
          <p className="onboard-short">Build one fictional programme, Project Beacon, and learn all four exams through it.</p>
          <WeekTrack weeks={[5, 5, 5, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0]} current={4} />
          <ul className="onboard-certs">{certs.map((item) => <li key={item.cert}><strong>{item.label}</strong><span>{item.name}</span></li>)}</ul>
        </div>
      </section>
      <section className="onboard-form" aria-labelledby="setup-title">
        <div className="steps-bar" aria-hidden="true">{onboardingSteps.map((name, index) => <span key={name} className={index <= step ? 'on' : ''} />)}</div>
        <p className="eyebrow">Step {step + 1} of {onboardingSteps.length}</p>
        <h2 id="setup-title">{['About you', 'Your project leadership', 'Your security experience', 'Your skills and time', 'Your exam dates'][step]}</h2>
        <p className="lede">{['This is your plan. Tell it who it is for and why you are doing it. You can change both later.', 'PMP needs project leadership within the last 10 years: 36 months with a bachelor’s degree, 48 with an associate’s, 60 with secondary school, or 24 with a GAC-accredited degree. Plus 35 training hours, or an active CAPM.', 'CISSP needs five years of paid work across at least two of its eight domains. A four-year degree or an approved credential waives one year. With less, passing earns the Associate of ISC2.', 'This sets how hard practice pushes. The plan averages about 14 hours of sessions a week.', 'Optional. Dates drive your countdowns. PL-300 and ITIL fall in week 6, PMP in week 10, CISSP in week 13.'][step]}</p>
        <form onSubmit={(event) => { if (!last) { event.preventDefault(); setStep(step + 1); return; } onSubmit(event); }}>
          <fieldset hidden={step !== 0}>
            <legend className="sr-only">About you</legend>
            <div className="form-grid">
              <div className="wide"><label className="field" htmlFor="displayName">What should we call you?</label><input id="displayName" name="displayName" autoComplete="given-name" maxLength={40} placeholder="Your first name" /></div>
              <div className="wide"><label className="field" htmlFor="motivation">Why are you doing this?</label><textarea id="motivation" name="motivation" className="short" maxLength={140} placeholder="One line you will see on Today, for example: Move from support into programme work by next summer." /></div>
            </div>
          </fieldset>
          <fieldset hidden={step !== 1}>
            <legend className="sr-only">Project leadership</legend>
            <div className="form-grid">
              <div><label className="field" htmlFor="education">Highest education</label><select id="education" name="education" defaultValue="bachelor"><option value="secondary">Secondary school</option><option value="associate">Associate or vocational diploma</option><option value="bachelor">Bachelor’s or higher</option><option value="gac">PMI GAC-accredited degree</option></select></div>
              <div><label className="field" htmlFor="pmMonths">Months leading projects</label><input id="pmMonths" name="pmMonths" type="number" min="0" max="240" defaultValue="0" /></div>
              <div className="wide"><label className="field" htmlFor="projectsLed">Projects led in the past 10 years</label><textarea id="projectsLed" name="projectsLed" placeholder="One per line: project, dates, your role, outcome" /></div>
              <div><label className="field" htmlFor="pmTrainingHours">Training hours</label><input id="pmTrainingHours" name="pmTrainingHours" type="number" min="0" max="500" defaultValue="0" /></div>
              <label className="tickbox"><input name="pmTrainingComplete" type="checkbox" value="yes" /><span className="box" aria-hidden="true"><Check /></span><span>All 35 hours done</span></label>
            </div>
          </fieldset>
          <fieldset hidden={step !== 2}>
            <legend className="sr-only">Security experience</legend>
            <div className="form-grid">
              <div><label className="field" htmlFor="cyberMonths">Months of paid security work</label><input id="cyberMonths" name="cyberMonths" type="number" min="0" max="240" defaultValue="0" /></div>
            </div>
            <p className="field">Domains your work covered</p>
            <div className="chips">{cyberDomains.map((domain) => <label className="chip" key={domain}><input type="checkbox" name="cyberDomains" value={domain} /><span>{domain}</span></label>)}</div>
          </fieldset>
          <fieldset hidden={step !== 3}>
            <legend className="sr-only">Skills and time</legend>
            <div className="form-grid">
              <SkillSelect name="powerBiLevel" label="Power BI" />
              <SkillSelect name="powerQueryLevel" label="Power Query" />
              <SkillSelect name="daxLevel" label="DAX" />
              <SkillSelect name="sqlLevel" label="SQL" />
              <SkillSelect name="itilLevel" label="Service management" />
              <div><label className="field" htmlFor="weeklyHours">Hours a week</label><input id="weeklyHours" name="weeklyHours" type="number" min="1" max="60" defaultValue="18" /></div>
            </div>
          </fieldset>
          <fieldset hidden={step !== 4}>
            <legend className="sr-only">Exam dates</legend>
            <div className="form-grid">
              <div><label className="field" htmlFor="pl300Target">PL-300</label><input id="pl300Target" name="pl300Target" type="date" /></div>
              <div><label className="field" htmlFor="itilTarget">ITIL V5</label><input id="itilTarget" name="itilTarget" type="date" /></div>
              <div><label className="field" htmlFor="pmpTarget">PMP</label><input id="pmpTarget" name="pmpTarget" type="date" /></div>
              <div><label className="field" htmlFor="cisspTarget">CISSP</label><input id="cisspTarget" name="cisspTarget" type="date" /></div>
            </div>
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

function SkillSelect({ name, label }: { name: string; label: string }) {
  return <div><label className="field" htmlFor={name}>{label}</label><select id={name} name={name} defaultValue="beginner"><option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option></select></div>;
}

/* ==========================================================================
   Visual pieces
   ========================================================================== */

/* The 13 weeks as one row of bars, one per week of five sessions. Each bar
   fills as its sessions are done, and the three exam gates carry a small
   diamond under the bar. With onSelect each week is a button. On a phone the row wraps
   into seven and six so every week stays a full-size target. */
const trackGates: Record<number, string> = { 6: 'PL-300 and ITIL', 10: 'PMP', 13: 'CISSP' };

function WeekTrack({ weeks, selected, current, onSelect }: { weeks: number[]; selected?: number; current?: number; onSelect?: (week: number) => void }) {
  const total = weeks.reduce((sum, done) => sum + Math.min(5, done), 0);
  return (
    <div className={onSelect ? 'track track-interactive' : 'track track-static'} role={onSelect ? 'group' : 'img'} aria-label={onSelect ? 'Your 13 weeks' : `${total} of ${weeks.length * 5} sessions done${current ? `, week ${current} of ${weeks.length} in progress` : ''}. Exam gates in weeks 6, 10 and 13.`}>
      <ol className="track-row" aria-hidden={onSelect ? undefined : true}>
        {weeks.map((done, index) => {
          const week = index + 1;
          const gate = trackGates[week];
          const classes = [done >= 5 ? 'is-full' : done > 0 ? 'is-partial' : '', gate ? 'is-gate' : '', week === selected ? 'is-selected' : '', week === current ? 'is-current' : ''].filter(Boolean).join(' ');
          const inner = (
            <>
              <span className="track-num">{week}</span>
              <span className="track-bar"><span style={{ width: `${(Math.min(5, done) / 5) * 100}%` }} /></span>
              <span className="track-gate" aria-hidden="true">{gate && <span className="track-diamond" />}</span>
            </>
          );
          return (
            <li key={week}>
              {onSelect
                ? <button className={`track-week ${classes}`} onClick={() => onSelect(week)} aria-pressed={week === selected} aria-label={`Week ${week}: ${done} of 5 sessions done${gate ? `, ${gate} exam gate` : ''}`}>{inner}</button>
                : <span className={`track-cell ${classes}`}>{inner}</span>}
            </li>
          );
        })}
      </ol>
      <p className="track-legend" aria-hidden="true"><span className="track-diamond" /><span>Exam gates: week 6 <span className="nobr">PL-300</span> and <span className="nobr">ITIL V5</span>, week 10 PMP, week 13 CISSP</span></p>
    </div>
  );
}

/* Five short marks for the five sessions of a week. */
function Pips({ done }: { done: number }) {
  return <span className="pips" aria-hidden="true">{[0, 1, 2, 3, 4].map((index) => <i key={index} className={index < done ? 'on' : ''} />)}</span>;
}

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

function DayMark({ done, gate, running }: { done: boolean; gate: boolean; running: boolean }) {
  return (
    <span className={['day-mark', done ? 'is-done' : '', gate ? 'is-gate' : '', running ? 'is-running' : ''].filter(Boolean).join(' ')} aria-hidden="true">
      {done ? <Check /> : gate ? <span className="diamond" /> : null}
    </span>
  );
}

function Meter({ value, label }: { value: number; label?: string }) {
  return <span className="meter" role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}><span style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }} /></span>;
}

/* The four parts of a readiness score as plain numbers: coverage (30),
   documents (35), judgment (25) and recall (10). */
function ReadinessParts({ score }: { score: ScoreParts }) {
  const parts: Array<[string, number, number]> = [['Coverage', score.coverage, 30], ['Documents', score.evidence, 35], ['Judgment', score.judgment, 25], ['Recall', score.recall, 10]];
  return (
    <dl className="parts">
      {parts.map(([label, value, max]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd><strong>{Math.round(value)}</strong>/{max}</dd>
        </div>
      ))}
    </dl>
  );
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

function ReviewList({ queue, onOpen }: { queue: AttemptRow[]; onOpen: (key: string) => void }) {
  if (!queue.length) {
    return <section className="empty"><span className="empty-badge" aria-hidden="true"><Check /></span><h2>All clear</h2><p>Answers you get wrong or mark as a guess land here, linked to the document that teaches them.</p></section>;
  }
  return (
    <ul className="review-list">
      {queue.map((attempt) => {
        const cleanId = attempt.question_id.replace(/^mock-(PMP|PL-300|CISSP|ITIL)-/, '');
        const question = allArtifactQuestions.find((item) => item.id === cleanId) || allArtifactQuestions.find((item) => attempt.question_id.endsWith(item.id)) || scenarioBank.find((item) => item.id === cleanId);
        return (
          <li key={attempt.question_id}>
            <span className={attempt.correct ? 'flag is-guess' : 'flag'}>{attempt.correct ? 'Guessed' : 'Wrong'}</span>
            <strong>{keepTogether(question?.prompt || attempt.domain)}</strong>
            <p>{keepTogether(question?.explanation || 'Reopen the connected document and explain the governing concept without notes.')}</p>
            {question && <button className="text-link" onClick={() => onOpen(question.artifactKey)}>Open the document</button>}
          </li>
        );
      })}
    </ul>
  );
}

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

/* The five checks for the next exam gate. Scope is everything up to that
   gate: earlier sessions, documents in the releases so far, and practice
   for the gate's own exams. */
function gateResults(state: StudyState, completed: Set<string>, latestAttempts: AttemptRow[], phase: (typeof phases)[number]) {
  const gateCerts = phase.gate.certs;
  const releaseKeys = phases.slice(0, phases.indexOf(phase) + 1).map((item) => item.project);
  const scopeDocs = projects.filter((item) => releaseKeys.includes(item.key)).flatMap((item) => item.deliverables);
  const sessionsBefore = allTasks.slice(0, phase.gate.at);
  const sessionsDone = sessionsBefore.filter((task) => completed.has(task.key)).length;
  const completeKeys = new Set(state.artifacts.filter((item) => item.status === 'complete').map((item) => item.artifact_key));
  const docsDone = scopeDocs.filter((item) => completeKeys.has(item.key)).length;
  const explanations = state.artifacts.filter((item) => item.reflection.trim().length >= 80).length;
  const perCert = gateCerts.map((cert) => {
    const attempts = latestAttempts.filter((attempt) => attempt.certification === cert);
    const wrong = attempts.filter((attempt) => !attempt.correct).length;
    return { cert, mocks: strongMocks(state.artifacts, cert), attempts: attempts.length, wrong };
  });
  const openWrong = perCert.reduce((total, item) => total + item.wrong, 0);
  const label = (cert: Certification) => (cert === 'ITIL' ? 'ITIL V5' : cert);
  return [
    { title: 'Sessions before the gate done', met: sessionsDone === sessionsBefore.length, detail: `${sessionsDone} of ${sessionsBefore.length} sessions` },
    { title: 'Release documents complete', met: docsDone === scopeDocs.length, detail: `${docsDone} of ${scopeDocs.length} documents in Release ${releaseKeys.length === 1 ? '1' : `1 to ${releaseKeys.length}`}` },
    { title: 'Two timed sets at 80% or better', met: perCert.every((item) => item.mocks >= 2), detail: perCert.map((item) => `${label(item.cert)} ${Math.min(2, item.mocks)} of 2`).join(', ') },
    { title: 'No major weak area', met: perCert.every((item) => item.attempts >= 24 && item.wrong / Math.max(1, item.attempts) < 0.3), detail: perCert.map((item) => `${label(item.cert)} ${item.attempts} of 24 decisions, ${item.attempts ? Math.round((item.wrong / item.attempts) * 100) : 0}% wrong`).join('; ') },
    { title: 'Mistakes reviewed and explained', met: openWrong === 0 && explanations >= 6, detail: `${openWrong} wrong answers open, ${explanations} of 6 explanations` },
  ];
}

/* ==========================================================================
   Session-to-work mapping
   ========================================================================== */

function workFor(task: StudyTask): WorkLink[] {
  const title = task.title.toLowerCase();
  const links: WorkLink[] = task.docs
    .map((key) => allDeliverables.find((item) => item.key === key))
    .filter((item): item is Deliverable => Boolean(item))
    .slice(0, 2)
    .map((item) => ({ kind: 'artifact', item }));
  const lab = labCards.find((candidate) =>
    (candidate.key === 'lab-power-query' && /power query|profile/.test(title))
    || (candidate.key === 'lab-dax' && /measures|dax/.test(title))
    || (candidate.key === 'lab-ms-project' && /schedule|wbs/.test(title))
    || (candidate.key === 'lab-architecture' && /architecture|threat-model/.test(title))
    || (candidate.key === 'lab-sql' && /source-to-target|reconcil/.test(title))
    || (candidate.key === 'lab-itil-value-stream' && /value stream/.test(title)));
  if (lab) links.push({ kind: 'lab', lab });
  if (/mock|gate|practice|repair weak|people:|process:|business environment:/.test(title)) links.push({ kind: 'practice' });
  return links.slice(0, 3);
}

function workKey(link: WorkLink) { return link.kind === 'artifact' ? link.item.key : link.kind === 'lab' ? link.lab.key : 'practice'; }
function docNumberFor(item: Deliverable) {
  const owner = projects.find((candidate) => candidate.deliverables.some((artifact) => artifact.key === item.key));
  return owner ? docNumber(owner.key, owner.deliverables.findIndex((artifact) => artifact.key === item.key)) : 'Doc';
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
function countWord(value: number) { const words = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten']; return words[value] || String(value); }
function ratio(numerator: number, denominator: number) { return denominator ? Math.min(1, numerator / denominator) : 0; }
function safeDomains(value: string) { try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed : []; } catch { return []; } }
function strongMocks(artifacts: ArtifactRow[], cert?: Certification) { return artifacts.filter((artifact) => { if (!artifact.artifact_key.startsWith('mock-')) return false; try { const evidence = JSON.parse(artifact.evidence_text); return Number(evidence.score) >= 80 && (!cert || evidence.certification === cert); } catch { return false; } }).length; }
function mockArtifactKey(cert: Certification) { return `mock-${cert.toLowerCase().replace(/[^a-z0-9]/g, '')}-${Date.now()}`; }
function nowMs() { return Date.now(); }
function todayIso() { const date = new Date(); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }
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
function formatMinutes(minutes: number) {
  const whole = Math.round(minutes);
  const hours = Math.floor(whole / 60);
  const rest = whole % 60;
  return hours ? `${hours} h${rest ? ` ${rest} min` : ''}` : `${whole} min`;
}
function taskMinutes(meta: string) { const match = meta.match(/(\d+)\s*min/); return match ? Number(match[1]) : 60; }
function taskOutput(meta: string) { const parts = meta.split('·').map((part) => part.trim()).filter(Boolean); const rest = parts.slice(1).join(', '); return rest ? rest.charAt(0).toUpperCase() + rest.slice(1) : 'Session notes'; }
function statusLabel(status?: string) { return status === 'complete' ? 'Complete' : status === 'draft' ? 'Draft' : 'Not started'; }
function deriveCurrentWeek(progress: ProgressRow[]) {
  const done = new Set(progress.filter((row) => row.status === 'complete').map((row) => row.item_key));
  const week = studyWeeks.find((candidate) => candidate.tasks.some((task) => !done.has(task.key)));
  return week ? week.number : studyWeeks.length;
}
function scrollBehavior(): ScrollBehavior {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
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
function plainTaskExplanation(title: string) {
  const value = title.toLowerCase();
  if (value.includes('blueprint')) return 'Read how each exam is built and see where Beacon practises every domain.';
  if (value.includes('coverage review')) return 'Compare what you have studied against the exam outline and list the weakest domains first.';
  if (value.includes('profile') || value.includes('data quality')) return 'Inspect the source data and record quality problems before you trust any report or decision.';
  if (value.includes('business case')) return 'Explain why the project matters, compare options, and define the result the business should receive.';
  if (value.includes('charter')) return 'Agree on the purpose, scope, authority, key people, and definition of success.';
  if (value.includes('requirement')) return 'Translate stakeholder needs into clear statements that can be built, tested, and approved.';
  if (value.includes('interview')) return 'Plan who to ask, what to ask, and how you will record needs so nothing is lost between conversations.';
  if (value.includes('classify')) return 'Decide how sensitive each kind of data is, who owns it, and how long it is kept.';
  if (value.includes('gate') || value.includes('sit ')) return 'Check the five readiness checks on Progress. Book or sit the exam only if they are met; otherwise repair the weakest area.';
  if (value.includes('schedule') || value.includes('microsoft project') || value.includes('wbs')) return 'Put the work in order, show dependencies and owners, and set realistic dates in Microsoft Project.';
  if (value.includes('estimate') || value.includes('cost')) return 'Estimate effort and cost with a stated basis, and hold reserves for the risks you have identified.';
  if (value.includes('risk') || value.includes('raid')) return 'Record threats, issues, assumptions, decisions, and owners before they disrupt the work.';
  if (value.includes('power query')) return 'Build repeatable cleaning steps so the same data problems are fixed consistently every time.';
  if (value.includes('star schema') || value.includes('model') || value.includes('fact and dimension')) return 'Organize facts, descriptive tables, and relationships so analysis stays accurate and easy to use.';
  if (value.includes('date table') || value.includes('relationships')) return 'Create one marked date table and set relationship direction and cardinality on purpose.';
  if (value.includes('dax')) return 'Turn business definitions into measures that calculate results consistently.';
  if (value.includes('dashboard') || value.includes('report') || value.includes('pages')) return 'Create a focused view that helps someone understand the evidence and make a decision.';
  if (value.includes('segregation')) return 'Find permission combinations that let one person control a whole sensitive process, and decide how to break or watch them.';
  if (value.includes('iam') || value.includes('access') || value.includes('rbac') || value.includes('mfa') || value.includes('jml')) return 'Give people the access they need, prevent unnecessary access, and prove the controls work.';
  if (value.includes('uat') || value.includes('test') || value.includes('accessibility')) return 'Verify that the solution meets the need and behaves safely before it is accepted.';
  if (value.includes('mock') || value.includes('drill') || value.includes('scenario') || value.includes('practice')) return 'Practice choosing the best action under uncertainty, then explain why the other choices are weaker.';
  if (value.includes('incident') || value.includes('playbook') || value.includes('escalation')) return 'Decide the response roles, communication, and actions before a real incident creates pressure.';
  if (value.includes('bia') || value.includes('rto') || value.includes('rpo') || value.includes('recovery') || value.includes('dr plan')) return 'Prioritize important services and agree on how quickly systems and data must be restored.';
  if (value.includes('vendor') || value.includes('supplier') || value.includes('procurement')) return 'Evaluate a third party’s performance, value, and risk before relying on its service.';
  if (value.includes('communication') || value.includes('stakeholder') || value.includes('training')) return 'Match each audience to the message, channel, owner, and timing that will actually reach them.';
  if (value.includes('change')) return 'Walk a change through impact assessment, approval, and baseline update so nothing changes silently.';
  if (value.includes('threat') || value.includes('architecture') || value.includes('network') || value.includes('logging')) return 'Draw the trust boundaries and data flows, then choose controls for the threats that matter most.';
  if (value.includes('vulnerab')) return 'Rank flaws by exploitability, exposure, and business impact, then assign owners and dates.';
  if (value.includes('review') || value.includes('lesson') || value.includes('retrospective') || value.includes('improvement')) return 'Learn from the result, identify the next useful change, and decide how you will measure it.';
  if (value.includes('portfolio') || value.includes('publish')) return 'Assemble the evidence package from Progress, Portfolio and label every dataset as synthetic.';
  if (value.includes('governance') || value.includes('deployment') || value.includes('refresh')) return 'Decide who can release, refresh, and monitor the solution, and how to roll back safely.';
  return 'Complete the activity, save the result, and explain the decision in your own words.';
}
function downloadFile(name: string, content: string, type: string) { const url = URL.createObjectURL(new Blob([content], { type })); const link = document.createElement('a'); link.href = url; link.download = name; link.click(); URL.revokeObjectURL(url); }

const demoScript = `# Project Beacon portfolio demonstration\n\n## 0:00 to 0:30 · Problem\nKestrel Health Network (fictional) ran patient flow from emailed spreadsheets, clinicians waited days for access, and nobody had tested a restore of the clinical information system. All data in this case study is synthetic.\n\n## 0:30 to 1:30 · Release 1: trusted patient-flow analytics\nShow the data-quality findings, the star schema, the reconciliation to expected totals and the core measures. Explain why privacy and grain were settled before any visual.\n\n## 1:30 to 2:30 · Release 2: safe clinician access\nShow the role matrix, the RLS tests and the access-request value stream. Explain how least privilege, negative testing and service measures fit together.\n\n## 2:30 to 3:30 · Release 3: cyber resilience\nShow the security-operations dashboard and the restore tests. Explain how the business impact analysis set RTO and RPO and the recovery order.\n\n## 3:30 to 4:30 · Programme evidence\nShow the charter, schedule, RAID log, change decisions, earned value and service reviews. Name one trade-off and who accepted the remaining risk.\n\n## Close\nSummarize the measurable outcomes, the limits of the evidence and the next step.`;

const retroTemplate = `Decision I can now defend\n\nEvidence that changed my mind\n\nConcept I still cannot explain without notes\n\nError pattern from practice\n\nAdjustment for next week\n\nArtifact I will update`;
