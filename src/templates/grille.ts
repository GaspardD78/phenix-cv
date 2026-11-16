import { CVTemplate } from '../types/template';
import { PALETTES_SOBER, PALETTES_VIBRANT } from '../theme/tokens';

/**
 * Deux colonnes égales — en-tête pleine largeur, puis deux colonnes de même
 * largeur, sans fond : expériences, projets et bénévolat à gauche ; formation,
 * certifications, compétences, langues et centres d'intérêt à droite.
 * Pour un recruteur humain ; moins compatible ATS.
 */
export const grille: CVTemplate = {
  id: 'grille',
  name: 'Deux colonnes égales',
  description: 'En-tête pleine largeur, puis le parcours à gauche et le reste à droite, à parts égales. Pour un recruteur humain, moins compatible ATS.',
  category: 'graphic',
  layout: 'two-equal',
  atsOptimized: false,
  recommendedFor: ['commerce', 'communication', 'polyvalent'],
  supportsPhoto: true,
  palettes: [PALETTES_VIBRANT[0], PALETTES_SOBER[0], PALETTES_VIBRANT[1], PALETTES_SOBER[1]],
  defaultDensity: 'normal',
  headerVariants: ['clean', 'accent-light'],
  structure: { header: 'left' },
  docx: {
    pageSize: 'A4',
    margins: { top: 1250, right: 1250, bottom: 1250, left: 1250 },
    fonts: { heading: 'Calibri', body: 'Calibri' },
    headingSize: 24,
    bodySize: 21,
    lineSpacing: 264,
    sectionSpacing: 200,
    useColumns: false,
    useTables: false,
  },
  preview: {
    containerClass: 'max-w-[210mm] mx-auto bg-white shadow-lg px-11 py-10 text-gray-900',
    headingClass: 'text-[12.5px] font-bold uppercase tracking-[0.06em] text-indigo-600 border-b-2 border-indigo-600 pb-1 mb-3 mt-5',
    entryClass: 'mb-3.5',
    titleClass: 'font-bold text-gray-900 text-[12.5px]',
    subtitleClass: 'text-gray-700 text-[11.5px]',
    dateClass: 'text-gray-600 text-[11px] tabular-nums',
    descriptionClass: 'text-gray-800 text-[11.5px] whitespace-pre-line leading-relaxed',
    skillsContainerClass: 'list-disc pl-5 grid grid-cols-1 gap-y-0.5',
    skillClass: 'text-[11.5px] text-gray-800',
    skillBadgeContainerClass: 'flex flex-wrap gap-1.5 mt-1',
    skillBadgeClass: 'inline-block px-2 py-0.5 text-[11px] font-medium bg-indigo-50 text-indigo-900 border border-indigo-200 rounded',
    nameClass: 'text-[30px] font-bold text-gray-900 leading-tight mb-0.5',
    headerTitleClass: 'text-[15px] font-semibold text-indigo-600',
    contactClass: 'text-[11.5px] text-gray-600',
    summaryClass: 'text-[12px] text-gray-800 leading-relaxed',
  },
};
