/**
 * Fichiers d'exemple CVmaker, produits par le VRAI code de sauvegarde de CVmaker (resume-forge).
 * Données fictives uniquement : Camille Martin, entreprises fictives, faux jetons.
 *
 *   CVMAKER_DIR=/chemin/vers/CVmaker bun test ./tests/fixtures/cvmaker/generate.ts
 *
 * CVMAKER_DIR est la racine d'un clone de GaspardD78/CVmaker (lecture seule : rien n'y est écrit),
 * avec l'historique jusqu'au commit OLD_COMMIT. Le fichier ne s'appelle pas *.test.ts : il ne tourne
 * ni avec `bun test` ni en CI. Les fichiers produits sont versionnés à côté ; voir README.md.
 */
import { test, expect, mock } from 'bun:test';
import { Database } from 'bun:sqlite';
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ROOT = process.env.CVMAKER_DIR;
const C = ROOT ? join(ROOT, 'resume-forge') : '';
const OUT = import.meta.dir;
/** Version de CVmaker du 8 mai 2026 (avant les angles de CV, le permis et les mentions d'en-tête). */
export const OLD_COMMIT = '9e28c88';

function sqlite(migrations: string[]) {
  const db = new Database(':memory:');
  for (const sql of migrations) db.exec(sql);
  return {
    raw: db,
    select: async (q: string, v: unknown[] = []) => db.query(q).all(...(v as never[])),
    execute: async (q: string, v: unknown[] = []) => { db.query(q).run(...(v as never[])); },
  };
}

const PHOTO = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

/** Camille Martin, telle qu'une personne l'aurait saisie dans CVmaker. `recent` : colonnes ajoutées après mai 2026. */
function fill(db: ReturnType<typeof sqlite>, profileId: string, recent: boolean) {
  const run = (q: string, ...v: unknown[]) => db.raw.query(q).run(...(v as never[]));
  run(`INSERT INTO profiles (id, first_name, last_name, email, phone, city, linkedin_url, github_url, portfolio_url, photo_path, title, summary)
       VALUES (?1,'Camille','Martin','camille.martin@example.com','06 00 00 00 00','Lyon','https://www.linkedin.com/in/camille-martin-exemple',
               'https://github.com/camille-martin-exemple','https://camille-martin.example',?2,'Assistante commerciale',
               'Assistante commerciale, 8 ans dans le négoce de matériaux.')`, profileId, recent ? PHOTO : null);
  if (recent) run(`UPDATE profiles SET driving_license = 'B', header_extras = '["Disponible immédiatement"]' WHERE id = ?1`, profileId);
  const entries: unknown[][] = [
    ['e-adv', 'experience', 'Assistante commerciale', 'Négoce Rhône Matériaux', '2018-03', null, 1, '- Suivi de 45 comptes clients\n- Saisie et suivi des commandes'],
    // Date au format « MM/AAAA » (ex. issue d'un import LinkedIn) : à normaliser.
    ['e-cab', 'experience', 'Assistante administrative', 'Cabinet Durand', '09/2015', '02/2018', 0, '- Accueil téléphonique\n- Facturation'],
    ['f-bts', 'education', 'BTS Négociation et relation client', 'Lycée du Parc', '2013', '2015', 0, null],
    ['s-cmd', 'skill', 'Gestion des commandes', null, null, null, 0, null],
    ['s-xls', 'skill', 'Excel', null, null, null, 0, null],
    ['l-en', 'language', 'Anglais', 'B2', null, null, 0, null],
  ];
  for (const [id, type, title, subtitle, start, end, current, description] of entries) {
    run(`INSERT INTO master_entries (id, profile_id, entry_type, title, subtitle, start_date, end_date, is_current, description, sort_order)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, 0)`, id, profileId, type, title, subtitle, start, end, current, description);
  }
  run(`INSERT INTO cv_documents (id, profile_id, name, template_id, target_job, settings) VALUES ('cv-adv', ?1, 'CV ADV', 'sidebar-modern', 'Assistante ADV', ?2)`,
    profileId, JSON.stringify({ cvLanguage: 'fr', dateFormat: 'short', photoShape: 'circle' }));
  run(`INSERT INTO cv_blocks (id, cv_id, block_type, entry_id, sort_order, is_visible) VALUES ('b-adv', 'cv-adv', 'entry_ref', 'e-adv', 0, 1)`);
  run(`INSERT INTO cv_blocks (id, cv_id, block_type, entry_id, sort_order, is_visible) VALUES ('b-cab', 'cv-adv', 'entry_ref', 'e-cab', 1, 1)`);
  // Ancienne ligne de compétences reformulée par l'IA (avant les étiquettes).
  run(`INSERT INTO cv_blocks (id, cv_id, block_type, custom_content, override_data, sort_order, is_visible) VALUES ('b-skl', 'cv-adv', 'custom_text', 'Relation client, gestion des commandes, ADV', ?1, 2, 1)`,
    JSON.stringify({ aiSkillLine: true }));
  run(`INSERT INTO applications (id, profile_id, cv_id, company_name, job_title, status, applied_at) VALUES ('a-val', ?1, 'cv-adv', 'Laiterie du Val', 'Assistante ADV', 'applied', '2026-03-12T09:00:00.000Z')`, profileId);
  run(`INSERT INTO application_events (id, application_id, event_type, title) VALUES ('ev-1', 'a-val', 'email_sent', 'Candidature envoyée')`);
  run(`INSERT INTO application_attachments (id, application_id, file_name, file_path, label) VALUES ('at-1', 'a-val', 'CV-Camille-Martin.pdf', 'C:\\Users\\camille\\Documents\\CV-Camille-Martin.pdf', 'cv')`);
  // Réglages : utiles au CV, propres à l'installation, et secrets (faux) qui ne doivent jamais être repris.
  run(`INSERT OR REPLACE INTO settings (key, value) VALUES ('cv_target_pages', '1')`);
  run(`INSERT INTO settings (key, value) VALUES (?1, 'Pas de poste à plus de 45 minutes de Lyon.')`, `cv_personal_rules:${profileId}`);
  run(`INSERT INTO settings (key, value) VALUES (?1, ?2)`, `gdrive_tokens_${profileId}`, JSON.stringify({ accessToken: 'FAUX-JETON-ACCES', refreshToken: 'FAUX-JETON-RENOUVELLEMENT', expiresAt: 1 }));
  // Veille emploi, avec des secrets (faux) : n'existe pas dans Phénix CV.
  const watchKeys = [['emailSmtpPassword', 'FAUX-MOT-DE-PASSE'], ['ftClientSecret', 'FAUX-SECRET-FT'], ['navitiaApiKey', 'FAUX-CLE-NAVITIA']];
  for (const [key, value] of watchKeys) run(`INSERT OR REPLACE INTO job_watch_settings (key, profile_id, value) VALUES (?1, ?2, ?3)`, key, profileId, value);
  run(`INSERT INTO job_watch_config (id, source) VALUES ('w-1', 'france_travail')`);
  run(`INSERT INTO job_offers (id, source, url, hash, title) VALUES ('o-1', 'france_travail', 'https://offres.example/assistante-adv', 'h-1', 'Assistante ADV – Laiterie du Val')`);
}

/**
 * Copie temporaire du code de CVmaker (src + tsconfig), avec des modules Tauri de remplacement :
 * le clone de CVmaker n'est jamais modifié, et ses imports se résolvent hors de Phénix CV.
 */
function stage(): string {
  const dir = mkdtempSync(join(tmpdir(), 'cvmaker-src-'));
  cpSync(join(C, 'src'), join(dir, 'src'), { recursive: true });
  cpSync(join(C, 'tsconfig.json'), join(dir, 'tsconfig.json'));
  const stub = (name: string, code: string) => {
    const pkg = join(dir, 'node_modules', '@tauri-apps', name);
    mkdirSync(pkg, { recursive: true });
    writeFileSync(join(pkg, 'package.json'), JSON.stringify({ name: `@tauri-apps/${name}`, main: 'index.js', type: 'module' }));
    writeFileSync(join(pkg, 'index.js'), code);
  };
  stub('plugin-dialog', 'export const save = async () => null; export const open = async () => null;');
  stub('plugin-fs', "export const writeTextFile = async () => {}; export const readTextFile = async () => '';");
  return dir;
}

const migrationsOf = (dir: string) => readdirSync(dir).filter(f => f.endsWith('.sql')).sort().map(f => readFileSync(join(dir, f), 'utf8'));

test.skipIf(!ROOT)('fichiers d\'exemple produits par le code de CVmaker', async () => {
  const S = stage();
  let db = sqlite(migrationsOf(join(C, 'src-tauri', 'migrations')));
  const dbModule = () => ({ getDb: async () => db, getSetting: async () => null, setSetting: async () => {} });
  mock.module(join(S, 'src', 'lib', 'db.ts'), dbModule);
  mock.module(join(S, 'src', 'stores', 'authStore.ts'), () => ({ useAuthStore: { getState: () => ({ currentUserId: null }) } }));

  // 1. Version actuelle de CVmaker.
  const head = execFileSync('git', ['-C', ROOT!, 'rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim();
  fill(db, 'cvm-recent', true);
  const recentModule = await import(join(S, 'src', 'lib', 'backup.ts'));
  const recent = await recentModule.buildBackupData(recentModule.MODULES.map((m: { id: string }) => m.id));
  recent.exportDate = '2026-11-15T10:00:00.000Z'; // fixe : fichiers reproductibles
  const recentJson = JSON.stringify(recent, null, 2);
  writeFileSync(join(OUT, 'camille-martin-recent.cvmaker'), recentJson);
  // Fichier abîmé : la même sauvegarde, tronquée (téléchargement interrompu).
  writeFileSync(join(OUT, 'camille-martin-abime.cvmaker'), recentJson.slice(0, Math.floor(recentJson.length / 2)));

  // 2. Version du 8 mai 2026 : sources et migrations de l'époque, extraites de l'historique.
  const show = (path: string) => execFileSync('git', ['-C', ROOT!, 'show', `${OLD_COMMIT}:resume-forge/${path}`], { encoding: 'utf8' });
  const oldDir = join(S, 'src', 'lib', 'ancien');
  mkdirSync(oldDir);
  // Le module de mai 2026 importe « @/lib/db » (remplacé ci-dessus) et sa propre validation.
  writeFileSync(join(oldDir, 'backup.ts'), show('src/lib/backup.ts'));
  writeFileSync(join(oldDir, 'validation.ts'), show('src/lib/validation.ts'));
  const oldMigrations = execFileSync('git', ['-C', ROOT!, 'ls-tree', '--name-only', OLD_COMMIT, 'resume-forge/src-tauri/migrations/'], { encoding: 'utf8' })
    .trim().split('\n').sort();
  db = sqlite(oldMigrations.map(p => execFileSync('git', ['-C', ROOT!, 'show', `${OLD_COMMIT}:${p}`], { encoding: 'utf8' })));
  fill(db, 'cvm-ancien', false);
  const oldModule = await import(join(oldDir, 'backup.ts'));
  const oldBackup = await oldModule.buildBackupData(oldModule.MODULES.map((m: { id: string }) => m.id));
  oldBackup.exportDate = '2026-05-10T10:00:00.000Z';
  writeFileSync(join(OUT, 'camille-martin-2026-05.cvmaker'), JSON.stringify(oldBackup, null, 2));

  writeFileSync(join(OUT, 'SOURCE.txt'), `Produits par generate.ts avec CVmaker ${head} (récent) et ${OLD_COMMIT} (mai 2026).\n`);
  expect(recent.__cvmaker_backup).toBe(true);
  expect(oldBackup.__cvmaker_backup).toBe(true);
});
