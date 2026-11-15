import { describe, expect, it } from 'bun:test';
import { DEFAULT_NEW_CV_MODE, NEW_CV_MODE_INFO, parseNewCvMode, suggestCvName } from './new-cv';

describe('nouveau CV', () => {
  it('le CV standard est le choix par défaut, et les deux parcours sont décrits', () => {
    expect(DEFAULT_NEW_CV_MODE).toBe('standard');
    expect(NEW_CV_MODE_INFO.standard.label).toBe('CV standard');
    expect(NEW_CV_MODE_INFO.offer.label).toBe('Adapter à une offre');
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
