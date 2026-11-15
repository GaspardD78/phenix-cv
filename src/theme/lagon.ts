/**
 * Thème « Lagon » : toutes les couleurs de l'interface. Les jetons sont exposés en variables CSS
 * (`--pc-*`, dans App.css) ; ce fichier en est la source pour les tests de contraste et la doc.
 * Aucune couleur violette ne doit exister en dehors de ce fichier.
 */

export type LagonMode = 'light' | 'dark';

export interface LagonTokens {
  bg: string;
  surface: string;
  card: string;
  border: string;
  borderActive: string;
  hover: string;
  accent: string;
  accentHover: string;
  accentSubtle: string;
  /** Couleur sur fond accentué (texte des boutons principaux). */
  onAccent: string;
  text: string;
  muted: string;
  /** Zone sombre : barre latérale. */
  sidebar: string;
  sidebarText: string;
  sidebarMuted: string;
  /** Couleur décorative (logo, badges). Jamais pour du texte sur fond clair. */
  coral: string;
  /** Variante lisible en texte sur fond clair (contraste AA). */
  coralText: string;
  success: string;
  warning: string;
  danger: string;
}

export const LAGON_LIGHT: LagonTokens = {
  bg: '#F5F8F8',
  surface: '#EAF3F2',
  card: '#FFFFFF',
  border: '#DCEBEA',
  borderActive: '#9CC4C1',
  hover: 'rgba(15,110,110,0.06)',
  accent: '#0F6E6E',
  accentHover: '#0B5A5A',
  accentSubtle: 'rgba(15,110,110,0.10)',
  onAccent: '#FFFFFF',
  text: '#1F2A30',
  muted: '#55656B',
  sidebar: '#0F3D3E',
  sidebarText: '#E6EFEF',
  sidebarMuted: '#A9C4C2',
  coral: '#F2994A',
  coralText: '#B5581A',
  success: '#1E7B4F',
  warning: '#8A5A00',
  danger: '#B42318',
};

export const LAGON_DARK: LagonTokens = {
  bg: '#0E1A1B',
  surface: '#112123',
  card: '#142526',
  border: '#1F3B3C',
  borderActive: '#2E5657',
  hover: 'rgba(63,184,176,0.08)',
  accent: '#3FB8B0',
  accentHover: '#63CBC4',
  accentSubtle: 'rgba(63,184,176,0.16)',
  onAccent: '#0E1A1B',
  text: '#E6EFEF',
  muted: '#9AB6B4',
  sidebar: '#0A1415',
  sidebarText: '#E6EFEF',
  sidebarMuted: '#8FB0AE',
  coral: '#F2994A',
  coralText: '#F2994A',
  success: '#5BD19A',
  warning: '#F2C46B',
  danger: '#FF8A80',
};

export const LAGON: Record<LagonMode, LagonTokens> = { light: LAGON_LIGHT, dark: LAGON_DARK };

/** Paires texte / fond à vérifier (WCAG AA : 4,5:1 pour le texte normal). */
export function contrastPairs(t: LagonTokens): [string, string, string][] {
  return [
    ['texte principal sur fond', t.text, t.bg],
    ['texte principal sur carte', t.text, t.card],
    ['texte secondaire sur fond', t.muted, t.bg],
    ['texte secondaire sur carte', t.muted, t.card],
    ['texte principal sur surface (sommaire de l\'aide)', t.text, t.surface],
    ['texte secondaire sur surface', t.muted, t.surface],
    ['lien actif sur fond teinté', t.accent, t.accentSubtle.includes('rgba') ? t.surface : t.accentSubtle],
    ['texte sur bouton principal', t.onAccent, t.accent],
    ['lien / accent sur carte', t.accent, t.card],
    ['lien / accent sur fond', t.accent, t.bg],
    ['texte de la barre latérale', t.sidebarText, t.sidebar],
    ['texte discret de la barre latérale', t.sidebarMuted, t.sidebar],
    ['texte corail sur carte', t.coralText, t.card],
    ['succès sur carte', t.success, t.card],
    ['avertissement sur carte', t.warning, t.card],
    ['erreur sur carte', t.danger, t.card],
  ];
}

// ── Contraste (WCAG 2.x) ────────────────────────────────────────────────────

function channel(c: number): number {
  const v = c / 255;
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

/** Luminance relative d'une couleur `#RRGGBB` (les couleurs translucides doivent être posées sur leur fond avant). */
export function luminance(hex: string): number {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(a: string, b: string): number {
  const la = luminance(a), lb = luminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}
