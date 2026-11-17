/**
 * Valeurs d'un tableau de suivi → valeurs Phénix CV : dates, statuts, sources, salaires. Pur.
 *
 * Rien n'est inventé : une valeur illisible est laissée vide, avec un message ; une date sans
 * jour (« mars 2026 ») est datée du 1er du mois et marquée approximative.
 */
import type { ApplicationSource, ApplicationStatus } from '@/types/application';
import { APPLICATION_STATUSES, SOURCE_LABELS, STATUS_LABELS } from '@/lib/application-labels';
import { normalizeText } from './fields';

// ─── Dates ────────────────────────────────────────────────────────────────────

/** Ordre du jour et du mois dans « 03/04/2026 » : français par défaut. */
export type DateOrder = 'dmy' | 'mdy';

export interface ParsedDate {
  /** AAAA-MM-JJ, ou `null` (cellule vide ou illisible). */
  value: string | null;
  /** Jour inconnu : 1er du mois retenu. */
  approximate: boolean;
  /** `false` : la cellule n'est pas une date lisible. */
  ok: boolean;
  /** Explication pour l'aperçu (date approximative ou illisible). */
  message?: string;
}

const MONTHS: Record<string, number> = {
  janvier: 1, janv: 1, jan: 1, january: 1,
  fevrier: 2, fevr: 2, fev: 2, feb: 2, february: 2,
  mars: 3, mar: 3, march: 3,
  avril: 4, avr: 4, apr: 4, april: 4,
  mai: 5, may: 5,
  juin: 6, jun: 6, june: 6,
  juillet: 7, juil: 7, jul: 7, july: 7,
  aout: 8, aug: 8, august: 8,
  septembre: 9, sept: 9, sep: 9, september: 9,
  octobre: 10, oct: 10, october: 10,
  novembre: 11, nov: 11, november: 11,
  decembre: 12, dec: 12, december: 12,
};

const MONTH_NAMES_FR = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

const pad = (n: number) => String(n).padStart(2, '0');
const isValidDate = (y: number, m: number, d: number) =>
  y >= 1900 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= new Date(Date.UTC(y, m, 0)).getUTCDate();
const fullYear = (y: number) => (y < 100 ? 2000 + y : y);

const exact = (y: number, m: number, d: number): ParsedDate | null =>
  isValidDate(y, m, d) ? { value: `${y}-${pad(m)}-${pad(d)}`, approximate: false, ok: true } : null;

const monthOnly = (raw: string, y: number, m: number): ParsedDate | null =>
  isValidDate(y, m, 1)
    ? { value: `${y}-${pad(m)}-01`, approximate: true, ok: true, message: `« ${raw} » : jour inconnu, le 1er ${MONTH_NAMES_FR[m - 1]} ${y} est retenu (date approximative).` }
    : null;

/** Numéro de série d'une date Excel (jours depuis le 30/12/1899), entre 1954 et 2119. */
export function excelSerialToDate(serial: number): string | null {
  if (!Number.isFinite(serial) || serial < 20000 || serial > 80000) return null;
  const d = new Date(Date.UTC(1899, 11, 30) + Math.floor(serial) * 86400000);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

export function parseDateCell(raw: string, order: DateOrder = 'dmy'): ParsedDate {
  const text = raw.trim();
  if (!text) return { value: null, approximate: false, ok: true };
  const invalid: ParsedDate = { value: null, approximate: false, ok: false, message: `« ${text} » n'est pas une date lisible : laissée vide.` };
  let m: RegExpExecArray | null;

  // 2026-03-12, 2026-03-12T09:00:00Z, 2026/03/12
  if ((m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[T ].*)?$/.exec(text))) return exact(+m[1], +m[2], +m[3]) ?? invalid;
  // 12/03/2026, 12-03-26, 12.03.2026 (éventuellement suivi d'une heure)
  if ((m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})(?:\s+\d{1,2}[:h]\d{2}.*)?$/.exec(text))) {
    const [a, b, y] = [+m[1], +m[2], fullYear(+m[3])];
    return (order === 'dmy' ? exact(y, b, a) : exact(y, a, b)) ?? invalid;
  }
  // 2026-03, 03/2026 : mois seulement
  if ((m = /^(\d{4})[-/.](\d{1,2})$/.exec(text))) return monthOnly(text, +m[1], +m[2]) ?? invalid;
  if ((m = /^(\d{1,2})[/.-](\d{4})$/.exec(text))) return monthOnly(text, +m[2], +m[1]) ?? invalid;
  // Numéro de série Excel (cellule de date copiée sans sa mise en forme)
  if (/^\d{5}(?:[.,]\d+)?$/.test(text)) {
    const value = excelSerialToDate(Number(text.replace(',', '.')));
    return value ? { value, approximate: false, ok: true } : invalid;
  }

  // Mois en toutes lettres : « 12 mars 2026 », « 1er mars 2026 », « 12-Mar-26 », « March 12, 2026 », « mars 2026 »
  const norm = normalizeText(text).replace(/\b1er\b/, '1');
  const tokens = norm.split(' ').filter(t => !['le', 'the', 'of', 'de'].includes(t));
  const monthIndex = tokens.findIndex(t => MONTHS[t] !== undefined);
  if (monthIndex === -1) return invalid;
  const month = MONTHS[tokens[monthIndex]];
  const numbers = tokens.filter((t, i) => i !== monthIndex && /^\d+$/.test(t)).map(Number);
  if (tokens.length - 1 !== numbers.length) return invalid;
  // Un seul nombre : l'année (« mars 2026 ») ; jour inconnu.
  if (numbers.length === 1) return numbers[0] >= 1900 ? monthOnly(text, numbers[0], month) ?? invalid : invalid;
  // Deux nombres : un jour et une année ; une année sur deux chiffres est la dernière (« 12-Mar-26 »).
  if (numbers.length === 2) {
    const yearPos = numbers[0] >= 1900 ? 0 : 1;
    const year = fullYear(numbers[yearPos]);
    return exact(year, month, numbers[1 - yearPos]) ?? invalid;
  }
  return invalid;
}

/**
 * Ordre jour/mois d'une colonne de dates : une valeur dont le premier nombre dépasse 12
 * tranche pour le format français, le second pour le format américain. Par défaut : français.
 */
export function detectDateOrder(values: readonly string[]): { order: DateOrder; ambiguous: boolean } {
  let dmy = 0;
  let mdy = 0;
  for (const v of values) {
    const m = /^(\d{1,2})[/.-](\d{1,2})[/.-]\d{2,4}/.exec(v.trim());
    if (!m) continue;
    if (+m[1] > 12) dmy++;
    else if (+m[2] > 12) mdy++;
  }
  if (mdy > 0 && dmy === 0) return { order: 'mdy', ambiguous: false };
  return { order: 'dmy', ambiguous: dmy === 0 && mdy === 0 };
}

// ─── Statuts ──────────────────────────────────────────────────────────────────

/** Mots reconnus, par ordre de priorité (« Refusé après entretien » est un refus). */
const STATUS_RULES: readonly [ApplicationStatus, readonly string[]][] = [
  ['draft', ['a postuler', 'a envoyer', 'a faire', 'a preparer', 'brouillon', 'draft', 'todo', 'to do', 'wishlist', 'idee', 'interessant', 'prevu', 'pas encore postule']],
  ['withdrawn', ['abandon', 'abandonne', 'abandonnee', 'retire', 'retiree', 'desiste', 'desistement', 'withdrawn', 'withdrew', 'annule', 'annulee']],
  ['ghosted', ['pas de reponse', 'sans reponse', 'aucune reponse', 'sans nouvelles', 'pas de nouvelles', 'no answer', 'no response', 'ghosted', 'ghost']],
  ['rejected', ['refus', 'refuse', 'refusee', 'rejet', 'rejete', 'rejetee', 'rejected', 'declined', 'non retenu', 'non retenue', 'pas retenu', 'pas retenue', 'negatif', 'negative', 'echec', 'ko']],
  ['accepted', ['accepte', 'acceptee', 'accepted', 'embauche', 'embauchee', 'hired', 'contrat signe', 'signe', 'recrute', 'recrutee']],
  ['offer', ['offre recue', 'proposition', 'promesse d embauche', 'offer', 'offre']],
  ['phone_screen', ['entretien telephonique', 'pre qualification', 'prequalification', 'pre qualif', 'telephone', 'appel', 'phone screen', 'phone', 'screening', 'call']],
  ['technical_test', ['test technique', 'cas pratique', 'exercice', 'assessment', 'test']],
  ['interview', ['entretien', 'interview', 'entrevue', 'rendez vous', 'rdv']],
  ['acknowledged', ['accuse de reception', 'accuse reception', 'bien recu', 'recu', 'acknowledged', 'received']],
  ['applied', ['postule', 'postulee', 'candidature envoyee', 'envoye', 'envoyee', 'depose', 'deposee', 'applied', 'submitted', 'sent', 'en attente', 'en cours', 'relance', 'relancee', 'candidate']],
];

const containsWords = (text: string, words: string) => ` ${text} `.includes(` ${words} `);

/** Statut Phénix proposé pour une valeur de la colonne « statut », ou `null` (inconnu). */
export function suggestStatus(raw: string): ApplicationStatus | null {
  const norm = normalizeText(raw);
  if (!norm) return null;
  const code = norm.replace(/ /g, '_');
  if ((APPLICATION_STATUSES as readonly string[]).includes(code)) return code as ApplicationStatus;
  for (const status of APPLICATION_STATUSES) if (normalizeText(STATUS_LABELS[status]) === norm) return status;
  for (const [status, words] of STATUS_RULES) if (words.some(w => containsWords(norm, w))) return status;
  return null;
}

/** Statut par défaut d'une valeur inconnue (colonne « Brouillon »), avec une alerte. */
export const DEFAULT_STATUS: ApplicationStatus = 'draft';

// ─── Sources ──────────────────────────────────────────────────────────────────

const SOURCE_RULES: readonly [ApplicationSource, readonly string[]][] = [
  ['linkedin', ['linkedin']],
  ['spontaneous', ['spontanee', 'spontane', 'spontaneous', 'candidature libre']],
  ['network', ['reseau', 'network', 'cooptation', 'recommandation', 'recommande', 'bouche a oreille', 'referral', 'ami', 'amie', 'ancien collegue', 'contact perso']],
  ['recruiter', ['cabinet', 'recruteur', 'recruteuse', 'chasseur', 'chasseuse', 'headhunter', 'recruiter', 'agence', 'interim']],
  ['job_board', ['indeed', 'welcome to the jungle', 'wttj', 'apec', 'france travail', 'pole emploi', 'hellowork', 'regionsjob', 'monster', 'cadremploi', 'jobteaser', 'meteojob', 'glassdoor', 'job board', 'jobboard', 'site d emploi', 'site d offres', 'site carriere', 'annonce']],
];

/** Source Phénix et détail conservé (« Indeed » → site d'offres, détail « Indeed »). */
export function suggestSource(raw: string): { source: ApplicationSource | null; detail: string | null } {
  const text = raw.trim();
  if (!text) return { source: null, detail: null };
  const norm = normalizeText(text);
  for (const [source, words] of SOURCE_RULES) {
    if (!words.some(w => containsWords(norm, w))) continue;
    // Détail gardé, sauf quand la valeur n'est que le nom générique de la source (« LinkedIn », « Réseau »).
    const generic = norm === normalizeText(source) || norm === normalizeText(SOURCE_LABELS[source]) || (norm === words[0] && source !== 'job_board');
    return { source, detail: generic ? null : text };
  }
  return { source: 'other', detail: text };
}

// ─── Salaires ─────────────────────────────────────────────────────────────────

/**
 * Salaire annuel en euros : « 35 000 € », « 35k », « 35-40 k€ », « de 35 000 à 40 000 ».
 * `null` si illisible (le texte d'origine reste disponible pour les notes).
 */
export function parseSalary(raw: string): { min: number; max: number } | null {
  const text = raw.toLowerCase().replace(/ | /g, ' ').trim();
  if (!text) return null;
  const thousands = /\d\s*k/.test(text) || /k\s*€|k€|keur|k eur/.test(text);
  const numbers = [...text.replace(/(\d)[ .](?=\d{3}\b)/g, '$1').matchAll(/\d+(?:[.,]\d+)?/g)].map(m => Number(m[0].replace(',', '.')));
  if (numbers.length === 0 || numbers.length > 2) return null;
  const values = numbers.map(n => Math.round(thousands && n < 1000 ? n * 1000 : n));
  if (values.some(v => v < 1000 || v > 1_000_000)) return null;
  const [min, max] = [Math.min(...values), Math.max(...values)];
  return { min, max };
}
