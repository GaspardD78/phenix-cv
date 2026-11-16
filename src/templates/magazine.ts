import { CVTemplate } from '../types/template';
import { PALETTES_SOBER, PALETTES_VIBRANT } from '../theme/tokens';

/**
 * Magazine — deux colonnes asymétriques. Très grand nom en serif, filet
 * d'accent épais, puis une colonne large (parcours) et, à droite, un encadré
 * clair aux coins arrondis qui accueille l'accroche et les sections « badges ».
 * Pour un recruteur humain ; moins compatible ATS.
 */
export const magazine: CVTemplate = {
  id: 'magazine',
  name: 'Magazine',
  description: 'Grand nom en serif, parcours en colonne large et encadré clair pour l’accroche et les compétences. Pour un recruteur humain, moins compatible ATS.',
  category: 'graphic',
  layout: 'magazine',
  atsOptimized: false,
  recommendedFor: ['communication', 'commerce', 'direction'],
  supportsPhoto: true,
  palettes: [PALETTES_VIBRANT[2], PALETTES_SOBER[0], PALETTES_SOBER[2], PALETTES_SOBER[3]],
  defaultDensity: 'normal',
  headerVariants: ['clean'],
  structure: { header: 'left' },
  docx: {
    pageSize: 'A4',
    margins: { top: 1300, right: 1300, bottom: 1300, left: 1300 },
    fonts: { heading: 'Georgia', body: 'Calibri' },
    headingSize: 26,
    bodySize: 21,
    lineSpacing: 276,
    sectionSpacing: 240,
    useColumns: false,
    useTables: false,
  },
  preview: {
    containerClass: 'max-w-[210mm] mx-auto bg-white shadow-lg px-12 py-10 text-gray-900',
    headingClass: 'text-[15px] font-bold text-gray-900 mb-2.5 mt-6 [font-family:Georgia,serif]',
    entryClass: 'mb-4',
    titleClass: 'font-bold text-gray-900 text-[13px]',
    subtitleClass: 'text-gray-700 text-[12px]',
    dateClass: 'text-orange-700 text-[11px] font-semibold tabular-nums',
    descriptionClass: 'text-gray-800 text-[12px] whitespace-pre-line leading-relaxed',
    skillsContainerClass: 'space-y-1',
    skillClass: 'text-[11.5px] text-gray-800',
    skillBadgeContainerClass: 'flex flex-wrap gap-1.5 mt-1',
    skillBadgeClass: 'inline-block px-2 py-0.5 text-[11px] font-medium bg-white text-gray-800 border border-orange-200 rounded',
    nameClass: 'text-[44px] font-bold text-gray-900 leading-none tracking-tight mb-2 [font-family:Georgia,serif]',
    headerTitleClass: 'text-[13px] font-semibold uppercase tracking-[0.06em] text-orange-700',
    contactClass: 'text-[11.5px] text-gray-600',
    summaryClass: 'text-[12.5px] text-gray-800 leading-relaxed italic [font-family:Georgia,serif]',
  },
};
