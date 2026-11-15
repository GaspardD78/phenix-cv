import type { MasterEntry, Profile } from '@/types/profile';
import type { ProfileFieldDiff, SelectableEntry } from '@/lib/import/types';

/** Actions du store de profil nécessaires à l'enregistrement d'un import. */
export interface ApplyImportDeps {
  updateProfile: (updates: Partial<Profile>) => Promise<void>;
  addEntry: (entry: Omit<MasterEntry, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  fetchProfile: () => Promise<void>;
  /** Identifiant du profil à rattacher aux entrées (lu au moment de l'enregistrement). */
  getProfileId: () => string;
}

export interface ApplyImportResult {
  profileCount: number;
  entryCount: number;
}

/**
 * Enregistre ce que l'utilisateur a validé à l'étape de vérification : champs cochés
 * puis entrées sélectionnées. Rien n'est ajouté sans sélection explicite.
 */
export async function applyImport(
  diffs: ProfileFieldDiff[],
  entries: SelectableEntry[],
  deps: ApplyImportDeps,
): Promise<ApplyImportResult> {
  const profileUpdates: Partial<Profile> = {};
  for (const diff of diffs) {
    if (diff.useImported && diff.imported) {
      (profileUpdates as Record<string, string>)[diff.key] = diff.imported;
    }
  }
  if (Object.keys(profileUpdates).length > 0) {
    await deps.updateProfile(profileUpdates);
  }

  const profileId = deps.getProfileId();
  const selectedEntries = entries.filter(e => e.selected);
  for (const { data } of selectedEntries) {
    await deps.addEntry({
      profileId,
      entryType: data.entryType,
      title: data.title,
      subtitle: data.subtitle ?? null,
      location: data.location ?? null,
      startDate: data.startDate ?? null,
      endDate: data.endDate ?? null,
      isCurrent: data.isCurrent ?? false,
      description: data.description ?? null,
      metadata: {},
      sortOrder: 0,
      tags: data.tags ?? [],
    });
  }

  await deps.fetchProfile();
  return { profileCount: Object.keys(profileUpdates).length, entryCount: selectedEntries.length };
}
