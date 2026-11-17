/**
 * Import d'une sauvegarde CVmaker dans un Phénix CV qui contient déjà des données. Pur, testable.
 *
 * - Doublons : une entrée du fichier identique à une entrée du profil (même type, même intitulé,
 *   même organisme, même début) n'est pas recréée ; tout ce qui y renvoie (blocs de CV, réglages)
 *   pointe vers l'entrée déjà présente.
 * - Profil : en fusion, une information déjà renseignée n'est remplacée que si la personne le choisit.
 * - Rapport : ce qui a été importé, converti, laissé de côté, et où est la sauvegarde automatique.
 */
import { MODULES, type BackupData, type ImportPlan as RestorePlan } from '@/lib/backup';
import { normalizeText } from '@/lib/tracker-import/fields';
import type { ConversionReport } from './convert';

export interface ExistingEntry {
  id: string;
  entry_type: string;
  title: string;
  subtitle: string | null;
  start_date: string | null;
}

export interface DuplicateEntry {
  incomingId: string;
  existingId: string;
  label: string;
}

const KEYED_BY_TITLE = new Set(['skill', 'language', 'interest']);
const str = (v: unknown) => (typeof v === 'string' ? v : '');

function entryKey(e: Record<string, unknown> | ExistingEntry): string {
  const r = e as Record<string, unknown>;
  const type = str(r.entry_type);
  const title = normalizeText(str(r.title));
  if (KEYED_BY_TITLE.has(type)) return `${type}|${title}`;
  return `${type}|${title}|${normalizeText(str(r.subtitle))}|${str(r.start_date).slice(0, 7)}`;
}

/** Remplace un identifiant dans un texte JSON (réglages, données de bloc), entre guillemets uniquement. */
const replaceId = (value: unknown, from: string, to: string): unknown =>
  typeof value === 'string' && value.includes(`"${from}"`) ? value.split(`"${from}"`).join(`"${to}"`) : value;

/** Entrées du fichier déjà présentes dans le profil : retirées, et les références redirigées. */
export function dedupeEntries(backup: BackupData, existing: readonly ExistingEntry[]): { backup: BackupData; duplicates: DuplicateEntry[] } {
  const known = new Map(existing.map(e => [entryKey(e), e]));
  const duplicates: DuplicateEntry[] = [];
  const kept: Record<string, unknown>[] = [];
  for (const row of backup.modules['master_entries'] ?? []) {
    const twin = known.get(entryKey(row));
    if (twin && twin.id !== row.id) {
      const subtitle = str(row.subtitle);
      duplicates.push({ incomingId: str(row.id), existingId: twin.id, label: `${str(row.title)}${subtitle ? ` (${subtitle})` : ''}` });
    } else {
      kept.push(row);
    }
  }
  if (duplicates.length === 0) return { backup, duplicates };

  const remap = (rows: Record<string, unknown>[] | undefined, columns: string[]) => rows?.map(r => {
    const out = { ...r };
    for (const d of duplicates) {
      if (out.entry_id === d.incomingId) out.entry_id = d.existingId;
      for (const c of columns) out[c] = replaceId(out[c], d.incomingId, d.existingId);
    }
    return out;
  });
  return {
    duplicates,
    backup: {
      ...backup,
      modules: {
        ...backup.modules,
        master_entries: kept,
        cv_blocks: remap(backup.modules['cv_blocks'], ['override_data']),
        cv_documents: remap(backup.modules['cv_documents'], ['settings']),
      },
    },
  };
}

// ─── Profil ───────────────────────────────────────────────────────────────────

export const PROFILE_FIELDS: readonly { column: string; label: string }[] = [
  { column: 'first_name', label: 'Prénom' },
  { column: 'last_name', label: 'Nom' },
  { column: 'title', label: 'Titre' },
  { column: 'summary', label: 'Résumé' },
  { column: 'email', label: 'E-mail' },
  { column: 'phone', label: 'Téléphone' },
  { column: 'address', label: 'Adresse' },
  { column: 'city', label: 'Ville' },
  { column: 'postal_code', label: 'Code postal' },
  { column: 'country', label: 'Pays' },
  { column: 'linkedin_url', label: 'LinkedIn' },
  { column: 'other_url', label: 'Lien personnel' },
  { column: 'driving_license', label: 'Permis' },
  { column: 'header_extras', label: 'Mentions d\'en-tête' },
  { column: 'photo_path', label: 'Photo' },
];

export interface ProfileDifference {
  column: string;
  label: string;
  mine: string;
  theirs: string;
}

const filled = (v: unknown) => v !== null && v !== undefined && String(v).trim() !== '' && String(v) !== '[]';

/** Informations renseignées des deux côtés, mais différentes : à choisir une par une. */
export function profileDifferences(current: Record<string, unknown> | null, incoming: Record<string, unknown> | undefined): ProfileDifference[] {
  if (!current || !incoming) return [];
  return PROFILE_FIELDS.flatMap(({ column, label }) => {
    const mine = current[column];
    const theirs = incoming[column];
    if (!filled(mine) || !filled(theirs) || String(mine).trim() === String(theirs).trim()) return [];
    return [{ column, label, mine: String(mine), theirs: String(theirs) }];
  });
}

/** Champs que le fichier remplit alors qu'ils sont vides dans Phénix CV. */
export function profileFills(current: Record<string, unknown> | null, incoming: Record<string, unknown> | undefined): string[] {
  if (!incoming) return [];
  return PROFILE_FIELDS.filter(({ column }) => filled(incoming[column]) && !filled(current?.[column])).map(f => f.label);
}

/**
 * Choix de la personne appliqués au profil du fichier : une information gardée de Phénix CV est
 * retirée du fichier (la fusion ne remplace jamais par du vide).
 */
export function applyProfileChoices(backup: BackupData, keepMine: ReadonlySet<string>): BackupData {
  const profiles = backup.modules['profiles'];
  if (!profiles || keepMine.size === 0) return backup;
  return {
    ...backup,
    modules: {
      ...backup.modules,
      profiles: profiles.map(row => {
        const out = { ...row };
        for (const column of keepMine) out[column] = null;
        return out;
      }),
    },
  };
}

// ─── Plan de restauration ─────────────────────────────────────────────────────

export type CvmakerImportMode = 'merge' | 'replace';

/** Même choix pour toutes les parties du fichier : tout fusionner, ou tout remplacer. */
export function restorePlan(backup: BackupData, mode: CvmakerImportMode): RestorePlan {
  const plan: RestorePlan = {};
  for (const { id, tables } of MODULES) {
    if (tables.some(t => Array.isArray(backup.modules[t]) && backup.modules[t]!.length > 0)) plan[id] = mode;
  }
  return plan;
}

// ─── Rapport ──────────────────────────────────────────────────────────────────

export interface CvmakerImportReport {
  lines: string[];
  converted: string[];
  ignored: ConversionReport['ignored'];
  warnings: string[];
  cvs: { id: string; name: string }[];
  autoBackupPath: string | null;
}

const plural = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`;

export function buildImportReport(
  conversion: ConversionReport,
  imported: BackupData,
  duplicates: readonly DuplicateEntry[],
  mode: CvmakerImportMode,
  autoBackupPath: string | null,
): CvmakerImportReport {
  const c = conversion.counts;
  const entriesAdded = (imported.modules['master_entries'] ?? []).length;
  const lines = [
    mode === 'replace' ? 'Vos données ont été remplacées par celles de CVmaker.' : 'Vos données CVmaker ont été ajoutées à celles de Phénix CV.',
    c.profiles ? 'Profil et coordonnées repris.' : '',
    entriesAdded ? `${plural(entriesAdded, 'élément de profil ajouté', 'éléments de profil ajoutés')} (expériences, formations, compétences…).` : '',
    duplicates.length ? `${plural(duplicates.length, 'élément déjà présent n\'a pas été dupliqué', 'éléments déjà présents n\'ont pas été dupliqués')}.` : '',
    c.cvs ? `${plural(c.cvs, 'CV importé', 'CV importés')}.` : '',
    c.applications ? `${plural(c.applications, 'candidature importée', 'candidatures importées')}.` : '',
  ].filter(Boolean);
  return {
    lines,
    converted: conversion.converted,
    ignored: conversion.ignored,
    warnings: conversion.warnings,
    cvs: (imported.modules['cv_documents'] ?? []).map(r => ({ id: str(r.id), name: str(r.name) || 'CV sans nom' })),
    autoBackupPath,
  };
}
