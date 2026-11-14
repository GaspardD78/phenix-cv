/**
 * Groupes de synonymes pour la correspondance de mots-clés entre un CV et une annonce.
 * Chaque tableau est un groupe de termes équivalents ; le premier est la forme canonique.
 * Tout est en minuscules. Vocabulaire volontairement généraliste (tous métiers).
 *
 * Utilisé par le score de compatibilité : « compta » ↔ « comptabilité », « sav » ↔ « service après-vente »…
 */
export const SYNONYM_GROUPS: readonly string[][] = [
  // Relation client et vente
  ['relation client', 'service client', 'accueil client', 'satisfaction client', 'customer service'],
  ['sav', 'service après-vente', 'après-vente', 'support client'],
  ['vente', 'vendeur', 'vendeuse', 'conseiller de vente', 'conseil client', 'sales'],
  ['commercial', 'commerciale', 'business developer', 'développement commercial', 'prospection'],
  ['négociation', 'négocier', 'closing'],
  ['fidélisation', 'fidéliser', 'rétention client'],
  ['devis', 'chiffrage', 'offre commerciale', 'proposition commerciale'],
  ['commande', 'prise de commande', 'traitement des commandes', 'gestion des commandes'],
  ['facturation', 'facture', 'émission de factures'],
  ['recouvrement', 'relance client', 'relances impayés'],

  // Administration et secrétariat
  ['secrétariat', 'assistanat', 'assistant administratif', 'assistante administrative', 'gestion administrative'],
  ['accueil', 'accueil physique', 'accueil téléphonique', 'standard', 'réception'],
  ['agenda', 'planning', 'gestion d\'agenda', 'organisation des déplacements'],
  ['classement', 'archivage', 'gestion documentaire'],
  ['courrier', 'gestion du courrier', 'rédaction de courriers'],
  ['saisie', 'saisie de données', 'encodage'],
  ['tableau de bord', 'reporting', 'suivi d\'indicateurs', 'indicateurs de suivi', 'kpi'],

  // Comptabilité, finance, paie
  ['comptabilité', 'compta', 'comptable', 'écritures comptables', 'tenue de comptabilité'],
  ['rapprochement bancaire', 'lettrage', 'rapprochements'],
  ['paie', 'gestion de la paie', 'bulletins de paie', 'bulletin de salaire'],
  ['budget', 'gestion budgétaire', 'suivi budgétaire', 'prévisionnel'],
  ['trésorerie', 'gestion de trésorerie', 'suivi de trésorerie'],

  // Logistique, achats, stocks
  ['logistique', 'supply chain', 'chaîne logistique', 'flux logistiques'],
  ['approvisionnement', 'achats', 'acheteur', 'sourcing fournisseurs'],
  ['stock', 'gestion des stocks', 'inventaire', 'gestion de stock'],
  ['expédition', 'livraison', 'préparation de commandes', 'picking'],
  ['entrepôt', 'magasinage', 'cariste', 'manutention'],
  ['transport', 'affrètement', 'tournées'],

  // Technique, maintenance, production
  ['maintenance', 'dépannage', 'entretien technique', 'maintenance préventive', 'maintenance corrective'],
  ['électricité', 'électricien', 'habilitation électrique', 'câblage'],
  ['mécanique', 'mécanicien', 'usinage', 'ajustage'],
  ['soudure', 'soudeur', 'soudage'],
  ['production', 'fabrication', 'ligne de production', 'conduite de ligne'],
  ['qualité', 'contrôle qualité', 'assurance qualité', 'démarche qualité'],
  ['sécurité', 'hygiène et sécurité', 'prévention des risques', 'qhse', 'hse'],
  ['plan de maintenance', 'gmao', 'suivi de maintenance'],
  ['lecture de plans', 'plans techniques', 'schémas techniques', 'dessin technique'],

  // Santé, social, éducation
  ['soins', 'soins infirmiers', 'aide-soignant', 'aide-soignante', 'prise en charge'],
  ['accompagnement', 'accompagnement social', 'suivi des personnes', 'aide à la personne'],
  ['enseignement', 'enseignant', 'formateur', 'formatrice', 'animation de formation'],
  ['animation', 'animateur', 'animatrice', 'encadrement de groupe'],
  ['petite enfance', 'éducateur de jeunes enfants', 'auxiliaire de puériculture', 'garde d\'enfants'],

  // Management et organisation
  ['management', 'encadrement', 'manager une équipe', 'gestion d\'équipe', 'animation d\'équipe'],
  ['gestion de projet', 'conduite de projet', 'pilotage de projet', 'chef de projet', 'cheffe de projet'],
  ['organisation', 'planification', 'priorisation', 'gestion des priorités'],
  ['formation', 'former', 'tutorat', 'accompagnement des nouveaux arrivants', 'intégration'],
  ['amélioration continue', 'optimisation des process', 'lean', 'kaizen'],

  // Communication, marketing
  ['communication', 'rédaction', 'création de contenus', 'contenus'],
  ['marketing', 'marketing digital', 'webmarketing', 'communication digitale'],
  ['réseaux sociaux', 'community management', 'community manager', 'social media'],
  ['événementiel', 'organisation d\'événements', 'salons', 'événements'],

  // Outils bureautiques courants
  ['excel', 'tableur', 'tableaux croisés dynamiques', 'tcd', 'spreadsheet'],
  ['word', 'traitement de texte'],
  ['powerpoint', 'présentation', 'diaporama'],
  ['microsoft 365', 'office 365', 'suite office', 'pack office', 'bureautique'],
  ['outlook', 'messagerie'],
  ['erp', 'sap', 'progiciel de gestion', 'progiciel'],
  ['crm', 'salesforce', 'hubspot', 'gestion de la relation client'],

  // Langues
  ['anglais', 'english', 'anglais courant', 'anglais professionnel'],
  ['espagnol', 'spanish'],
  ['allemand', 'german'],

  // Permis et habilitations
  ['permis b', 'permis de conduire', 'véhicule personnel'],
  ['caces', 'conduite d\'engins', 'chariot élévateur'],
];

/**
 * Flat map: every term → its canonical (first element of its group).
 * Built once at module load.
 */
export const SYNONYM_MAP = new Map<string, string>();

for (const group of SYNONYM_GROUPS) {
  const canonical = group[0];
  for (const term of group) {
    SYNONYM_MAP.set(term, canonical);
  }
}

/**
 * Light French plural normalization: strip trailing -s (length > 4).
 * "clients" → "client", "techniques" → "technique", "missions" → "mission".
 * Does not attempt -ment / -eur derivation (handled via synonym groups instead).
 */
export function normalizeFrenchPlural(word: string): string {
  if (word.length > 4 && word.endsWith('s') && !word.endsWith('ss')) {
    return word.slice(0, -1);
  }
  return word;
}

/**
 * Returns the canonical form of a term (lowercase).
 * 1. Exact synonym lookup
 * 2. Plural-normalised synonym lookup
 * 3. Falls back to plural-normalised form for consistent cross-token matching.
 */
export function getCanonical(term: string): string {
  const lower = term.toLowerCase();
  if (SYNONYM_MAP.has(lower)) return SYNONYM_MAP.get(lower)!;
  const normalized = normalizeFrenchPlural(lower);
  if (SYNONYM_MAP.has(normalized)) return SYNONYM_MAP.get(normalized)!;
  return normalized;
}

/**
 * Returns all known variants for a canonical term (including itself).
 */
export function getAllVariants(canonical: string): string[] {
  for (const group of SYNONYM_GROUPS) {
    if (group.includes(canonical)) return group;
  }
  return [canonical];
}
