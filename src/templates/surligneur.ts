import { CVTemplate } from '../types/template';
import { PALETTES_VIBRANT } from '../theme/tokens';

/**
 * Surligneur — une colonne, créatif. Un aplat clair passe sous la moitié basse
 * du nom et de chaque titre, comme un coup de surligneur (aplat net, sans
 * dégradé). Intitulés précédés d'un petit carré, dates dans une pastille.
 */
export const surligneur: CVTemplate = {
  id: 'surligneur',
  name: 'Surligneur',
  description: 'Nom et titres soulignés d’un aplat clair façon surligneur, dates en pastille. Pour un recruteur humain, moins compatible ATS.',
  category: 'creative',
  atsOptimized: false,
  recommendedFor: ['communication', 'commerce', 'jeune-diplome'],
  supportsPhoto: true,
  palettes: [PALETTES_VIBRANT[2], PALETTES_VIBRANT[1], PALETTES_VIBRANT[0]],
  defaultDensity: 'normal',
  headerVariants: ['clean'],
  structure: { header: 'left', heading: 'highlight', entry: 'pill', headerRule: false },
  docx: {
    pageSize: 'A4',
    margins: { top: 1300, right: 1300, bottom: 1300, left: 1300 },
    fonts: { heading: 'Helvetica', body: 'Helvetica' },
    headingSize: 26,
    bodySize: 20,
    lineSpacing: 276,
    sectionSpacing: 240,
    useColumns: false,
    useTables: false,
    headingRule: 'label',
    headingUppercase: false,
    nameHighlight: true,
  },
  preview: {
    containerClass: 'max-w-[210mm] mx-auto bg-white shadow-lg px-12 py-10 text-gray-900 [font-family:Helvetica,Arial,sans-serif]',
    headingClass: 'text-[17px] font-bold text-gray-900 mb-3 mt-7 [font-family:Helvetica,Arial,sans-serif]',
    entryClass: 'mb-4',
    titleClass: 'font-bold text-gray-900 text-[13px] [font-family:Helvetica,Arial,sans-serif]',
    subtitleClass: 'text-gray-700 text-[12px]',
    dateClass: 'text-orange-800 text-[10.5px] font-semibold tabular-nums [font-family:Helvetica,Arial,sans-serif]',
    descriptionClass: 'text-gray-800 text-[11.5px] whitespace-pre-line leading-relaxed [font-family:Helvetica,Arial,sans-serif]',
    skillsContainerClass: 'list-disc pl-5 grid grid-cols-1 gap-y-0.5',
    skillClass: 'text-[11.5px] text-gray-800',
    skillBadgeContainerClass: 'flex flex-wrap gap-1.5 mt-1',
    skillBadgeClass: 'inline-block px-2.5 py-0.5 text-[11px] font-medium text-gray-800 border border-gray-300 rounded-full [font-family:Helvetica,Arial,sans-serif]',
    nameClass: 'text-[36px] font-bold text-gray-900 leading-tight mb-1.5 [font-family:Helvetica,Arial,sans-serif]',
    headerTitleClass: 'text-[14px] font-semibold text-orange-700 [font-family:Helvetica,Arial,sans-serif]',
    contactClass: 'text-[11.5px] text-gray-600 [font-family:Helvetica,Arial,sans-serif]',
    summaryClass: 'text-[12px] text-gray-800 leading-relaxed mt-1 [font-family:Helvetica,Arial,sans-serif]',
  },
};
