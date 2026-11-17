import { describe, expect, it } from 'bun:test';
import JSZip from 'jszip';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  MAX_XLSX_BYTES, XLSX_EMPTY_MESSAGE, XLSX_OLD_FORMAT_MESSAGE, XLSX_TOO_BIG_MESSAGE, XLSX_UNREADABLE_MESSAGE,
  columnIndex, isDateFormat, readXlsx, serialToIsoDate, trackerFileKind,
} from './xlsx';
import { MAX_ROWS, TOO_MANY_ROWS_MESSAGE, readPastedTable } from './table';
import { describeColumns, detectHeaderRow } from './fields';
import { initialMapping, mappedRows } from './manual';
import { buildImportPlan } from './plan';

/** Classeur minimal, comme l'enregistre Excel (données fictives : Camille Martin). */
interface SheetSpec { name: string; xml: string; state?: 'hidden' | 'veryHidden' }
async function workbook(opts: {
  sheets: SheetSpec[];
  shared?: string[];
  styles?: string;
  date1904?: boolean;
  /** Préfixe d'espace de noms des éléments (`x:`), comme certains générateurs. */
  prefix?: string;
}): Promise<Uint8Array> {
  const p = opts.prefix ?? '';
  const zip = new JSZip();
  zip.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>');
  zip.file('_rels/.rels', '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>');
  const sheetTags = opts.sheets.map((s, k) => `<${p}sheet name="${s.name}" sheetId="${k + 1}"${s.state ? ` state="${s.state}"` : ''} r:id="rId${k + 1}"/>`).join('');
  zip.file('xl/workbook.xml', `<?xml version="1.0" encoding="UTF-8"?><${p}workbook xmlns${p ? ':' + p.slice(0, -1) : ''}="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><${p}workbookPr${opts.date1904 ? ' date1904="1"' : ''}/><${p}sheets>${sheetTags}</${p}sheets></${p}workbook>`);
  const rels = opts.sheets.map((_, k) => `<Relationship Id="rId${k + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${k + 1}.xml"/>`).join('')
    + '<Relationship Id="rIdS" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>'
    + '<Relationship Id="rIdT" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>';
  zip.file('xl/_rels/workbook.xml.rels', `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels}</Relationships>`);
  opts.sheets.forEach((s, k) => zip.file(`xl/worksheets/sheet${k + 1}.xml`, `<?xml version="1.0" encoding="UTF-8"?><${p}worksheet xmlns${p ? ':' + p.slice(0, -1) : ''}="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><${p}sheetData>${s.xml}</${p}sheetData></${p}worksheet>`));
  if (opts.shared) zip.file('xl/sharedStrings.xml', `<?xml version="1.0" encoding="UTF-8"?><${p}sst xmlns${p ? ':' + p.slice(0, -1) : ''}="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${opts.shared.join('')}</${p}sst>`);
  zip.file('xl/styles.xml', opts.styles ?? STYLES);
  return zip.generateAsync({ type: 'uint8array' });
}

/** Style 0 : général ; 1 : date intégrée (14) ; 2 : date personnalisée « jj/mm/aaaa » ; 3 : heure ; 4 : monétaire. */
const STYLES = `<?xml version="1.0" encoding="UTF-8"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="3"><numFmt numFmtId="164" formatCode="dd/mm/yyyy"/><numFmt numFmtId="165" formatCode="[$-F400]h:mm:ss\\ AM/PM"/><numFmt numFmtId="166" formatCode="#,##0\\ &quot;€&quot;"/></numFmts>
<cellXfs count="5"><xf numFmtId="0"/><xf numFmtId="14" applyNumberFormat="1"/><xf numFmtId="164" applyNumberFormat="1"/><xf numFmtId="165"/><xf numFmtId="166"/></cellXfs></styleSheet>`;

const si = (t: string) => `<si><t xml:space="preserve">${t}</t></si>`;

async function sheets(...args: Parameters<typeof workbook>) {
  const r = await readXlsx(await workbook(...args));
  if (!r.ok) throw new Error(r.message);
  return r.sheets;
}

describe('lecture d\'un classeur Excel (.xlsx)', () => {
  const shared = [
    si('Entreprise'), si('Poste'), si('Statut'), si('Date d\'envoi'), si('Salaire'), si('Remarques'),
    si('Atelier Dupré'), si('Assistante commerciale'), si('Entretien'),
    // Texte enrichi (gras sur une partie) et indication phonétique ignorée.
    '<si><r><rPr><b/></rPr><t>Relancer</t></r><r><t xml:space="preserve"> fin mars</t></r><rPh sb="0" eb="1"><t>ルビ</t></rPh></si>',
    si('Bureau &amp; Cie'), si('Envoyée'), si('Ligne 1_x000D_\nLigne 2'),
  ];
  const sheetXml = [
    '<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="C1" t="s"><v>2</v></c><c r="D1" t="s"><v>3</v></c><c r="E1" t="s"><v>4</v></c><c r="F1" t="s"><v>5</v></c></row>',
    '<row r="2"><c r="A2" t="s"><v>6</v></c><c r="B2" t="s"><v>7</v></c><c r="C2" t="s"><v>8</v></c><c r="D2" s="1"><v>46093</v></c><c r="E2" s="4"><v>32000</v></c><c r="F2" t="s"><v>9</v></c></row>',
    // Ligne 3 vide (mise en forme seule), puis cellules sans référence et formule.
    '<row r="3"><c r="A3" s="2"/></row>',
    '<row r="4"><c t="s"><v>10</v></c><c t="inlineStr"><is><t>Commerciale sédentaire</t></is></c><c t="s"><v>11</v></c><c s="2"><v>46100.75</v></c><c><f>30000+1500</f><v>31500</v></c><c t="s"><v>12</v></c></row>',
  ].join('');

  it('textes partagés, texte enrichi, texte en ligne, dates et nombres', async () => {
    const [sheet] = await sheets({ sheets: [{ name: 'Candidatures', xml: sheetXml }], shared });
    expect(sheet.name).toBe('Candidatures');
    expect(sheet.rows).toEqual([
      ['Entreprise', 'Poste', 'Statut', 'Date d\'envoi', 'Salaire', 'Remarques'],
      ['Atelier Dupré', 'Assistante commerciale', 'Entretien', '2026-03-12', '32000', 'Relancer fin mars'],
      ['Bureau & Cie', 'Commerciale sédentaire', 'Envoyée', '2026-03-19', '31500', 'Ligne 1\nLigne 2'],
    ]);
  });

  it('le classeur suit le même chemin qu\'un collage : colonnes proposées et aperçu', async () => {
    const [sheet] = await sheets({ sheets: [{ name: 'Candidatures', xml: sheetXml }], shared });
    const r = readPastedTable({ table: sheet.rows });
    expect(r.ok && r.from).toBe('classeur');
    if (!r.ok) return;
    const header = detectHeaderRow(r.rows);
    expect(header).toBe(true);
    const cols = describeColumns(r.rows, header);
    expect(cols.map(c => c.suggested)).toEqual(['companyName', 'jobTitle', 'status', 'appliedAt', 'salary', 'notes']);
    const plan = buildImportPlan(mappedRows(r.rows, header, initialMapping(cols)), []);
    expect(plan.items.map(i => i.error)).toEqual([null, null]);
    expect(plan.items[0].row).toMatchObject({ company_name: 'Atelier Dupré', applied_at: '2026-03-12', status: 'interview', salary_min: 32000 });
    expect(plan.items[1].row).toMatchObject({ company_name: 'Bureau & Cie', applied_at: '2026-03-19', notes: 'Ligne 1\nLigne 2' });
  });

  it('booléens, erreurs, dates en clair et colonnes au-delà de Z', async () => {
    const xml = '<row r="1"><c r="A1" t="b"><v>1</v></c><c r="B1" t="b"><v>0</v></c><c r="C1" t="e"><v>#N/A</v></c><c r="D1" t="d"><v>2026-04-02T00:00:00</v></c><c r="AA1" t="str"><v>Camille Martin</v></c></row>';
    const [sheet] = await sheets({ sheets: [{ name: 'Feuil1', xml }] });
    expect(sheet.rows[0][0]).toBe('VRAI');
    expect(sheet.rows[0][1]).toBe('FAUX');
    expect(sheet.rows[0][2]).toBe('');
    expect(sheet.rows[0][3]).toBe('2026-04-02');
    expect(sheet.rows[0][26]).toBe('Camille Martin');
  });

  it('nombre décimal à la française, sans artefact de calcul ; heure seule gardée en nombre', async () => {
    const xml = '<row r="1"><c r="A1"><v>0.30000000000000004</v></c><c r="B1" s="3"><v>0.5</v></c></row>';
    const [sheet] = await sheets({ sheets: [{ name: 'Feuil1', xml }] });
    expect(sheet.rows[0]).toEqual(['0,3', '0,5']);
  });

  it('calendrier 1904 (anciens classeurs Mac)', async () => {
    const xml = '<row r="1"><c r="A1" s="1"><v>44631</v></c></row>';
    const [sheet] = await sheets({ sheets: [{ name: 'Feuil1', xml }], date1904: true });
    expect(sheet.rows[0][0]).toBe('2026-03-12');
  });

  it('feuilles masquées et vides ignorées, plusieurs feuilles proposées dans l\'ordre', async () => {
    const one = (t: string) => `<row r="1"><c r="A1" t="inlineStr"><is><t>${t}</t></is></c></row>`;
    const list = await sheets({
      sheets: [
        { name: 'Notes', xml: '' },
        { name: '2025', xml: one('Ancien suivi') },
        { name: 'Secret', xml: one('Masquée'), state: 'hidden' },
        { name: '2026', xml: one('Suivi actuel') },
      ],
    });
    expect(list.map(s => s.name)).toEqual(['2025', '2026']);
  });

  it('éléments préfixés (x:c), comme certains générateurs de classeurs', async () => {
    const xml = '<x:row r="1"><x:c r="A1" t="s"><x:v>0</x:v></x:c><x:c r="B1" t="inlineStr"><x:is><x:t>Assistante commerciale</x:t></x:is></x:c></x:row>';
    const [sheet] = await sheets({ sheets: [{ name: 'Suivi', xml }], shared: ['<x:si><x:t>Atelier Dupré</x:t></x:si>'], prefix: 'x:' });
    expect(sheet.rows).toEqual([['Atelier Dupré', 'Assistante commerciale']]);
  });

  it('lignes dans le désordre : remises dans l\'ordre du classeur', async () => {
    const xml = '<row r="3"><c r="A3" t="inlineStr"><is><t>trois</t></is></c></row><row r="1"><c r="A1" t="inlineStr"><is><t>un</t></is></c></row>';
    const [sheet] = await sheets({ sheets: [{ name: 'Feuil1', xml }] });
    expect(sheet.rows).toEqual([['un'], ['trois']]);
  });

  it('au-delà de la limite d\'import : lecture arrêtée, import refusé avec le message habituel', async () => {
    const xml = Array.from({ length: MAX_ROWS + 50 }, (_, k) => `<row r="${k + 1}"><c r="A${k + 1}"><v>${k}</v></c></row>`).join('');
    const [sheet] = await sheets({ sheets: [{ name: 'Feuil1', xml }] });
    expect(sheet.rows.length).toBe(MAX_ROWS + 2);
    const r = readPastedTable({ table: sheet.rows });
    expect(r.ok ? '' : r.message).toBe(TOO_MANY_ROWS_MESSAGE);
  });
});

describe('fichiers refusés, avec une explication', () => {
  it('classeur vide', async () => {
    const r = await readXlsx(await workbook({ sheets: [{ name: 'Feuil1', xml: '' }] }));
    expect(r).toEqual({ ok: false, message: XLSX_EMPTY_MESSAGE });
  });

  it('ancien format .xls ou classeur protégé par un mot de passe', async () => {
    const ole = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0, 0]);
    expect(await readXlsx(ole)).toEqual({ ok: false, message: XLSX_OLD_FORMAT_MESSAGE });
  });

  it('fichier qui n\'est pas un classeur, archive sans classeur, archive abîmée', async () => {
    expect(await readXlsx(new TextEncoder().encode('Entreprise;Poste'))).toEqual({ ok: false, message: XLSX_UNREADABLE_MESSAGE });
    const zip = new JSZip();
    zip.file('notes.txt', 'Camille Martin');
    expect(await readXlsx(await zip.generateAsync({ type: 'uint8array' }))).toEqual({ ok: false, message: XLSX_UNREADABLE_MESSAGE });
    const broken = (await workbook({ sheets: [{ name: 'Feuil1', xml: '' }] })).slice(0, 60);
    expect(await readXlsx(broken)).toEqual({ ok: false, message: XLSX_UNREADABLE_MESSAGE });
  });

  it('fichier trop volumineux : refusé avant d\'être ouvert', async () => {
    const big = new Uint8Array(MAX_XLSX_BYTES + 1);
    big[0] = 0x50; big[1] = 0x4b;
    expect(await readXlsx(big)).toEqual({ ok: false, message: XLSX_TOO_BIG_MESSAGE });
  });
});

describe('outils', () => {
  it('référence de cellule → colonne', () => {
    expect(columnIndex('A1')).toBe(0);
    expect(columnIndex('Z9')).toBe(25);
    expect(columnIndex('AA10')).toBe(26);
    expect(columnIndex('$C$3')).toBe(2);
    expect(columnIndex('12')).toBeNull();
  });

  it('formats de date reconnus, formats de nombre et d\'heure écartés', () => {
    expect(isDateFormat(14, undefined)).toBe(true);
    expect(isDateFormat(164, 'dd/mm/yyyy')).toBe(true);
    expect(isDateFormat(165, 'jj/mm/aaaa')).toBe(true);
    expect(isDateFormat(166, 'mmm-yy')).toBe(true);
    expect(isDateFormat(167, '[$-fr-FR]d mmmm yyyy;@')).toBe(true);
    expect(isDateFormat(168, '#,##0\\ "€"')).toBe(false);
    expect(isDateFormat(169, '0.00%')).toBe(false);
    expect(isDateFormat(170, 'h:mm:ss')).toBe(false);
    expect(isDateFormat(171, '"Jour "0')).toBe(false);
    expect(isDateFormat(0, 'General')).toBe(false);
  });

  it('numéro de série → date', () => {
    expect(serialToIsoDate(46093, false)).toBe('2026-03-12');
    expect(serialToIsoDate(46093.99, false)).toBe('2026-03-12');
    expect(serialToIsoDate(0.5, false)).toBeNull();
  });

  it('genre de fichier d\'après son nom', () => {
    expect(trackerFileKind('Suivi candidatures.XLSX')).toBe('xlsx');
    expect(trackerFileKind('suivi.xlsm')).toBe('xlsx');
    expect(trackerFileKind('suivi.ods')).toBe('ods');
    expect(trackerFileKind('suivi.xls')).toBe('xls');
    expect(trackerFileKind('suivi.csv')).toBe('text');
  });
});

describe('classeurs réels (tests/fixtures/tracker, générés par openpyxl et LibreOffice)', () => {
  const dir = join(import.meta.dir, '..', '..', '..', 'tests', 'fixtures', 'tracker');
  for (const [writer, path] of [['openpyxl', 'suivi-camille.xlsx'], ['LibreOffice', 'libreoffice/suivi-camille.xlsx']] as const) {
    it(`${writer} : feuilles visibles, dates, nombres, formule et retour à la ligne`, async () => {
      const r = await readXlsx(readFileSync(join(dir, path)));
      if (!r.ok) throw new Error(r.message);
      expect(r.sheets.map(s => s.name)).toEqual(['Candidatures 2026', '2025']);
      const rows = readPastedTable({ table: r.sheets[0].rows });
      if (!rows.ok) throw new Error(rows.message);
      expect(rows.rows).toEqual([
        ['Entreprise', 'Poste', 'Statut', 'Date d\'envoi', 'Salaire brut annuel', 'Remarques'],
        ['Laiterie du Val', 'Assistante ADV', 'Postulé', '2026-03-12', '30000', 'Relancer fin mars\nPoste en CDI'],
        ['Atelier Dupré & fils', 'Assistante commerciale', 'Entretien', '2026-03-19', '', ''],
        // openpyxl n'enregistre pas le résultat d'une formule ; LibreOffice, si.
        ['Biscuiterie des Monts', 'Assistante administrative', 'Refusé', '2026-02-03', writer === 'LibreOffice' ? '30500' : '', 'Réponse par e-mail'],
      ]);
      expect(r.sheets[1].rows).toEqual([['Entreprise', 'Poste', 'Statut'], ['Coopérative du Lac', 'Commerciale sédentaire', 'Sans réponse']]);
    });
  }
});
