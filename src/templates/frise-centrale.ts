import { CVTemplate } from '../types/template';
import { PALETTES_VIBRANT, PALETTES_SOBER } from '../theme/tokens';

/**
 * Frise centrale — deux colonnes alternées. Une ligne d'accent descend au
 * centre de la page ; chaque expérience ou formation y a sa pastille et ses
 * dates, son contenu étant placé tantôt à droite, tantôt à gauche. Les sections
 * « badges » restent en pleine largeur. Pour un recruteur humain ; moins
 * compatible ATS (c'est le moins lisible des modèles pour un logiciel).
 */
export const friseCentrale: CVTemplate = {
  id: 'frise-centrale',
  name: 'Frise centrale',
  description: 'Une ligne au centre de la page, le parcours alterne de part et d’autre. Pour un recruteur humain, moins compatible ATS.',
  category: 'graphic',
  atsOptimized: false,
  recommendedFor: ['communication', 'reconversion', 'parcours-long'],
  supportsPhoto: true,
  palettes: [PALETTES_VIBRANT[0], PALETTES_VIBRANT[3], PALETTES_SOBER[0], PALETTES_VIBRANT[1]],
  defaultDensity: 'normal',
  headerVariants: ['clean'],
  structure: { entry: 'alternate' },
  docx: {
    pageSize: 'A4',
    margins: { top: 1300, right: 1300, bottom: 1300, left: 1300 },
    fonts: { heading: 'Georgia', body: 'Arial' },
    headingSize: 26,
    bodySize: 20,
    lineSpacing: 276,
    sectionSpacing: 240,
    useColumns: false,
    useTables: false,
    headingUppercase: false,
  },
  preview: {
    containerClass: 'max-w-[210mm] mx-auto bg-white shadow-lg px-12 py-10 text-gray-900 [font-family:Arial,sans-serif]',
    headingClass: 'text-[17px] font-bold text-indigo-600 mb-4 mt-6 [font-family:Georgia,serif]',
    entryClass: 'mb-0',
    titleClass: 'font-bold text-gray-900 text-[12.5px] [font-family:Arial,sans-serif]',
    subtitleClass: 'text-gray-700 text-[11.5px]',
    dateClass: 'text-indigo-600 text-[11px] font-semibold tabular-nums [font-family:Arial,sans-serif]',
    descriptionClass: 'text-gray-800 text-[11px] whitespace-pre-line leading-relaxed [font-family:Arial,sans-serif]',
    skillsContainerClass: 'list-disc pl-5 grid grid-cols-1 gap-y-0.5',
    skillClass: 'text-[11.5px] text-gray-800',
    skillBadgeContainerClass: 'flex flex-wrap justify-center gap-1.5 mt-1',
    skillBadgeClass: 'inline-block px-2.5 py-0.5 text-[11px] font-medium bg-indigo-50 text-indigo-900 border border-indigo-200 rounded-full [font-family:Arial,sans-serif]',
    nameClass: 'text-[34px] font-bold text-gray-900 leading-tight mb-1 [font-family:Georgia,serif]',
    headerTitleClass: 'text-[14px] font-semibold uppercase tracking-[0.06em] text-indigo-600 [font-family:Arial,sans-serif]',
    contactClass: 'text-[11.5px] text-gray-600 [font-family:Arial,sans-serif]',
    summaryClass: 'text-[12px] text-gray-800 leading-relaxed text-center [font-family:Arial,sans-serif]',
  },
};
