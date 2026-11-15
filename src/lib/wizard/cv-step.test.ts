import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { completeStep, initialWizardState, parseWizardState, restartWizard, serializeWizardState, setWizardCv, WIZARD_KEY } from './state';
import { makeWizardStore, type WizardStorage } from '@/stores/wizardStore';
import { newCvRecord, suggestCvName, validateCvName } from '@/lib/new-cv';
import { missingHelpIds, HELP } from '@/content/help';

describe('CV créé par le guide (cvId)', () => {
  it('absent au départ, mémorisé puis relu à la reprise', () => {
    expect(initialWizardState().cvId).toBeNull();
    const s = setWizardCv({ ...initialWizardState(), step: 'cv' }, 'cv-42');
    const reprise = parseWizardState(serializeWizardState(s));
    expect(reprise.step).toBe('cv');
    expect(reprise.cvId).toBe('cv-42');
  });

  it('valeur inattendue ou vide : oubliée sans erreur', () => {
    expect(parseWizardState({ cvId: 12 }).cvId).toBeNull();
    expect(parseWizardState({ cvId: '  ' }).cvId).toBeNull();
    expect(parseWizardState({}).cvId).toBeNull();
  });

  it('un ancien état sans cvId se relit sans erreur', () => {
    const ancien = JSON.stringify({ version: 1, step: 'cv', startPath: 'cv', completed: ['welcome'], skipped: [], finished: false });
    expect(parseWizardState(ancien)).toMatchObject({ step: 'cv', cvId: null });
  });

  it('relancer le guide repart sans CV ; appliquer la proposition ouvre l\'écran 8', () => {
    const s = setWizardCv({ ...initialWizardState(), step: 'cv' }, 'cv-42');
    expect(restartWizard(s).cvId).toBeNull();
    const fini = completeStep(s);
    expect(fini.completed).toContain('cv');
    expect(fini.step).toBe('export');
    expect(fini.cvId).toBe('cv-42');
  });

  it('le store enregistre le CV sous la clé wizard_state', async () => {
    const saved = new Map<string, string>();
    const storage: WizardStorage = { get: async k => saved.get(k) ?? null, set: async (k, v) => { saved.set(k, v); } };
    const store = makeWizardStore(storage);
    await store.getState().setCv('cv-7');
    expect(parseWizardState(saved.get(WIZARD_KEY)).cvId).toBe('cv-7');
  });
});

describe('création du premier CV', () => {
  it('même enregistrement que « Nouveau CV » : modèle ATS classique, sans réglage', () => {
    expect(newCvRecord('p1', '  CV Assistante commerciale  ')).toEqual({
      profileId: 'p1', name: 'CV Assistante commerciale', templateId: 'ats-classic', targetJob: null, targetCompany: null,
      customSummary: null, settings: {}, isFavorite: false, lastExported: null, markdownContent: null, markdownMode: 0,
    });
  });

  it('nom suggéré à partir de l\'intitulé du profil, nom vide refusé', () => {
    expect(suggestCvName('standard', 'Assistante commerciale')).toContain('Assistante commerciale');
    expect(validateCvName('   ')).toBe('Donnez un nom à votre CV.');
    expect(validateCvName('Mon CV')).toBeNull();
  });

  it('« Nouveau CV » et le guide passent par le même enregistrement', () => {
    const dialog = readFileSync(new URL('../../components/cv-builder/NewCvDialog.tsx', import.meta.url), 'utf8');
    const step = readFileSync(new URL('../../components/wizard/WizardCvStep.tsx', import.meta.url), 'utf8');
    expect(dialog).toContain('createCv(newCvRecord(');
    expect(step).toContain('createCv(newCvRecord(');
    expect(step).toContain('<IntentPanel');
  });
});

describe('aide « ? » de l\'écran 7', () => {
  it('le « ? » renvoie vers la page « Créer un CV standard »', () => {
    const page = readFileSync(new URL('../../components/wizard/WizardPage.tsx', import.meta.url), 'utf8');
    expect(page).toContain("step === 'cv' ? 'cv-standard'");
    expect(missingHelpIds(['cv-standard'])).toEqual([]);
    expect(HELP['cv-standard'].page).toBe('creer-cv-standard');
  });
});
