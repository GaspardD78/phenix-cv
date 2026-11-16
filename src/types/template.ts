import type { DensityId, HeaderVariantId, Palette, TemplateCategory } from '../theme/tokens';

/**
 * Disposition générale du CV.
 * - `linear`        : colonne unique, flux vertical — compatible ATS.
 * - `sidebar-left`  : bande latérale colorée à gauche (contact, compétences…)
 *                     + colonne principale à droite — pensé pour l'œil humain.
 * - `sidebar-right` : idem, bande latérale à droite.
 * - `header-columns`: en-tête pleine largeur (avec les coordonnées), puis une
 *                     colonne étroite sans fond (sections « badges ») séparée
 *                     de la colonne principale par un filet vertical (non-ATS).
 * - `two-equal`     : en-tête pleine largeur, puis deux colonnes égales sans fond :
 *                     expériences, projets et bénévolat à gauche, le reste à droite (non-ATS).
 * - `magazine`      : en-tête pleine largeur, puis une colonne principale large et, à
 *                     droite, un encadré clair (accroche et sections « badges ») (non-ATS).
 */
export type CVLayout = 'linear' | 'sidebar-left' | 'sidebar-right' | 'header-columns' | 'two-equal' | 'magazine';

/**
 * Organisation interne du CV (facultative ; sans elle, rendu d'origine).
 * - `header`  : `centered` (défaut), `left` (tout aligné à gauche), `split`
 *               (nom et poste à gauche, coordonnées empilées à droite), `monogram`
 *               (initiales dans un carré à gauche, remplacées par la photo s'il y en a
 *               une), `hero` (bloc clair pleine largeur, centré, photo à cheval sur le bord).
 * - `entry`   : `stacked` (défaut, dates à droite de l'intitulé), `date-gutter`
 *               (dates dans une marge à gauche), `timeline` (frise verticale),
 *               `inline` (« Intitulé, Entreprise · Lieu » sur une ligne, dates à droite),
 *               `date-below` (dates sur la ligne de l'entreprise), `hanging` (intitulé
 *               en saillie, le reste en retrait dessous), `card` (entrée dans un cadre),
 *               `date-above` (dates au-dessus de l'intitulé), `pill` (petit carré avant
 *               l'intitulé, dates dans une pastille), `alternate` (frise centrale, entrées
 *               alternées de part et d'autre).
 * - `heading` : `label` (titre dans une étiquette claire ajustée), `band` (bande
 *               claire pleine largeur), `highlight` (aplat clair sous la moitié basse du
 *               texte, aussi sous le nom) ou `rule-after` (filet qui prolonge le titre).
 * - `badges`  : `tiles` (sections « badges » regroupées en fin de CV en tuiles claires).
 * - `headerRule` : `false` retire le trait sous l'en-tête.
 * - `section` : `stacked` (défaut, titre au-dessus), `margin` (titre dans une
 *               colonne étroite à gauche, contenu à droite).
 * Les décorations et la couleur d'accent suivent la palette (une seule couleur).
 */
export interface TemplateStructure {
  header?: 'centered' | 'left' | 'split' | 'monogram' | 'hero';
  entry?: 'stacked' | 'date-gutter' | 'timeline' | 'inline' | 'date-below' | 'hanging' | 'card' | 'date-above' | 'pill' | 'alternate';
  section?: 'stacked' | 'margin';
  heading?: 'label' | 'band' | 'highlight' | 'rule-after';
  headerRule?: boolean;
  badges?: 'tiles';
}

/** Réglages de la bande latérale (layouts `sidebar-*`). */
export interface SidebarConfig {
  /** Couleur de fond de la bande. Défaut : couleur d'accent du template. */
  bg?: string;
  /** Couleur du texte dans la bande. Défaut : blanc. */
  text?: string;
  /** Couleur des titres de section dans la bande. Défaut : `text`. */
  heading?: string;
  /** Largeur de la bande (ex: '34%'). Défaut : '34%'. */
  width?: string;
}

export interface CVTemplate {
  id: string;
  name: string;
  description: string;
  /** Catégorie pour regrouper dans le sélecteur */
  category: TemplateCategory;
  /**
   * Disposition générale. Défaut : `linear` (ATS-safe).
   * Les layouts `sidebar-*` produisent un CV graphique deux colonnes,
   * optimisé pour un recruteur humain (non garanti ATS).
   */
  layout?: CVLayout;
  /** Configuration de la bande latérale (layouts `sidebar-*`). */
  sidebar?: SidebarConfig;
  /** Organisation de l'en-tête, des sections et des entrées (voir TemplateStructure). */
  structure?: TemplateStructure;
  /**
   * Le template respecte les contraintes de lecture ATS (colonne unique,
   * pas de tableau). Défaut : true. Les templates graphiques passent à false
   * pour afficher un avertissement « envoi à un recruteur humain ».
   */
  atsOptimized?: boolean;
  /** Tags profils recommandés (ex: 'fr', 'international', 'dev', 'senior') */
  recommendedFor?: string[];
  /** Le template supporte l'affichage d'une photo (par défaut true) */
  supportsPhoto?: boolean;
  /** Palettes proposées (1re = défaut). Si omis, fallback sur palettes sobres. */
  palettes?: Palette[];
  /** Densité par défaut (compact/normal/comfortable) */
  defaultDensity?: DensityId;
  /** Variantes d'ent\u00eate autorisées (1re = défaut) */
  headerVariants?: HeaderVariantId[];
  docx: {
    pageSize: 'A4' | 'LETTER';
    margins: { top: number; right: number; bottom: number; left: number };
    fonts: {
      heading: string;
      body: string;
    };
    headingSize: number;
    bodySize: number;
    lineSpacing: number;
    sectionSpacing: number;
    useColumns: boolean;
    useTables: boolean;
    /**
     * Titres de section dans Word : `bottom` (filet dessous, défaut), `left` (repère vertical),
     * `none`, `label` (fond clair derrière le texte seul) ou `band` (fond clair pleine largeur).
     */
    headingRule?: 'bottom' | 'left' | 'none' | 'label' | 'band';
    /** Titres de section en italique dans Word (défaut : false). */
    headingItalic?: boolean;
    /** Nom surligné d'un fond clair dans Word (défaut : false). */
    nameHighlight?: boolean;
    /** Titres de section en capitales dans Word (défaut : true). */
    headingUppercase?: boolean;
  };
  preview: {
    containerClass: string;
    headingClass: string;
    entryClass: string;
    titleClass: string;
    subtitleClass: string;
    dateClass: string;
    descriptionClass: string;
    skillsContainerClass?: string;
    skillClass?: string;
    /** Render skills/languages/interests as inline badges */
    skillBadgeClass?: string;
    /** Wrapper for badge-style entries */
    skillBadgeContainerClass?: string;
    /** Header name class */
    nameClass?: string;
    /** Header title/job class */
    headerTitleClass?: string;
    /** Contact info line class */
    contactClass?: string;
    /** Summary block class */
    summaryClass?: string;
  };
}
