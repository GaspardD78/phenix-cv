import { CVTemplate } from '../types/template';
import { PALETTES_SOBER, PALETTES_VIBRANT } from '../theme/tokens';

/**
 * Grand en-tête — une colonne, créatif. Un bloc clair (teinte de l'accent,
 * sans dégradé) occupe tout le haut de page ; nom, poste et coordonnées y sont
 * centrés, la photo ronde facultative est à cheval sur son bord. En fin de CV,
 * les sections « badges » forment une mosaïque de tuiles claires.
 */
export const grandEntete: CVTemplate = {
  id: 'grand-entete',
  name: 'Grand en-tête',
  description: 'Grand bloc clair en haut de page, photo à cheval sur son bord, compétences en tuiles. Pour un recruteur humain, moins compatible ATS.',
  category: 'creative',
  atsOptimized: false,
  recommendedFor: ['commerce', 'accueil', 'communication'],
  supportsPhoto: true,
  palettes: [PALETTES_SOBER[3], PALETTES_VIBRANT[0], PALETTES_SOBER[0], PALETTES_VIBRANT[3]],
  defaultDensity: 'normal',
  headerVariants: ['clean'],
  structure: { header: 'hero', badges: 'tiles', headerRule: false },
  docx: {
    pageSize: 'A4',
    margins: { top: 1300, right: 1300, bottom: 1300, left: 1300 },
    fonts: { heading: 'Georgia', body: 'Calibri' },
    headingSize: 24,
    bodySize: 21,
    lineSpacing: 276,
    sectionSpacing: 240,
    useColumns: false,
    useTables: false,
  },
  preview: {
    containerClass: 'max-w-[210mm] mx-auto bg-white shadow-lg px-12 py-10 text-gray-900',
    headingClass: 'text-[13px] font-bold uppercase tracking-[0.06em] text-green-900 border-b-2 border-green-900/20 pb-1 mb-3 mt-6',
    entryClass: 'mb-4',
    titleClass: 'font-bold text-gray-900 text-[13px]',
    subtitleClass: 'text-gray-700 text-[12px]',
    dateClass: 'text-gray-600 text-[11.5px] tabular-nums',
    descriptionClass: 'text-gray-800 text-[12px] whitespace-pre-line leading-relaxed',
    skillsContainerClass: 'space-y-1',
    skillClass: 'text-[11.5px] text-gray-800',
    skillBadgeContainerClass: 'flex flex-wrap gap-1.5 mt-1',
    skillBadgeClass: 'inline-block px-2 py-0.5 text-[11px] font-medium bg-white text-gray-800 border border-green-900/20 rounded-full',
    nameClass: 'text-[36px] font-bold text-gray-900 leading-tight mb-1 [font-family:Georgia,serif]',
    headerTitleClass: 'text-[13px] font-semibold uppercase tracking-[0.06em] text-green-900',
    contactClass: 'text-[11.5px] text-gray-700',
    summaryClass: 'text-[12.5px] text-gray-800 leading-relaxed text-center',
  },
};
