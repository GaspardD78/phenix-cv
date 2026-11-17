/**
 * Origine d'un fichier de sauvegarde : Phénix CV ou CVmaker (ResumeForge). Pur, testable.
 *
 * Les deux applications écrivent le même format (`__cvmaker_backup`, `version: "1.0"`), et la version
 * de CVmaker n'a jamais changé. L'origine et l'âge se lisent donc dans le contenu :
 * - Phénix CV écrit `app: "phenix-cv"` depuis le format 2 ; avant, son profil a la colonne `other_url`.
 * - CVmaker : profil avec `github_url` / `portfolio_url`, ou tables de la veille emploi (`job_*`).
 * - Âge d'un fichier CVmaker : colonnes et tables apparues au fil de ses migrations.
 */
import type { BackupData } from '@/lib/backup';

export type BackupApp = 'phenix' | 'cvmaker' | 'inconnue';

export interface BackupOrigin {
  app: BackupApp;
  /**
   * CVmaker : date de la plus ancienne version capable d'écrire ce fichier (AAAA-MM-JJ), d'après les
   * colonnes présentes ; `null` si le fichier ne contient pas de quoi en juger.
   */
  cvmakerSince: string | null;
  /** Le fichier ne contient ni profil, ni entrée, ni CV, ni candidature : rien à importer. */
  empty: boolean;
}

/** Repères de l'évolution du schéma de CVmaker (du plus récent au plus ancien). */
export const CVMAKER_MILESTONES = [
  { since: '2026-10-29', test: (b: BackupData) => hasColumn(b, 'profiles', 'driving_license') || hasColumn(b, 'profiles', 'header_extras') },
  { since: '2026-10-04', test: (b: BackupData) => Array.isArray(b.modules['cv_angles']) },
  { since: '2026-04-14', test: (b: BackupData) => hasColumn(b, 'cv_documents', 'markdown_content') },
] as const;

/** Première version de CVmaker qui savait exporter une sauvegarde. */
export const CVMAKER_FIRST_BACKUP = '2026-03-12';

const rowsOf = (b: BackupData, table: string): Record<string, unknown>[] => {
  const rows = b.modules[table];
  return Array.isArray(rows) ? rows : [];
};

function hasColumn(b: BackupData, table: string, column: string): boolean {
  return rowsOf(b, table).some(row => row !== null && typeof row === 'object' && column in row);
}

const CONTENT_TABLES = ['profiles', 'master_entries', 'cv_documents', 'applications'];

export function detectBackupOrigin(backup: BackupData): BackupOrigin {
  const empty = CONTENT_TABLES.every(t => rowsOf(backup, t).length === 0);
  const marker = (backup as { app?: unknown }).app;
  if (marker === 'phenix-cv') return { app: 'phenix', cvmakerSince: null, empty };

  const cvmaker = hasColumn(backup, 'profiles', 'github_url') || hasColumn(backup, 'profiles', 'portfolio_url')
    || Object.keys(backup.modules).some(t => t.startsWith('job_'));
  if (cvmaker) {
    const milestone = CVMAKER_MILESTONES.find(m => m.test(backup));
    // Sans ligne de profil ni de CV, l'âge ne se lit pas.
    const judged = rowsOf(backup, 'profiles').length > 0 || rowsOf(backup, 'cv_documents').length > 0;
    return { app: 'cvmaker', cvmakerSince: milestone?.since ?? (judged ? CVMAKER_FIRST_BACKUP : null), empty };
  }
  if (hasColumn(backup, 'profiles', 'other_url')) return { app: 'phenix', cvmakerSince: null, empty };
  return { app: 'inconnue', cvmakerSince: null, empty };
}

const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

/** Phrase pour l'écran d'aperçu : « Sauvegarde CVmaker (version d'octobre 2026 ou plus récente) ». */
export function describeOrigin(origin: BackupOrigin): string {
  if (origin.app === 'phenix') return 'Sauvegarde Phénix CV';
  if (origin.app === 'inconnue') return 'Sauvegarde Phénix CV ou CVmaker';
  if (!origin.cvmakerSince) return 'Sauvegarde CVmaker';
  const [year, month] = origin.cvmakerSince.split('-').map(Number);
  const name = MONTHS[month - 1];
  const article = /^[aeiouéèêh]/i.test(name) ? 'd\'' : 'de ';
  return `Sauvegarde CVmaker (version ${article}${name} ${year} ou plus récente)`;
}

export const EMPTY_BACKUP_MESSAGE = 'Ce fichier ne contient ni profil, ni CV, ni candidature : il n\'y a rien à importer.';
