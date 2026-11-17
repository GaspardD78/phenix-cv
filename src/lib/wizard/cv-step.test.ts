import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { completeStep, initialWizardState, parseWizardState, restartWizard, serializeWizardState, setWizardCv, WIZARD_KEY } from './state';
import { makeWizardStore, type WizardStorage } from '@/stores/wizardStore';
import { aiStartTabFromParams, intentToResume, newCvRecord, suggestCvName, validateCvName, wizardAiRoute } from '@/lib/new-cv';
import { DEFAULT_INTENT, readCvIntent, withCvIntent } from '@/lib/cv-intent';
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

describe('guide de démarrage : « Rédiger avec l\'IA » ouvre l\'éditeur sur le parcours IA', () => {
  const intent = { ...DEFAULT_INTENT, role: 'Assistante commerciale', sector: 'Négoce de matériaux', assertiveness: 'affirme' as const };

  it('adresse de l\'éditeur, onglet IA, réponses enregistrées reprises telles quelles', () => {
    // 1. Les réponses sont enregistrées dans le CV avant de quitter le guide.
    const settings = withCvIntent({}, intent);
    // 2. Le guide ouvre l'éditeur du CV sur le parcours IA.
    const route = wizardAiRoute('cv-42');
    expect(route.startsWith('/cv/cv-42?')).toBe(true);
    const params = new URL(route, 'http://local').searchParams;
    // 3. L'éditeur ouvre le panneau sur le parcours IA du CV standard.
    const tab = aiStartTabFromParams(params);
    expect(tab).toBe('intent-ai');
    // 4. Le panneau reprend les réponses enregistrées.
    expect(intentToResume(tab, settings)).toEqual(readCvIntent(settings));
    expect(intentToResume(tab, settings)?.role).toBe('Assistante commerciale');
    expect(intentToResume(tab, settings)?.assertiveness).toBe('affirme');
  });

  it('sans réponse enregistrée, ou hors parcours IA : rien n\'est repris', () => {
    expect(intentToResume('intent-ai', {})).toBeNull();
    expect(intentToResume('intent-ai', withCvIntent({}, { ...intent, role: '  ' }))).toBeNull();
    expect(intentToResume('intent', withCvIntent({}, intent))).toBeNull();
    expect(aiStartTabFromParams(new URLSearchParams('mode=standard'))).toBe('intent');
    expect(aiStartTabFromParams(new URLSearchParams('mode=offer&ia=1'))).toBe('full');
  });

  it('branchements : le guide, l\'éditeur et le panneau utilisent ces fonctions', () => {
    const read = (p: string) => readFileSync(new URL(`../../components/${p}`, import.meta.url), 'utf8');
    expect(read('wizard/WizardCvStep.tsx')).toContain('navigate(wizardAiRoute(cvId))');
    expect(read('cv-builder/CVBuilderPage.tsx')).toContain('aiStartTabFromParams(searchParams)');
    expect(read('cv-builder/AIPromptPanel.tsx')).toContain('intentToResume(initialTab, currentCv.settings)');
    // Les réponses sont enregistrées AVANT de passer la main au parcours IA.
    const panel = read('cv-builder/IntentPanel.tsx');
    expect(panel).toMatch(/await saveIntent\(\);\s*onUseAi\(intent\);/);
  });
});
