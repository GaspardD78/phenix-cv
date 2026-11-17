
import { describe, it, expect, mock } from 'bun:test';

// Mock Tauri plugins before importing backup
mock.module('@tauri-apps/plugin-dialog', () => ({
  save: () => {},
  open: () => {}
}));
// Fichiers écrits (sauvegarde automatique) : chemin relatif et contenu.
const written: { path: string; data: string; baseDir?: unknown }[] = [];
let failWrites = false;
mock.module('@tauri-apps/plugin-fs', () => ({
  writeTextFile: async (path: string, data: string, opts?: { baseDir?: unknown }) => {
    if (failWrites) throw new Error('disque plein');
    written.push({ path, data, baseDir: opts?.baseDir });
  },
  readTextFile: () => {},
  mkdir: async () => {},
  BaseDirectory: { AppData: 14 },
}));
// Base factice remplaçable par test (défaut : objet vide, comme avant).
let fakeDb: any = {};
mock.module('@/lib/db', () => ({
  getDb: () => fakeDb
}));
let currentUserId: string | null = null;
mock.module('@/stores/sessionStore', () => ({
  useSessionStore: { getState: () => ({ currentUserId }) }
}));

// Mock validation
mock.module('./validation', () => ({
  filterAllowedColumns: (_table: string, data: any) => data
}));

// Now import applyRows
import {
  applyRows, buildBackupData, importBackup, listBackupProfiles, resolveSourceProfileId, selectBackupProfile,
  BackupProfileChoiceRequired, DELETE_ORDER, INSERT_ORDER, MODULES, TABLES_WITH_PROFILE_ID, redactTargetPeople, type BackupData,
} from './backup';

describe('applyRows logic', () => {
  it('should construct correct multi-value INSERT queries with chunking', async () => {
    const capturedQueries: string[] = [];
    const capturedValues: any[][] = [];

    const db = {
      execute: async (query: string, values: any[]) => {
        capturedQueries.push(query);
        capturedValues.push(values);
      }
    } as any;

    // Create 40 rows. With BATCH_SIZE = 30, it should result in 2 queries (30 rows + 10 rows)
    const rows = Array.from({ length: 40 }, (_, i) => ({ id: i + 1, name: `User ${i + 1}` }));

    await applyRows(db, 'users', rows, 'merge');

    expect(capturedQueries.length).toBe(2);

    // First query: 30 rows
    expect(capturedQueries[0]).toContain('INSERT INTO users (id, name) VALUES');
    // Fusion : mise à jour en place, jamais INSERT OR REPLACE (qui supprime la ligne, et en cascade ses dépendances).
    expect(capturedQueries[0]).not.toContain('OR REPLACE');
    expect(capturedQueries[0]).toContain('ON CONFLICT(id) DO UPDATE SET name = COALESCE(excluded.name, users.name) ON CONFLICT DO NOTHING');
    expect(capturedValues[0].length).toBe(60); // 30 rows * 2 columns
    expect(capturedValues[0][0]).toBe(1);
    expect(capturedValues[0][1]).toBe('User 1');
    expect(capturedValues[0][58]).toBe(30);
    expect(capturedValues[0][59]).toBe('User 30');

    // Second query: 10 rows
    expect(capturedQueries[1]).toContain('INSERT INTO users (id, name) VALUES');
    expect(capturedValues[1].length).toBe(20); // 10 rows * 2 columns
    expect(capturedValues[1][0]).toBe(31);
    expect(capturedValues[1][1]).toBe('User 31');
    expect(capturedValues[1][18]).toBe(40);
    expect(capturedValues[1][19]).toBe('User 40');
  });

  it('should handle single row', async () => {
    const capturedQueries: string[] = [];
    const capturedValues: any[][] = [];

    const db = {
      execute: async (query: string, values: any[]) => {
        capturedQueries.push(query);
        capturedValues.push(values);
      }
    } as any;

    const rows = [
      { id: 1, name: 'Alice' }
    ];

    await applyRows(db, 'users', rows, 'ignore');

    expect(capturedQueries.length).toBe(1);
    expect(capturedQueries[0]).toBe('INSERT OR IGNORE INTO users (id, name) VALUES (?1, ?2)');
    expect(capturedValues[0]).toEqual([1, 'Alice']);
  });
});

describe('sauvegarde des angles de CV (cv_angles)', () => {
  const angleRow = { id: 'a1', profile_id: 'old', slug: 'angle-x', label: 'Angle fictif', title_rule: 'profile', skill_category_order: '["A"]' };
  const entryRow = { id: 'e1', profile_id: 'old', entry_type: 'skill', title: 'A', tags: '["angle:angle-x"]' };

  it('rangée dans le module « Entrées CV », ordonnée après master_entries', () => {
    expect(MODULES.find(m => m.id === 'masterEntries')!.tables).toContain('cv_angles');
    expect(INSERT_ORDER.indexOf('cv_angles')).toBeGreaterThan(INSERT_ORDER.indexOf('master_entries'));
    expect(DELETE_ORDER.indexOf('cv_angles')).toBeLessThan(DELETE_ORDER.indexOf('profiles'));
    expect(TABLES_WITH_PROFILE_ID).toContain('cv_angles');
  });

  it('remappage du profil appliqué aux angles', () => {
    const backup = { __cvmaker_backup: true, version: '1.0', exportDate: '', counts: {}, modules: {
      profiles: [{ id: 'old' }], cv_angles: [{ ...angleRow }], master_entries: [{ ...entryRow }],
    } } as BackupData;
    const out = selectBackupProfile(backup, resolveSourceProfileId(backup, 'new')!, 'new');
    expect(out.modules.cv_angles![0].profile_id).toBe('new');
    expect(out.modules.master_entries![0].profile_id).toBe('new');
    expect(backup.modules.cv_angles![0].profile_id).toBe('old'); // copie : l'original n'est pas modifié
  });

  it('export puis restauration : les angles sont conservés, sur le profil courant', async () => {
    const tables: Record<string, Record<string, unknown>[]> = {
      profiles: [{ id: 'old' }], master_entries: [entryRow], cv_angles: [angleRow],
    };
    const executed: { query: string; values: unknown[] }[] = [];
    fakeDb = {
      select: async (query: string) => tables[/FROM (\w+)/.exec(query)![1]] ?? [],
      execute: async (query: string, values: unknown[] = []) => { executed.push({ query, values }); },
    };
    const backup = await buildBackupData(['profile', 'masterEntries']);
    expect(backup.modules.cv_angles).toEqual([angleRow]);
    expect(backup.counts.masterEntries).toBe(2);

    currentUserId = 'new';
    await importBackup(JSON.parse(JSON.stringify(backup)), { profile: 'merge', masterEntries: 'replace' }, { autoBackup: false });
    const del = executed.find(e => e.query.startsWith('DELETE FROM cv_angles'));
    expect(del).toEqual({ query: 'DELETE FROM cv_angles WHERE profile_id = ?1', values: ['new'] });
    const insert = executed.find(e => e.query.startsWith('INSERT OR IGNORE INTO cv_angles'));
    expect(insert).toBeDefined();
    expect(insert!.values).toContain('angle-x');
    expect(insert!.values).toContain('new');
    expect(insert!.values).not.toContain('old');
    const order = executed.map(e => e.query).filter(q => q.startsWith('INSERT'));
    expect(order.findIndex(q => q.includes('cv_angles'))).toBeGreaterThan(order.findIndex(q => q.includes('master_entries')));
    fakeDb = {};
    currentUserId = null;
  });
});

describe('sauvegarde à plusieurs profils', () => {
  // Deux profils fictifs ; « p-autre » est volontairement le PREMIER de la sauvegarde.
  const twoProfiles = (): BackupData => ({
    __cvmaker_backup: true, version: '1.0', exportDate: '', counts: {},
    modules: {
      profiles: [
        { id: 'p-autre', first_name: 'Alex', last_name: 'Fictif' },
        { id: 'p-actif', first_name: 'Sam', last_name: 'Exemple' },
      ],
      master_entries: [
        { id: 'e-autre', profile_id: 'p-autre', entry_type: 'skill', title: 'Compétence A' },
        { id: 'e-actif', profile_id: 'p-actif', entry_type: 'skill', title: 'Compétence B' },
      ],
      cv_angles: [
        { id: 'a-autre', profile_id: 'p-autre', slug: 'x', label: 'Angle A' },
        { id: 'a-actif', profile_id: 'p-actif', slug: 'y', label: 'Angle B' },
      ],
      cv_documents: [
        { id: 'cv-autre', profile_id: 'p-autre', name: 'CV A' },
        { id: 'cv-actif', profile_id: 'p-actif', name: 'CV B' },
      ],
      cv_blocks: [
        { id: 'b-autre', cv_id: 'cv-autre', block_type: 'entry_ref', entry_id: 'e-autre' },
        { id: 'b-actif', cv_id: 'cv-actif', block_type: 'entry_ref', entry_id: 'e-actif' },
      ],
      applications: [{ id: 'app-autre', profile_id: 'p-autre', company_name: 'Société A' }],
      application_events: [{ id: 'ev-autre', application_id: 'app-autre', event_type: 'note' }],
      settings: [
        { key: 'theme', value: 'dark' },
        { key: 'cv_personal_rules:p-autre', value: 'Règles A' },
        { key: 'cv_personal_rules:p-actif', value: 'Règles B' },
        { key: 'cv_bullet_focus:p-autre', value: 'resultats' },
        { key: 'cv_bullet_focus:p-actif', value: 'missions' },
      ],
    },
  });

  it('liste les profils de la sauvegarde', () => {
    expect(listBackupProfiles(twoProfiles())).toEqual([
      { id: 'p-autre', label: 'Alex Fictif' },
      { id: 'p-actif', label: 'Sam Exemple' },
    ]);
  });

  it('profil actif présent : c\'est lui qui est restauré, jamais le premier', () => {
    expect(resolveSourceProfileId(twoProfiles(), 'p-actif')).toBe('p-actif');
    const out = selectBackupProfile(twoProfiles(), 'p-actif', 'p-actif');
    expect(out.modules.profiles!.map(r => r.id)).toEqual(['p-actif']);
    expect(out.modules.master_entries!.map(r => r.id)).toEqual(['e-actif']);
    expect(out.modules.cv_angles!.map(r => r.id)).toEqual(['a-actif']);
    expect(out.modules.cv_documents!.map(r => r.id)).toEqual(['cv-actif']);
    expect(out.modules.cv_blocks!.map(r => r.id)).toEqual(['b-actif']);
    expect(out.modules.applications).toEqual([]);
    expect(out.modules.application_events).toEqual([]);
    // Réglages globaux conservés ; réglages par profil : seulement ceux du profil restauré.
    expect(out.modules.settings!.map(r => r.key)).toEqual(['theme', 'cv_personal_rules:p-actif', 'cv_bullet_focus:p-actif']);
  });

  it('aucun profil ne correspond à l\'utilisateur actif : choix obligatoire', () => {
    let err: unknown;
    try { resolveSourceProfileId(twoProfiles(), 'p-inconnu'); } catch (e) { err = e; }
    expect(err).toBeInstanceOf(BackupProfileChoiceRequired);
    expect((err as BackupProfileChoiceRequired).profiles.map(p => p.id)).toEqual(['p-autre', 'p-actif']);
  });

  it('profil choisi par l\'utilisateur : restauré et remappé sur le profil actif', () => {
    const backup = twoProfiles();
    const source = resolveSourceProfileId(backup, 'p-nouveau', 'p-autre');
    expect(source).toBe('p-autre');
    const out = selectBackupProfile(backup, source!, 'p-nouveau');
    expect(out.modules.profiles).toEqual([{ id: 'p-nouveau', first_name: 'Alex', last_name: 'Fictif' }]);
    expect(out.modules.master_entries).toEqual([{ id: 'e-autre', profile_id: 'p-nouveau', entry_type: 'skill', title: 'Compétence A' }]);
    expect(out.modules.application_events!.map(r => r.id)).toEqual(['ev-autre']);
    expect(out.modules.settings!.map(r => r.key)).toEqual(['theme', 'cv_personal_rules:p-nouveau', 'cv_bullet_focus:p-nouveau']);
    expect(() => resolveSourceProfileId(backup, 'p-nouveau', 'absent')).toThrow('absent de la sauvegarde');
  });

  it('un seul profil : restauré même si son id diffère', () => {
    const backup = twoProfiles();
    backup.modules.profiles = [backup.modules.profiles![0]];
    backup.modules.master_entries = [backup.modules.master_entries![0]];
    for (const t of ['cv_angles', 'cv_documents', 'applications']) {
      backup.modules[t] = backup.modules[t]!.filter(r => r.profile_id !== 'p-actif');
    }
    expect(resolveSourceProfileId(backup, 'p-nouveau')).toBe('p-autre');
  });

  it('importBackup : n\'insère que le profil de l\'utilisateur actif', async () => {
    const executed: { query: string; values: unknown[] }[] = [];
    fakeDb = { execute: async (query: string, values: unknown[] = []) => { executed.push({ query, values }); } };
    currentUserId = 'p-actif';
    await importBackup(twoProfiles(), { profile: 'merge', masterEntries: 'merge', cvDocuments: 'merge', applications: 'merge', settings: 'merge' }, { autoBackup: false });
    const values = executed.flatMap(e => e.values);
    expect(values).toContain('e-actif');
    expect(values).not.toContain('e-autre');
    expect(values).not.toContain('p-autre');
    expect(values).not.toContain('Règles A');
    expect(executed.some(e => e.query.includes('INTO applications'))).toBe(false);

    // Sans correspondance ni choix : rien n'est écrit.
    executed.length = 0;
    currentUserId = 'p-inconnu';
    await expect(importBackup(twoProfiles(), { masterEntries: 'merge' }, { autoBackup: false })).rejects.toBeInstanceOf(BackupProfileChoiceRequired);
    expect(executed).toHaveLength(0);

    // Avec un choix explicite : importé et remappé.
    await importBackup(twoProfiles(), { masterEntries: 'merge' }, { sourceProfileId: 'p-autre', autoBackup: false });
    const insert = executed.find(e => e.query.includes('INTO master_entries'))!;
    expect(insert.values).toContain('e-autre');
    expect(insert.values).toContain('p-inconnu');
    expect(insert.values).not.toContain('e-actif');
    fakeDb = {};
    currentUserId = null;
  });
});

describe('redactTargetPeople : envoi vers Google Drive', () => {
  const target = { type: 'services', intent: 'recommandation', readerName: 'Camille Fictif', readerRole: 'directeur', readerNote: 'délais', referrerName: 'Alex Fictif', brief: { company: 'Orga' }, sheet: { type: 'services' } };
  const backup = (settings: unknown): BackupData => ({
    __cvmaker_backup: true, version: '1', exportDate: '', counts: {},
    modules: { cv_documents: [{ id: 'cv1', name: 'CV', settings }], settings: [{ key: 'theme', value: 'dark' }] },
  });

  it('retire noms, fonction et note du lecteur (réglages en JSON texte), garde le reste', () => {
    const out = redactTargetPeople(backup(JSON.stringify({ fontFamily: 'Arial', target })));
    const settings = JSON.parse(out.modules.cv_documents![0].settings as string);
    expect(settings.fontFamily).toBe('Arial');
    expect(settings.target).toEqual({ type: 'services', intent: 'recommandation', brief: { company: 'Orga' }, sheet: { type: 'services' } });
    expect(JSON.stringify(out)).not.toContain('Camille');
    expect(JSON.stringify(out)).not.toContain('Alex');
    expect(out.modules.settings).toEqual([{ key: 'theme', value: 'dark' }]);
  });

  it('réglages déjà en objet, sans ciblage ou illisibles : inchangés', () => {
    const asObject = redactTargetPeople(backup({ target }));
    expect((asObject.modules.cv_documents![0].settings as { target: Record<string, unknown> }).target.readerName).toBeUndefined();
    const none = backup(JSON.stringify({ fontFamily: 'Arial' }));
    expect(redactTargetPeople(none).modules.cv_documents).toEqual(none.modules.cv_documents);
    const broken = backup('{pas du json');
    expect(redactTargetPeople(broken).modules.cv_documents).toEqual(broken.modules.cv_documents);
  });

  it('ne modifie pas la sauvegarde d\'origine (la copie locale garde les champs)', () => {
    const original = backup(JSON.stringify({ target }));
    redactTargetPeople(original);
    expect(original.modules.cv_documents![0].settings as string).toContain('Camille Fictif');
  });

  it('sans cv_documents : renvoyée telle quelle', () => {
    const b: BackupData = { __cvmaker_backup: true, version: '1', exportDate: '', counts: {}, modules: {} };
    expect(redactTargetPeople(b)).toBe(b);
  });
});

// ─── Restauration sur une vraie base (schéma Phénix, clés étrangères activées) ──────────────────

import { Database } from 'bun:sqlite';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  AUTO_BACKUP_DIR, AUTO_BACKUP_FAILED_MESSAGE, DAMAGED_BACKUP_MESSAGE, NOT_A_BACKUP_MESSAGE, autoBackupFileName, createAutoBackup, parseBackupText,
} from './backup';

const MIGRATIONS = join(import.meta.dir, '..', '..', 'src-tauri', 'migrations');

/** Base SQLite en mémoire au schéma de l'application, clés étrangères activées (comme sqlx). */
function realDb() {
  const db = new Database(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  for (const f of readdirSync(MIGRATIONS).filter(f => f.endsWith('.sql')).sort()) db.exec(readFileSync(join(MIGRATIONS, f), 'utf8'));
  return {
    raw: db,
    select: async (q: string, v: unknown[] = []) => db.query(q).all(...(v as never[])),
    execute: async (q: string, v: unknown[] = []) => { db.query(q).run(...(v as never[])); },
  };
}

/** Phénix déjà rempli : profil Camille Martin, une expérience, un CV et son bloc, des réglages d'installation. */
function filledPhenix() {
  const db = realDb();
  const run = (q: string, ...v: unknown[]) => db.raw.query(q).run(...(v as never[]));
  run("INSERT INTO profiles (id, first_name, last_name, email, title, other_url) VALUES ('phx','Camille','Martin','camille.martin@example.com','Assistante ADV','https://camille-martin.example')");
  run("INSERT INTO master_entries (id, profile_id, entry_type, title, subtitle, start_date) VALUES ('p-exp','phx','experience','Assistante ADV','Négoce Rhône Matériaux','2021-01')");
  run("INSERT INTO cv_documents (id, profile_id, name, template_id) VALUES ('p-cv','phx','Mon CV Phénix','ats-classic')");
  run("INSERT INTO cv_blocks (id, cv_id, block_type, entry_id, sort_order) VALUES ('p-bloc','p-cv','entry_ref','p-exp',0)");
  run("INSERT INTO settings (key, value) VALUES ('wizard_state','{\"step\":\"done\"}'), ('gdrive_tokens_phx','{\"refreshToken\":\"jeton-de-phenix\"}'), ('cv_target_pages','2')");
  return db;
}

/** Sauvegarde d'un autre ordinateur (Camille Martin), avec des secrets qui ne doivent jamais être repris. */
function incomingBackup(): BackupData {
  return {
    __cvmaker_backup: true, version: '1.0', exportDate: '2026-11-01T10:00:00.000Z', counts: {},
    modules: {
      profiles: [{ id: 'ext', first_name: 'Camille', last_name: 'Martin', email: null, title: 'Assistante commerciale', other_url: null, photo_path: 'data:image/png;base64,iVBORw0KGgo=' }],
      master_entries: [{ id: 'x-exp', profile_id: 'ext', entry_type: 'experience', title: 'Assistante administrative', subtitle: 'Cabinet Durand', start_date: '2015-09', end_date: '2018-02', is_current: 0, sort_order: 1 }],
      cv_documents: [{ id: 'x-cv', profile_id: 'ext', name: 'CV importé', template_id: 'sidebar-modern', settings: '{}' }],
      cv_blocks: [{ id: 'x-bloc', cv_id: 'x-cv', block_type: 'entry_ref', entry_id: 'x-exp', sort_order: 0, is_visible: 1 }],
      settings: [
        { key: 'cv_target_pages', value: '1' },
        { key: 'cv_personal_rules:ext', value: 'Pas de déplacement de plus de 45 minutes.' },
        { key: 'gdrive_tokens_ext', value: '{"accessToken":"ya29.FAUX","refreshToken":"1//FAUX"}' },
        { key: 'gdrive_custom_client_secret', value: 'FAUX-SECRET' },
        { key: 'wizard_state', value: '{"step":"welcome"}' },
        { key: 'theme', value: 'dark' },
      ],
      // Tables d'une autre application (veille emploi de CVmaker), avec des secrets : jamais lues.
      job_watch_settings: [{ key: 'emailSmtpPassword', profile_id: 'ext', value: 'FAUX-MOT-DE-PASSE' }],
    },
  };
}

const ALL_MERGE: ImportPlan = { profile: 'merge', masterEntries: 'merge', cvDocuments: 'merge', settings: 'merge' };
import type { ImportPlan } from './backup';

const rowsOf = (db: ReturnType<typeof realDb>, sql: string) => db.raw.query(sql).all() as Record<string, unknown>[];

describe('restauration sans perte (vraie base, clés étrangères activées)', () => {
  it('« Fusionner » sur un Phénix déjà rempli : rien n\'est supprimé, rien de vide n\'efface, tout est ajouté', async () => {
    const db = filledPhenix();
    fakeDb = db;
    currentUserId = 'phx';
    await importBackup(incomingBackup(), ALL_MERGE, { autoBackup: false });

    // Les données Phénix existantes sont toujours là (avant : supprimées en cascade).
    expect(rowsOf(db, "SELECT id FROM master_entries ORDER BY id").map(r => r.id)).toEqual(['p-exp', 'x-exp']);
    expect(rowsOf(db, "SELECT id FROM cv_documents ORDER BY id").map(r => r.id)).toEqual(['p-cv', 'x-cv']);
    expect(rowsOf(db, "SELECT id, entry_id FROM cv_blocks ORDER BY id")).toEqual([{ id: 'p-bloc', entry_id: 'p-exp' }, { id: 'x-bloc', entry_id: 'x-exp' }]);
    // Profil mis à jour en place ; les valeurs vides de la sauvegarde n'effacent rien.
    const [profile] = rowsOf(db, 'SELECT id, title, email, other_url, photo_path FROM profiles');
    expect(profile).toEqual({
      id: 'phx', title: 'Assistante commerciale', email: 'camille.martin@example.com',
      other_url: 'https://camille-martin.example', photo_path: 'data:image/png;base64,iVBORw0KGgo=',
    });
    expect(rowsOf(db, 'SELECT COUNT(*) AS n FROM profiles')[0].n).toBe(1);
    fakeDb = {};
    currentUserId = null;
  });

  it('aucun secret du fichier n\'est stocké ; les réglages de l\'installation ne sont pas touchés', async () => {
    const db = filledPhenix();
    fakeDb = db;
    currentUserId = 'phx';
    const result = await importBackup(incomingBackup(), ALL_MERGE, { autoBackup: false });
    const settings = Object.fromEntries(rowsOf(db, 'SELECT key, value FROM settings').map(r => [r.key, r.value]));

    expect(Object.keys(settings).some(k => k.includes('ext'))).toBe(false);
    expect(settings['gdrive_custom_client_secret']).toBeUndefined();
    expect(JSON.stringify(settings)).not.toContain('FAUX');
    // Réglages propres à cette installation : conservés tels quels.
    expect(settings['gdrive_tokens_phx']).toBe('{"refreshToken":"jeton-de-phenix"}');
    expect(settings['wizard_state']).toBe('{"step":"done"}');
    expect(settings['theme']).toBe('light');
    // Réglages utiles au CV : repris (règles personnelles remappées sur le profil actif).
    expect(settings['cv_target_pages']).toBe('1');
    expect(settings['cv_personal_rules:phx']).toBe('Pas de déplacement de plus de 45 minutes.');
    // Tables d'une autre application : jamais créées ni lues.
    expect(rowsOf(db, "SELECT name FROM sqlite_master WHERE name LIKE 'job_%'")).toEqual([]);
    expect(result.skippedSettings).toEqual({ secretCount: 2, ignoredKeys: ['wizard_state', 'theme'] });
    fakeDb = {};
    currentUserId = null;
  });

  it('« Remplacer » le profil : ses informations sont remplacées, mais expériences et CV restent', async () => {
    const db = filledPhenix();
    fakeDb = db;
    currentUserId = 'phx';
    await importBackup(incomingBackup(), { profile: 'replace' }, { autoBackup: false });
    const [profile] = rowsOf(db, 'SELECT id, title, email, other_url FROM profiles');
    // Remplacer = les valeurs de la sauvegarde, y compris vides (choix explicite, sauvegarde automatique faite avant).
    expect(profile).toEqual({ id: 'phx', title: 'Assistante commerciale', email: null, other_url: null });
    expect(rowsOf(db, 'SELECT id FROM master_entries').map(r => r.id)).toEqual(['p-exp']);
    expect(rowsOf(db, 'SELECT id FROM cv_documents').map(r => r.id)).toEqual(['p-cv']);
    expect(rowsOf(db, 'SELECT id FROM cv_blocks').map(r => r.id)).toEqual(['p-bloc']);
    fakeDb = {};
    currentUserId = null;
  });

  it('« Remplacer » les réglages : seuls ceux qu\'une sauvegarde peut apporter sont remplacés', async () => {
    const db = filledPhenix();
    fakeDb = db;
    currentUserId = 'phx';
    await importBackup(incomingBackup(), { settings: 'replace' }, { autoBackup: false });
    const keys = rowsOf(db, 'SELECT key FROM settings ORDER BY key').map(r => r.key);
    expect(keys).toEqual(['cv_personal_rules:phx', 'cv_target_pages', 'default_language', 'default_template', 'gdrive_tokens_phx', 'theme', 'wizard_state']);
    fakeDb = {};
    currentUserId = null;
  });

  it('sauvegarde automatique AVANT toute écriture : données actuelles, sans secret, dans le dossier de données', async () => {
    const db = filledPhenix();
    fakeDb = db;
    currentUserId = 'phx';
    written.length = 0;
    let entriesAtBackupTime = -1;
    const result = await importBackup(incomingBackup(), ALL_MERGE, {
      autoBackup: async () => {
        entriesAtBackupTime = rowsOf(db, 'SELECT COUNT(*) AS n FROM master_entries')[0].n as number;
        return createAutoBackup(new Date(2026, 10, 17, 10, 42, 5));
      },
    });
    expect(entriesAtBackupTime).toBe(1); // rien n'était encore importé
    expect(result.autoBackupPath).toBe(`${AUTO_BACKUP_DIR}/avant-restauration_2026-11-17_10-42-05.cvmaker`);
    expect(written).toHaveLength(1);
    expect(written[0].path).toBe(result.autoBackupPath!);
    expect(written[0].baseDir).toBe(14); // BaseDirectory.AppData
    const saved = parseBackupText(written[0].data);
    expect(saved.modules.master_entries!.map(r => r.id)).toEqual(['p-exp']);
    expect(saved.modules.cv_blocks!.map(r => r.id)).toEqual(['p-bloc']);
    expect(written[0].data).not.toContain('jeton-de-phenix');
    expect(saved.modules.settings!.map(r => r.key)).toContain('wizard_state');
    fakeDb = {};
    currentUserId = null;
  });

  it('si la sauvegarde automatique échoue : message clair, et la base n\'est pas modifiée', async () => {
    const db = filledPhenix();
    fakeDb = db;
    currentUserId = 'phx';
    const before = JSON.stringify([rowsOf(db, 'SELECT * FROM profiles'), rowsOf(db, 'SELECT * FROM master_entries'), rowsOf(db, 'SELECT * FROM settings')]);
    failWrites = true;
    await expect(importBackup(incomingBackup(), { profile: 'replace', masterEntries: 'replace', settings: 'replace' })).rejects.toThrow(AUTO_BACKUP_FAILED_MESSAGE);
    failWrites = false;
    expect(JSON.stringify([rowsOf(db, 'SELECT * FROM profiles'), rowsOf(db, 'SELECT * FROM master_entries'), rowsOf(db, 'SELECT * FROM settings')])).toBe(before);
    fakeDb = {};
    currentUserId = null;
  });

  it('nom de la sauvegarde automatique : daté à l\'heure locale', () => {
    expect(autoBackupFileName(new Date(2026, 0, 5, 7, 3, 9))).toBe('avant-restauration_2026-01-05_07-03-09.cvmaker');
  });
});

describe('export : aucun secret ne sort de l\'ordinateur', () => {
  it('jetons Google Drive et identifiants OAuth retirés ; les autres réglages restent', async () => {
    const db = filledPhenix();
    db.raw.query("INSERT INTO settings (key, value) VALUES ('gdrive_custom_client_id','FAUX-ID'), ('gdrive_custom_client_secret','FAUX-SECRET')").run();
    fakeDb = db;
    const backup = await buildBackupData(['settings']);
    const keys = backup.modules.settings!.map(r => r.key);
    expect(keys).toContain('wizard_state');
    expect(keys).toContain('cv_target_pages');
    expect(keys.filter(k => String(k).startsWith('gdrive_'))).toEqual([]);
    expect(JSON.stringify(backup)).not.toMatch(/jeton-de-phenix|FAUX-ID|FAUX-SECRET/);
    expect(backup.counts.settings).toBe(keys.length);
    fakeDb = {};
  });
});

describe('lecture d\'un fichier de sauvegarde', () => {
  it('fichier abîmé ou tronqué : message en français, sans jargon', () => {
    expect(() => parseBackupText('{"__cvmaker_backup": true, "modules": {')).toThrow(DAMAGED_BACKUP_MESSAGE);
    expect(() => parseBackupText('')).toThrow(DAMAGED_BACKUP_MESSAGE);
    expect(() => parseBackupText('{"__cvmaker_backup": true}')).toThrow(DAMAGED_BACKUP_MESSAGE);
    expect(DAMAGED_BACKUP_MESSAGE).not.toMatch(/JSON|SyntaxError|parse/i);
  });
  it('autre fichier : refusé avec un message clair', () => {
    expect(() => parseBackupText('{"title": "Mon CV"}')).toThrow(NOT_A_BACKUP_MESSAGE);
    expect(() => parseBackupText('[1, 2]')).toThrow(NOT_A_BACKUP_MESSAGE);
    expect(() => parseBackupText('null')).toThrow(NOT_A_BACKUP_MESSAGE);
  });
  it('sauvegarde valide : lue telle quelle', () => {
    const backup = parseBackupText(JSON.stringify(incomingBackup()));
    expect(backup.modules.master_entries).toHaveLength(1);
  });
});
