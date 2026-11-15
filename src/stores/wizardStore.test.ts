import { beforeEach, describe, expect, it } from 'bun:test';
import { makeWizardStore, type WizardStorage } from './wizardStore';
import { WIZARD_KEY, initialWizardState, parseWizardState } from '@/lib/wizard/state';

const saved = new Map<string, string>();
let failWrites = false;
let failReads = false;

const storage: WizardStorage = {
  get: async key => {
    if (failReads) throw new Error('base indisponible');
    return saved.get(key) ?? null;
  },
  set: async (key, value) => {
    if (failWrites) throw new Error('écriture refusée');
    saved.set(key, value);
  },
};

const useWizardStore = makeWizardStore(storage);

beforeEach(() => {
  saved.clear();
  failWrites = false;
  failReads = false;
  useWizardStore.setState({ wizard: initialWizardState(), savedRaw: null, loaded: false });
});

describe('wizardStore', () => {
  it('au premier lancement : rien en base, état initial', async () => {
    await useWizardStore.getState().load();
    const s = useWizardStore.getState();
    expect(s.loaded).toBe(true);
    expect(s.savedRaw).toBeNull();
    expect(s.wizard.step).toBe('welcome');
  });

  it('chaque action est enregistrée sous la clé wizard_state', async () => {
    await useWizardStore.getState().complete();
    await useWizardStore.getState().choosePath('linkedin');
    const raw = saved.get(WIZARD_KEY);
    expect(raw).toBeDefined();
    const back = parseWizardState(raw);
    expect(back.step).toBe('start');
    expect(back.startPath).toBe('linkedin');
    expect(back.completed).toEqual(['welcome']);
  });

  it('reprise : un état enregistré est relu au chargement suivant', async () => {
    await useWizardStore.getState().complete();
    await useWizardStore.getState().skip();
    useWizardStore.setState({ wizard: initialWizardState(), savedRaw: null, loaded: false });
    await useWizardStore.getState().load();
    const s = useWizardStore.getState();
    expect(s.savedRaw).not.toBeNull();
    expect(s.wizard.step).toBe('import');
    expect(s.wizard.skipped).toEqual(['start']);
  });

  it('une écriture en échec ne bloque pas la navigation en mémoire', async () => {
    failWrites = true;
    await useWizardStore.getState().next();
    expect(useWizardStore.getState().wizard.step).toBe('start');
    expect(saved.has(WIZARD_KEY)).toBe(false);
  });

  it('une lecture en échec repart de l\'accueil sans planter', async () => {
    failReads = true;
    await useWizardStore.getState().load();
    expect(useWizardStore.getState().wizard.step).toBe('welcome');
    expect(useWizardStore.getState().loaded).toBe(true);
  });

  it('relancer depuis les Paramètres garde le point de départ', async () => {
    await useWizardStore.getState().choosePath('scratch');
    await useWizardStore.getState().finish();
    await useWizardStore.getState().restart();
    const s = useWizardStore.getState().wizard;
    expect(s.step).toBe('welcome');
    expect(s.finished).toBe(false);
    expect(s.startPath).toBe('scratch');
  });
});
