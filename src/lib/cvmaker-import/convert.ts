/**
 * Conversion d'une sauvegarde CVmaker (ResumeForge) en sauvegarde Phénix CV, avant import. Pur, testable.
 *
 * Le résultat passe ensuite par la restauration habituelle (`importBackup`, lib/backup.ts), qui
 * applique la liste blanche des réglages et la sauvegarde automatique. Ici :
 * - seules les tables que Phénix CV connaît sont gardées (la veille emploi est écartée et comptée) ;
 * - profil : les deux liens de CVmaker (GitHub, site) deviennent l'unique lien personnel ; photo vérifiée ;
 * - entrées : dates ramenées au format AAAA-MM quand c'est sans ambiguïté ;
 * - CV : modèle inconnu remplacé par « Classique » ;
 * - jamais de secret (jetons, identifiants, mots de passe), même présent dans le fichier.
 * Le rapport décrit, en français, ce qui sera importé, converti et laissé de côté.
 */
import type { BackupData } from '@/lib/backup';
import { templates } from '@/templates';
import { splitImportSettings } from '@/lib/backup-settings';
import { detectBackupOrigin, type BackupOrigin } from './detect';

/** Tables qu'une sauvegarde peut apporter à Phénix CV (mêmes que l'ordre d'insertion de la restauration). */
export const PHENIX_TABLES = [
  'profiles', 'settings', 'master_entries', 'cv_angles', 'cv_documents', 'cv_blocks',
  'applications', 'application_events', 'application_attachments',
] as const;

/** Modèle de remplacement pour un modèle de CV inconnu. */
export const FALLBACK_TEMPLATE_ID = 'ats-classic';

/** Photo acceptée : image PNG, JPEG ou WebP en base64, au plus ~6 Mo. */
const PHOTO_RE = /^data:image\/(png|jpe?g|webp);base64,[A-Za-z0-9+/=\s]+$/;
export const MAX_PHOTO_CHARS = 8_000_000;

export type LinkChoice = 'portfolio' | 'github';

export interface CvmakerConversionOptions {
  /** Lien gardé quand le profil a à la fois un site et un GitHub (défaut : le site). */
  keepLink?: LinkChoice;
}

export interface IgnoredItem {
  label: string;
  count: number;
  reason: string;
}

export interface ConversionReport {
  origin: BackupOrigin;
  counts: {
    profiles: number; experiences: number; educations: number; skills: number; languages: number;
    otherEntries: number; cvs: number; applications: number;
  };
  /** Liens du profil trouvés dans le fichier, et celui gardé (pour le choix à l'écran d'aperçu). */
  links: { github: string | null; portfolio: string | null; kept: string | null };
  /** Ce qui a été converti, en phrases. */
  converted: string[];
  /** Ce qui ne sera pas importé, et pourquoi. */
  ignored: IgnoredItem[];
  /** Points à vérifier après l'import. */
  warnings: string[];
}

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);
const rowsOf = (b: BackupData, table: string): Record<string, unknown>[] => {
  const rows = b.modules[table];
  return Array.isArray(rows) ? rows.filter(r => r !== null && typeof r === 'object') : [];
};
const plural = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`;

// ─── Dates ────────────────────────────────────────────────────────────────────

export interface NormalizedDate {
  value: string | null;
  /** Valeur modifiée (ex. « 09/2015 » → « 2015-09 »). */
  changed: boolean;
  /** `false` : format non reconnu, valeur gardée telle quelle. */
  recognized: boolean;
}

const pad = (n: number) => String(n).padStart(2, '0');
const validMonth = (m: number) => m >= 1 && m <= 12;
const validDay = (y: number, m: number, d: number) => d >= 1 && d <= new Date(Date.UTC(y, m, 0)).getUTCDate();

/** Date d'entrée au format attendu (AAAA, AAAA-MM ou AAAA-MM-JJ), sans jamais deviner un jour ou un mois absent. */
export function normalizeEntryDate(raw: unknown): NormalizedDate {
  if (raw === null || raw === undefined || (typeof raw === 'string' && !raw.trim())) return { value: null, changed: false, recognized: true };
  const text = String(raw).trim();
  let m = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?(?:[T ].*)?$/.exec(text);
  if (m) {
    const [y, mo, d] = [Number(m[1]), m[2] ? Number(m[2]) : null, m[3] ? Number(m[3]) : null];
    if (mo !== null && !validMonth(mo)) return { value: text, changed: false, recognized: false };
    if (d !== null && mo !== null && !validDay(y, mo, d)) return { value: text, changed: false, recognized: false };
    const value = d !== null ? `${y}-${pad(mo!)}-${pad(d)}` : mo !== null ? `${y}-${pad(mo)}` : `${y}`;
    return { value, changed: value !== text, recognized: true };
  }
  // « 09/2015 », « 9-2015 » → mois et année.
  m = /^(\d{1,2})[/.-](\d{4})$/.exec(text);
  if (m && validMonth(Number(m[1]))) return { value: `${m[2]}-${pad(Number(m[1]))}`, changed: true, recognized: true };
  // « 2015/09 » → année et mois.
  m = /^(\d{4})[/.](\d{1,2})$/.exec(text);
  if (m && validMonth(Number(m[2]))) return { value: `${m[1]}-${pad(Number(m[2]))}`, changed: true, recognized: true };
  // « 12/03/2015 » → jour, mois, année (format français).
  m = /^(\d{1,2})[/.](\d{1,2})[/.](\d{4})$/.exec(text);
  if (m) {
    const [d, mo, y] = [Number(m[1]), Number(m[2]), Number(m[3])];
    if (validMonth(mo) && validDay(y, mo, d)) return { value: `${y}-${pad(mo)}-${pad(d)}`, changed: true, recognized: true };
  }
  return { value: text, changed: false, recognized: false };
}

// ─── Conversion ───────────────────────────────────────────────────────────────

const JOB_WATCH_LABELS: Record<string, [string, string]> = {
  job_watch_config: ['recherche enregistrée', 'recherches enregistrées'],
  job_offers: ['offre sauvegardée', 'offres sauvegardées'],
};

export function convertCvmakerBackup(
  source: BackupData,
  opts: CvmakerConversionOptions = {},
): { backup: BackupData; report: ConversionReport } {
  const origin = detectBackupOrigin(source);
  const converted: string[] = [];
  const ignored: IgnoredItem[] = [];
  const warnings: string[] = [];
  const modules: BackupData['modules'] = {};

  // Tables inconnues de Phénix CV : jamais importées, comptées.
  let watchRows = 0;
  const watchParts: string[] = [];
  let otherRows = 0;
  for (const [table, rows] of Object.entries(source.modules)) {
    if ((PHENIX_TABLES as readonly string[]).includes(table)) continue;
    const n = Array.isArray(rows) ? rows.length : 0;
    if (table.startsWith('job_')) {
      watchRows += n;
      const label = JOB_WATCH_LABELS[table];
      if (label && n > 0) watchParts.push(plural(n, label[0], label[1]));
    } else {
      otherRows += n;
    }
  }
  if (watchRows > 0) {
    ignored.push({
      label: `Veille emploi${watchParts.length ? ` (${watchParts.join(', ')})` : ''}`,
      count: watchRows,
      reason: 'La veille emploi n\'existe pas dans Phénix CV. Ses réglages, identifiants compris, ne sont pas repris.',
    });
  }
  if (otherRows > 0) {
    ignored.push({ label: 'Autres données de CVmaker', count: otherRows, reason: 'Elles concernent des fonctions qui n\'existent pas dans Phénix CV.' });
  }

  // Profil : liens et photo.
  let links: ConversionReport['links'] = { github: null, portfolio: null, kept: null };
  modules['profiles'] = rowsOf(source, 'profiles').map(row => {
    const { github_url, portfolio_url, ...rest } = row;
    const github = str(github_url);
    const portfolio = str(portfolio_url);
    const existing = str(rest.other_url);
    const preferred = opts.keepLink === 'github' ? github ?? portfolio : portfolio ?? github;
    const kept = existing ?? preferred;
    links = { github, portfolio, kept };
    const out: Record<string, unknown> = { ...rest };
    if (!existing && kept) out.other_url = kept;
    if (github && portfolio && !existing) {
      const dropped = kept === portfolio ? `GitHub (${github})` : `site (${portfolio})`;
      converted.push(`Phénix CV garde un seul lien personnel : ${kept === portfolio ? 'votre site' : 'votre GitHub'} est repris. Votre lien ${dropped} ne l'est pas ; vous pourrez changer ce choix.`);
    } else if (!existing && kept) {
      converted.push(`Votre lien ${kept === github ? 'GitHub' : 'de site'} devient votre lien personnel.`);
    }
    const photo = str(out.photo_path);
    if (photo && (!PHOTO_RE.test(photo) || photo.length > MAX_PHOTO_CHARS)) {
      out.photo_path = null;
      warnings.push('Votre photo n\'a pas pu être reprise. Ajoutez-la à nouveau dans « Mon profil ».');
    }
    return out;
  });

  // Entrées : dates.
  let changedDates = 0;
  modules['master_entries'] = rowsOf(source, 'master_entries').map(row => {
    const out = { ...row };
    for (const col of ['start_date', 'end_date'] as const) {
      const d = normalizeEntryDate(row[col]);
      if (d.changed) changedDates++;
      if (!d.recognized) {
        warnings.push(`Date non reconnue « ${d.value} » pour « ${str(row.title) ?? 'une entrée'} » : vérifiez-la dans « Mon profil ».`);
      }
      if (col in row || d.value !== null) out[col] = d.value;
    }
    return out;
  });
  if (changedDates > 0) converted.push(`${plural(changedDates, 'date mise', 'dates mises')} au format de Phénix CV (par exemple « 09/2015 » devient « septembre 2015 »).`);

  // CV : modèles.
  modules['cv_documents'] = rowsOf(source, 'cv_documents').map(row => {
    const id = str(row.template_id);
    if (id && templates[id]) return { ...row };
    converted.push(`Le CV « ${str(row.name) ?? 'sans nom'} » utilisait un modèle absent de Phénix CV : il passe au modèle « ${templates[FALLBACK_TEMPLATE_ID].name} ».`);
    return { ...row, template_id: FALLBACK_TEMPLATE_ID };
  });

  for (const table of ['cv_angles', 'cv_blocks', 'applications', 'application_events', 'application_attachments'] as const) {
    if (Array.isArray(source.modules[table])) modules[table] = rowsOf(source, table).map(r => ({ ...r }));
  }

  // Anciennes lignes de compétences : affichées telles quelles, à convertir en étiquettes par la personne.
  const cvWithSkillLines = new Set(
    rowsOf(source, 'cv_blocks').filter(b => {
      const raw = b.override_data;
      try {
        const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
        return Boolean(data && typeof data === 'object' && (data as Record<string, unknown>).aiSkillLine);
      } catch {
        return false;
      }
    }).map(b => b.cv_id),
  );
  if (cvWithSkillLines.size > 0) {
    warnings.push(`${plural(cvWithSkillLines.size, 'CV contient', 'CV contiennent')} d'anciennes lignes de compétences. Ouvrez-${cvWithSkillLines.size > 1 ? 'les' : 'le'} et cliquez sur « Convertir en étiquettes » pour les relire.`);
  }

  const attachments = rowsOf(source, 'application_attachments').length;
  if (attachments > 0) {
    warnings.push(`${plural(attachments, 'pièce jointe de candidature', 'pièces jointes de candidature')} : seul le nom est repris. Les fichiers sont restés sur l'ordinateur où vous utilisiez CVmaker.`);
  }

  // Réglages : jamais de secret (la restauration applique aussi la liste blanche).
  if (Array.isArray(source.modules['settings'])) {
    const split = splitImportSettings(rowsOf(source, 'settings'));
    modules['settings'] = split.kept;
    if (split.secretCount > 0) {
      ignored.push({
        label: 'Connexions et identifiants (Google Drive…)',
        count: split.secretCount,
        reason: 'Par sécurité, ils ne sont jamais repris d\'un fichier. Reconnectez Google Drive dans Phénix CV si vous l\'utilisez.',
      });
    }
  }

  const entries = modules['master_entries'] ?? [];
  const byType = (type: string) => entries.filter(e => e.entry_type === type).length;
  const counts: ConversionReport['counts'] = {
    profiles: modules['profiles']?.length ?? 0,
    experiences: byType('experience'),
    educations: byType('education'),
    skills: byType('skill'),
    languages: byType('language'),
    otherEntries: entries.length - byType('experience') - byType('education') - byType('skill') - byType('language'),
    cvs: modules['cv_documents']?.length ?? 0,
    applications: rowsOf(source, 'applications').length,
  };

  return {
    backup: { ...source, modules, counts: source.counts },
    report: { origin, counts, links, converted, ignored, warnings },
  };
}
