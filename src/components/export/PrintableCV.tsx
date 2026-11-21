import { forwardRef } from 'react';
import { templatePagePadding } from '@/lib/page-margin';
import { CVDocument, CVBlock } from '../../types/cv';
import { MasterEntry, Profile } from '../../types/profile';
import { CVTemplate } from '../../types/template';
import { CVHeader } from './CVHeader';
import { profileForHeader } from '../../lib/header-extras';
import { isPhotoShown } from '../../lib/cv-photo';
import { CVSectionHeader } from './CVSectionHeader';
import { CVEntryBlock } from './CVEntryBlock';
import { CVBadgeGroup } from './CVBadgeGroup';
import { CVCustomText } from './CVCustomText';
import { isCvSkillBlock } from '../../lib/skill-lines';
import { CVSidebar, type SidebarGroup, type SidebarSection } from './CVSidebar';
import { safeCssValue, type CssValueKind } from '../../lib/css-sanitize';
import { readDateSettings } from '../../lib/entry-dates';
import { isSubHeader, parentDisplayFormat, visibleHeaderMask, type SlotKind } from '../../lib/cv-sections';
import { BADGE_ENTRY_TYPES } from '../../lib/skill-lines';

/** Relative luminance of a #rgb / #rrggbb color (0 = black, 1 = white). */
function hexLuminance(hex: string): number {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return 0; // assume dark when unknown
  let h = m[1];
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Narrow-column display formats degrade to a simple list in the sidebar. */
function sidebarFormat(format: DisplayFormat): DisplayFormat {
  return format === 'columns2' || format === 'columns3' || format === 'table' ? 'list' : format;
}

const FONT_STACKS: Record<string, string> = {
  'Calibri': "'Calibri', 'Arial', sans-serif",
  'Arial': "'Arial', sans-serif",
  'Georgia': "'Georgia', serif",
  'Times New Roman': "'Times New Roman', serif",
  'Helvetica': "'Helvetica', 'Arial', sans-serif",
};

/**
 * Plafond de letter-spacing du texte du CV (lisibilité ATS). Au-delà d'environ
 * 0,09 em, les extracteurs de texte PDF (pdfjs-dist, pdftotext, pdfminer.six,
 * pypdf) insèrent des espaces entre les lettres (« E X P É R I E N C E ») et un
 * ATS ne reconnaît plus le mot. Mesures : tests/golden/README.md.
 * Appliqué aux titres de section, aux titres de la bande latérale, au nom et au
 * poste visé, seulement quand le template déclare un espacement plus grand.
 */
export const MAX_LETTER_SPACING_EM = 0.06;
/**
 * Espace minimal (px) exigé par le banc entre la fin de l'intitulé et la date
 * d'une entrée (garde-fou, voir tests/golden/README.md, section Collision
 * intitulé / date). Les extracteurs de texte PDF collent les mots sous 1 px et
 * insèrent une espace dès 1,5 px (mesures à 11 px) : le seuil laisse un facteur 2.
 */
export const ENTRY_DATE_MIN_GAP_PX = 3;
/**
 * Collision intitulé / date : quand la ligne d'une entrée est pleine, l'intitulé
 * touche la date (écart nul) et les extracteurs de texte PDF collent les mots
 * (« Parisfévrier »). Espace minimal garanti entre les deux (`column-gap`, 8 px,
 * bien au-dessus du seuil de 1,5 px des extracteurs).
 */
const ENTRY_DATE_GAP_PX = 8;
/** Espace ajouté entre les mots des éléments plafonnés (compensation visuelle ; 0 = aucune). */
const CAPPED_WORD_SPACING_EM = 0;

/** Letter-spacing (em) des classes Tailwind `tracking-*` d'un template, ou null. */
const TRACKING_EM: Record<string, number> = {
  'tracking-tighter': -0.05, 'tracking-tight': -0.025, 'tracking-normal': 0,
  'tracking-wide': 0.025, 'tracking-wider': 0.05, 'tracking-widest': 0.1,
};
function trackingEm(classes: string | undefined): number | null {
  let value: number | null = null;
  for (const cls of (classes ?? '').split(/\s+/)) {
    const arbitrary = /^tracking-\[(-?[\d.]+)em\]$/.exec(cls);
    if (arbitrary) value = parseFloat(arbitrary[1]);
    else if (cls in TRACKING_EM) value = TRACKING_EM[cls];
  }
  return value;
}

/** Règle ramenant `selector` au plafond si les classes du template le dépassent. */
function letterSpacingCap(selector: string, classes: string | undefined): string {
  const em = trackingEm(classes);
  if (em === null || em <= MAX_LETTER_SPACING_EM) return '';
  const words = CAPPED_WORD_SPACING_EM ? ` word-spacing: ${CAPPED_WORD_SPACING_EM}em;` : '';
  return `${selector} { letter-spacing: ${MAX_LETTER_SPACING_EM}em;${words} }`;
}


type DisplayFormat = 'badges' | 'comma' | 'list' | 'columns2' | 'columns3' | 'table';

interface PrintableCVProps {
  cv: CVDocument;
  profile: Profile;
  blocks: CVBlock[];
  entries: MasterEntry[];
  template: CVTemplate;
}

export const PrintableCV = forwardRef<HTMLDivElement, PrintableCVProps>(
  ({ cv, profile: masterProfile, blocks, entries, template }, ref) => {
    const profile = profileForHeader(masterProfile, cv.settings);
    const sortedBlocks = [...blocks].sort((a, b) => a.sortOrder - b.sortOrder);

    const title = cv.targetJob || profile.title;
    const summary = cv.customSummary || profile.summary;
    const dateSettings = readDateSettings(cv.settings);

    // Design settings — chaque valeur interpolée dans cssOverrides passe par
    // safeCssValue : les réglages viennent de la DB (backup/sync importables)
    // et ne doivent pas pouvoir injecter de CSS arbitraire.
    const settings = (cv.settings || {}) as Record<string, string>;
    const s = (key: string, kind: CssValueKind): string => safeCssValue(settings[key] || '', kind);
    const fontStack = (key: string): string =>
      settings[key] ? (FONT_STACKS[settings[key]] || s(key, 'fontFamily')) : '';

    const fontFamily = FONT_STACKS[settings.fontFamily || 'Calibri'] || FONT_STACKS['Calibri'];
    const fontSize = s('fontSize', 'length') || '11px';
    const primaryColor = s('primaryColor', 'color');
    const pageMargin = s('pageMargin', 'length');
    const sectionBorderStyle = s('sectionBorderStyle', 'keyword');

    const headerFontSize      = s('headerFontSize', 'length');
    const headerFontFamily    = fontStack('headerFontFamily');
    const headerFontWeight    = s('headerFontWeight', 'keyword');
    const headerTextTransform = s('headerTextTransform', 'keyword');
    const headerTextAlign     = s('headerTextAlign', 'keyword');
    const subtitleFontSize    = s('subtitleFontSize', 'length');
    const subtitleFontFamily  = fontStack('subtitleFontFamily');
    const subtitleFontStyle   = s('subtitleFontStyle', 'keyword');
    const subtitleFontWeight  = s('subtitleFontWeight', 'keyword');
    const bodyFontFamily      = fontStack('bodyFontFamily');
    const bodyFontSize        = s('bodyFontSize', 'length');
    const bodyTextAlign       = s('bodyTextAlign', 'keyword');
    const bodyLineHeight      = s('bodyLineHeight', 'length');
    const entrySpacing        = s('entrySpacing', 'length');
    const sectionHeaderGap    = s('sectionHeaderGap', 'length');
    const entryTitleGap       = s('entryTitleGap', 'length');
    const summaryFontFamily   = fontStack('summaryFontFamily');
    const summaryFontSize     = s('summaryFontSize', 'length');
    const summaryFontStyle    = s('summaryFontStyle', 'keyword');
    const summaryFontWeight   = s('summaryFontWeight', 'keyword');
    const summaryTextAlign    = s('summaryTextAlign', 'keyword');
    const summaryLineHeight   = s('summaryLineHeight', 'length');

    // Photo settings
    const photoShape  = settings.photoShape  || '';
    const photoSize   = settings.photoSize   || '';
    const photoBorder = settings.photoBorder || '';

    // Header style
    const headerStyle = settings.headerStyle || '';

    // CV header (name / job title / contact) settings
    const nameFontSize      = s('nameFontSize', 'length');
    const nameFontWeight    = s('nameFontWeight', 'keyword');
    const nameTextTransform = s('nameTextTransform', 'keyword');
    const nameLineBreak     = settings.nameLineBreak     || '';
    const titleFontSize     = s('titleFontSize', 'length');
    const titleFontStyle    = s('titleFontStyle', 'keyword');
    const contactFontSize   = s('contactFontSize', 'length');
    const isBanner = ['accent-banner', 'dark-banner', 'gradient-banner'].includes(headerStyle);

    // ── Layout deux colonnes (templates graphiques) ──────────────────────────
    const isSidebar = template.layout === 'sidebar-left' || template.layout === 'sidebar-right';
    const sidebarOnRight = template.layout === 'sidebar-right';
    const accentColor = primaryColor || template.palettes?.[0]?.accent || '#1f2937';
    const sidebarBg = template.sidebar?.bg || accentColor;
    const sidebarIsDark = hexLuminance(sidebarBg) < 0.5;
    const sidebarText = template.sidebar?.text || (sidebarIsDark ? '#ffffff' : '#1f2937');
    const sidebarHeading = template.sidebar?.heading || sidebarText;
    const sidebarWidth = template.sidebar?.width || '34%';
    // Padding de la colonne principale = marge de page (densité) ou défaut.
    const mainPad = pageMargin || '40px 44px';
    // Couleurs adaptées au contraste de la bande (clair vs sombre).
    const sbBadgeBg     = sidebarIsDark ? 'rgba(255,255,255,0.16)' : 'rgba(0,0,0,0.05)';
    const sbBadgeBorder = sidebarIsDark ? 'rgba(255,255,255,0.32)' : 'rgba(0,0,0,0.12)';
    const sbRule        = sidebarIsDark ? 'rgba(255,255,255,0.28)' : 'rgba(0,0,0,0.12)';
    const sbRing        = sidebarIsDark ? 'rgba(255,255,255,0.5)'  : 'rgba(0,0,0,0.18)';

    // ── Organisation interne (template.structure, layout `header-columns`) ───
    // Tout est facultatif : sans structure, le rendu (et le DOM) reste celui d'origine.
    const structure = template.structure ?? {};
    const isHeaderColumns = template.layout === 'header-columns';
    const isMarginSections = structure.section === 'margin';
    const isSplitHeader = structure.header === 'split';
    const isTwoEqual = template.layout === 'two-equal';
    const isMagazine = template.layout === 'magazine';
    const isHero = structure.header === 'hero';
    const hasTiles = structure.badges === 'tiles';
    /** Marges intérieures de la page (écran) : réglage du CV, sinon classes px-/py- du modèle. */
    const screenPad = (() => {
      if (pageMargin) { const p = pageMargin.trim().split(/\s+/); return { v: p[0], h: p[1] || p[0] }; }
      const d = templatePagePadding(template);
      return { v: `${d.v}px`, h: `${d.h}px` };
    })();
    const heroPhotoSize = settings.photoSize || '96px';
    // Interrupteur « Afficher la photo » du CV (lib/cv-photo.ts) : même règle partout.
    const hasPhoto = isPhotoShown(profile, cv.settings);
    const entryStyle = structure.entry;
    /** Une seule couleur d'accent : teintes claires dérivées par mélange avec le blanc (pas de dégradé). */
    const accentTint = (pct: number) => `color-mix(in srgb, ${accentColor} ${pct}%, white)`;

    // Compute effective container padding for full-width banner bleed (negative margin trick)
    const getBannerPad = () => {
      if (pageMargin) {
        const parts = pageMargin.trim().split(/\s+/);
        return { v: parts[0], h: parts[1] || parts[0] };
      }
      // Extract from template containerClass: 'p-10' → 40px, 'p-12' → 48px
      const m = template.preview.containerClass.match(/\bp-(\d+)\b/);
      const px = m ? parseInt(m[1]) * 4 : 40;
      return { v: `${px}px`, h: `${px}px` };
    };

    const bannerColor = primaryColor || '#1f2937';
    const headerBlockStyle: React.CSSProperties = (() => {
      if (isBanner) {
        const { v, h } = getBannerPad();
        return {
          marginLeft: `-${h}`, marginRight: `-${h}`,
          marginTop: `-${v}`,
          paddingLeft: h, paddingRight: h,
          paddingTop: v, paddingBottom: v,
          marginBottom: '1.5rem',
          ...(headerStyle === 'gradient-banner'
            ? { background: `linear-gradient(135deg, ${bannerColor} 0%, ${bannerColor}bb 100%)` }
            : { backgroundColor: headerStyle === 'dark-banner' ? '#1f2937' : bannerColor }),
        };
      }
      if (headerStyle === 'accent-light') {
        return {
          backgroundColor: primaryColor ? `${primaryColor}18` : '#f3f4f6',
          padding: '14px 18px',
          borderRadius: '6px',
          borderLeft: `3px solid ${primaryColor || '#9ca3af'}`,
          marginBottom: '1.25rem',
        };
      }
      return {};
    })();

    const h3Rules = [
      primaryColor       ? `color: ${primaryColor}; border-color: ${primaryColor};` : '',
      headerFontSize     ? `font-size: ${headerFontSize};`                          : '',
      headerFontWeight   ? `font-weight: ${headerFontWeight};`                      : '',
      headerTextTransform? `text-transform: ${headerTextTransform};`                : '',
      headerTextAlign    ? `text-align: ${headerTextAlign};`                        : '',
      sectionBorderStyle ? `border-bottom-style: ${sectionBorderStyle};`            : '',
      sectionBorderStyle === 'none' ? `border-bottom-width: 0; padding-bottom: 0;`  : '',
    ].filter(Boolean).join(' ');

    const cssOverrides = [
      // Lisibilité ATS : pas de ligatures. Les glyphes ﬀ ﬁ ﬂ ﬃ ﬄ (U+FB00 à U+FB04)
      // sont extraits tels quels par pdfminer et pypdf (« certiﬁcation »).
      // Aussi à l'écran : l'aperçu et la mesure de page doivent suivre le PDF.
      '#printable-cv { font-variant-ligatures: none; }',
      // Lisibilité ATS : intitulé et date d'une entrée séparés (voir ENTRY_DATE_GAP_PX).
      // Un espace placé dans le HTML entre les deux éléments d'une rangée flex est
      // ignoré à la mise en page, donc absent du PDF : l'espace est rendu par un
      // pseudo-élément (`white-space: pre` le conserve) en fin de bloc d'intitulé.
      // Il reste dans le texte du PDF même si l'écart tombait à zéro, sans toucher à
      // la boîte de la date (en début de date, il décalerait ses lignes repliées).
      // Dates indivisibles : l'intitulé cède la place (il se replie lui-même) et la date
      // garde sa largeur, plafonnée à 45 % de la ligne. Sans cela, `flex-shrink` repliait
      // la date sur deux lignes (« janvier 2010 » puis « - août 2015 »).
      `#printable-cv .cv-title-row { column-gap: ${ENTRY_DATE_GAP_PX}px; }`,
      '#printable-cv .cv-title-row > :first-child { flex: 1 1 0; min-width: 0; }',
      // Les dates ne se coupent jamais sur deux lignes (« juin 2024 – auj. » reste d'un bloc).
      '#printable-cv .cv-title-row > .cv-date { flex: 0 0 auto; max-width: 45%; white-space: nowrap; }',
      // Ligne 2 (entreprise · lieu) : sous l'intitulé, en texte secondaire un peu plus petit.
      '#printable-cv .cv-meta-row { margin: 0 0 2px; line-height: 1.35; }',
      // Texte secondaire : gris lisible (contraste AA) quel que soit le modèle ; la couleur choisie
      // par la personne (réglage « couleur principale ») reste prioritaire, voir plus bas.
      '#printable-cv .cv-meta-row .cv-subtitle { display: block; font-size: 0.92em; font-weight: 400; font-style: normal; color: #55656B; }',
      '#printable-cv .cv-title-row > :first-child::after { content: " "; white-space: pre; }',
      // Lisibilité ATS : plafond de letter-spacing (voir MAX_LETTER_SPACING_EM).
      letterSpacingCap('#printable-cv h3', template.preview.headingClass),
      letterSpacingCap('#printable-cv .cv-name', template.preview.nameClass),
      letterSpacingCap('#printable-cv .cv-job-title', template.preview.headerTitleClass),
      h3Rules ? `#printable-cv h3 { ${h3Rules} }` : '',
      headerFontFamily   ? `#printable-cv h3 { font-family: ${headerFontFamily} !important; }` : '',
      fontSize !== '11px'
        ? `#printable-cv p, #printable-cv li, #printable-cv .cv-desc, #printable-cv .cv-badge-item { font-size: ${fontSize} !important; }`
        : '',
      subtitleFontFamily ? `#printable-cv .cv-title, #printable-cv .cv-subtitle, #printable-cv .cv-date { font-family: ${subtitleFontFamily} !important; }` : '',
      subtitleFontSize   ? `#printable-cv .cv-title, #printable-cv .cv-subtitle, #printable-cv .cv-date { font-size: ${subtitleFontSize} !important; }` : '',
      subtitleFontStyle  ? `#printable-cv .cv-title, #printable-cv .cv-subtitle, #printable-cv .cv-date { font-style: ${subtitleFontStyle} !important; }` : '',
      subtitleFontWeight ? `#printable-cv .cv-title, #printable-cv .cv-subtitle, #printable-cv .cv-date { font-weight: ${subtitleFontWeight} !important; }` : '',
      bodyFontFamily     ? `#printable-cv p, #printable-cv li, #printable-cv .cv-desc { font-family: ${bodyFontFamily} !important; }` : '',
      bodyFontSize       ? `#printable-cv p, #printable-cv li, #printable-cv .cv-desc, #printable-cv .cv-badge-item { font-size: ${bodyFontSize} !important; }` : '',
      bodyTextAlign      ? `#printable-cv .cv-desc, #printable-cv .cv-desc p, #printable-cv .cv-desc li { text-align: ${bodyTextAlign} !important; }` : '',
      bodyLineHeight     ? `#printable-cv .cv-desc, #printable-cv .cv-desc p, #printable-cv .cv-desc li { line-height: ${bodyLineHeight} !important; }` : '',
      entrySpacing       ? `#printable-cv .cv-entry { margin-bottom: ${entrySpacing} !important; }` : '',
      sectionHeaderGap   ? `#printable-cv h3 { margin-bottom: ${sectionHeaderGap} !important; }` : '',
      entryTitleGap      ? `#printable-cv .cv-title-row { margin-bottom: ${entryTitleGap} !important; }` : '',
      summaryFontFamily  ? `#printable-cv .cv-summary { font-family: ${summaryFontFamily} !important; }` : '',
      summaryFontSize    ? `#printable-cv .cv-summary { font-size: ${summaryFontSize} !important; }` : '',
      summaryFontStyle   ? `#printable-cv .cv-summary { font-style: ${summaryFontStyle} !important; }` : '',
      summaryFontWeight  ? `#printable-cv .cv-summary { font-weight: ${summaryFontWeight} !important; }` : '',
      summaryTextAlign   ? `#printable-cv .cv-summary { text-align: ${summaryTextAlign} !important; }` : '',
      summaryLineHeight  ? `#printable-cv .cv-summary { line-height: ${summaryLineHeight} !important; }` : '',
      (!isSidebar && pageMargin) ? `#printable-cv { padding: ${pageMargin} !important; }` : '',
      // Marges imprimées = marges de l'aperçu (réglage « Marges » du CV, sinon celles du modèle).
      isSidebar ? '' : (() => {
        const pv = screenPad.v, ph = screenPad.h;
        const rules = [`@media print { #printable-cv { padding: ${pv} ${ph} !important; } }`];
        if (isBanner) {
          rules.push(
            `@media print { #printable-cv .cv-header-block { ` +
            `margin-left: -${ph} !important; margin-right: -${ph} !important; margin-top: -${pv} !important; ` +
            `padding-left: ${ph} !important; padding-right: ${ph} !important; padding-top: ${pv} !important; } }`
          );
        }
        return rules.join('\n');
      })(),
      nameFontSize      ? `#printable-cv .cv-name { font-size: ${nameFontSize} !important; }` : '',
      nameFontWeight    ? `#printable-cv .cv-name { font-weight: ${nameFontWeight} !important; }` : '',
      nameTextTransform ? `#printable-cv .cv-name { text-transform: ${nameTextTransform} !important; }` : '',
      titleFontSize     ? `#printable-cv .cv-job-title { font-size: ${titleFontSize} !important; }` : '',
      titleFontStyle    ? `#printable-cv .cv-job-title { font-style: ${titleFontStyle} !important; }` : '',
      contactFontSize   ? `#printable-cv .cv-contact-info { font-size: ${contactFontSize} !important; }` : '',
      primaryColor       ? `#printable-cv .cv-badge { border-color: ${primaryColor}30; background-color: ${primaryColor}10; color: ${primaryColor}; }` : '',
      primaryColor       ? `#printable-cv { border-color: ${primaryColor}; }` : '',
      primaryColor       ? `#printable-cv .cv-subtitle { color: ${primaryColor} !important; }` : '',
      primaryColor       ? `#printable-cv .cv-main-col .cv-subheading, #printable-cv > .cv-subheading { color: ${primaryColor}; }` : '',
      primaryColor       ? `#printable-cv .cv-job-title { color: ${primaryColor} !important; }` : '',
      primaryColor       ? `#printable-cv h3::after { background-color: ${primaryColor} !important; }` : '',
      primaryColor       ? `#printable-cv h3::before { color: ${primaryColor} !important; }` : '',
      isBanner ? `#printable-cv .cv-header-block, #printable-cv .cv-header-block * { color: white !important; }` : '',
      isBanner ? `#printable-cv .cv-header-block .cv-badge { background-color: rgba(255,255,255,0.15) !important; border-color: rgba(255,255,255,0.4) !important; color: white !important; }` : '',
      // ── Bande latérale (templates graphiques) ──────────────────────────────
      isSidebar ? `#printable-cv { display: flex; align-items: stretch; padding: 0 !important; min-height: 297mm; }` : '',
      // CV de plusieurs pages : la bande est aussi peinte par un calque fixe, que l'impression répète sur
      // chaque page ; elle descend ainsi jusqu'en bas de la dernière page, même quand le texte s'arrête avant.
      isSidebar ? `@media print { #printable-cv { background: transparent !important; } #printable-cv::before { content: ""; position: fixed; top: 0; bottom: 0; ${sidebarOnRight ? 'right' : 'left'}: 0; width: ${sidebarWidth}; background: ${sidebarBg}; z-index: -1; } }` : '',
      isSidebar ? `#printable-cv .cv-sidebar { flex: 0 0 ${sidebarWidth}; width: ${sidebarWidth}; background: ${sidebarBg}; color: ${sidebarText}; padding: 30px 24px; box-sizing: border-box; ${sidebarOnRight ? 'order: 2;' : ''} }` : '',
      isSidebar ? `#printable-cv .cv-main-col { flex: 1 1 auto; min-width: 0; padding: ${mainPad}; box-sizing: border-box; ${sidebarOnRight ? 'order: 1;' : ''} }` : '',
      isSidebar ? `#printable-cv .cv-sidebar a { color: inherit; text-decoration: none; }` : '',
      isSidebar ? `#printable-cv .cv-sidebar, #printable-cv .cv-sidebar p, #printable-cv .cv-sidebar li, #printable-cv .cv-sidebar span, #printable-cv .cv-sidebar .cv-badge-item { color: ${sidebarText} !important; }` : '',
      isSidebar ? `#printable-cv .cv-sidebar { font-size: 11.5px; line-height: 1.5; }` : '',
      isSidebar ? `#printable-cv .cv-sidebar-heading { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: ${MAX_LETTER_SPACING_EM}em;${CAPPED_WORD_SPACING_EM ? ` word-spacing: ${CAPPED_WORD_SPACING_EM}em;` : ''} color: ${sidebarHeading}; border-bottom: 1px solid ${sbRule}; padding-bottom: 5px; margin-bottom: 10px; }` : '',
      isSidebar ? `#printable-cv .cv-sidebar-icon svg { opacity: 0.85; }` : '',
      isSidebar ? `#printable-cv .cv-sidebar-photo-ring { border: 3px solid ${sbRing}; }` : '',
      isSidebar ? `#printable-cv .cv-sidebar .cv-badge { background-color: ${sbBadgeBg} !important; border-color: ${sbBadgeBorder} !important; color: ${sidebarText} !important; }` : '',
      // La colonne principale conserve les couleurs d'accent du template.
      isSidebar && primaryColor ? `#printable-cv .cv-main-col h3 { color: ${primaryColor}; border-color: ${primaryColor}; }` : '',
      // ── Dates en marge (structure.entry = date-gutter) ─────────────────────
      structure.entry === 'date-gutter' ? '#printable-cv .cv-entry-gutter { display: grid; grid-template-columns: 24% minmax(0, 1fr); column-gap: 14px; }' : '',
      structure.entry === 'date-gutter' ? '#printable-cv .cv-gutter-date { white-space: normal; padding-top: 1px; margin-bottom: 0; }' : '',
      // Espace conservé dans le texte du PDF entre la date et l'intitulé (voir ENTRY_DATE_GAP_PX).
      structure.entry === 'date-gutter' ? '#printable-cv .cv-gutter-date:not(:empty)::after { content: " "; white-space: pre; }' : '',
      // ── Frise (structure.entry = timeline) : filet continu et pastille par entrée ──
      structure.entry === 'timeline' ? `#printable-cv .cv-entry-timeline { position: relative; margin-left: 6px; padding-left: 18px; border-left: 2px solid ${accentTint(35)}; margin-bottom: 0 !important; padding-bottom: ${entrySpacing || '14px'}; }` : '',
      structure.entry === 'timeline' ? `#printable-cv .cv-entry-timeline::before { content: ""; position: absolute; left: -7px; top: 3px; width: 12px; height: 12px; box-sizing: border-box; border-radius: 9999px; background: #ffffff; border: 2px solid ${accentColor}; }` : '',
      // ── En-tête scindé : filet d'accent épais sous l'en-tête ────────────────
      isSplitHeader ? `#printable-cv .cv-header-rule { border: 0; border-top: 3px solid ${accentColor}; margin: 0 0 16px; }` : '',
      // ── Titres en marge (structure.section = margin) ────────────────────────
      isMarginSections ? '#printable-cv .cv-margin-section { display: grid; grid-template-columns: 26% minmax(0, 1fr); column-gap: 16px; margin-top: 16px; }' : '',
      isMarginSections ? '#printable-cv .cv-margin-section > h3 { margin: 0; padding-top: 2px; text-align: right; break-after: auto; }' : '',
      isMarginSections ? `#printable-cv .cv-margin-body { min-width: 0; border-left: 1px solid ${accentTint(40)}; padding-left: 14px; }` : '',
      isMarginSections ? '#printable-cv .cv-margin-body > :last-child { margin-bottom: 0; }' : '',
      isMarginSections ? `#printable-cv .cv-margin-offset { margin-left: calc(26% + 16px); padding-left: 15px; }` : '',
      // ── En-tête puis deux colonnes séparées par un filet (layout header-columns) ──
      isHeaderColumns ? '#printable-cv .cv-columns { display: flex; align-items: stretch; }' : '',
      isHeaderColumns ? `#printable-cv .cv-side-col { flex: 0 0 30%; width: 30%; box-sizing: border-box; padding-right: 18px; border-right: 1.5px solid ${accentColor}; }` : '',
      isHeaderColumns ? '#printable-cv .cv-columns > .cv-main-col { flex: 1 1 auto; min-width: 0; padding-left: 20px; }' : '',
      isHeaderColumns ? '#printable-cv .cv-side-col > :first-child h3, #printable-cv .cv-columns > .cv-main-col > h3:first-child { margin-top: 0; }' : '',
      // ── Deux colonnes égales (layout two-equal) ─────────────────────────────
      isTwoEqual ? '#printable-cv .cv-columns { display: flex; align-items: flex-start; column-gap: 28px; }' : '',
      isTwoEqual ? '#printable-cv .cv-columns > .cv-main-col, #printable-cv .cv-columns > .cv-side-col { flex: 1 1 0; min-width: 0; }' : '',
      isTwoEqual ? '#printable-cv .cv-columns > div > h3:first-child { margin-top: 0; }' : '',
      // ── Monogramme : initiales (décor) dans un carré clair à contour d'accent ──
      structure.header === 'monogram' ? `#printable-cv .cv-monogram { flex: 0 0 auto; width: 78px; height: 78px; box-sizing: border-box; display: flex; align-items: center; justify-content: center; border: 2px solid ${accentColor}; background: ${accentTint(10)}; color: ${accentColor}; font-size: 30px; line-height: 1; }` : '',
      structure.header === 'monogram' ? `#printable-cv .cv-monogram { font-family: Georgia, serif` + ' }' : '',
      structure.header === 'monogram' ? '#printable-cv .cv-monogram::before { content: attr(data-initials); }' : '',
      // ── Grand en-tête : bloc clair pleine largeur, photo ronde à cheval sur son bord ──
      isHero ? `#printable-cv .cv-header-hero { margin: -${screenPad.v} -${screenPad.h} ${hasPhoto ? `calc(${heroPhotoSize} / 2 + 24px)` : '24px'} !important; padding: 30px ${screenPad.h} ${hasPhoto ? '0' : '26px'} !important; background-color: ${accentTint(11)}; }` : '',
      isHero ? `@media print { #printable-cv .cv-header-hero { margin-top: -${screenPad.v} !important; margin-left: -${screenPad.h} !important; margin-right: -${screenPad.h} !important; padding-left: 24px !important; padding-right: 24px !important; } }` : '',
      isHero ? '#printable-cv .cv-hero-photo { margin-top: 18px; transform: translateY(50%); border: 4px solid #ffffff; box-sizing: border-box; }' : '',
      isHero ? '#printable-cv .cv-header-hero .cv-contact-info > div { justify-content: center; }' : '',
      // ── Titres surlignés : aplat clair sous la moitié basse du texte (titres et nom) ──
      structure.heading === 'highlight' ? '#printable-cv h3, #printable-cv .cv-name { display: table; position: relative; isolation: isolate; padding: 0 4px; margin-left: -4px; }' : '',
      structure.heading === 'highlight' ? `#printable-cv h3::before, #printable-cv .cv-name::before { content: ""; position: absolute; left: 0; right: 0; bottom: 0.08em; height: 0.48em; background: ${accentTint(28)}; z-index: -1; }` : '',
      // ── Titres prolongés d'un filet jusqu'au bord droit ─────────────────────
      structure.heading === 'rule-after' ? '#printable-cv h3 { display: flex; align-items: center; column-gap: 12px; }' : '',
      structure.heading === 'rule-after' ? `#printable-cv h3::after { content: ""; flex: 1 1 auto; height: 1px; background-color: ${accentTint(45)}; }` : '',
      // ── Pastille : petit carré avant l'intitulé, dates dans une pastille au contour fin ──
      entryStyle === 'pill' ? `#printable-cv .cv-entry-pill .cv-title::before { content: ""; display: inline-block; width: 7px; height: 7px; margin: 0 7px 1px 0; background: ${accentColor}; }` : '',
      entryStyle === 'pill' ? `#printable-cv .cv-entry-pill .cv-title-row > .cv-date { border: 1px solid ${accentTint(45)}; border-radius: 9999px; padding: 0 8px; line-height: 1.5; }` : '',
      // ── Frise centrale : ligne verticale au centre, contenu alterné ──────────
      entryStyle === 'alternate' ? '#printable-cv .cv-entry-alt { display: grid; grid-template-columns: minmax(0, 1fr) 30px minmax(0, 1fr); margin-bottom: 0 !important; }' : '',
      entryStyle === 'alternate' ? `#printable-cv .cv-alt-date, #printable-cv .cv-alt-body { padding-bottom: ${entrySpacing || '16px'}; grid-row: 1; }` : '',
      entryStyle === 'alternate' ? '#printable-cv .cv-alt-right .cv-alt-date { grid-column: 1; text-align: right; } #printable-cv .cv-alt-right .cv-alt-body { grid-column: 3; }' : '',
      entryStyle === 'alternate' ? '#printable-cv .cv-alt-left .cv-alt-date { grid-column: 3; text-align: left; } #printable-cv .cv-alt-left .cv-alt-body { grid-column: 1; }' : '',
      entryStyle === 'alternate' ? `#printable-cv .cv-alt-node { grid-column: 2; grid-row: 1; position: relative; } #printable-cv .cv-alt-node::before { content: ""; position: absolute; top: 0; bottom: 0; left: 14px; width: 2px; background: ${accentTint(35)}; }` : '',
      entryStyle === 'alternate' ? `#printable-cv .cv-alt-node::after { content: ""; position: absolute; top: 2px; left: 9px; width: 12px; height: 12px; box-sizing: border-box; border-radius: 9999px; background: #ffffff; border: 2px solid ${accentColor}; }` : '',
      entryStyle === 'alternate' ? '#printable-cv .cv-alt-date .cv-date { white-space: normal; } #printable-cv h3 { text-align: center; }' : '',
      // ── Magazine : filet épais, colonne large et encadré clair à droite ───────
      isMagazine ? `#printable-cv .cv-header-rule { border: 0; border-top: 4px solid ${accentColor}; margin: 0 0 20px; }` : '',
      isMagazine ? '#printable-cv .cv-columns { display: flex; align-items: flex-start; column-gap: 24px; }' : '',
      isMagazine ? '#printable-cv .cv-columns > .cv-main-col { flex: 1 1 63%; min-width: 0; } #printable-cv .cv-columns > .cv-main-col > h3:first-child { margin-top: 0; }' : '',
      isMagazine ? `#printable-cv .cv-panel { flex: 0 0 34%; width: 34%; box-sizing: border-box; padding: 16px 16px 6px; border-radius: 10px; background-color: ${accentTint(8)}; }` : '',
      isMagazine ? '#printable-cv .cv-panel > :first-child, #printable-cv .cv-panel > :first-child h3 { margin-top: 0; } #printable-cv .cv-panel .cv-panel-lead { margin-bottom: 14px; }' : '',
      // ── Tuiles : sections « badges » en fin de CV, en mosaïque claire ─────────
      hasTiles ? '#printable-cv .cv-tiles { display: grid; grid-template-columns: repeat(var(--cv-tile-cols), minmax(0, 1fr)); gap: 12px; margin-top: 18px; }' : '',
      hasTiles ? `#printable-cv .cv-tiles > .cv-sidebar-section { margin: 0; padding: 12px 14px; border-radius: 8px; background-color: ${accentTint(9)}; break-inside: avoid; }` : '',
      hasTiles ? '#printable-cv .cv-tiles > .cv-sidebar-section h3 { margin-top: 0; }' : '',
      // ── Titres en étiquette ou en bande claire (une teinte de l'accent, pas de dégradé) ──
      structure.heading === 'label' || structure.heading === 'band' ? `#printable-cv h3 { background-color: ${accentTint(13)}; }` : '',
      structure.heading === 'label' ? '#printable-cv h3 { display: table; padding: 2px 9px; border-radius: 3px; }' : '',
      structure.heading === 'band' ? '#printable-cv h3 { display: block; padding: 4px 9px; }' : '',
      // ── Entrée sur une ligne (inline) ───────────────────────────────────────
      entryStyle === 'inline' ? '#printable-cv .cv-inline-meta { font-weight: 400; color: #55656B; }' : '',
      // ── Dates sur la ligne de l'entreprise (date-below, hanging) ───────────
      entryStyle === 'date-below' || entryStyle === 'hanging' ? '#printable-cv .cv-entry-date-below .cv-meta-row .cv-subtitle, #printable-cv .cv-entry-hanging .cv-meta-row .cv-subtitle { display: inline; }' : '',
      entryStyle === 'date-below' || entryStyle === 'hanging' ? '#printable-cv .cv-meta-row .cv-meta-sep { color: #55656B; font-size: 0.92em; }' : '',
      entryStyle === 'hanging' ? '#printable-cv .cv-hanging-body { padding-left: 20px; }' : '',
      // ── Cadres (card) : filet fin teinté, liseré d'accent à gauche, fond blanc ──
      entryStyle === 'card' ? `#printable-cv .cv-entry-card { border: 1px solid ${accentTint(28)}; border-left: 3px solid ${accentColor}; border-radius: 6px; padding: 8px 12px 9px; background: #ffffff; }` : '',
    ].filter(Boolean).join('\n');

    // Pre-process blocks to group badge entries
    type RenderItem =
      | { type: 'block'; block: CVBlock }
      | { type: 'badge-group'; blocks: CVBlock[]; format: DisplayFormat };

    const renderItems: RenderItem[] = [];
    let i = 0;
    while (i < sortedBlocks.length) {
      const block = sortedBlocks[i];
      if (!block.isVisible) { i++; continue; }

      const startsGroup = isCvSkillBlock(block) || (() => {
        if (block.blockType !== 'entry_ref' || !block.entryId) return false;
        const entry = entries.find(e => e.id === block.entryId);
        return Boolean(entry && BADGE_ENTRY_TYPES.includes(entry.entryType));
      })();
      if (startsGroup) {
        // Compétences propres au CV (étiquettes de l'IA, anciennes lignes) et éléments badges consécutifs : un seul groupe.
        const badgeGroup: CVBlock[] = [block];
        let j = i + 1;
        while (j < sortedBlocks.length) {
          const next = sortedBlocks[j];
          if (!next.isVisible) { j++; continue; }
          if (isCvSkillBlock(next)) { badgeGroup.push(next); j++; continue; }
          if (next.blockType !== 'entry_ref' || !next.entryId) break;
          const nextEntry = entries.find(e => e.id === next.entryId);
          if (!nextEntry || !BADGE_ENTRY_TYPES.includes(nextEntry.entryType)) break;
          badgeGroup.push(next);
          j++;
        }
        // Format hérité du titre de SECTION parent : un sous-en-tête de catégorie
        // ne change pas le format d'affichage.
        const format = (parentDisplayFormat(sortedBlocks, i) as DisplayFormat | undefined) || 'badges';
        renderItems.push({ type: 'badge-group', blocks: badgeGroup, format });
        i = j;
        continue;
      }

      renderItems.push({ type: 'block', block });
      i++;
    }

    // Aucune section vide : un en-tête (section ou sous-en-tête) n'est rendu que si un
    // contenu visible le suit avant le prochain en-tête (voir lib/cv-sections.ts).
    const slotKind = (item: RenderItem): SlotKind => {
      if (item.type === 'badge-group') return 'content';
      const b = item.block;
      if (b.blockType === 'section_header') return isSubHeader(b) ? 'sub' : 'section';
      if (b.blockType === 'custom_text') return (b.customContent ?? '').trim() ? 'content' : 'skip';
      if (b.blockType === 'entry_ref' && b.entryId && entries.some(e => e.id === b.entryId)) return 'content';
      return 'skip';
    };
    const keepMask = visibleHeaderMask(renderItems.map(slotKind));
    const visibleItems = renderItems.filter((_, idx) => keepMask[idx]);

    // For sidebar layouts, split sections: badge-only sections (skills, langues,
    // intérêts, certifications) go to the sidebar; everything else stays in the
    // main column. Sections are delimited by section_header blocks.
    const sidebarSections: SidebarSection[] = [];
    // `header-columns` range aussi les sections « badges » dans une colonne à part.
    const splitsSections = isSidebar || isHeaderColumns || isMagazine || hasTiles;
    // Deux colonnes égales : sections d'expériences, de projets ou de bénévolat à gauche, le reste à droite.
    const LEFT_COLUMN_TYPES = ['experience', 'project', 'volunteer'];
    const equalColumns = (() => {
      if (!isTwoEqual) return null;
      const left: RenderItem[] = [];
      const right: RenderItem[] = [];
      let target = left;
      let k = 0;
      while (k < visibleItems.length) {
        const item = visibleItems[k];
        if (item.type === 'block' && item.block.blockType === 'section_header' && !isSubHeader(item.block)) {
          let j = k + 1;
          let hasLeftType = false;
          while (j < visibleItems.length) {
            const next = visibleItems[j];
            if (next.type === 'block' && next.block.blockType === 'section_header' && !isSubHeader(next.block)) break;
            if (next.type === 'block' && next.block.blockType === 'entry_ref') {
              const e = entries.find(x => x.id === next.block.entryId);
              if (e && LEFT_COLUMN_TYPES.includes(e.entryType)) hasLeftType = true;
            }
            j++;
          }
          target = hasLeftType ? left : right;
        }
        target.push(item);
        k++;
      }
      return { left, right };
    })();
    const mainItems: RenderItem[] = splitsSections ? [] : visibleItems;
    if (splitsSections) {
      type Group = { header: CVBlock | null; items: RenderItem[] };
      const groups: Group[] = [];
      let current: Group | null = null;
      for (const item of visibleItems) {
        if (item.type === 'block' && item.block.blockType === 'section_header' && !isSubHeader(item.block)) {
          current = { header: item.block, items: [] };
          groups.push(current);
        } else {
          if (!current) { current = { header: null, items: [] }; groups.push(current); }
          current.items.push(item);
        }
      }
      for (const g of groups) {
        const isSubItem = (it: RenderItem) => it.type === 'block' && isSubHeader(it.block);
        const badgeOnly = g.items.length > 0
          && g.items.every(it => it.type === 'badge-group' || isSubItem(it))
          && g.items.some(it => it.type === 'badge-group');
        if (badgeOnly && g.header) {
          // Un sous-en-tête de catégorie ouvre un groupe de badges ; les badges qui le
          // précèdent forment un groupe sans libellé.
          const groups: SidebarGroup[] = [];
          for (const it of g.items) {
            if (it.type === 'block') {
              groups.push({ label: it.block.sectionName, blocks: [] });
            } else {
              if (groups.length === 0) groups.push({ label: null, blocks: [] });
              groups[groups.length - 1].blocks.push(...it.blocks);
            }
          }
          const first = g.items.find(it => it.type === 'badge-group') as Extract<RenderItem, { type: 'badge-group' }>;
          sidebarSections.push({
            id: g.header.id,
            sectionName: g.header.sectionName,
            groups,
            format: sidebarFormat(first.format),
          });
        } else {
          if (g.header) mainItems.push({ type: 'block', block: g.header });
          mainItems.push(...g.items);
        }
      }
    }

    /** Magazine : encadré présent seulement s'il a quelque chose à montrer (accroche ou badges). */
    const magazinePanel = isMagazine && (sidebarSections.length > 0 || Boolean(summary));

    // Frise centrale : le côté du contenu alterne à chaque entrée, en repartant à droite à chaque section.
    const altSides = new Map<string, 'left' | 'right'>();
    if (entryStyle === 'alternate') {
      let n = 0;
      for (const it of visibleItems) {
        if (it.type !== 'block') continue;
        if (it.block.blockType === 'section_header' && !isSubHeader(it.block)) { n = 0; continue; }
        if (it.block.blockType === 'entry_ref') altSides.set(it.block.id, n++ % 2 === 0 ? 'right' : 'left');
      }
    }

    const renderItem = (item: RenderItem, idx: number) => {
      if (item.type === 'badge-group') {
        return (
          <div key={`badge-${idx}`} className="cv-entry mb-3 print:break-inside-avoid">
            <CVBadgeGroup blocks={item.blocks} entries={entries} template={template} format={item.format} />
          </div>
        );
      }

      const block = item.block;

      if (block.blockType === 'section_header') {
        return (
          <CVSectionHeader
            key={block.id}
            sectionName={block.sectionName}
            template={template}
            variant={isSubHeader(block) ? 'sub' : 'section'}
          />
        );
      }

      if (block.blockType === 'custom_text') {
        return <CVCustomText key={block.id} content={block.customContent || ''} template={template} />;
      }

      if (block.blockType === 'entry_ref' && block.entryId) {
        const entry = entries.find((e) => e.id === block.entryId);
        if (!entry) return null;
        return <CVEntryBlock key={block.id} block={block} entry={entry} template={template} dateSettings={dateSettings} side={altSides.get(block.id)} />;
      }

      return null;
    };

    // ── Titres en marge : chaque section devient une rangée « titre | contenu » ──
    const renderMain = (items: RenderItem[]) => {
      if (!isMarginSections) return items.map((item, idx) => renderItem(item, idx));
      const out: React.ReactNode[] = [];
      let k = 0;
      while (k < items.length) {
        const item = items[k];
        if (item.type === 'block' && item.block.blockType === 'section_header' && !isSubHeader(item.block)) {
          const header = item;
          const body: React.ReactNode[] = [];
          let j = k + 1;
          while (j < items.length) {
            const next = items[j];
            if (next.type === 'block' && next.block.blockType === 'section_header' && !isSubHeader(next.block)) break;
            body.push(renderItem(next, j));
            j++;
          }
          out.push(
            <section key={`margin-${header.block.id}`} className="cv-margin-section">
              {renderItem(header, k)}
              <div className="cv-margin-body">{body}</div>
            </section>,
          );
          k = j;
        } else {
          // Contenu sans titre de section : aligné sur la colonne de contenu.
          out.push(<div key={`offset-${k}`} className="cv-margin-offset">{renderItem(item, k)}</div>);
          k++;
        }
      }
      return out;
    };

    // ── Layout deux colonnes (templates graphiques) ──────────────────────────
    if (isSidebar) {
      return (
        <div
          id="printable-cv"
          ref={ref}
          style={{ fontFamily }}
          className={`${template.preview.containerClass} bg-white text-black dark:bg-white dark:text-black print:shadow-none print:m-0 print:w-full print:max-w-none`}
        >
          {cssOverrides && <style dangerouslySetInnerHTML={{ __html: cssOverrides }} />}

          <CVSidebar
            profile={profile}
            entries={entries}
            template={template}
            sections={sidebarSections}
            hasPhoto={hasPhoto}
            photoShape={photoShape}
            photoSize={photoSize}
            photoBorder={photoBorder}
          />

          <div className="cv-main-col">
            <div className="cv-header-block mb-4">
              <h1 className={`cv-name ${template.preview.nameClass || 'text-3xl font-bold mb-1'}`}>
                {nameLineBreak === 'split'
                  ? <>{profile.firstName}<br />{profile.lastName}</>
                  : `${profile.firstName} ${profile.lastName}`}
              </h1>
              {title && (
                <h2 className={`cv-job-title ${template.preview.headerTitleClass || 'text-xl font-semibold text-gray-700'}`}>
                  {title}
                </h2>
              )}
            </div>

            {summary && (
              <div className="mb-5">
                <p className={`cv-summary ${template.preview.summaryClass || template.preview.descriptionClass}`}>{summary}</p>
              </div>
            )}

            {mainItems.map((item, idx) => renderItem(item, idx))}
          </div>
        </div>
      );
    }

    return (
      <div
        id="printable-cv"
        ref={ref}
        style={{ fontFamily }}
        className={`${template.preview.containerClass} bg-white text-black dark:bg-white dark:text-black print:shadow-none print:m-0 print:p-0 print:w-full print:max-w-none`}
      >
        {cssOverrides && (
          <style dangerouslySetInnerHTML={{ __html: cssOverrides }} />
        )}

        {/* Header Section */}
        <CVHeader
          profile={profile}
          title={title}
          template={template}
          hasPhoto={hasPhoto}
          photoShape={photoShape}
          photoSize={photoSize}
          photoBorder={photoBorder}
          primaryColor={primaryColor}
          isBanner={isBanner}
          headerStyle={headerStyle}
          headerBlockStyle={headerBlockStyle}
          nameLineBreak={nameLineBreak}
          layout={structure.header}
        />

        {/* Separator — hidden for full-width banners */}
        {!isBanner && (isSplitHeader || isMagazine
          ? <hr className="cv-header-rule" />
          : structure.headerRule === false
          ? null
          : <hr className="border-t border-gray-300 mb-4 print:border-gray-400" style={primaryColor ? { borderColor: primaryColor } : undefined} />
        )}

        {summary && !(isMagazine && magazinePanel) && (
          <div className={isMarginSections ? 'mb-5 cv-margin-offset' : 'mb-5'}>
            <p className={`cv-summary ${template.preview.summaryClass || template.preview.descriptionClass}`}>{summary}</p>
          </div>
        )}

        {/* Dynamic Blocks */}
        {isMagazine && magazinePanel ? (
          <div className="cv-columns">
            <div className="cv-main-col">
              {mainItems.map((item, idx) => renderItem(item, idx))}
            </div>
            <CVSidebar
              profile={profile}
              entries={entries}
              template={template}
              sections={sidebarSections}
              hasPhoto={false}
              photoShape={photoShape}
              photoSize={photoSize}
              photoBorder={photoBorder}
              variant="panel"
              lead={summary ? <p className={`cv-summary cv-panel-lead ${template.preview.summaryClass || template.preview.descriptionClass}`}>{summary}</p> : null}
            />
          </div>
        ) : equalColumns && equalColumns.left.length > 0 && equalColumns.right.length > 0 ? (
          <div className="cv-columns">
            <div className="cv-main-col">{equalColumns.left.map((item, idx) => renderItem(item, idx))}</div>
            <div className="cv-side-col">{equalColumns.right.map((item, idx) => renderItem(item, idx + equalColumns.left.length))}</div>
          </div>
        ) : isHeaderColumns && sidebarSections.length > 0 ? (
          <div className="cv-columns">
            <CVSidebar
              profile={profile}
              entries={entries}
              template={template}
              sections={sidebarSections}
              hasPhoto={false}
              photoShape={photoShape}
              photoSize={photoSize}
              photoBorder={photoBorder}
              variant="column"
            />
            <div className="cv-main-col">
              {mainItems.map((item, idx) => renderItem(item, idx))}
            </div>
          </div>
        ) : renderMain(mainItems)}

        {hasTiles && sidebarSections.length > 0 && (
          <div style={{ ['--cv-tile-cols' as string]: String(Math.min(3, sidebarSections.length)) }} className="cv-tiles-wrap">
            <CVSidebar
              profile={profile}
              entries={entries}
              template={template}
              sections={sidebarSections}
              hasPhoto={false}
              photoShape={photoShape}
              photoSize={photoSize}
              photoBorder={photoBorder}
              variant="tiles"
            />
          </div>
        )}
      </div>
    );
  }
);

PrintableCV.displayName = 'PrintableCV';
