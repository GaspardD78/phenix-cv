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

export interface CvIntent {
  role: string;
  sector: string;
  level: Level;
  highlights: Highlight[];
  /** Préférence par identifiant d'entrée (absent : normal). */
  preferences: Record<string, EntryPreference>;
  pages: 1 | 2;
  language: 'fr' | 'en';
}

export const DEFAULT_INTENT: CvIntent = {
  role: '', sector: '', level: 'confirme', highlights: [], preferences: {}, pages: 1, language: 'fr',
};

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

/** Années d'expérience calculées à partir des dates des expériences (0 si aucune date exploitable). */
export function yearsOfExperience(entries: readonly MasterEntry[], now: Date): number {
  const years = entries
    .filter(e => e.entryType === 'experience' && e.startDate)
    .map(e => Number.parseInt(String(e.startDate).slice(0, 4), 10))
    .filter(y => Number.isFinite(y) && y > 1950);
  if (years.length === 0) return 0;
  return Math.max(0, now.getUTCFullYear() - Math.min(...years));
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
  items: ProposalItem[];
  /** Libellés standard des sections, dans l'ordre proposé. */
  sectionOrder: string[];
  /** Explications générales, à afficher à l'utilisateur. */
  notes: string[];
}

const SECTION_BY_TYPE: Readonly<Record<EntryType, string>> = {
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
  const years = yearsOfExperience(entries, now);
  const parts: string[] = [];
  const first = `${title || 'Professionnel(le)'}${years >= 1 ? ` avec ${years} an${years > 1 ? 's' : ''} d'expérience` : ''}${intent.sector.trim() ? ` dans le secteur ${intent.sector.trim()}` : ''}.`;
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
  return { title, summary, items, sectionOrder: order.filter(s => present.has(s)), notes };
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
