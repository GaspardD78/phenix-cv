/** Sommaire des paramètres : groupes et pages (un seul écran à la fois, au lieu d'une longue page à faire défiler). */
export interface SettingsPageDef {
  id: string;
  label: string;
}
export interface SettingsGroupDef {
  label: string;
  pages: SettingsPageDef[];
}

export const SETTINGS_TREE: readonly SettingsGroupDef[] = [
  { label: 'Affichage', pages: [{ id: 'apparence', label: 'Apparence' }] },
  {
    label: "Rédaction avec l'IA",
    pages: [
      { id: 'ia-personnalisation', label: "Personnaliser l'IA" },
      { id: 'ia-longueur', label: 'Longueur du CV' },
      { id: 'ia-regles', label: 'Règles personnelles' },
      { id: 'ia-style', label: 'Style des phrases' },
      { id: 'ia-mises-en-avant', label: 'Mises en avant' },
      { id: 'ia-employeurs', label: "Types d'employeurs" },
    ],
  },
  {
    label: 'Mes données',
    pages: [
      { id: 'sauvegarde', label: 'Sauvegarde' },
      { id: 'restauration', label: 'Restauration' },
      { id: 'drive', label: 'Google Drive' },
    ],
  },
  { label: 'Avancé', pages: [{ id: 'avance', label: "Options avancées" }] },
  { label: 'Application', pages: [{ id: 'a-propos', label: 'À propos' }] },
];

export const DEFAULT_SETTINGS_PAGE = 'apparence';

export function allSettingsPageIds(): string[] {
  return SETTINGS_TREE.flatMap(g => g.pages.map(p => p.id));
}

/** Page à afficher : l'identifiant demandé s'il existe, sinon la première. */
export function resolveSettingsPage(id: string | null | undefined): string {
  return id && allSettingsPageIds().includes(id) ? id : DEFAULT_SETTINGS_PAGE;
}
