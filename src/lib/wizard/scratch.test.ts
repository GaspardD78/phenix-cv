import { describe, expect, it } from 'bun:test';
import { EMPTY_SCRATCH_FORM, buildScratchResult, validateScratch, type ScratchForm } from './scratch';

const camille: ScratchForm = {
  firstName: 'Camille', lastName: 'Martin', headline: 'Assistante commerciale',
  expTitle: 'Assistante commerciale', expCompany: 'Société Exemple', expStart: '2021-09', expEnd: '2024-06', expCurrent: false,
  eduTitle: 'BTS Support à l\'action managériale', eduSchool: 'Lycée Exemple', eduEnd: '2021-06',
};

describe('validateScratch', () => {
  it('la saisie complète de Camille Martin est valable', () => {
    expect(validateScratch(camille)).toEqual({});
  });

  it('une saisie vide signale les cinq champs obligatoires', () => {
    const e = validateScratch(EMPTY_SCRATCH_FORM);
    expect(Object.keys(e).sort()).toEqual(['eduTitle', 'expStart', 'expTitle', 'firstName', 'lastName']);
  });

  it('une date de début mal formée est refusée', () => {
    expect(validateScratch({ ...camille, expStart: '09/2021' }).expStart).toBeDefined();
    expect(validateScratch({ ...camille, expStart: '2021-13' }).expStart).toBeDefined();
  });

  it('une fin antérieure au début est refusée ; un poste en cours ignore la fin', () => {
    expect(validateScratch({ ...camille, expEnd: '2020-01' }).expEnd).toBe('La fin doit être après le début.');
    expect(validateScratch({ ...camille, expCurrent: true, expEnd: '2020-01' })).toEqual({});
  });

  it('la fin et l\'année de formation restent facultatives', () => {
    expect(validateScratch({ ...camille, expEnd: '', eduEnd: '' })).toEqual({});
  });
});

describe('buildScratchResult', () => {
  it('produit les champs du profil et deux entrées : une expérience et une formation', () => {
    const r = buildScratchResult(camille, 'p1');
    expect(r.profile).toEqual({ firstName: 'Camille', lastName: 'Martin', title: 'Assistante commerciale' });
    expect(r.entries.map(e => e.entryType)).toEqual(['experience', 'education']);
    expect(r.entries.every(e => e.profileId === 'p1')).toBe(true);
    expect(r.entries[0]).toMatchObject({ title: 'Assistante commerciale', subtitle: 'Société Exemple', startDate: '2021-09', endDate: '2024-06', isCurrent: false });
    expect(r.entries[1]).toMatchObject({ title: 'BTS Support à l\'action managériale', subtitle: 'Lycée Exemple', endDate: '2021-06' });
  });

  it('un poste en cours n\'a pas de date de fin ; les champs vides deviennent null', () => {
    const r = buildScratchResult({ ...camille, expCurrent: true, headline: '  ', expCompany: '', eduEnd: '' }, 'p1');
    expect(r.profile.title).toBeNull();
    expect(r.entries[0]).toMatchObject({ endDate: null, isCurrent: true, subtitle: null });
    expect(r.entries[1].endDate).toBeNull();
  });
});

import { joinMonth, splitMonth } from './scratch';

describe('conversion mois et année', () => {
  it('assemble un mois et une année en AAAA-MM', () => {
    expect(joinMonth('09', '2021')).toBe('2021-09');
    expect(joinMonth('12', ' 2019 ')).toBe('2019-12');
  });

  it('rend vide tant que le mois ou l\'année manque, ou si l\'année est incomplète', () => {
    expect(joinMonth('', '2021')).toBe('');
    expect(joinMonth('09', '')).toBe('');
    expect(joinMonth('09', '21')).toBe('');
    expect(joinMonth('13', '2021')).toBe('');
  });

  it('découpe AAAA-MM pour l\'affichage, et aller-retour sans perte', () => {
    expect(splitMonth('2021-09')).toEqual({ month: '09', year: '2021' });
    expect(splitMonth(joinMonth('06', '2024'))).toEqual({ month: '06', year: '2024' });
    expect(splitMonth('')).toEqual({ month: '', year: '' });
    expect(splitMonth('09/2021')).toEqual({ month: '', year: '' });
  });
});

import { REQUIRED_SCRATCH_FIELDS, canSave } from './scratch';

describe('garde d\'enregistrement', () => {
  it('une expérience sans date de début n\'est pas enregistrée', () => {
    const sansDebut = { ...camille, expStart: '' };
    expect(canSave(sansDebut)).toBe(false);
    expect(validateScratch(sansDebut).expStart).toBeDefined();
  });

  it('une date de début incomplète (année seule) n\'est pas enregistrée', () => {
    expect(canSave({ ...camille, expStart: '2021' })).toBe(false);
  });

  it('la saisie complète peut être enregistrée', () => {
    expect(canSave(camille)).toBe(true);
  });

  it('l\'astérisque suit les règles : Début obligatoire, Fin et Obtenu en facultatives', () => {
    expect(REQUIRED_SCRATCH_FIELDS).toContain('expStart');
    expect(REQUIRED_SCRATCH_FIELDS).not.toContain('expEnd');
    expect(REQUIRED_SCRATCH_FIELDS).not.toContain('eduEnd');
  });
});

describe('messages d\'erreur lisibles', () => {
  it('aucun message ne montre de format technique (AAAA-MM, AAAA, 2021-09)', () => {
    const cases: ScratchForm[] = [
      { ...camille, expStart: '' },
      { ...camille, expStart: '2021' },
      { ...camille, expEnd: '2024-13' },
      { ...camille, eduEnd: '06/2019' },
      { ...EMPTY_SCRATCH_FORM },
    ];
    for (const form of cases) {
      for (const message of Object.values(validateScratch(form))) {
        expect(message).not.toMatch(/AAAA|\d{4}-\d{2}|Format attendu/);
      }
    }
  });

  it('les messages de date disent « mois et année »', () => {
    expect(validateScratch({ ...camille, expStart: '' }).expStart).toBe('Indiquez le mois et l\'année de début.');
    expect(validateScratch({ ...camille, expEnd: '2024-13' }).expEnd).toBe('Indiquez le mois et l\'année de fin.');
    expect(validateScratch({ ...camille, eduEnd: '06/2019' }).eduEnd).toBe('Indiquez le mois et l\'année d\'obtention.');
  });
});
