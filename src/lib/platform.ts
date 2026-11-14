/**
 * Helpers de détection de plateforme.
 * Centralisés ici pour éviter les duplications dans export-pdf.ts, export-docx.ts, etc.
 */

/** Retourne true si l'application tourne dans un contexte Tauri (application de bureau). */
export function isTauri(): boolean {
  return '__TAURI_INTERNALS__' in window;
}

/** Retourne true si on est sur un appareil mobile (fenêtre étroite). */
export function isMobilePlatform(): boolean {
  return (typeof window !== 'undefined' && window.matchMedia('(max-width: 639px)').matches);
}
