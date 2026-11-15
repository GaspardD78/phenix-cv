/** Écran 5 : photo facultative. Logique pure, sans React. */

/** Conseils affichés sur l'écran (même contenu que la page wiki « Photo »). */
export const PHOTO_TIPS: readonly string[] = [
  'Un fond neutre et clair, sans décor.',
  'Le visage centré, de face, bien éclairé.',
  'Une tenue proche de celle du poste visé.',
  'Une photo récente et nette.',
];

export const ACCEPTED_PHOTO_TYPES: readonly string[] = ['image/jpeg', 'image/png', 'image/webp'];
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;

/** Message d'erreur si le fichier ne convient pas, sinon null. */
export function validatePhotoFile(file: { type: string; size: number }): string | null {
  if (!ACCEPTED_PHOTO_TYPES.includes(file.type)) return 'Choisissez une image au format JPEG, PNG ou WebP.';
  if (file.size > MAX_PHOTO_BYTES) return 'Cette image est trop lourde (plus de 10 Mo). Choisissez-en une plus légère.';
  return null;
}

/**
 * Bouton de droite : avec une photo, l'étape est validée ; sans photo, elle est passée
 * (la photo restant facultative, on peut toujours continuer).
 */
export function photoContinue(hasPhoto: boolean): { action: 'complete' | 'skip'; label: string } {
  return hasPhoto
    ? { action: 'complete', label: 'Valider et continuer' }
    : { action: 'skip', label: 'Continuer sans photo' };
}
