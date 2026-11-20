/**
 * « CV standard » : l'utilisateur répond à quelques questions simples (poste visé, secteur, niveau, ce qu'il
 * veut montrer, expériences à privilégier ou à laisser de côté, longueur, langue). Ces réponses :
 *  1. produisent une proposition de CV calculée localement, SANS IA (`proposeCv`), que l'utilisateur
 *     relit, modifie et applique explicitement ;
 *  2. alimentent, si l'utilisateur le souhaite, le prompt d'une IA (`intentToTarget`).
 *
 * Aucune donnée n'est inventée : titre, accroche et sélection ne reprennent que des faits du profil.
 * Fonctions pures.
 */
import type { EntryType, MasterEntry, Profile } from '@/types/profile';
import type { AiCvResponse } from './ai-cv-response';
import type { TargetChoice } from './cv-targets';
import { DEFAULT_ANGLES } from './cv-angles';
import { normalizeLabel } from './cv-sections';

export const LEVELS = ['debutant', 'confirme', 'expert', 'encadrement'] as const;
export type Level = (typeof LEVELS)[number];
export const LEVEL_LABELS: Readonly<Record<Level, string>> = {
  debutant: 'Je débute',
  confirme: 'Je suis confirmé(e)',
  expert: 'Je suis expert(e)',
  encadrement: "J'encadre une équipe",
};

export const HIGHLIGHTS = ['expertise', 'polyvalence', 'reconversion', 'management', 'resultats'] as const;
export type Highlight = (typeof HIGHLIGHTS)[number];
export const HIGHLIGHT_LABELS: Readonly<Record<Highlight, string>> = {
  expertise: 'Mon expertise',
  polyvalence: 'Ma polyvalence',
  reconversion: 'Ma reconversion',
  management: "Mes responsabilités d'encadrement",
  resultats: 'Mes résultats chiffrés',
};

/** Statut d'une expérience pour ce CV. */
export type EntryPreference = 'prefer' | 'normal' | 'exclude';

/** Niveau d'affirmation du CV rédigé par une IA : le ton change, jamais les faits. */
export const ASSERTIVENESS = ['sobre', 'equilibre', 'affirme'] as const;
export type Assertiveness = (typeof ASSERTIVENESS)[number];
export const ASSERTIVENESS_LABELS: Readonly<Record<Assertiveness, string>> = {
  sobre: 'Sobre',
  equilibre: 'Équilibré',
  affirme: 'Affirmé',
};
/** Explication affichée sous chaque valeur du réglage. */
export const ASSERTIVENESS_HINTS: Readonly<Record<Assertiveness, string>> = {
  sobre: 'Des faits présentés simplement, sans mise en avant appuyée.',
  equilibre: 'Vos réalisations en premier, avec des verbes d\'action concrets.',
  affirme: 'Vos points forts assumés, avec des mots plus forts, toujours sans rien exagérer.',
};
export const DEFAULT_ASSERTIVENESS: Assertiveness = 'equilibre';

export interface CvIntent {
  /** 1. Poste ou type de missions recherché. */
  role: string;
  sector: string;
  /** 2. Environnement où le candidat s'épanouit. */
  environment: string;
  /** 3. Ce qu'il fait avec aisance. */
  ease: string;
  /** 4. Réalisations dont il est fier. */
  achievements: string;
  /** 5. Ce que l'on doit retenir en premier. */
  highlights: Highlight[];
  /** 6. Niveau. */
  level: Level;
  /** 7. Ce qu'il ne veut plus faire. */
  avoid: string;
  /** Préférence par identifiant d'entrée (absent : normal). */
  preferences: Record<string, EntryPreference>;
  pages: 1 | 2;
  language: 'fr' | 'en';
  /** Niveau d'affirmation du texte rédigé par une IA (sans effet sur la proposition locale). */
  assertiveness: Assertiveness;
}

export const DEFAULT_INTENT: CvIntent = {
  role: '', sector: '', environment: '', ease: '', achievements: '', highlights: [], level: 'confirme', avoid: '',
  preferences: {}, pages: 1, language: 'fr', assertiveness: DEFAULT_ASSERTIVENESS,
};

/** Libellés des questions ouvertes (écran et prompt partagent ces textes). */
export const INTENT_QUESTIONS = {
  role: 'Quel poste ou quel type de missions recherchez-vous ?',
  environment: 'Dans quel environnement vous épanouissez-vous ?',
  ease: "Qu'est-ce que vous faites avec aisance ?",
  achievements: 'De quelles réalisations êtes-vous fier(e) ?',
  highlights: 'Que doit-on retenir de vous en premier ?',
  level: 'Quel est votre niveau ?',
  avoid: 'Que ne voulez-vous plus faire ?',
} as const;

/** Clé des réponses dans `cv.settings` : elles sont retrouvées à la réouverture et servent de source au garde-fou. */
export const CV_INTENT_SETTING = 'cvIntent';

/** Longueur maximale d'une réponse libre (quelques phrases). */
export const MAX_ANSWER_CHARS = 500;

const text = (v: unknown): string => (typeof v === 'string' ? v.slice(0, MAX_ANSWER_CHARS) : '');
const oneOf = <T extends string>(v: unknown, values: readonly T[], fallback: T): T =>
  (typeof v === 'string' && (values as readonly string[]).includes(v) ? (v as T) : fallback);

/**
 * Réponses enregistrées dans `cv.settings.cvIntent`, lues avec tolérance : champ absent ou
 * inattendu = valeur par défaut (réponses d'une version précédente comprises). `null` sans réponses.
 */
export function readCvIntent(settings: Record<string, unknown> | null | undefined): CvIntent | null {
  const raw = settings?.[CV_INTENT_SETTING];
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const preferences: Record<string, EntryPreference> = {};
  if (r.preferences && typeof r.preferences === 'object' && !Array.isArray(r.preferences)) {
    for (const [id, v] of Object.entries(r.preferences as Record<string, unknown>)) {
      if (v === 'prefer' || v === 'exclude') preferences[id] = v;
    }
  }
  return {
    role: text(r.role),
    sector: text(r.sector),
    environment: text(r.environment),
    ease: text(r.ease),
    achievements: text(r.achievements),
    highlights: Array.isArray(r.highlights) ? HIGHLIGHTS.filter(h => (r.highlights as unknown[]).includes(h)) : [],
    level: oneOf(r.level, LEVELS, DEFAULT_INTENT.level),
    avoid: text(r.avoid),
    preferences,
    pages: r.pages === 2 ? 2 : 1,
    language: r.language === 'en' ? 'en' : 'fr',
    assertiveness: oneOf(r.assertiveness, ASSERTIVENESS, DEFAULT_ASSERTIVENESS),
  };
}

/** Réglages du CV avec les réponses enregistrées ; les autres réglages sont conservés. */
export function withCvIntent(settings: Record<string, unknown> | null | undefined, intent: CvIntent): Record<string, unknown> {
  return { ...(settings ?? {}), [CV_INTENT_SETTING]: intent };
}

/**
 * Ce que le candidat affirme lui-même dans ses réponses : source au même titre que le profil pour
 * le garde-fou (un chiffre qu'il y écrit peut être repris). « Ce qu'il ne veut plus faire » n'est
 * pas une source de faits et n'y figure pas.
 */
export function candidateAnswersText(intent: CvIntent | null | undefined): string {
  if (!intent) return '';
  return [intent.role, intent.sector, intent.environment, intent.ease, intent.achievements]
    .map(t => t.trim()).filter(Boolean).join('\n');
}

// ── Texte → mots comparables ─────────────────────────────────────────────────

const STOP = new Set(['de', 'du', 'des', 'la', 'le', 'les', 'un', 'une', 'et', 'en', 'au', 'aux', 'pour', 'par', 'sur', 'avec', 'dans', 'chez', 'the', 'and', 'of']);

export function tokens(text: string): Set<string> {
  const out = new Set<string>();
  for (const raw of normalizeLabel(text).split(/[^a-z0-9]+/)) {
    if (raw.length < 3 || STOP.has(raw)) continue;
    out.add(raw.length > 4 && raw.endsWith('s') ? raw.slice(0, -1) : raw);
  }
  return out;
}

const MANAGEMENT_WORDS = ['equipe', 'encadr', 'manag', 'pilot', 'anim', 'responsable', 'dirig', 'coordin'];

function entryText(e: MasterEntry): string {
  return [e.title, e.subtitle, e.description, ...(e.tags ?? [])].filter(Boolean).join(' ');
}

function overlap(target: Set<string>, text: string): number {
  if (target.size === 0) return 0;
  const t = tokens(text);
  let n = 0;
  for (const w of target) if (t.has(w)) n++;
  return n;
}

function startKey(e: MasterEntry): string {
  return e.isCurrent ? '9999-99' : (e.endDate ?? e.startDate ?? '0000');
}

/** Mois (index absolu) d'une date « AAAA-MM » ou « AAAA » ; `end` : fin du mois (ou de l'année). */
function monthIndex(raw: string, end: boolean): number | null {
  const m = /^(\d{4})(?:-(\d{1,2}))?/.exec(raw.trim());
  if (!m) return null;
  const year = Number(m[1]);
  if (year < 1950 || year > 2100) return null;
  const month = m[2] ? Math.min(12, Math.max(1, Number(m[2]))) : end ? 12 : 1;
  return year * 12 + (month - 1);
}

export interface ExperienceSpan {
  /** Mois couverts, périodes qui se chevauchent comptées une seule fois, trous ignorés. */
  months: number;
  /** Années entières (arrondi à l'inférieur, pour ne jamais surévaluer). */
  years: number;
  /** Première année d'activité retenue (`null` si aucune date exploitable). */
  firstYear: number | null;
  /** Nombre de périodes sans date exploitable, ignorées. */
  ignored: number;
}

/** Durée cumulée des expériences : union des intervalles (un poste en parallèle ne compte pas deux fois). */
export function experienceSpan(
  entries: readonly MasterEntry[],
  now: Date,
  keep: (e: MasterEntry) => boolean = () => true,
): ExperienceSpan {
  const nowIdx = now.getUTCFullYear() * 12 + now.getUTCMonth();
  const intervals: [number, number][] = [];
  let ignored = 0;
  for (const e of entries) {
    if (e.entryType !== 'experience' || !keep(e)) continue;
    const start = e.startDate ? monthIndex(e.startDate, false) : null;
    if (start === null) { ignored++; continue; }
    const endRaw = e.isCurrent || !e.endDate ? null : e.endDate;
    const end = endRaw ? monthIndex(endRaw, true) : nowIdx;
    if (end === null || end < start) { ignored++; continue; }
    intervals.push([start, end]);
  }
  intervals.sort((a, b) => a[0] - b[0]);
  let months = 0;
  let cur: [number, number] | null = null;
  for (const [a, b] of intervals) {
    if (cur && a <= cur[1] + 1) cur[1] = Math.max(cur[1], b);
    else {
      if (cur) months += cur[1] - cur[0] + 1;
      cur = [a, b];
    }
  }
  if (cur) months += cur[1] - cur[0] + 1;
  return {
    months,
    years: Math.floor(months / 12),
    firstYear: intervals.length ? Math.floor(intervals[0][0] / 12) : null,
    ignored,
  };
}

/** Années d'expérience totales (compatibilité). */
export function yearsOfExperience(entries: readonly MasterEntry[], now: Date): number {
  return experienceSpan(entries, now).years;
}

/** Expériences dont le titre correspond au métier visé (mots communs après normalisation). */
export function roleExperienceSpan(entries: readonly MasterEntry[], now: Date, role: string): ExperienceSpan | null {
  const target = tokens(role);
  if (target.size === 0) return null;
  return experienceSpan(entries, now, e => overlap(target, e.title) > 0);
}

// ── Proposition locale (sans IA) ─────────────────────────────────────────────

export interface ProposalItem {
  id: string;
  type: EntryType;
  label: string;
  include: boolean;
  /** Pourquoi cette entrée est proposée ou écartée, en une phrase. */
  reason: string;
}

export interface CvProposal {
  title: string;
  summary: string;
  /** Chiffres calculés, présentés à la personne pour qu'elle les valide ou les corrige. */
  experience: {
    totalYears: number;
    firstYear: number | null;
    roleYears: number | null;
    roleLabel: string;
    ignored: number;
  };
  items: ProposalItem[];
  /** Libellés standard des sections, dans l'ordre proposé. */
  sectionOrder: string[];
  /** Explications générales, à afficher à l'utilisateur. */
  notes: string[];
}

export const SECTION_BY_TYPE: Readonly<Record<EntryType, string>> = {
  experience: 'Expériences Professionnelles',
  education: 'Formations',
  skill: 'Compétences',
  certification: 'Certifications',
  language: 'Langues',
  project: 'Projets',
  volunteer: 'Bénévolat',
  interest: "Centres d'intérêt",
};

function label(e: MasterEntry): string {
  return e.subtitle ? `${e.title} (${e.subtitle})` : e.title;
}

/** Nombre d'expériences conseillé selon la longueur visée. */
export function experienceBudget(pages: 1 | 2): number {
  return pages === 1 ? 4 : 7;
}

export function proposeCv(intent: CvIntent, entries: readonly MasterEntry[], profile: Pick<Profile, 'title'> | null, now: Date): CvProposal {
  const target = tokens(`${intent.role} ${intent.sector}`);
  const wantsManagement = intent.highlights.includes('management') || intent.level === 'encadrement';
  const beginner = intent.level === 'debutant' || intent.highlights.includes('reconversion');
  const notes: string[] = [];
  const items: ProposalItem[] = [];
  const pref = (id: string): EntryPreference => intent.preferences[id] ?? 'normal';

  const byType = (type: EntryType) => entries.filter(e => e.entryType === type);

  // Expériences : récentes d'abord, rapprochement avec le poste visé, préférences de l'utilisateur.
  const experiences = byType('experience').map(e => {
    const text = entryText(e);
    let score = overlap(target, text) * 3;
    if (wantsManagement && MANAGEMENT_WORDS.some(w => normalizeLabel(text).includes(w))) score += 2;
    if (pref(e.id) === 'prefer') score += 100;
    return { e, score, key: startKey(e) };
  });
  const ranked = [...experiences].sort((a, b) => b.score - a.score || b.key.localeCompare(a.key));
  const budget = experienceBudget(intent.pages);
  const kept = new Set<string>();
  for (const { e } of ranked) {
    if (pref(e.id) === 'exclude') continue;
    if (kept.size < budget) kept.add(e.id);
  }
  // Toujours garder l'expérience en cours (sauf si exclue) : un CV sans elle laisse un trou.
  const current = experiences.find(x => x.e.isCurrent && pref(x.e.id) !== 'exclude');
  if (current && !kept.has(current.e.id)) {
    const weakest = [...kept].map(id => experiences.find(x => x.e.id === id)!).sort((a, b) => a.score - b.score)[0];
    if (weakest && pref(weakest.e.id) !== 'prefer') kept.delete(weakest.e.id);
    kept.add(current.e.id);
  }
  for (const { e, score } of [...experiences].sort((a, b) => b.key.localeCompare(a.key))) {
    const include = kept.has(e.id);
    items.push({
      id: e.id, type: 'experience', label: label(e), include,
      reason: pref(e.id) === 'exclude' ? 'Vous avez choisi de la laisser de côté.'
        : pref(e.id) === 'prefer' ? 'Vous avez choisi de la privilégier.'
        : include ? (score > 0 ? 'Proche du poste visé.' : e.isCurrent ? 'Votre poste actuel.' : 'Expérience récente.')
        : `Plus ancienne ou moins proche du poste visé : ${intent.pages === 1 ? 'elle ne tiendrait pas sur une page' : 'pour garder un CV lisible'}.`,
    });
  }
  const dropped = items.filter(i => i.type === 'experience' && !i.include && pref(i.id) !== 'exclude').length;
  if (dropped > 0) notes.push(`${dropped} expérience${dropped > 1 ? 's' : ''} ancienne${dropped > 1 ? 's' : ''} ou éloignée${dropped > 1 ? 's' : ''} du poste visé n'${dropped > 1 ? 'ont' : 'a'} pas été retenue${dropped > 1 ? 's' : ''}. Vous pouvez les recocher.`);

  // Formations : toutes pour un début de carrière ou une reconversion, sinon les deux plus récentes.
  const education = [...byType('education')].sort((a, b) => startKey(b).localeCompare(startKey(a)));
  education.forEach((e, i) => {
    const include = pref(e.id) !== 'exclude' && (beginner || i < 2);
    items.push({ id: e.id, type: 'education', label: label(e), include,
      reason: include ? (beginner ? 'Mise en avant pour un début de carrière ou une reconversion.' : 'Formation récente.') : 'Plus ancienne : à recocher si elle compte pour ce poste.' });
  });

  // Compétences : celles qui ressemblent au poste d'abord, puis les premières du profil.
  const skills = byType('skill').map((e, i) => ({ e, score: overlap(target, entryText(e)) * 5 - i * 0.01 + (pref(e.id) === 'prefer' ? 100 : 0) }))
    .sort((a, b) => b.score - a.score);
  const skillBudget = intent.pages === 1 ? 10 : 14;
  skills.forEach(({ e, score }, i) => {
    const include = pref(e.id) !== 'exclude' && i < skillBudget;
    items.push({ id: e.id, type: 'skill', label: e.title, include,
      reason: include ? (score >= 5 ? 'En lien avec le poste visé.' : 'Compétence de votre profil.') : 'Au-delà des compétences que la page peut accueillir.' });
  });

  for (const type of ['certification', 'language'] as const) {
    byType(type).forEach(e => items.push({
      id: e.id, type, label: label(e), include: pref(e.id) !== 'exclude',
      reason: pref(e.id) === 'exclude' ? 'Vous avez choisi de la laisser de côté.' : type === 'language' ? 'Les langues se lisent vite : on les garde.' : 'Une certification rassure sur vos compétences.',
    }));
  }
  for (const type of ['project', 'volunteer'] as const) {
    byType(type).forEach(e => {
      const include = pref(e.id) !== 'exclude' && (beginner || pref(e.id) === 'prefer');
      items.push({ id: e.id, type, label: label(e), include,
        reason: include ? 'Utile quand l\'expérience professionnelle est courte ou différente du poste visé.' : 'Facultatif : à recocher si cela soutient votre candidature.' });
    });
  }
  byType('interest').forEach((e, i) => {
    const include = intent.pages === 2 && i < 3 && pref(e.id) !== 'exclude';
    items.push({ id: e.id, type: 'interest', label: e.title, include, reason: include ? 'Une touche personnelle, sans prendre de place.' : 'Peu utile sur un CV d\'une page.' });
  });

  // Titre : le poste visé, sinon le titre du profil.
  const title = intent.role.trim() || profile?.title?.trim() || '';

  // Accroche : uniquement des faits du profil.
  const span = experienceSpan(entries, now);
  const roleSpan = roleExperienceSpan(entries, now, intent.role);
  const years = span.years;
  const roleYears = roleSpan ? roleSpan.years : null;
  const plural = (n: number) => `${n} an${n > 1 ? 's' : ''}`;
  const parts: string[] = [];
  let expression = '';
  if (years >= 1) {
    expression = ` avec ${plural(years)} d'expérience`;
    // « dont X dans le métier visé » seulement si c'est une information différente de la totalité.
    if (roleYears !== null && roleYears >= 1 && roleYears < years) expression += `, dont ${plural(roleYears)} dans ce métier`;
  }
  const first = `${title || 'Professionnel(le)'}${expression}${intent.sector.trim() ? `, dans le secteur ${intent.sector.trim()}` : ''}.`;
  parts.push(first);
  const employers = new Set(byType('experience').map(e => e.subtitle?.trim().toLowerCase()).filter(Boolean));
  const topSkills = skills.filter(s => items.find(i => i.id === s.e.id)?.include).slice(0, 3).map(s => s.e.title);
  if (intent.highlights.includes('expertise') && topSkills.length > 0) parts.push(`Expertise appuyée par ${topSkills.join(', ')}.`);
  if (intent.highlights.includes('polyvalence') && employers.size >= 2) parts.push(`Polyvalence acquise dans ${employers.size} structures différentes.`);
  if (intent.highlights.includes('reconversion')) {
    const latest = education[0] ?? byType('certification')[0];
    if (latest) parts.push(`Reconversion appuyée par ${latest.title}.`);
  }
  if (wantsManagement) {
    const manager = byType('experience').some(e => MANAGEMENT_WORDS.some(w => normalizeLabel(entryText(e)).includes(w)));
    if (manager) parts.push("Expérience d'encadrement et de pilotage d'activité.");
    else notes.push("Vous souhaitez mettre en avant l'encadrement, mais aucune expérience de votre profil n'en parle : ajoutez-le dans « Mon profil » pour qu'il apparaisse.");
  }
  if (intent.highlights.includes('resultats') && !entries.some(e => e.entryType === 'experience' && /\d/.test(e.description ?? ''))) {
    notes.push("Vous souhaitez montrer des résultats chiffrés, mais vos expériences n'en contiennent pas encore : ajoutez-en dans « Mon profil ».");
  }
  const summary = parts.join(' ');

  const experienceFirst = !beginner;
  const order = experienceFirst
    ? ['Expériences Professionnelles', 'Compétences', 'Formations', 'Certifications', 'Projets', 'Bénévolat', 'Langues', "Centres d'intérêt"]
    : ['Formations', 'Compétences', 'Expériences Professionnelles', 'Certifications', 'Projets', 'Bénévolat', 'Langues', "Centres d'intérêt"];
  const present = new Set(items.filter(i => i.include).map(i => SECTION_BY_TYPE[i.type]));
  const experience = {
    totalYears: years,
    firstYear: span.firstYear,
    roleYears,
    roleLabel: intent.role.trim(),
    ignored: span.ignored,
  };
  if (span.ignored > 0) notes.push(`${span.ignored} période${span.ignored > 1 ? 's' : ''} sans date exploitable n'${span.ignored > 1 ? 'ont' : 'a'} pas été comptée${span.ignored > 1 ? 's' : ''} dans les années d'expérience. Ajoutez les dates dans « Mon profil » pour les inclure.`);
  return { title, summary, experience, items, sectionOrder: order.filter(s => present.has(s)), notes };
}

/** Transforme la proposition (éventuellement modifiée) en réponse applicable par `applyAiCvToBlocks`. */
export function proposalToResponse(p: CvProposal): AiCvResponse {
  return {
    title: p.title || undefined,
    summary: p.summary || undefined,
    entries: p.items.map(i => ({ id: i.id, visible: i.include })),
    entryOrder: p.items.filter(i => i.include).map(i => i.id),
    sectionOrder: p.sectionOrder,
    suggestedEntries: [],
  } as AiCvResponse;
}

// ── Passage à l'IA (facultatif) ──────────────────────────────────────────────

/** Ciblage « sans annonce » pour le prompt d'une IA, à partir des réponses. */
export function intentToTarget(intent: CvIntent): TargetChoice {
  const hints = intent.highlights
    .map(h => (h === 'resultats' ? null : DEFAULT_ANGLES.find(a => a.slug === h)))
    .filter((a): a is NonNullable<typeof a> => !!a);
  const context = [
    `Niveau : ${LEVEL_LABELS[intent.level]}.`,
    ...hints.map(a => `${a.label} : ${a.vocabulary}`),
    intent.highlights.includes('resultats') ? 'Mettre en avant les résultats chiffrés déjà présents dans le profil.' : '',
  ].filter(Boolean).join(' ');
  return {
    intent: 'spontanee',
    brief: {
      positions: intent.role.trim() ? [intent.role.trim()] : undefined,
      activity: intent.sector.trim() || undefined,
      strengths: intent.highlights.map(h => HIGHLIGHT_LABELS[h]),
      context,
    },
  };
}
