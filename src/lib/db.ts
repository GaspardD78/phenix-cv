import Database from '@tauri-apps/plugin-sql';
import { invoke } from '@tauri-apps/api/core';

let db: Database | null = null;

export async function getDb(): Promise<Database> {
  // Prevent fatal crash when running in browser context (like Playwright UI tests)
  if (typeof window !== 'undefined' && !(window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__) {
    throw new Error("L'application doit être lancée dans Tauri (pas dans un navigateur classique) pour accéder à la base de données locale.");
  }

  if (!db) {
    // En mode portable (fichier .portable à côté de l'exécutable), le backend
    // renvoie un chemin absolu ; les migrations SQL sont appliquées par Tauri.
    const dbUri = await invoke<string>('get_db_uri');
    db = await Database.load(dbUri);
  }
  return db;
}

/**
 * Read a single value from the `settings` table.
 */
export async function getSetting(key: string): Promise<string | null> {
  const db = await getDb();
  const rows = await db.select<{ value: string }[]>(
    'SELECT value FROM settings WHERE key = ?1',
    [key]
  );
  return rows.length > 0 ? rows[0].value : null;
}

/**
 * Write a value to the `settings` table (upsert).
 */
export async function setSetting(key: string, value: string): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO settings (key, value) VALUES (?1, ?2)
     ON CONFLICT(key) DO UPDATE SET value = ?2`,
    [key, value]
  );
}
