import { describe, expect, it } from 'bun:test';
import JSZip from 'jszip';
import { renderToStaticMarkup } from 'react-dom/server';
import { PrintableCV } from '../components/export/PrintableCV';
import { generateDocxBlob } from '../lib/export-docx';
import { getAllTemplates, getTemplate } from '.';
import type { CVDocument } from '../types/cv';
import { TEST_PROFILE, makeBlocks, makeEntries } from '../lib/test-helpers/cv-fixtures';

/**
 * Modèles à organisation propre (template.structure, layout `header-columns`) : lot 1.
 * Rendu écran/PDF (même HTML) et export Word, avec le même contenu.
 */

const LOT_1 = ['ats-chrono', 'ats-scinde', 'ats-frise', 'marge', 'colonnes-filet'];
const ORIGINAL = ['ats-classic', 'ats-modern', 'elegant', 'minimalist', 'tech', 'executive', 'creative', 'academic', 'sidebar-modern', 'sidebar-elegant', 'sidebar-tech'];
const LOT_2 = ['ats-etiquettes', 'ats-bandes', 'ats-lettre', 'grille', 'cartes'];
const LOT_3 = ['monogramme', 'magazine', 'surligneur', 'grand-entete', 'frise-centrale'];
const STRUCTURE_CLASSES = ['cv-entry-gutter', 'cv-header-split', 'cv-header-left', 'cv-entry-timeline', 'cv-margin-section', 'cv-columns', 'cv-side-col', 'cv-header-rule',
  'cv-entry-inline', 'cv-entry-date-below', 'cv-entry-hanging', 'cv-entry-card', 'cv-meta-sep',
  'cv-monogram', 'cv-header-hero', 'cv-hero-photo', 'cv-entry-date-above', 'cv-entry-pill', 'cv-entry-alt', 'cv-panel', 'cv-tiles'];

const entries = makeEntries();
const blocks = makeBlocks(entries);
const cv: CVDocument = {
  id: 'cv1', profileId: 'p1', name: 'CV', templateId: 'ats-classic', targetJob: 'Assistante commerciale', targetCompany: null,
  customSummary: 'Assistante commerciale confirmée.', settings: {}, isFavorite: false, lastExported: null,
  markdownContent: null, markdownMode: 0, createdAt: '', updatedAt: '',
};

const html = (id: string, settings: Record<string, unknown> = {}) => renderToStaticMarkup(
  <PrintableCV cv={{ ...cv, templateId: id, settings }} profile={TEST_PROFILE} blocks={blocks} entries={entries} template={getTemplate(id)} />,
);

async function docxXml(id: string): Promise<string> {
  const blob = await generateDocxBlob({ ...cv, templateId: id }, TEST_PROFILE, blocks, entries, getTemplate(id));
  return (await JSZip.loadAsync(await blob.arrayBuffer())).file('word/document.xml')!.async('string');
}

/** Texte brut d'un document Word (contenu des balises <w:t>). */
const docxText = (xml: string) => [...xml.matchAll(/<w:t(?: [^>]*)?>([^<]*)<\/w:t>/g)].map(m => m[1]).join(' ')
  .replace(/&apos;/g, "'").replace(/&amp;/g, '&');

describe('lot 1 : catalogue', () => {
  it('les 5 modèles sont enregistrés et proposés dans le sélecteur', () => {
    const ids = getAllTemplates().map(t => t.id);
    for (const id of LOT_1) expect(ids).toContain(id);
  });

  it('3 modèles une colonne compatibles ATS, 2 à deux colonnes signalés non-ATS', () => {
    for (const id of ['ats-chrono', 'ats-scinde', 'ats-frise']) {
      const t = getTemplate(id);
      expect(t.category).toBe('ats');
      expect(t.atsOptimized).not.toBe(false);
      expect(t.layout ?? 'linear').toBe('linear');
      expect(t.structure?.section ?? 'stacked').toBe('stacked');
      expect(t.docx.useTables).toBe(false);
      expect(t.docx.useColumns).toBe(false);
    }
    for (const id of ['marge', 'colonnes-filet']) {
      expect(getTemplate(id).atsOptimized).toBe(false);
      expect(getTemplate(id).category).toBe('graphic');
    }
  });

  it('photo facultative, aucun bandeau sombre, dégradé ou plein, une couleur d’accent par palette', () => {
    for (const id of LOT_1) {
      const t = getTemplate(id);
      expect(t.supportsPhoto).toBe(true);
      for (const v of t.headerVariants ?? []) expect(['dark-banner', 'gradient-banner', 'accent-banner']).not.toContain(v);
      expect(t.sidebar).toBeUndefined();
      for (const p of t.palettes ?? []) expect(p.accent).toMatch(/^#[0-9a-f]{6}$/i);
      const classes = Object.values(t.preview).join(' ');
      expect(classes).not.toMatch(/gradient|bg-gray-[6-9]00|bg-slate-[6-9]00|bg-black/);
    }
  });
});

describe('lot 1 : rendu (écran et PDF)', () => {
  it('les 11 modèles d’origine ne reçoivent aucune des nouvelles structures', () => {
    for (const id of ORIGINAL) {
      const out = html(id);
      for (const c of STRUCTURE_CLASSES) expect(out).not.toContain(c);
    }
  });

  for (const id of LOT_1) {
    it(`${id} : contenu complet, sans photo ni texte d’exemple`, () => {
      const out = html(id);
      for (const text of ['Camille Durand', 'Assistante commerciale', 'camille@example.com', 'Lyon', 'ACME', 'Globex',
        'Master Commerce', 'Salesforce', 'TOSA Excel', 'Anglais', 'Expériences Professionnelles', 'Formations', 'Compétences', 'Langues']) {
        expect(out).toContain(text);
      }
      expect(out).not.toContain('<img');
      expect(out).not.toMatch(/lorem|ipsum|cvcrea|réalisé sur/i);
    });
  }

  it('Chronologique : dates dans la marge, avant l’intitulé, en-tête à gauche', () => {
    const out = html('ats-chrono');
    expect(out).toContain('cv-entry-gutter');
    expect(out).toContain('cv-header-left');
    const entry = out.slice(out.indexOf('cv-entry-gutter'));
    expect(entry.indexOf('cv-gutter-date')).toBeLessThan(entry.indexOf('Assistante commerciale'));
    expect(out).toContain('grid-template-columns: 24%');
  });

  it('En-tête scindé : coordonnées dans un bloc à droite, filet d’accent épais', () => {
    const out = html('ats-scinde');
    expect(out).toContain('cv-header-split');
    expect(out).toContain('cv-contact-stack');
    expect(out).toContain('cv-header-rule');
    expect(out.indexOf('Camille Durand')).toBeLessThan(out.indexOf('camille@example.com'));
    expect(out).toContain('border-top: 3px solid #c2410c');
  });

  it('Frise : une pastille par entrée (2 expériences, 1 formation), aucune sur les badges', () => {
    const out = html('ats-frise');
    expect(out.match(/cv-entry cv-entry-timeline/g)).toHaveLength(3);
    expect(out).toContain('border-radius: 9999px');
  });

  it('Titres en marge : une rangée par section, résumé aligné sur le contenu', () => {
    const out = html('marge');
    expect(out.match(/class="cv-margin-section"/g)).toHaveLength(5);
    expect(out).toContain('cv-margin-offset');
    expect(out).toContain('cv-margin-body');
  });

  it('Deux colonnes à filet : en-tête pleine largeur, badges à gauche, parcours à droite', () => {
    const out = html('colonnes-filet');
    const side = out.slice(out.indexOf('class="cv-side-col"'), out.indexOf('class="cv-main-col"'));
    expect(side).toContain('Compétences');
    expect(side).toContain('Langues');
    expect(side).not.toContain('ACME');
    expect(side).not.toContain('Contact');
    expect(out.indexOf('camille@example.com')).toBeLessThan(out.indexOf('class="cv-columns"'));
    expect(out.slice(out.indexOf('class="cv-main-col"'))).toContain('ACME');
  });

  it('la couleur choisie remplace l’accent du modèle (une seule couleur)', () => {
    const out = html('ats-frise', { primaryColor: '#7e22ce' });
    expect(out).toContain('border: 2px solid #7e22ce');
    expect(out).not.toContain('border: 2px solid #047857');
  });
});

describe('lot 1 : export Word, même contenu', () => {
  for (const id of LOT_1) {
    it(`${id} : nom, poste, sections, entrées, dates et compétences`, async () => {
      const text = docxText(await docxXml(id));
      for (const t of ['Camille Durand', 'Assistante commerciale', 'ACME', 'Globex', 'Master Commerce', 'TOSA Excel', 'Salesforce', 'Anglais', '2021', '2018', '2016']) {
        expect(text).toContain(t);
      }
      expect(text.toLowerCase()).toContain('expériences professionnelles');
    });
  }

  it('modèles ATS sans photo : aucun tableau ni zone de texte', async () => {
    for (const id of ['ats-chrono', 'ats-scinde', 'ats-frise']) {
      const xml = await docxXml(id);
      expect(xml).not.toContain('<w:tbl>');
      expect(xml).not.toContain('<w:txbxContent');
    }
  });

  it('Chronologique : la date précède l’intitulé, séparés par une tabulation, retrait suspendu', async () => {
    const xml = await docxXml('ats-chrono');
    const para = xml.split('</w:p>').find(p => p.includes('Technicien support'))!;
    expect(para).toMatch(/2018[^<]*<\/w:t>[^]*<w:t xml:space="preserve">\t<\/w:t>[^]*Technicien support/);
    expect(para).toMatch(/<w:ind w:left="\d+" w:hanging="\d+"\/>/);
  });

  it('En-tête scindé : coordonnées alignées à droite par tabulation, titres à repère gauche', async () => {
    const xml = await docxXml('ats-scinde');
    expect(xml).toContain('<w:tab w:val="right"');
    expect(xml).toMatch(/<w:left w:val="single"[^>]*w:sz="24"/);
  });

  it('Frise : titres non mis en capitales, filet gauche sur les entrées', async () => {
    const xml = await docxXml('ats-frise');
    const text = docxText(xml);
    expect(text).toContain('Expériences Professionnelles');
    expect(text).not.toContain('EXPÉRIENCES PROFESSIONNELLES');
    expect(xml).toMatch(/<w:left w:val="single"[^>]*w:sz="12"/);
  });

  it('Titres en marge : le contenu est en retrait sous le titre', async () => {
    const xml = await docxXml('marge');
    expect(xml).toMatch(/<w:ind w:left="2\d{3}"\/>/);
  });
});

describe('lot 2 : catalogue', () => {
  it('les 5 modèles sont enregistrés, 3 ATS une colonne et 2 signalés non-ATS', () => {
    const ids = getAllTemplates().map(t => t.id);
    for (const id of LOT_2) expect(ids).toContain(id);
    for (const id of ['ats-etiquettes', 'ats-bandes', 'ats-lettre']) {
      const t = getTemplate(id);
      expect(t.category).toBe('ats');
      expect(t.atsOptimized).not.toBe(false);
      expect(t.layout ?? 'linear').toBe('linear');
      expect(t.docx.useTables).toBe(false);
    }
    for (const id of ['grille', 'cartes']) {
      expect(getTemplate(id).atsOptimized).toBe(false);
      expect(getTemplate(id).category).toBe('graphic');
    }
  });

  it('au moins 5 modèles une colonne compatibles ATS parmi les nouveaux', () => {
    const atsNew = [...LOT_1, ...LOT_2].filter(id => getTemplate(id).category === 'ats' && (getTemplate(id).layout ?? 'linear') === 'linear');
    expect(atsNew.length).toBeGreaterThanOrEqual(5);
  });

  it('photo facultative, aucun bandeau sombre, dégradé ou plein', () => {
    for (const id of LOT_2) {
      const t = getTemplate(id);
      expect(t.supportsPhoto).toBe(true);
      for (const v of t.headerVariants ?? []) expect(['dark-banner', 'gradient-banner', 'accent-banner']).not.toContain(v);
      expect(Object.values(t.preview).join(' ')).not.toMatch(/gradient|bg-gray-[6-9]00|bg-slate-[6-9]00|bg-black/);
    }
  });
});

describe('lot 2 : rendu (écran et PDF)', () => {
  for (const id of LOT_2) {
    it(`${id} : contenu complet, sans photo ni texte d’exemple`, () => {
      const out = html(id);
      for (const text of ['Camille Durand', 'Assistante commerciale', 'camille@example.com', 'ACME', 'Globex',
        'Master Commerce', 'Salesforce', 'TOSA Excel', 'Anglais', 'Expériences Professionnelles', 'Formations', 'Compétences', 'Langues']) {
        expect(out).toContain(text);
      }
      expect(out).not.toContain('<img');
      expect(out).not.toMatch(/lorem|ipsum|cvcrea|réalisé sur/i);
    });
  }

  it('Étiquettes : titres sur fond teinté ajusté, « Intitulé, Entreprise » sur une ligne', () => {
    const out = html('ats-etiquettes');
    expect(out).toContain('display: table');
    expect(out).toContain('background-color: color-mix(in srgb, #1e3a8a 13%, white)');
    const entry = out.slice(out.indexOf('cv-entry cv-entry-inline'));
    const row = entry.slice(0, entry.indexOf('</div>'));
    expect(row).toContain('Assistante commerciale');
    expect(row).toContain(', ACME');
    expect(row).toContain('cv-date');
    expect(entry.indexOf('cv-meta-row')).toBe(-1);
  });

  it('Bandes claires : bande pleine largeur, dates sur la ligne de l’entreprise', () => {
    const out = html('ats-bandes');
    expect(out).toContain('#printable-cv h3 { display: block; padding: 4px 9px; }');
    const entry = out.slice(out.indexOf('cv-entry cv-entry-date-below'));
    const meta = entry.slice(entry.indexOf('cv-meta-row'), entry.indexOf('cv-desc'));
    expect(meta).toContain('ACME');
    expect(meta).toContain('cv-date');
    expect(meta.indexOf('ACME')).toBeLessThan(meta.indexOf('cv-date'));
  });

  it('Lettre : aucun trait sous l’en-tête, intitulé en saillie et reste en retrait', () => {
    const out = html('ats-lettre');
    expect(out).not.toContain('<hr');
    expect(out).toContain('cv-hanging-body');
    expect(out).toContain('padding-left: 20px');
    expect(out).toContain('font-variant-caps:small-caps');
    expect(out).not.toMatch(/font-variant:small-caps/);
  });

  it('Deux colonnes égales : expériences à gauche, formation, badges et langues à droite', () => {
    const out = html('grille');
    const left = out.slice(out.indexOf('class="cv-main-col"'), out.indexOf('class="cv-side-col"'));
    const right = out.slice(out.indexOf('class="cv-side-col"'));
    expect(left).toContain('ACME');
    expect(left).toContain('Expériences Professionnelles');
    expect(left).not.toContain('Master Commerce');
    for (const t of ['Formations', 'Master Commerce', 'Compétences', 'Certifications', 'Langues']) expect(right).toContain(t);
    expect(out).toContain('flex: 1 1 0');
  });

  it('Deux colonnes égales : une seule colonne si tout est d’un même côté', () => {
    const onlyBadges = blocks.filter(b => !['x1', 'x2'].includes(b.entryId ?? '') && b.id !== 'h-experience');
    const out = renderToStaticMarkup(
      <PrintableCV cv={{ ...cv, templateId: 'grille' }} profile={TEST_PROFILE} blocks={onlyBadges} entries={entries} template={getTemplate('grille')} />,
    );
    expect(out).not.toContain('class="cv-columns"');
    expect(out).toContain('Master Commerce');
  });

  it('Cartes : un cadre par expérience ou formation, aucun sur les badges', () => {
    const out = html('cartes');
    expect(out.match(/cv-entry cv-entry-card/g)).toHaveLength(3);
    expect(out).toContain('border-left: 3px solid #7e22ce');
  });
});

describe('lot 2 : export Word, même contenu', () => {
  for (const id of LOT_2) {
    it(`${id} : nom, poste, sections, entrées, dates et compétences`, async () => {
      const text = docxText(await docxXml(id));
      for (const t of ['Camille Durand', 'Assistante commerciale', 'ACME', 'Globex', 'Master Commerce', 'TOSA Excel', 'Salesforce', 'Anglais', '2021', '2018', '2016']) {
        expect(text).toContain(t);
      }
      expect(text.toLowerCase()).toContain('expériences professionnelles');
    });
  }

  it('modèles ATS sans photo : aucun tableau ni zone de texte', async () => {
    for (const id of ['ats-etiquettes', 'ats-bandes', 'ats-lettre']) {
      const xml = await docxXml(id);
      expect(xml).not.toContain('<w:tbl>');
      expect(xml).not.toContain('<w:txbxContent');
    }
  });

  it('Étiquettes : fond clair sur le texte du titre seul, entreprise sur la ligne de l’intitulé', async () => {
    const xml = await docxXml('ats-etiquettes');
    const heading = xml.split('</w:p>').find(p => p.includes('EXPÉRIENCES PROFESSIONNELLES'))!;
    expect(heading).toMatch(/<w:rPr>[^]*<w:shd [^>]*w:fill="[0-9A-F]{6}"/);
    expect(heading.slice(heading.indexOf('<w:pPr>'), heading.indexOf('</w:pPr>'))).not.toContain('<w:shd ');
    const para = xml.split('</w:p>').find(p => p.includes('Technicien support'))!;
    expect(para).toContain(', Globex');
    expect(para).toContain('2018');
  });

  it('Bandes claires : fond clair sur tout le paragraphe du titre, dates sous l’intitulé', async () => {
    const xml = await docxXml('ats-bandes');
    const heading = xml.split('</w:p>').find(p => p.includes('EXPÉRIENCES PROFESSIONNELLES'))!;
    expect(heading.slice(heading.indexOf('<w:pPr>'), heading.indexOf('</w:pPr>'))).toMatch(/<w:shd [^>]*w:fill="[0-9A-F]{6}"/);
    const title = xml.split('</w:p>').find(p => p.includes('Technicien support'))!;
    expect(title).not.toContain('2018');
    const next = xml.split('</w:p>').find(p => p.includes('Globex'))!;
    expect(next).toContain('2018');
  });

  it('Lettre : titres en italique sans capitales, aucun filet, reste de l’entrée en retrait', async () => {
    const xml = await docxXml('ats-lettre');
    const text = docxText(xml);
    expect(text).toContain('Expériences Professionnelles');
    expect(text).not.toContain('EXPÉRIENCES PROFESSIONNELLES');
    const heading = xml.split('</w:p>').find(p => p.includes('Expériences Professionnelles'))!;
    expect(heading).toContain('<w:i/>');
    expect(heading).not.toContain('<w:pBdr>');
    const meta = xml.split('</w:p>').find(p => p.includes('Globex'))!;
    expect(meta).toMatch(/<w:ind w:left="360"\/>/);
  });

  it('Cartes : bordure tout autour des paragraphes de l’entrée, puces écrites sans liste', async () => {
    const xml = await docxXml('cartes');
    const bullet = xml.split('</w:p>').find(p => p.includes('Support de niveau 2'))!;
    expect(bullet).toContain('<w:pBdr>');
    expect(bullet).toMatch(/<w:left w:val="single"[^>]*w:sz="18"/);
    expect(bullet).not.toContain('<w:numPr>');
    expect(docxText(bullet)).toContain('•');
  });
});

describe('lot 3 : catalogue', () => {
  it('5 modèles graphiques, tous signalés non-ATS', () => {
    const ids = getAllTemplates().map(t => t.id);
    for (const id of LOT_3) {
      expect(ids).toContain(id);
      const t = getTemplate(id);
      expect(t.atsOptimized).toBe(false);
      expect(['creative', 'graphic']).toContain(t.category);
    }
    expect(getTemplate('magazine').category).toBe('graphic');
    expect(getTemplate('frise-centrale').category).toBe('graphic');
  });

  it('les 15 nouveaux modèles : au moins 5 une colonne compatibles ATS', () => {
    const all = [...LOT_1, ...LOT_2, ...LOT_3];
    expect(all).toHaveLength(15);
    expect(new Set(all).size).toBe(15);
    const ats = all.filter(id => getTemplate(id).category === 'ats' && getTemplate(id).atsOptimized !== false && (getTemplate(id).layout ?? 'linear') === 'linear');
    expect(ats.length).toBeGreaterThanOrEqual(5);
  });

  it('photo facultative, aucun bandeau sombre, dégradé ou plein', () => {
    for (const id of LOT_3) {
      const t = getTemplate(id);
      expect(t.supportsPhoto).toBe(true);
      expect(t.headerVariants).toEqual(['clean']);
      expect(Object.values(t.preview).join(' ')).not.toMatch(/gradient|bg-gray-[6-9]00|bg-slate-[6-9]00|bg-black/);
      expect(html(id)).not.toMatch(/linear-gradient|radial-gradient/);
    }
  });
});

describe('lot 3 : rendu (écran et PDF)', () => {
  for (const id of LOT_3) {
    it(`${id} : contenu complet, sans photo ni texte d’exemple`, () => {
      const out = html(id);
      for (const text of ['Camille Durand', 'Assistante commerciale', 'camille@example.com', 'ACME', 'Globex',
        'Master Commerce', 'Salesforce', 'TOSA Excel', 'Anglais', 'Assistante commerciale confirmée.',
        'Expériences Professionnelles', 'Formations', 'Compétences', 'Langues']) {
        expect(out).toContain(text);
      }
      expect(out).not.toContain('<img');
      expect(out).not.toMatch(/lorem|ipsum|cvcrea|réalisé sur/i);
    });
  }

  it('Monogramme : initiales en décor (attribut, pas dans le texte), remplacées par la photo', () => {
    const out = html('monogramme');
    expect(out).toContain('data-initials="CD"');
    expect(out).toContain('content: attr(data-initials)');
    expect(out).not.toContain('>CD<');
    const withPhoto = renderToStaticMarkup(
      <PrintableCV cv={{ ...cv, templateId: 'monogramme' }} profile={{ ...TEST_PROFILE, photoPath: 'data:image/png;base64,AAAA' }} blocks={blocks} entries={entries} template={getTemplate('monogramme')} />,
    );
    expect(withPhoto).not.toContain('data-initials="');
    expect(withPhoto).toContain('<img');
  });

  it('Monogramme : titres prolongés d’un filet, dates au-dessus de l’intitulé', () => {
    const out = html('monogramme');
    expect(out).toContain('#printable-cv h3::after { content: ""; flex: 1 1 auto;');
    const entry = out.slice(out.indexOf('cv-entry cv-entry-date-above'));
    expect(entry.indexOf('cv-date')).toBeLessThan(entry.indexOf('Assistante commerciale'));
  });

  it('Magazine : accroche et badges dans l’encadré, parcours dans la colonne large', () => {
    const out = html('magazine');
    const main = out.slice(out.indexOf('class="cv-main-col"'), out.indexOf('class="cv-side-col cv-panel"'));
    const panel = out.slice(out.indexOf('class="cv-side-col cv-panel"'));
    expect(main).toContain('ACME');
    expect(main).toContain('Master Commerce');
    expect(main).not.toContain('Négociation');
    for (const t of ['Assistante commerciale confirmée.', 'Compétences', 'Négociation', 'Langues']) expect(panel).toContain(t);
    expect(out.match(/Assistante commerciale confirmée\./g)).toHaveLength(1);
    expect(out).toContain('border-top: 4px solid #c2410c');
  });

  it('Surligneur : aplat sous les titres et le nom, carré avant l’intitulé, dates en pastille', () => {
    const out = html('surligneur');
    expect(out).toContain('#printable-cv h3::before, #printable-cv .cv-name::before');
    expect(out).toContain('height: 0.48em');
    expect(out.match(/cv-entry cv-entry-pill/g)).toHaveLength(3);
    expect(out).toContain('border-radius: 9999px; padding: 0 8px');
  });

  it('Grand en-tête : bloc clair pleine largeur, badges en tuiles après le parcours', () => {
    const out = html('grand-entete');
    expect(out).toContain('cv-header-hero');
    expect(out).toContain('background-color: color-mix(in srgb, #14532d 11%, white)');
    const tiles = out.slice(out.indexOf('class="cv-tiles"'));
    for (const t of ['Compétences', 'Certifications', 'Langues']) expect(tiles).toContain(t);
    expect(out.indexOf('Master Commerce')).toBeLessThan(out.indexOf('class="cv-tiles"'));
    expect(out).toContain('--cv-tile-cols:3');
  });

  it('Grand en-tête : photo ronde à cheval sur le bord du bloc', () => {
    const out = renderToStaticMarkup(
      <PrintableCV cv={{ ...cv, templateId: 'grand-entete' }} profile={{ ...TEST_PROFILE, photoPath: 'data:image/png;base64,AAAA' }} blocks={blocks} entries={entries} template={getTemplate('grand-entete')} />,
    );
    expect(out).toContain('cv-hero-photo');
    expect(out).toContain('transform: translateY(50%)');
    expect(out.indexOf('Camille Durand')).toBeLessThan(out.indexOf('cv-hero-photo rounded-full'));
  });

  it('Frise centrale : le contenu alterne à droite puis à gauche, en repartant à chaque section', () => {
    const out = html('frise-centrale');
    const sides = [...out.matchAll(/cv-entry cv-entry-alt cv-alt-(left|right)/g)].map(m => m[1]);
    expect(sides).toEqual(['right', 'left', 'right']);
    const entry = out.slice(out.indexOf('cv-entry cv-entry-alt'));
    expect(entry.indexOf('cv-alt-date')).toBeLessThan(entry.indexOf('cv-alt-body'));
    expect(out).toContain('grid-template-columns: minmax(0, 1fr) 30px minmax(0, 1fr)');
  });
});

describe('lot 3 : export Word, même contenu', () => {
  for (const id of LOT_3) {
    it(`${id} : nom, poste, accroche, sections, entrées, dates et compétences`, async () => {
      const text = docxText(await docxXml(id));
      for (const t of ['Camille Durand', 'Assistante commerciale', 'Assistante commerciale confirmée.', 'ACME', 'Globex', 'Master Commerce', 'TOSA Excel', 'Salesforce', 'Anglais', '2021', '2018', '2016']) {
        expect(text).toContain(t);
      }
      expect(text.toLowerCase()).toContain('expériences professionnelles');
    });
  }

  it('Monogramme : titres en italique et en couleur d’accent, dates au-dessus de l’intitulé, initiales non reprises', async () => {
    const xml = await docxXml('monogramme');
    const heading = xml.split('</w:p>').find(p => p.includes('Expériences Professionnelles'))!;
    expect(heading).toContain('<w:i/>');
    expect(heading).toContain('<w:color w:val="7E22CE"/>');
    const paras = xml.split('</w:p>');
    const titleIdx = paras.findIndex(p => p.includes('Technicien support'));
    expect(docxText(paras[titleIdx - 1])).toContain('2018');
    expect(docxText(xml)).not.toMatch(/\bCD\b/);
  });

  it('Surligneur : nom et titres sur fond clair', async () => {
    const xml = await docxXml('surligneur');
    const name = xml.split('</w:p>').find(p => p.includes('Camille Durand'))!;
    expect(name).toMatch(/<w:shd [^>]*w:fill="[0-9A-F]{6}"/);
    const heading = xml.split('</w:p>').find(p => p.includes('Expériences Professionnelles'))!;
    expect(heading).toMatch(/<w:shd [^>]*w:fill="[0-9A-F]{6}"/);
  });

  it('Grand en-tête : en-tête sur fond clair pleine largeur, sans tableau sans photo', async () => {
    const xml = await docxXml('grand-entete');
    const name = xml.split('</w:p>').find(p => p.includes('Camille Durand'))!;
    expect(name.slice(name.indexOf('<w:pPr>'), name.indexOf('</w:pPr>'))).toMatch(/<w:shd [^>]*w:fill="[0-9A-F]{6}"/);
    expect(xml).not.toContain('<w:tbl>');
  });
});
