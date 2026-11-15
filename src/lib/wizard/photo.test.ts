import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { MAX_PHOTO_BYTES, PHOTO_TIPS, photoContinue, validatePhotoFile } from './photo';
import { completeStep, initialWizardState, parseWizardState, serializeWizardState, skipStep } from './state';
import { missingHelpIds, HELP } from '@/content/help';

describe('fichier photo', () => {
  it('accepte JPEG, PNG et WebP', () => {
    for (const type of ['image/jpeg', 'image/png', 'image/webp']) {
      expect(validatePhotoFile({ type, size: 200_000 })).toBeNull();
    }
  });

  it('refuse un autre format, avec un message simple', () => {
    expect(validatePhotoFile({ type: 'application/pdf', size: 1000 })).toBe('Choisissez une image au format JPEG, PNG ou WebP.');
    expect(validatePhotoFile({ type: 'image/gif', size: 1000 })).not.toBeNull();
  });

  it('refuse une image de plus de 10 Mo', () => {
    expect(validatePhotoFile({ type: 'image/png', size: MAX_PHOTO_BYTES + 1 })).toContain('trop lourde');
    expect(validatePhotoFile({ type: 'image/png', size: MAX_PHOTO_BYTES })).toBeNull();
  });
});

describe('continuer depuis l\'écran 5', () => {
  it('avec une photo : l\'étape est validée', () => {
    expect(photoContinue(true)).toEqual({ action: 'complete', label: 'Valider et continuer' });
    const s = completeStep({ ...initialWizardState(), step: 'photo' });
    expect(s.completed).toContain('photo');
    expect(s.step).toBe('enrich');
  });

  it('sans photo : on peut toujours continuer, l\'étape est passée', () => {
    expect(photoContinue(false)).toEqual({ action: 'skip', label: 'Continuer sans photo' });
    const s = skipStep({ ...initialWizardState(), step: 'photo' });
    expect(s.skipped).toContain('photo');
    expect(s.completed).not.toContain('photo');
    expect(s.step).toBe('enrich');
  });

  it('reprise : un état enregistré à l\'étape photo rouvre l\'écran 5', () => {
    const saved = serializeWizardState({ ...initialWizardState(), step: 'photo', completed: ['welcome', 'start', 'import', 'verify'] });
    expect(parseWizardState(saved).step).toBe('photo');
  });
});

describe('conseils et aide « ? »', () => {
  it('quatre conseils, sans jargon', () => {
    expect(PHOTO_TIPS).toHaveLength(4);
    for (const tip of PHOTO_TIPS) expect(tip).not.toMatch(/JSON|LLM|IA/);
  });

  it('l\'écran 5 a un « ? » relié à une entrée d\'aide et à la page wiki photo', () => {
    const source = readFileSync(new URL('../../components/wizard/WizardPage.tsx', import.meta.url), 'utf8');
    expect(source).toContain("step === 'photo' ? 'photo'");
    expect(missingHelpIds(['photo'])).toEqual([]);
    expect(HELP.photo.page).toBe('profil-photo');
  });
});
