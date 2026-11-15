import { create } from 'zustand';
import { getSetting, setSetting } from '@/lib/db';
import {
  WIZARD_KEY, chooseStartPath, completeStep, finishWizard, goToStep, initialWizardState, nextStep, parseWizardState,
  previousStep, restartWizard, serializeWizardState, skipStep, type StartPath, type WizardState, type WizardStep,
} from '@/lib/wizard/state';

interface WizardStoreState {
  wizard: WizardState;
  /** Valeur brute lue en base au chargement (null : jamais lancé). */
  savedRaw: string | null;
  loaded: boolean;
  load: () => Promise<void>;
  /** Applique une transformation puis enregistre. Un échec d'écriture ne bloque pas l'écran. */
  update: (fn: (s: WizardState) => WizardState) => Promise<void>;
  goTo: (step: WizardStep) => Promise<void>;
  next: () => Promise<void>;
  back: () => Promise<void>;
  complete: () => Promise<void>;
  skip: () => Promise<void>;
  choosePath: (path: StartPath) => Promise<void>;
  finish: () => Promise<void>;
  restart: () => Promise<void>;
}

/** Accès au stockage, injecté pour pouvoir tester sans base. */
export interface WizardStorage {
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string) => Promise<void>;
}

export const dbWizardStorage: WizardStorage = { get: getSetting, set: setSetting };

export function makeWizardStore(storage: WizardStorage) {
  return create<WizardStoreState>((set, get) => {
  const apply = async (wizard: WizardState) => {
    set({ wizard });
    try {
      await storage.set(WIZARD_KEY, serializeWizardState(wizard));
    } catch {
      // Enregistrement impossible : l'état reste en mémoire pour la session.
    }
  };

  return {
    wizard: initialWizardState(),
    savedRaw: null,
    loaded: false,

    load: async () => {
      let raw: string | null = null;
      try {
        raw = await storage.get(WIZARD_KEY);
      } catch {
        raw = null;
      }
      set({ savedRaw: raw, wizard: parseWizardState(raw), loaded: true });
    },

    update: (fn) => apply(fn(get().wizard)),
    goTo: (step) => apply(goToStep(get().wizard, step)),
    next: () => apply(goToStep(get().wizard, nextStep(get().wizard.step))),
    back: () => apply(goToStep(get().wizard, previousStep(get().wizard.step))),
    complete: () => apply(completeStep(get().wizard)),
    skip: () => apply(skipStep(get().wizard)),
    choosePath: (path) => apply(chooseStartPath(get().wizard, path)),
    finish: () => apply(finishWizard(get().wizard)),
    restart: () => apply(restartWizard(get().wizard)),
  };
});
}

export const useWizardStore = makeWizardStore(dbWizardStorage);
