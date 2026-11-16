import { describe, expect, it } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import JSZip from 'jszip';
import { PrintableCV } from '../components/export/PrintableCV';
import { analyzeAiCvJson } from './ai-cv-pipeline';
import { applyAiCvToBlocks } from './apply-ai-cv';
import { DEFAULT_TARGET_SHEETS, resolveTarget } from './cv-targets';
import { readTargetSnapshot } from './cv-target-snapshot';
import { generateDocxBlob } from './export-docx';
import { isAiSkillBlock } from './skill-lines';
import { makeFakeStore } from './test-helpers/cv-fixtures';
import {
  GENERALIST_ENTRIES, GENERALIST_NOW, GENERALIST_PROFILE, GENERALIST_SKILLS, GENERALIST_TITLE, generalistResponse, makeGeneralistBlocks,
} from './test-helpers/generalist-fixture';
import { getTemplate } from '../templates';
import type { CVDocument } from '../types/cv';

/**
 * Cas de bout en bout : un CV « assistante commerciale généraliste », ciblage public · annonce · rh, produit
 * entièrement par l'IA (en-tête, titre libre, 4 postes détaillés, 2 lignes fusionnées, 7 compétences en étiquettes,
 * formation sur 2 lignes, aucune autre section), sans retouche manuelle. Aucune donnée réelle.
 */

const TARGET = resolveTarget({ type: 'public', intent: 'annonce', firstReader: 'rh', titleRule: 'free' });
const CTX = {
  entries: GENERALIST_ENTRIES, profile: GENERALIST_PROFILE, now: GENERALIST_NOW, pageBudget: 2,
  focus: 'missions' as const, verbTense: 'infinitif' as const, target: TARGET,
};

const analyze = (response: Record<string, unknown> = generalistResponse()) => analyzeAiCvJson(JSON.stringify(response), CTX);

async function produce() {
  const analysis = analyze();
  if (!analysis.ok) throw new Error(analysis.error);
  const store = makeFakeStore(makeGeneralistBlocks());
  const report = await applyAiCvToBlocks('cv-gen', analysis.data, { store: () => store, entries: GENERALIST_ENTRIES, profile: GENERALIST_PROFILE, target: TARGET });
  const cv: CVDocument = {
    id: 'cv-gen', profileId: 'p-gen', name: 'CV généraliste', templateId: 'ats-classic', targetJob: analysis.data.title ?? null, targetCompany: null,
    customSummary: analysis.data.summary ?? null, settings: store.settings, isFavorite: false, lastExported: null, markdownContent: null, markdownMode: 0, createdAt: '', updatedAt: '',
  };
  return { analysis, store, report, cv };
}

const visibleText = (html: string): string => html.replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, "'").replace(/&amp;/g, '&').replace(/\s+/g, ' ');

describe('assistante commerciale généraliste : pipeline complet sans retouche manuelle', () => {
  it('l\'analyse ne produit aucune erreur bloquante ni avertissement parasite', () => {
    const analysis = analyze();
    expect(analysis.ok).toBe(true);
    if (!analysis.ok) return;
    expect(analysis.report.errors).toEqual([]);
    const codes = analysis.report.warnings.map(w => w.code);
    for (const bad of [
      'merge-ignored', 'merge-dates-ignored', 'cv-skill-no-source', 'cv-skill-unsourced', 'cv-skills-too-few', 'cv-skill-too-long', 'cv-skill-duplicate', 'target-forbidden-term',
      'unsupported-title', 'angle-title-corrected', 'tense', 'too-many-numbers', 'summary-has-numbers', 'bold-in-missions-mode',
      'summary-starts-with-title', 'target-photo', 'target-reader-mentioned', 'header-extra-invented', 'unknown-id', 'empty-description',
    ]) expect(codes).not.toContain(bad);
    // Le garde-fou garde tout ce qui est valide.
    expect(analysis.data.title).toBe(GENERALIST_TITLE);
    expect(analysis.data.cvSkills).toHaveLength(7);
    expect(analysis.data.mergedEntries?.map(g => g.ids)).toEqual([['a1', 'a2'], ['b1', 'b2', 'b3']]);
    expect(analysis.data.header).toEqual({ showDrivingLicense: true });
  });

  it('application : fusions, compétences de l\'IA, en-tête et instantané de ciblage', async () => {
    const { store, report } = await produce();
    expect(report.merges).toBe(2);
    expect(report.cvSkills).toBe('applied');
    expect(store.settings.showDrivingLicense).toBe(true);
    expect(readTargetSnapshot(store.settings)?.titleRule).toBe('free');
    const byId = (id: string) => store.currentCvBlocks.find(b => b.id === id)!;
    // Porteurs : entrée la plus récente de chaque groupe ; autres membres masqués.
    expect(byId('b-a1').overrideData.mergedFrom).toEqual(['a1', 'a2']);
    expect(byId('b-b1').overrideData.mergedFrom).toEqual(['b1', 'b2', 'b3']);
    for (const id of ['b-a2', 'b-b2', 'b-b3']) expect(byId(id).isVisible).toBe(false);
    // Catégories de compétences du profil masquées au profit des 7 compétences de l'IA.
    expect(byId('b-k1').isVisible).toBe(false);
    expect(byId('b-k2').isVisible).toBe(false);
    expect(store.currentCvBlocks.filter(isAiSkillBlock)).toHaveLength(7);
    expect(byId('b-c1').isVisible).toBe(false);
    expect(byId('b-i1').isVisible).toBe(false);
  });

  it('CV rendu : en-tête avec « Permis B », titre libre, 4 postes + 2 lignes fusionnées aux dates calculées, 7 étiquettes, formation sur 2 lignes, aucune autre section', async () => {
    const { store, cv, analysis } = await produce();
    const html = renderToStaticMarkup(
      <PrintableCV cv={cv} profile={GENERALIST_PROFILE} blocks={store.currentCvBlocks} entries={GENERALIST_ENTRIES} template={getTemplate('ats-classic')} />,
    );
    const text = visibleText(html);

    // En-tête et titre libre.
    expect(text).toContain('Permis B');
    expect(analysis.ok && analysis.data.title).toBe(GENERALIST_TITLE);
    expect(text).toContain('Relation client et gestion des commandes');

    // Sections : exactement Expériences, Compétences, Formations, dans cet ordre.
    const headings = [...html.matchAll(/<h3[^>]*>([^<]+)<\/h3>/g)].map(m => m[1].trim().toLowerCase());
    expect(headings).toEqual(['expériences professionnelles', 'compétences', 'formations']);

    // Expériences : 4 détaillées + 2 lignes fusionnées (6 titres), puis 2 formations.
    const titles = [...html.matchAll(/<span class="cv-title(?![-\w])[^"]*"[^>]*>([^<]*)</g)].map(m => m[1].trim());
    expect(titles).toEqual([
      'Assistante commerciale', 'Assistante commerciale', 'Assistante commerciale', 'Assistante de direction', // détaillés
      'Assistante commerciale', 'Assistant administratif',                                           // fusionnés
      'Master Commerce et gestion', 'Licence Économie',                                        // formation
    ]);
    // Dates calculées de chaque ligne fusionnée, au format habituel (mois et année).
    expect(text).toContain('mars 2013 – mai 2015');
    expect(text).toContain('septembre 2010 – février 2013');
    expect(text).toContain('Epsilon, Zeta');
    expect(text).toContain('Eta, Theta, Iota');
    // Aucun poste fusionné n'apparaît seul, ni son titre à parenthèse.
    for (const gone of ['(Epsilon)', '(Zeta)', '(Eta)', '(Theta)', '(Iota)']) expect(text).not.toContain(gone);

    // Poste en cours : « auj. ».
    expect(text).toContain('janvier 2022 – auj.');

    // 7 compétences de l'IA en étiquettes (comme les compétences du profil), aucune catégorie du profil.
    expect(html).not.toContain('cv-skill-line');
    expect(html.match(/class="cv-badge cv-badge-item/g)).toHaveLength(7);
    for (const k of GENERALIST_SKILLS) expect(html).toContain(`>${k.name.replace(/'/g, '&#x27;')}</span>`);
    for (const hidden of ['Tableur', 'Messagerie', 'Randonnée', 'secouriste']) expect(text).not.toContain(hidden);

    // Formation sur 2 lignes : une ligne chacune, sans description.
    expect(text).toContain('Université fictive');
    expect(text).toContain('2008 – 2010');
    expect(text).toContain('2005 – 2008');
  });

  it('ciblage public : aucun terme d\'avoidTerms ne passe, ni dans le garde-fou ni dans le CV rendu', async () => {
    const { store, cv } = await produce();
    const text = visibleText(renderToStaticMarkup(
      <PrintableCV cv={cv} profile={GENERALIST_PROFILE} blocks={store.currentCvBlocks} entries={GENERALIST_ENTRIES} template={getTemplate('ats-classic')} />,
    )).toLowerCase();
    const avoid = DEFAULT_TARGET_SHEETS.public.avoidTerms;
    expect(avoid.length).toBeGreaterThan(8);
    for (const term of avoid) {
      expect(new RegExp(`(^|[^a-z0-9])${term.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^a-z0-9])`).test(text)).toBe(false);
    }
  });

  it('contrôle négatif : un terme interdit dans une puce est signalé avec son équivalence', () => {
    const bad = analyze(generalistResponse({ d1Description: "- Suivre le pipeline des commandes avec les responsables de service\n- Rédiger les devis et les contrats\n- Animer les réunions de suivi avec les équipes\n- Suivre les dossiers clients dans un logiciel de gestion" }));
    expect(bad.ok).toBe(true);
    if (!bad.ok) return;
    const w = bad.report.warnings.find(x => x.code === 'target-forbidden-term');
    expect(w?.message).toContain('« pipeline »');
    expect(bad.report.errors).toEqual([]);
  });

  it('lot 3 × lot 2 : une compétence de l\'IA citant une entrée fusionnée reste valide, bloc masqué ou non', async () => {
    const { analysis, store } = await produce();
    expect(analysis.ok && analysis.data.cvSkills?.map(k => k.sources)).toEqual(GENERALIST_SKILLS.map(k => k.sources));
    const lines = store.currentCvBlocks.filter(isAiSkillBlock);
    expect(lines.map(l => l.overrideData.sources)).toContainEqual(['a2']);
    expect(lines.map(l => l.overrideData.sources)).toContainEqual(['b3']);
    expect(store.currentCvBlocks.find(b => b.id === 'b-a2')!.isVisible).toBe(false);
    expect(store.currentCvBlocks.find(b => b.id === 'b-b3')!.isVisible).toBe(false);
  });

  it('réapplication idempotente : même CV', async () => {
    const { analysis, store } = await produce();
    if (!analysis.ok) return;
    const snapshot = () => store.sorted().map(b => [b.isVisible, b.customContent, JSON.stringify(b.overrideData), b.entryId]);
    const first = snapshot();
    await applyAiCvToBlocks('cv-gen', analysis.data, { store: () => store, entries: GENERALIST_ENTRIES, profile: GENERALIST_PROFILE, target: TARGET });
    expect(snapshot()).toEqual(first);
  });

  it('export DOCX : mêmes éléments', async () => {
    const { store, cv } = await produce();
    const blob = await generateDocxBlob(cv, GENERALIST_PROFILE, store.currentCvBlocks, GENERALIST_ENTRIES, getTemplate('ats-classic'));
    const xml = await (await JSZip.loadAsync(await blob.arrayBuffer())).file('word/document.xml')!.async('string');
    for (const expected of ['Permis B', 'Epsilon, Zeta', 'Eta, Theta, Iota', 'mars 2013 – mai 2015', 'septembre 2010 – février 2013', 'Master Commerce et gestion', 'Licence Économie']) {
      expect(xml).toContain(expected);
    }
    expect(xml).toContain(GENERALIST_SKILLS.map(k => k.name).join(' · ').replace(/'/g, '&apos;'));
    expect(xml).not.toContain('Tableur');
  });
});
