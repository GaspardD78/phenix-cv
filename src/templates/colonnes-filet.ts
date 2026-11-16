import { CVTemplate } from '../types/template';
import { PALETTES_SOBER, PALETTES_NEUTRAL } from '../theme/tokens';

/**
 * Deux colonnes à filet — en-tête pleine largeur (avec les coordonnées), puis
 * une colonne étroite sans fond (compétences, langues, centres d'intérêt)
 * séparée de la colonne principale par un filet vertical d'accent. Sobre,
 * pour un recruteur humain ; moins compatible ATS.
 */
export const colonnesFilet: CVTemplate = {
  id: 'colonnes-filet',
  name: 'Deux colonnes à filet',
  description: 'En-tête pleine largeur, puis deux colonnes sans fond séparées par un filet. Pour un recruteur humain, moins compatible ATS.',
  category: 'graphic',
  layout: 'header-columns',
  atsOptimized: false,
  recommendedFor: ['corporate', 'commerce', 'administratif'],
  supportsPhoto: true,
  palettes: [PALETTES_SOBER[3], PALETTES_SOBER[0], PALETTES_NEUTRAL[1], PALETTES_SOBER[2]],
  defaultDensity: 'normal',
  headerVariants: ['clean', 'accent-light'],
  structure: { header: 'left' },
  docx: {
    pageSize: 'A4',
    margins: { top: 1300, right: 1300, bottom: 1300, left: 1300 },
    fonts: { heading: 'Helvetica', body: 'Helvetica' },
    headingSize: 22,
    bodySize: 20,
    lineSpacing: 276,
    sectionSpacing: 220,
    useColumns: false,
    useTables: false,
  },
  preview: {
    containerClass: 'max-w-[210mm] mx-auto bg-white shadow-lg px-11 py-10 text-gray-900 [font-family:Helvetica,Arial,sans-serif]',
    headingClass: 'text-[12px] font-bold uppercase tracking-[0.06em] text-green-900 mb-2.5 mt-5 [font-family:Helvetica,Arial,sans-serif]',
    entryClass: 'mb-4',
    titleClass: 'font-bold text-gray-900 text-[13px] [font-family:Helvetica,Arial,sans-serif]',
    subtitleClass: 'text-gray-700 text-[12px]',
    dateClass: 'text-gray-600 text-[11px] tabular-nums mb-1 [font-family:Helvetica,Arial,sans-serif]',
    descriptionClass: 'text-gray-800 text-[11.5px] whitespace-pre-line leading-relaxed [font-family:Helvetica,Arial,sans-serif]',
    skillsContainerClass: 'space-y-1',
    skillClass: 'text-[11.5px] text-gray-800',
    skillBadgeContainerClass: 'flex flex-wrap gap-1.5 mt-1',
    skillBadgeClass: 'inline-block px-2 py-0.5 text-[11px] font-medium text-gray-800 border border-gray-300 rounded [font-family:Helvetica,Arial,sans-serif]',
    nameClass: 'text-[30px] font-bold text-gray-900 leading-tight mb-0.5 [font-family:Helvetica,Arial,sans-serif]',
    headerTitleClass: 'text-[15px] font-medium text-green-900 [font-family:Helvetica,Arial,sans-serif]',
    contactClass: 'text-[11.5px] text-gray-600 [font-family:Helvetica,Arial,sans-serif]',
    summaryClass: 'text-[12px] text-gray-800 leading-relaxed [font-family:Helvetica,Arial,sans-serif]',
  },
};
