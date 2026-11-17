/**
 * Contrôles propres au CV « à vrai impact » (réponse de schéma v3, fiche cible fournie), appelés par
 * `guardAiCv`. Ils ajoutent à l'anti-invention habituel :
 * - `web-keyword-unproven` : un terme venu de la recherche sur le marché apparaît dans le CV sans
 *   que le profil ni les réponses de la personne ne le montrent. Dans une compétence propre au CV, il
 *   est retiré et proposé en suggestion ; dans un texte, il bloque (la personne confirme ou corrige) ;
 * - `copied-phrase` : 8 mots d'affilée ou plus recopiés de l'offre ou de la fiche ;
 * - `keyword-stuffing` : mots-clés empilés dans une puce ou dans l'accroche ;
 * - `hollow-phrase` : formule creuse sans preuve (aucun chiffre) dans la même puce ;
 * - `bullet-unlinked` : expérience reliée à aucune attente de la fiche et non condensée ;
 * - `decision-unsourced` : décision de positionnement qui ne s'appuie sur rien d'existant.
 *
 * Limite assumée : un terme technique employé dans un contexte faux ne se détecte pas de façon fiable
 * par programme ; la consigne donnée à l'IA et la relecture de la personne s'en chargent.
 */
import type { MasterEntry } from '@/types/profile';
import type { AiCvResponse } from './ai-cv-response';
import type { GuardIssue } from './ai-cv-guard';
import { briefItemIds } from './cv-impact-blocks';
import { normalizeLabel } from './cv-sections';
import type { TargetBrief } from './target-brief';

export interface ImpactGuardContext {
  brief: TargetBrief;
  /** Texte de l'offre (source des phrases recopiées). */
  offerText?: string;
}

const fold = (s: string): string => normalizeLabel(s).replace(/[’‘`']/g, ' ').replace(/\s+/g, ' ').trim();
const esc = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const hasWord = (haystack: string, needle: string): boolean => needle !== '' && new RegExp(`(^|[^a-z0-9])${esc(needle)}($|[^a-z0-9])`).test(haystack);

/** Mots trop généraux pour prouver ou accuser quoi que ce soit. */
const GENERIC = new Set(['erp', 'crm', 'logiciel', 'logiciels', 'outil', 'outils', 'equivalent', 'equivalents', 'autre', 'autres', 'et', 'ou', 'de', 'des', 'du', 'la', 'le', 'les', 'un', 'une', 'en', 'sur', 'pour', 'avec', 'dans']);

/** Morceaux d'un libellé de la fiche : « ERP (SAP, Sage ou équivalent) » donne « sap » et « sage ». */
export function termCandidates(label: string, kind: 'competence' | 'outil' | 'certification'): string[] {
  if (kind === 'competence') return [fold(label)].filter(Boolean);
  const parts = label.split(/[(),;/]|\bou\b|\bet\b/i).map(fold).filter(p => p.length >= 2 && !GENERIC.has(p));
  return [...new Set(parts)];
}

/** Mots d'une expression qui comptent (4 lettres ou plus, hors mots courants). */
const significantWords = (phrase: string): string[] => phrase.split(' ').filter(w => w.length >= 4 && !GENERIC.has(w));

/** Un terme est étayé s'il figure dans la source ; une compétence l'est aussi si l'essentiel de ses mots y figure. */
function isProven(candidate: string, kind: 'competence' | 'outil' | 'certification', source: string): boolean {
  if (hasWord(source, candidate)) return true;
  if (kind !== 'competence') return false;
  const words = significantWords(candidate);
  if (words.length < 2) return false;
  const found = words.filter(w => hasWord(source, w) || source.includes(w.slice(0, Math.max(5, w.length - 2)))).length;
  return found / words.length >= 0.6;
}

interface Line { where: string; text: string; entryId?: string; kind: 'title' | 'summary' | 'bullet' | 'skill' }

/** Textes affichés sur le CV (entrées visibles réécrites, titre, accroche) découpés en lignes. */
function cvLines(data: AiCvResponse, entries: ReadonlyMap<string, MasterEntry>): Line[] {
  const out: Line[] = [];
  if (data.title) out.push({ where: 'titre', text: data.title, kind: 'title' });
  if (data.summary) out.push({ where: 'accroche', text: data.summary, kind: 'summary' });
  for (const e of data.entries) {
    if (!e.visible || e.description === undefined) continue;
    const name = entries.get(e.id)?.title ?? e.id;
    for (const raw of e.description.split('\n')) {
      const text = raw.replace(/^[-*•]\s+/, '').trim();
      if (text) out.push({ where: name, text, entryId: e.id, kind: 'bullet' });
    }
  }
  for (const s of data.cvSkills ?? []) out.push({ where: 'compétences', text: s.name, kind: 'skill' });
  return out;
}

const HOLLOW: readonly [string, RegExp][] = [
  ['rigoureux', /\brigoureu(?:x|se|ses)\b/],
  ['force de proposition', /\bforce de proposition\b/],
  ["esprit d'équipe", /\besprit d equipe\b/],
  ['autonome', /\bautonomes?\b/],
  ['à l\'écoute', /\ba l ecoute\b/],
  ["sens de l'organisation", /\bsens de l organisation\b/],
  ['polyvalent', /\bpolyvalent(?:e|es|s)?\b/],
];

/** Mots d'une phrase, sans ponctuation. */
const words = (s: string): string[] => fold(s).replace(/[^a-z0-9 ]/g, ' ').split(' ').filter(Boolean);

export const COPY_WORDS = 8;

/** Suites de 8 mots d'un texte. */
function grams(text: string): Set<string> {
  const w = words(text);
  const out = new Set<string>();
  for (let i = 0; i + COPY_WORDS <= w.length; i++) out.add(w.slice(i, i + COPY_WORDS).join(' '));
  return out;
}

export interface ImpactGuardResult {
  data: AiCvResponse;
  errors: GuardIssue[];
  warnings: GuardIssue[];
}

/**
 * @param sourceText texte source normalisé (profil maître, profil, réponses de la personne) : tout ce
 *   que l'IA a le droit d'affirmer.
 */
export function guardImpact(data: AiCvResponse, ctx: ImpactGuardContext, sourceText: string, entryList: readonly MasterEntry[]): ImpactGuardResult {
  const errors: GuardIssue[] = [];
  const warnings: GuardIssue[] = [];
  const entries = new Map(entryList.map(e => [e.id, e] as const));
  const source = fold(sourceText);
  const lines = cvLines(data, entries);
  const out: AiCvResponse = { ...data };
  const v3 = (data.schemaVersion ?? 2) >= 3;

  // ── Termes du marché sans appui dans le profil ──
  const unproven: { label: string; candidate: string }[] = [];
  for (const skill of ctx.brief.skills) {
    for (const candidate of termCandidates(skill.text, skill.kind)) {
      if (isProven(candidate, skill.kind, source)) continue;
      if (lines.some(l => hasWord(fold(l.text), candidate))) unproven.push({ label: skill.text, candidate });
    }
  }
  if (unproven.length > 0) {
    const bad = new Set(unproven.map(u => u.candidate));
    // Compétences propres au CV : retirées (la personne peut les reprendre depuis les suggestions).
    const kept = (data.cvSkills ?? []).filter(s => ![...bad].some(c => hasWord(fold(s.name), c)));
    const dropped = (data.cvSkills ?? []).filter(s => !kept.includes(s));
    if (dropped.length > 0) {
      out.cvSkills = kept.length > 0 ? kept : undefined;
      if (!out.cvSkills) delete out.cvSkills;
      for (const s of dropped) warnings.push({ code: 'web-keyword-unproven', message: `Compétence « ${s.name} » retirée : elle vient de la recherche sur le marché, et rien dans votre profil ne la montre. Elle est proposée dans les suggestions.` });
    }
    const textHits = [...new Set(unproven.filter(u => lines.some(l => l.kind !== 'skill' && hasWord(fold(l.text), u.candidate))).map(u => u.label))];
    for (const label of textHits) {
      errors.push({
        code: 'web-keyword-unproven',
        message: `« ${label} » vient de la recherche sur le marché, mais ni votre profil ni vos réponses ne le montrent, et il apparaît dans le CV. Retirez-le, ou confirmez-le dans les suggestions si c'est exact.`,
      });
    }
    const suggested = new Set((data.suggestions?.motsCles ?? []).map(m => fold(m.terme)));
    const extra = [...new Set(unproven.map(u => u.label))].filter(l => !suggested.has(fold(l)))
      .map(terme => ({ terme, raison: 'Attendu par le marché, mais votre profil ne le montre pas.' }));
    if (extra.length > 0) out.suggestions = { motsCles: [...(data.suggestions?.motsCles ?? []), ...extra], formations: data.suggestions?.formations ?? [] };
  }

  // ── Phrases recopiées de l'offre ou de la fiche ──
  const origin = new Set<string>();
  for (const text of [ctx.offerText ?? '', ...briefItemIds(ctx.brief).values()].map(x => (typeof x === 'string' ? x : x.item.text))) {
    for (const g of grams(text)) origin.add(g);
  }
  const copied = new Set<string>();
  for (const l of lines) {
    const w = words(l.text);
    for (let i = 0; i + COPY_WORDS <= w.length; i++) {
      if (origin.has(w.slice(i, i + COPY_WORDS).join(' ')) && !copied.has(l.where)) {
        copied.add(l.where);
        warnings.push({ code: 'copied-phrase', message: `${l.where} : au moins ${COPY_WORDS} mots d'affilée sont recopiés de l'offre ou de la fiche (« ${w.slice(i, i + COPY_WORDS).join(' ')} »). Reformulez avec vos propres mots.`, entryId: l.entryId });
      }
    }
  }

  // ── Mots-clés empilés ──
  const marketLabels = [...new Set([...ctx.brief.skills.map(s => s.text), ...ctx.brief.vocabulary.map(v => v.text)]
    .flatMap(t => termCandidates(t, 'outil').concat(fold(t))).filter(t => t.length >= 4 && !GENERIC.has(t)))];
  for (const l of lines) {
    if (l.kind === 'title' || l.kind === 'skill') continue;
    const f = fold(l.text);
    const hits = marketLabels.filter(t => hasWord(f, t));
    const limit = l.kind === 'summary' ? 6 : 4;
    if (hits.length >= limit) {
      warnings.push({ code: 'keyword-stuffing', message: `${l.where} : ${hits.length} mots-clés du marché dans ${l.kind === 'summary' ? 'l\'accroche' : 'une seule puce'} (${hits.slice(0, 5).join(', ')}). Gardez un texte naturel.`, entryId: l.entryId });
    }
  }

  // ── Formules creuses ──
  const hollowSeen = new Set<string>();
  for (const l of lines) {
    if (l.kind === 'title' || /\d/.test(l.text)) continue;
    const f = fold(l.text);
    for (const [name, re] of HOLLOW) {
      const key = `${l.where}|${name}`;
      if (re.test(f) && !hollowSeen.has(key)) {
        hollowSeen.add(key);
        warnings.push({ code: 'hollow-phrase', message: `${l.where} : « ${name} » sans preuve dans la même phrase. Montrez-le par un fait (chiffre, périmètre, résultat).`, entryId: l.entryId });
      }
    }
  }

  if (v3) {
    const known = new Set([...briefItemIds(ctx.brief).keys()]);
    // ── Puces reliées à une attente ──
    out.entries = data.entries.map(e => {
      if (!e.attentes) return e;
      const copy = { ...e };
      const valid = e.attentes.filter(id => known.has(id));
      if (valid.length > 0) copy.attentes = valid; else delete copy.attentes;
      return copy;
    });
    for (const e of out.entries) {
      const entry = entries.get(e.id);
      if (!entry || entry.entryType !== 'experience' || !e.visible || !e.description?.trim() || e.condensee || (e.attentes?.length ?? 0) > 0) continue;
      warnings.push({ code: 'bullet-unlinked', message: `« ${entry.title} » : aucune attente de la fiche n'est reliée à cette expérience. Condensez-la, ou dites ce qu'elle illustre.`, entryId: e.id });
    }
    // ── Décisions appuyées ──
    const sourceIds = new Set(ctx.brief.sources.map(s => s.id));
    if (data.decisions) {
      out.decisions = data.decisions.map(d => ({ ...d, appui: d.appui.filter(id => entries.has(id) || known.has(id) || sourceIds.has(id)) }));
      for (const d of out.decisions) {
        if (d.appui.length === 0) warnings.push({ code: 'decision-unsourced', message: `Décision « ${d.sujet} » : ${d.choix} ne s'appuie sur aucune entrée de votre profil ni élément de la fiche.` });
      }
    }
  }

  return { data: out, errors, warnings };
}
