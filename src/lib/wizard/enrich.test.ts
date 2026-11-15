import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { MIN_SKILLS, completeness, enrichItems, experiencesWithoutMissions, validateContact, validateLanguage, validateText } from './enrich';
import { completeStep, initialWizardState, parseWizardState, serializeWizardState } from './state';
import { missingHelpIds } from '@/content/help';
import type { MasterEntry } from '@/types/profile';

// Fixtures fictives : Camille Martin, assistante commerciale.
function entry(overrides: Partial<MasterEntry>): MasterEntry {
  return {
    id: 'e1', profileId: 'p1', entryType: 'experience', title: 'Assistante commerciale', subtitle: 'Société Exemple',
    location: null, startDate: '2021-09', endDate: '2024-06', isCurrent: false, description: null, metadata: {},
    sortOrder: 0, tags: [], createdAt: '', updatedAt: '', ...overrides,
  };
}
const vide = { summary: null, title: null, email: null, phone: null, city: null };
const complet = { summary: 'Assistante commerciale depuis cinq ans.', title: 'Assistante commerciale', email: 'camille.martin@example.com', phone: null, city: 'Lyon' };
const skill = (id: string, title: string) => entry({ id, entryType: 'skill', title, startDate: null, endDate: null });

describe('complétude du profil', () => {
  it('profil minimal (saisie guidée) : tout reste à faire', () => {
    const items = enrichItems(vide, [entry({})]);
    expect(items.map(i => i.id)).toEqual(['summary', 'title', 'contact', 'city', 'missions', 'skills', 'languages']);
    expect(items.every(i => !i.done)).toBe(true);
    expect(completeness(items)).toBe(0);
  });

  it('profil complet : 100 %', () => {
    const entries = [
      entry({ description: 'Suivi des commandes clients.' }),
      skill('s1', 'Excel'), skill('s2', 'Relation client'), skill('s3', 'Facturation'),
      entry({ id: 'l1', entryType: 'language', title: 'Anglais', subtitle: 'B2', startDate: null, endDate: null }),
    ];
    expect(completeness(enrichItems(complet, entries))).toBe(100);
  });

  it(`les compétences comptent à partir de ${MIN_SKILLS}`, () => {
    const deux = enrichItems(complet, [skill('s1', 'Excel'), skill('s2', 'Word')]);
    expect(deux.find(i => i.id === 'skills')?.done).toBe(false);
  });

  it('un seul moyen de contact suffit', () => {
    expect(enrichItems({ ...vide, phone: '06 00 00 00 00' }, []).find(i => i.id === 'contact')?.done).toBe(true);
  });

  it('missions : chaque poste sans description est relancé', () => {
    const entries = [entry({ id: 'a', description: 'Accueil clients.' }), entry({ id: 'b', description: '  ' })];
    expect(experiencesWithoutMissions(entries).map(e => e.id)).toEqual(['b']);
    expect(enrichItems(complet, entries).find(i => i.id === 'missions')?.done).toBe(false);
  });

  it('pourcentage arrondi', () => {
    const items = enrichItems({ ...vide, summary: 'x', title: 'y' }, []);
    expect(completeness(items)).toBe(Math.round((2 / 7) * 100));
  });
});

describe('validation des relances', () => {
  it('contact : au moins un moyen, e-mail au bon format', () => {
    expect(validateContact('', '')).toBe('Indiquez au moins un e-mail ou un téléphone.');
    expect(validateContact('camille.martin', '')).toBe('Cette adresse e-mail ne semble pas complète.');
    expect(validateContact('', '06 00 00 00 00')).toBeNull();
    expect(validateContact('camille.martin@example.com', '')).toBeNull();
  });

  it('langue : non vide et sans doublon', () => {
    expect(validateLanguage(' ', [])).toBe('Indiquez la langue.');
    expect(validateLanguage('anglais', ['Anglais'])).toBe('Cette langue est déjà dans votre profil.');
    expect(validateLanguage('Espagnol', ['Anglais'])).toBeNull();
  });

  it('texte libre : refusé s\'il est vide', () => {
    expect(validateText('   ', 'Écrivez quelques mots.')).toBe('Écrivez quelques mots.');
    expect(validateText('Accueil', 'x')).toBeNull();
  });
});

describe('navigation de l\'écran 6', () => {
  it('reprise : un état enregistré à l\'étape enrich rouvre l\'écran 6', () => {
    const saved = serializeWizardState({ ...initialWizardState(), step: 'enrich', completed: ['welcome', 'start', 'import', 'verify', 'photo'] });
    expect(parseWizardState(saved).step).toBe('enrich');
  });

  it('continuer valide l\'étape et ouvre l\'écran 7, même profil incomplet', () => {
    const s = completeStep({ ...initialWizardState(), step: 'enrich' });
    expect(s.completed).toContain('enrich');
    expect(s.step).toBe('cv');
  });
});

describe('aide « ? » de l\'écran 6', () => {
  it('chaque « ? » de l\'écran a une entrée d\'aide', () => {
    const page = readFileSync(new URL('../../components/wizard/WizardPage.tsx', import.meta.url), 'utf8');
    const step = readFileSync(new URL('../../components/wizard/WizardEnrichStep.tsx', import.meta.url), 'utf8');
    expect(page).toContain("step === 'enrich' ? 'enrichir'");
    const ids = [...step.matchAll(/<HelpButton\s+id="([a-z-]+)"/g)].map(m => m[1]);
    expect(ids).toEqual(['enrichir-ia']);
    expect(missingHelpIds(['enrichir', ...ids])).toEqual([]);
  });
});

import { VISIBLE_RELANCES, visibleRelances } from './enrich';

describe('relances affichées', () => {
  it('trois relances d\'abord, les autres derrière « Voir les autres »', () => {
    const todo = ['a', 'b', 'c', 'd', 'e'];
    expect(VISIBLE_RELANCES).toBe(3);
    expect(visibleRelances(todo, false)).toEqual({ shown: ['a', 'b', 'c'], hidden: 2 });
  });

  it('« Voir les autres » affiche tout', () => {
    expect(visibleRelances(['a', 'b', 'c', 'd'], true)).toEqual({ shown: ['a', 'b', 'c', 'd'], hidden: 0 });
  });

  it('trois relances ou moins : pas de lien', () => {
    expect(visibleRelances(['a', 'b', 'c'], false)).toEqual({ shown: ['a', 'b', 'c'], hidden: 0 });
  });
});
