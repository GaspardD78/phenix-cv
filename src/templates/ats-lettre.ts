import { CVTemplate } from '../types/template';
import { PALETTES_NEUTRAL } from '../theme/tokens';

/**
 * Lettre — une colonne, compatible ATS. Aucun trait : nom en petites
 * capitales, poste et titres de section en italique, sans capitales.
 * Entrées en retrait suspendu : l'intitulé en saillie, le reste décalé dessous.
 */
export const atsLettre: CVTemplate = {
  id: 'ats-lettre',
  name: 'Lettre',
  description: 'Une colonne sans aucun trait, en Times : titres en italique, entrées en retrait. Compatible ATS.',
  category: 'ats',
  recommendedFor: ['fr', 'juridique', 'enseignement'],
  supportsPhoto: true,
  palettes: [PALETTES_NEUTRAL[2], PALETTES_NEUTRAL[0], PALETTES_NEUTRAL[1]],
  defaultDensity: 'normal',
  headerVariants: ['clean'],
  structure: { entry: 'hanging', headerRule: false },
  docx: {
    pageSize: 'A4',
    margins: { top: 1400, right: 1400, bottom: 1400, left: 1400 },
    fonts: { heading: 'Times New Roman', body: 'Times New Roman' },
    headingSize: 26,
    bodySize: 22,
    lineSpacing: 276,
    sectionSpacing: 240,
    useColumns: false,
    useTables: false,
    headingRule: 'none',
    headingUppercase: false,
    headingItalic: true,
  },
  preview: {
    containerClass: 'max-w-[210mm] mx-auto bg-white shadow-lg px-14 py-12 text-gray-900 [font-family:"Times_New_Roman",serif]',
    headingClass: 'text-[16px] font-bold italic text-amber-900 mb-2 mt-6 [font-family:"Times_New_Roman",serif]',
    entryClass: 'mb-3',
    titleClass: 'font-bold text-gray-900 text-[13.5px] [font-family:"Times_New_Roman",serif]',
    subtitleClass: 'text-gray-800 text-[12.5px] italic [font-family:"Times_New_Roman",serif]',
    dateClass: 'text-gray-700 text-[12.5px] tabular-nums [font-family:"Times_New_Roman",serif]',
    descriptionClass: 'text-gray-900 text-[12.5px] whitespace-pre-line leading-relaxed [font-family:"Times_New_Roman",serif]',
    skillsContainerClass: 'list-disc pl-5 grid grid-cols-1 gap-y-0.5',
    skillClass: 'text-[12.5px] text-gray-900',
    skillBadgeContainerClass: 'flex flex-wrap gap-x-1.5',
    skillBadgeClass: 'inline-block text-[12.5px] text-gray-900 after:content-[","] last:after:content-[""] [font-family:"Times_New_Roman",serif]',
    nameClass: 'text-[30px] font-normal tracking-[0.04em] text-gray-900 mb-1 [font-variant-caps:small-caps] [font-family:"Times_New_Roman",serif]',
    headerTitleClass: 'text-[16px] italic text-amber-900 [font-family:"Times_New_Roman",serif]',
    contactClass: 'text-[12px] text-gray-700 [font-family:"Times_New_Roman",serif]',
    summaryClass: 'text-[12.5px] text-gray-900 leading-relaxed [font-family:"Times_New_Roman",serif]',
  },
};
