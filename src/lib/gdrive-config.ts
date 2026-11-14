/**
 * Identifiants OAuth de la synchronisation Google Drive.
 *
 * Aucune valeur par défaut n'est embarquée dans le code. Ordre de résolution :
 *  1. identifiants fournis au build (`.env` : VITE_GDRIVE_CLIENT_ID, VITE_GDRIVE_CLIENT_SECRET) ;
 *  2. identifiants saisis dans Paramètres > Options avancées.
 * Sans identifiant, la synchronisation est désactivée (la sauvegarde locale .cvmaker reste disponible).
 */

export interface OAuthCredentials {
  clientId: string;
  /** Facultatif : les clients « application de bureau » fonctionnent en PKCE sans secret confidentiel. */
  clientSecret: string;
}

/** Réglages (table `settings`) de la saisie manuelle. */
export const CUSTOM_CLIENT_ID_KEY = 'gdrive_custom_client_id';
export const CUSTOM_CLIENT_SECRET_KEY = 'gdrive_custom_client_secret';

const clean = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

/** Fonction pure : le build l'emporte sur la saisie manuelle ; null si aucun identifiant client. */
export function resolveCredentials(
  build: { clientId?: unknown; clientSecret?: unknown },
  custom: { clientId?: unknown; clientSecret?: unknown },
): OAuthCredentials | null {
  const buildId = clean(build.clientId);
  if (buildId) return { clientId: buildId, clientSecret: clean(build.clientSecret) };
  const customId = clean(custom.clientId);
  if (customId) return { clientId: customId, clientSecret: clean(custom.clientSecret) };
  return null;
}
