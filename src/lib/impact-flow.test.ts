import { describe, expect, it } from 'bun:test';
import { defaultRole, roleFromOffer, stageAfterGap, unansweredCount } from './impact-flow';
import type { GapAnalysis } from './cv-impact-blocks';

const gap = (realGaps: GapAnalysis['realGaps']): GapAnalysis => ({ aligned: [], toReword: [], realGaps, toMinimize: [], decisions: [] });

describe('parcours à vrai impact', () => {
  it('l\'écran des questions est sauté quand l\'IA n\'en pose aucune', () => {
    expect(stageAfterGap(gap([]))).toBe('ready');
    expect(stageAfterGap(gap([{ expectation: 'ERP', treatment: 'suggestion', suggestion: 'Formation' }]))).toBe('ready');
    expect(stageAfterGap(gap([{ expectation: 'ERP', treatment: 'question', question: 'Avez-vous utilisé un ERP ?' }]))).toBe('questions');
    expect(stageAfterGap(null)).toBe('ready');
  });

  it('questions sans réponse', () => {
    const q = [{ key: 'a', expectation: '', text: '?' }, { key: 'b', expectation: '', text: '?' }];
    expect(unansweredCount(q, { a: ' ', b: 'Oui' })).toBe(1);
    expect(unansweredCount(q, {})).toBe(2);
  });

  it('intitulé tiré d\'une offre', () => {
    expect(roleFromOffer('Assistante ADV (H/F) - CDI\nLaiterie du Val recrute…')).toBe('Assistante ADV');
    expect(roleFromOffer('\n\nAssistant(e) commercial(e) F/H\nVotre mission')).toBe('Assistant(e) commercial(e)');
    expect(roleFromOffer('')).toBe('');
    expect(roleFromOffer('x'.repeat(300))).toBe('');
  });

  it('métier proposé au départ : réponses du CV standard d\'abord, puis poste du CV, offre, profil', () => {
    expect(defaultRole({ intentRole: 'Assistante ADV', targetJob: 'Autre', profileTitle: 'Assistante commerciale' })).toBe('Assistante ADV');
    expect(defaultRole({ intentRole: '  ', targetJob: 'Assistante ADV' })).toBe('Assistante ADV');
    expect(defaultRole({ offerText: 'Gestionnaire ADV H/F\nVotre mission', profileTitle: 'Assistante commerciale' })).toBe('Gestionnaire ADV');
    expect(defaultRole({ profileTitle: 'Assistante commerciale' })).toBe('Assistante commerciale');
    expect(defaultRole({})).toBe('');
  });
});
