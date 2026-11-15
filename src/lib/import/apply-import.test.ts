import { describe, expect, it } from 'bun:test';
import { applyImport, type ApplyImportDeps } from './apply-import';

function fakeDeps(profileId = 'p1') {
  const calls: { updates: unknown[]; entries: { profileId: string; title: string }[]; fetched: number } = { updates: [], entries: [], fetched: 0 };
  const deps: ApplyImportDeps = {
    updateProfile: async u => { calls.updates.push(u); },
    addEntry: async e => { calls.entries.push({ profileId: e.profileId, title: e.title }); },
    fetchProfile: async () => { calls.fetched += 1; },
    getProfileId: () => profileId,
  };
  return { deps, calls };
}

const diffs = [
  { key: 'firstName', label: 'Prénom', existing: '', imported: 'Camille', useImported: true },
  { key: 'city', label: 'Ville', existing: '', imported: 'Lyon', useImported: false },
] as never;

const entry = (title: string, selected: boolean) => ({
  selected,
  data: { entryType: 'experience', title, subtitle: null, location: null, startDate: '2020-01', endDate: null, isCurrent: true, description: null, tags: [] },
}) as never;

describe('applyImport', () => {
  it('n\'enregistre que les champs cochés et les entrées sélectionnées', async () => {
    const { deps, calls } = fakeDeps();
    const r = await applyImport(diffs, [entry('Assistante commerciale', true), entry('Stage', false)], deps);
    expect(calls.updates).toEqual([{ firstName: 'Camille' }]);
    expect(calls.entries.map(e => e.title)).toEqual(['Assistante commerciale']);
    expect(r).toEqual({ profileCount: 1, entryCount: 1 });
    expect(calls.fetched).toBe(1);
  });

  it('rattache les entrées au profil lu au moment de l\'enregistrement', async () => {
    const { deps, calls } = fakeDeps('profil-42');
    await applyImport([] as never, [entry('Poste', true)], deps);
    expect(calls.entries[0].profileId).toBe('profil-42');
    expect(calls.updates).toEqual([]);
  });

  it('sans rien de coché : aucune écriture de profil', async () => {
    const { deps, calls } = fakeDeps();
    const r = await applyImport([] as never, [], deps);
    expect(r).toEqual({ profileCount: 0, entryCount: 0 });
    expect(calls.updates).toEqual([]);
    expect(calls.fetched).toBe(1);
  });
});
