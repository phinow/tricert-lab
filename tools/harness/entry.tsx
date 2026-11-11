import React from 'react';
import { createRoot } from 'react-dom/client';
// Resolved through the esbuild alias "@app" to the version under test.
import TriCertApp from '@app/tricert-app';
import { projects } from '@/lib/tricert-content';
import { cardsForLesson, makeUserCard, practiceForm, questionsForLesson } from '@/lib/tricert-bank';
import { scoreExam } from '@/lib/tricert-study';

type Row = Record<string, unknown>;

const params = new URLSearchParams(window.location.search);
const fixture = params.get('state') || 'midway';
// The checks set today's date (?today=YYYY-MM-DD) so they do not depend on
// the real calendar. Wednesday 18 November 2026 by default.
(window as unknown as { __tricertToday?: string }).__tricertToday = params.get('today') || '2026-11-18';
// With ?keep=1 the fake server keeps its state in this tab across reloads.
const keepKey = params.get('keep') ? `harness.state.${fixture}` : '';

const profile = {
  education: 'bachelor',
  projects_led: 'Clinic scheduling upgrade · 2024 · led requirements and UAT · delivered on time',
  pm_months: 22,
  pm_training_hours: 35,
  pm_training_complete: 1,
  cyber_months: 30,
  cyber_domains: JSON.stringify(['Identity & access', 'Security operations']),
  power_bi_level: 'intermediate',
  power_query_level: 'beginner',
  dax_level: 'beginner',
  sql_level: 'intermediate',
  itil_level: 'beginner',
  weekly_hours: 11,
  pmp_target: '2027-03-15',
  pl300_target: '2026-12-10',
  cissp_target: '',
  itil_target: '2027-01-20',
  display_name: 'Moye',
  motivation: 'Pass all four, then lead the projects I used to support.',
};

/* Fixtures: ?state=midway (default), ready, booked or fresh. */

/* Midway: the ITIL block with mornings 1 to 4 and review 1 done (started
   Monday 9 November), seven cards and eight questions due on 18 November,
   one card of his own, and practice exam A not taken yet. */
function midwayState() {
  const done = ['itil-m1', 'itil-m2', 'itil-m3', 'itil-m4', 'itil-r1'];
  const dates = ['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13'];
  const progress: Row[] = done.map((key, index) => ({ item_key: key, status: 'complete', updated_at: `${dates[index]}T07:30:00Z` }));
  progress.push({ item_key: 'portfolio-readme', status: 'complete' });
  const artifacts: Row[] = [];
  projects[0].deliverables.slice(0, 6).forEach((item, index) => {
    artifacts.push({
      artifact_key: item.key,
      status: index < 5 ? 'complete' : 'draft',
      evidence_text: `${item.template}\n\nDecision: the sponsor approved scope after we agreed the authority limits in writing. Evidence: the stakeholder register and the risk log both reference the same owner for the data-classification work.`,
      reflection: index < 4 ? 'I chose to fix ownership before touching the data model because unresolved ownership kept reappearing as a risk. The trade-off was two days of schedule.' : '',
      updated_at: '2026-10-08T21:14:00Z',
    });
  });
  artifacts.push({ artifact_key: 'retrospective-itil-r1', status: 'complete', evidence_text: 'I can explain outputs against outcomes without notes. Governance still needs notes.', reflection: 'Review: mornings 1 to 4: weekly reflection recorded.' });

  const cards: Record<string, Row> = {};
  cardsForLesson('itil-m1').forEach((card, index) => { cards[card.id] = index < 3 ? { stage: 1, due: '2026-11-18', first: '2026-11-09' } : { stage: 2, due: '2026-11-24', first: '2026-11-09' }; });
  cardsForLesson('itil-m2').forEach((card, index) => { cards[card.id] = index < 4 ? { stage: 1, due: '2026-11-17', first: '2026-11-10' } : { stage: 2, due: '2026-11-25', first: '2026-11-10' }; });
  cardsForLesson('itil-m3').forEach((card) => { cards[card.id] = { stage: 1, due: '2026-11-19', first: '2026-11-11' }; });
  cardsForLesson('itil-m4').forEach((card) => { cards[card.id] = { stage: 1, due: '2026-11-20', first: '2026-11-12' }; });

  const questions: Record<string, Row> = {};
  const attempts: Row[] = [];
  ['itil-m1', 'itil-m2', 'itil-m3', 'itil-m4'].forEach((lesson, lessonIndex) => {
    const first = dates[lessonIndex];
    questionsForLesson(lesson, []).forEach((question, index) => {
      const missed = index < 2;
      questions[question.id] = missed ? { stage: 1, due: index === 0 ? '2026-11-16' : '2026-11-18', last: dates[lessonIndex + 1], first } : { stage: 3, due: '2026-12-05', last: first, first };
      attempts.push({
        question_id: question.id, certification: question.certification, domain: question.domain,
        answer: missed && index === 0 ? (question.correct === 'A' ? 'B' : 'A') : question.correct,
        correct: missed && index === 0 ? 0 : 1, confidence: missed ? 'low' : 'high',
        created_at: `${missed ? dates[lessonIndex + 1] : first}T07:40:00Z`, first_at: `${first}T07:40:00Z`, tries: missed ? 2 : 1,
      });
    });
  });
  attempts.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));

  const own = questionsForLesson('itil-m2', [])[0];
  const mine = makeUserCard({ exam: 'ITIL', front: own.prompt, back: 'Value is judged by the consumer, from outcomes, costs and risks together.', today: '2026-11-10', lesson: 'itil-m2', question: own.id });
  cards[mine.id] = { stage: 1, due: '2026-11-21' };
  const log: Row[] = done.map((key, index) => ({ id: `log-${key}-fixture`, key, kind: key.endsWith('r1') ? 'review' : 'learn', block: 'itil', date: dates[index], minutes: 88 + index, cards: 8 + index, questions: 20, right: 15 + index }));

  return {
    profile, progress, attempts, artifacts,
    records: { plan: { startDate: '2026-11-09' }, srs: { cards, questions, delayed: { ITIL: { total: 6, right: 4 } } }, mocks: [], log, usercards: [mine] },
  };
}

/* Ready: every ITIL morning up to review 2 and the lab are done, so
   practice exam A is open (on Practice, and as this Saturday's block). */
function readyState() {
  const base = midwayState();
  const more = ['itil-m5', 'itil-m6', 'itil-m7', 'itil-m8', 'itil-r2', 'itil-w1'];
  more.forEach((key, index) => base.progress.push({ item_key: key, status: 'complete', updated_at: `2026-11-${String(16 + Math.min(index, 4)).padStart(2, '0')}T07:30:00Z` }));
  return base;
}

/* Booked: the whole ITIL block is done, practice exams A and B both pass
   with no weak area, 7 days apart, and 26 delayed reviews are 23 right. */
function bookedState() {
  const base = readyState();
  ['itil-w2', 'itil-p1', 'itil-p2', 'itil-w3'].forEach((key) => base.progress.push({ item_key: key, status: 'complete', updated_at: '2026-11-15T09:00:00Z' }));
  const result = (form: 'A' | 'B', date: string, miss: (index: number) => boolean) => {
    const questions = practiceForm('ITIL', form);
    const answers: Record<string, string> = {};
    questions.forEach((question, index) => { answers[question.id] = miss(index) ? (question.correct === 'A' ? 'B' : 'A') : question.correct; });
    const score = scoreExam(questions, answers);
    return { id: `mock-itil-${form}-fixture`, exam: 'ITIL', form, date, total: score.total, right: score.right, areas: score.areas, weekend: form === 'A' ? 'itil-w2' : 'itil-w3', ids: questions.map((question) => question.id), answers, flags: [], minutes: 52 };
  };
  const mocks = [result('A', '2026-11-07', (index) => index % 7 === 3), result('B', '2026-11-15', (index) => index % 6 === 2)];
  return { ...base, records: { ...base.records, mocks, srs: { ...base.records.srs, delayed: { ITIL: { total: 26, right: 23 } } } } };
}

type Records = { plan: Row; srs: Row; mocks: Row[]; log: Row[]; usercards: Row[] };
function emptyRecords(): Records {
  return { plan: {}, srs: { cards: {}, questions: {} }, mocks: [], log: [], usercards: [] };
}
const isObject = (value: unknown): value is Row => typeof value === 'object' && value !== null && !Array.isArray(value);
// Same rules as the real copies: objects merge to three levels, null removes a key.
function merge(target: Row, patch: Row, depth = 1): Row {
  const out: Row = { ...target };
  for (const [key, value] of Object.entries(patch)) {
    if (value === null) delete out[key];
    else if (depth < 3 && isObject(value)) out[key] = merge(isObject(out[key]) ? out[key] : {}, value, depth + 1);
    else out[key] = value;
  }
  return out;
}

type State = { profile: Row | null; progress: Row[]; attempts: Row[]; artifacts: Row[]; records: Records };
function kept(): State | null {
  if (!keepKey) return null;
  try { return JSON.parse(sessionStorage.getItem(keepKey) || 'null'); } catch { return null; }
}
const fixtures: Record<string, () => unknown> = { midway: midwayState, ready: readyState, booked: bookedState };
let state: State = kept() || (fixture === 'fresh' ? { profile: null, progress: [], attempts: [], artifacts: [], records: emptyRecords() } : ((fixtures[fixture] || midwayState)() as State));

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

const realFetch = window.fetch.bind(window);
window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  if (!url.startsWith('/api/state')) return realFetch(input, init);
  await new Promise((resolve) => setTimeout(resolve, 120));
  if (!init || init.method !== 'PUT') return json(state);
  const body = JSON.parse(String(init.body)) as Row;
  switch (body.action) {
    case 'save-profile':
      state = {
        ...state,
        profile: {
          education: body.education,
          projects_led: body.projectsLed,
          pm_months: Number(body.pmMonths),
          pm_training_hours: Number(body.pmTrainingHours),
          pm_training_complete: body.pmTrainingComplete ? 1 : 0,
          cyber_months: Number(body.cyberMonths),
          cyber_domains: JSON.stringify(body.cyberDomains || []),
          power_bi_level: body.powerBiLevel,
          power_query_level: body.powerQueryLevel,
          dax_level: body.daxLevel,
          sql_level: body.sqlLevel,
          itil_level: body.itilLevel,
          weekly_hours: Number(body.weeklyHours),
          pmp_target: body.pmpTarget || '',
          pl300_target: body.pl300Target || '',
          cissp_target: body.cisspTarget || '',
          itil_target: body.itilTarget || '',
          display_name: body.displayName || '',
          motivation: body.motivation || '',
        },
      };
      break;
    case 'save-personal':
      if (!state.profile) return json({ error: 'Set up your plan before personalising it.' }, 400);
      state = { ...state, profile: { ...state.profile, display_name: String(body.displayName || '').slice(0, 40), motivation: String(body.motivation || '').slice(0, 140) } };
      break;
    case 'set-progress':
      state = {
        ...state,
        progress: [...state.progress.filter((row) => row.item_key !== body.itemKey), { item_key: body.itemKey, status: body.status }],
      };
      break;
    case 'record-attempt':
    {
      // Like the real copies: the latest row per question, with the first answer's time and the number of answers.
      const before = state.attempts.find((row) => row.question_id === body.questionId);
      const at = new Date().toISOString();
      state = {
        ...state,
        attempts: [
          { question_id: body.questionId, certification: body.certification, domain: body.domain, answer: body.answer, correct: body.correct ? 1 : 0, confidence: body.confidence, created_at: at, first_at: before?.first_at || before?.created_at || at, tries: Number(before?.tries || (before ? 1 : 0)) + 1 },
          ...state.attempts.filter((row) => row.question_id !== body.questionId),
        ],
      };
      break;
    }
    case 'save-artifact':
      state = {
        ...state,
        artifacts: [
          ...state.artifacts.filter((row) => row.artifact_key !== body.artifactKey),
          { artifact_key: body.artifactKey, status: body.status, evidence_text: body.evidenceText, reflection: body.reflection, updated_at: new Date().toISOString() },
        ],
      };
      break;
    case 'patch-record': {
      const key = body.key as 'plan' | 'srs';
      if (!['plan', 'srs'].includes(key) || !isObject(body.patch)) return json({ error: 'patch-record needs key plan or srs and an object patch.' }, 400);
      state = { ...state, records: { ...state.records, [key]: merge(state.records[key], body.patch) } };
      break;
    }
    case 'append-record': {
      const key = body.key as 'mocks' | 'log' | 'usercards';
      const item = body.item;
      if (!['mocks', 'log', 'usercards'].includes(key) || !isObject(item) || typeof item.id !== 'string' || !item.id) return json({ error: 'append-record needs key mocks, log or usercards and an item with an id.' }, 400);
      const at = state.records[key].findIndex((row) => row.id === item.id);
      const next = at >= 0 ? state.records[key].map((row, index) => (index === at ? item : row)) : [...state.records[key], item];
      state = { ...state, records: { ...state.records, [key]: next } };
      break;
    }
    default:
      return json({ error: 'Unsupported study action.' }, 400);
  }
  if (keepKey) sessionStorage.setItem(keepKey, JSON.stringify(state));
  return json(state);
};

createRoot(document.getElementById('root')!).render(<TriCertApp />);
