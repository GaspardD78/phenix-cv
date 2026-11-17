import type { CVDocument } from '@/types/cv';
import { readCvIntent, type CvIntent } from './cv-intent';
/** Création d'un CV : les deux parcours proposés et le nom suggéré. Pur, testable. */

export const NEW_CV_MODES = ['standard', 'offer'] as const;
export type NewCvMode = (typeof NEW_CV_MODES)[number];
export const DEFAULT_NEW_CV_MODE: NewCvMode = 'standard';

export const NEW_CV_MODE_INFO: Readonly<Record<NewCvMode, { label: string; description: string }>> = {
  standard: {
    label: 'CV standard',
    description: 'Vous répondez à quelques questions (poste visé, ce que vous voulez montrer…), puis une IA rédige votre CV avec les mots de votre métier. Possible aussi sans IA.',
  },
  offer: {
    label: 'Adapter à une offre',
    description: "Vous collez une offre d'emploi : une IA adapte votre CV à cette offre, sans rien inventer.",
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

/** Badge du parcours sélectionné par défaut dans « Nouveau CV ». */
export const DEFAULT_MODE_BADGE = 'Conseillé pour commencer';

/** Onglet d'ouverture du panneau « Créer et adapter mon CV ». */
export type AiStartTab = 'intent' | 'intent-ai' | 'full';

/**
 * Adresse ouverte par « Rédiger avec l'IA » depuis le guide de démarrage : l'éditeur du CV,
 * directement sur le parcours IA du CV standard (`ia=1`), avec les réponses enregistrées dans le CV.
 */
export function wizardAiRoute(cvId: string): string {
  return `/cv/${cvId}?mode=standard&ia=1`;
}

/** Onglet d'ouverture lu dans l'adresse de l'éditeur (`?mode=offer`, `?mode=standard&ia=1`). */
export function aiStartTabFromParams(params: URLSearchParams): AiStartTab {
  if (parseNewCvMode(params.get('mode')) === 'offer') return 'full';
  return params.get('ia') === '1' ? 'intent-ai' : 'intent';
}

/**
 * Réponses à reprendre à l'ouverture du parcours IA : celles enregistrées dans le CV
 * (`cv.settings.cvIntent`), seulement pour `intent-ai` et si le poste visé est renseigné.
 */
export function intentToResume(startTab: AiStartTab, settings: Record<string, unknown> | null | undefined): CvIntent | null {
  if (startTab !== 'intent-ai') return null;
  const saved = readCvIntent(settings);
  return saved && saved.role.trim() ? saved : null;
}
