/**
 * Nom de fichier proposé à l'export d'un CV (PDF et DOCX) :
 * `Prénom_Nom_Titre_du_poste_MM_AAAA.ext`, par exemple `Camille_Martin_Assistante_commerciale_11_2026.pdf`.
 *
 * Ce n'est qu'une proposition : la fenêtre d'enregistrement laisse la personne la modifier.
 * Logique pure, sans React ni Tauri.
 */

export type ExportExtension = 'pdf' | 'docx';

export interface ExportFilenameInput {
  firstName?: string | null;
  lastName?: string | null;
  /** Titre du poste affiché sur le CV. */
  cvTitle?: string | null;
  /** Date de l'export (mois et année, heure locale). */
  date: Date;
  extension: ExportExtension;
}

/** Nombre maximal de mots gardés du titre du poste. */
export const MAX_TITLE_WORDS = 5;

/** Lettres que la décomposition Unicode ne sépare pas de leurs accents. */
const LIGATURES: Record<string, string> = {
  'œ': 'oe', 'Œ': 'OE', 'æ': 'ae', 'Æ': 'AE', 'ß': 'ss', 'ø': 'o', 'Ø': 'O', 'ł': 'l', 'Ł': 'L', 'đ': 'd', 'Đ': 'D',
};

/** Caractères interdits dans un nom de fichier Windows, et caractères de contrôle. */
const FORBIDDEN = /[\\/:*?"<>|\u0000-\u001f\u007f]/g;

/** Espaces et apostrophes (droite, typographiques, accent grave) : remplacés par `_`. */
const SEPARATORS = /[\s'’‘`]+/gu;

function removeAccents(text: string): string {
  return text
    .replace(/[œŒæÆßøØłŁđĐ]/g, ch => LIGATURES[ch] ?? ch)
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

/** Nettoie une partie du nom ; renvoie une chaîne vide s'il ne reste rien. */
function cleanPart(text: string): string {
  return removeAccents(text)
    .replace(FORBIDDEN, '')
    .replace(SEPARATORS, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/** Garde au plus `MAX_TITLE_WORDS` mots du titre (mots séparés par des espaces). */
function truncateTitle(title: string): string {
  return title.trim().split(/\s+/u).slice(0, MAX_TITLE_WORDS).join(' ');
}

/** `MM_AAAA` à la date donnée (heure locale), ex. `03_2027`. */
export function monthYearSlug(date: Date): string {
  return `${String(date.getMonth() + 1).padStart(2, '0')}_${date.getFullYear()}`;
}

export function buildExportFilename({ firstName, lastName, cvTitle, date, extension }: ExportFilenameInput): string {
  const parts = [firstName ?? '', lastName ?? '', truncateTitle(cvTitle ?? '')]
    .map(cleanPart)
    .filter(Boolean);
  const stem = parts.length > 0 ? parts.join('_') : 'CV';
  return `${stem}_${monthYearSlug(date)}.${extension}`;
}

/**
 * Nom proposé pour un CV donné : même règle de titre que le rendu du CV
 * (poste visé du CV, sinon titre de « Mon profil »), donc même nom en PDF et en DOCX.
 */
export function cvExportFilename(
  cv: { targetJob?: string | null },
  profile: { firstName?: string | null; lastName?: string | null; title?: string | null },
  extension: ExportExtension,
  date: Date = new Date(),
): string {
  return buildExportFilename({
    firstName: profile.firstName,
    lastName: profile.lastName,
    cvTitle: cv.targetJob || profile.title,
    date,
    extension,
  });
}
