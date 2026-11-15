/**
 * État du wizard de démarrage (fonctions pures). Stocké en JSON dans la table `settings`, clé `wizard_state`.
 * Toute valeur inattendue (sauvegarde ancienne, champ modifié à la main) retombe sur un état sûr : le wizard
 * repart du début plutôt que de planter.
 */

export const WIZARD_STEPS = ['welcome', 'start', 'import', 'verify', 'photo', 'enrich', 'cv', 'export'] as const;
export type WizardStep = (typeof WIZARD_STEPS)[number];

export const START_PATHS = ['cv', 'linkedin', 'scratch'] as const;
export type StartPath = (typeof START_PATHS)[number];

export const WIZARD_KEY = 'wizard_state';
const VERSION = 1;

export interface WizardState {
  version: number;
  /** Étape affichée. */
  step: WizardStep;
  /** Point de départ choisi à l'étape 2 (absent tant que non choisi). */
  startPath: StartPath | null;
  /** Étapes validées. */
  completed: WizardStep[];
  /** Étapes passées volontairement (comptent comme vues, sans être validées). */
  skipped: WizardStep[];
  /** Vrai une fois le guide terminé (écran 8 quitté). */
  finished: boolean;
  /** CV créé à l'écran 7 (repris à l'écran 8 pour l'export). */
  cvId: string | null;
}

export function initialWizardState(): WizardState {
  return { version: VERSION, step: 'welcome', startPath: null, completed: [], skipped: [], finished: false, cvId: null };
}

function isStep(v: unknown): v is WizardStep {
  return typeof v === 'string' && (WIZARD_STEPS as readonly string[]).includes(v);
}

function stepList(v: unknown): WizardStep[] {
  return Array.isArray(v) ? [...new Set(v.filter(isStep))] : [];
}

/** Lit l'état enregistré ; accepte une chaîne JSON ou un objet, et corrige ce qui est inattendu. */
export function parseWizardState(raw: unknown): WizardState {
  let value: unknown = raw;
  if (typeof raw === 'string') {
    try { value = JSON.parse(raw); } catch { return initialWizardState(); }
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return initialWizardState();
  const o = value as Record<string, unknown>;
  const startPath = (START_PATHS as readonly unknown[]).includes(o.startPath) ? (o.startPath as StartPath) : null;
  return {
    version: VERSION,
    step: isStep(o.step) ? o.step : 'welcome',
    startPath,
    completed: stepList(o.completed),
    skipped: stepList(o.skipped),
    finished: o.finished === true,
    cvId: typeof o.cvId === 'string' && o.cvId.trim() ? o.cvId : null,
  };
}

export function serializeWizardState(state: WizardState): string {
  return JSON.stringify({ ...state, version: VERSION });
}

/** Étape suivante (la dernière reste la dernière). */
export function nextStep(step: WizardStep): WizardStep {
  const i = WIZARD_STEPS.indexOf(step);
  return WIZARD_STEPS[Math.min(i + 1, WIZARD_STEPS.length - 1)];
}

export function previousStep(step: WizardStep): WizardStep {
  const i = WIZARD_STEPS.indexOf(step);
  return WIZARD_STEPS[Math.max(i - 1, 0)];
}

/** Valide l'étape courante et passe à la suivante. */
export function completeStep(state: WizardState, step: WizardStep = state.step): WizardState {
  const completed = state.completed.includes(step) ? state.completed : [...state.completed, step];
  return { ...state, completed, skipped: state.skipped.filter(s => s !== step), step: nextStep(step) };
}

/** Passe l'étape sans la valider. */
export function skipStep(state: WizardState, step: WizardStep = state.step): WizardState {
  const skipped = state.skipped.includes(step) ? state.skipped : [...state.skipped, step];
  return { ...state, skipped, step: nextStep(step) };
}

export function goToStep(state: WizardState, step: WizardStep): WizardState {
  return { ...state, step };
}

export function chooseStartPath(state: WizardState, startPath: StartPath): WizardState {
  return { ...state, startPath };
}

/** Mémorise le CV créé par le guide (null pour l'oublier, par exemple s'il a été supprimé). */
export function setWizardCv(state: WizardState, cvId: string | null): WizardState {
  return { ...state, cvId };
}

export function finishWizard(state: WizardState): WizardState {
  return { ...state, finished: true, completed: state.completed.includes('export') ? state.completed : [...state.completed, 'export'] };
}

/** « Revoir le guide » : on repart de l'accueil, les données du profil ne sont pas touchées. */
export function restartWizard(state: WizardState): WizardState {
  return { ...initialWizardState(), startPath: state.startPath };
}

/** Part de l'avancement : étapes validées ou passées, sur le total. */
export function wizardProgress(state: WizardState): number {
  const done = new Set([...state.completed, ...state.skipped]);
  return Math.round((done.size / WIZARD_STEPS.length) * 100);
}

/** Le guide s'ouvre seul au premier lancement : aucun état enregistré, profil vide. */
export function shouldOpenAutomatically(saved: unknown, profileIsEmpty: boolean): boolean {
  if (saved !== null && saved !== undefined && saved !== '') return false;
  return profileIsEmpty;
}
