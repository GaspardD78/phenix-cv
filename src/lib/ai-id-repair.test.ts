import { describe, expect, it } from 'bun:test';
import { makeIdResolver, repairAiIds } from './ai-id-repair';
import { analyzeAiCvJson } from './ai-cv-pipeline';
import { makeEntries, makeEntry } from './test-helpers/cv-fixtures';

const A = '3f9a0c1b2d4e5f60718293a4b5c6d7e8';
const B = '3f9a0c1b99999999999999999999aaaa';
const C = 'c0ffee00112233445566778899aabbcc';

describe('makeIdResolver', () => {
  const resolve = makeIdResolver([A, B, C]);
  it('garde un identifiant exact', () => expect(resolve(C)).toBe(C));
  it('répare la casse, les espaces et les signes autour', () => {
    expect(resolve(` "${C.toUpperCase()}" `)).toBe(C);
    expect(resolve(`[${C}]`)).toBe(C);
  });
  it('rattache un début d\'identifiant sans ambiguïté', () => expect(resolve('c0ffee0011')).toBe(C));
  it('laisse un début ambigu ou trop court', () => {
    expect(resolve('3f9a0c1b')).toBe('3f9a0c1b');
    expect(resolve('c0ffee')).toBe('c0ffee');
  });
  it('laisse un identifiant inconnu', () => expect(resolve('deadbeefdeadbeef')).toBe('deadbeefdeadbeef'));
});

describe('repairAiIds', () => {
  it('répare entrées, ordre, groupes, fusions, compétences et correspondances', () => {
    const { data, repaired } = repairAiIds({
      entries: [{ id: C.toUpperCase(), visible: true }],
      suggestedEntries: [],
      entryOrder: [C.slice(0, 10)],
      skillGroups: [{ category: 'Outils', entryIds: [`"${C}"`] }],
      mergedEntries: [{ ids: [C.toUpperCase(), A] }],
      cvSkills: [{ name: 'Excel', sources: [C.slice(0, 12)] }],
      analyse: { indispensables: [], importants: [], correspondances: [{ exigence: 'x', entryId: C.toUpperCase() }, { exigence: 'y', entryId: null }], ecarts: [] },
    }, [A, B, C]);
    expect(data.entries[0].id).toBe(C);
    expect(data.entryOrder).toEqual([C]);
    expect(data.skillGroups?.[0].entryIds).toEqual([C]);
    expect(data.mergedEntries?.[0].ids).toEqual([C, A]);
    expect(data.cvSkills?.[0].sources).toEqual([C]);
    expect(data.analyse?.correspondances.map(m => m.entryId)).toEqual([C, null]);
    expect(repaired).toBe(6);
  });
});

describe('analyzeAiCvJson : identifiants recopiés de travers par l\'IA', () => {
  it('les entrées sont reconnues au lieu d\'être ignorées', () => {
    const entries = [...makeEntries(), makeEntry(C, 'experience', 'Vendeuse', { subtitle: 'Boutique', description: '- Conseiller les clients' })];
    const json = JSON.stringify({ entries: [{ id: C.toUpperCase().slice(0, 16), visible: false }, { id: ' x1 ', visible: true }] });
    const r = analyzeAiCvJson(json, { entries });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.entries.map(e => e.id)).toEqual([C, 'x1']);
    expect(r.report.warnings.map(w => w.code)).not.toContain('unknown-id');
  });
});
