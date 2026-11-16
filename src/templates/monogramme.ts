import { CVTemplate } from '../types/template';
import { PALETTES_SOBER, PALETTES_VIBRANT } from '../theme/tokens';

/**
 * Monogramme — une colonne, créatif. Initiales dans un carré clair à contour
 * d'accent (remplacé par la photo s'il y en a une), nom en grand serif, titres
 * en italique prolongés d'un filet fin, dates au-dessus des intitulés.
 */
export const monogramme: CVTemplate = {
  id: 'monogramme',
  name: 'Monogramme',
  description: 'Initiales en monogramme, grand nom en serif, titres en italique prolongés d’un filet. Pour un recruteur humain, moins compatible ATS.',
  category: 'creative',
  atsOptimized: false,
  recommendedFor: ['communication', 'commerce', 'conseil'],
  supportsPhoto: true,
  palettes: [PALETTES_VIBRANT[3], PALETTES_VIBRANT[1], PALETTES_SOBER[0], PALETTES_SOBER[2]],
  defaultDensity: 'normal',
  headerVariants: ['clean'],
  structure: { header: 'monogram', heading: 'rule-after', entry: 'date-above', headerRule: false },
  docx: {
    pageSize: 'A4',
    margins: { top: 1300, right: 1300, bottom: 1300, left: 1300 },
    fonts: { heading: 'Georgia', body: 'Calibri' },
    headingSize: 28,
    bodySize: 21,
    lineSpacing: 276,
    sectionSpacing: 240,
    useColumns: false,
    useTables: false,
    headingUppercase: false,
    headingItalic: true,
  },
  preview: {
    containerClass: 'max-w-[210mm] mx-auto bg-white shadow-lg px-12 py-10 text-gray-900',
    headingClass: 'text-[17px] font-bold italic text-purple-700 mb-3 mt-7 [font-family:Georgia,serif]',
    entryClass: 'mb-4',
    titleClass: 'font-bold text-gray-900 text-[13px]',
    subtitleClass: 'text-gray-700 text-[12px]',
    dateClass: 'text-purple-700 text-[10.5px] font-semibold uppercase tracking-[0.06em] tabular-nums mb-0.5',
    descriptionClass: 'text-gray-800 text-[12px] whitespace-pre-line leading-relaxed',
    skillsContainerClass: 'list-disc pl-5 grid grid-cols-1 gap-y-0.5',
    skillClass: 'text-[12px] text-gray-800',
    skillBadgeContainerClass: 'flex flex-wrap gap-1.5 mt-1',
    skillBadgeClass: 'inline-block px-2.5 py-0.5 text-[11px] font-medium text-purple-900 border border-purple-300 rounded-sm',
    nameClass: 'text-[36px] font-bold text-gray-900 leading-none mb-2 [font-family:Georgia,serif]',
    headerTitleClass: 'text-[12.5px] font-semibold uppercase tracking-[0.06em] text-purple-700',
    contactClass: 'text-[11.5px] text-gray-600',
    summaryClass: 'text-[12.5px] text-gray-800 leading-relaxed italic [font-family:Georgia,serif]',
  },
};
