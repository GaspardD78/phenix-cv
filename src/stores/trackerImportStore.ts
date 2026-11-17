import { create } from 'zustand';
import { getDb, getSetting, setSetting } from '@/lib/db';
import {
  UNDO_SETTING_KEY, applyImportPlan, parseUndoRecord, undoImport, type ApplyResult, type DbLike, type ImportUndoRecord,
} from '@/lib/tracker-import/apply';
import type { ImportPlan } from '@/lib/tracker-import/plan';
import { useApplicationStore } from '@/stores/applicationStore';

/**
 * Import d'un tableau dans le suivi des candidatures : écriture (avec sauvegarde automatique),
 * journal du dernier import (réglage `tracker_last_import`) et annulation en un clic.
 */
interface TrackerImportState {
  lastImport: ImportUndoRecord | null;
  loadLastImport: () => Promise<void>;
  runImport: (plan: ImportPlan) => Promise<ApplyResult>;
  undoLastImport: () => Promise<{ removed: number; restored: number } | null>;
  /** « Garder cet import » : le journal est effacé, l'annulation n'est plus proposée. */
  keepLastImport: () => Promise<void>;
}

const asDb = async (): Promise<DbLike> => (await getDb()) as unknown as DbLike;

export const useTrackerImportStore = create<TrackerImportState>((set, get) => ({
  lastImport: null,

  loadLastImport: async () => {
    set({ lastImport: parseUndoRecord(await getSetting(UNDO_SETTING_KEY)) });
  },

  runImport: async (plan) => {
    const { useSessionStore } = await import('@/stores/sessionStore');
    const profileId = useSessionStore.getState().currentUserId;
    if (!profileId) throw new Error('Votre profil n\'est pas chargé. Rouvrez l\'application, puis réessayez.');
    const { createAutoBackup } = await import('@/lib/backup');
    const result = await applyImportPlan(plan, { db: await asDb(), profileId, autoBackup: () => createAutoBackup() });
    await setSetting(UNDO_SETTING_KEY, JSON.stringify(result.record));
    set({ lastImport: result.record });
    await useApplicationStore.getState().fetchApplications();
    return result;
  },

  undoLastImport: async () => {
    const record = get().lastImport ?? parseUndoRecord(await getSetting(UNDO_SETTING_KEY));
    if (!record) return null;
    const done = await undoImport(await asDb(), record);
    await setSetting(UNDO_SETTING_KEY, '');
    set({ lastImport: null });
    await useApplicationStore.getState().fetchApplications();
    return done;
  },

  keepLastImport: async () => {
    await setSetting(UNDO_SETTING_KEY, '');
    set({ lastImport: null });
  },
}));
