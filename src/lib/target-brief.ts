/**
 * « Fiche cible » : ce que le marché attend pour un métier (et, si on la connaît, une entreprise).
 *
 * L'application n'appelle aucune IA : la recherche se fait dans l'assistant de la personne (texte
 * à copier, réponse à recoller). Cette fiche est donc une réponse EXTERNE, à contrôler avant de s'en
 * servir : `validateTargetBrief` retire ce qui n'a pas de source datée, écarte les sources
 * douteuses, calcule la confiance de chaque élément et neutralise tout texte qui ressemble à une
 * consigne. Une fiche est une donnée : elle n'est jamais une instruction. Fonctions pures.
 *
 * Limite assumée : on ne peut pas prouver qu'une adresse existe ni que la page dit ce que la fiche
 * lui fait dire. Les sources sont cliquables pour que la personne puisse vérifier.
 */

export const BRIEF_VERSION = 1;

export type Confidence = 'officiel' | 'confirme' | 'source-unique';
export type SourceType = 'referentiel' | 'entreprise' | 'offre' | 'presse' | 'etude' | 'autre';
export type SkillLevel = 'indispensable' | 'differenciant';
export type SkillKind = 'competence' | 'outil' | 'certification';

export interface BriefSource {
  id: string;
  url: string;
  site: string;
  titre?: string;
  /** AAAA, AAAA-MM ou AAAA-MM-JJ. */
  datePublication?: string;
  /** AAAA-MM-JJ. */
  dateConsultation?: string;
  type: SourceType;
}

export interface BriefItem {
  text: string;
  /** Identifiants de `sources`. */
  sources: string[];
  /** Calculée par le contrôle (jamais celle annoncée par l'IA). */
  confidence: Confidence;
}

export interface BriefSkill extends BriefItem {
  level: SkillLevel;
  kind: SkillKind;
}

export interface TargetBrief {
  version: typeof BRIEF_VERSION;
  research: { done: boolean; reason?: string };
  title: BriefItem | null;
  titleVariants: BriefItem[];
  skills: BriefSkill[];
  vocabulary: BriefItem[];
  verbs: BriefItem[];
  indicators: BriefItem[];
  context: BriefItem[];
  company: BriefItem[];
  risks: BriefItem[];
  sources: BriefSource[];
  /** Date de la recherche (AAAA-MM-JJ) : base du « à actualiser » du cache. */
  researchedAt: string;
}

/** Rubriques de texte libre de la fiche (même forme d'élément). */
export const BRIEF_LISTS = ['titleVariants', 'vocabulary', 'verbs', 'indicators', 'context', 'company', 'risks'] as const;
export type BriefList = (typeof BRIEF_LISTS)[number];

export const BRIEF_LIST_LABELS: Readonly<Record<BriefList | 'skills' | 'title', string>> = {
  title: 'Intitulé du poste',
  titleVariants: 'Autres intitulés',
  skills: 'Compétences attendues',
  vocabulary: 'Vocabulaire du métier',
  verbs: 'Verbes courants',
  indicators: 'Indicateurs de réussite',
  context: 'Contexte du secteur',
  company: 'Entreprise',
  risks: 'Points de vigilance',
};

// ─── Règles de contrôle ───────────────────────────────────────────────────────

/** Une offre ou un chiffre de marché plus ancien que cela est signalé. */
export const MAX_OFFER_AGE_MONTHS = 6;
export const MAX_STUDY_AGE_YEARS = 3;
/** Au-delà, la fiche en cache est « à actualiser ». */
export const STALE_AFTER_DAYS = 90;
export const MAX_ITEM_CHARS = 200;

/** Sites exclus : forums, réseaux sociaux, contenus sans auteur. */
const EXCLUDED_HOSTS = [
  'reddit.com', 'quora.com', 'facebook.com', 'instagram.com', 'tiktok.com', 'x.com', 'twitter.com', 'pinterest.com',
  'jeuxvideo.com', 'doctissimo.fr', 'commentcamarche.net', 'yahoo.com', 'answers.com', 'medium.com',
];

/** Sites officiels : un élément appuyé par l'un d'eux est « officiel ». */
const OFFICIAL_HOSTS = [
  'francetravail.fr', 'pole-emploi.fr', 'apec.fr', 'onisep.fr', 'francecompetences.fr', 'insee.fr', 'legifrance.gouv.fr',
  'travail-emploi.gouv.fr', 'dares.travail-emploi.gouv.fr', 'service-public.fr', 'cnil.fr', 'ssi.gouv.fr', 'amf-france.org',
  'has-sante.fr', 'europa.eu', 'esco.ec.europa.eu',
];

const MULTI_PART_SUFFIXES = ['gouv.fr', 'asso.fr', 'co.uk', 'com.au', 'ec.europa.eu'];

/** Nom de domaine « principal » (www.apec.fr → apec.fr, www.service.gouv.fr → service.gouv.fr). */
export function registrableDomain(url: string): string | null {
  let host: string;
  try { host = new URL(url).hostname.toLowerCase().replace(/\.$/, ''); } catch { return null; }
  if (!host.includes('.')) return null;
  const parts = host.split('.');
  const suffix = MULTI_PART_SUFFIXES.find(s => host.endsWith(`.${s}`) || host === s);
  const keep = suffix ? suffix.split('.').length + 1 : 2;
  return parts.slice(-keep).join('.');
}

const hostMatches = (domain: string, list: readonly string[]): boolean =>
  list.some(h => domain === h || domain.endsWith(`.${h}`));

export const isExcludedSource = (url: string): boolean => {
  const domain = registrableDomain(url);
  if (!domain) return true;
  let host = '';
  try { host = new URL(url).hostname.toLowerCase(); } catch { return true; }
  if (/(^|[.-])forum(s)?([.-]|$)/.test(host)) return true;
  if (domain === 'linkedin.com') return !/^\/(jobs|company)\b/.test(new URL(url).pathname);
  return hostMatches(domain, EXCLUDED_HOSTS);
};

export const isOfficialSource = (url: string): boolean => {
  const domain = registrableDomain(url);
  return domain !== null && hostMatches(domain, OFFICIAL_HOSTS);
};

/** Textes qui ressemblent à une consigne donnée à l'IA : jamais gardés dans une fiche. */
const INSTRUCTION_PATTERNS: readonly RegExp[] = [
  /\bignor(e|ez|er)\b.{0,30}\b(instruction|consigne|r[eè]gle|prompt|pr[eé]c[eé]dent)/i,
  /\b(ne tiens? plus compte|oublie|oubliez|disregard|forget)\b/i,
  /\bignore (all|any|the|your|previous|prior)\b/i,
  /\b(system prompt|prompt syst[eè]me|instructions? pr[eé]c[eé]dentes?|previous instructions?)\b/i,
  /\b(tu dois|vous devez|you must|you should|tu devras|r[eé]ponds? (uniquement|seulement|toujours)|answer only)\b/i,
  /\b(ajoute|ajoutez|inscris|inscrivez|mets?|add|insert|include)\b.{0,40}\b(au cv|dans le cv|to the (cv|resume)|comp[eé]tence|skill)/i,
  /\b(en tant qu'?ia|as an ai|assistant ia)\b/i,
  /<<<|>>>|```|<\/?(system|instruction|prompt)/i,
];

export const looksLikeInstruction = (text: string): boolean => INSTRUCTION_PATTERNS.some(re => re.test(text));

// ─── Lecture de la réponse ────────────────────────────────────────────────────

const asString = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const asRecord = (v: unknown): Record<string, unknown> | null => (v !== null && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : null);

/** Texte d'un élément : une chaîne, ou `{ texte | text | libelle }`. */
function itemText(v: unknown): string {
  if (typeof v === 'string') return v;
  const r = asRecord(v);
  return r ? asString(r.texte ?? r.text ?? r.libelle ?? r.label ?? r.intitule) : '';
}

function itemSources(v: unknown): string[] {
  const r = asRecord(v);
  const raw = r?.sources ?? r?.source;
  const list = Array.isArray(raw) ? raw : typeof raw === 'string' ? [raw] : [];
  return list.map(s => String(s).trim()).filter(Boolean);
}

const DATE_RE = /^\d{4}(-\d{2}(-\d{2})?)?$/;
const validDate = (s: string): boolean => {
  if (!DATE_RE.test(s)) return false;
  const [y, m = '01', d = '01'] = s.split('-');
  const date = new Date(Date.UTC(+y, +m - 1, +d));
  return +y >= 1990 && +y <= 2100 && date.getUTCMonth() === +m - 1 && date.getUTCDate() === +d;
};

const SOURCE_TYPES: readonly SourceType[] = ['referentiel', 'entreprise', 'offre', 'presse', 'etude', 'autre'];

export interface BriefReport {
  /** Éléments retirés, avec la raison (affichés à la personne). */
  removed: { text: string; reason: string }[];
  /** Sources écartées, avec la raison. */
  droppedSources: { url: string; reason: string }[];
  /** Sources trop anciennes (gardées, signalées). */
  staleSources: { id: string; site: string; reason: string }[];
  /** Éléments neutralisés parce qu'ils ressemblent à une consigne. */
  neutralized: number;
  /** Toutes les sources valides viennent d'un seul site. */
  singleDomain: boolean;
  domains: string[];
  /** Fiche exploitable : recherche faite, au moins un élément sourcé. */
  usable: boolean;
  /** Phrase affichée quand la fiche n'est pas exploitable. */
  reason?: string;
}

export interface ValidateOptions {
  now?: Date;
}

const isoDay = (d: Date): string => d.toISOString().slice(0, 10);

/** Âge en mois d'une date AAAA[-MM[-JJ]] (`null` : date inconnue). */
function ageInMonths(date: string | undefined, now: Date): number | null {
  if (!date || !validDate(date)) return null;
  const [y, m = '01'] = date.split('-');
  return (now.getUTCFullYear() - +y) * 12 + (now.getUTCMonth() + 1 - +m);
}

/** Retire retours à la ligne, balises et marqueurs de bloc d'un texte de fiche ; longueur bornée. */
export function cleanItemText(text: string): string {
  return text.replace(/[\r\n\t]+/g, ' ').replace(/<[^>]*>/g, '').replace(/[`<>]/g, '').replace(/\s{2,}/g, ' ').trim().slice(0, MAX_ITEM_CHARS);
}

export const NO_RESEARCH_MESSAGE = 'Recherche web indisponible : CV généré sans analyse de marché.';

/**
 * Contrôle de la réponse collée. `raw` est l'objet JSON déjà lu (ou une fiche déjà contrôlée
 * qu'on re-contrôle, par exemple après une correction de la personne).
 */
export function validateTargetBrief(raw: unknown, opts: ValidateOptions = {}): { brief: TargetBrief; report: BriefReport } {
  const now = opts.now ?? new Date();
  const root = asRecord(raw) ?? {};
  const body = asRecord(root.ficheCible) ?? asRecord(root.fiche) ?? root;
  const report: BriefReport = { removed: [], droppedSources: [], staleSources: [], neutralized: 0, singleDomain: false, domains: [], usable: false };

  // 1. Sources : adresse valide, site non exclu, au moins une date.
  const sources: BriefSource[] = [];
  const seen = new Set<string>();
  for (const s of Array.isArray(body.sources) ? body.sources : []) {
    const r = asRecord(s);
    if (!r) continue;
    const id = asString(r.id);
    const url = asString(r.url ?? r.lien);
    if (!id || seen.has(id)) continue;
    if (!/^https?:\/\//i.test(url) || !registrableDomain(url)) { report.droppedSources.push({ url, reason: 'adresse invalide' }); continue; }
    if (isExcludedSource(url)) { report.droppedSources.push({ url, reason: 'site exclu (forum, réseau social ou contenu sans auteur)' }); continue; }
    const pub = asString(r.datePublication ?? r.publication);
    const seenOn = asString(r.dateConsultation ?? r.consultation);
    const datePublication = validDate(pub) ? pub : undefined;
    const dateConsultation = validDate(seenOn) ? seenOn : undefined;
    if (!datePublication && !dateConsultation) { report.droppedSources.push({ url, reason: 'aucune date' }); continue; }
    const type = SOURCE_TYPES.includes(asString(r.type) as SourceType) ? asString(r.type) as SourceType : 'autre';
    const domain = registrableDomain(url)!;
    const titre = cleanItemText(asString(r.titre ?? r.title));
    const source: BriefSource = { id, url, site: cleanItemText(asString(r.site)) || domain, type };
    if (titre) source.titre = titre;
    if (datePublication) source.datePublication = datePublication;
    if (dateConsultation) source.dateConsultation = dateConsultation;
    sources.push(source);
    seen.add(id);

    // Fraîcheur : offres de moins de 6 mois, études et presse de moins de 3 ans.
    const age = ageInMonths(datePublication, now);
    if (type === 'offre' && (age === null || age > MAX_OFFER_AGE_MONTHS)) {
      report.staleSources.push({ id, site: source.site, reason: age === null ? 'offre sans date de publication' : `offre de plus de ${MAX_OFFER_AGE_MONTHS} mois` });
    } else if ((type === 'etude' || type === 'presse') && age !== null && age > MAX_STUDY_AGE_YEARS * 12) {
      report.staleSources.push({ id, site: source.site, reason: `plus de ${MAX_STUDY_AGE_YEARS} ans` });
    }
  }
  const byId = new Map(sources.map(s => [s.id, s]));
  const domains = [...new Set(sources.map(s => registrableDomain(s.url)!))];
  report.domains = domains;
  report.singleDomain = sources.length > 0 && domains.length === 1;

  // 2. Éléments : texte propre, pas de consigne, au moins une source valide ; confiance calculée.
  const confidenceOf = (ids: string[]): Confidence => {
    const used = ids.map(id => byId.get(id)!);
    if (used.some(s => isOfficialSource(s.url))) return 'officiel';
    return new Set(used.map(s => registrableDomain(s.url))).size >= 2 ? 'confirme' : 'source-unique';
  };
  const keep = (v: unknown): BriefItem | null => {
    const original = itemText(v);
    if (!original) return null;
    if (looksLikeInstruction(original)) {
      report.neutralized++;
      report.removed.push({ text: cleanItemText(original).slice(0, 80), reason: 'ressemble à une consigne : écarté' });
      return null;
    }
    const text = cleanItemText(original);
    if (!text) return null;
    const ids = [...new Set(itemSources(v))].filter(id => byId.has(id));
    if (ids.length === 0) { report.removed.push({ text: text.slice(0, 80), reason: 'sans source datée' }); return null; }
    return { text, sources: ids, confidence: confidenceOf(ids) };
  };
  const list = (v: unknown): BriefItem[] => (Array.isArray(v) ? v : []).map(keep).filter((i): i is BriefItem => i !== null);

  const titleRoot = asRecord(body.intitule) ?? asRecord(body.title);
  const title = titleRoot ? keep(titleRoot.principal ?? titleRoot.main ?? titleRoot) : null;
  const variants = list(titleRoot?.variantes ?? titleRoot?.variants ?? body.titleVariants);

  const skills: BriefSkill[] = [];
  for (const s of Array.isArray(body.competences) ? body.competences : Array.isArray(body.skills) ? body.skills : []) {
    const item = keep(s);
    if (!item) continue;
    const r = asRecord(s)!;
    const level: SkillLevel = /differenc/i.test(asString(r.niveau ?? r.level)) ? 'differenciant' : 'indispensable';
    const kindRaw = asString(r.type ?? r.kind).toLowerCase();
    const kind: SkillKind = kindRaw.startsWith('outil') || kindRaw === 'tool' ? 'outil' : kindRaw.startsWith('certif') ? 'certification' : 'competence';
    skills.push({ ...item, level, kind });
  }

  const recherche = asRecord(body.recherche) ?? asRecord(body.research);
  const doneClaimed = recherche ? recherche.effectuee !== false && recherche.done !== false : true;
  const brief: TargetBrief = {
    version: BRIEF_VERSION,
    research: { done: doneClaimed, ...(asString(recherche?.raison ?? recherche?.reason) ? { reason: cleanItemText(asString(recherche?.raison ?? recherche?.reason)) } : {}) },
    title,
    titleVariants: variants,
    skills,
    vocabulary: list(body.vocabulaire ?? body.vocabulary),
    verbs: list(body.verbes ?? body.verbs),
    indicators: list(body.indicateurs ?? body.indicators),
    context: list(body.contexte ?? body.context),
    company: list(body.entreprise ?? body.company),
    risks: list(body.signauxRisque ?? body.risks),
    sources,
    researchedAt: validDate(asString(body.dateRecherche ?? body.researchedAt)) && asString(body.dateRecherche ?? body.researchedAt).length === 10
      ? asString(body.dateRecherche ?? body.researchedAt) : isoDay(now),
  };

  const count = briefItemCount(brief);
  report.usable = brief.research.done && count > 0 && sources.length > 0;
  if (!report.usable) report.reason = brief.research.done ? 'Aucun élément de la fiche n\'a de source datée valide.' : (brief.research.reason ? `${NO_RESEARCH_MESSAGE} (${brief.research.reason})` : NO_RESEARCH_MESSAGE);
  return { brief, report };
}

/** Nombre d'éléments de la fiche (hors sources). */
export function briefItemCount(brief: TargetBrief): number {
  return (brief.title ? 1 : 0) + brief.skills.length + BRIEF_LISTS.reduce((n, k) => n + brief[k].length, 0);
}

/** Lit un texte collé (JSON entouré ou non de texte et de balises de code) en fiche contrôlée. */
export function parseTargetBriefText(text: string, opts: ValidateOptions = {}): { ok: true; brief: TargetBrief; report: BriefReport } | { ok: false; message: string } {
  const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
  if (!cleaned) return { ok: false, message: 'Collez d\'abord la réponse de l\'IA.' };
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start === -1 || end <= start) return { ok: false, message: 'Cette réponse ne ressemble pas à une fiche : elle doit être un bloc commençant par « { ». Demandez à l\'IA de ne répondre que par ce bloc.' };
    try { parsed = JSON.parse(cleaned.slice(start, end + 1)); } catch {
      return { ok: false, message: 'Cette réponse est coupée ou abîmée. Demandez à l\'IA de la redonner en entier, sans texte autour.' };
    }
  }
  if (asRecord(parsed) === null) return { ok: false, message: 'Cette réponse ne ressemble pas à une fiche.' };
  return { ok: true, ...validateTargetBrief(parsed, opts) };
}

// ─── Corrections de la personne ───────────────────────────────────────────────

/** Retire un élément (rubrique de texte libre ou compétence). */
export function removeBriefItem(brief: TargetBrief, list: BriefList | 'skills', index: number): TargetBrief {
  if (list === 'skills') return { ...brief, skills: brief.skills.filter((_, i) => i !== index) };
  return { ...brief, [list]: brief[list].filter((_, i) => i !== index) };
}

/**
 * Ajoute un élément écrit par la personne : il porte la source « vous » (pas de source externe) et
 * compte comme saisi par elle. Même nettoyage que le reste de la fiche.
 */
export const USER_SOURCE_ID = 'vous';
export function addBriefItem(brief: TargetBrief, list: BriefList | 'skills', text: string, now: Date = new Date()): TargetBrief {
  const clean = cleanItemText(text);
  if (!clean || looksLikeInstruction(clean)) return brief;
  const sources = brief.sources.some(s => s.id === USER_SOURCE_ID)
    ? brief.sources
    : [...brief.sources, { id: USER_SOURCE_ID, url: 'https://phenix-cv.invalid/saisie', site: 'Saisi par vous', type: 'autre' as const, dateConsultation: isoDay(now) }];
  const item: BriefItem = { text: clean, sources: [USER_SOURCE_ID], confidence: 'source-unique' };
  const next = { ...brief, sources };
  return list === 'skills'
    ? { ...next, skills: [...brief.skills, { ...item, level: 'differenciant', kind: 'competence' }] }
    : { ...next, [list]: [...brief[list], item] };
}

// ─── Cache ────────────────────────────────────────────────────────────────────

const fold = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** Clé de cache : métier, secteur et entreprise, sans accents ni majuscules. */
export function briefKey(input: { role: string; sector?: string; company?: string }): string {
  return [input.role, input.sector ?? '', input.company ?? ''].map(fold).join('|');
}

/** Jours écoulés depuis la recherche. */
export function briefAgeDays(brief: Pick<TargetBrief, 'researchedAt'>, now: Date = new Date()): number {
  const t = Date.parse(`${brief.researchedAt}T00:00:00Z`);
  return Number.isFinite(t) ? Math.max(0, Math.floor((now.getTime() - t) / 86_400_000)) : 0;
}

export const briefIsStale = (brief: Pick<TargetBrief, 'researchedAt'>, now: Date = new Date()): boolean => briefAgeDays(brief, now) > STALE_AFTER_DAYS;

/** Éléments de la fiche qui servent de « termes du marché » au contrôle du CV (compétences, outils, certifications). */
export function marketTerms(brief: TargetBrief): string[] {
  return brief.skills.map(s => s.text);
}
