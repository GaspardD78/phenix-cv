/**
 * Lecture d'un tableau collé depuis Excel, Google Sheets ou LibreOffice, ou d'un fichier .csv. Pur.
 *
 * Le presse-papiers contient en général deux versions du même tableau :
 * - HTML (`text/html`) : la plus fidèle (retours à la ligne dans une cellule, cellules fusionnées) ;
 * - texte (`text/plain`) : cellules séparées par des tabulations. Une cellule qui contient une
 *   tabulation, un retour à la ligne ou des guillemets est entourée de guillemets, et ses
 *   guillemets intérieurs sont doublés.
 * Un .csv d'Excel en français sépare les cellules par « ; », ailleurs par « , ».
 * Le contenu des cellules n'est jamais interprété : c'est du texte.
 */

export type Table = string[][];

/** Au-delà, l'import est refusé (sans IA comme avec). */
export const MAX_ROWS = 2000;
export const MAX_COLUMNS = 60;

// ─── Texte séparé (tabulations, point-virgule, virgule) ──────────────────────

/** Lecture façon RFC 4180, quel que soit le séparateur : guillemets, guillemets doublés, retours à la ligne dans une cellule. */
export function parseDelimited(text: string, separator: string): Table {
  const rows: Table = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  let atCellStart = true;
  const src = text.replace(/^﻿/, '');
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') { cell += '"'; i++; } else quoted = false;
      } else {
        cell += ch;
      }
      continue;
    }
    if (ch === '"' && atCellStart) { quoted = true; atCellStart = false; continue; }
    if (ch === separator) { row.push(cell); cell = ''; atCellStart = true; continue; }
    if (ch === '\r' || ch === '\n') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = []; cell = ''; atCellStart = true;
      continue;
    }
    cell += ch;
    atCellStart = false;
  }
  if (cell !== '' || row.length > 0) { row.push(cell); rows.push(row); }
  return rows;
}

/** Séparateur le plus probable : tabulation (collage), sinon « ; » ou « , » (fichier .csv). */
export function detectSeparator(text: string): '\t' | ';' | ',' {
  const sample = text.split(/\r?\n/).slice(0, 20).join('\n').replace(/"[^"]*"/g, '');
  if (sample.includes('\t')) return '\t';
  const count = (c: string) => sample.split(c).length - 1;
  return count(';') >= count(',') && count(';') > 0 ? ';' : ',';
}

// ─── Tableau HTML (Excel, Google Sheets, LibreOffice) ────────────────────────

const ENTITIES: Record<string, string> = { nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: '\'', laquo: '«', raquo: '»', euro: '€', eacute: 'é', egrave: 'è', agrave: 'à', ccedil: 'ç', ecirc: 'ê', ocirc: 'ô', rsquo: '’', hellip: '…' };

export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, code: string) => {
    if (code[0] === '#') {
      const n = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : whole;
    }
    return ENTITIES[code.toLowerCase()] ?? whole;
  });
}

/** Texte d'une cellule HTML : <br> et fins de paragraphe deviennent des retours à la ligne, balises retirées. */
function cellText(html: string): string {
  const text = html
    // Comme à l'affichage : les espaces et retours à la ligne du code HTML valent un espace.
    .replace(/\s+/g, ' ')
    // Excel : <br style='mso-data-placement:same-cell'> = retour à la ligne dans la cellule.
    .replace(/<br\b[^>]*>/gi, '\n')
    .replace(/<\/(p|div|li)>/gi, '\n')
    .replace(/<[^>]*>/g, '');
  return decodeEntities(text)
    .replace(/ /g, ' ')
    .split('\n').map(line => line.replace(/ {2,}/g, ' ').trim()).join('\n')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

/**
 * Premier tableau d'un fragment HTML, ou `null` s'il n'y en a pas. Les cellules fusionnées
 * horizontalement (colspan) occupent leurs colonnes, la première porte le texte.
 */
export function parseHtmlTable(html: string): Table | null {
  const withoutComments = html.replace(/<!--[\s\S]*?-->/g, '').replace(/<(style|script)[\s\S]*?<\/\1>/gi, '');
  const table = /<table[\s\S]*?<\/table>/i.exec(withoutComments);
  if (!table) return null;
  const rows: Table = [];
  for (const tr of table[0].matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const row: string[] = [];
    for (const td of tr[1].matchAll(/<t([dh])([^>]*)>([\s\S]*?)<\/t\1>/gi)) {
      row.push(cellText(td[3]));
      const span = /colspan\s*=\s*["']?(\d+)/i.exec(td[2]);
      for (let k = 1; k < Math.min(Number(span?.[1] ?? 1), MAX_COLUMNS); k++) row.push('');
    }
    rows.push(row);
  }
  return rows.length > 0 ? rows : null;
}

// ─── Tableau final ────────────────────────────────────────────────────────────

/** Lignes et colonnes entièrement vides retirées ; toutes les lignes ont la même largeur. */
export function tidyTable(rows: Table): Table {
  const trimmed = rows.map(r => r.map(c => c.replace(/\r\n?/g, '\n').trim()));
  const nonEmpty = trimmed.filter(r => r.some(c => c !== ''));
  const width = Math.min(MAX_COLUMNS, Math.max(0, ...nonEmpty.map(r => r.length)));
  const used = Array.from({ length: width }, (_, j) => nonEmpty.some(r => (r[j] ?? '') !== ''));
  return nonEmpty.map(r => Array.from({ length: width }, (_, j) => r[j] ?? '').filter((_, j) => used[j]));
}

export interface PastedContent {
  /** Version HTML du presse-papiers, si présente. */
  html?: string | null;
  /** Version texte (ou contenu d'un fichier .csv). */
  text?: string | null;
}

export type ReadTableResult =
  | { ok: true; rows: Table; from: 'html' | 'tabulations' | 'point-virgule' | 'virgule' }
  | { ok: false; message: string };

export const EMPTY_PASTE_MESSAGE = 'Rien à lire : copiez les cellules de votre tableau (titres compris), puis collez-les ici.';
export const TOO_MANY_ROWS_MESSAGE = `Votre tableau dépasse ${MAX_ROWS} lignes. Importez-le en plusieurs fois.`;

/** Lecture d'un collage ou d'un fichier : HTML d'abord, sinon texte. */
export function readPastedTable(content: PastedContent): ReadTableResult {
  const fromHtml = content.html ? parseHtmlTable(content.html) : null;
  if (fromHtml) {
    const rows = tidyTable(fromHtml);
    if (rows.length > 0) return rows.length > MAX_ROWS + 1 ? { ok: false, message: TOO_MANY_ROWS_MESSAGE } : { ok: true, rows, from: 'html' };
  }
  const text = content.text ?? '';
  if (!text.trim()) return { ok: false, message: EMPTY_PASTE_MESSAGE };
  const sep = detectSeparator(text);
  const rows = tidyTable(parseDelimited(text, sep));
  if (rows.length === 0) return { ok: false, message: EMPTY_PASTE_MESSAGE };
  if (rows.length > MAX_ROWS + 1) return { ok: false, message: TOO_MANY_ROWS_MESSAGE };
  return { ok: true, rows, from: sep === '\t' ? 'tabulations' : sep === ';' ? 'point-virgule' : 'virgule' };
}
