/**
 * Affichage de la photo sur un CV : réglage propre à chaque CV (`cv.settings.showPhoto`),
 * indépendant de la photo de « Mon profil », qui n'est jamais modifiée.
 *
 * Un CV sans réglage affiche la photo (comportement d'avant l'interrupteur). Seule la valeur
 * `false` la masque. Le rendu écran / PDF, l'export Word et le garde-fou passent tous par
 * `isPhotoShown` pour ne jamais diverger. Fonctions pures.
 */
import type { Profile } from '@/types/profile';

/** Clé du réglage dans `cv.settings`. */
export const SHOW_PHOTO_SETTING = 'showPhoto';

/** Valeur de l'interrupteur « Afficher la photo » (vrai tant que le candidat ne l'a pas coupé). */
export function readShowPhoto(settings: Record<string, unknown> | null | undefined): boolean {
  return settings?.[SHOW_PHOTO_SETTING] !== false;
}

/** La photo sort-elle sur ce CV ? Il faut une photo dans le profil ET l'interrupteur actif. */
export function isPhotoShown(
  profile: Pick<Profile, 'photoPath'> | null | undefined,
  settings: Record<string, unknown> | null | undefined,
): boolean {
  return Boolean(profile?.photoPath) && readShowPhoto(settings);
}

/** Réglages du CV avec l'interrupteur modifié ; les autres réglages sont conservés. */
export function withShowPhoto(settings: Record<string, unknown> | null | undefined, shown: boolean): Record<string, unknown> {
  return { ...(settings ?? {}), [SHOW_PHOTO_SETTING]: shown };
}
