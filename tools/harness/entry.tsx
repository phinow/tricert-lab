import React from 'react';
import { createRoot } from 'react-dom/client';
// Resolved through the esbuild alias "@app" to the version under test.
import TriCertApp from '@app/tricert-app';
import { projects, studyWeeks, scenarioBank } from '@/lib/tricert-content';

type Row = Record<string, unknown>;

const params = new URLSearchParams(window.location.search);
const fixture = params.get('state') || 'midway';

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
  weekly_hours: 18,
  pmp_target: '2027-03-15',
  pl300_target: '2026-12-10',
  cissp_target: '',
  itil_target: '2027-01-20',
  display_name: 'Moye',
  motivation: 'Pass all four, then lead the projects I used to support.',
};

function midwayState() {
  const progress: Row[] = [];
  studyWeeks.forEach((week) => {
    week.tasks.forEach((task, index) => {
      const done = week.number <= 5 || (week.number === 6 && index < 2);
      if (done) progress.push({ item_key: task.key, status: 'complete' });
    });
  });
  progress.push({ item_key: 'lab-sql', status: 'complete' });
  progress.push({ item_key: 'portfolio-readme', status: 'complete' });
  const artifacts: Row[] = [];
  const first = projects[0].deliverables;
  first.slice(0, 6).forEach((item, index) => {
    artifacts.push({
      artifact_key: item.key,
      status: index < 5 ? 'complete' : 'draft',
      evidence_text: `${item.template}\n\nDecision: the sponsor approved scope after we agreed the authority limits in writing. Evidence: the stakeholder register and the risk log both reference the same owner for the data-classification work.`,
      reflection: index < 4 ? 'I chose to fix ownership before touching the data model because unresolved ownership kept reappearing as a risk. The trade-off was two days of schedule.' : '',
      updated_at: '2026-10-08T21:14:00Z',
    });
  });
  artifacts.push({ artifact_key: 'retrospective-w5', status: 'complete', evidence_text: 'Decision I can now defend\nGrain before visuals.', reflection: 'Week 5 teach-back recorded.' });
  artifacts.push({ artifact_key: 'mock-pl300-1759900000000', status: 'complete', evidence_text: JSON.stringify({ certification: 'PL-300', score: 75, answered: 16, durationMinutes: 15 }), reflection: 'Timed original scenario drill.' });
  const attempts: Row[] = scenarioBank.slice(0, 9).map((question, index) => ({
    question_id: question.id,
    certification: question.certification,
    domain: question.domain,
    answer: index % 3 === 0 ? (question.correct === 'A' ? 'B' : 'A') : question.correct,
    correct: index % 3 === 0 ? 0 : 1,
    confidence: index % 4 === 1 ? 'low' : 'medium',
    created_at: '2026-10-09T18:00:00Z',
  }));
  return { profile, progress, attempts, artifacts };
}

let state: { profile: Row | null; progress: Row[]; attempts: Row[]; artifacts: Row[] } =
  fixture === 'fresh' ? { profile: null, progress: [], attempts: [], artifacts: [] } : midwayState();

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
      state = {
        ...state,
        attempts: [
          { question_id: body.questionId, certification: body.certification, domain: body.domain, answer: body.answer, correct: body.correct ? 1 : 0, confidence: body.confidence, created_at: new Date().toISOString() },
          ...state.attempts,
        ],
      };
      break;
    case 'save-artifact':
      state = {
        ...state,
        artifacts: [
          ...state.artifacts.filter((row) => row.artifact_key !== body.artifactKey),
          { artifact_key: body.artifactKey, status: body.status, evidence_text: body.evidenceText, reflection: body.reflection, updated_at: new Date().toISOString() },
        ],
      };
      break;
    default:
      return json({ error: 'Unsupported study action.' }, 400);
  }
  return json(state);
};

createRoot(document.getElementById('root')!).render(<TriCertApp />);
