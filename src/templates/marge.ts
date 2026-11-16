import { CVTemplate } from '../types/template';
import { PALETTES_SOBER, PALETTES_NEUTRAL } from '../theme/tokens';

/**
 * Titres en marge — mise en page à deux colonnes, sobre. Chaque titre de
 * section se place dans une colonne étroite à gauche, son contenu à droite,
 * le long d'un filet fin. L'ordre de lecture reste celui du CV, mais la mise
 * en page est moins compatible ATS : à réserver à un envoi à un recruteur.
 */
export const marge: CVTemplate = {
  id: 'marge',
  name: 'Titres en marge',
  description: 'Deux colonnes sobres : chaque titre dans la marge, son contenu à droite. Pour un recruteur humain, moins compatible ATS.',
  category: 'graphic',
  atsOptimized: false,
  recommendedFor: ['corporate', 'conseil', 'direction'],
  supportsPhoto: true,
  palettes: [PALETTES_SOBER[2], PALETTES_SOBER[0], PALETTES_NEUTRAL[1], PALETTES_NEUTRAL[2]],
  defaultDensity: 'normal',
  headerVariants: ['clean'],
  structure: { header: 'left', section: 'margin' },
  docx: {
    pageSize: 'A4',
    margins: { top: 1300, right: 1300, bottom: 1300, left: 1300 },
    fonts: { heading: 'Cambria', body: 'Cambria' },
    headingSize: 22,
    bodySize: 21,
    lineSpacing: 276,
    sectionSpacing: 240,
    useColumns: false,
    useTables: false,
  },
  preview: {
    containerClass: 'max-w-[210mm] mx-auto bg-white shadow-lg px-12 py-11 text-gray-900 [font-family:Cambria,Georgia,serif]',
    headingClass: 'text-[11.5px] font-bold uppercase tracking-[0.06em] leading-snug text-red-900 [font-family:Cambria,Georgia,serif]',
    entryClass: 'mb-3.5',
    titleClass: 'font-bold text-gray-900 text-[13px] [font-family:Cambria,Georgia,serif]',
    subtitleClass: 'text-gray-700 text-[12px] italic',
    dateClass: 'text-gray-600 text-[11.5px] italic tabular-nums mb-1 [font-family:Cambria,Georgia,serif]',
    descriptionClass: 'text-gray-800 text-[12px] whitespace-pre-line leading-relaxed [font-family:Cambria,Georgia,serif]',
    skillsContainerClass: 'list-disc pl-5 grid grid-cols-1 gap-y-0.5',
    skillClass: 'text-[12px] text-gray-800',
    skillBadgeContainerClass: 'flex flex-wrap gap-1.5',
    skillBadgeClass: 'inline-block text-[12px] text-gray-800 after:content-["·"] after:ml-1.5 after:text-red-900/60 last:after:content-[""] [font-family:Cambria,Georgia,serif]',
    nameClass: 'text-[32px] font-semibold text-gray-900 leading-tight mb-0.5 [font-family:Cambria,Georgia,serif]',
    headerTitleClass: 'text-[15px] font-medium italic text-red-900 [font-family:Cambria,Georgia,serif]',
    contactClass: 'text-[11.5px] text-gray-600 [font-family:Cambria,Georgia,serif]',
    summaryClass: 'text-[12px] text-gray-800 leading-relaxed italic [font-family:Cambria,Georgia,serif]',
  },
};
