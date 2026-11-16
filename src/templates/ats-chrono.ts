import { CVTemplate } from '../types/template';
import { PALETTES_SOBER, PALETTES_NEUTRAL } from '../theme/tokens';

/**
 * Chronologique — une colonne, compatible ATS. Les dates occupent une marge
 * à gauche de chaque entrée (intitulé et entreprise à droite) : le parcours se
 * lit d'un coup d'œil. En-tête aligné à gauche, coordonnées sur une ligne.
 */
export const atsChrono: CVTemplate = {
  id: 'ats-chrono',
  name: 'Chronologique',
  description: 'Une colonne, les dates dans une marge à gauche : le parcours se lit d’un coup d’œil. Compatible ATS.',
  category: 'ats',
  recommendedFor: ['corporate', 'fr', 'parcours-long'],
  supportsPhoto: true,
  palettes: [PALETTES_SOBER[0], PALETTES_SOBER[1], PALETTES_SOBER[3], PALETTES_NEUTRAL[1]],
  defaultDensity: 'normal',
  headerVariants: ['clean', 'accent-bar'],
  structure: { header: 'left', entry: 'date-gutter' },
  docx: {
    pageSize: 'A4',
    margins: { top: 1300, right: 1300, bottom: 1300, left: 1300 },
    fonts: { heading: 'Calibri', body: 'Calibri' },
    headingSize: 24,
    bodySize: 22,
    lineSpacing: 276,
    sectionSpacing: 220,
    useColumns: false,
    useTables: false,
  },
  preview: {
    containerClass: 'max-w-[210mm] mx-auto bg-white shadow-lg px-12 py-10 text-gray-900',
    headingClass: 'text-[12.5px] font-bold uppercase tracking-[0.06em] text-blue-900 border-b border-blue-900/30 pb-1 mb-3 mt-6',
    entryClass: 'mb-3.5',
    titleClass: 'font-bold text-gray-900 text-[13px]',
    subtitleClass: 'text-gray-700 text-[12px]',
    dateClass: 'text-blue-900 text-[11.5px] font-semibold tabular-nums leading-snug',
    descriptionClass: 'text-gray-800 text-[12px] whitespace-pre-line leading-relaxed mt-0.5',
    skillsContainerClass: 'list-disc pl-5 grid grid-cols-1 gap-y-0.5',
    skillClass: 'text-[12px] text-gray-800',
    skillBadgeContainerClass: 'flex flex-wrap gap-1.5 mt-1',
    skillBadgeClass: 'inline-block px-2 py-0.5 text-[11px] font-medium text-gray-800 border border-gray-300 rounded-sm',
    nameClass: 'text-[28px] font-bold text-gray-900 leading-tight mb-0.5',
    headerTitleClass: 'text-[15px] font-semibold text-blue-900',
    contactClass: 'text-[11.5px] text-gray-600',
    summaryClass: 'text-[12px] text-gray-800 leading-relaxed',
  },
};
