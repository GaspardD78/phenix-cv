import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { readPastedTable, type Table } from './table';
import { describeColumns } from './fields';
import { buildImportPlan } from './plan';
import {
  MISSING_REQUIRED_MESSAGE, initialMapping, initialStatusMap, mappedRows, missingRequired, setColumnField, statusValues, suggestedDateOrder,
} from './manual';

const read = (name: string): Table => {
  const r = readPastedTable({ text: readFileSync(join(import.meta.dir, '..', '..', '..', 'tests', 'fixtures', 'tracker', name), 'utf8') });
  if (!r.ok) throw new Error(r.message);
  return r.rows;
};

describe('correspondance des colonnes', () => {
  const rows = read('suivi-excel-fr.tsv');
  const mapping = initialMapping(describeColumns(rows, true));

  it('propositions de départ d\'après les titres', () => {
    expect(mapping).toEqual({
      0: 'companyName', 1: 'jobTitle', 2: 'status', 3: 'appliedAt', 4: 'jobUrl', 5: 'contactName', 6: 'contactEmail', 7: 'contactPhone', 8: 'notes',
    });
    expect(missingRequired(mapping)).toEqual([]);
  });

  it('un champ ne va qu\'à une colonne : l\'ancienne est libérée', () => {
    const m = setColumnField(mapping, 8, 'jobTitle');
    expect(m[8]).toBe('jobTitle');
    expect(m[1]).toBeNull();
    expect(missingRequired(setColumnField(m, 0, null))).toEqual(['companyName']);
  });

  it('colonnes obligatoires manquantes : message clair', () => {
    expect(MISSING_REQUIRED_MESSAGE(['Entreprise'])).toBe('Indiquez quelle colonne contient « Entreprise » : sans elle, une candidature ne peut pas être créée.');
    expect(MISSING_REQUIRED_MESSAGE(['Entreprise', 'Poste'])).toBe('Indiquez quelles colonnes contiennent « Entreprise » et « Poste » : sans elles, une candidature ne peut pas être créée.');
  });

  it('lignes rangées par champ, numéros de ligne du tableau', () => {
    const r = mappedRows(rows, true, setColumnField(mapping, 6, null));
    expect(r).toHaveLength(5);
    expect(r[0]).toEqual({ line: 2, values: {
      companyName: 'Laiterie du Val', jobTitle: 'Assistante ADV', status: 'Envoyé', appliedAt: '12/03/2026',
      jobUrl: 'https://emplois.example/laiterie-du-val/adv', contactName: 'Julie Exemple', contactPhone: '06 00 00 00 01',
      notes: 'Relancer fin mars\nPoste en CDI',
    } });
    const noHeader = read('suivi-sans-titres.tsv');
    expect(mappedRows(noHeader, false, { 0: 'companyName', 1: 'jobTitle' })[0]).toEqual({ line: 1, values: { companyName: 'Laiterie du Val', jobTitle: 'Assistante ADV' } });
  });
});

describe('correspondance des statuts', () => {
  const rows: Table = [['Société', 'Poste', 'Etat'], ['A', 'P', 'Envoyé'], ['B', 'P', 'envoye'], ['C', 'P', 'En réflexion'], ['D', 'P', ''], ['E', 'P', 'KO']];
  const mapping = initialMapping(describeColumns(rows, true));
  const values = statusValues(rows, true, mapping);

  it('valeurs distinctes (sans accents ni majuscules), les plus fréquentes d\'abord, avec une proposition', () => {
    expect(values.map(v => [v.value, v.count, v.suggested])).toEqual([['Envoyé', 2, 'applied'], ['En réflexion', 1, null], ['KO', 1, 'rejected']]);
  });

  it('inconnu : « Brouillon » par défaut ; le choix de la personne est appliqué au plan', () => {
    const map = initialStatusMap(values);
    expect(map).toEqual({ envoye: 'applied', 'en reflexion': 'draft', ko: 'rejected' });
    const plan = buildImportPlan(mappedRows(rows, true, mapping), [], { statusMap: { ...map, 'en reflexion': 'interview' } });
    expect(plan.items.map(i => i.row?.status)).toEqual(['applied', 'applied', 'interview', 'draft', 'rejected']);
    expect(plan.items.flatMap(i => i.alerts)).toEqual([]);
  });

  it('sans colonne de statut : rien à associer', () => {
    expect(statusValues(rows, true, { 0: 'companyName', 1: 'jobTitle' })).toEqual([]);
  });
});

describe('format des dates', () => {
  it('français par défaut ; américain si la colonne le montre ; sans colonne de date, pas de choix', () => {
    const fr = read('suivi-excel-fr.tsv');
    expect(suggestedDateOrder(fr, true, initialMapping(describeColumns(fr, true)))).toEqual({ order: 'dmy', ambiguous: false, hasDates: true });
    const us: Table = [['Company', 'Job title', 'Applied on'], ['A', 'P', '02/25/2026']];
    expect(suggestedDateOrder(us, true, initialMapping(describeColumns(us, true))).order).toBe('mdy');
    expect(suggestedDateOrder(us, true, { 0: 'companyName', 1: 'jobTitle' }).hasDates).toBe(false);
  });

  it('format choisi appliqué à toutes les dates', () => {
    const rows: Table = [['Société', 'Poste', 'Date'], ['A', 'P', '03/04/2026']];
    const m = initialMapping(describeColumns(rows, true));
    expect(buildImportPlan(mappedRows(rows, true, m), [], { dateOrder: 'dmy' }).items[0].row!.applied_at).toBe('2026-04-03');
    expect(buildImportPlan(mappedRows(rows, true, m), [], { dateOrder: 'mdy' }).items[0].row!.applied_at).toBe('2026-03-04');
  });
});
