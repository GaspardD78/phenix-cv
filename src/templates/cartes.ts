import { CVTemplate } from '../types/template';
import { PALETTES_VIBRANT, PALETTES_SOBER } from '../theme/tokens';

/**
 * Cartes — une colonne, graphique. Chaque expérience ou formation dans un
 * cadre fin et arrondi, liseré d'accent à gauche, fond blanc. Le texte reste
 * lisible, mais certains logiciels de recrutement lisent mal les cadres :
 * moins compatible ATS.
 */
export const cartes: CVTemplate = {
  id: 'cartes',
  name: 'Cartes',
  description: 'Une colonne, chaque expérience dans un cadre fin à liseré coloré. Pour un recruteur humain, moins compatible ATS.',
  category: 'graphic',
  atsOptimized: false,
  recommendedFor: ['commerce', 'communication', 'reconversion'],
  supportsPhoto: true,
  palettes: [PALETTES_VIBRANT[3], PALETTES_VIBRANT[1], PALETTES_SOBER[0], PALETTES_SOBER[2]],
  defaultDensity: 'normal',
  headerVariants: ['clean', 'accent-light'],
  structure: { entry: 'card' },
  docx: {
    pageSize: 'A4',
    margins: { top: 1300, right: 1300, bottom: 1300, left: 1300 },
    fonts: { heading: 'Arial', body: 'Arial' },
    headingSize: 22,
    bodySize: 20,
    lineSpacing: 264,
    sectionSpacing: 220,
    useColumns: false,
    useTables: false,
    headingRule: 'none',
  },
  preview: {
    containerClass: 'max-w-[210mm] mx-auto bg-white shadow-lg px-12 py-10 text-gray-900 [font-family:Arial,sans-serif]',
    headingClass: 'text-[13px] font-bold uppercase tracking-[0.06em] text-purple-700 mb-2.5 mt-6 [font-family:Arial,sans-serif]',
    entryClass: 'mb-2.5',
    titleClass: 'font-bold text-gray-900 text-[12.5px] [font-family:Arial,sans-serif]',
    subtitleClass: 'text-gray-700 text-[11.5px]',
    dateClass: 'text-purple-700 text-[11px] font-semibold tabular-nums [font-family:Arial,sans-serif]',
    descriptionClass: 'text-gray-800 text-[11.5px] whitespace-pre-line leading-relaxed [font-family:Arial,sans-serif]',
    skillsContainerClass: 'list-disc pl-5 grid grid-cols-1 gap-y-0.5',
    skillClass: 'text-[11.5px] text-gray-800',
    skillBadgeContainerClass: 'flex flex-wrap gap-1.5 mt-1',
    skillBadgeClass: 'inline-block px-2.5 py-0.5 text-[11px] font-medium bg-purple-50 text-purple-900 border border-purple-200 rounded-full [font-family:Arial,sans-serif]',
    nameClass: 'text-[30px] font-bold text-gray-900 leading-tight mb-1 [font-family:Arial,sans-serif]',
    headerTitleClass: 'text-[15px] font-semibold text-purple-700 [font-family:Arial,sans-serif]',
    contactClass: 'text-[11.5px] text-gray-600 [font-family:Arial,sans-serif]',
    summaryClass: 'text-[12px] text-gray-800 leading-relaxed [font-family:Arial,sans-serif]',
  },
};
