/**
 * Seconde passe après les remarques de l'IA : le candidat répond aux questions du rapport
 * (questions de l'IA, exigences non couvertes, points à vérifier), puis une IA corrige la première
 * version. La réponse repasse par le même garde-fou (`analyzeAiCvJson`) ; le candidat voit chaque
 * changement (`diffAiCv`) et choisit un par un ceux qu'il garde (`mergeAiCv`). Rien n'est appliqué
 * au CV sans son clic sur « Appliquer ». Fonctions pures.
 */
import type { MasterEntry, Profile } from '@/types/profile';
import type { AiCvEntry, AiCvResponse } from './ai-cv-response';
import type { GuardCode, GuardReport } from './ai-cv-guard';
import {
  buildContext, buildMasterProfile, buildOutputSchema, buildRules, type CvPromptInput, type CvPromptOptions,
} from './cv-prompt';
import { buildAssertiveness, buildGenericTarget } from './cv-generic-prompt';
import { buildTargetBlock } from './cv-target-prompt';
import { resolveTarget, wordingModeFor, type ResolvedTarget } from './cv-targets';
import { parseHeaderExtras } from './header-extras';
import { normalizeLabel } from './cv-sections';
import { displayTitle } from './entry-display';
import { DEFAULT_BULLET_FOCUS, DEFAULT_VERB_TENSE } from './cv-focus-rules';
import type { CvIntent } from './cv-intent';

// ── Questions ────────────────────────────────────────────────────────────────

/** `question` : posée par l'IA ; `ecart` : exigence non couverte ; `verification` : point signalé par le contrôle. */
export type FollowUpKind = 'question' | 'ecart' | 'verification';

export interface FollowUpQuestion {
  /** Clé stable (type + texte normalisé) : une réponse enregistrée retrouve sa question. */
  key: string;
  kind: FollowUpKind;
  /** Texte affiché au candidat et envoyé à l'IA. */
  text: string;
}

export const FOLLOW_UP_KIND_LABELS: Readonly<Record<FollowUpKind, string>> = {
  question: "Question de l'IA",
  ecart: 'Exigence non couverte',
  verification: 'Point à vérifier',
};

/** Avertissements du contrôle qui portent sur un fait : le candidat peut le confirmer ou l'infirmer. */
const VERIFY_CODES: ReadonlySet<GuardCode> = new Set<GuardCode>([
  'unsourced-term', 'unsupported-title', 'cv-skill-unsourced', 'skill-item-invented', 'header-extra-invented',
]);

export function followUpKey(kind: FollowUpKind, text: string): string {
  return `${kind}:${normalizeLabel(text).slice(0, 200)}`;
}

/**
 * Questions à poser après une analyse : questions et remarques de l'IA, exigences non couvertes,
 * points bloquants et avertissements portant sur un fait. Doublons retirés, ordre du rapport conservé.
 */
export function collectFollowUps(report: GuardReport): FollowUpQuestion[] {
  const out: FollowUpQuestion[] = [];
  const seen = new Set<string>();
  const push = (kind: FollowUpKind, text: string) => {
    const t = text.trim();
    if (!t) return;
    const key = followUpKey(kind, t);
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ key, kind, text: t });
  };
  for (const w of report.aiWarnings) push('question', w);
  for (const e of report.metrics.ecarts) {
    push('ecart', `Votre profil ne montre pas « ${e} ». Si vous l'avez fait, dites dans quel poste et comment ; sinon, laissez vide.`);
  }
  for (const issue of [...report.errors, ...report.warnings.filter(w => VERIFY_CODES.has(w.code))]) {
    push('verification', `${issue.message} Est-ce exact ? Si oui, précisez d'où cela vient ; sinon, laissez vide et ce point sera retiré.`);
  }
  return out;
}

// ── Réponses enregistrées dans le CV ─────────────────────────────────────────

/** Clé des réponses dans `cv.settings` : retrouvées à la réouverture, source pour le garde-fou. */
export const AI_FOLLOW_UP_SETTING = 'aiFollowUp';
export const MAX_FOLLOW_UP_ANSWER_CHARS = 800;

export type FollowUpAnswers = Record<string, string>;

export function readFollowUpAnswers(settings: Record<string, unknown> | null | undefined): FollowUpAnswers {
  const raw = settings?.[AI_FOLLOW_UP_SETTING];
  const answers = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>).answers : undefined;
  const out: FollowUpAnswers = {};
  if (answers && typeof answers === 'object' && !Array.isArray(answers)) {
    for (const [k, v] of Object.entries(answers as Record<string, unknown>)) {
      if (typeof v === 'string' && v.trim()) out[k] = v.slice(0, MAX_FOLLOW_UP_ANSWER_CHARS);
    }
  }
  return out;
}

/** Réglages du CV avec les réponses (les réponses vides ne sont pas gardées) ; les autres réglages sont conservés. */
export function withFollowUpAnswers(settings: Record<string, unknown> | null | undefined, answers: FollowUpAnswers): Record<string, unknown> {
  const kept: FollowUpAnswers = {};
  for (const [k, v] of Object.entries(answers)) if (v.trim()) kept[k] = v.trim().slice(0, MAX_FOLLOW_UP_ANSWER_CHARS);
  return { ...(settings ?? {}), [AI_FOLLOW_UP_SETTING]: { answers: kept } };
}

/** Ce que le candidat affirme dans ses réponses : source au même titre que le profil pour le garde-fou. */
export function followUpSourceText(answers: FollowUpAnswers): string {
  return Object.values(answers).map(v => v.trim()).filter(Boolean).join('\n');
}

// ── Prompt de la seconde passe ───────────────────────────────────────────────

/** Le CV de la première passe tel que l'IA l'a écrit (clés du schéma, sans la proposition de ciblage). */
export function toSchemaJson(data: AiCvResponse): string {
  const { analyse, ...rest } = data;
  const out: Record<string, unknown> = { schemaVersion: 2 };
  if (analyse) {
    const { langueAnnonce, alertesCap, cible: _cible, ...others } = analyse;
    out.analyse = {
      ...(langueAnnonce ? { langue_annonce: langueAnnonce } : {}),
      ...others,
      ...(alertesCap ? { alertes_cap: alertesCap } : {}),
    };
  }
  return JSON.stringify({ ...out, ...rest, schemaVersion: 2 }, null, 2);
}

export type FollowUpMode =
  | { kind: 'offer'; jobOfferText: string; target: ResolvedTarget; targetCompany?: string }
  | { kind: 'generic'; intent: CvIntent };

export interface FollowUpPromptInput {
  profile: Profile;
  entries: MasterEntry[];
  /** Première version, déjà passée par le garde-fou. */
  current: AiCvResponse;
  questions: readonly FollowUpQuestion[];
  answers: FollowUpAnswers;
  mode: FollowUpMode;
  options?: Omit<CvPromptOptions, 'target' | 'cibleAxes' | 'angle' | 'angleChoices'>;
}

/** Règle ajoutée à l'anti-invention : les réponses de la seconde passe sont une source, à reprendre sans amplifier. */
export const FOLLOW_UP_ANSWERS_RULE =
  "- Les réponses du candidat (section « Questions et réponses ») comptent comme source au même titre que le profil maître : un fait, un chiffre ou un outil qu'il y énonce peut être repris tel quel, jamais amplifié. Elles ne servent pas à remplir \"suggestedEntries\".";

export const FOLLOW_UP_RULES = `## Règles de la seconde passe
- Modifie uniquement ce qu'une réponse justifie : la puce, l'accroche, le titre, la compétence ou la visibilité concernés. Recopie tout le reste à l'identique : mêmes IDs, même ordre, mêmes textes.
- Une réponse apporte un fait : reprends-le avec les mots et les chiffres du candidat, dans l'entrée à laquelle il se rattache. Si tu ne sais pas laquelle, laisse le CV tel quel et repose la question dans "warnings".
- Point à vérifier sans réponse, ou que le candidat dit inexact : retire le chiffre, le terme ou l'élément signalé, sauf si une autre de ses réponses le confirme.
- Exigence non couverte sans réponse : elle reste dans analyse.ecarts et rien n'est ajouté.
- "warnings" ne contient que les questions encore ouvertes : ne repose jamais une question à laquelle le candidat a répondu.`;

function questionsBlock(questions: readonly FollowUpQuestion[], answers: FollowUpAnswers): string {
  const lines = questions.map((q, i) => {
    const a = answers[q.key]?.trim();
    return `${i + 1}. [${FOLLOW_UP_KIND_LABELS[q.kind]}] ${q.text}\n   Réponse : ${a ? a.replace(/\s*\n\s*/g, ' ') : '(sans réponse)'}`;
  });
  return `## Questions et réponses du candidat (ses réponses sont une source au même titre que le profil maître)
${lines.length > 0 ? lines.join('\n') : '(aucune question)'}`;
}

/** Assemble le prompt de la seconde passe : même profil, mêmes règles, même schéma que la première. */
export function buildFollowUpPrompt(input: FollowUpPromptInput): string {
  const { profile, entries, mode } = input;
  const generic = mode.kind === 'generic';
  const target = generic ? resolveTarget({ intent: 'spontanee' }) : mode.target;
  const jobOfferText = generic ? '' : mode.jobOfferText;
  const options: CvPromptOptions = {
    ...input.options,
    ...(generic ? { pageBudget: mode.intent.pages, cvLanguage: mode.intent.language } : {}),
    target,
    cibleAxes: [],
  };
  const base: CvPromptInput = { profile, entries, jobOfferText, targetCompany: generic ? undefined : mode.targetCompany, options };
  const wording = wordingModeFor(target, jobOfferText);
  const personal = Boolean(options.personalRules?.trim());
  const rules = buildRules(base).replace(
    '### Anti-invention (règle absolue)\n',
    `### Anti-invention (règle absolue)\n${FOLLOW_UP_ANSWERS_RULE}\n`,
  );
  return [
    `# Rôle
Tu es ${generic ? "un coach de carrière, tous secteurs et tous métiers confondus, doublé d'un recruteur expérimenté" : 'un recruteur senior, tous secteurs et tous métiers confondus, et expert ATS'}. Tu corriges la première version d'un CV à partir des réponses du candidat, sans jamais rien inventer.`,
    `## Objectif
Renvoyer UN objet JSON complet (schéma en fin de prompt), qui reprend la première version ci-dessous et la corrige seulement là où les réponses du candidat le justifient.`,
    buildContext(base),
    buildMasterProfile(entries, profile),
    generic ? buildGenericTarget(mode.intent) : buildTargetBlock(target, { mode: wording }),
    generic ? buildAssertiveness(mode.intent.assertiveness) : '',
    `## Première version du CV (JSON, déjà contrôlée)
<<<
${toSchemaJson(input.current)}
>>>`,
    questionsBlock(input.questions, input.answers),
    FOLLOW_UP_RULES,
    rules,
    buildOutputSchema({
      alertesCap: personal,
      header: Boolean(profile.drivingLicense?.trim()) || parseHeaderExtras(profile.headerExtras).length > 0,
      bulletFocus: options.bulletFocus ?? DEFAULT_BULLET_FOCUS,
      verbTense: options.verbTense ?? DEFAULT_VERB_TENSE,
      mode: wording,
      cibleAxes: [],
    }),
  ].filter(Boolean).join('\n\n');
}

// ── Changements entre deux versions ──────────────────────────────────────────

export interface AiCvChange {
  /** Clé de choix (`title`, `summary`, `entry:<id>:<champ>`, ou nom d'un champ global). */
  key: string;
  /** Libellé lisible : « Accroche », « Assistante commerciale : puces »… */
  label: string;
  before: string;
  after: string;
}

const ENTRY_FIELDS = ['visible', 'description', 'titleOverride', 'subtitleOverride', 'datesOverride'] as const;
type EntryField = (typeof ENTRY_FIELDS)[number];
const ENTRY_FIELD_LABELS: Readonly<Record<EntryField, string>> = {
  visible: 'affichage', description: 'puces', titleOverride: 'intitulé affiché', subtitleOverride: 'libellé secondaire', datesOverride: 'dates affichées',
};

/** Champs globaux comparés en bloc, avec leur libellé. */
const GLOBAL_FIELDS = [
  ['cvSkills', "Compétences ajoutées par l'IA"],
  ['skillGroups', 'Regroupement des compétences'],
  ['mergedEntries', 'Expériences regroupées sur une ligne'],
  ['entryOrder', 'Ordre des éléments'],
  ['sectionOrder', 'Ordre des sections'],
  ['sectionLabels', 'Titres des sections'],
  ['header', "Mentions de l'en-tête"],
] as const;
type GlobalField = (typeof GLOBAL_FIELDS)[number][0];

const NONE = '(rien)';

function entryValue(e: AiCvEntry | undefined, field: EntryField): string {
  if (field === 'visible') return e === undefined || e.visible ? 'Affichée' : 'Masquée';
  const v = e?.[field];
  return typeof v === 'string' && v.trim() ? v : NONE;
}

function globalValue(data: AiCvResponse, field: GlobalField, labelOf: (id: string) => string): string {
  const v = data[field];
  if (v === undefined || (Array.isArray(v) && v.length === 0)) return NONE;
  switch (field) {
    case 'cvSkills': return data.cvSkills!.map(s => s.name).join(' · ');
    case 'entryOrder': return data.entryOrder!.map(labelOf).join(' → ');
    case 'sectionOrder': return data.sectionOrder!.join(' → ');
    case 'skillGroups': return data.skillGroups!.map(g => `${g.category} : ${g.entryIds.map(labelOf).join(', ')}`).join(' ; ');
    case 'mergedEntries': return data.mergedEntries!.map(g => `${g.titleOverride ?? ''} (${g.ids.map(labelOf).join(', ')})`.trim()).join(' ; ');
    case 'sectionLabels': return Object.entries(data.sectionLabels!).map(([k, l]) => `${k} : ${l}`).join(' ; ');
    case 'header': {
      const h = data.header!;
      return [h.showDrivingLicense === undefined ? '' : `Permis ${h.showDrivingLicense ? 'affiché' : 'masqué'}`, ...(h.extras ?? [])].filter(Boolean).join(' · ') || NONE;
    }
  }
}

/** Changements de la seconde version par rapport à la première, dans l'ordre du CV. */
export function diffAiCv(before: AiCvResponse, after: AiCvResponse, entries: readonly MasterEntry[]): AiCvChange[] {
  const byId = new Map(entries.map(e => [e.id, e] as const));
  const labelOf = (id: string) => {
    const e = byId.get(id);
    return e ? displayTitle(e.title, e.subtitle) : id;
  };
  const changes: AiCvChange[] = [];
  const add = (key: string, label: string, b: string, a: string) => { if (b !== a) changes.push({ key, label, before: b, after: a }); };

  add('title', 'Titre du CV', before.title?.trim() || NONE, after.title?.trim() || NONE);
  add('summary', 'Accroche', before.summary?.trim() || NONE, after.summary?.trim() || NONE);

  const beforeById = new Map(before.entries.map(e => [e.id, e] as const));
  const afterById = new Map(after.entries.map(e => [e.id, e] as const));
  const ids = [...new Set([...before.entries.map(e => e.id), ...after.entries.map(e => e.id)])];
  for (const id of ids) {
    for (const field of ENTRY_FIELDS) {
      add(`entry:${id}:${field}`, `${labelOf(id)} : ${ENTRY_FIELD_LABELS[field]}`, entryValue(beforeById.get(id), field), entryValue(afterById.get(id), field));
    }
  }
  for (const [field, label] of GLOBAL_FIELDS) {
    if (JSON.stringify(before[field] ?? null) === JSON.stringify(after[field] ?? null)) continue;
    changes.push({ key: field, label, before: globalValue(before, field, labelOf), after: globalValue(after, field, labelOf) });
  }
  return changes;
}

/**
 * Version finale : la première version, plus les seuls changements choisis par le candidat. L'analyse
 * et les questions restantes viennent de la seconde version ; les entrées suggérées restent celles de
 * la première (une seconde passe ne propose rien de nouveau pour « Mon profil »).
 */
export function mergeAiCv(before: AiCvResponse, after: AiCvResponse, accepted: ReadonlySet<string>): AiCvResponse {
  const result: AiCvResponse = structuredClone(before);
  for (const key of ['title', 'summary'] as const) {
    if (!accepted.has(key)) continue;
    if (after[key] === undefined) delete result[key]; else result[key] = after[key];
  }

  const afterById = new Map(after.entries.map(e => [e.id, e] as const));
  const entries = result.entries.map(e => ({ ...e }));
  const index = new Map(entries.map((e, i) => [e.id, i] as const));
  for (const id of [...new Set(after.entries.map(e => e.id))]) {
    if (!index.has(id)) { index.set(id, entries.length); entries.push({ id, visible: true }); }
  }
  for (const key of accepted) {
    const m = /^entry:(.+):(visible|description|titleOverride|subtitleOverride|datesOverride)$/.exec(key);
    if (!m) continue;
    const [, id, field] = m as unknown as [string, string, EntryField];
    const target = entries[index.get(id)!];
    if (!target) continue;
    const source = afterById.get(id);
    if (field === 'visible') target.visible = source === undefined ? true : source.visible;
    else if (source?.[field] === undefined) delete target[field];
    else target[field] = source[field];
  }
  // Une entrée ajoutée seulement pour un changement refusé n'a rien à faire dans la liste.
  result.entries = entries.filter(e => before.entries.some(b => b.id === e.id) || [...accepted].some(k => k.startsWith(`entry:${e.id}:`)));

  for (const [field] of GLOBAL_FIELDS) {
    if (!accepted.has(field)) continue;
    if (after[field] === undefined) delete result[field];
    else (result as unknown as Record<string, unknown>)[field] = structuredClone(after[field]);
  }
  if (after.analyse) result.analyse = structuredClone(after.analyse);
  if (after.warnings === undefined) delete result.warnings; else result.warnings = [...after.warnings];
  return result;
}
