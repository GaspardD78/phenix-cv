import type { CVDocument } from '@/types/cv';
/** Création d'un CV : les deux parcours proposés et le nom suggéré. Pur, testable. */

export const NEW_CV_MODES = ['standard', 'offer'] as const;
export type NewCvMode = (typeof NEW_CV_MODES)[number];
export const DEFAULT_NEW_CV_MODE: NewCvMode = 'standard';

export const NEW_CV_MODE_INFO: Readonly<Record<NewCvMode, { label: string; description: string }>> = {
  standard: {
    label: 'CV standard',
    description: 'Vous répondez à quelques questions (poste visé, ce que vous voulez montrer…) et nous composons votre CV. Sans offre, sans IA.',
  },
  offer: {
    label: 'Adapter à une offre',
    description: "Vous collez une offre d'emploi : nous proposons une version de votre CV ciblée sur cette offre.",
  },
};

export function parseNewCvMode(value: string | null | undefined): NewCvMode | null {
  return (NEW_CV_MODES as readonly string[]).includes(value ?? '') ? (value as NewCvMode) : null;
}

/** Nom proposé pour le CV, que la personne peut modifier : « CV Assistante commerciale – standard ». */
export function suggestCvName(mode: NewCvMode, profileTitle: string | null | undefined): string {
  const title = profileTitle?.trim();
  const suffix = mode === 'standard' ? 'standard' : 'offre';
  return title ? `CV ${title} – ${suffix}` : `Mon CV – ${suffix}`;
}

/**
 * Enregistrement d'un CV neuf, partagé par « Nouveau CV » (Mes CV) et le guide de démarrage :
 * modèle ATS classique, aucun réglage, le parcours (standard ou offre) s'ouvre ensuite dans l'éditeur.
 */
export function newCvRecord(profileId: string, name: string): Omit<CVDocument, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    profileId, name: name.trim(), templateId: 'ats-classic', targetJob: null, targetCompany: null,
    customSummary: null, settings: {}, isFavorite: false, lastExported: null, markdownContent: null, markdownMode: 0,
  };
}

/** Nom de CV : non vide après nettoyage. */
export function validateCvName(name: string): string | null {
  return name.trim() ? null : 'Donnez un nom à votre CV.';
}
