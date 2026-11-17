/**
 * Évaluation « avec recherche » contre « sans recherche » : cinq profils fictifs (Camille Martin, une
 * étiquette par situation), deux CV chacun, présentés à l'aveugle (X et Y) avec une grille de six critères
 * notés de 1 à 5. Le jugement revient à la personne qui lit en tant que recruteur : ce module prépare les
 * textes à copier dans l'IA, relit les réponses collées dans des fichiers, lance le même garde-fou que
 * l'application et fabrique la grille. Aucun appel à une IA, aucun accès au réseau. Fonctions pures.
 */
import type { MasterEntry, Profile } from '@/types/profile';
import { analyzeAiCvJson } from './ai-cv-pipeline';
import { buildCvPrompt } from './cv-prompt';
import { buildGenericCvPrompt } from './cv-generic-prompt';
import { buildGapPrompt, gapQuestions, parseGapAnalysis, answersText, type GapAnalysis } from './cv-impact';
import { DEFAULT_INTENT, type CvIntent } from './cv-intent';
import { buildResearchPrompt, personalValues } from './target-brief-prompt';
import { parseTargetBriefText, type TargetBrief } from './target-brief';

export interface EvalEntrySpec {
  id: string; type: MasterEntry['entryType']; title: string; subtitle?: string | null;
  start?: string | null; end?: string | null; current?: boolean | string; description?: string | null;
}

export interface EvalCase {
  label: string;
  scenario: string;
  role: string;
  sector?: string;
  company?: string;
  offerText?: string;
  intent?: Partial<CvIntent>;
  profile: { title?: string; summary?: string };
  entries: EvalEntrySpec[];
}

export interface LoadedCase {
  label: string;
  scenario: string;
  profile: Profile;
  entries: MasterEntry[];
  intent: CvIntent | null;
  offerText: string;
  role: string;
  sector: string;
  company: string;
}

const TS = '2026-01-01T00:00:00.000Z';

/** Profil fictif complet : Camille Martin (aucune donnée réelle). */
export function loadCase(c: EvalCase): LoadedCase {
  const profile: Profile = {
    id: `eval-${c.label}`, firstName: 'Camille', lastName: 'Martin', email: 'camille.martin@example.org', phone: '06 00 00 00 00',
    address: null, city: 'Lyon', postalCode: '69003', country: 'France', linkedinUrl: null, otherUrl: null, photoPath: null,
    title: c.profile.title ?? null, summary: c.profile.summary ?? null, createdAt: TS, updatedAt: TS,
  };
  const entries: MasterEntry[] = c.entries.map((e, i) => ({
    id: e.id, profileId: profile.id, entryType: e.type, title: e.title, subtitle: e.subtitle ?? null, location: null,
    startDate: e.start ?? null, endDate: e.end ?? null, isCurrent: Boolean(e.current), description: e.description ?? null,
    metadata: {}, sortOrder: i, tags: [], createdAt: TS, updatedAt: TS,
  }));
  const intent = c.intent ? { ...DEFAULT_INTENT, ...c.intent, role: c.intent.role ?? c.role, sector: c.intent.sector ?? c.sector ?? '' } : null;
  return { label: c.label, scenario: c.scenario, profile, entries, intent, offerText: c.offerText ?? '', role: c.role, sector: c.sector ?? '', company: c.company ?? '' };
}

/** Réponses collées par la personne dans les fichiers du dossier de sortie (absentes : étape pas encore faite). */
export interface Replies {
  brief?: string;
  analyse?: string;
  cvSans?: string;
  cvAvec?: string;
}

export interface OutFile { name: string; content: string }

const NOW = new Date('2026-11-17T10:00:00Z');

/** Texte de rédaction habituel (sans recherche) : le même que celui de l'application. */
export function baselinePrompt(c: LoadedCase, extra: { impact?: { brief: TargetBrief; gap?: GapAnalysis; answers?: string } } = {}): string {
  const options = { now: NOW, ...(extra.impact ? { impact: extra.impact } : {}) };
  return c.intent
    ? buildGenericCvPrompt({ profile: c.profile, entries: c.entries, intent: c.intent, options })
    : buildCvPrompt({ profile: c.profile, entries: c.entries, jobOfferText: c.offerText, targetCompany: c.company || undefined, options });
}

const INVENTION_CODES = new Set(['invented-number', 'unsourced-term', 'unsupported-title', 'skill-item-invented', 'header-extra-invented', 'cv-skill-unsourced', 'web-keyword-unproven', 'suggestion-rejected']);

export interface GuardSummary { errors: number; warnings: number; inventions: string[]; ok: boolean; message?: string }

/** Même garde-fou que l'application, sur une réponse collée. « Zéro invention » : aucun code d'invention. */
export function guardSummary(c: LoadedCase, reply: string, impact?: { brief: TargetBrief }, answers?: string): GuardSummary {
  const r = analyzeAiCvJson(reply, {
    entries: c.entries, profile: c.profile, now: NOW, candidateAnswers: [c.intent ? 'x' : '', answers ?? ''].filter(Boolean).join('\n') || undefined,
    ...(impact ? { impact: { brief: impact.brief, offerText: c.offerText } } : {}),
  });
  if (!r.ok) return { errors: 0, warnings: 0, inventions: [], ok: false, message: r.error };
  const all = [...r.report.errors, ...r.report.warnings];
  const inventions = all.filter(i => INVENTION_CODES.has(i.code)).map(i => `${i.code} : ${i.message}`);
  return { errors: r.report.errors.length, warnings: r.report.warnings.length, inventions, ok: true };
}

/** Fichiers à produire pour un profil, selon les réponses déjà collées. */
export function stageFiles(c: LoadedCase, replies: Replies): { files: OutFile[]; next: string } {
  const files: OutFile[] = [];
  const redact = personalValues(c.profile);
  files.push({
    name: '1-recherche.txt',
    content: buildResearchPrompt({ role: c.role, sector: c.sector, company: c.company, offerText: c.offerText, language: c.intent?.language ?? 'fr' }, { redact, now: NOW }),
  });
  files.push({ name: '2-cv-sans-recherche.txt', content: baselinePrompt(c) });

  let brief: TargetBrief | null = null;
  let next = `Collez 1-recherche.txt dans une NOUVELLE conversation de votre IA (recherche internet activée), puis sa réponse dans brief.json.`;
  if (replies.brief?.trim()) {
    const r = parseTargetBriefText(replies.brief, { now: NOW });
    if (!r.ok) next = `brief.json : ${r.message}`;
    else if (!r.report.usable) next = `brief.json : ${r.report.reason ?? 'fiche inexploitable'} Refaites la recherche, ou gardez seulement le CV sans recherche.`;
    else {
      brief = r.brief;
      files.push({ name: '3-analyse.txt', content: buildGapPrompt({ profile: c.profile, entries: c.entries, brief, intent: c.intent ?? undefined, offerText: c.offerText, targetCompany: c.company || undefined }) });
      next = `Collez 3-analyse.txt dans l'IA, puis sa réponse dans analyse.json.`;
    }
  }
  let gap: GapAnalysis | null = null;
  let answers = '';
  if (brief && replies.analyse?.trim()) {
    const g = parseGapAnalysis(replies.analyse, c.entries, brief);
    if (!g.ok) next = `analyse.json : ${g.message}`;
    else {
      gap = g.gap;
      const questions = gapQuestions(gap);
      if (questions.length > 0) {
        files.push({ name: 'questions.md', content: `# Questions d'écart pour ${c.label}\n\nRépondez dans réponses.json si c'est vrai pour Camille Martin (profil fictif : inventez des réponses plausibles et notez-le), sinon laissez vide.\n\n${questions.map(q => `- ${q.key} : ${q.text}`).join('\n')}\n` });
        answers = answersText(questions, {});
      }
      files.push({ name: '4-cv-avec-recherche.txt', content: baselinePrompt(c, { impact: { brief, gap, answers } }) });
      next = `Collez 2-cv-sans-recherche.txt et 4-cv-avec-recherche.txt dans l'IA (deux conversations), puis les réponses dans cv-sans.json et cv-avec.json.`;
    }
  }
  const lines: string[] = [];
  if (replies.cvSans?.trim()) { const s = guardSummary(c, replies.cvSans); lines.push(`- Sans recherche : ${s.ok ? `${s.errors} point(s) bloquant(s), ${s.warnings} remarque(s), ${s.inventions.length} invention(s)` : s.message}`); s.inventions.forEach(i => lines.push(`  - ${i}`)); }
  if (replies.cvAvec?.trim() && brief) { const s = guardSummary(c, replies.cvAvec, { brief }, answers); lines.push(`- Avec recherche : ${s.ok ? `${s.errors} point(s) bloquant(s), ${s.warnings} remarque(s), ${s.inventions.length} invention(s)` : s.message}`); s.inventions.forEach(i => lines.push(`  - ${i}`)); }
  if (lines.length > 0) {
    files.push({ name: 'controle.md', content: `# Contrôle automatique : ${c.label}\n\nMême garde-fou que l'application. Critère : zéro invention sur les deux CV.\n\n${lines.join('\n')}\n` });
    if (replies.cvSans?.trim() && replies.cvAvec?.trim()) next = 'Prêt pour la grille à l\'aveugle (grille.md).';
  }
  return { files, next };
}

// ─── Grille à l'aveugle ───────────────────────────────────────────────────────

export const CRITERIA = [
  'Pertinence de l\'intitulé',
  'Force de l\'accroche',
  'Justesse du vocabulaire métier',
  'Couverture des attentes clés',
  'Zéro invention',
  'Lisibilité en 30 secondes',
] as const;

/** Générateur pseudo-aléatoire déterministe (mulberry32) : même graine, même tirage. */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export interface BlindAssignment { label: string; X: 'sans' | 'avec'; Y: 'sans' | 'avec' }

/** Quel CV est « X » : tiré au sort par profil, avec autant de « avec » en X qu'en Y (à un près). */
export function blindAssignments(labels: readonly string[], seed: number): BlindAssignment[] {
  const rnd = seeded(seed);
  const order = labels.map(label => ({ label, r: rnd() })).sort((a, b) => a.r - b.r);
  return labels.map(label => {
    const rank = order.findIndex(o => o.label === label);
    const avecFirst = rank % 2 === 0;
    return { label, X: avecFirst ? 'avec' : 'sans', Y: avecFirst ? 'sans' : 'avec' } as BlindAssignment;
  });
}

/** Grille de notation : ne révèle pas quel CV est « avec recherche ». */
export function gridMarkdown(cases: readonly LoadedCase[]): string {
  const head = `| Critère | X | Y |\n|---|---|---|\n`;
  return `# Grille d'évaluation à l'aveugle

Pour chaque profil, lisez les CV X et Y comme le ferait un recruteur, puis notez chaque critère de 1 (faible) à 5 (excellent). Ne regardez pas cle.json avant d'avoir tout noté.

${cases.map(c => `## ${c.label} : ${c.scenario}\n\n${head}${CRITERIA.map(k => `| ${k} |  |  |`).join('\n')}\n\nCommentaire :\n`).join('\n')}`;
}

export interface Scores { label: string; X: number[]; Y: number[] }

/** Résultat : pour chaque profil, total « avec » contre « sans » ; critère d'acceptation : « avec » gagne sur au moins 4 profils sur 5. */
export function tally(assignments: readonly BlindAssignment[], scores: readonly Scores[]): { label: string; avec: number; sans: number; winner: 'avec' | 'sans' | 'égalité' }[] {
  return assignments.flatMap(a => {
    const s = scores.find(x => x.label === a.label);
    if (!s || s.X.length !== CRITERIA.length || s.Y.length !== CRITERIA.length) return [];
    const sum = (v: number[]) => v.reduce((n, x) => n + x, 0);
    const avec = sum(a.X === 'avec' ? s.X : s.Y);
    const sans = sum(a.X === 'sans' ? s.X : s.Y);
    return [{ label: a.label, avec, sans, winner: avec === sans ? 'égalité' as const : avec > sans ? 'avec' as const : 'sans' as const }];
  });
}
