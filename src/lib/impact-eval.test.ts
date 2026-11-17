import { describe, expect, it } from 'bun:test';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { CRITERIA, baselinePrompt, blindAssignments, gridMarkdown, guardSummary, loadCase, seeded, stageFiles, tally, type EvalCase } from './impact-eval';

const DIR = join(import.meta.dir, '..', '..', 'tests', 'fixtures', 'impact');
const cases = readdirSync(DIR).filter(f => f.endsWith('.json')).sort().map(f => loadCase(JSON.parse(readFileSync(join(DIR, f), 'utf8')) as EvalCase));
const BRIEF = readFileSync(join(import.meta.dir, '..', '..', 'tests', 'fixtures', 'brief', 'fiche-adv.json'), 'utf8');

describe('évaluation : les cinq profils fictifs', () => {
  it('cinq situations, une étiquette chacune, toutes sous le nom Camille Martin', () => {
    expect(cases.map(c => c.label)).toEqual(['1-ADV', '2-Compta', '3-Dev', '4-Reconversion', '5-Junior']);
    for (const c of cases) {
      expect(`${c.profile.firstName} ${c.profile.lastName}`).toBe('Camille Martin');
      expect(c.entries.length).toBeGreaterThanOrEqual(5);
      expect(c.role).not.toBe('');
    }
    expect(cases[0].offerText).toContain('Assistante ADV');
    expect(cases[1].offerText).toBe('');
    expect(cases[2].company).toContain('à choisir');
  });

  it('chaque profil donne un texte de rédaction habituel (avec offre ou CV standard)', () => {
    for (const c of cases) {
      const p = baselinePrompt(c);
      expect(p).toContain('## Profil maître');
      expect(p).not.toContain('Fiche cible');
      expect(c.intent ? p.includes('Cible : ce que le candidat recherche') : p.includes('Annonce')).toBe(true);
    }
  });
});

describe('évaluation : étapes et réponses collées', () => {
  const adv = cases[0];

  it('au départ : texte de recherche (sans donnée personnelle) et texte habituel', () => {
    const { files, next } = stageFiles(adv, {});
    expect(files.map(f => f.name)).toEqual(['1-recherche.txt', '2-cv-sans-recherche.txt']);
    for (const secret of ['Camille', 'Martin', 'camille.martin@example.org', '06 00 00 00 00', '69003']) expect(files[0].content).not.toContain(secret);
    expect(next).toContain('NOUVELLE conversation');
  });

  it('fiche collée : texte d\'analyse ; fiche inexploitable : message clair', () => {
    const ok = stageFiles(adv, { brief: BRIEF });
    expect(ok.files.map(f => f.name)).toContain('3-analyse.txt');
    expect(ok.files.find(f => f.name === '3-analyse.txt')!.content).toContain('## Fiche cible');
    const ko = stageFiles(adv, { brief: '{"recherche":{"effectuee":false,"raison":"pas d\'internet"}}' });
    expect(ko.files.map(f => f.name)).not.toContain('3-analyse.txt');
    expect(ko.next).toContain('Recherche web indisponible');
    expect(stageFiles(adv, { brief: 'bonjour' }).next).toContain('ne ressemble pas à une fiche');
  });

  it('analyse collée : questions éventuelles, puis texte de rédaction avec la fiche', () => {
    const analyse = JSON.stringify({
      alignes: [{ attente: 'Gestion des commandes clients', entryId: 'e1' }],
      ecartsReels: [{ attente: 'ERP', traitement: 'question', question: 'Avez-vous utilisé un ERP ?' }],
    });
    const r = stageFiles(adv, { brief: BRIEF, analyse });
    expect(r.files.map(f => f.name)).toEqual(['1-recherche.txt', '2-cv-sans-recherche.txt', '3-analyse.txt', 'questions.md', '4-cv-avec-recherche.txt']);
    expect(r.files[r.files.length - 1].content).toContain('"schemaVersion": 3');
  });

  it('contrôle des deux CV avec le garde-fou de l\'application : inventions comptées', () => {
    const honest = JSON.stringify({ schemaVersion: 2, title: 'Assistante commerciale - ADV', summary: 'Assistante commerciale, huit ans de suivi des commandes.', entries: [{ id: 'e1', visible: true, description: '- Suivre les commandes de 45 clients' }], suggestedEntries: [] });
    const inventive = JSON.stringify({ schemaVersion: 2, title: 'Assistante commerciale - ADV', summary: 'Experte SAP, 120 clients grands comptes.', entries: [{ id: 'e1', visible: true, description: '- Suivre les commandes de 300 clients' }], suggestedEntries: [] });
    expect(guardSummary(adv, honest).inventions).toEqual([]);
    expect(guardSummary(adv, inventive).inventions.length).toBeGreaterThan(0);
    expect(guardSummary(adv, 'pas du json').ok).toBe(false);
    const r = stageFiles(adv, { brief: BRIEF, cvSans: honest, cvAvec: inventive });
    const control = r.files.find(f => f.name === 'controle.md')!.content;
    expect(control).toContain('Sans recherche : 0 point(s) bloquant(s)');
    expect(control).toMatch(/Avec recherche : .*invention/);
    expect(r.next).toContain('grille.md');
  });
});

describe('évaluation : grille à l\'aveugle', () => {
  const labels = cases.map(c => c.label);

  it('tirage reproductible, équilibré : « avec » est autant en X qu\'en Y (à un près)', () => {
    const a = blindAssignments(labels, 1);
    expect(blindAssignments(labels, 1)).toEqual(a);
    const avecEnX = a.filter(x => x.X === 'avec').length;
    expect([2, 3]).toContain(avecEnX);
    for (const x of a) expect(new Set([x.X, x.Y]).size).toBe(2);
    expect(blindAssignments(labels, 2)).not.toEqual(a);
    expect(seeded(5)()).toBe(seeded(5)());
  });

  it('la grille ne révèle pas quel CV est « avec recherche »', () => {
    const grid = gridMarkdown(cases);
    for (const k of CRITERIA) expect(grid).toContain(k);
    expect(grid).toContain('| Critère | X | Y |');
    expect(grid).not.toMatch(/avec recherche|sans recherche/i);
    expect(grid.match(/^## /gm)).toHaveLength(5);
  });

  it('décompte : « avec » doit gagner sur au moins 4 profils sur 5', () => {
    const a = blindAssignments(labels, 1);
    const five = new Array(CRITERIA.length).fill(5);
    const three = new Array(CRITERIA.length).fill(3);
    const scores = a.map(x => ({ label: x.label, X: x.X === 'avec' ? five : three, Y: x.Y === 'avec' ? five : three }));
    const result = tally(a, scores);
    expect(result.every(r => r.winner === 'avec' && r.avec === 30 && r.sans === 18)).toBe(true);
    expect(tally(a, [{ label: a[0].label, X: three, Y: three }])[0].winner).toBe('égalité');
    expect(tally(a, [{ label: a[0].label, X: [1], Y: [1] }])).toEqual([]);
  });
});
