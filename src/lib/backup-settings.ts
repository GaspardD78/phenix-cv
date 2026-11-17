/**
 * Réglages (table `settings`) dans les fichiers de sauvegarde. Pur, testable.
 *
 * - Export : aucun secret ne sort de l'ordinateur (jetons Google Drive, identifiants OAuth…).
 * - Import : seuls les réglages connus et utiles au CV sont repris (liste blanche). Tout le
 *   reste est ignoré : secrets (même présents dans le fichier), réglages propres à
 *   l'installation (thème, méthode d'export PDF, guide de démarrage) ou à une autre application.
 */
import { PROFILE_SETTING_NAMES } from './profile-settings';

/** Clés qui désignent un secret : jamais exportées, jamais importées. */
const SECRET_KEY_PATTERN = /token|secret|password|passwd|api[_-]?key|client[_-]?id|credential|oauth/i;

export function isSecretSettingKey(key: string): boolean {
  return SECRET_KEY_PATTERN.test(key);
}

/** Réglages globaux repris d'une sauvegarde. */
export const IMPORTABLE_SETTING_KEYS = ['ai_differentiator', 'cv_target_pages'] as const;

/** Réglages propres au profil (`<nom>:<profileId>`) repris d'une sauvegarde. */
const PROFILE_SETTING_PREFIXES = PROFILE_SETTING_NAMES.map(name => `${name}:`);

export function isImportableSettingKey(key: string): boolean {
  if (isSecretSettingKey(key)) return false;
  return (IMPORTABLE_SETTING_KEYS as readonly string[]).includes(key) || PROFILE_SETTING_PREFIXES.some(p => key.startsWith(p));
}

const keyOf = (row: Record<string, unknown>): string => (typeof row.key === 'string' ? row.key : '');

/** Lignes de réglages sans aucun secret (export local et envoi vers Google Drive). */
export function withoutSecretSettings(rows: readonly Record<string, unknown>[]): Record<string, unknown>[] {
  return rows.filter(row => !isSecretSettingKey(keyOf(row)));
}

export interface SettingsImportSplit {
  /** Lignes reprises. */
  kept: Record<string, unknown>[];
  /** Nombre de secrets écartés (jamais leur nom ni leur valeur). */
  secretCount: number;
  /** Autres réglages écartés (propres à l'installation ou inconnus). */
  ignoredKeys: string[];
}

/** Tri des réglages d'une sauvegarde avant import. */
export function splitImportSettings(rows: readonly Record<string, unknown>[]): SettingsImportSplit {
  const kept: Record<string, unknown>[] = [];
  const ignoredKeys: string[] = [];
  let secretCount = 0;
  for (const row of rows) {
    const key = keyOf(row);
    if (isSecretSettingKey(key)) secretCount++;
    else if (isImportableSettingKey(key)) kept.push(row);
    else ignoredKeys.push(key);
  }
  return { kept, secretCount, ignoredKeys };
}
