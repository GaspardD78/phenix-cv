import { CVTemplate } from '../types/template';
import { PALETTES_SOBER, PALETTES_VIBRANT } from '../theme/tokens';

/**
 * Frise — une colonne, compatible ATS. Les entrées suivent une ligne
 * verticale fine ponctuée d'une pastille par expérience ou formation (simple
 * décoration : le texte reste linéaire). Titres de section en minuscules,
 * en serif, sans trait.
 */
export const atsFrise: CVTemplate = {
  id: 'ats-frise',
  name: 'Frise',
  description: 'Une colonne, le parcours le long d’une frise verticale, titres en serif. Compatible ATS.',
  category: 'ats',
  recommendedFor: ['fr', 'reconversion', 'parcours-long'],
  supportsPhoto: true,
  palettes: [PALETTES_VIBRANT[1], PALETTES_SOBER[0], PALETTES_VIBRANT[3], PALETTES_SOBER[2]],
  defaultDensity: 'normal',
  headerVariants: ['clean', 'accent-light'],
  structure: { entry: 'timeline' },
  docx: {
    pageSize: 'A4',
    margins: { top: 1300, right: 1300, bottom: 1300, left: 1300 },
    fonts: { heading: 'Georgia', body: 'Calibri' },
    headingSize: 28,
    bodySize: 22,
    lineSpacing: 276,
    sectionSpacing: 240,
    useColumns: false,
    useTables: false,
    headingRule: 'none',
    headingUppercase: false,
  },
  preview: {
    containerClass: 'max-w-[210mm] mx-auto bg-white shadow-lg px-12 py-10 text-gray-900',
    headingClass: 'text-[16px] font-bold text-emerald-700 mb-3 mt-6 [font-family:Georgia,serif]',
    entryClass: 'pb-4',
    titleClass: 'font-bold text-gray-900 text-[13px]',
    subtitleClass: 'text-gray-700 text-[12px]',
    dateClass: 'text-emerald-800 text-[11.5px] tabular-nums mb-1',
    descriptionClass: 'text-gray-800 text-[12px] whitespace-pre-line leading-relaxed',
    skillsContainerClass: 'list-disc pl-5 grid grid-cols-1 gap-y-0.5',
    skillClass: 'text-[12px] text-gray-800',
    skillBadgeContainerClass: 'flex flex-wrap gap-1.5 mt-1',
    skillBadgeClass: 'inline-block px-2.5 py-0.5 text-[11px] font-medium bg-emerald-50 text-emerald-900 border border-emerald-200 rounded-full',
    nameClass: 'text-[32px] font-bold text-gray-900 leading-tight mb-1 [font-family:Georgia,serif]',
    headerTitleClass: 'text-[15px] font-medium italic text-emerald-700 [font-family:Georgia,serif]',
    contactClass: 'text-[11.5px] text-gray-600',
    summaryClass: 'text-[12px] text-gray-800 leading-relaxed',
  },
};
