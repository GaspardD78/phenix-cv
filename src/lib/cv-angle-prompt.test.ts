import { describe, expect, it } from 'bun:test';
import { angleTitleRule, buildAngle, buildAngleChoice } from './cv-angle-prompt';
import { buildCvPrompt, buildOutputSchema } from './cv-prompt';
import { DEFAULT_ANGLES, resolveAngle } from './cv-angles';
import { TEST_PROFILE } from './test-helpers/cv-fixtures';
import { SOC_ANGLE, makeAngleEntries } from './test-helpers/angle-fixtures';

const entries = makeAngleEntries();
const NOW = new Date(Date.UTC(2026, 5, 15));
const JOB = 'Assistante commerciale N2 (H/F). Salesforce, Excel. CDI Lyon.';

describe('buildAngle', () => {
  const block = buildAngle(SOC_ANGLE, entries, TEST_PROFILE);

  it('entrées en tête et masquées avec ID et titre propre', () => {
    expect(block).toContain('- ID: "x1" | Titre: "Assistante commerciale"');
    expect(block).toContain('- ID: "x2" | Titre: "Technicien support"');
    expect(block).toContain('- ID: "i1" | Titre: "Astronomie"');
    expect(block.indexOf('"x1"')).toBeLessThan(block.indexOf('MASQUÉES'));
    expect(block.indexOf('"x2"')).toBeGreaterThan(block.indexOf('MASQUÉES'));
  });

  it('règle de titre, gabarit, catégories existantes, vocabulaire, anciennes expériences', () => {
    expect(block).toContain('- TITRE : « Assistante commerciale » tel quel. Aucun autre intitulé.');
    expect(block).toContain('{intitulé} depuis {année}, {outils de détection}, {preuve chiffrée}');
    expect(block).toContain('jamais inventé');
    expect(block).toContain('CATÉGORIES DE COMPÉTENCES, dans cet ordre : Outils de vente, Langages.');
    expect(block).not.toContain('Inexistante');
    expect(block).toContain('Vocabulaire de la détection');
    expect(block).toContain('une ligne (titre, employeur, dates), sans description');
  });

  it('snapshot', () => {
    expect(block).toMatchSnapshot();
  });

  it('profile+keyword', () => {
    expect(angleTitleRule('profile+keyword', 'Assistante commerciale')).toContain('« Assistante commerciale - {mot-clé de l\'annonce} »');
  });
});

describe('buildAngleChoice', () => {
  it('liste les angles de la bibliothèque et demande analyse.angle', () => {
    const library = DEFAULT_ANGLES.map(a => resolveAngle(a, entries));
    const block = buildAngleChoice([SOC_ANGLE, ...library], entries, TEST_PROFILE);
    expect(block).toContain('### Angle "expertise" : Assistante commerciale');
    expect(block).toContain('### Angle "polyvalence"');
    expect(block).toContain('analyse.angle');
    expect(block).toMatchSnapshot();
  });
});

describe('prompt CV avec angle (mode 1)', () => {
  const base = { profile: TEST_PROFILE, entries, jobOfferText: JOB };

  it('angle imposé : en tête, masquées, catégories, titre de l\'angle', () => {
    const prompt = buildCvPrompt({ ...base, options: { now: NOW, angle: SOC_ANGLE } });
    expect(prompt).toContain('## Angle imposé : Assistante commerciale');
    expect(prompt).toContain('- ID: "x1" | Titre: "Assistante commerciale"');
    expect(prompt).toContain('CATÉGORIES DE COMPÉTENCES, dans cet ordre : Outils de vente, Langages.');
    expect(prompt).toContain('règle de l\'angle');
    expect(prompt).not.toContain('"angle": {');
    // Placé entre l'analyse et les règles.
    expect(prompt.indexOf('## Angle imposé')).toBeGreaterThan(prompt.indexOf('## Étape 0'));
    expect(prompt.indexOf('## Angle imposé')).toBeLessThan(prompt.indexOf('## Règles'));
  });

  it('choix laissé à l\'IA : bibliothèque et analyse.angle dans le schéma', () => {
    const prompt = buildCvPrompt({ ...base, options: { now: NOW, angleChoices: [SOC_ANGLE] } });
    expect(prompt).toContain('## Angle à choisir dans ma bibliothèque');
    expect(prompt).toContain('"angle": { "slug"');
  });

  it('sans angle : ni bloc ni champ analyse.angle', () => {
    const prompt = buildCvPrompt({ ...base, options: { now: NOW } });
    expect(prompt).not.toContain('## Angle');
    expect(buildOutputSchema()).not.toContain('"angle"');
  });
});
