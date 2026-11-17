/**
 * Où sont les données : version portable (dossier `data` à côté de l'application, par exemple sur une
 * clé USB) ou application installée. L'information vient du côté Rust (`get_app_mode`) ; hors de
 * l'application (navigateur, tests), on ne sait rien et on n'affiche rien. Fonctions pures, sauf `getAppMode`.
 */
import { invoke } from '@tauri-apps/api/core';

export interface AppMode {
  /** Fichier `.portable` présent et dossier `data` utilisable. */
  portable: boolean;
  /** Dossier des données (portable : `data` ; sinon le dossier de données de Windows). */
  dataDir: string | null;
  /** Le fichier `.portable` est présent mais le dossier `data` n'est pas utilisable. */
  warning: string | null;
}

export const UNKNOWN_APP_MODE: AppMode = { portable: false, dataDir: null, warning: null };

/** Lecture prudente de la réponse du backend. */
export function normalizeAppMode(raw: unknown): AppMode {
  if (raw === null || typeof raw !== 'object') return UNKNOWN_APP_MODE;
  const r = raw as Record<string, unknown>;
  const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v : null);
  return { portable: r.portable === true, dataDir: str(r.dataDir), warning: str(r.warning) };
}

export async function getAppMode(): Promise<AppMode> {
  try {
    return normalizeAppMode(await invoke('get_app_mode'));
  } catch {
    return UNKNOWN_APP_MODE;
  }
}

export interface AppModeText {
  tone: 'portable' | 'installed' | 'warning';
  title: string;
  /** Une phrase par élément. */
  lines: string[];
}

/** Textes de l'écran « Mes données » ; `null` quand on ne sait rien (hors de l'application). */
export function describeAppMode(mode: AppMode): AppModeText | null {
  if (mode.portable) {
    return {
      tone: 'portable',
      title: 'Version portable',
      lines: [
        'Vos données sont dans le dossier « data », à côté de l\'application. Rien n\'est laissé sur l\'ordinateur qui vous prête sa prise USB.',
        'Pour les emporter, copiez le dossier de l\'application en entier, « data » compris. Fermez Phénix CV avant de retirer la clé.',
      ],
    };
  }
  if (mode.warning) {
    return {
      tone: 'warning',
      title: 'Version portable : le dossier « data » n\'est pas utilisable',
      lines: [mode.warning, 'Déplacez l\'application dans un dossier où vous pouvez écrire (votre clé USB, vos documents), puis relancez-la.'],
    };
  }
  if (mode.dataDir) return { tone: 'installed', title: 'Où sont vos données', lines: ['Vos données sont enregistrées sur cet ordinateur.'] };
  return null;
}
