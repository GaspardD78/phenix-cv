/**
 * Parcours IA en trois étapes (copier le texte, coller la réponse, appliquer) : un seul bouton
 * principal (orange) à la fois, celui de l'étape en cours. Pur, testable.
 *
 * - Au départ, l'étape en cours est « 1. Copier ».
 * - Dès qu'une réponse est collée, c'est « 3. Appliquer » (rouge si des points bloquants restent).
 */
export type AiStepButton = 'copy' | 'apply';

export function currentAiStep(pastedResponse: string): AiStepButton {
  return pastedResponse.trim() ? 'apply' : 'copy';
}

export const PRIMARY_STEP_CLASS = 'bg-amber-500 hover:bg-amber-600 text-white border-amber-500 shadow-sm';
export const BLOCKING_STEP_CLASS = 'bg-red-500 hover:bg-red-600 text-white border-red-500 shadow-sm';
export const SECONDARY_STEP_CLASS =
  'bg-white dark:bg-[var(--pc-card)] text-gray-700 dark:text-[var(--pc-text)] border-gray-300 dark:border-[var(--pc-border)] hover:bg-gray-50';
export const COPIED_STEP_CLASS = 'bg-green-50 text-green-700 border-green-300';

/** Couleurs du bouton d'une étape, selon l'étape en cours. */
export function stepButtonClass(
  button: AiStepButton,
  current: AiStepButton,
  opts: { copied?: boolean; blocking?: boolean } = {},
): string {
  if (button === 'copy' && opts.copied) return COPIED_STEP_CLASS;
  if (button !== current) return SECONDARY_STEP_CLASS;
  return button === 'apply' && opts.blocking ? BLOCKING_STEP_CLASS : PRIMARY_STEP_CLASS;
}
