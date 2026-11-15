import { describe, expect, it } from 'bun:test';
import { SETTINGS_TREE, allSettingsPageIds, resolveSettingsPage } from './settings-tree';

describe('sommaire des paramètres', () => {
  it('identifiants uniques et groupes non vides', () => {
    const ids = allSettingsPageIds();
    expect(new Set(ids).size).toBe(ids.length);
    for (const g of SETTINGS_TREE) expect(g.pages.length).toBeGreaterThan(0);
  });
  it('page inconnue ou absente : la première', () => {
    expect(resolveSettingsPage('drive')).toBe('drive');
    expect(resolveSettingsPage('nimporte-quoi')).toBe('apparence');
    expect(resolveSettingsPage(null)).toBe('apparence');
  });
});
