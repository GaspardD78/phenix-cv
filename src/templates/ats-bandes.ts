import { CVTemplate } from '../types/template';
import { PALETTES_SOBER, PALETTES_NEUTRAL } from '../theme/tokens';

/**
 * Bandes claires — une colonne, compatible ATS. Chaque titre de section sur
 * une bande claire pleine largeur (teinte de l'accent), texte en capitales
 * foncées. Les dates passent sous l'intitulé : « Entreprise · Lieu · dates ».
 */
export const atsBandes: CVTemplate = {
  id: 'ats-bandes',
  name: 'Bandes claires',
  description: 'Une colonne : titres sur une bande claire, dates sous l’intitulé avec l’entreprise. Compatible ATS.',
  category: 'ats',
  recommendedFor: ['corporate', 'fr', 'international'],
  supportsPhoto: true,
  palettes: [PALETTES_SOBER[1], PALETTES_SOBER[2], PALETTES_SOBER[0], PALETTES_NEUTRAL[1]],
  defaultDensity: 'normal',
  headerVariants: ['clean'],
  structure: { heading: 'band', entry: 'date-below' },
  docx: {
    pageSize: 'A4',
    margins: { top: 1300, right: 1300, bottom: 1300, left: 1300 },
    fonts: { heading: 'Arial', body: 'Arial' },
    headingSize: 22,
    bodySize: 20,
    lineSpacing: 276,
    sectionSpacing: 220,
    useColumns: false,
    useTables: false,
    headingRule: 'band',
  },
  preview: {
    containerClass: 'max-w-[210mm] mx-auto bg-white shadow-lg px-12 py-10 text-gray-900 [font-family:Arial,sans-serif]',
    headingClass: 'text-[12px] font-bold uppercase tracking-[0.06em] text-gray-900 mb-3 mt-6 [font-family:Arial,sans-serif]',
    entryClass: 'mb-3.5',
    titleClass: 'font-bold text-gray-900 text-[13px] [font-family:Arial,sans-serif]',
    subtitleClass: 'text-gray-700 text-[11.5px] [font-family:Arial,sans-serif]',
    dateClass: 'text-gray-700 text-[11.5px] tabular-nums [font-family:Arial,sans-serif]',
    descriptionClass: 'text-gray-800 text-[11.5px] whitespace-pre-line leading-relaxed mt-1 [font-family:Arial,sans-serif]',
    skillsContainerClass: 'list-disc pl-5 grid grid-cols-1 gap-y-0.5',
    skillClass: 'text-[11.5px] text-gray-800',
    skillBadgeContainerClass: 'flex flex-wrap gap-1.5 mt-1',
    skillBadgeClass: 'inline-block text-[11.5px] text-gray-800 after:content-["·"] after:ml-1.5 after:text-gray-400 last:after:content-[""] [font-family:Arial,sans-serif]',
    nameClass: 'text-[30px] font-bold text-gray-900 leading-tight mb-1 [font-family:Arial,sans-serif]',
    headerTitleClass: 'text-[15px] font-semibold text-gray-700 [font-family:Arial,sans-serif]',
    contactClass: 'text-[11.5px] text-gray-600 [font-family:Arial,sans-serif]',
    summaryClass: 'text-[12px] text-gray-800 leading-relaxed [font-family:Arial,sans-serif]',
  },
};
