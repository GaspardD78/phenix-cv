import { atsClassic } from './ats-classic';
import { atsModern } from './ats-modern';
import { elegant } from './elegant';
import { minimalist } from './minimalist';
import { tech } from './tech';
import { executive } from './executive';
import { creative } from './creative';
import { academic } from './academic';
import { sidebarModern } from './sidebar-modern';
import { sidebarElegant } from './sidebar-elegant';
import { sidebarTech } from './sidebar-tech';
import { atsChrono } from './ats-chrono';
import { atsScinde } from './ats-scinde';
import { atsFrise } from './ats-frise';
import { marge } from './marge';
import { colonnesFilet } from './colonnes-filet';
import { atsEtiquettes } from './ats-etiquettes';
import { atsBandes } from './ats-bandes';
import { atsLettre } from './ats-lettre';
import { grille } from './grille';
import { cartes } from './cartes';
import { monogramme } from './monogramme';
import { magazine } from './magazine';
import { surligneur } from './surligneur';
import { grandEntete } from './grand-entete';
import { friseCentrale } from './frise-centrale';
import { CVTemplate } from '../types/template';
import type { TemplateCategory } from '../theme/tokens';

export const templates: Record<string, CVTemplate> = {
  'ats-classic': atsClassic,
  'ats-modern': atsModern,
  'elegant': elegant,
  'minimalist': minimalist,
  'tech': tech,
  'executive': executive,
  'creative': creative,
  'academic': academic,
  'sidebar-modern': sidebarModern,
  'sidebar-elegant': sidebarElegant,
  'sidebar-tech': sidebarTech,
  'ats-chrono': atsChrono,
  'ats-scinde': atsScinde,
  'ats-frise': atsFrise,
  'marge': marge,
  'colonnes-filet': colonnesFilet,
  'ats-etiquettes': atsEtiquettes,
  'ats-bandes': atsBandes,
  'ats-lettre': atsLettre,
  'grille': grille,
  'cartes': cartes,
  'monogramme': monogramme,
  'magazine': magazine,
  'surligneur': surligneur,
  'grand-entete': grandEntete,
  'frise-centrale': friseCentrale,
};

/** Ordre d'affichage dans le sélecteur — groupé par catégorie. */
export const TEMPLATE_ORDER: string[] = [
  'ats-classic',
  'ats-modern',
  'ats-chrono',
  'ats-scinde',
  'ats-frise',
  'ats-etiquettes',
  'ats-bandes',
  'ats-lettre',
  'minimalist',
  'elegant',
  'executive',
  'tech',
  'creative',
  'monogramme',
  'surligneur',
  'grand-entete',
  'academic',
  'sidebar-modern',
  'sidebar-tech',
  'sidebar-elegant',
  'marge',
  'colonnes-filet',
  'grille',
  'cartes',
  'magazine',
  'frise-centrale',
];

export function getTemplate(id: string): CVTemplate {
  return templates[id] || atsClassic;
}

export function getTemplatesByCategory(category: TemplateCategory): CVTemplate[] {
  return TEMPLATE_ORDER
    .map(id => templates[id])
    .filter((t): t is CVTemplate => !!t && t.category === category);
}

export function getAllTemplates(): CVTemplate[] {
  return TEMPLATE_ORDER.map(id => templates[id]).filter((t): t is CVTemplate => !!t);
}
