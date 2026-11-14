/**
 * Détection automatique du ciblage, côté application et avant le prompt : heuristiques
 * simples sur le texte de l'annonce et le nom de l'entreprise, sans IA. Un axe incertain
 * n'est pas détecté (il reste à `auto`, l'IA pourra le proposer via `analyse.cible`).
 */
import { isPublicSectorText } from './public-sector';
import type { DetectedTarget, TargetType } from './cv-targets';

const SERVICES_RE = new RegExp([
  'soci[ée]t[ée] de conseil', 'soci[ée]t[ée] de services', 'cabinet de conseil', 'cabinet d.audit',
  'missions? chez nos clients', 'pour le compte de nos clients', 'en r[ée]gie', 'agence de conseil',
].join('|'), 'i');

/** Type de structure détecté, ou `undefined` si aucun signal net (ou signaux contradictoires). */
export function detectTargetType(jobOfferText: string, company?: string | null): TargetType | undefined {
  const text = `${company ?? ''}\n${jobOfferText}`;
  if (isPublicSectorText(company ?? '', jobOfferText)) return 'public';
  return SERVICES_RE.test(text) ? 'services' : undefined;
}

/** Axes détectés par l'application : type de structure, et `annonce` quand un texte d'annonce est fourni. */
export function detectTarget(input: { jobOfferText: string; company?: string | null }): DetectedTarget {
  const detected: DetectedTarget = {};
  const type = detectTargetType(input.jobOfferText, input.company);
  if (type) detected.type = type;
  if (input.jobOfferText.trim()) detected.intent = 'annonce';
  return detected;
}
