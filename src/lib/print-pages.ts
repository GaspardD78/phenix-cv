/**
 * Mise en page des CV de plusieurs pages à l'export PDF.
 *
 * Ajoutée au HTML d'export seulement quand la mesure (print-overflow.ts)
 * annonce que le texte dépasse la première page :
 * - marges de page en haut (pages 2 et suivantes) et en bas (toutes les pages),
 *   la première page gardant son en-tête collé au bord haut ;
 * - numéro « n / total » centré dans la marge du bas ;
 * - décors pleine hauteur (bande latérale, filet de bord) prolongés dans les
 *   marges de page par les cases de marge `@top-*` / `@bottom-*`, sans quoi ils
 *   s'interrompraient en haut et en bas de chaque page.
 * Les cases de marge (`@page { @bottom-center { … } }`) sont gérées par
 * Chromium depuis la version 131 (WebView2, Edge et Chrome à jour).
 */

/** Marge haute des pages 2 et suivantes, et marge basse de toutes les pages (mm). */
export const PAGE_MARGIN_TOP_MM = 14;
export const PAGE_MARGIN_BOTTOM_MM = 14;

/** Décor du bord de page à prolonger dans les marges. */
export interface EdgeDecor {
  /** Largeur CSS (ex. « 34% » pour une bande, « 4px » pour un filet). */
  width: string;
  /** Couleur de fond. */
  color: string;
}

export interface PageDecor {
  /** Police du CV, reprise pour le numéro de page. */
  fontFamily: string;
  left?: EdgeDecor;
  right?: EdgeDecor;
}

const visibleColor = (c: string): boolean => Boolean(c) && c !== 'transparent' && !/rgba\([^)]*,\s*0\)$/.test(c);

/**
 * Lit le décor de bord du CV affiché (bande latérale `.cv-sidebar`, ou bordure
 * gauche/droite de `#printable-cv`). Les largeurs de bande sont rapportées à
 * la largeur du CV, donc indépendantes du zoom de l'aperçu.
 */
export function readPageDecor(cv: HTMLElement): PageDecor {
  const view = cv.ownerDocument.defaultView;
  const cs = view?.getComputedStyle(cv);
  const decor: PageDecor = { fontFamily: cs?.fontFamily || 'Arial, sans-serif' };
  if (!view || !cs) return decor;

  const band = cv.querySelector<HTMLElement>('.cv-sidebar');
  const cvBox = cv.getBoundingClientRect();
  if (band && cvBox.width > 0) {
    const box = band.getBoundingClientRect();
    const color = view.getComputedStyle(band).backgroundColor;
    if (visibleColor(color) && box.width > 0) {
      const edge = { width: `${Math.round((box.width / cvBox.width) * 10000) / 100}%`, color };
      if (box.left - cvBox.left < cvBox.right - box.right) decor.left = edge;
      else decor.right = edge;
    }
  }
  for (const side of ['left', 'right'] as const) {
    if (decor[side]) continue;
    const w = parseFloat(side === 'left' ? cs.borderLeftWidth : cs.borderRightWidth);
    const style = side === 'left' ? cs.borderLeftStyle : cs.borderRightStyle;
    const color = side === 'left' ? cs.borderLeftColor : cs.borderRightColor;
    if (w > 0 && style !== 'none' && visibleColor(color)) decor[side] = { width: `${w}px`, color };
  }
  return decor;
}

/** Feuille de style ajoutée au HTML d'export d'un CV de plusieurs pages. */
export function multipagePrintCss(decor: PageDecor): string {
  const edge = (box: string, d?: EdgeDecor) => (d ? `@${box} { content: ""; width: ${d.width}; background: ${d.color}; }` : '');
  // Nom de police seulement (lettres, chiffres, espaces, virgules, guillemets, tirets) : rien d'autre n'entre dans la feuille.
  const font = decor.fontFamily.replace(/[^\p{L}\p{N} ,'"_.-]/gu, '') || 'Arial, sans-serif';
  return [
    '@page {',
    `  margin: ${PAGE_MARGIN_TOP_MM}mm 0 ${PAGE_MARGIN_BOTTOM_MM}mm 0;`,
    `  ${edge('top-left', decor.left)} ${edge('bottom-left', decor.left)}`,
    `  ${edge('top-right', decor.right)} ${edge('bottom-right', decor.right)}`,
    `  @bottom-center { content: counter(page) " / " counter(pages); font-family: ${font}; font-size: 8pt; color: #6b7280; }`,
    '}',
    // Première page : l'en-tête du CV reste collé au bord haut, comme pour un CV d'une page.
    '@page :first { margin-top: 0; }',
    '@media print {',
    // Bandeau d'en-tête ou titre de section : jamais seul en bas de page.
    '  #printable-cv .cv-header-block, #printable-cv .cv-header-hero, #printable-cv header { break-inside: avoid; }',
    // Un bloc court reste entier : expérience, section de la bande, groupe de compétences, accroche.
    '  #printable-cv .cv-entry, #printable-cv .cv-sidebar-section, #printable-cv .cv-sidebar-group, #printable-cv .cv-summary { break-inside: avoid; }',
    '}',
  ].join('\n');
}

/**
 * CV dont tout le texte tient sur la première page : le CV est borné à une page.
 * Sans cela, une marge intérieure ou un espacement sous le dernier texte qui
 * dépasse de quelques dixièmes de millimètre ouvrirait une deuxième page, ou
 * ferait passer tout un bloc de colonnes sur la suivante. Seul de l'espace vide
 * est concerné : la mesure garantit que le texte s'arrête avant 297 mm.
 */
export const SINGLE_PAGE_PRINT_CSS = '@media print { #printable-cv { max-height: 297mm; overflow: hidden; } }';

