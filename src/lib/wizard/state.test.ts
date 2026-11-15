import { describe, expect, it } from 'bun:test';
import {
  WIZARD_STEPS, chooseStartPath, completeStep, finishWizard, goToStep, initialWizardState, nextStep, parseWizardState,
  previousStep, restartWizard, serializeWizardState, shouldOpenAutomatically, skipStep, wizardProgress,
} from './state';

describe('lecture et écriture de l\'état', () => {
  it('une sauvegarde complète se relit à l\'identique', () => {
    let s = completeStep(initialWizardState());
    s = chooseStartPath(s, 'scratch');
    s = skipStep(s, 'photo');
    const back = parseWizardState(serializeWizardState(s));
    expect(back).toEqual({ ...s, version: 1 });
  });

  it('JSON invalide, valeur absente ou tableau : état initial', () => {
    expect(parseWizardState('pas du json')).toEqual(initialWizardState());
    expect(parseWizardState(null)).toEqual(initialWizardState());
    expect(parseWizardState([1, 2])).toEqual(initialWizardState());
  });

  it('étape ou point de départ inconnus : corrigés sans erreur', () => {
    const s = parseWizardState({ step: 'nimporte', startPath: 'fusee', completed: ['welcome', 'bidule', 'welcome'], finished: 'oui' });
    expect(s.step).toBe('welcome');
    expect(s.startPath).toBeNull();
    expect(s.completed).toEqual(['welcome']);
    expect(s.finished).toBe(false);
  });
});

describe('navigation', () => {
  it('les étapes se suivent dans l\'ordre et s\'arrêtent aux extrémités', () => {
    expect(nextStep('welcome')).toBe('start');
    expect(nextStep('export')).toBe('export');
    expect(previousStep('welcome')).toBe('welcome');
    expect(previousStep('verify')).toBe('import');
  });

  it('valider une étape la marque et avance ; passer ne la valide pas', () => {
    const v = completeStep(initialWizardState());
    expect(v.completed).toEqual(['welcome']);
    expect(v.step).toBe('start');
    const p = skipStep(v);
    expect(p.skipped).toEqual(['start']);
    expect(p.completed).toEqual(['welcome']);
    expect(p.step).toBe('import');
  });

  it('valider deux fois la même étape ne la duplique pas', () => {
    const s = completeStep(completeStep(initialWizardState(), 'welcome'), 'welcome');
    expect(s.completed).toEqual(['welcome']);
  });

  it('revenir à une étape la laisse à sa place dans la liste', () => {
    const s = goToStep(completeStep(initialWizardState()), 'welcome');
    expect(s.step).toBe('welcome');
    expect(s.completed).toEqual(['welcome']);
  });
});

describe('reprise et relance', () => {
  it('on quitte à l\'étape 4 : la reprise rouvre l\'étape 4, avec l\'avancement', () => {
    let s = initialWizardState();
    s = completeStep(s); s = chooseStartPath(s, 'cv'); s = completeStep(s); s = completeStep(s);
    expect(s.step).toBe('verify');
    const reprise = parseWizardState(serializeWizardState(s));
    expect(reprise.step).toBe('verify');
    expect(reprise.startPath).toBe('cv');
    expect(wizardProgress(reprise)).toBe(Math.round((3 / WIZARD_STEPS.length) * 100));
  });

  it('terminer le guide le marque fini et valide l\'export', () => {
    const s = finishWizard(goToStep(initialWizardState(), 'export'));
    expect(s.finished).toBe(true);
    expect(s.completed).toContain('export');
  });

  it('relancer depuis les Paramètres repart de l\'accueil, garde le point de départ', () => {
    const fini = finishWizard(chooseStartPath(goToStep(initialWizardState(), 'export'), 'linkedin'));
    const relance = restartWizard(fini);
    expect(relance.step).toBe('welcome');
    expect(relance.finished).toBe(false);
    expect(relance.completed).toEqual([]);
    expect(relance.startPath).toBe('linkedin');
  });
});

describe('progression et ouverture automatique', () => {
  it('avancement : 0 au départ, 100 % quand toutes les étapes sont vues', () => {
    expect(wizardProgress(initialWizardState())).toBe(0);
    const all = { ...initialWizardState(), completed: [...WIZARD_STEPS] };
    expect(wizardProgress(all)).toBe(100);
  });

  it('s\'ouvre seul au premier lancement avec un profil vide, jamais ensuite', () => {
    expect(shouldOpenAutomatically(null, true)).toBe(true);
    expect(shouldOpenAutomatically(null, false)).toBe(false);
    expect(shouldOpenAutomatically(serializeWizardState(initialWizardState()), true)).toBe(false);
  });
});
