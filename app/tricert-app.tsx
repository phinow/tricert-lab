'use client';

import { CSSProperties, FormEvent, ReactNode, useEffect, useId, useMemo, useState } from 'react';
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
type UiPrefs = { project?: string; artifact?: string; timer?: Timer | null; rubric?: Record<string, number[]>; theme?: Theme; accent?: Accent };
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

/* Each certification has one colour (dots, bars) and a darker ink for text. */
const certs: Array<{ cert: Certification; label: string; field: keyof Profile; color: string; ink: string; name: string }> = [
  { cert: 'PMP', label: 'PMP', field: 'pmp_target', color: 'var(--pmp)', ink: 'var(--pmp-ink)', name: 'Project management' },
  { cert: 'PL-300', label: 'PL-300', field: 'pl300_target', color: 'var(--pl300)', ink: 'var(--pl300-ink)', name: 'Power BI data analyst' },
  { cert: 'CISSP', label: 'CISSP', field: 'cissp_target', color: 'var(--cissp)', ink: 'var(--cissp-ink)', name: 'Information security' },
  { cert: 'ITIL', label: 'ITIL V5', field: 'itil_target', color: 'var(--itil)', ink: 'var(--itil-ink)', name: 'Service management' },
];
const certColor = (cert: string) => certs.find((item) => item.cert === cert)?.color || 'var(--text-2)';
const certVars = (cert: string) => {
  const found = certs.find((item) => item.cert === cert || (cert === 'ITIL V5' && item.cert === 'ITIL'));
  return { '--c': found?.color || 'var(--text-2)', '--ci': found?.ink || 'var(--text-2)' } as CSSProperties;
};

/* Personal colour choices, named for Alberta. */
const accents: Array<[Accent, string, string]> = [
  ['beacon', 'Beacon', '#ff6a1f'],
  ['rose', 'Wild rose', '#d6336c'],
  ['canola', 'Canola', '#f5c400'],
  ['glacier', 'Glacier', '#2ec4cf'],
];

const navItems: Array<[View, string]> = [
  ['today', 'Today'],
  ['plan', 'Plan'],
  ['learn', 'Learn'],
  ['projects', 'Project'],
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
  const [learnTab, setLearnTab] = useState<LearnTab>('lessons');
  const [learnItem, setLearnItem] = useState<string | null>(null);
  const [flashCert, setFlashCert] = useState<Certification | 'All'>('All');
  const [theme, setTheme] = useState<Theme>(() => (typeof window === 'undefined' ? 'system' : readPrefs().theme || 'system'));
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
        if (route) { setView(route.view); if (route.tab) setProgressTab(route.tab); }
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
      if (next) { setView(next.view); if (next.tab) setProgressTab(next.tab); }
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  useEffect(() => {
    if (!loading) writePrefs({ project: selectedProject, artifact: selectedArtifact, timer, rubric: rubricChecks, theme, accent });
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
  const retroSaved = state.artifacts.some((row) => row.artifact_key === `retrospective-w${selectedWeek}`);
  const draftArtifacts = state.artifacts
    .filter((row) => row.status === 'draft')
    .map((row) => allDeliverables.find((item) => item.key === row.artifact_key))
    .filter((item): item is Deliverable => Boolean(item));
  const timerTask = timer ? allTasks.find((task) => task.key === timer.key) : undefined;
  const timerIndex = timerTask ? allTasks.indexOf(timerTask) : -1;
  const elapsedSeconds = timer ? Math.max(0, ((timer.pausedAt ?? now) - timer.startedAt - timer.pausedTotal) / 1000) : 0;

  function say(text: string) { setNotice({ text, kind: 'success' }); }

  function go(next: View) {
    setView(next);
    if (next === 'projects') setDocOpen(false);
    if (next === 'practice' && practiceScreen !== 'run') setPracticeScreen('hub');
    const hash = next === 'progress' && progressTab === 'portfolio' ? 'portfolio' : next;
    if (window.location.hash !== `#${hash}`) window.history.pushState(null, '', `#${hash}`);
    window.scrollTo({ top: 0, behavior: scrollBehavior() });
  }

  function openLearn(tab: LearnTab, item: string | null = null) {
    setFocusOpen(false);
    setLearnTab(tab);
    setLearnItem(item);
    setView('learn');
    if (window.location.hash !== '#learn') window.history.pushState(null, '', '#learn');
    window.scrollTo({ top: 0, behavior: scrollBehavior() });
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
    await update({
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
    setReflectionOpen(false);
    const saved = state.artifacts.find((row) => row.artifact_key === `retrospective-w${bounded}`);
    setRetroText(saved?.evidence_text || retroTemplate);
  }

  function openSession(index: number) {
    showWeek(Math.floor(index / 5) + 1, index % 5);
    go('today');
  }

  function openWork(link: WorkLink) {
    setFocusOpen(false);
    if (link.kind === 'artifact') { setView('projects'); window.history.pushState(null, '', '#projects'); openArtifact(link.item); return; }
    if (link.kind === 'lab') { setPracticeScreen('labs'); setView('practice'); window.history.pushState(null, '', '#practice'); window.setTimeout(() => document.getElementById(`lab-${link.lab.key}`)?.scrollIntoView({ behavior: scrollBehavior(), block: 'start' }), 60); return; }
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
      artifactKey: `retrospective-w${selectedWeek}`,
      status: 'complete',
      evidenceText: retroText,
      reflection: `Week ${selectedWeek} teach-back and improvement commitment recorded.`,
    });
    if (saved) say(`Week ${selectedWeek} reflection saved.`);
  }

  if (loading) {
    return <main className="boot" aria-live="polite"><BrandMark size={64} /><p>Lighting your beacons</p></main>;
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

  const waiting: Array<{ title: string; detail: string; go: () => void }> = [];
  if (reviewQueue.length) waiting.push({ title: `Review ${reviewQueue.length} ${reviewQueue.length === 1 ? 'answer' : 'answers'}`, detail: 'Wrong or guessed', go: () => { setPracticeScreen('review'); setView('practice'); window.history.pushState(null, '', '#practice'); } });
  draftArtifacts.slice(0, 2).forEach((item) => waiting.push({ title: item.title, detail: `Draft, ${docNumberFor(item)}`, go: () => { setView('projects'); window.history.pushState(null, '', '#projects'); openArtifact(item); } }));

  return (
    <div className="app">
      <aside className="rail">
        <a className="brand" href="#today" onClick={(event) => { event.preventDefault(); go('today'); }}><BrandMark /><span className="brand-name">TriCert Lab</span></a>
        <nav className="nav" aria-label="Main navigation">
          {navItems.map(([key, label]) => (
            <button key={key} className={view === key ? 'active' : ''} aria-current={view === key ? 'page' : undefined} onClick={() => go(key)}>
              <NavIcon name={key} />
              <span className="nav-label">{label}</span>
              {key === 'practice' && reviewQueue.length > 0 && <span className="nav-badge" aria-label={`${reviewQueue.length} to review`}>{reviewQueue.length}</span>}
            </button>
          ))}
        </nav>
        {timer && timerTask && !focusOpen && (
          <button className="live-pill" onClick={() => { showWeek(Math.floor(timerIndex / 5) + 1, timerIndex % 5); setFocusOpen(true); }}>
            <span className={timer.pausedAt ? 'live-dot paused' : 'live-dot'} aria-hidden="true" />
            <span className="live-text"><span className="live-clock"><Digits value={formatClock(elapsedSeconds)} /></span><span className="live-name">{timer.pausedAt ? 'Paused' : 'In session'}</span></span>
          </button>
        )}
        <div className="rail-foot">
          {nextExam && <p className="rail-exam"><strong>{nextExam.days}</strong> {nextExam.days === 1 ? 'day' : 'days'} to {nextExam.label}</p>}
          <button className="me" onClick={() => setSettingsOpen(true)}>
            <span className="avatar" aria-hidden="true">{initials || <Flame size={18} />}</span>
            <span className="me-text"><strong>{firstName || 'You'}</strong><small>Make it yours</small></span>
          </button>
        </div>
      </aside>

      <main className={`stage view-${view}`} id="main">
        {notice && <div className={notice.kind === 'error' ? 'toast is-error' : 'toast'} role={notice.kind === 'error' ? 'alert' : 'status'}><span>{notice.text}</span><button onClick={() => setNotice(null)} aria-label="Dismiss message">×</button></div>}

        {view === 'today' && (
          <div className="today">
            <header className="hello">
              <div className="hello-text">
                <h1>{greeting}</h1>
                <p className="lede">{standing}</p>
                {profile.motivation
                  ? <p className="why">{profile.motivation}</p>
                  : <button className="text-link why-add" onClick={() => setSettingsOpen(true)}>Add why you are doing this</button>}
              </div>
              <button className="avatar-button" onClick={() => setSettingsOpen(true)} aria-label="Make it yours: your name, why, colour and appearance">
                <span className="avatar" aria-hidden="true">{initials || <Flame size={20} />}</span>
              </button>
            </header>

            <Ridge weeks={weeksDone} selected={selectedWeek} onSelect={(week) => showWeek(week)}>
              <span><strong>{programmeDone} of {allTasks.length}</strong> sessions done</span>
              {nextExam && <span>{nextExam.label} exam in {nextExam.days} {nextExam.days === 1 ? 'day' : 'days'}</span>}
            </Ridge>

            <section className="hero-session" aria-labelledby="session-title">
              <div className="hero-top">
                <span className="hero-when">Week {selectedWeek}, {activeTask.day}{gateAt.has(activeIndex) ? ', exam gate' : ''}</span>
                <span className="hero-certs">{activeTask.certifications.map((cert) => <span key={cert} className="cert-dot" style={certVars(cert)}>{cert === 'ITIL' ? 'ITIL V5' : cert}</span>)}</span>
              </div>
              <h2 id="session-title">{activeTask.title}</h2>
              <p className="hero-sub">{formatMinutes(taskMinutes(activeTask.meta))}. {taskOutput(activeTask.meta)}.</p>
              <div className="hero-actions">
                {completed.has(activeTask.key) ? (
                  <>
                    <span className="hero-done"><Check /> Done</span>
                    <button className="ghost" onClick={() => toggleProgress(activeTask.key)} disabled={saving}>Mark as not done</button>
                  </>
                ) : (
                  <>
                    <button className="primary play" onClick={() => startSession(activeTask)}>
                      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z" fill="currentColor" /></svg>
                      <span className="play-label">{timer?.key === activeTask.key ? <>Resume, <Digits value={formatClock(elapsedSeconds)} /></> : 'Start session'}</span>
                    </button>
                    <button className="ghost push" onClick={() => finishSession(activeTask)} disabled={saving}>Mark done</button>
                  </>
                )}
                {lessonIndex[activeTask.key] && <button className="secondary hero-lesson" onClick={() => openLearn('lessons', activeTask.key)}><BookIcon /> Read the lesson</button>}
              </div>
              <div className="week-strip" aria-label={`Week ${selectedWeek}`}>
                <div className="strip-head">
                  <button className="arrow" onClick={() => showWeek(selectedWeek - 1)} disabled={selectedWeek === 1} aria-label="Previous week"><Chevron dir="left" /></button>
                  <p className="strip-title"><strong>Week {selectedWeek}</strong> <span>{weekData.theme}</span></p>
                  <button className="arrow" onClick={() => showWeek(selectedWeek + 1)} disabled={selectedWeek === studyWeeks.length} aria-label="Next week"><Chevron dir="right" /></button>
                </div>
                <ol className="days">
                  {weekData.tasks.map((task, index) => {
                    const done = completed.has(task.key);
                    const gate = gateAt.has(sessionIndex(selectedWeek, index + 1));
                    return (
                      <li key={task.key}>
                        <button className={index === activeDay ? 'day is-active' : 'day'} onClick={() => setSelectedDay(index)} aria-pressed={index === activeDay} aria-label={`${task.day}: ${task.title}${done ? ', done' : ''}`}>
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
                <h2 id="waiting-title">Waiting on you</h2>
                <ul>{waiting.map((item) => <li key={item.title}><button onClick={item.go}><span><strong>{item.title}</strong><small>{item.detail}</small></span><Chevron dir="right" /></button></li>)}</ul>
              </section>
            )}

            <details id="reflection" className="reflect" open={reflectionOpen} onToggle={(event) => setReflectionOpen(event.currentTarget.open)}>
              <summary><span>Week {selectedWeek} reflection</span><small>{retroSaved ? 'Saved' : 'Not written'}</small></summary>
              <div className="reflect-body">
                <label className="field" htmlFor="retro">What can you now defend, what still needs notes, and what will you change?</label>
                <textarea id="retro" value={retroText} onChange={(event) => setRetroText(event.target.value)} />
                <div className="row">
                  <button className="primary" onClick={saveRetrospective} disabled={saving || retroText.trim().length < 100}>Save reflection</button>
                  <span className="hint">{retroText.trim().length < 100 ? `${100 - retroText.trim().length} more characters` : 'Ready'}</span>
                </div>
              </div>
            </details>
          </div>
        )}

        {view === 'plan' && (
          <div className="plan">
            <header className="screen-head">
              <h1>Plan</h1>
              <p className="lede">{programmeDone} of {allTasks.length} sessions done. Three releases of Project Beacon, each ending at an exam gate.</p>
            </header>
            <Ridge weeks={weeksDone} selected={expandedWeek || undefined} onSelect={(week) => { setExpandedWeek(week); window.setTimeout(() => document.getElementById(`week-${week}`)?.scrollIntoView({ behavior: scrollBehavior(), block: 'center' }), 30); }} />
            {phases.map((phase, phaseIndex) => {
              const phaseProject = projects.find((item) => item.key === phase.project) || projects[0];
              const weeks = studyWeeks.filter((week) => phaseFor(sessionIndex(week.number, 1)) === phase);
              const gateWeek = Math.floor(phase.gate.at / 5) + 1;
              const gateDay = (phase.gate.at % 5) + 1;
              return (
                <section className="phase" key={phase.project} aria-labelledby={`phase-${phase.project}`}>
                  <header className="phase-head">
                    <span className="phase-no">Release {phaseIndex + 1}</span>
                    <h2 id={`phase-${phase.project}`}>{phaseProject.title}</h2>
                  </header>
                  <ul className="weeks">
                    {weeks.map((week) => {
                      const done = week.tasks.filter((task) => completed.has(task.key)).length;
                      const open = expandedWeek === week.number;
                      return (
                        <li key={week.number} id={`week-${week.number}`} className={week.number === currentWeek ? 'is-current' : ''}>
                          <button className="week-row" aria-expanded={open} onClick={() => setExpandedWeek(open ? 0 : week.number)}>
                            <Embers done={done} />
                            <span className="week-text"><small>Week {week.number}{week.number === currentWeek ? ', this week' : ''}</small><strong>{week.theme}</strong></span>
                            <Chevron dir={open ? 'up' : 'down'} />
                          </button>
                          {open && (
                            <div className="week-detail">
                              <p>{week.outcome}</p>
                              <ol>
                                {week.tasks.map((task, index) => {
                                  const idx = sessionIndex(week.number, index + 1);
                                  return (
                                    <li key={task.key}>
                                      <button onClick={() => openSession(idx)}>
                                        <span className={completed.has(task.key) ? 'tick is-done' : gateAt.has(idx) ? 'tick is-gate' : 'tick'} aria-hidden="true">{completed.has(task.key) && <Check />}</span>
                                        <span className="wd-title">{task.title}</span>
                                        <span className="wd-time">{taskMinutes(task.meta)} min</span>
                                      </button>
                                    </li>
                                  );
                                })}
                              </ol>
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                  <div className="gate-card">
                    <Flame size={34} />
                    <div>
                      <small>Exam gate, week {gateWeek}, day {gateDay}</small>
                      <strong>{phase.gate.label}</strong>
                    </div>
                    <span className="gate-when">{phase.gate.certs.map((cert) => exams.find((exam) => exam.cert === cert)).filter((exam) => exam?.date).map((exam) => `${exam?.label} ${formatDate(exam?.date || '')}`).join(', ') || 'No date set'}</span>
                  </div>
                </section>
              );
            })}
            <details className="reference">
              <summary>How the four certifications connect</summary>
              <div className="reference-body">
                <div className="guide">{certificationGuide.map(([name, title, copy]) => <div key={name} style={certVars(name)}><span>{name === 'ITIL' ? 'ITIL V5' : name}</span><strong>{title}</strong><p>{copy}</p></div>)}</div>
                <div className="table-scroll"><table><thead><tr><th>Activity</th><th>PMP</th><th>PL-300</th><th>CISSP</th><th>ITIL V5</th></tr></thead><tbody>{coverageRows.map((row) => <tr key={row[0]}>{row.map((cell, index) => <td key={`${row[0]}-${index}`}>{cell}</td>)}</tr>)}</tbody></table></div>
                <p className="hint">Official exam guides: {officialSources.map(([label, url], index) => <span key={label}>{index > 0 && ', '}<a href={url} target="_blank" rel="noreferrer">{label}</a></span>)}</p>
              </div>
            </details>
          </div>
        )}

        {view === 'learn' && (
          <LearnView
            tab={learnTab}
            item={learnItem}
            onTab={(tab) => { setLearnTab(tab); setLearnItem(null); window.scrollTo({ top: 0 }); }}
            onItem={(item) => { setLearnItem(item); window.scrollTo({ top: 0 }); }}
            completed={completed}
            currentIndex={currentIndex}
            artifactStatus={artifactStatus}
            onStart={(task) => { showWeek(Math.floor(allTasks.indexOf(task) / 5) + 1, allTasks.indexOf(task) % 5); startSession(task); }}
            onOpenDoc={(item) => { setView('projects'); window.history.pushState(null, '', '#projects'); openArtifact(item); }}
          />
        )}

        {view === 'projects' && !docOpen && (
          <div className="projects">
            <header className="screen-head">
              <h1>Project Beacon</h1>
              <p className="lede">Your programme at Kestrel Health Network, a fictional Alberta health network. Every document you write here is part of it.</p>
            </header>
            <div className="project-cards" role="tablist" aria-label="Releases">
              {projects.map((item, index) => {
                const done = projectDone(item.key);
                return (
                  <button key={item.key} role="tab" aria-selected={item.key === project.key} className={item.key === project.key ? 'project-card active' : 'project-card'} onClick={() => chooseProject(item.key)}>
                    <span><small>Release {index + 1}</small><strong>{item.title}</strong></span>
                    <span className="project-meter"><Meter value={done / item.deliverables.length} /><small>{done} of {item.deliverables.length} documents</small></span>
                  </button>
                );
              })}
            </div>
            <p className="lede">{project.narrative}</p>
            <ul className="doc-list" aria-label={`${project.title} documents`}>
              {project.deliverables.map((item, index) => {
                const status = artifactStatus(item.key);
                return (
                  <li key={item.key}>
                    <button onClick={() => openArtifact(item)}>
                      <span className="doc-no">{docNumber(project.key, index)}</span>
                      <span className="doc-title"><strong>{item.title}</strong><small>{item.summary}</small></span>
                      <span className={`status status-${status || 'none'}`}>{statusLabel(status)}</span>
                      <Chevron dir="right" />
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {view === 'projects' && docOpen && (
          <article className="doc" aria-labelledby="doc-title">
            <button className="back" onClick={() => setDocOpen(false)}><Chevron dir="left" /> {project.title}</button>
            <header className="doc-head">
              <p className="eyebrow-date">{docNumber(project.key, deliverableIndex)}, {statusLabel(deliverableStatus).toLowerCase()}</p>
              <h1 id="doc-title">{deliverable.title}</h1>
              <p className="lede">{deliverable.summary}</p>
            </header>
            {reading?.docGuides[deliverable.key] ? (
              <>
                <details className="brief guide-fold" open={!deliverableStatus}>
                  <summary><span>How to write it</span><small>{reading.docGuides[deliverable.key].sections.length} sections</small></summary>
                  <GuideBody guide={reading.docGuides[deliverable.key]} showModel={false} />
                </details>
                <details className="brief guide-fold finished-fold">
                  <summary><span>See the finished example</span><small>Kestrel model</small></summary>
                  <div className="lesson"><RichText text={reading.docGuides[deliverable.key].modelDocument} /></div>
                </details>
              </>
            ) : guideIndex[deliverable.key] ? <p className="hint loading-note">Loading the writing guide</p> : null}
            <details className="brief done-when">
              <summary><span>Done when</span><small>{ticked.size} of {deliverable.rubric.length} checked</small></summary>
              <ul className="rubric">
                {deliverable.rubric.map((item, index) => (
                  <li key={item}><label><input type="checkbox" checked={ticked.has(index)} onChange={() => toggleRubric(index)} /><span className="box" aria-hidden="true"><Check /></span><span>{item}</span></label></li>
                ))}
              </ul>
              <p className="hint">{deliverable.why}</p>
              <div className="ideas">{deliverable.concepts.map((concept) => <details key={concept}><summary>{concept}</summary><p>{conceptGlossary[concept] || 'A core idea that connects this document to the exams.'}</p></details>)}</div>
            </details>
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
            <button className="check-yourself" onClick={startArtifactCheck}>
              <span><strong>Check yourself</strong><small>Five decisions about this document</small></span>
              <Chevron dir="right" />
            </button>
          </article>
        )}

        {view === 'practice' && practiceScreen === 'hub' && (
          <div className="practice">
            <header className="screen-head">
              <h1>Practice</h1>
              <p className="lede">{latestAttempts.length} decisions recorded so far.</p>
            </header>
            <div className="tiles">
              <button className="tile tile-scenarios" onClick={startScenarios}>
                <TileArt kind="scenarios" />
                <span className="tile-text"><strong>Scenarios</strong><small>{practiceBank.length} decisions, at your pace</small></span>
              </button>
              <div className="tile tile-timed">
                <TileArt kind="timed" />
                <span className="tile-text"><strong>Timed set</strong><small>{timedQuestions(mockCert).length} {mockCert} questions, 15 minutes</small></span>
                <div className="tile-controls">
                  <label className="sr-only" htmlFor="lens">Exam lens</label>
                  <select id="lens" value={mockCert} onChange={(event) => setMockCert(event.target.value as Certification)}><option>PMP</option><option>PL-300</option><option>CISSP</option><option>ITIL</option></select>
                  <button className="primary" onClick={startTimed}>Start</button>
                </div>
              </div>
              <button className="tile tile-review" onClick={() => setPracticeScreen('review')}>
                <TileArt kind="review" />
                <span className="tile-text"><strong>Review</strong><small>{reviewQueue.length ? `${reviewQueue.length} waiting` : 'All clear'}</small></span>
              </button>
              <button className="tile tile-cards" onClick={() => { setFlashRevealed(false); setPracticeScreen('flashcards'); }}>
                <TileArt kind="cards" />
                <span className="tile-text"><strong>Flashcards</strong><small>{allFlashcards.length} cards</small></span>
              </button>
              <button className="tile tile-labs" onClick={() => setPracticeScreen('labs')}>
                <TileArt kind="labs" />
                <span className="tile-text"><strong>Labs</strong><small>{labCards.filter((lab) => completed.has(lab.key)).length} of {labCards.length} done, with datasets</small></span>
              </button>
            </div>
          </div>
        )}

        {view === 'practice' && practiceScreen === 'run' && run && (
          <QuizRun
            key={`${run.kind}-${run.questions[run.index].id}-${run.index}`}
            run={run}
            saving={saving}
            seconds={run.kind === 'timed' ? mockSeconds : null}
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
              <div className="pills" role="group" aria-label="Deck">
                {(['All', 'PMP', 'PL-300', 'CISSP', 'ITIL'] as const).map((cert) => (
                  <button key={cert} className={flashCert === cert ? 'pill active' : 'pill'} aria-pressed={flashCert === cert} style={cert === 'All' ? undefined : certVars(cert)} onClick={() => { setFlashCert(cert); setFlashIndex(0); setFlashRevealed(false); }}>{cert === 'ITIL' ? 'ITIL V5' : cert}</button>
                ))}
              </div>
              <div className="flash-progress" aria-hidden="true"><span style={{ width: `${((index + 1) / deck.length) * 100}%` }} /></div>
              <button className={flashRevealed ? 'flash-card revealed' : 'flash-card'} onClick={() => setFlashRevealed(!flashRevealed)} style={certVars(card[0])} aria-label={flashRevealed ? 'Hide answer' : 'Show answer'}>
                <span className="flash-cert">{card[0] === 'Intersection' ? 'All four' : card[0]}, card {index + 1} of {deck.length}</span>
                <span className="flash-q">{card[1]}</span>
                {flashRevealed ? <span className="flash-a">{card[2]}</span> : <span className="flash-hint">Tap to reveal</span>}
              </button>
              <div className="row spread">
                <button className="secondary" onClick={() => move(-1)}>Previous</button>
                <button className="primary" onClick={() => move(1)}>Next card</button>
              </div>
            </div>
          );
        })()}

        {view === 'practice' && practiceScreen === 'labs' && (
          <div className="labs-screen">
            <button className="back" onClick={() => setPracticeScreen('hub')}><Chevron dir="left" /> Practice</button>
            <header className="screen-head"><h1>Labs</h1></header>
            <div className="labs">
              {labCards.map((lab) => (
                <section className="lab" key={lab.key} id={`lab-${lab.key}`} aria-labelledby={`lab-title-${lab.key}`}>
                  <div className="lab-top">
                    <span className="lab-certs">{lab.certification.split(' · ').map((cert) => <span key={cert} className="cert-dot" style={certVars(cert === 'ITIL V5' ? 'ITIL' : cert)}>{cert}</span>)}</span>
                    {completed.has(lab.key) && <span className="hero-done small"><Check /> Done</span>}
                  </div>
                  <h2 id={`lab-title-${lab.key}`}>{lab.title}</h2>
                  <p className="hint">{lab.brief}</p>
                  <ol className="steps">{lab.steps.map((step) => <li key={step}>{step}</li>)}</ol>
                  <div className="row">
                    <a className="secondary" href={lab.download} download>Download file</a>
                    <button className={completed.has(lab.key) ? 'ghost' : 'primary'} onClick={() => toggleProgress(lab.key)} disabled={saving}>{completed.has(lab.key) ? 'Mark as not done' : 'Mark done'}</button>
                  </div>
                </section>
              ))}
            </div>
            <DatasetLibrary />
          </div>
        )}

        {view === 'practice' && practiceScreen === 'review' && (
          <div className="review">
            <button className="back" onClick={() => setPracticeScreen('hub')}><Chevron dir="left" /> Practice</button>
            <header className="screen-head"><h1>Review</h1></header>
            <ReviewList attempts={wrongAnswers} queue={reviewQueue} onOpen={(key) => {
              const found = allDeliverables.find((item) => item.key === key);
              if (found) { setView('projects'); window.history.pushState(null, '', '#projects'); openArtifact(found); }
            }} />
          </div>
        )}

        {view === 'progress' && (
          <div className="progress">
            <header className="screen-head">
              <h1>Progress</h1>
              <p className="lede">Each exam has 100 points of evidence: coverage (30), documents (35), judgment (25) and recall (10). It guides you; it does not predict a pass.</p>
            </header>
            <div className="segmented" role="tablist" aria-label="Progress sections">
              <button role="tab" aria-selected={progressTab === 'readiness'} className={progressTab === 'readiness' ? 'active' : ''} onClick={() => { setProgressTab('readiness'); window.history.replaceState(null, '', '#progress'); }}>Readiness</button>
              <button role="tab" aria-selected={progressTab === 'portfolio'} className={progressTab === 'portfolio' ? 'active' : ''} onClick={() => { setProgressTab('portfolio'); window.history.replaceState(null, '', '#portfolio'); }}>Portfolio</button>
            </div>

            {progressTab === 'readiness' && (
              <>
                <ul className="cert-scores">
                  {exams.map((exam) => {
                    const score = readiness[exam.cert];
                    return (
                      <li key={exam.cert} style={certVars(exam.cert)}>
                        <div className="cs-head">
                          <span><strong>{exam.label}</strong><small>{exam.name}</small></span>
                          <span className="cs-total">{score.total}<small>/100</small></span>
                        </div>
                        <Meter value={score.total / 100} label={`${exam.label} readiness ${score.total} of 100`} />
                        <div className="parts">
                          <Part label="Coverage" value={score.coverage} max={30} />
                          <Part label="Documents" value={score.evidence} max={35} />
                          <Part label="Judgment" value={score.judgment} max={25} />
                          <Part label="Recall" value={score.recall} max={10} />
                        </div>
                        <p className="cs-date">{exam.date ? `Exam ${formatDate(exam.date)}${exam.days !== null && exam.days >= 0 ? `, in ${exam.days} days` : ''}` : 'No exam date set'}</p>
                      </li>
                    );
                  })}
                </ul>
                <section className="card-block" aria-labelledby="gates-title">
                  <h2 id="gates-title">Before you book {nextPhase.gate.label}</h2>
                  <p className="hint">{gates.filter((gate) => gate.met).length} of {gates.length} checks met. Completion alone does not make you ready.</p>
                  <ul className="checklist">{gates.map((gate) => <li key={gate.title}><span className={gate.met ? 'tick is-done' : 'tick'} aria-hidden="true">{gate.met && <Check />}</span><span><strong>{gate.title}</strong><small>{gate.detail}</small></span></li>)}</ul>
                </section>
                <details className="card-block fold" >
                  <summary><span>Eligibility</span><small>PMI and ISC2 decide</small></summary>
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
                </details>
              </>
            )}

            {progressTab === 'portfolio' && (
              <>
                <section className="card-block" aria-labelledby="package-title">
                  <h2 id="package-title">Handover package</h2>
                  <p className="hint">{portfolioChecklist.filter(([key]) => completed.has(key)).length} of {portfolioChecklist.length} ready. Tap an item when it is done.</p>
                  <ul className="checklist interactive">
                    {portfolioChecklist.map(([key, title, detail]) => (
                      <li key={key}><button aria-pressed={completed.has(key)} onClick={() => toggleProgress(key)} disabled={saving}><span className={completed.has(key) ? 'tick is-done' : 'tick'} aria-hidden="true">{completed.has(key) && <Check />}</span><span><strong>{title}</strong><small>{detail}</small></span></button></li>
                    ))}
                  </ul>
                </section>
                <section className="card-block" aria-labelledby="demo-title">
                  <h2 id="demo-title">Demo script, 3 to 5 minutes</h2>
                  <ol className="steps"><li>State the disconnected-reporting problem.</li><li>Show the governed data model and quality evidence.</li><li>Explain one IAM and one resilience decision.</li><li>Demonstrate role-aware reporting and tests.</li><li>Close with value, trade-offs, and next action.</li></ol>
                  <button className="secondary" onClick={() => downloadFile('tricert-demo-script.md', demoScript, 'text/markdown')}>Download script</button>
                </section>
                <section className="card-block" aria-labelledby="disclosure-title">
                  <h2 id="disclosure-title">Required disclosure</h2>
                  <blockquote>{disclosure}</blockquote>
                  <button className="secondary" onClick={() => navigator.clipboard.writeText(disclosure).then(() => say('Disclosure copied.'), () => setNotice({ text: 'Copy is blocked here. Select the text and copy it instead.', kind: 'error' }))}>Copy disclosure</button>
                </section>
                <section className="card-block logo-block" aria-labelledby="logo-title">
                  <h2 id="logo-title">Logo</h2>
                  <div className="logo-preview"><img src="/tricert-lab-logo.png" alt="TriCert Lab logo" /></div>
                  <a className="secondary" href="/tricert-lab-logo.png" download="tricert-lab-logo.png">Download PNG</a>
                </section>
              </>
            )}
          </div>
        )}
      </main>

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

      {celebration && (
        <div className="celebrate" role="dialog" aria-modal="true" aria-labelledby="celebrate-title">
          <div className="celebrate-inner">
            <Flame size={150} burning className="rise" />
            <h2 id="celebrate-title">{celebration.weekDone === 5 ? `Week ${celebration.week} beacon lit` : 'Session complete'}</h2>
            <p>Week {celebration.week}, {celebration.task.day}: {celebration.task.title}</p>
            <dl className="celebrate-stats">
              <div><dt>Studied</dt><dd>{celebration.minutes ? formatMinutes(celebration.minutes) : 'Not timed'}</dd></div>
              <div><dt>This week</dt><dd>{celebration.weekDone} of 5</dd><Embers done={celebration.weekDone} /></div>
              <div><dt>Programme</dt><dd>{programmeDone} of {allTasks.length}</dd></div>
            </dl>
            <button className="primary wide" onClick={() => setCelebration(null)} autoFocus>Done</button>
          </div>
        </div>
      )}

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
    </div>
  );
}

/* ==========================================================================
   Learn: everything to read, inside the app.
   ========================================================================== */

const learnTabs: Array<[LearnTab, string]> = [['lessons', 'Lessons'], ['exams', 'Exams'], ['documents', 'Documents'], ['glossary', 'Glossary']];

function LearnView({ tab, item, onTab, onItem, completed, currentIndex, artifactStatus, onStart, onOpenDoc }: {
  tab: LearnTab; item: string | null; onTab: (tab: LearnTab) => void; onItem: (item: string | null) => void;
  completed: Set<string>; currentIndex: number; artifactStatus: (key: string) => string | undefined;
  onStart: (task: StudyTask) => void; onOpenDoc: (item: Deliverable) => void;
}) {
  const [query, setQuery] = useState('');
  const [termCert, setTermCert] = useState<Certification | 'General' | 'All'>('All');
  const reading = useReading();
  const lessons = reading?.lessons;
  const docGuides = reading?.docGuides;
  if (item && (tab === 'lessons' || tab === 'documents') && !reading) {
    return <div className="reader"><button className="back" onClick={() => onItem(null)}><Chevron dir="left" /> {tab === 'lessons' ? 'Lessons' : 'Documents'}</button><p className="hint loading-note">Opening the reading</p></div>;
  }

  if (tab === 'lessons' && item && lessons?.[item]) {
    const index = allTasks.findIndex((task) => task.key === item);
    const task = allTasks[index];
    const prev = allTasks[index - 1];
    const next = allTasks[index + 1];
    const week = Math.floor(index / 5) + 1;
    return (
      <article className="reader" aria-labelledby="reader-title" style={certVars(task.certifications[0])}>
        <button className="back" onClick={() => onItem(null)}><Chevron dir="left" /> Lessons</button>
        <header className="reader-head">
          <p className="eyebrow-date">Week {week}, {task.day}{completed.has(task.key) ? ', done' : ''}</p>
          <h1 id="reader-title">{task.title}</h1>
          <p className="reader-meta">{task.certifications.map((cert) => <span key={cert} className="cert-dot" style={certVars(cert)}>{cert === 'ITIL' ? 'ITIL V5' : cert}</span>)}<span>{formatMinutes(taskMinutes(task.meta))}</span></p>
        </header>
        <LessonBody lesson={lessons[item]} task={task} onOpenDoc={onOpenDoc} />
        <div className="reader-actions">
          {!completed.has(task.key) && <button className="primary" onClick={() => onStart(task)}>Start this session</button>}
          {task.docs.map((key) => allDeliverables.find((entry) => entry.key === key)).filter((entry): entry is Deliverable => Boolean(entry)).map((entry) => <button key={entry.key} className="secondary" onClick={() => onOpenDoc(entry)}>Write {entry.title}</button>)}
        </div>
        <nav className="reader-nav" aria-label="Other lessons">
          {prev && lessonIndex[prev.key] ? <button onClick={() => onItem(prev.key)}><small>Previous</small><span>{prev.title}</span></button> : <span />}
          {next && lessonIndex[next.key] ? <button className="next" onClick={() => onItem(next.key)}><small>Next</small><span>{next.title}</span></button> : <span />}
        </nav>
      </article>
    );
  }

  if (tab === 'exams' && item) {
    const guide = examGuides.find((entry) => entry.cert === item);
    if (guide) {
      return (
        <article className="reader" aria-labelledby="reader-title" style={certVars(guide.cert)}>
          <button className="back" onClick={() => onItem(null)}><Chevron dir="left" /> Exams</button>
          <ExamGuideBody guide={guide} />
        </article>
      );
    }
  }

  if (tab === 'documents' && item && docGuides?.[item]) {
    const deliverable = allDeliverables.find((entry) => entry.key === item);
    if (deliverable) {
      return (
        <article className="reader" aria-labelledby="reader-title">
          <button className="back" onClick={() => onItem(null)}><Chevron dir="left" /> Documents</button>
          <header className="reader-head">
            <p className="eyebrow-date">{docNumberFor(deliverable)}, {statusLabel(artifactStatus(deliverable.key)).toLowerCase()}</p>
            <h1 id="reader-title">{deliverable.title}</h1>
            <p className="lede">{deliverable.summary}</p>
          </header>
          <GuideBody guide={docGuides[item]} />
          <div className="reader-actions"><button className="primary" onClick={() => onOpenDoc(deliverable)}>Write this document</button></div>
        </article>
      );
    }
  }

  const needle = query.trim().toLowerCase();
  const terms = glossary.filter((term) => (termCert === 'All' || term.cert === termCert) && (!needle || term.term.toLowerCase().includes(needle) || term.definition.toLowerCase().includes(needle)));
  const lessonCount = Object.keys(lessonIndex).length;

  return (
    <div className="learn">
      <header className="screen-head">
        <h1>Learn</h1>
        <p className="lede">{lessonCount} lessons, {Object.keys(guideIndex).length} documents with finished examples and {glossary.length} terms. Everything you need is here.</p>
      </header>
      <div className="segmented four" role="tablist" aria-label="Learn sections">
        {learnTabs.map(([key, label]) => <button key={key} role="tab" aria-selected={tab === key} className={tab === key ? 'active' : ''} onClick={() => onTab(key)}>{label}</button>)}
      </div>

      {tab === 'lessons' && (
        <div className="lesson-weeks">
          {studyWeeks.map((week) => (
            <details key={week.number} className={Math.floor(currentIndex / 5) + 1 === week.number ? 'lesson-week lw-fold is-current' : 'lesson-week lw-fold'} open={Math.floor(currentIndex / 5) + 1 === week.number}>
              <summary><h2><small>Week {week.number}{Math.floor(currentIndex / 5) + 1 === week.number ? ', this week' : ''}</small>{week.theme}</h2><span className="lw-count">{week.tasks.filter((task) => completed.has(task.key)).length} of 5</span></summary>
              <ol>
                {week.tasks.map((task) => (
                  <li key={task.key}>
                    <button onClick={() => onItem(task.key)} disabled={!lessonIndex[task.key]}>
                      <span className={completed.has(task.key) ? 'tick is-done' : 'tick'} aria-hidden="true">{completed.has(task.key) && <Check />}</span>
                      <span className="lw-title"><strong>{task.title}</strong><small>{lessonIndex[task.key] || 'Lesson coming'}</small></span>
                      <span className="lw-certs" aria-hidden="true">{task.certifications.map((cert) => <i key={cert} style={{ background: certColor(cert) }} />)}</span>
                      <Chevron dir="right" />
                    </button>
                  </li>
                ))}
              </ol>
            </details>
          ))}
        </div>
      )}

      {tab === 'exams' && (
        <div className="exam-cards">
          {examGuides.map((guide) => (
            <button key={guide.cert} className="exam-card" style={certVars(guide.cert)} onClick={() => onItem(guide.cert)}>
              <span className="exam-code">{guide.cert === 'ITIL' ? 'ITIL V5' : guide.cert}</span>
              <strong>{guide.name}</strong>
              <span className="exam-facts">{guide.glance}</span>
              <Chevron dir="right" />
            </button>
          ))}
        </div>
      )}

      {tab === 'documents' && projects.map((project) => (
        <details key={project.key} className="lesson-week lw-fold" open={phaseFor(currentIndex).project === project.key}>
          <summary><h2><small>Release {project.number}</small>{project.title}</h2><span className="lw-count">{project.deliverables.filter((deliverable) => artifactStatus(deliverable.key) === 'complete').length} of {project.deliverables.length}</span></summary>
          <ol>
            {project.deliverables.map((deliverable, index) => (
              <li key={deliverable.key}>
                <button onClick={() => onItem(deliverable.key)} disabled={!guideIndex[deliverable.key]}>
                  <span className="doc-no">{docNumber(project.key, index)}</span>
                  <span className="lw-title"><strong>{deliverable.title}</strong><small>{guideIndex[deliverable.key] || deliverable.summary}</small></span>
                  <span className={`status status-${artifactStatus(deliverable.key) || 'none'}`}>{statusLabel(artifactStatus(deliverable.key))}</span>
                  <Chevron dir="right" />
                </button>
              </li>
            ))}
          </ol>
        </details>
      ))}

      {tab === 'glossary' && (
        <div className="glossary">
          <label className="sr-only" htmlFor="term-search">Search terms</label>
          <input id="term-search" className="search" type="search" placeholder="Search a term or idea" value={query} onChange={(event) => setQuery(event.target.value)} />
          <div className="pills" role="group" aria-label="Filter by exam">
            {(['All', 'PMP', 'PL-300', 'CISSP', 'ITIL', 'General'] as const).map((cert) => (
              <button key={cert} className={termCert === cert ? 'pill active' : 'pill'} aria-pressed={termCert === cert} style={cert === 'All' || cert === 'General' ? undefined : certVars(cert)} onClick={() => setTermCert(cert)}>{cert === 'ITIL' ? 'ITIL V5' : cert}</button>
            ))}
          </div>
          <p className="hint" aria-live="polite">{terms.length} {terms.length === 1 ? 'term' : 'terms'}</p>
          <dl className="terms">
            {terms.map((term) => (
              <div key={`${term.cert}-${term.term}`} style={certVars(term.cert)}>
                <dt>{term.term}<span>{term.cert === 'ITIL' ? 'ITIL V5' : term.cert}</span></dt>
                <dd>{term.definition}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </div>
  );
}

function LessonBody({ lesson, task, onOpenDoc }: { lesson: Lesson; task: StudyTask; onOpenDoc?: (item: Deliverable) => void }) {
  const docs = task.docs.map((key) => allDeliverables.find((entry) => entry.key === key)).filter((entry): entry is Deliverable => Boolean(entry));
  const docGuides = useReading()?.docGuides || {};
  return (
    <div className="lesson">
      <p className="lesson-summary">{lesson.summary}</p>
      {lesson.read.map((section) => (
        <section key={section.heading} className="read">
          <h2 className="read-heading">{section.heading}</h2>
          <RichText text={section.body} />
        </section>
      ))}
      <section aria-label="Key terms">
        <h3>Key terms</h3>
        <dl className="key-terms">{lesson.keyTerms.map((term) => <div key={term.term}><dt>{term.term}</dt><dd>{term.definition}</dd></div>)}</dl>
      </section>
      <section className="build" aria-label="Build today">
        <h3>Build today</h3>
        <p className="build-goal">{lesson.build.goal}</p>
        <ol className="steps">{lesson.build.steps.map((step) => <li key={step}>{step}</li>)}</ol>
        {lesson.build.modelAnswer && (
          <details className="finished" open={docs.length === 0}>
            <summary>{docs.length ? 'What good looks like' : 'Model answer'}</summary>
            <RichText text={lesson.build.modelAnswer} />
          </details>
        )}
        {docs.filter((entry) => docGuides[entry.key]).map((entry) => (
          <details key={entry.key} className="finished">
            <summary>See the finished {entry.title.charAt(0).toLowerCase() + entry.title.slice(1)}</summary>
            <RichText text={docGuides[entry.key].modelDocument} />
            {onOpenDoc && <button className="secondary" onClick={() => onOpenDoc(entry)}>Write your own version</button>}
          </details>
        ))}
      </section>
      <section aria-label="On the exam">
        <h3>On the exam</h3>
        <ul className="tips">{lesson.examTips.map((tip) => <li key={tip.tip} style={certVars(tip.cert)}><span className="cert-dot" style={certVars(tip.cert)}>{tip.cert === 'ITIL' ? 'ITIL V5' : tip.cert}</span><p>{tip.tip}</p></li>)}</ul>
      </section>
      <section aria-label="Watch out for">
        <h3>Watch out for</h3>
        <ul className="pitfalls">{lesson.pitfalls.map((pitfall) => <li key={pitfall}>{pitfall}</li>)}</ul>
      </section>
      <section aria-label="Check yourself">
        <h3>Check yourself</h3>
        <ol className="self-check">
          {lesson.check.map((item) => (
            <li key={item.q}>
              <p>{item.q}</p>
              <details><summary>Show the answer</summary><p>{item.a}</p></details>
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
      <p className="lesson-summary">{guide.purpose}</p>
      <section aria-label="Sections">
        <h3>What goes in it</h3>
        <ol className="guide-sections">{guide.sections.map((section) => <li key={section.heading}><strong>{section.heading}</strong><p>{section.guidance}</p></li>)}</ol>
      </section>
      {showModel && (
        <section aria-label="Finished example">
          <h3>The finished Kestrel version</h3>
          <div className="model-doc"><RichText text={guide.modelDocument} /></div>
        </section>
      )}
      <section aria-label="Common mistakes">
        <h3>Common mistakes</h3>
        <ul className="pitfalls">{guide.mistakes.map((mistake) => <li key={mistake}>{mistake}</li>)}</ul>
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
  const flush = () => { if (paragraph.length) { blocks.push(<p key={`p${blocks.length}`}>{paragraph.join(' ')}</p>); paragraph = []; } };
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
      blocks.push(<List key={`l${blocks.length}`}>{items.map((item, itemIndex) => <li key={itemIndex}>{item}</li>)}</List>);
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
        <p className="eyebrow-date">{guide.credential}</p>
        <h1 id="reader-title">{guide.name}</h1>
        <p className="lede">{guide.summary}</p>
      </header>
      <dl className="exam-facts-grid">{guide.facts.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
      <section className="lesson" aria-label="What it covers">
        <h3>What it covers</h3>
        <p className="hint">{guide.areasNote}</p>
        <div className="areas">
          {guide.areas.map((area) => {
            const top = area.weight ? Number(area.weight.split(/[–%]/).filter(Boolean).pop()) : 0;
            return (
              <details key={area.name} className="area">
                <summary>
                  <span className="area-name">{area.name}</span>
                  {area.weight && <span className="area-weight">{area.weight}</span>}
                  {area.weight && <span className="area-bar" aria-hidden="true"><span style={{ width: `${Math.min(100, top * 2)}%` }} /></span>}
                </summary>
                <ul>{area.covers.map((line) => <li key={line}>{line}</li>)}</ul>
              </details>
            );
          })}
        </div>
        {guide.eligibility.length > 0 && <><h3>Who can sit it</h3><ul className="pitfalls plain">{guide.eligibility.map((line) => <li key={line}>{line}</li>)}</ul></>}
        <h3>How to answer</h3>
        <ol className="steps">{guide.technique.map((line) => <li key={line}>{line}</li>)}</ol>
        <h3>Where it sits in your plan</h3>
        <ul className="pitfalls plain">{guide.inThisPlan.map((line) => <li key={line}>{line}</li>)}</ul>
        <h3>After you pass</h3>
        <ul className="pitfalls plain">{guide.keeping.map((line) => <li key={line}>{line}</li>)}</ul>
        <p className="hint source">Checked against <a href={guide.source.url} target="_blank" rel="noreferrer">{guide.source.label}</a> on 18 October 2026. Publishers update exams; confirm the date on the official page before you book.</p>
      </section>
    </>
  );
}

function BookIcon() {
  return <svg className="book-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 6.5C10 5 7 4.5 3.5 5v13c3.5-.5 6.5 0 8.5 1.5 2-1.5 5-2 8.5-1.5V5C17 4.5 14 5 12 6.5zM12 6.5v13" /></svg>;
}

/* ==========================================================================
   Focus session: full-screen, one thing to do.
   ========================================================================== */

function FocusSession({ task, index, timer, elapsed, links, artifactStatus, saving, onPause, onMinimise, onFinish, onDiscard, onOpenWork, lesson }: {
  task: StudyTask; index: number; timer: Timer; elapsed: number; links: WorkLink[]; artifactStatus: (key: string) => string | undefined; saving: boolean;
  onPause: () => void; onMinimise: () => void; onFinish: () => void; onDiscard: () => void; onOpenWork: (link: WorkLink) => void; lesson?: Lesson;
}) {
  const [reading, setReading] = useState(false);
  const planned = taskMinutes(task.meta) * 60;
  const fraction = Math.min(1, elapsed / planned);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') { if (reading) setReading(false); else onMinimise(); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onMinimise, reading]);
  if (reading && lesson) {
    return (
      <div className="focus focus-reading" role="dialog" aria-modal="true" aria-labelledby="focus-lesson-title" style={certVars(task.certifications[0])}>
        <header className="focus-bar">
          <button className="ghost" onClick={() => setReading(false)}><Chevron dir="left" /> Timer</button>
          <span className={timer.pausedAt ? 'focus-mini paused' : 'focus-mini'}><span className="live-dot" aria-hidden="true" /><Digits value={formatClock(elapsed)} /></span>
        </header>
        <div className="focus-read">
          <p className="eyebrow-date">Week {Math.floor(index / 5) + 1}, {task.day} lesson</p>
          <h2 id="focus-lesson-title">{task.title}</h2>
          <LessonBody lesson={lesson} task={task} onOpenDoc={(item) => onOpenWork({ kind: 'artifact', item })} />
          <button className="primary wide" onClick={() => setReading(false)}>Back to the timer</button>
        </div>
      </div>
    );
  }
  return (
    <div className="focus" role="dialog" aria-modal="true" aria-labelledby="focus-title" style={certVars(task.certifications[0])}>
      <header className="focus-bar">
        <span>Week {Math.floor(index / 5) + 1}, {task.day}</span>
        <button className="ghost" onClick={onMinimise}>Minimise</button>
      </header>
      <div className="focus-body">
        <div className="focus-top">
          <Flame size={128} burning={!timer.pausedAt} className={timer.pausedAt ? 'is-paused' : ''} />
          <div className="focus-clock">
            <span className="clock"><Digits value={formatClock(elapsed)} /></span>
            <span className="of">of {formatMinutes(planned / 60)}</span>
          </div>
          <Meter value={fraction} label={`${Math.round(fraction * 100)}% of the planned time`} />
        </div>
        <h2 id="focus-title">{task.title}</h2>
        <p className="focus-explain">{lesson?.summary || plainTaskExplanation(task.title)}</p>
        <p className="focus-output">Finish with: {taskOutput(task.meta).toLowerCase()}</p>
        {lesson && <button className="focus-lesson" onClick={() => setReading(true)}><BookIcon /> Read the lesson</button>}
        {links.length > 0 && (
          <ul className="focus-work">
            {links.map((link) => (
              <li key={workKey(link)}>
                <button onClick={() => onOpenWork(link)}>
                  <span className="fw-kind">{link.kind === 'artifact' ? docNumberFor(link.item) : link.kind === 'lab' ? 'Lab' : 'Practice'}</span>
                  <span className="fw-name">{link.kind === 'artifact' ? link.item.title : link.kind === 'lab' ? link.lab.title : 'Scenario practice'}</span>
                  {link.kind === 'artifact' && <span className="fw-status">{statusLabel(artifactStatus(link.item.key))}</span>}
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
   Quiz run: one question per screen, feedback sheet from the bottom.
   ========================================================================== */

function QuizRun({ run, saving, seconds, onAnswer, onNext, onClose }: {
  run: Run; saving: boolean; seconds: number | null; onAnswer: (question: ScenarioQuestion, choice: string, confidence: string) => Promise<boolean>; onNext: () => void; onClose: () => void;
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
    <div className="quiz" style={certVars(question.certification)}>
      <header className="quiz-bar">
        <button className="close" onClick={onClose} aria-label="End practice">×</button>
        <div className="quiz-progress" role="progressbar" aria-valuemin={0} aria-valuemax={run.questions.length} aria-valuenow={run.index + (submitted ? 1 : 0)} aria-label={`${run.title}, question ${run.index + 1} of ${run.questions.length}`}>
          <span style={{ width: `${((run.index + (submitted ? 1 : 0)) / run.questions.length) * 100}%` }} />
        </div>
        {seconds !== null ? <span className={seconds < 60 ? 'quiz-time low' : 'quiz-time'}><Digits value={formatClock(seconds)} /></span> : <span className="quiz-count">{run.index + 1}/{run.questions.length}</span>}
      </header>
      <div className="quiz-body">
        <p className="quiz-meta"><span className="cert-dot" style={certVars(question.certification)}>{question.certification === 'Intersection' ? 'All four' : question.certification}</span>{question.domain}</p>
        <h1 className="quiz-q">{question.prompt}</h1>
        <div className="answers" role="radiogroup" aria-label="Answers">
          {question.options.map(([key, text]) => {
            const state = submitted ? (key === question.correct ? 'is-right' : key === choice ? 'is-wrong' : 'is-muted') : choice === key ? 'is-picked' : '';
            return (
              <label key={key} className={`answer ${state}`}>
                <input type="radio" name={`q-${question.id}`} value={key} checked={choice === key} disabled={submitted} onChange={() => setChoice(key)} />
                <span className="answer-key" aria-hidden="true">{key}</span>
                <span>{text}</span>
              </label>
            );
          })}
        </div>
        {!submitted && (
          <fieldset className="sure">
            <legend>How sure are you?</legend>
            {(['low', 'medium', 'high'] as const).map((level) => <label key={level} className={confidence === level ? 'active' : ''}><input type="radio" name={`c-${question.id}`} value={level} checked={confidence === level} onChange={() => setConfidence(level)} />{level === 'low' ? 'Guessing' : level === 'medium' ? 'Fairly sure' : 'Certain'}</label>)}
          </fieldset>
        )}
      </div>
      {!submitted ? (
        <footer className="quiz-foot"><button className="primary wide" onClick={check} disabled={!choice || saving}>Check</button></footer>
      ) : (
        <footer className={correct ? 'sheet is-right' : 'sheet is-wrong'} role="status">
          <div className="sheet-inner">
            <strong className="sheet-title">{correct ? 'Sound decision' : `The best answer is ${question.correct}`}</strong>
            <p>{correct ? question.explanation : `${question.incorrect[choice] || 'This option does not address the governing issue.'} ${question.explanation}`}</p>
            <p className="sheet-link">Taught in: {allDeliverables.find((item) => item.key === question.artifactKey)?.title || 'Integrated decision record'}</p>
            <button className="sheet-next" onClick={onNext} autoFocus>{run.index < run.questions.length - 1 ? 'Continue' : 'Finish'}</button>
          </div>
        </footer>
      )}
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
        <input id="yours-name" value={draftName} maxLength={40} autoComplete="given-name" onChange={(event) => setDraftName(event.target.value)} autoFocus />
        <label className="field" htmlFor="yours-why">Why you are doing this</label>
        <textarea id="yours-why" className="short" value={draftWhy} maxLength={140} onChange={(event) => setDraftWhy(event.target.value)} placeholder="One line you will see on Today" />
        <p className="hint">{140 - draftWhy.length} characters left</p>
        <fieldset className="swatches">
          <legend className="field">Your colour</legend>
          {accents.map(([key, label, swatch]) => (
            <label key={key} className={accent === key ? 'swatch active' : 'swatch'}>
              <input type="radio" name="accent" value={key} checked={accent === key} onChange={() => onAccent(key)} />
              <span className="swatch-dot" style={{ background: swatch }} aria-hidden="true" />
              <span>{label}</span>
            </label>
          ))}
        </fieldset>
        <fieldset className="appearance">
          <legend className="field">Appearance</legend>
          {([['system', 'Match this device'], ['light', 'Light'], ['dark', 'Night']] as Array<[Theme, string]>).map(([key, label]) => (
            <label key={key} className={theme === key ? 'chip-option active' : 'chip-option'}>
              <input type="radio" name="theme" value={key} checked={theme === key} onChange={() => onTheme(key)} />
              {label}
            </label>
          ))}
        </fieldset>
        <p className="hint">Colour and appearance change straight away and stay on this device. Your name and why are saved with your plan.</p>
        <div className="row form-actions">
          <button type="button" className="ghost" onClick={onClose}>Close</button>
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
        <h1>Four certifications. Thirteen weeks. One beacon at a time.</h1>
        <Ridge weeks={[5, 5, 5, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0]} />
        <p className="onboard-note">Every session you finish feeds that week’s beacon. Five sessions light it. The tall towers are your exam gates.</p>
        <ul className="onboard-certs">{certs.map((item) => <li key={item.cert} style={certVars(item.cert)}><strong>{item.label}</strong><span>{item.name}</span></li>)}</ul>
      </section>
      <section className="onboard-form" aria-labelledby="setup-title">
        <div className="steps-bar" aria-hidden="true">{onboardingSteps.map((name, index) => <span key={name} className={index <= step ? 'on' : ''} />)}</div>
        <p className="eyebrow-date">Step {step + 1} of {onboardingSteps.length}</p>
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
          <div className="row form-actions">
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

/* The ridge: Beacon's 13 weeks as signal fires on a line of Alberta
   foothills. A week's beacon grows with each session and burns fully when
   all five are done. The three exam gates are the tall towers. Everything
   is laid out on u (0 to 1 across), so the wide and narrow drawings share
   the same label positions. */
const RIDGE_H = 330;
const ridgeGates: Record<number, string> = { 6: 'PL-300 and ITIL', 10: 'PMP', 13: 'CISSP' };
const ridgeU = Array.from({ length: 13 }, (_, i) => 0.056 + i * (0.888 / 12));
const ridgeGround = (u: number) => 286 - 92 * Math.pow(u, 1.35) + 7 * Math.sin((u * 1000) / 61) + 4 * Math.sin((u * 1000) / 23 + 1);
const ridgeMid = (u: number) => 246 - 30 * Math.pow(u, 1.1) + 9 * Math.sin((u * 1000) / 90 + 2) + 5 * Math.sin((u * 1000) / 37);
const RIDGE_PEAKS: Array<[number, number]> = [[0, 170], [0.04, 128], [0.078, 160], [0.12, 104], [0.16, 150], [0.205, 118], [0.25, 166], [0.3, 138], [0.35, 182], [0.42, 176], [0.52, 206], [0.64, 214], [0.8, 222], [1, 214]];
const ridgeFar = (u: number) => {
  for (let i = 0; i < RIDGE_PEAKS.length - 1; i += 1) {
    const [u1, y1] = RIDGE_PEAKS[i];
    const [u2, y2] = RIDGE_PEAKS[i + 1];
    if (u >= u1 && u <= u2) return y1 + ((y2 - y1) * (u - u1)) / (u2 - u1);
  }
  return 214;
};
const RIDGE_STARS: Array<[number, number, number]> = [[0.09, 40, 1.9], [0.17, 82, 1.3], [0.24, 30, 1.3], [0.33, 66, 1.9], [0.42, 22, 1.3], [0.5, 58, 1.3], [0.59, 34, 1.9], [0.66, 88, 1.3], [0.73, 26, 1.3], [0.8, 60, 1.9], [0.88, 38, 1.3], [0.95, 80, 1.3], [0.13, 120, 1.9], [0.56, 110, 1.3]];
const FLAME_OUTER = 'M0 0C-12 0-16-9-14-18C-12-27-3-30 2-44C6-33 15-26 15-16C15-7 11 0 0 0Z';
const FLAME_INNER = 'M0 0C-6 0-8-5-7-10C-6-16-1-18 1-26C4-19 8-15 8-9C8-4 5 0 0 0Z';

function ridgeLand(fn: (u: number) => number, width: number) {
  let d = `M0 ${RIDGE_H}`;
  for (let step = 0; step <= 100; step += 1) d += `L${((step / 100) * width).toFixed(1)} ${fn(step / 100).toFixed(1)}`;
  return `${d}L${width} ${RIDGE_H}Z`;
}

function RidgeArt({ width, weeks, id }: { width: number; weeks: number[]; id: string }) {
  return (
    <svg className={width > 700 ? 'ridge-art ridge-wide' : 'ridge-art ridge-narrow'} viewBox={`0 0 ${width} ${RIDGE_H}`} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`${id}sky`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#171b44" /><stop offset=".55" stopColor="#262a63" /><stop offset=".8" stopColor="#4b3f74" /><stop offset="1" stopColor="#b8695a" /></linearGradient>
        <radialGradient id={`${id}glow`}><stop offset="0" stopColor="#ffb347" stopOpacity=".55" /><stop offset="1" stopColor="#ff6a1f" stopOpacity="0" /></radialGradient>
      </defs>
      <rect width={width} height={RIDGE_H} fill={`url(#${id}sky)`} />
      {RIDGE_STARS.map(([u, y, r], index) => <circle key={index} cx={u * width} cy={y} r={r} fill="#fff" opacity={index % 2 ? 0.45 : 0.75} />)}
      <path d={ridgeLand(ridgeFar, width)} fill="#34336b" />
      <path d={ridgeLand(ridgeMid, width)} fill="#25265a" />
      <path d={ridgeLand(ridgeGround, width)} fill="#141739" />
      {ridgeU.map((u, index) => {
        const x = u * width;
        const y = ridgeGround(u);
        const done = weeks[index] || 0;
        const gate = Boolean(ridgeGates[index + 1]);
        const post = gate ? 58 : 30;
        const bowl = gate ? 15 : 10;
        const top = y - post;
        const lit = done >= 5;
        const scale = done === 0 ? 0 : (gate ? 1.35 : 1) * (lit ? 1 : 0.4 + done * 0.1);
        return (
          <g key={index} className={done > 0 && !lit ? 'beacon is-burning' : 'beacon'}>
            {lit && <circle cx={x} cy={top - 16 * scale} r={38 * scale} fill={`url(#${id}glow)`} />}
            <rect x={x - 1.6} y={top} width="3.2" height={post + 6} fill="#0b0d26" />
            {gate && <path d={`M${x - 9} ${y + 2}L${x} ${top + 18}L${x + 9} ${y + 2}`} stroke="#0b0d26" strokeWidth="3" fill="none" />}
            <path d={`M${x - bowl} ${top - 6}H${x + bowl}L${x + bowl * 0.55} ${top + 2}H${x - bowl * 0.55}Z`} fill="#0b0d26" />
            {done === 0
              ? <circle cx={x} cy={top - 8} r={gate ? 3.4 : 2.6} fill="#4b4f80" />
              : <g transform={`translate(${x} ${top - 5}) scale(${scale})`}><path className="flame-shape" d={FLAME_OUTER} fill="#ff6a1f" /><path className="flame-shape" d={FLAME_INNER} fill="#ffc94a" /></g>}
          </g>
        );
      })}
    </svg>
  );
}

function Ridge({ weeks, selected, onSelect, children }: { weeks: number[]; selected?: number; onSelect?: (week: number) => void; children?: ReactNode }) {
  const id = `r${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const spacing = 0.888 / 12;
  return (
    <section className="ridge" aria-label="Your 13 weeks as beacons">
      <div className="ridge-scene">
        <RidgeArt width={1000} weeks={weeks} id={`${id}w`} />
        <RidgeArt width={560} weeks={weeks} id={`${id}n`} />
        {Object.entries(ridgeGates).map(([week, label]) => <span key={week} className={ridgeU[Number(week) - 1] > 0.9 ? 'ridge-gate edge-end' : 'ridge-gate'} style={{ left: `${ridgeU[Number(week) - 1] * 100}%` }}>{label}</span>)}
        {ridgeU.map((u, index) => {
          const week = index + 1;
          const done = weeks[index] || 0;
          const label = `Week ${week}: ${done} of 5 sessions done${ridgeGates[week] ? `, ${ridgeGates[week]} exam gate` : ''}`;
          const style = { left: `${u * 100}%`, top: `${((ridgeGround(u) + 14) / RIDGE_H) * 100}%` } as CSSProperties;
          return onSelect ? (
            <button key={week} className={week === selected ? 'ridge-week is-selected' : 'ridge-week'} style={{ left: `${(u - spacing / 2) * 100}%`, width: `${spacing * 100}%` }} onClick={() => onSelect(week)} aria-pressed={week === selected} aria-label={label}>
              <span style={{ top: style.top }}>{week}</span>
            </button>
          ) : <span key={week} className="ridge-num" style={style} aria-hidden="true">{week}</span>;
        })}
      </div>
      {children && <div className="ridge-foot">{children}</div>}
    </section>
  );
}

/* One flame, used for focus mode, the completion screen and empty states. */
function Flame({ size = 96, burning = false, className = '' }: { size?: number; burning?: boolean; className?: string }) {
  return (
    <svg className={['flame', burning ? 'is-burning' : '', className].filter(Boolean).join(' ')} width={size} height={size} viewBox="-24 -50 48 56" aria-hidden="true">
      <path className="flame-shape" d={FLAME_OUTER} fill="#ff6a1f" />
      <path className="flame-shape" d={FLAME_INNER} fill="#ffc94a" />
    </svg>
  );
}

/* Five small marks for the five sessions of a week. */
function Embers({ done }: { done: number }) {
  return <span className="embers" aria-hidden="true">{[0, 1, 2, 3, 4].map((index) => <i key={index} className={index < done ? 'on' : ''} />)}</span>;
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

function Part({ label, value, max }: { label: string; value: number; max: number }) {
  return (
    <div className="part">
      <span className="part-label">{label}</span>
      <span className="part-track" aria-hidden="true"><span style={{ width: `${(value / max) * 100}%` }} /></span>
      <span className="part-value">{Math.round(value)}/{max}</span>
    </div>
  );
}

/* Proportional digits shift as a clock ticks; give each digit a fixed cell. */
function Digits({ value }: { value: string }) {
  return <span className="digits" aria-label={value}>{value.split('').map((char, index) => <span key={index} className={/\d/.test(char) ? 'dg' : 'sep'} aria-hidden="true">{char}</span>)}</span>;
}

/* The mark: a beacon burning on a night ridge. */
function BrandMark({ size = 32 }: { size?: number }) {
  return (
    <svg className="brand-mark" width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" rx="16" fill="#1d2152" />
      <path d="M0 50C14 45 30 47 64 39V48C64 56.8 56.8 64 48 64H16C7.2 64 0 56.8 0 48Z" fill="#11143a" />
      <g transform="translate(32 46) scale(0.86)"><path d={FLAME_OUTER} fill="#ff6a1f" /><path d={FLAME_INNER} fill="#ffc94a" /></g>
    </svg>
  );
}

function Check() {
  return <svg className="check" viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function Chevron({ dir }: { dir: 'left' | 'right' | 'up' | 'down' }) {
  const rotate = { right: 0, down: 90, left: 180, up: 270 }[dir];
  return <svg className="chev" viewBox="0 0 16 16" aria-hidden="true" style={{ transform: `rotate(${rotate}deg)` }}><path d="M6 3.5l4.5 4.5L6 12.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function NavIcon({ name }: { name: View }) {
  const paths: Record<View, ReactNode> = {
    today: <path d="M12 21c-3.9 0-6.5-2.6-6.5-6.1 0-3.4 2.4-5.4 3.7-8.4 1 1.3 1.4 2.4 1.5 3.7 1.5-1.4 2.7-3.9 2.6-7.2 3.4 2.4 5.2 6.9 5.2 10.6 0 4.6-2.5 7.4-6.5 7.4z" />,
    learn: <path d="M12 6.5C10 5 7 4.5 3.5 5v13c3.5-.5 6.5 0 8.5 1.5 2-1.5 5-2 8.5-1.5V5C17 4.5 14 5 12 6.5zM12 6.5v13" />,
    plan: <><rect x="3.5" y="5" width="17" height="15" rx="3" /><path d="M3.5 10h17M8 3v4M16 3v4" /></>,
    projects: <><path d="M6 3.5h8l4.5 4.5v12.5H6z" /><path d="M14 3.5V8h4.5M9 13h6M9 16.5h6" /></>,
    practice: <path d="M13 2.5 5 13.5h6l-1 8 8-11h-6z" />,
    progress: <path d="M4 20V13M9.5 20V8M15 20v-5M20.5 20V4" />,
  };
  return <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

function TileArt({ kind }: { kind: 'scenarios' | 'timed' | 'review' | 'cards' | 'labs' }) {
  const art: Record<typeof kind, ReactNode> = {
    scenarios: <><path d="M60 98V66C60 52 46 46 34 40M60 66C60 52 74 46 86 40" fill="none" stroke="currentColor" strokeWidth="9" strokeLinecap="round" opacity=".45" /><path d="M60 98V66C60 52 74 46 86 40" fill="none" stroke="currentColor" strokeWidth="9" strokeLinecap="round" /><path d="M72 30l16 9-10 15" fill="none" stroke="currentColor" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" /><circle cx="30" cy="38" r="7" fill="currentColor" opacity=".45" /></>,
    timed: <><circle cx="60" cy="64" r="32" fill="none" stroke="currentColor" strokeWidth="9" /><path d="M60 64V44M52 22h16" stroke="currentColor" strokeWidth="9" strokeLinecap="round" /></>,
    review: <><path d="M30 64a30 30 0 1 0 9-21" fill="none" stroke="currentColor" strokeWidth="9" strokeLinecap="round" /><path d="M36 30v14h14" fill="none" stroke="currentColor" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" /></>,
    cards: <><rect x="28" y="34" width="52" height="40" rx="8" fill="none" stroke="currentColor" strokeWidth="8" opacity=".4" /><rect x="40" y="46" width="52" height="40" rx="8" fill="none" stroke="currentColor" strokeWidth="8" /></>,
    labs: <><path d="M50 26v24L32 84a6 6 0 0 0 5 9h46a6 6 0 0 0 5-9L70 50V26" fill="none" stroke="currentColor" strokeWidth="8" strokeLinejoin="round" /><path d="M44 26h32" stroke="currentColor" strokeWidth="8" strokeLinecap="round" /></>,
  };
  return <svg className="tile-art" viewBox="0 0 120 120" aria-hidden="true">{art[kind]}</svg>;
}

/* ==========================================================================
   Lists
   ========================================================================== */

function ReviewList({ attempts, queue, onOpen }: { attempts: AttemptRow[]; queue: AttemptRow[]; onOpen: (key: string) => void }) {
  if (!queue.length) {
    return <section className="empty"><Flame size={72} /><h2>All clear</h2><p>Answers you get wrong or mark as a guess land here, linked to the document that teaches them.</p></section>;
  }
  return (
    <>
      <p className="hint">{attempts.length} wrong, {queue.length - attempts.length} guessed. Restate the scenario, name the principle, say why your answer failed, then update the document.</p>
      <ul className="review-list">
        {queue.map((attempt) => {
          const cleanId = attempt.question_id.replace(/^mock-(PMP|PL-300|CISSP|ITIL)-/, '');
          const question = allArtifactQuestions.find((item) => item.id === cleanId) || allArtifactQuestions.find((item) => attempt.question_id.endsWith(item.id)) || scenarioBank.find((item) => item.id === cleanId);
          return (
            <li key={attempt.question_id}>
              <span className={attempt.correct ? 'flag is-guess' : 'flag'}>{attempt.correct ? 'Guessed' : 'Wrong'}</span>
              <strong>{question?.prompt || attempt.domain}</strong>
              <p>{question?.explanation || 'Reopen the connected document and explain the governing concept without notes.'}</p>
              {question && <button className="text-link" onClick={() => onOpen(question.artifactKey)}>Open the document</button>}
            </li>
          );
        })}
      </ul>
    </>
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
    <section className="card-block" aria-labelledby="datasets-title">
      <h2 id="datasets-title">Kestrel Health datasets</h2>
      <p className="hint">Synthetic and deliberately imperfect: duplicates, impossible times, invalid codes and orphaned keys are documented in the reconciliation answers, not hidden.</p>
      <ul className="files">{files.map(([label, url, kind]) => <li key={url}><a href={url} download><span>{label}</span><small>{kind}</small></a></li>)}</ul>
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
function routeFromHash(): { view: View; tab?: 'readiness' | 'portfolio' } | null {
  const hash = window.location.hash.replace('#', '');
  if (hash === 'home') return { view: 'today' };
  if (hash === 'portfolio') return { view: 'progress', tab: 'portfolio' };
  return navItems.some(([key]) => key === hash) ? { view: hash as View } : null;
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
