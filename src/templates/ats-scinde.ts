import { CVTemplate } from '../types/template';
import { PALETTES_SOBER, PALETTES_VIBRANT } from '../theme/tokens';

/**
 * En-tête scindé — une colonne, compatible ATS. Nom et poste à gauche,
 * coordonnées empilées à droite, puis un filet d'accent épais sur toute la
 * largeur. Les titres de section sont marqués d'un repère vertical, sans trait.
 */
export const atsScinde: CVTemplate = {
  id: 'ats-scinde',
  name: 'En-tête scindé',
  description: 'Une colonne : nom à gauche, coordonnées à droite, titres marqués d’un repère vertical. Compatible ATS.',
  category: 'ats',
  recommendedFor: ['corporate', 'commerce', 'international'],
  supportsPhoto: true,
  palettes: [PALETTES_VIBRANT[2], PALETTES_SOBER[0], PALETTES_SOBER[3], PALETTES_SOBER[1]],
  defaultDensity: 'normal',
  headerVariants: ['clean'],
  structure: { header: 'split' },
  docx: {
    pageSize: 'A4',
    margins: { top: 1250, right: 1300, bottom: 1250, left: 1300 },
    fonts: { heading: 'Arial', body: 'Arial' },
    headingSize: 24,
    bodySize: 20,
    lineSpacing: 276,
    sectionSpacing: 220,
    useColumns: false,
    useTables: false,
    headingRule: 'left',
  },
  preview: {
    containerClass: 'max-w-[210mm] mx-auto bg-white shadow-lg px-12 py-10 text-gray-900 [font-family:Arial,sans-serif]',
    headingClass: 'text-[12.5px] font-bold uppercase tracking-[0.05em] text-gray-900 border-l-4 border-orange-700 pl-2.5 py-px leading-tight mb-3 mt-6 [font-family:Arial,sans-serif]',
    entryClass: 'mb-4',
    titleClass: 'font-bold text-gray-900 text-[13px] [font-family:Arial,sans-serif]',
    subtitleClass: 'text-gray-700 text-[12px]',
    dateClass: 'text-gray-600 text-[11.5px] tabular-nums mb-1 [font-family:Arial,sans-serif]',
    descriptionClass: 'text-gray-800 text-[11.5px] whitespace-pre-line leading-relaxed [font-family:Arial,sans-serif]',
    skillsContainerClass: 'list-disc pl-5 grid grid-cols-1 gap-y-0.5',
    skillClass: 'text-[11.5px] text-gray-800',
    skillBadgeContainerClass: 'flex flex-wrap gap-1.5 mt-1',
    skillBadgeClass: 'inline-block px-2.5 py-0.5 text-[11px] font-medium bg-orange-50 text-orange-900 border border-orange-200 rounded-sm [font-family:Arial,sans-serif]',
    nameClass: 'text-[30px] font-bold text-gray-900 leading-none mb-1.5 [font-family:Arial,sans-serif]',
    headerTitleClass: 'text-[15px] font-semibold uppercase tracking-[0.05em] text-orange-700 [font-family:Arial,sans-serif]',
    contactClass: 'text-[11.5px] text-gray-700 leading-snug [font-family:Arial,sans-serif]',
    summaryClass: 'text-[12px] text-gray-800 leading-relaxed [font-family:Arial,sans-serif]',
  },
};
