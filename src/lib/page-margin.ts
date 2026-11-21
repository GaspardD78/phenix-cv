import type { CVTemplate } from '@/types/template';

/**
 * Marges intérieures par défaut d'un modèle une colonne (px) : classes `py-*` et
 * `px-*` de son conteneur, comme à l'écran. L'aperçu et le PDF utilisent les
 * mêmes marges ; le réglage « Marges » du CV (`pageMargin`) les remplace.
 */
export function templatePagePadding(template: Pick<CVTemplate, 'preview'>): { v: number; h: number } {
  const px = template.preview.containerClass.match(/\bpx-(\d+)\b/);
  const py = template.preview.containerClass.match(/\bpy-(\d+)\b/);
  return { v: py ? parseInt(py[1]) * 4 : 40, h: px ? parseInt(px[1]) * 4 : 48 };
}
