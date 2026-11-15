import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { NEXT_STEPS, fileNameOf, nextStepRoute, savedMessage } from './export-step';
import { finishWizard, initialWizardState, parseWizardState, restartWizard, serializeWizardState, setWizardCv, wizardProgress } from './state';
import { missingHelpIds, HELP } from '@/content/help';

describe('fichier enregistré', () => {
  it('nom du fichier depuis un chemin Windows ou Unix', () => {
    expect(fileNameOf('C:\\Users\\Camille\\Documents\\cv_assistante.pdf')).toBe('cv_assistante.pdf');
    expect(fileNameOf('/home/camille/cv.docx')).toBe('cv.docx');
  });

  it('message clair, avec le format et le nom du fichier', () => {
    expect(savedMessage('pdf', 'C:\\CV\\cv.pdf')).toBe('Votre CV en PDF est enregistré : cv.pdf.');
    expect(savedMessage('docx', '/tmp/cv.docx')).toBe('Votre CV en Word est enregistré : cv.docx.');
  });
});

describe('fin du guide', () => {
  it('terminer marque le guide fini, valide l\'export, avancement 100 % ; la reprise le sait', () => {
    const avant = { ...setWizardCv(initialWizardState(), 'cv-1'), step: 'export' as const, completed: ['welcome', 'start', 'import', 'verify', 'enrich', 'cv'] as ('welcome' | 'start' | 'import' | 'verify' | 'enrich' | 'cv')[], skipped: ['photo' as const] };
    const fini = finishWizard(avant);
    expect(fini.finished).toBe(true);
    expect(fini.completed).toContain('export');
    expect(wizardProgress(fini)).toBe(100);
    const reprise = parseWizardState(serializeWizardState(fini));
    expect(reprise).toMatchObject({ finished: true, step: 'export', cvId: 'cv-1' });
  });

  it('relancer le guide après la fin repart de l\'accueil', () => {
    const fini = finishWizard({ ...initialWizardState(), step: 'export' });
    expect(restartWizard(fini)).toMatchObject({ step: 'welcome', finished: false });
  });
});

describe('prochaines étapes', () => {
  it('quatre propositions, sans jargon', () => {
    expect(NEXT_STEPS).toHaveLength(4);
    for (const s of NEXT_STEPS) expect(`${s.title} ${s.text}`).not.toMatch(/JSON|LLM|prompt/i);
  });

  it('les étapes liées au CV ouvrent le CV du guide, ou « Mes CV » sans CV', () => {
    const adapter = NEXT_STEPS[0];
    expect(nextStepRoute(adapter, 'cv-1')).toBe('/cv/cv-1?mode=offer');
    expect(nextStepRoute(adapter, null)).toBe('/cv');
    expect(nextStepRoute(NEXT_STEPS[2], null)).toBe('/profile');
  });
});

describe('écran 8 : aide et ouverture du dossier', () => {
  const page = readFileSync(new URL('../../components/wizard/WizardPage.tsx', import.meta.url), 'utf8');
  const step = readFileSync(new URL('../../components/wizard/WizardExportStep.tsx', import.meta.url), 'utf8');

  it('le « ? » renvoie vers la page « Exporter »', () => {
    expect(page).toContain("step === 'export' ? 'export'");
    expect(missingHelpIds(['export'])).toEqual([]);
    expect(HELP.export.page).toBe('exporter');
  });

  it('« Ouvrir le dossier » utilise revealItemInDir (autorisé par opener:default)', () => {
    expect(step).toContain("import { revealItemInDir } from '@tauri-apps/plugin-opener'");
    const capability = readFileSync(new URL('../../../src-tauri/capabilities/default.json', import.meta.url), 'utf8');
    expect(capability).toContain('"opener:default"');
  });
});
