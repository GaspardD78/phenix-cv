/**
 * Lecture d'un classeur Excel (.xlsx, .xlsm) sans nouvelle dépendance : un .xlsx est une archive
 * ZIP de fichiers XML, ouverte avec `jszip` (déjà utilisé pour LinkedIn et les exports).
 *
 * Seules les valeurs sont lues, jamais interprétées : texte, nombres, booléens, et dates
 * (cellules au format date, rendues en AAAA-MM-JJ). Une formule donne sa dernière valeur
 * calculée. Les feuilles masquées sont ignorées. Pur (pas d'accès au disque).
 */
import JSZip from 'jszip';
import { MAX_ROWS, decodeEntities, type Table } from './table';

export interface XlsxSheet {
  name: string;
  /** Lignes non vides, dans l'ordre du classeur (au plus MAX_ROWS + 2 : au-delà, l'import est refusé). */
  rows: Table;
}

export type XlsxResult =
  | { ok: true; sheets: XlsxSheet[] }
  | { ok: false; message: string };

/** Au-delà, le fichier est refusé avant d'être ouvert. */
export const MAX_XLSX_BYTES = 20 * 1024 * 1024;
/** Taille maximale d'une partie décompressée (protection contre les archives piégées). */
const MAX_PART_BYTES = 60 * 1024 * 1024;
/** Colonnes lues au-delà de la première (les suivantes sont ignorées). */
const MAX_COLUMN_INDEX = 255;

const HOW_TO_PASTE = 'Ouvrez-le dans votre tableur, copiez les cellules (titres compris), puis collez-les ici.';
export const XLSX_UNREADABLE_MESSAGE = `Ce fichier n'est pas un classeur Excel lisible. ${HOW_TO_PASTE}`;
export const XLSX_OLD_FORMAT_MESSAGE = 'Ce classeur est au format Excel ancien (.xls) ou protégé par un mot de passe. Dans Excel, enregistrez-le au format .xlsx sans mot de passe, ou copiez les cellules et collez-les ici.';
export const XLSX_TOO_BIG_MESSAGE = `Ce fichier est trop volumineux pour être lu directement. ${HOW_TO_PASTE}`;
export const XLSX_EMPTY_MESSAGE = 'Ce classeur ne contient aucune donnée.';
export const ODS_MESSAGE = 'Un fichier LibreOffice (.ods) ne se lit pas directement : copiez les cellules dans LibreOffice, puis collez-les ici, ou enregistrez le fichier au format .xlsx ou .csv.';

// ─── Petits outils XML (le contenu vient de Microsoft Excel, LibreOffice, Google Sheets…) ──

/** Valeur d'un attribut, avec ou sans préfixe d'espace de noms (`r:id`). */
function attr(tag: string, name: string): string | null {
  const m = new RegExp(`\\s(?:[\\w.-]+:)?${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`).exec(tag);
  return m ? decodeEntities(m[1] ?? m[2]) : null;
}

/** Éléments `<name …>…</name>` ou `<name …/>`, avec ou sans préfixe (`<x:c>`). */
function* elements(xml: string, name: string): Generator<{ tag: string; body: string }> {
  const re = new RegExp(`<((?:[\\w.-]+:)?${name})\\b([^>]*?)(?:/>|>([\\s\\S]*?)</\\1>)`, 'g');
  for (const m of xml.matchAll(re)) yield { tag: m[2], body: m[3] ?? '' };
}

/** Texte des éléments `<t>` (texte enrichi compris), sans les indications phonétiques. */
function textOf(xml: string): string {
  const clean = xml.replace(/<(?:[\w.-]+:)?rPh\b[\s\S]*?<\/(?:[\w.-]+:)?rPh>/g, '');
  let text = '';
  for (const t of elements(clean, 't')) text += t.body;
  return unescapeXml(text);
}

/** Entités XML, puis caractères codés par Excel (`_x000D_` pour un retour chariot). */
function unescapeXml(text: string): string {
  return decodeEntities(text)
    .replace(/_x([0-9a-f]{4})_/gi, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/\r\n?/g, '\n');
}

/** « B12 » → 1 (colonne B, à partir de 0) ; `null` si la référence est illisible. */
export function columnIndex(ref: string): number | null {
  const m = /^([A-Z]{1,3})\d*$/i.exec(ref.replace(/\$/g, ''));
  if (!m) return null;
  let n = 0;
  for (const ch of m[1].toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

// ─── Dates ────────────────────────────────────────────────────────────────────

/** Formats de date intégrés à Excel (14 à 17 et 22 : dates ; 27 à 36 et 50 à 58 : dates asiatiques). */
const BUILTIN_DATE_FORMATS = new Set([14, 15, 16, 17, 22, 27, 28, 29, 30, 31, 34, 35, 36, 50, 51, 52, 53, 54, 55, 56, 57, 58]);

/** Un format personnalisé est une date s'il affiche un jour ou une année (« jj/mm/aaaa », « mmm-yy »…). */
export function isDateFormat(id: number, code: string | undefined): boolean {
  if (BUILTIN_DATE_FORMATS.has(id)) return true;
  if (!code) return false;
  const bare = code
    .replace(/"[^"]*"/g, '')
    .replace(/\\./g, '')
    .replace(/\[[^\]]*\]/g, '')
    .split(';')[0];
  return /[dyj]/i.test(bare) && !/^[#0.,\s%]*$/.test(bare);
}

/** Numéro de série d'une cellule de date → AAAA-MM-JJ (`null` : pas une date du calendrier). */
export function serialToIsoDate(serial: number, date1904: boolean): string | null {
  if (!Number.isFinite(serial) || serial < 1) return null;
  const days = Math.floor(serial) + (date1904 ? 1462 : 0);
  const d = new Date(Date.UTC(1899, 11, 30) + days * 86400000);
  const y = d.getUTCFullYear();
  if (y < 1900 || y > 9999) return null;
  return `${y}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

/** Nombre tel qu'affiché simplement : « 35000 », « 0,1 » (virgule française), sans artefact de calcul. */
function formatNumber(raw: string): string {
  const n = Number(raw);
  if (!Number.isFinite(n)) return raw.trim();
  return String(Number(n.toPrecision(15))).replace('.', ',');
}

// ─── Lecture ──────────────────────────────────────────────────────────────────

interface Styles { dateStyles: Set<number> }

function readStyles(xml: string | null): Styles {
  const dateStyles = new Set<number>();
  if (!xml) return { dateStyles };
  const codes = new Map<number, string>();
  for (const f of elements(xml, 'numFmt')) {
    const id = Number(attr(f.tag, 'numFmtId'));
    const code = attr(f.tag, 'formatCode');
    if (Number.isFinite(id) && code !== null) codes.set(id, code);
  }
  const cellXfs = /<(?:[\w.-]+:)?cellXfs\b[^>]*>([\s\S]*?)<\/(?:[\w.-]+:)?cellXfs>/.exec(xml);
  if (cellXfs) {
    let k = 0;
    for (const xf of elements(cellXfs[1], 'xf')) {
      const id = Number(attr(xf.tag, 'numFmtId') ?? 0);
      if (isDateFormat(id, codes.get(id))) dateStyles.add(k);
      k++;
    }
  }
  return { dateStyles };
}

function readSharedStrings(xml: string | null): string[] {
  if (!xml) return [];
  return [...elements(xml, 'si')].map(si => textOf(si.body));
}

interface SheetContext { shared: readonly string[]; styles: Styles; date1904: boolean }

function cellValue(tag: string, body: string, ctx: SheetContext): string {
  const type = attr(tag, 't') ?? 'n';
  if (type === 'inlineStr') return textOf(body);
  const v = /<(?:[\w.-]+:)?v\b[^>]*>([\s\S]*?)<\/(?:[\w.-]+:)?v>/.exec(body);
  const raw = v ? v[1] : '';
  switch (type) {
    case 's': return ctx.shared[Number(raw)] ?? '';
    case 'str': return unescapeXml(raw);
    case 'b': return raw.trim() === '1' ? 'VRAI' : raw.trim() === '0' ? 'FAUX' : '';
    case 'e': return '';
    // Date écrite en clair (format « strict ») : 2026-03-12T00:00:00
    case 'd': return /^\d{4}-\d{2}-\d{2}/.exec(raw.trim())?.[0] ?? unescapeXml(raw);
    default: {
      if (!raw.trim()) return '';
      const style = Number(attr(tag, 's') ?? 0);
      if (ctx.styles.dateStyles.has(style)) {
        const iso = serialToIsoDate(Number(raw), ctx.date1904);
        if (iso) return iso;
      }
      return formatNumber(raw);
    }
  }
}

/** Lignes non vides d'une feuille ; la lecture s'arrête juste après la limite d'import. */
export function readSheetRows(xml: string, ctx: SheetContext): Table {
  const data = /<(?:[\w.-]+:)?sheetData\b[^>]*>([\s\S]*?)<\/(?:[\w.-]+:)?sheetData>/.exec(xml);
  if (!data) return [];
  const rows: { index: number; cells: string[] }[] = [];
  let rowIndex = 0;
  for (const row of elements(data[1], 'row')) {
    const r = Number(attr(row.tag, 'r'));
    rowIndex = Number.isFinite(r) && r > 0 ? r : rowIndex + 1;
    const cells: string[] = [];
    let col = -1;
    for (const c of elements(row.body, 'c')) {
      const ref = attr(c.tag, 'r');
      const fromRef = ref ? columnIndex(ref) : null;
      col = fromRef ?? col + 1;
      if (col > MAX_COLUMN_INDEX) continue;
      const value = cellValue(c.tag, c.body, ctx);
      if (value === '') continue;
      while (cells.length < col) cells.push('');
      cells[col] = value;
    }
    if (cells.some(v => v.trim() !== '')) {
      rows.push({ index: rowIndex, cells });
      if (rows.length > MAX_ROWS + 1) break;
    }
  }
  return rows.sort((a, b) => a.index - b.index).map(r => r.cells);
}

/** Chemin d'une cible de relation, relatif au dossier de la partie qui la cite. */
function resolvePath(base: string, target: string): string {
  if (target.startsWith('/')) return target.slice(1);
  const parts = base.split('/').slice(0, -1);
  for (const seg of target.split('/')) {
    if (seg === '..') parts.pop();
    else if (seg && seg !== '.') parts.push(seg);
  }
  return parts.join('/');
}

function relsPath(part: string): string {
  const i = part.lastIndexOf('/');
  return `${part.slice(0, i + 1)}_rels/${part.slice(i + 1)}.rels`;
}

function relationships(xml: string | null): Map<string, { target: string; type: string }> {
  const map = new Map<string, { target: string; type: string }>();
  if (!xml) return map;
  for (const rel of elements(xml, 'Relationship')) {
    const id = attr(rel.tag, 'Id');
    const target = attr(rel.tag, 'Target');
    if (id && target) map.set(id, { target, type: attr(rel.tag, 'Type') ?? '' });
  }
  return map;
}

const isOleFile = (b: Uint8Array) => b[0] === 0xd0 && b[1] === 0xcf && b[2] === 0x11 && b[3] === 0xe0;
const isZipFile = (b: Uint8Array) => b[0] === 0x50 && b[1] === 0x4b;

/** Lecture d'un classeur : toutes les feuilles visibles qui contiennent des données. */
export async function readXlsx(data: ArrayBuffer | Uint8Array): Promise<XlsxResult> {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  if (bytes.length > MAX_XLSX_BYTES) return { ok: false, message: XLSX_TOO_BIG_MESSAGE };
  if (isOleFile(bytes)) return { ok: false, message: XLSX_OLD_FORMAT_MESSAGE };
  if (!isZipFile(bytes)) return { ok: false, message: XLSX_UNREADABLE_MESSAGE };

  let zip: JSZip;
  try { zip = await JSZip.loadAsync(bytes); } catch { return { ok: false, message: XLSX_UNREADABLE_MESSAGE }; }

  let tooBig = false;
  const read = async (path: string): Promise<string | null> => {
    const file = zip.file(path) ?? Object.values(zip.files).find(f => f.name.toLowerCase() === path.toLowerCase()) ?? null;
    if (!file || file.dir) return null;
    // Taille annoncée par l'archive (propriété interne de jszip, absente selon les versions).
    const size = (file as unknown as { _data?: { uncompressedSize?: number } })._data?.uncompressedSize;
    if (typeof size === 'number' && size > MAX_PART_BYTES) { tooBig = true; return null; }
    const text = await file.async('string');
    if (text.length > MAX_PART_BYTES) { tooBig = true; return null; }
    return text;
  };

  try {
    const rootRels = relationships(await read('_rels/.rels'));
    const office = [...rootRels.values()].find(r => /\/officeDocument$/.test(r.type));
    const workbookPath = office ? resolvePath('', office.target) : 'xl/workbook.xml';
    const workbook = await read(workbookPath);
    if (!workbook) return { ok: false, message: tooBig ? XLSX_TOO_BIG_MESSAGE : XLSX_UNREADABLE_MESSAGE };

    const wbRels = relationships(await read(relsPath(workbookPath)));
    const partOf = (type: RegExp, fallback: string) => {
      const rel = [...wbRels.values()].find(r => type.test(r.type));
      return rel ? resolvePath(workbookPath, rel.target) : resolvePath(workbookPath, fallback);
    };
    const shared = readSharedStrings(await read(partOf(/\/sharedStrings$/, 'sharedStrings.xml')));
    const styles = readStyles(await read(partOf(/\/styles$/, 'styles.xml')));
    const pr = /<(?:[\w.-]+:)?workbookPr\b([^>]*)>/.exec(workbook);
    const date1904 = pr ? /^(1|true)$/i.test(attr(pr[1], 'date1904') ?? '') : false;
    const ctx: SheetContext = { shared, styles, date1904 };

    const sheets: XlsxSheet[] = [];
    let k = 0;
    for (const s of elements(workbook, 'sheet')) {
      k++;
      if (/hidden/i.test(attr(s.tag, 'state') ?? '')) continue;
      const id = attr(s.tag, 'id');
      const rel = id ? wbRels.get(id) : undefined;
      const path = rel ? resolvePath(workbookPath, rel.target) : resolvePath(workbookPath, `worksheets/sheet${k}.xml`);
      const xml = await read(path);
      if (!xml) continue;
      const rows = readSheetRows(xml, ctx);
      if (rows.length > 0) sheets.push({ name: attr(s.tag, 'name') ?? `Feuille ${k}`, rows });
    }
    if (tooBig && sheets.length === 0) return { ok: false, message: XLSX_TOO_BIG_MESSAGE };
    if (sheets.length === 0) return { ok: false, message: XLSX_EMPTY_MESSAGE };
    return { ok: true, sheets };
  } catch {
    return { ok: false, message: XLSX_UNREADABLE_MESSAGE };
  }
}

/** Genre d'un fichier choisi pour l'import du suivi, d'après son nom. */
export function trackerFileKind(name: string): 'xlsx' | 'ods' | 'xls' | 'text' {
  const ext = name.toLowerCase().split('.').pop() ?? '';
  if (ext === 'xlsx' || ext === 'xlsm') return 'xlsx';
  if (ext === 'ods') return 'ods';
  if (ext === 'xls') return 'xls';
  return 'text';
}
