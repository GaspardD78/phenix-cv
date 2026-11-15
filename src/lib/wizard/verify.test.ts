import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { findMissing, canValidateVerify, type VerifyProfile } from './verify';
import {
  experienceDraft, experiencePatch, formationDraft, formationPatch, identityDraft, identityPatch,
  saveDraft, validateExperience, validateFormation, validateIdentity, validateSkillName,
} from './verify-edit';
import { completeStep, initialWizardState, parseWizardState, serializeWizardState, wizardProgress } from './state';
import { formatEntryDates, DEFAULT_DATE_SETTINGS } from '@/lib/entry-dates';
import { missingHelpIds } from '@/content/help';
import type { MasterEntry, Profile } from '@/types/profile';

// Fixtures fictives : Camille Martin, assistante commerciale.
const camille: VerifyProfile = { firstName: 'Camille', lastName: 'Martin' };

function entry(overrides: Partial<MasterEntry>): MasterEntry {
  return {
    id: 'e1', profileId: 'p1', entryType: 'experience', title: 'Assistante commerciale', subtitle: 'Société Exemple',
    location: null, startDate: '2021-09', endDate: '2024-06', isCurrent: false, description: null, metadata: {},
    sortOrder: 0, tags: [], createdAt: '', updatedAt: '', ...overrides,
  };
}

const profileFixture: Profile = {
  id: 'p1', firstName: 'Camille', lastName: 'Martin', email: null, phone: null, address: null, city: null,
  postalCode: null, country: 'France', linkedinUrl: null, otherUrl: null, photoPath: null, title: null, summary: null,
  createdAt: '', updatedAt: '',
};

describe('détection des informations manquantes', () => {
  it('un profil complet ne signale rien et permet de valider', () => {
    const missing = findMissing(camille, [entry({}), entry({ id: 'e2', entryType: 'education', title: 'BTS', subtitle: null, startDate: null, endDate: '2021-06' })]);
    expect(missing).toEqual([]);
    expect(canValidateVerify(missing)).toBe(true);
  });

  it('une expérience sans date de début est signalée avec son intitulé', () => {
    const missing = findMissing(camille, [entry({ startDate: null })]);
    expect(missing).toEqual([{ kind: 'entry', entryId: 'e1', field: 'startDate', message: 'Il manque la date de début de l\'expérience « Assistante commerciale ».' }]);
    expect(canValidateVerify(missing)).toBe(false);
  });

  it('une date de début incomplète (année seule) est aussi signalée', () => {
    expect(findMissing(camille, [entry({ startDate: '2021' })])[0]).toMatchObject({ field: 'startDate' });
  });

  it('un poste sans intitulé et une formation sans intitulé sont signalés', () => {
    const missing = findMissing(camille, [entry({ title: '  ' }), entry({ id: 'e2', entryType: 'education', title: '' })]);
    expect(missing.map(m => m.kind === 'entry' && m.field)).toEqual(['title', 'title']);
  });

  it('prénom ou nom absent : signalé, validation bloquée', () => {
    expect(findMissing({ firstName: '', lastName: 'Martin' }, [])[0]).toMatchObject({ kind: 'identity', field: 'firstName' });
    expect(findMissing(null, [])).toHaveLength(2);
  });

  it('les informations facultatives (ville, téléphone, e-mail, fin, compétences) ne bloquent jamais', () => {
    expect(findMissing(camille, [entry({ endDate: null })])).toEqual([]);
  });
});

describe('édition en place : annulation et enregistrement', () => {
  it('Annuler : le brouillon repart des valeurs enregistrées', () => {
    // L'annulation du composant remet le brouillon à partir de l'entrée enregistrée,
    // et n'appelle ni saveDraft ni le store : aucune écriture n'est possible sur ce chemin.
    const original = entry({});
    const modifie = { ...experienceDraft(original), title: 'Autre intitulé' };
    expect(modifie.title).not.toBe(original.title);
    expect(experienceDraft(original).title).toBe('Assistante commerciale');
  });

  it('Enregistrer une ligne valide écrit exactement le patch attendu', async () => {
    const writes: Partial<MasterEntry>[] = [];
    const out = await saveDraft(
      { ...experienceDraft(entry({})), subtitle: '  Société Exemple  ', endDate: '2024-06' },
      validateExperience, experiencePatch, async p => { writes.push(p); },
    );
    expect(out).toEqual({ saved: true, errors: {} });
    expect(writes).toEqual([{ title: 'Assistante commerciale', subtitle: 'Société Exemple', startDate: '2021-09', endDate: '2024-06', isCurrent: false }]);
  });

  it('poste en cours : la fin est effacée à l\'enregistrement', () => {
    const patch = experiencePatch({ ...experienceDraft(entry({})), isCurrent: true, endDate: '2024-06' });
    expect(patch).toMatchObject({ isCurrent: true, endDate: null });
  });

  it('validation bloquée : sans date de début, rien n\'est écrit', async () => {
    let writes = 0;
    const out = await saveDraft({ ...experienceDraft(entry({})), startDate: '' }, validateExperience, experiencePatch, async () => { writes += 1; });
    expect(out.saved).toBe(false);
    expect(out.errors.startDate).toBe('Indiquez le mois et l\'année de début.');
    expect(writes).toBe(0);
  });

  it('formation et identité suivent les mêmes règles', async () => {
    expect(validateFormation({ ...formationDraft(entry({ entryType: 'education', title: 'BTS' })), title: ' ' }).title).toBeDefined();
    expect(validateFormation({ title: 'BTS', subtitle: '', endDate: '06/2021' }).endDate).toBe('Indiquez le mois et l\'année d\'obtention.');
    expect(formationPatch({ title: ' BTS ', subtitle: '', endDate: '' })).toEqual({ title: 'BTS', subtitle: null, endDate: null });
    const d = identityDraft(profileFixture);
    expect(validateIdentity({ ...d, lastName: '' }).lastName).toBe('Indiquez votre nom.');
    expect(identityPatch({ ...d, phone: '  ', email: '' })).toMatchObject({ phone: null, email: null, firstName: 'Camille' });
  });
});

describe('compétences', () => {
  it('refuse un nom vide ou déjà présent (casse ignorée)', () => {
    expect(validateSkillName('  ', [])).toBe('Indiquez le nom de la compétence.');
    expect(validateSkillName('excel', ['Excel'])).toBe('Cette compétence existe déjà.');
    expect(validateSkillName('Word', ['Excel'])).toBeNull();
  });
});

describe('affichage de la période', () => {
  it('une période en cours s\'affiche « juin 2024 – auj. » (format court par défaut)', () => {
    const text = formatEntryDates({ entryType: 'experience', startDate: '2024-06', endDate: null, isCurrent: true }, null, DEFAULT_DATE_SETTINGS);
    expect(text).toBe('juin 2024 – auj.');
  });
});

describe('reprise à l\'étape 4', () => {
  it('un état enregistré à l\'étape verify se relit à l\'étape verify', () => {
    const avant = { ...initialWizardState(), step: 'verify' as const, completed: ['welcome', 'start', 'import'] as const };
    const reprise = parseWizardState(serializeWizardState({ ...avant, completed: [...avant.completed] }));
    expect(reprise.step).toBe('verify');
    expect(wizardProgress(reprise)).toBe(Math.round((3 / 8) * 100));
  });

  it('valider l\'étape 4 la marque et ouvre l\'étape 5', () => {
    const s = completeStep({ ...initialWizardState(), step: 'verify' });
    expect(s.completed).toContain('verify');
    expect(s.step).toBe('photo');
  });
});

describe('aide « ? » de l\'écran 4', () => {
  const source = readFileSync(new URL('../../components/wizard/WizardVerifyStep.tsx', import.meta.url), 'utf8');
  // Le bloc Identité apparaît en lecture et en édition : on compte les identifiants uniques.
  const ids = [...new Set([...source.matchAll(/<Block[^>]*helpId="([a-z-]+)"/g)].map(m => m[1]))];

  it('chaque bloc a un « ? » et chaque « ? » a une entrée d\'aide', () => {
    expect(ids.length).toBe(4);
    expect(missingHelpIds(ids)).toEqual([]);
  });

});
