import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { isProfileEmpty, shouldAutoOpenWizard, wizardStatus } from './auto-open';
import { WIZARD_KEY, initialWizardState, parseWizardState, serializeWizardState, wizardProgress } from './state';
import { makeWizardStore, type WizardStorage } from '@/stores/wizardStore';
import { SETTINGS_TREE, resolveSettingsPage } from '@/components/settings/settings-tree';
import type { MasterEntry } from '@/types/profile';

const vide = { firstName: '', lastName: '' };
const camille = { firstName: 'Camille', lastName: 'Martin' };
const uneEntree = [{ id: 'e1' } as MasterEntry];

describe('ouverture automatique au premier lancement', () => {
  it('profil vide : ni nom, ni entrée', () => {
    expect(isProfileEmpty(vide, [])).toBe(true);
    expect(isProfileEmpty(null, [])).toBe(true);
    expect(isProfileEmpty(camille, [])).toBe(false);
    expect(isProfileEmpty(vide, uneEntree)).toBe(false);
  });

  it('s\'ouvre depuis l\'accueil, sans état enregistré, profil vide', () => {
    expect(shouldAutoOpenWizard('/', null, vide, [])).toBe(true);
  });

  it('ne s\'ouvre pas ailleurs, ni après un premier passage, ni avec un profil rempli', () => {
    expect(shouldAutoOpenWizard('/profile', null, vide, [])).toBe(false);
    expect(shouldAutoOpenWizard('/', serializeWizardState(initialWizardState()), vide, [])).toBe(false);
    expect(shouldAutoOpenWizard('/', null, camille, [])).toBe(false);
  });

  it('le composant enregistre l\'état avant d\'ouvrir : une seule ouverture automatique', () => {
    const source = readFileSync(new URL('../../components/wizard/WizardAutoOpen.tsx', import.meta.url), 'utf8');
    expect(source.indexOf('update(s => s)')).toBeGreaterThan(-1);
    expect(source.indexOf('update(s => s)')).toBeLessThan(source.indexOf("navigate('/bienvenue')"));
  });
});

describe('Paramètres › Aide › Guide de démarrage', () => {
  it('la page existe dans la rubrique « Aide »', () => {
    const aide = SETTINGS_TREE.find(g => g.label === 'Aide');
    expect(aide?.pages.map(p => p.id)).toEqual(['guide']);
    expect(resolveSettingsPage('guide')).toBe('guide');
  });

  it('état affiché : jamais suivi, en cours, terminé', () => {
    expect(wizardStatus(null, false)).toBe('jamais');
    expect(wizardStatus('{"step":"verify"}', false)).toBe('en-cours');
    expect(wizardStatus('{"finished":true}', true)).toBe('termine');
  });
});

describe('parcours complet du guide (store et enregistrement)', () => {
  it('de l\'accueil à la fin, puis relance depuis les Paramètres', async () => {
    const saved = new Map<string, string>();
    const storage: WizardStorage = { get: async k => saved.get(k) ?? null, set: async (k, v) => { saved.set(k, v); } };
    const store = makeWizardStore(storage);
    const s = () => store.getState();

    await s().load();
    expect(s().wizard.step).toBe('welcome');
    await s().complete();                 // 1 → 2
    await s().choosePath('scratch');
    await s().complete();                 // 2 → 3
    await s().complete();                 // 3 → 4
    await s().complete();                 // 4 → 5
    await s().skip();                     // 5 (photo passée) → 6
    await s().complete();                 // 6 → 7
    await s().setCv('cv-1');
    await s().complete();                 // 7 → 8
    expect(s().wizard.step).toBe('export');

    // Reprise : un nouveau chargement retrouve l'écran 8 et le CV.
    const reprise = makeWizardStore(storage);
    await reprise.getState().load();
    expect(reprise.getState().wizard).toMatchObject({ step: 'export', cvId: 'cv-1', startPath: 'scratch' });

    await s().finish();
    const fin = parseWizardState(saved.get(WIZARD_KEY));
    expect(fin.finished).toBe(true);
    expect(fin.skipped).toEqual(['photo']);
    expect(wizardProgress(fin)).toBe(100);

    await s().restart();
    expect(parseWizardState(saved.get(WIZARD_KEY))).toMatchObject({ step: 'welcome', finished: false, cvId: null, startPath: 'scratch' });
  });
});
