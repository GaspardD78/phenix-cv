/**
 * Colonnes d'un tableau de suivi → champs d'une candidature Phénix CV. Pur.
 *
 * Les propositions viennent du nom de la colonne (français ou anglais, sans accents ni
 * majuscules), puis, à défaut, de son contenu (adresses e-mail, numéros, liens, dates).
 * La personne valide ou corrige chaque proposition : rien n'est importé sans elle.
 */
import type { Table } from './table';

export type FieldId =
  | 'companyName' | 'jobTitle' | 'status' | 'appliedAt' | 'jobUrl' | 'source' | 'location' | 'remotePolicy'
  | 'salary' | 'contactName' | 'contactEmail' | 'contactPhone' | 'nextAction' | 'nextActionDate' | 'notes' | 'jobDescription';

export interface ImportField {
  id: FieldId;
  label: string;
  required?: boolean;
  /** Coordonnées d'une personne : jamais envoyées à une IA par défaut. */
  contact?: boolean;
}

export const IMPORT_FIELDS: readonly ImportField[] = [
  { id: 'companyName', label: 'Entreprise', required: true },
  { id: 'jobTitle', label: 'Poste', required: true },
  { id: 'status', label: 'Statut' },
  { id: 'appliedAt', label: 'Date de candidature' },
  { id: 'jobUrl', label: 'Lien de l\'annonce' },
  { id: 'source', label: 'Source' },
  { id: 'location', label: 'Lieu' },
  { id: 'remotePolicy', label: 'Télétravail' },
  { id: 'salary', label: 'Salaire' },
  { id: 'contactName', label: 'Nom du contact', contact: true },
  { id: 'contactEmail', label: 'E-mail du contact', contact: true },
  { id: 'contactPhone', label: 'Téléphone du contact', contact: true },
  { id: 'nextAction', label: 'Prochaine action' },
  { id: 'nextActionDate', label: 'Date de la prochaine action' },
  { id: 'notes', label: 'Notes' },
  { id: 'jobDescription', label: 'Description du poste' },
];

/** Minuscules, sans accents ni ponctuation, espaces simples. */
export function normalizeText(text: string): string {
  return text
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Noms de colonnes reconnus, par ordre de priorité : les plus précis d'abord
 * (« Date de relance » avant « Date », « E-mail du contact » avant « Contact »).
 */
const SYNONYMS: readonly [FieldId, readonly string[]][] = [
  ['nextActionDate', ['date de relance', 'date relance', 'relancer le', 'relance le', 'date prochaine action', 'date de la prochaine action', 'echeance', 'follow up date', 'follow up', 'next step date', 'rappel le']],
  ['contactEmail', ['adresse mail', 'adresse email', 'adresse e mail', 'e mail', 'email', 'mail', 'courriel']],
  ['contactPhone', ['telephone', 'tel', 'phone', 'portable', 'mobile', 'numero']],
  ['jobUrl', ['lien de l annonce', 'lien annonce', 'lien de l offre', 'url de l annonce', 'adresse de l annonce', 'lien', 'url', 'link', 'site web']],
  ['jobDescription', ['description du poste', 'job description', 'descriptif', 'description', 'missions']],
  ['appliedAt', ['date de candidature', 'date candidature', 'date d envoi', 'date envoi', 'envoye le', 'postule le', 'date de postulation', 'date postulation', 'applied on', 'date applied', 'application date', 'applied', 'date']],
  ['nextAction', ['prochaine action', 'prochaine etape', 'next step', 'next action', 'a faire', 'todo', 'to do', 'relance', 'action']],
  ['contactName', ['nom du contact', 'nom du recruteur', 'contact', 'recruteur', 'recruteuse', 'interlocuteur', 'interlocutrice', 'recruiter', 'hiring manager', 'rh']],
  ['companyName', ['raison sociale', 'nom de l entreprise', 'entreprise', 'societe', 'company', 'employeur', 'employer', 'organisation', 'organization', 'structure', 'boite', 'client', 'firm']],
  ['jobTitle', ['intitule du poste', 'titre du poste', 'job title', 'intitule', 'poste', 'position', 'fonction', 'emploi', 'metier', 'role', 'title', 'job']],
  ['status', ['statut', 'etat', 'status', 'etape', 'avancement', 'situation', 'resultat', 'reponse', 'stage']],
  ['source', ['site d annonce', 'source', 'canal', 'via', 'plateforme', 'platform', 'origine', 'provenance', 'channel']],
  ['location', ['localisation', 'lieu', 'ville', 'location', 'city', 'adresse', 'region']],
  ['remotePolicy', ['teletravail', 'travail a distance', 'mode de travail', 'remote', 'hybride']],
  ['salary', ['remuneration', 'salaire', 'salary', 'fourchette', 'package', 'brut', 'pay']],
  ['notes', ['commentaires', 'commentaire', 'remarques', 'remarque', 'observations', 'notes', 'note', 'comments', 'comment', 'infos', 'informations', 'details']],
];

const containsWords = (text: string, words: string) => ` ${text} `.includes(` ${words} `);

/** Champ proposé d'après le nom de la colonne, ou `null`. */
export function suggestFieldFromHeader(header: string): FieldId | null {
  const norm = normalizeText(header);
  if (!norm) return null;
  for (const [field, words] of SYNONYMS) if (words.some(w => norm === w)) return field;
  for (const [field, words] of SYNONYMS) if (words.some(w => containsWords(norm, w))) return field;
  return null;
}

// ─── Contenu des cellules ─────────────────────────────────────────────────────

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const PHONE_RE = /^(?:\+|00)?[\d\s().-]{8,20}$/;
export const URL_RE = /^(?:https?:\/\/|www\.)\S+$/i;
const DATE_LIKE_RE = /^(\d{4}-\d{1,2}(-\d{1,2})?|\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}|\d{1,2}[/.-]\d{4})$/;

const share = (values: readonly string[], test: (v: string) => boolean) => {
  const filled = values.map(v => v.trim()).filter(Boolean);
  return filled.length === 0 ? 0 : filled.filter(test).length / filled.length;
};

const isPhone = (v: string) => PHONE_RE.test(v) && v.replace(/\D/g, '').length >= 9;

export function looksLikeDateCell(value: string): boolean {
  return DATE_LIKE_RE.test(value.trim());
}

/** Champ proposé d'après le contenu d'une colonne (au moins 60 % des cellules remplies), ou `null`. */
export function suggestFieldFromValues(values: readonly string[]): FieldId | null {
  if (share(values, v => EMAIL_RE.test(v)) >= 0.6) return 'contactEmail';
  if (share(values, v => URL_RE.test(v)) >= 0.6) return 'jobUrl';
  if (share(values, isPhone) >= 0.6) return 'contactPhone';
  return null;
}

/**
 * Colonne de coordonnées (e-mail, téléphone, nom d'une personne) : décochée par défaut avant
 * d'envoyer le tableau à une IA. Reconnue à son nom ou à son contenu.
 */
export function isContactColumn(header: string, values: readonly string[]): boolean {
  const field = suggestFieldFromHeader(header);
  if (field && IMPORT_FIELDS.find(f => f.id === field)?.contact) return true;
  return share(values, v => EMAIL_RE.test(v)) >= 0.3 || share(values, isPhone) >= 0.3;
}

// ─── Ligne d'en-tête et correspondance ───────────────────────────────────────

/** La première ligne contient-elle les titres des colonnes ? */
export function detectHeaderRow(rows: Table): boolean {
  if (rows.length === 0) return false;
  const first = rows[0].filter(c => c.trim());
  if (first.length === 0) return false;
  const valueLike = (c: string) => looksLikeDateCell(c) || EMAIL_RE.test(c) || URL_RE.test(c) || /^[\d\s.,€%+-]+$/.test(c);
  if (first.some(valueLike)) return false;
  if (first.some(c => suggestFieldFromHeader(c))) return true;
  // Titres inconnus : courts, et les lignes suivantes ont un autre aspect (dates, nombres, liens…).
  const below = rows.slice(1, 6);
  return first.every(c => c.length <= 40 && !c.includes('\n')) && below.some(r => r.some(c => c.trim() && valueLike(c)));
}

export interface ColumnInfo {
  index: number;
  /** Titre de la colonne (« Colonne C » sans ligne de titres). */
  header: string;
  /** Valeurs de la colonne (lignes de données). */
  values: string[];
  suggested: FieldId | null;
  contact: boolean;
}

/** Lettre de colonne façon tableur : 0 → A, 26 → AA. */
export function columnLetter(index: number): string {
  let n = index + 1;
  let out = '';
  while (n > 0) { const r = (n - 1) % 26; out = String.fromCharCode(65 + r) + out; n = Math.floor((n - 1) / 26); }
  return out;
}

/**
 * Colonnes du tableau, avec une proposition de champ pour chacune. Un champ n'est proposé
 * qu'une fois (la première colonne qui lui correspond).
 */
export function describeColumns(rows: Table, hasHeader: boolean): ColumnInfo[] {
  const width = rows[0]?.length ?? 0;
  const data = hasHeader ? rows.slice(1) : rows;
  const used = new Set<FieldId>();
  const columns: ColumnInfo[] = [];
  for (let j = 0; j < width; j++) {
    const header = hasHeader && rows[0][j].trim() ? rows[0][j].trim() : `Colonne ${columnLetter(j)}`;
    const values = data.map(r => r[j] ?? '');
    let suggested = (hasHeader ? suggestFieldFromHeader(header) : null) ?? suggestFieldFromValues(values);
    // « Relance » contenant des dates : c'est la date de la prochaine action.
    if (suggested === 'nextAction' && share(values, looksLikeDateCell) >= 0.6) suggested = 'nextActionDate';
    if (suggested && used.has(suggested)) suggested = null;
    if (suggested) used.add(suggested);
    columns.push({ index: j, header, values, suggested, contact: isContactColumn(hasHeader ? header : '', values) });
  }
  return columns;
}
