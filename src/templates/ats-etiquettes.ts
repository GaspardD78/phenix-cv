import { CVTemplate } from '../types/template';
import { PALETTES_SOBER, PALETTES_NEUTRAL } from '../theme/tokens';

/**
 * Étiquettes — une colonne, compatible ATS. Chaque titre de section dans une
 * petite étiquette à fond clair (teinte de l'accent), ajustée à son texte.
 * Entrées compactes : « Intitulé, Entreprise · Lieu » sur une ligne, dates à droite.
 */
export const atsEtiquettes: CVTemplate = {
  id: 'ats-etiquettes',
  name: 'Étiquettes',
  description: 'Une colonne compacte : titres en étiquette claire, intitulé et entreprise sur une même ligne. Compatible ATS.',
  category: 'ats',
  recommendedFor: ['corporate', 'commerce', 'administratif'],
  supportsPhoto: true,
  palettes: [PALETTES_SOBER[0], PALETTES_SOBER[3], PALETTES_SOBER[2], PALETTES_NEUTRAL[1]],
  defaultDensity: 'normal',
  headerVariants: ['clean', 'accent-bar'],
  structure: { header: 'left', heading: 'label', entry: 'inline' },
  docx: {
    pageSize: 'A4',
    margins: { top: 1250, right: 1250, bottom: 1250, left: 1250 },
    fonts: { heading: 'Calibri', body: 'Calibri' },
    headingSize: 22,
    bodySize: 21,
    lineSpacing: 264,
    sectionSpacing: 200,
    useColumns: false,
    useTables: false,
    headingRule: 'label',
  },
  preview: {
    containerClass: 'max-w-[210mm] mx-auto bg-white shadow-lg px-11 py-10 text-gray-900',
    headingClass: 'text-[12px] font-bold uppercase tracking-[0.05em] text-blue-900 mb-2.5 mt-5',
    entryClass: 'mb-3',
    titleClass: 'font-bold text-gray-900 text-[12.5px]',
    subtitleClass: 'text-gray-700 text-[12px]',
    dateClass: 'text-gray-600 text-[11.5px] tabular-nums',
    descriptionClass: 'text-gray-800 text-[11.5px] whitespace-pre-line leading-relaxed',
    skillsContainerClass: 'list-disc pl-5 grid grid-cols-1 gap-y-0.5',
    skillClass: 'text-[11.5px] text-gray-800',
    skillBadgeContainerClass: 'flex flex-wrap gap-1.5 mt-0.5',
    skillBadgeClass: 'inline-block px-2 py-0.5 text-[11px] font-medium text-gray-800 border border-gray-300 rounded-sm',
    nameClass: 'text-[28px] font-bold text-gray-900 leading-tight mb-0.5',
    headerTitleClass: 'text-[15px] font-semibold text-blue-900',
    contactClass: 'text-[11.5px] text-gray-600',
    summaryClass: 'text-[12px] text-gray-800 leading-relaxed',
  },
};
