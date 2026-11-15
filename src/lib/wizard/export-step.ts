/** Écran 8 : export du premier CV et écran de fin. Logique pure, sans React. */

export type ExportFormat = 'pdf' | 'docx';

export const FORMAT_LABEL: Readonly<Record<ExportFormat, string>> = { pdf: 'PDF', docx: 'Word' };

/** Nom du fichier à partir d'un chemin Windows ou Unix. */
export function fileNameOf(path: string): string {
  const parts = path.split(/[\\/]/).filter(Boolean);
  return parts[parts.length - 1] ?? path;
}

/** Message affiché après l'enregistrement. */
export function savedMessage(format: ExportFormat, path: string): string {
  return `Votre CV en ${FORMAT_LABEL[format]} est enregistré : ${fileNameOf(path)}.`;
}

export interface NextStep {
  title: string;
  text: string;
  /** Route de l'application ; `{cv}` est remplacé par l'identifiant du CV créé par le guide. */
  route: string;
}

/** Prochaines étapes proposées sur l'écran de fin. */
export const NEXT_STEPS: readonly NextStep[] = [
  { title: 'Adapter ce CV à une offre', text: 'Collez une annonce : le CV met en avant ce qu\'elle demande.', route: '/cv/{cv}?mode=offer' },
  { title: 'Retoucher la mise en page', text: 'Changez de modèle, de police ou de couleurs dans l\'éditeur.', route: '/cv/{cv}' },
  { title: 'Compléter votre profil', text: 'Ajoutez des expériences, des projets ou des certifications.', route: '/profile' },
  { title: 'Suivre vos candidatures', text: 'Notez où vous avez postulé et les relances à faire.', route: '/tracker' },
];

/** Route d'une prochaine étape ; sans CV, les étapes liées au CV renvoient vers « Mes CV ». */
export function nextStepRoute(step: NextStep, cvId: string | null): string {
  if (!step.route.includes('{cv}')) return step.route;
  return cvId ? step.route.replace('{cv}', encodeURIComponent(cvId)) : '/cv';
}
