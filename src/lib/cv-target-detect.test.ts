import { describe, expect, it } from 'bun:test';
import { detectTarget, detectTargetType } from './cv-target-detect';
import { resolveTarget } from './cv-targets';

// Textes d'annonce fictifs et anonymisés.
const PUBLIC_AD = 'Mairie de Villeneuve-Exemple. Suivi d\'un assistante commerciale (cadre d\'emplois des attachés territoriaux). Fonction publique territoriale.';
const PUBLIC_BY_COMPANY = 'Assistante commerciale, dossiers collectifs et concours.';
const SERVICES_AD = 'Société de conseil en organisation. Vous accompagnez des clients lors de missions chez nos clients.';
const ADMIN_AD = 'Assistante de gestion. Administration des ventes, facturation et suivi des commandes.';
const NEUTRAL_AD = 'Assistante commerciale (H/F). Vous pilotez les dossiers d\'une entreprise industrielle de 800 personnes.';

describe('détection du type de structure', () => {
  it('public : collectivité dans le texte ou dans le nom', () => {
    expect(detectTargetType(PUBLIC_AD)).toBe('public');
    expect(detectTargetType(PUBLIC_BY_COMPANY, 'Conseil départemental de l\'Exemple')).toBe('public');
    expect(detectTargetType(PUBLIC_BY_COMPANY, 'Centre de gestion fictif')).toBe('public');
  });
  it('services', () => {
    expect(detectTargetType(SERVICES_AD)).toBe('services');
    expect(detectTargetType('Poste en société de conseil, missions chez nos clients.')).toBe('services');
  });
  it('aucun signal net, ou signaux contradictoires : pas de détection', () => {
    expect(detectTargetType(NEUTRAL_AD)).toBeUndefined();
    expect(detectTargetType('Mairie de Villeneuve-Exemple, société de conseil partenaire.')).toBe('public');
  });
  it('« administration système » n\'est pas le secteur public', () => {
    expect(detectTargetType(ADMIN_AD)).toBeUndefined();
  });
});

describe('detectTarget', () => {
  it('annonce dès qu\'un texte est fourni, type seulement si net', () => {
    expect(detectTarget({ jobOfferText: NEUTRAL_AD })).toEqual({ intent: 'annonce' });
    expect(detectTarget({ jobOfferText: SERVICES_AD })).toEqual({ type: 'services', intent: 'annonce' });
    expect(detectTarget({ jobOfferText: '   ', company: 'Société de conseil fictive' })).toEqual({ type: 'services' });
    expect(detectTarget({ jobOfferText: '' })).toEqual({});
  });
  it('alimente resolveTarget : le choix explicite l\'emporte', () => {
    const detected = detectTarget({ jobOfferText: PUBLIC_AD });
    expect(resolveTarget({ type: 'auto' }, {}, detected).type).toBe('public');
    expect(resolveTarget({ type: 'startup' }, {}, detected).type).toBe('startup');
  });
});
