// Hosted build of TriCert Lab: the unchanged app, with /api/state answered from the
// artifact's private per-viewer db document instead of the D1 route.
import { createRoot } from 'react-dom/client';
import TriCertApp from '@app/tricert-app';

type Row = Record<string, unknown>;
type State = { profile: Row | null; progress: Row[]; attempts: Row[]; artifacts: Row[] };
type DocRef = { get(): Promise<{ exists: boolean; data(): Row | undefined }>; set(data: Row): Promise<void> };

declare global {
  interface Window { claude?: { use(name: string): Promise<unknown> } }
}

const empty: State = { profile: null, progress: [], attempts: [], artifacts: [] };
let state: State = empty;
let docRef: DocRef | null = null;
let ready: Promise<void> | null = null;
let writeChain: Promise<void> = Promise.resolve();
let persistent = false;

async function connect() {
  const claude = window.claude;
  if (!claude) return;
  const [db, user] = (await Promise.all([claude.use('db'), claude.use('user')])) as [
    { doc(path: string): DocRef } | null,
    { id(): Promise<string | null> } | null,
  ];
  const id = user ? await user.id() : null;
  if (!db || !id) return;
  docRef = db.doc(`data/users/${id}/study/state`);
  const snap = await docRef.get();
  const data = snap.exists ? (snap.data() as Partial<State>) : undefined;
  if (data) {
    state = {
      profile: (data.profile as Row) ?? null,
      progress: (data.progress as Row[]) ?? [],
      attempts: (data.attempts as Row[]) ?? [],
      artifacts: (data.artifacts as Row[]) ?? [],
    };
  }
  persistent = true;
}

function persist() {
  if (!docRef) return Promise.resolve(true);
  const ref = docRef;
  const body = JSON.parse(JSON.stringify(state)) as Row;
  const next = writeChain.then(() => ref.set(body));
  writeChain = next.catch(() => undefined);
  return next.then(() => true, () => false);
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

const text = (value: unknown, max: number) => String(value ?? '').slice(0, max);
const num = (value: unknown, min: number, max: number) => Math.min(max, Math.max(min, Number(value) || 0));

function apply(body: Row): string | null {
  switch (body.action) {
    case 'save-profile':
      state = {
        ...state,
        profile: {
          education: text(body.education, 40),
          projects_led: text(body.projectsLed, 4000),
          pm_months: num(body.pmMonths, 0, 240),
          pm_training_hours: num(body.pmTrainingHours, 0, 500),
          pm_training_complete: body.pmTrainingComplete ? 1 : 0,
          cyber_months: num(body.cyberMonths, 0, 240),
          cyber_domains: JSON.stringify(Array.isArray(body.cyberDomains) ? body.cyberDomains.slice(0, 8) : []),
          power_bi_level: text(body.powerBiLevel, 20),
          power_query_level: text(body.powerQueryLevel, 20),
          dax_level: text(body.daxLevel, 20),
          sql_level: text(body.sqlLevel, 20),
          itil_level: text(body.itilLevel, 20),
          weekly_hours: num(body.weeklyHours, 1, 60),
          pmp_target: text(body.pmpTarget, 10),
          pl300_target: text(body.pl300Target, 10),
          cissp_target: text(body.cisspTarget, 10),
          itil_target: text(body.itilTarget, 10),
          display_name: text(body.displayName, 40),
          motivation: text(body.motivation, 140),
        },
      };
      return null;
    case 'save-personal':
      if (!state.profile) return 'Set up your plan before personalising it.';
      state = { ...state, profile: { ...state.profile, display_name: text(body.displayName, 40), motivation: text(body.motivation, 140) } };
      return null;
    case 'set-progress':
      state = {
        ...state,
        progress: [...state.progress.filter((row) => row.item_key !== body.itemKey), { item_key: text(body.itemKey, 120), status: body.status === 'complete' ? 'complete' : 'not_started' }],
      };
      return null;
    case 'record-attempt': {
      // Newest first; one row per question keeps the document bounded and matches how readiness reads it.
      const attempt = {
        question_id: text(body.questionId, 160),
        certification: text(body.certification, 20),
        domain: text(body.domain, 200),
        answer: text(body.answer, 4),
        correct: body.correct ? 1 : 0,
        confidence: text(body.confidence, 10),
        created_at: new Date().toISOString(),
      };
      state = { ...state, attempts: [attempt, ...state.attempts.filter((row) => row.question_id !== attempt.question_id)] };
      return null;
    }
    case 'save-artifact':
      state = {
        ...state,
        artifacts: [
          ...state.artifacts.filter((row) => row.artifact_key !== body.artifactKey),
          { artifact_key: text(body.artifactKey, 160), status: body.status === 'complete' ? 'complete' : 'draft', evidence_text: text(body.evidenceText, 20000), reflection: text(body.reflection, 6000), updated_at: new Date().toISOString() },
        ],
      };
      return null;
    default:
      return 'Unsupported study action.';
  }
}

const realFetch = window.fetch.bind(window);
window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  if (!url.startsWith('/api/state')) return realFetch(input, init);
  ready ??= connect().catch(() => undefined);
  await ready;
  if (!init || init.method !== 'PUT') return json(state);
  const before = state;
  const error = apply(JSON.parse(String(init.body)) as Row);
  if (error) return json({ error }, 400);
  if (!(await persist())) {
    state = before;
    return json({ error: 'Your change could not be saved. Check your connection and try again.' }, 500);
  }
  return json(state);
};

// Downloads: the frame cannot start downloads itself, so hand files to the viewer's save prompt.
const allowed = /\.(csv|md|txt|json|png|pdf|zip|html)$/i;
URL.revokeObjectURL = ((original) => (href: string) => { window.setTimeout(() => original.call(URL, href), 30000); })(URL.revokeObjectURL);
async function offer(href: string, filename: string) {
  const downloads = (await window.claude?.use('downloads')) as { save(req: { filename: string; data: Blob }): Promise<unknown> } | null;
  if (!downloads) return;
  const blob = await (await realFetch(href)).blob();
  const name = allowed.test(filename) ? filename : `${filename}.txt`;
  try { await downloads.save({ filename: name, data: blob }); } catch { /* declined or unavailable */ }
}
function nameFor(anchor: HTMLAnchorElement) {
  return anchor.getAttribute('download') || anchor.getAttribute('href')?.split('/').pop() || 'download.txt';
}
const originalClick = HTMLAnchorElement.prototype.click;
HTMLAnchorElement.prototype.click = function click(this: HTMLAnchorElement) {
  if (this.hasAttribute('download')) { void offer(this.href, nameFor(this)); return; }
  originalClick.call(this);
};
document.addEventListener('click', (event) => {
  const anchor = (event.target as Element | null)?.closest?.('a[download]') as HTMLAnchorElement | null;
  if (!anchor) return;
  event.preventDefault();
  void offer(anchor.href, nameFor(anchor));
}, true);

void persistent;
createRoot(document.getElementById('root')!).render(<TriCertApp />);
