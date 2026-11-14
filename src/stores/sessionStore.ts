import { create } from 'zustand';
import { getDb } from '@/lib/db';

/**
 * Profil unique de l'application. Il est créé (vide) au premier lancement ;
 * l'assistant de démarrage le remplit ensuite. La colonne `profile_id` reste
 * présente dans toutes les tables pour garder les requêtes inchangées.
 */
interface SessionState {
  currentUserId: string | null;
  isInitialized: boolean;
  error: string | null;
  initialize: () => Promise<void>;
}

export const useSessionStore = create<SessionState>((set) => ({
  currentUserId: null,
  isInitialized: false,
  error: null,

  initialize: async () => {
    try {
      const db = await getDb();
      const rows = await db.select<{ id: string }[]>('SELECT id FROM profiles ORDER BY created_at ASC LIMIT 1');
      if (rows.length > 0) {
        set({ currentUserId: rows[0].id, isInitialized: true, error: null });
        return;
      }
      const created = await db.select<{ id: string }[]>(
        `INSERT INTO profiles (first_name, last_name) VALUES ('', '') RETURNING id`,
      );
      set({ currentUserId: created[0]?.id ?? null, isInitialized: true, error: null });
    } catch (err) {
      set({
        isInitialized: true,
        error: err instanceof Error ? err.message : "Impossible d'ouvrir vos données.",
      });
    }
  },
}));
