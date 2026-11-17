import { describe, expect, it } from 'bun:test';
import { DEFAULT_MODE_BADGE, DEFAULT_NEW_CV_MODE, NEW_CV_MODE_INFO, parseNewCvMode, suggestCvName } from './new-cv';

describe('nouveau CV', () => {
  it('le CV standard est le choix par défaut, et les deux parcours sont décrits', () => {
    expect(DEFAULT_NEW_CV_MODE).toBe('standard');
    expect(DEFAULT_MODE_BADGE).toBe('Conseillé pour commencer');
    expect(NEW_CV_MODE_INFO.standard.label).toBe('CV standard');
    expect(NEW_CV_MODE_INFO.offer.label).toBe('Adapter à une offre');
  });
  it('les descriptions présentent l\'IA d\'abord ; le CV standard reste possible sans IA', () => {
    const standard = NEW_CV_MODE_INFO.standard.description;
    expect(standard.indexOf('une IA rédige')).toBeGreaterThan(-1);
    expect(standard.indexOf('sans IA')).toBeGreaterThan(standard.indexOf('une IA rédige'));
    expect(NEW_CV_MODE_INFO.offer.description).toContain('une IA adapte');
  });
  it('mode lu dans l\'adresse : seulement les valeurs connues', () => {
    expect(parseNewCvMode('offer')).toBe('offer');
    expect(parseNewCvMode('standard')).toBe('standard');
    expect(parseNewCvMode('autre')).toBeNull();
    expect(parseNewCvMode(null)).toBeNull();
  });
  it('nom suggéré', () => {
    expect(suggestCvName('standard', 'Assistante commerciale')).toBe('CV Assistante commerciale – standard');
    expect(suggestCvName('offer', ' Assistante commerciale ')).toBe('CV Assistante commerciale – offre');
    expect(suggestCvName('standard', null)).toBe('Mon CV – standard');
  });
});
