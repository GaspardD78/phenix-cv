import { describe, expect, it } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import JSZip from 'jszip';
import { PrintableCV } from '../components/export/PrintableCV';
import { generateDocxBlob } from './export-docx';
import { guardAiCv, type GuardContext } from './ai-cv-guard';
import { parseAiCvResponse, type AiCvResponse } from './ai-cv-response';
import { applyAiCvToBlocks, convertSkillLineToSkills, placeAfter } from './apply-ai-cv';
import {
  AI_SKILL_LIMITS, buildBadgeRows, isAiSkillBlock, isSkillLineBlock, skillNameTooLong, splitSkillLine,
} from './skill-lines';
import { buildCvPrompt } from './cv-prompt';
import { TEST_PROFILE, makeEntry, makeFakeStore } from './test-helpers/cv-fixtures';
import { makeCategoryBlocks, makeCategoryEntries } from './test-helpers/skill-fixtures';
import { getAllTemplates } from '../templates';
import type { CVBlock, CVDocument } from '../types/cv';

// Données fictives (Camille Martin, assistante commerciale).
const NOW = new Date(Date.UTC(2026, 5, 15));
const experiences = [
  makeEntry('e1', 'experience', 'Assistante commerciale', {
    subtitle: 'Organisation A', startDate: '2018-01', endDate: '2022-01',
    description: '- Rédiger les devis avec les commerciaux\n- Suivre les commandes des clients\n- Utiliser un CRM pour le suivi des relances',
  }),
  makeEntry('e2', 'experience', 'Assistante de direction', {
    subtitle: 'Organisation B', startDate: '2015-01', endDate: '2017-12',
    description: '- Organiser des sessions de formation pour 40 salariés',
  }),
];
const entries = [...experiences, ...makeCategoryEntries()];

function makeBlocksWithExperiences(): CVBlock[] {
  const exp = (id: string, entryId: string, order: number): CVBlock => ({
    id, cvId: 'cv1', entryId, blockType: 'entry_ref', sectionName: null, customContent: null, sortOrder: order, isVisible: true, overrideData: {}, createdAt: '',
  });
  const skills = makeCategoryBlocks().map(b => ({ ...b, sortOrder: b.sortOrder + 10 }));
  return [
    { id: 'he', cvId: 'cv1', entryId: null, blockType: 'section_header', sectionName: 'Expériences Professionnelles', customContent: null, sortOrder: 0, isVisible: true, overrideData: {}, createdAt: '' },
    exp('b-e1', 'e1', 1), exp('b-e2', 'e2', 2),
    ...skills,
  ];
}

const SKILLS = [
  { name: 'Rédaction de devis', sources: ['e1'] },
  { name: 'Suivi des commandes', sources: ['e1'] },
  { name: 'Organisation de formations', sources: ['e2'] },
  { name: 'Excel avancé', sources: ['k1'] },
];

const resp = (extra: Partial<AiCvResponse> = {}): AiCvResponse => ({ entries: [], suggestedEntries: [], ...extra });
const ctx = (extra: Partial<GuardContext> = {}): GuardContext => ({ entries, profile: TEST_PROFILE, now: NOW, ...extra });
const codes = (r: ReturnType<typeof guardAiCv>) => r.report.warnings.map(w => w.code);
const names = (r: ReturnType<typeof guardAiCv>) => r.data.cvSkills?.map(s => s.name);

// ── Logique pure ─────────────────────────────────────────────────────────────

describe('splitSkillLine : découpe d\'une ancienne ligne en étiquettes', () => {
  it('coupe sur les virgules, points-virgules, points médians, barres obliques et retours à la ligne', () => {
    expect(splitSkillLine('Devis, commandes ; relances · facturation / accueil\nplanning')).toEqual(
      ['Devis', 'commandes', 'relances', 'facturation', 'accueil', 'planning'],
    );
  });
  it('retire puces, points finaux, doublons et morceaux vides', () => {
    expect(splitSkillLine('- Devis, devis,, Relances.')).toEqual(['Devis', 'Relances']);
  });
  it('une phrase sans séparateur reste entière (le candidat la raccourcit avant de valider)', () => {
    expect(splitSkillLine('Suivi de la relation client et traitement des commandes')).toEqual(['Suivi de la relation client et traitement des commandes']);
  });
});

describe('skillNameTooLong', () => {
  it(`au plus ${AI_SKILL_LIMITS.maxChars} caractères et ${AI_SKILL_LIMITS.maxWords} mots`, () => {
    expect(skillNameTooLong('Relation client')).toBe(false);
    expect(skillNameTooLong('Suivi de la relation client et traitement des commandes')).toBe(true);
    expect(skillNameTooLong('a b c d e f')).toBe(true);
    expect(skillNameTooLong('x'.repeat(AI_SKILL_LIMITS.maxChars + 1))).toBe(true);
  });
});

describe('lecture de cvSkills', () => {
  it('lit name et sources, retire le marqueur de puce, ignore les éléments vides', () => {
    const r = parseAiCvResponse(JSON.stringify({ entries: [], cvSkills: [{ name: '- Rédaction de devis', sources: ['e1', 'e1', ' e2 '] }, { name: '' }, 'x', { name: 'Sans source' }] }));
    expect(r.cvSkills).toEqual([{ name: 'Rédaction de devis', sources: ['e1', 'e2'] }, { name: 'Sans source', sources: [] }]);
  });
  it('ancien champ cvSkillLines : chaque ligne est découpée en compétences, avec ses sources', () => {
    const r = parseAiCvResponse(JSON.stringify({ entries: [], cvSkillLines: [{ text: 'Devis, commandes', sources: ['e1'] }] }));
    expect(r.cvSkills).toEqual([{ name: 'Devis', sources: ['e1'] }, { name: 'commandes', sources: ['e1'] }]);
    expect((r as unknown as Record<string, unknown>).cvSkillLines).toBeUndefined();
  });
  it('champ absent : JSON v2 inchangé', () => {
    expect(parseAiCvResponse(JSON.stringify({ schemaVersion: 2, entries: [] })).cvSkills).toBeUndefined();
  });
});

describe('garde-fou : compétences ajoutées par l\'IA', () => {
  it('retire les compétences sans source valide et avertit', () => {
    const r = guardAiCv(resp({ cvSkills: [...SKILLS, { name: 'Sans source', sources: [] }, { name: 'Source inconnue', sources: ['zzz'] }, { name: 'Source formation', sources: ['i1'] }] }), ctx());
    expect(names(r)).toEqual(SKILLS.map(s => s.name));
    expect(r.report.warnings.filter(w => w.code === 'cv-skill-no-source')).toHaveLength(3);
    expect(codes(r)).toContain('unknown-id');
  });

  it('retire les doublons, entre elles et avec les compétences isolées du profil', () => {
    const isolated = makeCategoryEntries().find(e => e.entryType === 'skill' && !e.description)!;
    const r = guardAiCv(resp({ cvSkills: [...SKILLS, { name: 'rédaction de devis', sources: ['e1'] }, { name: isolated.title, sources: ['e1'] }] }), ctx());
    expect(names(r)).toEqual(SKILLS.map(s => s.name));
    expect(r.report.warnings.find(w => w.code === 'cv-skill-duplicate')?.message).toContain(isolated.title);
  });

  it('une phrase n\'est pas une étiquette : retirée avec un avertissement', () => {
    const r = guardAiCv(resp({ cvSkills: [...SKILLS, { name: 'Suivi de la relation client et traitement des commandes', sources: ['e1'] }] }), ctx());
    expect(names(r)).toEqual(SKILLS.map(s => s.name));
    expect(codes(r)).toContain('cv-skill-too-long');
  });

  it(`au-delà de ${AI_SKILL_LIMITS.max} compétences : les premières sont gardées`, () => {
    const many = Array.from({ length: AI_SKILL_LIMITS.max + 2 }, (_, i) => ({ name: `Suivi ${String.fromCharCode(65 + i)}`, sources: ['e1'] }));
    const r = guardAiCv(resp({ cvSkills: many }), ctx());
    expect(r.data.cvSkills).toHaveLength(AI_SKILL_LIMITS.max);
    expect(codes(r)).toContain('cv-skills-too-many');
  });

  it('signale les termes techniques absents des sources citées', () => {
    const r = guardAiCv(resp({ cvSkills: [...SKILLS, { name: 'Pratique de Kubernetes', sources: ['e2'] }, { name: 'Suivi des relances CRM', sources: ['e2'] }] }), ctx());
    // CRM figure dans une autre expérience (e1), pas dans la source citée (e2) : signalé aussi.
    expect(r.report.warnings.find(x => x.code === 'cv-skill-unsourced' && x.message.includes('CRM'))?.message).toContain('crm');
    expect(r.report.warnings.find(x => x.code === 'cv-skill-unsourced')?.message).toContain('kubernetes');
  });

  it('un chiffre absent de tout le profil reste une erreur bloquante (anti-invention identique)', () => {
    const r = guardAiCv(resp({ cvSkills: [...SKILLS, { name: 'Suivi de 999 clients', sources: ['e1'] }] }), ctx());
    expect(r.report.errors.map(e => e.code)).toContain('invented-number');
  });

  it(`moins de ${AI_SKILL_LIMITS.min} compétences valides : avertissement, catégories conservées`, () => {
    expect(codes(guardAiCv(resp({ cvSkills: SKILLS.slice(0, 2) }), ctx()))).toContain('cv-skills-too-few');
    expect(codes(guardAiCv(resp({ cvSkills: SKILLS }), ctx()))).not.toContain('cv-skills-too-few');
  });

  it('sans cvSkills : aucun avertissement de compétences ajoutées', () => {
    const r = guardAiCv(resp(), ctx());
    expect(codes(r).filter(c => c.startsWith('cv-skill'))).toEqual([]);
    expect(r.data.cvSkills).toBeUndefined();
  });
});

// ── Application ──────────────────────────────────────────────────────────────

describe('application : étiquettes sous « Compétences »', () => {
  const catIds = ['b-k1', 'b-k2', 'b-k3', 'b-k4'];
  const visibleIds = (store: ReturnType<typeof makeFakeStore>) => store.sorted().filter(b => b.isVisible).map(b => b.id);

  it('crée une étiquette par compétence juste sous l\'en-tête, sans toucher au profil', async () => {
    const store = makeFakeStore(makeBlocksWithExperiences());
    const report = await applyAiCvToBlocks('cv1', resp({ cvSkills: SKILLS }), { store: () => store, entries });
    expect(report.cvSkills).toBe('applied');
    const sorted = store.sorted();
    const header = sorted.findIndex(b => b.id === 'hs');
    const tags = sorted.filter(isAiSkillBlock);
    expect(tags.map(t => t.customContent)).toEqual(SKILLS.map(s => s.name));
    expect(sorted.slice(header + 1, header + 1 + tags.length).map(b => b.id)).toEqual(tags.map(t => t.id));
    expect(tags.every(t => t.blockType === 'custom_text' && t.entryId === null && t.isVisible)).toBe(true);
    expect(tags[0].overrideData.sources).toEqual(['e1']);
    expect(entries.map(e => e.id)).toEqual(['e1', 'e2', 'k1', 'k2', 'k3', 'k4', 'k5', 'i1']);
  });

  it('masque les catégories du profil non listées en visible: true', async () => {
    const store = makeFakeStore(makeBlocksWithExperiences());
    await applyAiCvToBlocks('cv1', resp({ cvSkills: SKILLS, entries: [{ id: 'k2', visible: true }] }), { store: () => store, entries });
    const ids = visibleIds(store);
    expect(ids).toContain('b-k2');
    for (const hidden of ['b-k1', 'b-k3', 'b-k4']) expect(ids).not.toContain(hidden);
    expect(ids).toContain('b-k5');
    expect(store.currentCvBlocks.find(b => b.id === 'b-k1')?.overrideData.hiddenBySkillLines).toBe(true);
  });

  it('moins de 3 compétences : rien n\'est ajouté, aucune catégorie masquée', async () => {
    const store = makeFakeStore(makeBlocksWithExperiences());
    const report = await applyAiCvToBlocks('cv1', resp({ cvSkills: SKILLS.slice(0, 2) }), { store: () => store, entries });
    expect(report.cvSkills).toBe('skipped');
    expect(report.warnings.join('\n')).toContain('Compétences ajoutées par l\'IA ignorées');
    expect(store.sorted().filter(isAiSkillBlock)).toEqual([]);
    for (const id of catIds) expect(visibleIds(store)).toContain(id);
  });

  it('idempotent : réappliquer le même JSON donne le même CV', async () => {
    const store = makeFakeStore(makeBlocksWithExperiences());
    const data = resp({ cvSkills: SKILLS, entries: [{ id: 'k2', visible: true }] });
    await applyAiCvToBlocks('cv1', data, { store: () => store, entries });
    const snapshot = () => store.sorted().map(b => [b.id, b.isVisible, b.customContent, JSON.stringify(b.overrideData)]);
    const first = snapshot();
    await applyAiCvToBlocks('cv1', data, { store: () => store, entries });
    expect(snapshot()).toEqual(first);
  });

  it('les anciennes lignes de texte sont remplacées par les étiquettes', async () => {
    const legacy: CVBlock = {
      id: 'old-line', cvId: 'cv1', entryId: null, blockType: 'custom_text', sectionName: null, customContent: 'Ancienne ligne de compétences',
      sortOrder: 10.5, isVisible: true, overrideData: { aiSkillLine: true, sources: ['e1'] }, createdAt: '',
    };
    const store = makeFakeStore([...makeBlocksWithExperiences(), legacy]);
    await applyAiCvToBlocks('cv1', resp({ cvSkills: SKILLS }), { store: () => store, entries });
    expect(store.currentCvBlocks.filter(isSkillLineBlock)).toEqual([]);
    expect(store.currentCvBlocks.filter(isAiSkillBlock)).toHaveLength(SKILLS.length);
  });

  it('une application sans compétences défait la précédente : étiquettes retirées, catégories rétablies', async () => {
    const store = makeFakeStore(makeBlocksWithExperiences());
    await applyAiCvToBlocks('cv1', resp({ cvSkills: SKILLS }), { store: () => store, entries });
    const report = await applyAiCvToBlocks('cv1', resp(), { store: () => store, entries });
    expect(report.cvSkills).toBe('none');
    expect(store.sorted().filter(isAiSkillBlock)).toEqual([]);
    for (const id of catIds) expect(visibleIds(store)).toContain(id);
    expect(store.currentCvBlocks.some(b => b.overrideData.hiddenBySkillLines)).toBe(false);
  });

  it('sans section Compétences : ignoré avec un avertissement', async () => {
    const blocks = makeBlocksWithExperiences().filter(b => !['hs', 'b-k1', 'b-k2', 'b-k3', 'b-k4', 'b-k5'].includes(b.id));
    const store = makeFakeStore(blocks);
    const report = await applyAiCvToBlocks('cv1', resp({ cvSkills: SKILLS }), { store: () => store, entries });
    expect(report.cvSkills).toBe('skipped');
    expect(report.warnings.join('\n')).toContain('section « Compétences » introuvable');
  });

  it('placeAfter : déplace sans perdre ni dupliquer', () => {
    expect(placeAfter(['a', 'h', 'b', 'x', 'y'], 'h', ['x', 'y'])).toEqual(['a', 'h', 'x', 'y', 'b']);
    expect(placeAfter(['a', 'b'], 'zzz', ['b'])).toEqual(['a', 'b']);
  });
});

describe('« Convertir en étiquettes » : ancienne ligne de texte', () => {
  const legacy = (visible = true): CVBlock => ({
    id: 'old-line', cvId: 'cv1', entryId: null, blockType: 'custom_text', sectionName: null, customContent: 'Devis, commandes',
    sortOrder: 10.5, isVisible: visible, overrideData: { aiSkillLine: true, sources: ['e1'] }, createdAt: '',
  });

  it('remplace la ligne par les étiquettes validées, à la même place, avec les mêmes sources', async () => {
    const store = makeFakeStore([...makeBlocksWithExperiences(), legacy()]);
    const before = store.sorted().map(b => b.id);
    const at = before.indexOf('old-line');
    const created = await convertSkillLineToSkills('cv1', 'old-line', ['Rédaction de devis', ' ', 'Suivi des commandes', 'rédaction de devis'], { store: () => store });
    expect(created).toBe(2);
    const sorted = store.sorted();
    expect(sorted.some(b => b.id === 'old-line')).toBe(false);
    const tags = sorted.slice(at, at + 2);
    expect(tags.map(b => b.customContent)).toEqual(['Rédaction de devis', 'Suivi des commandes']);
    expect(tags.every(b => isAiSkillBlock(b) && b.isVisible && JSON.stringify(b.overrideData.sources) === '["e1"]')).toBe(true);
    // Le reste de l'ordre est inchangé.
    expect(sorted.filter(b => !isAiSkillBlock(b)).map(b => b.id)).toEqual(before.filter(id => id !== 'old-line'));
  });

  it('une ligne masquée donne des étiquettes masquées', async () => {
    const store = makeFakeStore([...makeBlocksWithExperiences(), legacy(false)]);
    await convertSkillLineToSkills('cv1', 'old-line', ['Devis'], { store: () => store });
    expect(store.currentCvBlocks.filter(isAiSkillBlock).map(b => b.isVisible)).toEqual([false]);
  });

  it('aucune étiquette valide, ou bloc qui n\'est pas une ligne : rien ne change', async () => {
    const store = makeFakeStore([...makeBlocksWithExperiences(), legacy()]);
    const snapshot = JSON.stringify(store.sorted());
    expect(await convertSkillLineToSkills('cv1', 'old-line', ['  '], { store: () => store })).toBe(0);
    expect(await convertSkillLineToSkills('cv1', 'b-e1', ['Devis'], { store: () => store })).toBe(0);
    expect(JSON.stringify(store.sorted())).toBe(snapshot);
  });
});

// ── Rendu ────────────────────────────────────────────────────────────────────

describe('rendu : les compétences de l\'IA sont des étiquettes comme les autres', () => {
  const cv: CVDocument = {
    id: 'cv1', profileId: 'p1', name: 'T', templateId: 'ats-classic', targetJob: null, targetCompany: null, customSummary: null,
    settings: {}, isFavorite: false, lastExported: null, markdownContent: null, markdownMode: 0, createdAt: '', updatedAt: '',
  };
  const tagBlock = (i: number, name: string): CVBlock => ({
    id: `tag-${i}`, cvId: 'cv1', entryId: null, blockType: 'custom_text', sectionName: null, customContent: name,
    sortOrder: 10.5 + i / 100, isVisible: true, overrideData: { aiSkill: true, sources: ['e1'] }, createdAt: '',
  });
  const blocks = [
    ...makeBlocksWithExperiences().map(b => (b.id === 'b-k1' || b.id === 'b-k3' || b.id === 'b-k4' ? { ...b, isVisible: false } : b)),
    ...SKILLS.map((s, i) => tagBlock(i, s.name)),
  ];
  const isolated = makeCategoryEntries().find(e => e.entryType === 'skill' && !e.description)!;

  it('buildBadgeRows : les compétences de l\'IA rejoignent les compétences isolées du profil, sur la même ligne', () => {
    const rows = buildBadgeRows(blocks.filter(b => isAiSkillBlock(b) || b.id === 'b-k2' || b.id === 'b-k5').sort((a, b) => a.sortOrder - b.sortOrder), entries);
    expect(rows.some(r => r.plain)).toBe(false);
    const loose = rows.find(r => r.category === null);
    expect(loose?.items.map(i => i.name)).toEqual([...SKILLS.map(s => s.name), isolated.title]);
    expect(rows.filter(r => r.category !== null).map(r => r.category)).toEqual(['Outils de vente']);
  });

  for (const t of getAllTemplates()) {
    it(`${t.id} : même balisage qu'une compétence isolée du profil`, () => {
      const html = renderToStaticMarkup(<PrintableCV cv={{ ...cv, templateId: t.id }} profile={TEST_PROFILE} blocks={blocks} entries={entries} template={t} />);
      expect(html).not.toContain('cv-skill-line"');
      // L'étiquette de l'IA et celle du profil ont exactement la même balise englobante.
      const wrapper = (name: string) => new RegExp(`<([a-z]+)[^>]*>${name}</\\1>`).exec(html)?.[0].replace(name, '');
      expect(wrapper(SKILLS[0].name)).toBeDefined();
      expect(wrapper(SKILLS[0].name)).toBe(wrapper(isolated.title));
      expect(html).toContain('Outils de vente');
      expect(html).not.toContain('Langages');
    });
  }

  it('format « Tags » : une étiquette cv-badge par compétence', () => {
    const html = renderToStaticMarkup(<PrintableCV cv={cv} profile={TEST_PROFILE} blocks={blocks} entries={entries} template={getAllTemplates()[0]} />);
    for (const s of SKILLS) expect(html).toMatch(new RegExp(`class="cv-badge cv-badge-item[^"]*">${s.name}</span>`));
  });

  it('export DOCX : les compétences sont sur la même ligne que les compétences isolées du profil', async () => {
    const blob = await generateDocxBlob(cv, TEST_PROFILE, blocks, entries, getAllTemplates()[0]);
    const xml = await (await JSZip.loadAsync(await blob.arrayBuffer())).file('word/document.xml')!.async('string');
    expect(xml).toContain([...SKILLS.map(s => s.name), isolated.title].join(' · '));
  });

  it('ancienne ligne de texte : toujours affichée telle quelle (rien n\'est converti sans votre accord)', () => {
    const legacy: CVBlock = { ...tagBlock(9, 'Ancienne ligne de compétences'), overrideData: { aiSkillLine: true, sources: ['e1'] } };
    const html = renderToStaticMarkup(<PrintableCV cv={cv} profile={TEST_PROFILE} blocks={[...blocks, legacy]} entries={entries} template={getAllTemplates()[0]} />);
    expect(html).toMatch(/class="cv-desc cv-skill-line [^"]*">Ancienne ligne de compétences</);
  });
});

describe('prompt : documentation du schéma', () => {
  const prompt = buildCvPrompt({ profile: TEST_PROFILE, entries, jobOfferText: 'Assistante commerciale.', options: { now: NOW, pageBudget: 1 } });
  it('règle anti-invention et champ du schéma', () => {
    expect(prompt).toContain('COMPÉTENCES PROPRES À CE CV (optionnel, "cvSkills")');
    expect(prompt).toContain('cite dans "sources" au moins un ID d\'entrée existante (expérience ou compétence)');
    expect(prompt).toContain('aucun outil, technologie ou chiffre absent de ces sources');
    expect(prompt).toContain(`${AI_SKILL_LIMITS.maxChars} caractères`);
    expect(prompt).toContain('"cvSkills": [{ "name": "(optionnel) compétence courte, comme une étiquette", "sources": ["id_entree_1", "id_entree_2"] }]');
    expect(prompt).not.toContain('cvSkillLines');
  });
});
