/**
 * Écriture d'un plan d'import dans le suivi des candidatures, et annulation. La base est passée en
 * paramètre (testable sur une vraie base SQLite).
 *
 * - Sauvegarde automatique des données AVANT toute écriture (si elle échoue, rien n'est écrit).
 * - Ajouts par lot, avec des identifiants créés ici : on sait exactement quoi retirer pour annuler.
 * - Fusion : seuls les champs vides de la candidature existante sont complétés ; les notes sont
 *   ajoutées à la suite ; le statut n'est jamais modifié. Les anciennes valeurs sont gardées.
 * - Le journal de l'import (ajouts, valeurs d'avant les fusions) permet de tout défaire en un clic.
 * - Si une écriture échoue en cours de route, ce qui a déjà été écrit est défait.
 */
import { filterAllowedColumns } from '@/lib/validation';
import { MERGE_FIELDS, type ImportPlan, type NewApplicationRow } from './plan';

export interface DbLike {
  select<T>(query: string, values?: unknown[]): Promise<T>;
  execute(query: string, values?: unknown[]): Promise<unknown>;
}

/** Journal d'un import : de quoi le défaire exactement. */
export interface ImportUndoRecord {
  version: 1;
  /** Date de l'import (ISO). */
  at: string;
  insertedIds: string[];
  merged: { id: string; previous: Record<string, unknown> }[];
  autoBackupPath: string | null;
}

/** Réglage où le journal du dernier import est gardé (survit à un redémarrage). */
export const UNDO_SETTING_KEY = 'tracker_last_import';

export const IMPORT_FAILED_MESSAGE = 'L\'import n\'a pas pu aller au bout. Rien n\'a été modifié dans votre suivi.';
export const AUTO_BACKUP_FAILED_MESSAGE = 'La sauvegarde automatique de vos données a échoué : rien n\'a été importé. Enregistrez une sauvegarde vous-même, puis réessayez.';

export interface ApplyContext {
  db: DbLike;
  profileId: string;
  /** Sauvegarde automatique avant écriture ; `false` seulement dans les tests. */
  autoBackup: (() => Promise<string>) | false;
  now?: Date;
  newId?: () => string;
}

export interface ApplyResult {
  record: ImportUndoRecord;
  added: number;
  merged: number;
}

const defaultId = () => crypto.randomUUID().replace(/-/g, '');
const BATCH = 20; // 20 lignes × ~22 colonnes < 999 paramètres SQLite

async function insertRows(db: DbLike, table: string, rows: Record<string, unknown>[]): Promise<void> {
  if (rows.length === 0) return;
  const columns = Object.keys(filterAllowedColumns(table, rows[0]));
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH);
    const values: unknown[] = [];
    const placeholders = chunk.map((row, r) => {
      for (const c of columns) values.push(row[c] ?? null);
      return `(${columns.map((_, k) => `?${r * columns.length + k + 1}`).join(', ')})`;
    });
    await db.execute(`INSERT INTO ${table} (${columns.join(', ')}) VALUES ${placeholders.join(', ')}`, values);
  }
}

const isEmpty = (v: unknown) => v === null || v === undefined || (typeof v === 'string' && !v.trim());

/** Changements d'une fusion : champs vides complétés, notes ajoutées à la suite. Pur. */
export function mergePatch(current: Record<string, unknown>, incoming: NewApplicationRow, line: number): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  for (const field of MERGE_FIELDS) {
    const value = incoming[field];
    if (!isEmpty(value) && isEmpty(current[field])) patch[field] = value;
  }
  if (incoming.notes && !String(current.notes ?? '').includes(incoming.notes)) {
    const block = `Importé de votre tableau (ligne ${line}) :\n${incoming.notes}`;
    patch.notes = isEmpty(current.notes) ? block : `${String(current.notes).trimEnd()}\n\n${block}`;
  }
  return patch;
}

/** Défait un import : candidatures ajoutées retirées, fusions remises à leurs valeurs d'avant. */
export async function undoImport(db: DbLike, record: ImportUndoRecord): Promise<{ removed: number; restored: number }> {
  for (let i = 0; i < record.insertedIds.length; i += BATCH) {
    const ids = record.insertedIds.slice(i, i + BATCH);
    const marks = ids.map((_, k) => `?${k + 1}`).join(', ');
    await db.execute(`DELETE FROM application_events WHERE application_id IN (${marks})`, ids);
    await db.execute(`DELETE FROM applications WHERE id IN (${marks})`, ids);
  }
  for (const { id, previous } of record.merged) {
    const cols = Object.keys(filterAllowedColumns('applications', previous));
    if (cols.length === 0) continue;
    await db.execute(
      `UPDATE applications SET ${cols.map((c, k) => `${c} = ?${k + 1}`).join(', ')} WHERE id = ?${cols.length + 1}`,
      [...cols.map(c => previous[c] ?? null), id],
    );
  }
  return { removed: record.insertedIds.length, restored: record.merged.length };
}

export async function applyImportPlan(plan: ImportPlan, ctx: ApplyContext): Promise<ApplyResult> {
  const { db, profileId } = ctx;
  const now = ctx.now ?? new Date();
  const newId = ctx.newId ?? defaultId;

  let autoBackupPath: string | null = null;
  if (ctx.autoBackup) {
    try {
      autoBackupPath = await ctx.autoBackup();
    } catch {
      throw new Error(AUTO_BACKUP_FAILED_MESSAGE);
    }
  }

  const record: ImportUndoRecord = { version: 1, at: now.toISOString(), insertedIds: [], merged: [], autoBackupPath };
  const toAdd = plan.items.filter(i => i.row && i.decision === 'add');
  const toMerge = plan.items.filter(i => i.row && i.decision === 'merge' && i.duplicateOf?.kind === 'existing');

  try {
    const rows = toAdd.map(i => ({ id: newId(), profile_id: profileId, cv_id: null, ...i.row! }));
    const events = rows.map((r, k) => ({
      id: newId(), application_id: r.id, event_type: 'note', event_date: now.toISOString(),
      title: 'Importée depuis un tableau', description: `Ligne ${toAdd[k].line} du tableau importé.`,
    }));
    record.insertedIds = rows.map(r => r.id);
    await insertRows(db, 'applications', rows);
    await insertRows(db, 'application_events', events);

    for (const item of toMerge) {
      const id = (item.duplicateOf as { id: string }).id;
      const [current] = await db.select<Record<string, unknown>[]>('SELECT * FROM applications WHERE id = ?1 AND profile_id = ?2', [id, profileId]);
      if (!current) continue;
      const patch = mergePatch(current, item.row!, item.line);
      const cols = Object.keys(filterAllowedColumns('applications', patch));
      if (cols.length === 0) continue;
      record.merged.push({ id, previous: Object.fromEntries(cols.map(c => [c, current[c] ?? null])) });
      await db.execute(
        `UPDATE applications SET ${cols.map((c, k) => `${c} = ?${k + 1}`).join(', ')}, updated_at = datetime('now') WHERE id = ?${cols.length + 1}`,
        [...cols.map(c => patch[c]), id],
      );
    }
  } catch {
    // Retour à l'état d'avant : rien de partiel ne reste dans le suivi.
    try { await undoImport(db, record); } catch { /* la sauvegarde automatique reste disponible */ }
    throw new Error(IMPORT_FAILED_MESSAGE);
  }

  return { record, added: toAdd.length, merged: record.merged.length };
}

/** Lecture du journal enregistré (réglage `tracker_last_import`), ou `null` s'il est absent ou illisible. */
export function parseUndoRecord(raw: string | null | undefined): ImportUndoRecord | null {
  if (!raw) return null;
  try {
    const r = JSON.parse(raw) as ImportUndoRecord;
    return r && r.version === 1 && Array.isArray(r.insertedIds) && Array.isArray(r.merged) ? r : null;
  } catch {
    return null;
  }
}
