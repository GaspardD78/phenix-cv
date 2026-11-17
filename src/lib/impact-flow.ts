/**
 * Parcours « CV à vrai impact » : étapes, valeurs de départ et textes. Logique pure, sans écran.
 *
 * Étape 1 : ce que le marché attend (fiche cible)   -> copie n°1, dans une NOUVELLE conversation
 * Étape 2 : votre profil face au marché (analyse)   -> copie n°2, puis questions une par une
 * Étape 3 : rédaction                               -> copie n°3 (texte de rédaction habituel + fiche + analyse)
 * Rien n'est obligatoire : « Passer la recherche » mène au texte de rédaction d'avant, sans fiche.
 */
import { gapQuestions, type GapAnalysis, type GapQuestion } from './cv-impact';

export type ImpactStage = 'skipped' | 'research' | 'brief' | 'gap' | 'questions' | 'ready';

export const IMPACT_STEP_LABELS: Readonly<Record<Exclude<ImpactStage, 'skipped'>, string>> = {
  research: 'Étape 1 sur 3 · Ce que le marché attend',
  brief: 'Étape 1 sur 3 · Ce que le marché attend',
  gap: 'Étape 2 sur 3 · Votre profil face au marché',
  questions: 'Étape 2 sur 3 · Quelques questions',
  ready: 'Étape 3 sur 3 · Rédaction',
};

/** Après l'analyse : les questions, ou directement la rédaction si l'IA n'en pose aucune. */
export function stageAfterGap(gap: GapAnalysis | null): ImpactStage {
  return gap && gapQuestions(gap).length > 0 ? 'questions' : 'ready';
}

/** Questions encore sans réponse (pour le compteur « 2 sur 4 »). */
export function unansweredCount(questions: readonly GapQuestion[], answers: Readonly<Record<string, string>>): number {
  return questions.filter(q => !(answers[q.key] ?? '').trim()).length;
}

/** Intitulé de l'offre : première ligne utile, sans « H/F », « (F/H) », « CDI »… ; 80 caractères au plus. */
export function roleFromOffer(offer: string): string {
  const line = offer.split('\n').map(l => l.trim()).find(l => l.length >= 3 && l.length <= 140) ?? '';
  return line
    .replace(/\(?\s*\b[hf]\s*\/\s*[hf]\b\s*\)?/gi, '')
    .replace(/\b(cdi|cdd|stage|alternance|intérim|interim|temps (plein|partiel))\b/gi, '')
    .replace(/\s{2,}/g, ' ').replace(/^[\s\-–:,.]+|[\s\-–:,.]+$/g, '')
    .slice(0, 80);
}

/** Métier proposé au départ : réponse « poste recherché », sinon poste visé du CV, sinon intitulé de l'offre, sinon titre du profil. */
export function defaultRole(src: { intentRole?: string | null; targetJob?: string | null; offerText?: string | null; profileTitle?: string | null }): string {
  const offer = src.offerText ? roleFromOffer(src.offerText) : '';
  return [src.intentRole, src.targetJob, offer, src.profileTitle].map(v => (v ?? '').trim()).find(Boolean) ?? '';
}

export const SKIP_RESEARCH_HINT = 'Sans recherche, le CV est rédigé avec le texte habituel, sans analyse du marché.';
export const RESEARCH_PRIVACY_NOTE = 'Ce texte ne contient ni votre nom ni vos coordonnées : seulement le métier, le secteur, l\'entreprise et l\'offre.';
export const RESEARCH_NEW_CONVERSATION = 'Collez-le dans une nouvelle conversation, et activez la recherche sur internet dans votre IA.';
export const RESEARCH_FAILED_TITLE = 'Recherche web indisponible, CV généré sans analyse de marché';
