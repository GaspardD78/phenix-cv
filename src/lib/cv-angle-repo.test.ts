import { describe, expect, it } from 'bun:test';
import { AngleLimitError, createAngleRepo } from './cv-angle-repo';
import { DEFAULT_ANGLES, MAX_ANGLES_PER_PROFILE } from './cv-angles';
import { makeFakeAngleDb } from './test-helpers/fake-angle-db';

const fields = (label: string) => ({ ...DEFAULT_ANGLES[0], slug: undefined, label });

describe('createAngleRepo', () => {
  it('angles de départ créés une seule fois, seulement si la bibliothèque est vide', async () => {
    const db = makeFakeAngleDb();
    const repo = createAngleRepo(async () => db);
    const first = await repo.listWithDefaults('p1');
    expect(first.map(a => a.slug)).toEqual(['expertise', 'polyvalence', 'reconversion', 'management', 'debutant']);
    await repo.update(first[0].id, { label: 'Mon libellé' });
    const again = await repo.listWithDefaults('p1');
    expect(db.inserts).toBe(5);
    expect(again[0].label).toBe('Mon libellé'); // modification conservée
    // Un profil qui a déjà un angle ne reçoit pas les angles de départ.
    await repo.create('p2', fields('Seul'));
    expect((await repo.listWithDefaults('p2')).map(a => a.label)).toEqual(['Seul']);
  });

  it(`plafond de ${MAX_ANGLES_PER_PROFILE} angles par profil`, async () => {
    const db = makeFakeAngleDb();
    const repo = createAngleRepo(async () => db);
    await repo.listWithDefaults('p1');
    await expect(repo.create('p1', fields('Sixième'))).rejects.toBeInstanceOf(AngleLimitError);
    // Après suppression, une place se libère.
    const [first] = await repo.listWithDefaults('p1');
    await repo.remove(first.id);
    expect(await repo.create('p1', fields('Sixième'))).toHaveLength(MAX_ANGLES_PER_PROFILE);
  });

  it('slug unique dérivé du libellé, conservé à la mise à jour', async () => {
    const db = makeFakeAngleDb();
    const repo = createAngleRepo(async () => db);
    await repo.create('p1', { ...fields('Projets internes'), slug: 'projets-internes' });
    const list = await repo.create('p1', { ...fields('Projets internes'), slug: 'projets-internes' });
    expect(list.map(a => a.slug)).toEqual(['projets-internes', 'projets-internes-2']);
    await repo.update(list[1].id, { label: 'Autre', skillCategoryOrder: ['A'] });
    const after = await repo.list('p1');
    expect(after[1]).toMatchObject({ slug: 'projets-internes-2', label: 'Autre', skillCategoryOrder: ['A'] });
  });
});
